import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateUXReport } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const sessionId = params.id;

  try {
    // 1. Fetch Session and Events
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        events: true,
        report: true
      }
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    // 2. Return cached report if exists
    if (session.report) {
      return NextResponse.json({
        summary: session.report.summary,
        whatWorkedWell: JSON.parse(session.report.whatWorkedWell),
        frictionPoints: JSON.parse(session.report.frictionPoints),
        improvements: JSON.parse(session.report.improvements)
      });
    }

    if (session.status !== "completed") {
      return NextResponse.json({ error: "Cannot generate report. Session is not completed yet." }, { status: 400 });
    }

    // 3. Compile timeline data and visual screenshot references
    const timeline = session.events.map(e => ({
      timestamp: e.timestamp,
      action: e.action,
      target: e.target || undefined,
      reasoning: e.reasoning || undefined
    }));

    // Keep only a key subset of screenshots (e.g. max 4 to conserve tokens and API size limit)
    // Select initial, middle, and final screenshots
    const screenshotEvents = session.events.filter(e => e.screenshotUrl);
    const selectedEvents = [];
    if (screenshotEvents.length > 0) {
      selectedEvents.push(screenshotEvents[0]); // first
      if (screenshotEvents.length > 2) {
        const midIndex = Math.floor(screenshotEvents.length / 2);
        selectedEvents.push(screenshotEvents[midIndex]);
      }
      if (screenshotEvents.length > 1) {
        selectedEvents.push(screenshotEvents[screenshotEvents.length - 1]); // last
      }
    }

    const screenshots = selectedEvents.map(e => {
      // Strip prefix "data:image/png;base64," to get raw base64 string for Gemini SDK
      const rawBase64 = e.screenshotUrl!.replace(/^data:image\/png;base64,/, "");
      return {
        timestamp: e.timestamp,
        base64: rawBase64
      };
    });

    // 4. Generate report via Gemini
    const reportData = await generateUXReport({
      url: session.url,
      description: session.description,
      prompt: session.prompt || "First-time user review",
      timeline: timeline,
      screenshots: screenshots
    });

    // 5. Store report in DB
    const savedReport = await prisma.report.create({
      data: {
        sessionId: session.id,
        summary: reportData.summary,
        whatWorkedWell: JSON.stringify(reportData.whatWorkedWell),
        frictionPoints: JSON.stringify(reportData.frictionPoints),
        improvements: JSON.stringify(reportData.improvements)
      }
    });

    return NextResponse.json(reportData);
  } catch (error) {
    console.error("Report generation API error:", error);
    return NextResponse.json({ error: "Failed to generate UX report." }, { status: 500 });
  }
}

// Support fetching existing report if needed
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const sessionId = params.id;

  try {
    const report = await prisma.report.findUnique({
      where: { sessionId }
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    return NextResponse.json({
      summary: report.summary,
      whatWorkedWell: JSON.parse(report.whatWorkedWell),
      frictionPoints: JSON.parse(report.frictionPoints),
      improvements: JSON.parse(report.improvements)
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch report." }, { status: 500 });
  }
}
