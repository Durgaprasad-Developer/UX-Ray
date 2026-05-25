import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { BrowserSimulator } from "@/lib/playwright";
import { getAgentDecision, recognizeApp, AppProfile } from "@/lib/ai";

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
      if (!session) {
        send("error", { message: "Session not found." });
        controller.close();
        return;
      }

      await prisma.session.update({ where: { id: sessionId }, data: { status: "running" } });

      const simulator = new BrowserSimulator();
      const maxSteps = 20;
      const startTime = Date.now();
      let appProfile: AppProfile | undefined;
      let consecutiveScrolls = 0;
      const visitedUrls: string[] = [];

      // Parse credentials if provided
      let credentials: { username?: string; password?: string } | null = null;
      try {
        if (session.credentials) credentials = JSON.parse(session.credentials);
      } catch {}

      try {
        send("log", { message: "Launching isolated Chromium sandbox..." });
        await simulator.initialize();

        send("log", { message: `Navigating to ${session.url}...` });
        await simulator.navigate(session.url);
        visitedUrls.push(session.url);

        // Take initial screenshot + page text simultaneously for App Recognizer
        send("log", { message: "Scanning page structure and content..." });
        const [initialScreenshot, pageText] = await Promise.all([
          simulator.screenshotBase64(),
          simulator.getPageText(),
        ]);

        // Run App Recognizer
        send("log", { message: "App Recognizer building mental model of your product..." });
        const recognizerPromise = recognizeApp({
          url: session.url,
          description: session.description,
          pageText,
        });

        // Save landing event while recognizer runs
        const landingEvent = await prisma.interactionEvent.create({
          data: {
            sessionId: session.id,
            timestamp: 0,
            action: "navigate",
            target: "Landed on homepage",
            reasoning: "First impression — reviewing layout, value proposition, and navigation structure.",
            screenshotUrl: `data:image/png;base64,${initialScreenshot}`,
          },
        });

        send("event", {
          id: landingEvent.id, timestamp: 0, action: "navigate",
          target: landingEvent.target, reasoning: landingEvent.reasoning,
          screenshotUrl: landingEvent.screenshotUrl,
        });

        appProfile = await recognizerPromise;
        send("log", { message: `✓ Recognized: ${appProfile.appType}` });
        send("log", { message: `✓ Audience: ${appProfile.audiencePersona}` });
        send("log", { message: `✓ Pages to test: ${appProfile.navigationPages.join(", ")}` });
        if (appProfile.requiresAuth && credentials) send("log", { message: `✓ Login credentials ready` });
        if (appProfile.requiresAuth && !credentials) send("log", { message: `⚠ App requires auth — no credentials provided. Will test public pages only.` });

        await prisma.session.update({
          where: { id: sessionId },
          data: { appProfile: JSON.stringify(appProfile) },
        });

        // ── Main Interaction Loop ──────────────────────────────────────────────
        let isDone = false;
        let step = 0;

        while (step < maxSteps && !isDone) {
          step++;

          try {
            // Get current page state + elements
            const [elements, pageState] = await Promise.all([
              simulator.getInteractableElements(),
              simulator.getPageState(),
            ]);

            const history = await prisma.interactionEvent.findMany({
              where: { sessionId: session.id },
              orderBy: { timestamp: "asc" },
              select: { action: true, target: true, reasoning: true },
            });

            // Detect action loop (same action + target 3 times in a row)
            let isStuckInActionLoop = false;
            if (history.length >= 3) {
              const last3 = history.slice(-3);
              if (last3.every(h => h.action === last3[0].action && h.target === last3[0].target) &&
                  !["wait", "scroll"].includes(last3[0].action)) {
                isStuckInActionLoop = true;
              }
            }
            const isStuckScrolling = consecutiveScrolls >= 3;

            if (consecutiveScrolls >= 5) {
              send("log", { message: `[Step ${step}] Reached page end — no more content. Moving on.` });
              // Try clicking a nav link instead of giving up
              consecutiveScrolls = 0;
            }

            send("log", { message: `[Step ${step}/${maxSteps}] ${elements.length} elements visible — ${pageState.isLoaded ? "page ready" : "page loading..."}` });

            const decision = await getAgentDecision({
              url: session.url,
              description: session.description,
              prompt: session.prompt || "Test the complete user experience from start to finish",
              appProfile,
              credentials,
              pageState,
              isStuckScrolling,
              isStuckInActionLoop,
              elements,
              history: history.map(h => ({ action: h.action, target: h.target || undefined, reasoning: h.reasoning || undefined })),
              visitedUrls,
            });

            send("thought", { thought: decision.thought, action: decision.action });

            if (decision.action === "done") {
              send("log", { message: `[Step ${step}] Navigator completed the session — all key areas tested.` });
              isDone = true;
              break;
            }

            // Execute action
            let targetText = "";
            try {
              if (decision.action === "click" && decision.targetId) {
                targetText = await simulator.click(decision.targetId);
                consecutiveScrolls = 0;
                // Track if URL changed
                const currentUrl = await simulator.getCurrentUrl?.() || session.url;
                if (currentUrl !== visitedUrls[visitedUrls.length - 1]) visitedUrls.push(currentUrl);
              } else if (decision.action === "type" && decision.targetId && decision.value) {
                targetText = await simulator.type(decision.targetId, decision.value);
                consecutiveScrolls = 0;
              } else if (decision.action === "scroll") {
                targetText = await simulator.scroll();
                consecutiveScrolls++;
              } else if (decision.action === "wait") {
                targetText = await simulator.wait();
                consecutiveScrolls = 0;
              }
            } catch (actionErr: any) {
              console.warn(`[Step ${step}] Action error (non-fatal): ${actionErr.message}`);
              targetText = `(action had minor issue: ${actionErr.message?.slice(0, 60)})`;
            }

            const screenshot = await simulator.screenshotBase64();
            const offsetSeconds = Math.round((Date.now() - startTime) / 1000);

            const event = await prisma.interactionEvent.create({
              data: {
                sessionId: session.id,
                timestamp: offsetSeconds,
                action: decision.action,
                target: targetText,
                reasoning: decision.thought,
                screenshotUrl: `data:image/png;base64,${screenshot}`,
              },
            });

            send("event", {
              id: event.id, timestamp: event.timestamp, action: event.action,
              target: event.target, reasoning: event.reasoning, screenshotUrl: event.screenshotUrl,
            });

            await new Promise(r => setTimeout(r, 800));

          } catch (stepErr: any) {
            // Per-step error isolation — log and continue, don't kill session
            console.warn(`[Step ${step}] Step error (continuing): ${stepErr.message}`);
            send("log", { message: `[Step ${step}] Recovered from minor issue — continuing...` });
            await new Promise(r => setTimeout(r, 1000));
          }
        }

        await prisma.session.update({
          where: { id: sessionId },
          data: { status: "completed", completedAt: new Date() },
        });

        const stepSummary = isDone ? "All key areas tested." : `Completed ${step} steps — reached session limit.`;
        send("log", { message: `Session complete. ${stepSummary}` });
        send("complete", { message: "Simulation finished.", mode: "analysis", status: "success" });

      } catch (err: any) {
        console.error("Fatal session error:", err);
        await prisma.session.update({
          where: { id: sessionId },
          data: { status: "failed", error: err.message || "Unknown error." },
        }).catch(() => {});
        send("error", { message: err.message || "Session encountered a fatal error." });
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
