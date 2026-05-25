import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { BrowserSimulator } from "@/lib/playwright";
import { buildPagePlan, recognizeApp, AppProfile, QueueItem } from "@/lib/ai";

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
      const MAX_TOTAL_STEPS = 25;
      const MAX_PAGES = 5;
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
        appProfile = await recognizeApp({ url: session.url, description: session.description, pageText: pageText0 });

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

        // ── Phase 2: Queue-based page exploration ─────────────────────────────
        let isDone = false;
        let currentQueue: QueueItem[] = [];
        let lastBuiltForUrl = "";

        while (!isDone && totalSteps < MAX_TOTAL_STEPS && pagesVisited < MAX_PAGES) {
          const currentUrl = await simulator.getCurrentUrl();

          // Rebuild plan when: queue empty OR page changed
          if (currentQueue.length === 0 || currentUrl !== lastBuiltForUrl) {
            if (currentUrl !== lastBuiltForUrl) {
              pagesVisited++;
              send("log", { message: `📄 Now testing: ${currentUrl}` });
              visitedUrls.push(currentUrl);
            }

            try {
              const scan = await simulator.getPageScan();
              const history = await prisma.interactionEvent.findMany({
                where: { sessionId: session.id },
                orderBy: { timestamp: "asc" },
                select: { action: true, target: true },
              });

              send("log", { message: `🧠 Planning: found ${scan.forms.length} form(s), ${scan.tabGroups.length} tab group(s), ${scan.primaryCTAIds.length} CTA(s)` });

              currentQueue = await buildPagePlan({
                scan,
                appProfile: appProfile!,
                credentials,
                history: history.map(h => ({ action: h.action, target: h.target || undefined })),
                visitedUrls,
              });

              send("log", { message: `📋 Plan: ${currentQueue.length} actions queued` });
              lastBuiltForUrl = currentUrl;
            } catch (planErr: any) {
              send("log", { message: `Plan build error: ${planErr.message}. Skipping page.` });
              isDone = true;
              break;
            }
          }

          if (currentQueue.length === 0) { isDone = true; break; }

          const item = currentQueue.shift()!;

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
                currentQueue = [];
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

          try {
            if (item.type === "type" && item.elementId) {
              targetText = await simulator.type(item.elementId, item.value);
            } else if (item.type === "typeOnly" && item.elementId) {
              targetText = await simulator.typeOnly(item.elementId, item.value);
              actionName = "type";
            } else if (item.type === "click" && item.elementId) {
              targetText = await simulator.click(item.elementId);
            } else if (item.type === "wait") {
              targetText = await simulator.wait();
            } else if (item.type === "scroll") {
              targetText = await simulator.scroll();
            }
          } catch (actionErr: any) {
            console.warn(`[Step ${totalSteps}] Action error (non-fatal): ${actionErr.message}`);
            targetText = `(element not found — minor simulation issue)`;
          }

          const screenshot = await simulator.screenshotBase64();
          const offsetSeconds = Math.round((Date.now() - startTime) / 1000);
          const purpose = (item as any).purpose || "";

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

          await new Promise(r => setTimeout(r, 600));
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
