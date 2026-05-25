import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  generateUXReport,
  generateChecklistReport,
  scoreExperience,
  AppProfile,
  ChecklistItem,
  ExperienceScore,
} from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const sessionId = params.id;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { events: true, report: true },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    // Return cached report if already generated
    if (session.report) {
      return NextResponse.json({
        summary: session.report.summary,
        whatWorkedWell: JSON.parse(session.report.whatWorkedWell),
        frictionPoints: JSON.parse(session.report.frictionPoints),
        improvements: JSON.parse(session.report.improvements),
        checklistItems: session.report.checklistItems
          ? JSON.parse(session.report.checklistItems)
          : [],
        experienceScore: session.report.experienceScore
          ? JSON.parse(session.report.experienceScore)
          : null,
        appProfile: session.appProfile ? JSON.parse(session.appProfile) : null,
      });
    }

    if (session.status !== "completed") {
      return NextResponse.json(
        { error: "Session is not completed yet." },
        { status: 400 }
      );
    }

    // Parse stored app profile
    const appProfile: AppProfile | undefined = session.appProfile
      ? JSON.parse(session.appProfile)
      : undefined;

    // Build timeline data
    const timeline = session.events.map((e) => ({
      timestamp: e.timestamp,
      action: e.action,
      target: e.target || undefined,
      reasoning: e.reasoning || undefined,
    }));

    // Select up to 4 screenshots (first, two midpoints, last)
    const withScreenshots = session.events.filter((e) => e.screenshotUrl);
    const picks: typeof withScreenshots = [];
    if (withScreenshots.length > 0) {
      picks.push(withScreenshots[0]);
      if (withScreenshots.length > 3) picks.push(withScreenshots[Math.floor(withScreenshots.length / 3)]);
      if (withScreenshots.length > 2) picks.push(withScreenshots[Math.floor((2 * withScreenshots.length) / 3)]);
      if (withScreenshots.length > 1) picks.push(withScreenshots[withScreenshots.length - 1]);
    }
    const screenshots = picks.map((e) => ({
      timestamp: e.timestamp,
      base64: e.screenshotUrl!.replace(/^data:image\/png;base64,/, ""),
    }));

    const totalDuration = session.events.length > 0
      ? session.events[session.events.length - 1].timestamp
      : 0;

    // ── Phase 1: Generate UX Report (needs screenshots → Gemini first) ──
    const uxReport = await generateUXReport({
      url: session.url,
      description: session.description,
      prompt: session.prompt || "First-time user review",
      appProfile,
      timeline,
      screenshots,
    });

    // ── Phase 2: Generate Checklist + Score in parallel ──
    const [checklistItems, experienceScore] = await Promise.all([
      appProfile
        ? generateChecklistReport({
            url: session.url,
            appProfile,
            uxSummary: uxReport.summary,
            frictionPoints: uxReport.frictionPoints,
            timeline,
          })
        : Promise.resolve<ChecklistItem[]>([]),
      appProfile
        ? scoreExperience({
            url: session.url,
            appProfile,
            uxSummary: uxReport.summary,
            whatWorkedWell: uxReport.whatWorkedWell,
            frictionPoints: uxReport.frictionPoints,
            checklistItems: [],
            totalSteps: session.events.length,
            totalDuration,
          })
        : Promise.resolve<ExperienceScore | null>(null),
    ]);

    // Re-score with checklist (now we have critical count)
    let finalScore = experienceScore;
    if (appProfile && checklistItems.length > 0) {
      finalScore = await scoreExperience({
        url: session.url,
        appProfile,
        uxSummary: uxReport.summary,
        whatWorkedWell: uxReport.whatWorkedWell,
        frictionPoints: uxReport.frictionPoints,
        checklistItems,
        totalSteps: session.events.length,
        totalDuration,
      });
    }

    // Store report in DB
    await prisma.report.create({
      data: {
        sessionId: session.id,
        summary: uxReport.summary,
        whatWorkedWell: JSON.stringify(uxReport.whatWorkedWell),
        frictionPoints: JSON.stringify(uxReport.frictionPoints),
        improvements: JSON.stringify(uxReport.improvements),
        checklistItems: JSON.stringify(checklistItems),
        experienceScore: finalScore ? JSON.stringify(finalScore) : null,
      },
    });

    return NextResponse.json({
      summary: uxReport.summary,
      whatWorkedWell: uxReport.whatWorkedWell,
      frictionPoints: uxReport.frictionPoints,
      improvements: uxReport.improvements,
      checklistItems,
      experienceScore: finalScore,
      appProfile: appProfile || null,
      behaviourPatterns: uxReport.behaviourPatterns || [],
      featureSuggestions: uxReport.featureSuggestions || [],
    });
  } catch (error: any) {
    console.error("Report generation error:", error);
    return NextResponse.json({ error: "Failed to generate report." }, { status: 500 });
  }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const sessionId = params.id;
  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { report: true },
    });
    if (!session?.report) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }
    return NextResponse.json({
      summary: session.report.summary,
      whatWorkedWell: JSON.parse(session.report.whatWorkedWell),
      frictionPoints: JSON.parse(session.report.frictionPoints),
      improvements: JSON.parse(session.report.improvements),
      checklistItems: session.report.checklistItems
        ? JSON.parse(session.report.checklistItems)
        : [],
      experienceScore: session.report.experienceScore
        ? JSON.parse(session.report.experienceScore)
        : null,
      appProfile: session.appProfile ? JSON.parse(session.appProfile) : null,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch report." }, { status: 500 });
  }
}
