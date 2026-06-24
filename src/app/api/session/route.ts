import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { validateUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { url, description, prompt, credentials, mode } = await req.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required." }, { status: 400 });
    }

    const sessionMode = mode || "task";
    const sessionDesc = description?.trim() || (sessionMode === "task" ? "Task Doer Execution" : "");

    if (!sessionDesc) {
      return NextResponse.json(
        { error: "Please briefly describe what your app does. This helps the AI simulate a realistic user." },
        { status: 400 }
      );
    }

    const validation = validateUrl(url);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Validate and serialize credentials if provided
    let credentialsJson: string | null = null;
    if (credentials?.username && credentials?.password) {
      credentialsJson = JSON.stringify({
        username: credentials.username.trim(),
        password: credentials.password.trim(),
      });
    }

    const session = await prisma.session.create({
      data: {
        url: validation.cleanUrl || url,
        description: sessionDesc,
        prompt: prompt?.trim() || null,
        credentials: credentialsJson,
        mode: sessionMode,
        status: "pending",
      },
    });

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error("Create session error:", error);
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
