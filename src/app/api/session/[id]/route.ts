import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await prisma.session.findUnique({
      where: { id: params.id },
      include: {
        events: true,
        report: true
      }
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    return NextResponse.json({
      id: session.id,
      url: session.url,
      description: session.description,
      prompt: session.prompt,
      mode: session.mode,
      status: session.status,
      events: session.events.map(e => ({
        id: e.id,
        timestamp: e.timestamp,
        action: e.action,
        target: e.target || undefined,
        reasoning: e.reasoning || undefined,
        screenshotUrl: e.screenshotUrl || undefined
      })),
      report: session.report ? {
        summary: session.report.summary,
        whatWorkedWell: JSON.parse(session.report.whatWorkedWell),
        frictionPoints: JSON.parse(session.report.frictionPoints),
        improvements: JSON.parse(session.report.improvements)
      } : null
    });
  } catch (error) {
    console.error("Fetch session error:", error);
    return NextResponse.json({ error: "Failed to fetch session details." }, { status: 500 });
  }
}
