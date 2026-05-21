import { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { BrowserSimulator } from "@/lib/playwright";
import { getAgentDecision } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionId = params.id;

  const encoder = new TextEncoder();

  // Create ReadableStream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      function sendSSE(event: string, data: any) {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          // Stream might have been closed by user leaving the page
        }
      }

      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { events: true }
      });

      if (!session) {
        sendSSE("error", { message: "Session not found." });
        controller.close();
        return;
      }

      // Mark session as running
      await prisma.session.update({
        where: { id: sessionId },
        data: { status: "running" }
      });

      const simulator = new BrowserSimulator();
      let step = 0;
      const maxSteps = session.mode === "task" ? 15 : 8;
      const startTime = Date.now();

      try {
        sendSSE("log", { message: "Launching isolated browser context..." });
        await simulator.initialize();

        sendSSE("log", { message: `Navigating to ${session.url}...` });
        await simulator.navigate(session.url);

        // Take initial screenshot
        sendSSE("log", { message: "Analyzing page visual layout..." });
        const initialScreenshot = await simulator.screenshotBase64();
        
        // Save initial landing event
        const landingEvent = await prisma.interactionEvent.create({
          data: {
            sessionId: session.id,
            timestamp: 0,
            action: "navigate",
            target: "Landed on homepage",
            reasoning: "Reviewing first impression load load and structure.",
            screenshotUrl: `data:image/png;base64,${initialScreenshot}`
          }
        });

        sendSSE("event", {
          id: landingEvent.id,
          timestamp: 0,
          action: "navigate",
          target: "Landed on homepage",
          reasoning: "Reviewing first impression layout and structure.",
          screenshotUrl: landingEvent.screenshotUrl
        });

        // Interaction loop
        let isDone = false;
        let consecutiveScrolls = 0;
        while (step < maxSteps && !isDone) {
          step++;
          sendSSE("log", { message: `[Step ${step}/${maxSteps}] Scanning for visible interactable elements...` });

          const elements = await simulator.getInteractableElements();
          const pageState = await simulator.getPageState();
          
          // Get action history
          const history = await prisma.interactionEvent.findMany({
            where: { sessionId: session.id },
            orderBy: { timestamp: "asc" }
          });

          // Anti-scroll-loop hint
          const isStuckScrolling = consecutiveScrolls >= 3;

          // If scroll loop with zero elements for 5 steps → give up
          if (consecutiveScrolls >= 5) {
            sendSSE("log", { message: "Agent reached the bottom of the page with no interactable elements. Ending session." });
            isDone = true;
            break;
          }

          sendSSE("log", { message: `Consulting interaction model... (${elements.length} elements visible)` });
          
          const decision = await getAgentDecision({
            url: session.url,
            description: session.description,
            prompt: session.prompt || "Explore the site like a first-time user",
            mode: session.mode,
            pageState: pageState,
            isStuckScrolling: isStuckScrolling,
            elements: elements,
            history: history.map(h => ({
              action: h.action,
              target: h.target || undefined,
              reasoning: h.reasoning || undefined
            }))
          });

          sendSSE("thought", {
            thought: decision.thought,
            action: decision.action
          });

          if (decision.action === "done") {
            sendSSE("log", { message: "Agent decided the goal was completed. Ending exploration." });
            isDone = true;
            await prisma.session.update({
              where: { id: sessionId },
              data: { status: "completed", completedAt: new Date() }
            });
            sendSSE("complete", { message: "Task completed successfully by the agent.", mode: session.mode, status: "success" });
            break;
          }

          sendSSE("log", { message: `Executing action: ${decision.action}...` });
          
          let targetText = "";
          if (decision.action === "click" && decision.targetId) {
            targetText = await simulator.click(decision.targetId);
            consecutiveScrolls = 0;
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

          // Capture post-action screenshot
          const screenshot = await simulator.screenshotBase64();
          const offsetSeconds = Math.round((Date.now() - startTime) / 1000);

          // Save event in db
          const event = await prisma.interactionEvent.create({
            data: {
              sessionId: session.id,
              timestamp: offsetSeconds,
              action: decision.action,
              target: targetText,
              reasoning: decision.thought,
              screenshotUrl: `data:image/png;base64,${screenshot}`
            }
          });

          // Stream event to client
          sendSSE("event", {
            id: event.id,
            timestamp: event.timestamp,
            action: event.action,
            target: event.target,
            reasoning: event.reasoning,
            screenshotUrl: event.screenshotUrl
          });

          // Small delay between steps
          await new Promise(r => setTimeout(r, 1000));
        }

        // If we exited the loop without hitting the "done" action naturally
        if (!isDone) {
          await prisma.session.update({
            where: { id: sessionId },
            data: {
              status: "completed",
              completedAt: new Date()
            }
          });
          sendSSE("complete", { message: "Task ended due to maximum steps reached.", mode: session.mode, status: "timeout" });
        }

      } catch (err: any) {
        console.error("Simulation run failed:", err);
        
        await prisma.session.update({
          where: { id: sessionId },
          data: {
            status: "failed",
            error: err.message || "An error occurred during Playwright browser execution."
          }
        });

        sendSSE("error", { message: err.message || "Execution encountered an error." });

      } finally {
        await simulator.cleanup();
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive"
    }
  });
}
