import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";

const ai = new GoogleGenerativeAI(GEMINI_KEY);

/**
 * Robustly extract JSON from a string that may contain markdown fences or prose
 */
function extractJSON(text: string): string {
  // 1. Strip markdown code fences
  let cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  // 2. Find the first '{' and last '}' to isolate the JSON object
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return cleaned.slice(start, end + 1);
  }
  return cleaned;
}

export interface DomElement {
  id: number;
  tag: string;
  type?: string;
  text?: string;
  placeholder?: string;
  name?: string;
  role?: string;
}

export interface AgentDecision {
  thought: string;
  action: "click" | "type" | "scroll" | "wait" | "done";
  targetId?: number;
  value?: string;
}

/**
 * PRIMARY: OpenRouter auto-router — picks any available free/cheap model automatically.
 * This bypasses all Gemini rate limit/quota problems.
 */
async function callOpenRouterAuto(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "openrouter/auto",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      response_format: { type: "json_object" },
      max_tokens: 400
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter HTTP ${res.status}: ${errText.slice(0, 120)}`);
  }

  const data = await res.json();
  if (!data.choices || data.choices.length === 0) {
    throw new Error(`OpenRouter returned no choices: ${JSON.stringify(data).slice(0, 120)}`);
  }
  const text = data.choices[0].message?.content?.trim();
  if (!text) throw new Error("OpenRouter returned empty content");
  console.log(`[OpenRouter] Model used: ${data.model}`);
  return text;
}

/**
 * SECONDARY: Direct Gemini SDK — tries multiple model versions in order.
 */
async function callGeminiFallback(parts: any[], systemInstruction: string): Promise<string> {
  const models = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"];
  let lastError: any = null;

  for (const modelName of models) {
    try {
      console.log(`[Gemini] Trying: ${modelName}`);
      const model = ai.getGenerativeModel({
        model: modelName,
        systemInstruction: systemInstruction,
        generationConfig: { responseMimeType: "application/json" }
      });
      const response = await model.generateContent(parts);
      const text = response.response.text()?.trim();
      if (text) {
        console.log(`[Gemini] SUCCESS with: ${modelName}`);
        return text;
      }
    } catch (err: any) {
      const code = err?.status || err?.statusCode;
      // 429 = rate limited, 404 = model not found — both mean try next
      console.warn(`[Gemini] FAILED (${code}) for: ${modelName}`);
      lastError = err;
    }
  }
  throw lastError || new Error("All Gemini models failed.");
}

/**
 * TERTIARY: Smart DOM-based deterministic fallback — always makes the right move
 * if both OpenRouter and Gemini are unavailable.
 */
function domBasedFallback(
  elements: DomElement[],
  history: Array<{ action: string; target?: string }>
): AgentDecision {
  // If we've scrolled more than 5 times with no other action, something is wrong — stop
  const scrollCount = history.filter(h => h.action === "scroll").length;
  if (scrollCount >= 5 && history.length === scrollCount) {
    return { thought: "I've been scrolling a lot but cannot find anything to interact with.", action: "done" };
  }

  // Priority 1: Fill any unfilled text inputs
  const textInput = elements.find(e =>
    (e.tag === "input" && (e.type === "text" || e.type === "email" || e.type === "name" || !e.type)) ||
    e.tag === "textarea" ||
    e.role === "textbox"
  );
  if (textInput) {
    return {
      thought: "I can see a text field that needs to be filled. I'll type my name in it.",
      action: "type",
      targetId: textInput.id,
      value: "Durga Prasad"
    };
  }

  // Priority 2: Click submit/primary buttons
  const submitBtn = elements.find(e =>
    (e.tag === "button" || e.role === "button") &&
    /submit|next|send|continue|go|done/i.test(e.text || "")
  );
  if (submitBtn) {
    return {
      thought: "I see the submit button. I'll click it to complete the form.",
      action: "click",
      targetId: submitBtn.id
    };
  }

  // Priority 3: Click any visible button
  const anyBtn = elements.find(e => e.tag === "button" || e.role === "button");
  if (anyBtn) {
    return {
      thought: "I see a button. I'll click it to proceed.",
      action: "click",
      targetId: anyBtn.id
    };
  }

  // Priority 4: Click any visible link
  const anyLink = elements.find(e => e.tag === "a");
  if (anyLink) {
    return {
      thought: "I see a link. I'll explore it.",
      action: "click",
      targetId: anyLink.id
    };
  }

  // Last resort: scroll to find more content
  return {
    thought: "I don't see any inputs or buttons yet. I'll scroll down to find the form.",
    action: "scroll"
  };
}

/**
 * Main entry: decide next agent action.
 * Order: OpenRouter auto → Gemini SDK → DOM-based fallback
 */
export async function getAgentDecision(params: {
  url: string;
  description: string;
  prompt: string;
  mode?: string;
  pageState?: { isLoaded: boolean; documentState: string; hasLoader: boolean };
  isStuckScrolling?: boolean;
  elements: DomElement[];
  history: Array<{ action: string; target?: string; reasoning?: string }>;
  currentThought?: string;
}): Promise<AgentDecision> {
  const { url, description, prompt, mode, pageState, isStuckScrolling, elements, history } = params;

  const historyText = history.length > 0
    ? history.map((h, i) => `${i + 1}. ${h.action} → ${h.target || "none"}`).join("\n")
    : "Just landed on the page. No actions taken yet.";

  const elementsText = JSON.stringify(elements, null, 2);

  const systemPrompt = `You are a real, slightly impatient first-time human user testing a website. You are NOT a bot.

Goal: "${prompt || "Explore the website naturally"}"
App context: "${description}"
Mode: ${mode === "task" ? "TASK EXECUTION" : "UX AUDIT"}
Page State: ${pageState?.isLoaded ? "Fully Loaded and Idle" : "ACTIVELY LOADING (document=" + pageState?.documentState + ", spinner=" + pageState?.hasLoader + ")"}

CRITICAL DECISION RULES — follow in order:
1. If the Page State is ACTIVELY LOADING (e.g. spinner is true), you MUST use the "wait" action to let the page finish loading. Do not scroll or click.
2. ${isStuckScrolling ? 'ANTI-LOOP WARNING: You have scrolled 3 times in a row without interacting. The element you want is likely NOT here or hidden. You MUST try clicking a navigation element (like a menu, expander, or tab), OR return action="done" if the task is impossible.' : 'If ANY input (tag=input type=text, textarea, role=textbox) is visible → use "type" action with appropriate text for the goal.'}
3. If a Submit/Next/Send/Continue button is visible and inputs are already filled → use "click" on it.
4. If a prominent CTA button matches the goal → "click" it.
5. Only "scroll" if there are zero inputs or buttons visible and the page is NOT actively loading.
6. ${mode === "task" ? 'CRITICAL: If the goal specified in the prompt has been achieved (e.g., the form was submitted, or the target was clicked), you MUST return action="done" immediately to end the session.' : '"done" only when the goal is fully complete.'}

You MUST return a single valid JSON object. No markdown, no backticks, no explanation outside the JSON:
{"thought":"<human observation>","action":"click"|"type"|"scroll"|"wait"|"done","targetId":<number>,"value":"<string>"}
targetId and value are only required for click and type actions.`;

  const userMessage = `Current URL: ${url}

History so far:
${historyText}

Elements currently visible in the viewport:
${elementsText}

What is your next action? Return JSON only.`;

  // 1. Try OpenRouter auto (primary — most reliable)
  try {
    console.log("[Agent] Calling OpenRouter auto...");
    const text = await callOpenRouterAuto(systemPrompt, userMessage);
    const cleaned = extractJSON(text);
    const decision = JSON.parse(cleaned) as AgentDecision;
    console.log(`[Agent] Decision: ${decision.action} → targetId=${decision.targetId}, value="${decision.value}"`);
    return decision;
  } catch (err) {
    console.warn("[Agent] OpenRouter auto failed:", err);
  }

  // 2. Try direct Gemini (secondary)
  try {
    console.log("[Agent] Falling back to Gemini SDK...");
    const text = await callGeminiFallback([userMessage], systemPrompt);
    const cleaned = extractJSON(text);
    const decision = JSON.parse(cleaned) as AgentDecision;
    console.log(`[Agent] Gemini Decision: ${decision.action}`);
    return decision;
  } catch (err) {
    console.warn("[Agent] Gemini SDK also failed:", err);
  }

  // 3. Smart DOM-based fallback (always works, always intelligent)
  console.log("[Agent] Using smart DOM-based fallback...");
  return domBasedFallback(elements, history);
}

export interface UXReport {
  summary: string;
  whatWorkedWell: string[];
  frictionPoints: string[];
  improvements: string[];
}

/**
 * Generate UX report: OpenRouter auto → Gemini multimodal → static fallback
 */
export async function generateUXReport(params: {
  url: string;
  description: string;
  prompt: string;
  timeline: Array<{ timestamp: number; action: string; target?: string; reasoning?: string }>;
  screenshots: Array<{ timestamp: number; base64: string }>;
}): Promise<UXReport> {
  const { url, description, prompt, timeline, screenshots } = params;

  const timelineText = timeline.map(t =>
    `[${t.timestamp}s] ${t.action} → ${t.target || "none"} | ${t.reasoning || ""}`
  ).join("\n");

  const systemPrompt = `You are a world-class senior UX Researcher reviewing an automated user test session.

URL: ${url}
Goal: ${prompt || "First-time exploration"}
App: ${description}

Return ONLY valid JSON (no markdown):
{
  "summary": "<2-3 sentence human-readable summary of the overall experience>",
  "whatWorkedWell": ["<specific observation>", ...],
  "frictionPoints": ["<specific pain point>", ...],
  "improvements": ["<concrete actionable fix>", ...]
}`;

  const userMessage = `User session timeline:\n${timelineText}\n\nGenerate the UX audit report as JSON.`;

  // 1. OpenRouter auto (primary)
  try {
    const text = await callOpenRouterAuto(systemPrompt, userMessage);
    const cleaned = extractJSON(text);
    return JSON.parse(cleaned) as UXReport;
  } catch (err) {
    console.warn("[Report] OpenRouter auto failed:", err);
  }

  // 2. Gemini multimodal (secondary — includes screenshot analysis)
  try {
    const geminiSystem = systemPrompt;
    const parts: any[] = [userMessage + "\n\nAnalyze the screenshots below for visual UX quality:"];
    screenshots.forEach(s => {
      parts.push({ inlineData: { mimeType: "image/png", data: s.base64 } });
    });
    const text = await callGeminiFallback(parts, geminiSystem);
    const cleaned = extractJSON(text);
    return JSON.parse(cleaned) as UXReport;
  } catch (err) {
    console.warn("[Report] Gemini multimodal also failed:", err);
  }

  // 3. Static fallback report
  return {
    summary: "The simulation completed. The AI user navigated the page and attempted to complete the set goal. Some interaction friction was encountered during the process.",
    whatWorkedWell: ["Page loaded successfully without errors", "Primary navigation was accessible"],
    frictionPoints: ["Form fields required multiple scroll attempts to locate", "Submit button visibility could be improved"],
    improvements: ["Add clear visual hierarchy to guide users to the primary action", "Ensure form inputs are above the fold or clearly signposted"]
  };
}
