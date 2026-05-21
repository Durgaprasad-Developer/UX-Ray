import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { validateUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { url, description, prompt, mode } = await req.json();
    const sessionMode = mode === "task" ? "task" : "analysis";

    if (!url) {
      return NextResponse.json({ error: "URL is required." }, { status: 400 });
    }

    if (sessionMode === "analysis" && !description) {
      return NextResponse.json({ error: "App description is required to help the AI simulate a realistic first-time user." }, { status: 400 });
    }

    if (sessionMode === "task" && !prompt) {
      return NextResponse.json({ error: "Please describe the task you want the AI to complete." }, { status: 400 });
    }

    // Validate URL to satisfy security rules
    const validation = validateUrl(url);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Create session in SQLite db
    const session = await prisma.session.create({
      data: {
        url: validation.cleanUrl || url,
        description: sessionMode === "task" ? (prompt?.trim() || "Task execution") : description.trim(),
        prompt: prompt?.trim() || null,
        mode: sessionMode,
        status: "pending"
      }
    });

    return NextResponse.json({ sessionId: session.id });

  } catch (error) {
    console.error("Create session error:", error);
    return NextResponse.json({ error: "An unexpected error occurred while creating the session." }, { status: 500 });
  }
}
