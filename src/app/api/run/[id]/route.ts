import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { BrowserSimulator } from "@/lib/playwright";
import { getAgentDecision, recognizeApp, AppProfile, QueueItem } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionId = params.id;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: any) {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {}
      }

      const session = await prisma.session.findUnique({ where: { id: sessionId } });
      if (!session) { send("error", { message: "Session not found." }); controller.close(); return; }

      await prisma.session.update({ where: { id: sessionId }, data: { status: "running" } });

      const simulator = new BrowserSimulator();
      const startTime = Date.now();
      const visitedUrls: string[] = [];
      let appProfile: AppProfile | undefined;
      let credentials: { username?: string; password?: string } | null = null;
      let totalSteps = 0;
      const MAX_TOTAL_STEPS = 40;
      const MAX_PAGES = 8;
      let pagesVisited = 0;

      try {
        if (session.credentials) credentials = JSON.parse(session.credentials);
      } catch {}

      try {
        send("log", { message: "Launching isolated Chromium sandbox..." });
        await simulator.initialize();

        send("log", { message: `Navigating to ${session.url}...` });
        await simulator.navigate(session.url);
        visitedUrls.push(session.url);

        // ── Phase 1: App Recognition ──────────────────────────────────────────
        send("log", { message: "Scanning page structure..." });
        const [screenshot0, pageText0] = await Promise.all([
          simulator.screenshotBase64(),
          simulator.getPageText(),
        ]);

        send("log", { message: "App Recognizer building mental model of your product..." });
        appProfile = await recognizeApp({ url: session.url, description: session.description, pageText: pageText0, userObjective: session.prompt || undefined });

        send("log", { message: `✓ Identified: ${appProfile.appType}` });
        send("log", { message: `✓ Audience: ${appProfile.audiencePersona}` });
        send("log", { message: `✓ Pages to cover: ${appProfile.navigationPages.join(", ")}` });
        if (credentials?.username) send("log", { message: "✓ Login credentials ready" });

        await prisma.session.update({ where: { id: sessionId }, data: { appProfile: JSON.stringify(appProfile) } });

        // Save landing event
        const landingEvent = await prisma.interactionEvent.create({
          data: {
            sessionId: session.id,
            timestamp: 0,
            action: "navigate",
            target: `Landed on ${new URL(session.url).hostname}`,
            reasoning: "First impression — reading layout, value proposition, and navigation.",
            screenshotUrl: `data:image/png;base64,${screenshot0}`,
          },
        });
        send("event", { id: landingEvent.id, timestamp: 0, action: "navigate", target: landingEvent.target, reasoning: landingEvent.reasoning, screenshotUrl: landingEvent.screenshotUrl });

        // ── Phase 2: Autonomous Agentic Exploration ─────────────────────────────
        let isDone = false;
        let lastBuiltForUrl = "";
        const typedElementIds = new Set<number>();

        while (!isDone && totalSteps < MAX_TOTAL_STEPS && pagesVisited < MAX_PAGES) {
          const currentUrl = await simulator.getCurrentUrl();

          if (currentUrl !== lastBuiltForUrl) {
            pagesVisited++;
            send("log", { message: `📄 Now testing: ${currentUrl}` });
            if (!visitedUrls.includes(currentUrl)) visitedUrls.push(currentUrl);
            lastBuiltForUrl = currentUrl;
            typedElementIds.clear();
          }

          let decision: { thought: string; action: QueueItem } | null = null;

          let scan: import("@/lib/playwright").PageScan | null = null;
          try {
            scan = await simulator.getPageScan();
            const history = await prisma.interactionEvent.findMany({
              where: { sessionId: session.id },
              orderBy: { timestamp: "asc" },
              select: { action: true, target: true },
            });

            send("log", { message: `🧠 Thinking...` });

            decision = await getAgentDecision({
              scan,
              appProfile: appProfile!,
              history: history.map(h => ({ action: h.action, target: h.target || undefined })),
              visitedUrls,
              typedElementIds: Array.from(typedElementIds),
              credentials: credentials || undefined,
              userObjective: session.prompt || undefined,
            });

            if (decision.thought) {
              send("thought", decision.thought);
            }
          } catch (planErr: any) {
            send("log", { message: `Decision error: ${planErr.message}. Skipping page.` });
            isDone = true;
            break;
          }

          if (!decision || !decision.action) {
            isDone = true;
            break;
          }

          const item = decision.action;

          // Handle done
          if (item.type === "done") {
            send("log", { message: `✓ Page complete: ${(item as any).summary || "all items tested"}` });

            // Try to navigate to a next unvisited nav page
            const nextUrl = appProfile?.navigationPages?.find(p => !visitedUrls.some(v => v.includes(p)));
            if (nextUrl && pagesVisited < MAX_PAGES - 1) {
              try {
                const fullUrl = nextUrl.startsWith("http") ? nextUrl : new URL(nextUrl, session.url).href;
                send("log", { message: `🔗 Moving to: ${fullUrl}` });
                await simulator.navigate(fullUrl);
                lastBuiltForUrl = ""; // force rebuild
                continue;
              } catch {}
            }

            isDone = true;
            break;
          }

          totalSteps++;
          send("log", { message: `[${totalSteps}] ${item.type.toUpperCase()} — ${(item as any).purpose || ""}` });

          // Execute queue item
          let targetText = "";
          let actionName = item.type;
          
          let elInfo = "";
          if ("elementId" in item && item.elementId && decision && scan) {
             const elId = item.elementId;
             const el = scan.elements.find(e => e.id === elId);
             if (el) elInfo = el.placeholder || el.name || el.tag || String(elId);
          }

          try {
            if (item.type === "type" && "elementId" in item && "value" in item) {
              const val = await simulator.type(item.elementId, item.value);
              targetText = `[${elInfo}] <- "${val}"`;
              typedElementIds.add(item.elementId);
            } else if (item.type === "typeOnly" && "elementId" in item && "value" in item) {
              const val = await simulator.typeOnly(item.elementId, item.value);
              targetText = `[${elInfo}] <- "${val}"`;
              actionName = "type";
              typedElementIds.add(item.elementId);
            } else if (item.type === "click" && "elementId" in item) {
              const val = await simulator.click(item.elementId);
              targetText = `[${elInfo}] ${val}`;
            } else if (item.type === "wait") {
              targetText = await simulator.wait();
            } else if (item.type === "scroll") {
              targetText = await simulator.scroll();
            }
          } catch (actionErr: any) {
            console.warn(`[Step ${totalSteps}] Action error (non-fatal): ${actionErr.message}`);
            targetText = `[${elInfo || "unknown"}] (element not found or intractable)`;
          }

          const screenshot = await simulator.screenshotBase64();
          const offsetSeconds = Math.round((Date.now() - startTime) / 1000);
          const purpose = (item as any).purpose || decision!.thought;

          const event = await prisma.interactionEvent.create({
            data: {
              sessionId: session.id,
              timestamp: offsetSeconds,
              action: actionName,
              target: targetText || purpose,
              reasoning: purpose,
              screenshotUrl: `data:image/png;base64,${screenshot}`,
            },
          });

          send("event", {
            id: event.id, timestamp: event.timestamp, action: event.action,
            target: event.target, reasoning: event.reasoning, screenshotUrl: event.screenshotUrl,
          });

          await new Promise(r => setTimeout(r, 800));
        }

        // ── Wrap up ───────────────────────────────────────────────────────────
        await prisma.session.update({
          where: { id: sessionId },
          data: { status: "completed", completedAt: new Date() },
        });
        send("log", { message: `✓ Session complete — ${totalSteps} interactions across ${pagesVisited} page(s).` });
        send("complete", { message: "Analysis finished.", mode: "analysis", status: "success" });

      } catch (err: any) {
        console.error("Fatal session error:", err);
        await prisma.session.update({ where: { id: sessionId }, data: { status: "failed", error: err.message } }).catch(() => {});
        send("error", { message: err.message || "Session failed." });
      } finally {
        await simulator.cleanup();
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
