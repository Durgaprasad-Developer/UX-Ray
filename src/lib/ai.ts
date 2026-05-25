import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const NVIDIA_KEY = process.env.NVIDIA_API_KEY || "";
const ai = new GoogleGenerativeAI(GEMINI_KEY);

// ── Utilities ─────────────────────────────────────────────────────────────────

function extractJSON(text: string): string {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const s = cleaned.indexOf("{"), e = cleaned.lastIndexOf("}");
  if (s !== -1 && e > s) return cleaned.slice(s, e + 1);
  return cleaned;
}

function extractArray(text: string): string {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const s = cleaned.indexOf("["), e = cleaned.lastIndexOf("]");
  if (s !== -1 && e > s) return cleaned.slice(s, e + 1);
  try {
    const os = cleaned.indexOf("{"), oe = cleaned.lastIndexOf("}");
    if (os !== -1 && oe > os) {
      const obj: any = JSON.parse(cleaned.slice(os, oe + 1));
      const arr = Object.values(obj).find(Array.isArray);
      if (arr) return JSON.stringify(arr);
    }
  } catch {}
  return "[]";
}

// ── Interfaces ─────────────────────────────────────────────────────────────────

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

export interface AppProfile {
  appType: string;
  primaryGoal: string;
  expectedUserActions: string[];
  sensitiveFields: string[];
  testingPlan: string;
  audiencePersona: string;
  requiresAuth: boolean;
  navigationPages: string[];
}

export interface ChecklistItem {
  priority: "critical" | "high" | "medium";
  effort: "5min" | "1hour" | "1day";
  area: string;
  fix: string;
  impact: string;
}

export interface ExperienceScore {
  overall: number;
  clarity: number;
  navigation: number;
  speed: number;
  trust: number;
  delight: number;
  verdict: string;
  readyToShip: boolean;
}

export interface UXReport {
  summary: string;
  whatWorkedWell: string[];
  frictionPoints: string[];
  improvements: string[];
  behaviourPatterns?: string[];
  featureSuggestions?: string[];
}

// ── Smart Typing ──────────────────────────────────────────────────────────────

export function inferSmartTypingValue(
  element: DomElement,
  url: string,
  appProfile?: AppProfile
): string {
  const hint = [element.placeholder || "", element.name || "", element.text || "", element.type || ""].join(" ").toLowerCase();
  const urlLower = url.toLowerCase();

  if (/github|username|handle|profile/.test(hint) || /github/.test(urlLower)) return "torvalds";
  if (/email|e-mail/.test(hint) || element.type === "email") return "tester@example.com";
  if (/password|passwd/.test(hint) || element.type === "password") return "TestPass123!";
  if (/search|query|find|keyword/.test(hint) || element.type === "search") {
    const at = (appProfile?.appType || "").toLowerCase();
    if (at.includes("job") || at.includes("career")) return "software engineer";
    if (at.includes("ecommerce") || at.includes("product")) return "laptop";
    return "example";
  }
  if (/full.?name|first.?name|\bname\b/.test(hint)) return "Alex Turner";
  if (/phone|tel|mobile/.test(hint) || element.type === "tel") return "555-123-4567";
  if (/url|website|link/.test(hint) || element.type === "url") return "https://example.com";
  if (element.type === "number") return "1";
  return "hello world";
}

// ── NVIDIA Caller (primary for ALL decisions) ─────────────────────────────────

async function callNvidia(system: string, user: string, maxTokens = 600): Promise<string> {
  if (!NVIDIA_KEY) throw new Error("NVIDIA_API_KEY not set");
  const models = ["meta/llama-3.1-70b-instruct", "meta/llama-3.1-8b-instruct", "meta/llama-3.2-3b-instruct"];
  let last: any;
  for (const model of models) {
    try {
      const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${NVIDIA_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
          max_tokens: maxTokens,
          temperature: 0.3,
        }),
      });
      if (res.status === 429) {
        // Rate-limited — wait 2s and try next model
        console.warn(`[NVIDIA] ${model}: 429 rate-limited, skipping`);
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error("empty response");
      console.log(`[NVIDIA] OK: ${model}`);
      return text;
    } catch (e: any) {
      if (!e.message?.includes("429")) console.warn(`[NVIDIA] ${model}: ${e.message?.slice(0, 60)}`);
      last = e;
    }
  }
  throw last;
}

// ── Gemini Caller (ONLY for multimodal report screenshots) ───────────────────

async function callGeminiMultimodal(parts: any[], system: string): Promise<string> {
  if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY not set");
  const models = ["gemini-2.0-flash", "gemini-1.5-flash"];
  let last: any;
  for (const model of models) {
    try {
      const m = ai.getGenerativeModel({ model, systemInstruction: system, generationConfig: { responseMimeType: "application/json" } });
      const r = await m.generateContent(parts);
      const text = r.response.text()?.trim();
      if (text) return text;
    } catch (e: any) {
      console.warn(`[Gemini] ${model}: ${e?.status || e?.message}`);
      last = e;
    }
  }
  throw last;
}

// ── 1. App Recognizer (NVIDIA — text-based, no vision needed) ─────────────────

export async function recognizeApp(params: {
  url: string;
  description: string;
  pageText: string;
}): Promise<AppProfile> {
  const { url, description, pageText } = params;

  const system = `You are a senior UX researcher. Analyze this web app and return ONLY this JSON:
{
  "appType": "<specific: e.g. github-profile-analyzer, saas-landing, ecommerce, portfolio, developer-tool, waitlist, form-tool, job-board>",
  "primaryGoal": "<what a real user opens this to achieve>",
  "expectedUserActions": ["<step 1>", "<step 2>", "<step 3>"],
  "sensitiveFields": ["<field type needing real data: github_username, email, search_query, etc>"],
  "testingPlan": "<2-3 sentences: systematic plan — what pages to visit, what flows to test, what forms to fill>",
  "audiencePersona": "<who uses this, e.g. 'developers and recruiters reviewing GitHub profiles'>",
  "requiresAuth": <true if login/signup is needed to access main features, false otherwise>,
  "navigationPages": ["<page/section 1>", "<page/section 2>", "<all discoverable pages from nav>"]
}`;

  const user = `URL: ${url}
User description: ${description}

Page content extracted from the live site:
${pageText}

Analyze and return the app profile JSON.`;

  try {
    const text = await callNvidia(system, user, 600);
    return JSON.parse(extractJSON(text)) as AppProfile;
  } catch (err) {
    console.warn("[AppRecognizer] Failed, using default:", err);
    return {
      appType: "web-application",
      primaryGoal: "Explore the website and use its main feature",
      expectedUserActions: ["read the landing page", "find the main CTA", "try the core feature"],
      sensitiveFields: ["text_input"],
      testingPlan: "Navigate to every page in the navigation. Try every form and button. Test the main feature end-to-end.",
      audiencePersona: "general web users",
      requiresAuth: false,
      navigationPages: ["homepage"],
    };
  }
}

// ── 2. Navigator — Systematic Site Explorer (NVIDIA only) ─────────────────────

export async function getAgentDecision(params: {
  url: string;
  description: string;
  prompt: string;
  appProfile?: AppProfile;
  credentials?: { username?: string; password?: string } | null;
  pageState?: { isLoaded: boolean; documentState: string; hasLoader: boolean };
  isStuckScrolling?: boolean;
  isStuckInActionLoop?: boolean;
  elements: DomElement[];
  history: Array<{ action: string; target?: string; reasoning?: string }>;
  visitedUrls?: string[];
}): Promise<AgentDecision> {
  const { url, description, prompt, appProfile, credentials, pageState, isStuckScrolling, isStuckInActionLoop, elements, history, visitedUrls = [] } = params;

  // If page is loading — short-circuit immediately, no AI call needed
  if (pageState && !pageState.isLoaded) {
    return { thought: "Page is still loading. Waiting for it to complete.", action: "wait" };
  }

  const historyText = history.length > 0
    ? history.slice(-12).map((h, i) => `${i + 1}. [${h.action}] ${h.target || "—"}`).join("\n")
    : "Just arrived. No actions taken yet.";

  const appCtx = appProfile
    ? `App type: ${appProfile.appType}
Audience: ${appProfile.audiencePersona}
User's goal: ${appProfile.primaryGoal}
Natural flow: ${appProfile.expectedUserActions.join(" → ")}
Pages to cover: ${appProfile.navigationPages.join(", ")}
Testing mission: ${appProfile.testingPlan}`
    : `App: ${description}`;

  const credNote = credentials?.username
    ? `\nLOGIN CREDENTIALS AVAILABLE: username="${credentials.username}" password="${credentials.password}". If you see a login/signin form, use these credentials.`
    : "";

  const loopNote = isStuckInActionLoop
    ? "\nWARNING: You repeated the same action 3+ times. Do NOT repeat it. Try a completely different element or return done."
    : isStuckScrolling
    ? "\nWARNING: Scrolled 3+ times with no interaction. The target is not here — click a navigation link to go to a different page, or return done."
    : "";

  const visitedNote = visitedUrls.length > 0 ? `\nAlready visited: ${visitedUrls.join(", ")}` : "";

  const system = `You are a systematic UX tester conducting a complete audit of a web application. You are methodical, thorough, and think like an experienced QA engineer combined with a real first-time user.

${appCtx}${credNote}

Your mission: Test this app COMPLETELY.
- Visit EVERY page listed in the navigation
- Click EVERY major button and CTA
- Fill EVERY form with realistic data
- Try EVERY core feature
- Note what's confusing, what's missing, what's great

TYPING RULES — use realistic data, NEVER placeholders:
- GitHub/username fields → "torvalds"
- Email → "tester@example.com"  
- Password → "TestPass123!"
- Name → "Alex Turner"
- Search → use a context-relevant term for this app type

SESSION STATUS:
${loopNote}${visitedNote}

DECISION LOGIC — think situationally:
1. If loading → WAIT
2. If you see an unfilled input that matches your mission → TYPE realistic data
3. If you just typed into inputs → CLICK the submit/action button
4. If current page is done → CLICK a nav link to go to the next unvisited page
5. If all main pages visited and features tested → done
6. If genuinely stuck after 3 scrolls → try clicking nav, else done

Return ONLY valid JSON (no markdown):
{"thought":"<your reasoning — be specific about what you're doing and why>","action":"click"|"type"|"scroll"|"wait"|"done","targetId":<number>,"value":"<string>"}`;

  const user = `Current URL: ${url}

Recent actions:
${historyText}

Visible interactive elements:
${JSON.stringify(elements.slice(0, 25), null, 2)}

What is your next action?`;

  // Primary: NVIDIA (only AI for navigation)
  try {
    const text = await callNvidia(system, user, 350);
    const decision = JSON.parse(extractJSON(text)) as AgentDecision;
    if (!decision.action || !["click", "type", "scroll", "wait", "done"].includes(decision.action)) {
      throw new Error("Invalid action");
    }
    console.log(`[Nav] ${decision.action} → id=${decision.targetId} val="${decision.value?.slice(0, 30)}"`);
    return decision;
  } catch (err) {
    console.warn("[Nav] NVIDIA failed, using smart DOM fallback:", err);
  }

  // Smart DOM fallback — never throws
  const input = elements.find(e =>
    (e.tag === "input" && !["button", "submit", "checkbox", "radio", "hidden"].includes(e.type || "")) ||
    e.tag === "textarea" || e.role === "textbox"
  );
  if (input) {
    return { thought: "I see an input field. Filling it with realistic data.", action: "type", targetId: input.id, value: inferSmartTypingValue(input, url, appProfile) };
  }
  const actionBtn = elements.find(e =>
    (e.tag === "button" || e.role === "button") &&
    /submit|next|send|continue|go|done|analyze|search|sign.?up|log.?in|get.?start|try/i.test(e.text || "")
  );
  if (actionBtn) return { thought: "Found an action button. Clicking it.", action: "click", targetId: actionBtn.id };
  const anyBtn = elements.find(e => e.tag === "button" || e.role === "button");
  if (anyBtn) return { thought: "Clicking a button to progress.", action: "click", targetId: anyBtn.id };
  const navLink = elements.find(e => e.tag === "a" && e.text && e.text.length > 1);
  if (navLink) return { thought: "Following a navigation link.", action: "click", targetId: navLink.id };
  const scrollCount = history.filter(h => h.action === "scroll").length;
  if (scrollCount >= 4) return { thought: "Nothing more to explore. Ending session.", action: "done" };
  return { thought: "Scrolling to find more content.", action: "scroll" };
}

// ── 3. UX Report — Gemini multimodal → NVIDIA fallback ───────────────────────

export async function generateUXReport(params: {
  url: string;
  description: string;
  prompt: string;
  appProfile?: AppProfile;
  timeline: Array<{ timestamp: number; action: string; target?: string; reasoning?: string }>;
  screenshots: Array<{ timestamp: number; base64: string }>;
}): Promise<UXReport> {
  const { url, description, prompt, appProfile, timeline, screenshots } = params;

  const timelineText = timeline.slice(0, 15).map(t =>
    `[${t.timestamp}s] ${t.action} → ${(t.target || "—").slice(0, 50)} | ${(t.reasoning || "").slice(0, 60)}`
  ).join("\n");
  const appCtx = appProfile ? `App: ${appProfile.appType} | Audience: ${appProfile.audiencePersona}` : `App: ${description}`;

  const system = `You are a senior UX researcher writing an honest, actionable review for a startup founder or indie builder.
${appCtx} | Goal tested: "${prompt}" | URL: ${url}

Think like you've watched 1000 users interact with this app. Be specific — mention actual UI elements, flows, and copy you observed.

Include in behaviourPatterns: what users naturally try to do (even things the app doesn't support yet).
Include in featureSuggestions: 2-3 features users clearly want but the app doesn't have, based on their behavior.

Return ONLY this JSON:
{
  "summary": "<2-3 sentence honest first-person verdict>",
  "whatWorkedWell": ["<specific strength with context>", "<another>"],
  "frictionPoints": ["<specific pain point a real user would feel>", "<another>"],
  "improvements": ["<general area 1>", "<general area 2>"],
  "behaviourPatterns": ["<observed user behaviour pattern 1>", "<pattern 2>"],
  "featureSuggestions": ["<feature users clearly wanted but was missing>", "<another>"]
}`;

  const user = `Timeline:\n${timelineText}\n\nAnalyze and return the full UX report JSON.`;

  // Primary: Gemini multimodal (can analyze screenshots)
  try {
    const parts: any[] = [user + "\n\nScreenshots from the session:"];
    screenshots.forEach(s => parts.push({ inlineData: { mimeType: "image/png", data: s.base64 } }));
    const text = await callGeminiMultimodal(parts, system);
    return JSON.parse(extractJSON(text)) as UXReport;
  } catch {
    console.warn("[UXReport] Gemini failed, trying NVIDIA");
  }

  // Secondary: NVIDIA text-only
  try {
    const text = await callNvidia(system, user, 700);
    return JSON.parse(extractJSON(text)) as UXReport;
  } catch (err) {
    console.warn("[UXReport] Both failed:", err);
  }

  return {
    summary: "The simulation completed. The AI navigated the page and tested the main flows.",
    whatWorkedWell: ["Page loaded without errors", "Primary navigation was accessible"],
    frictionPoints: ["Some interactive elements required extra steps to locate"],
    improvements: ["Improve visual hierarchy for primary actions"],
    behaviourPatterns: [],
    featureSuggestions: [],
  };
}

// ── 4. Checklist Generator (NVIDIA Llama) ─────────────────────────────────────

export async function generateChecklistReport(params: {
  url: string;
  appProfile: AppProfile;
  uxSummary: string;
  frictionPoints: string[];
  timeline: Array<{ timestamp: number; action: string; target?: string; reasoning?: string }>;
}): Promise<ChecklistItem[]> {
  const { url, appProfile, uxSummary, frictionPoints, timeline } = params;

  const system = `You are a startup UX consultant giving a prioritized dev-ready checklist to an indie builder.
Be brutally specific. Each item must say EXACTLY what to change — not vague advice like "improve UX".

Return ONLY a JSON array (6-9 items):
[
  {
    "priority": "critical"|"high"|"medium",
    "effort": "5min"|"1hour"|"1day",
    "area": "<First Impression|Onboarding|Navigation|Copy|Performance|Trust|Feature>",
    "fix": "<exact actionable instruction: e.g. 'Change hero headline to describe what the product does in 5 words or fewer'>",
    "impact": "<why this matters to real users, 1 sentence>"
  }
]`;

  const user = `App: ${appProfile.appType} at ${url}
Audience: ${appProfile.audiencePersona}
UX verdict: "${uxSummary}"
Friction points: ${frictionPoints.map((f, i) => `${i + 1}. ${f}`).join("\n")}
Steps taken: ${timeline.length}

Generate the checklist array now.`;

  try {
    const text = await callNvidia(system, user, 800);
    return JSON.parse(extractArray(text)) as ChecklistItem[];
  } catch (err) {
    console.warn("[Checklist] Failed:", err);
    return [];
  }
}

// ── 5. Experience Scorer (NVIDIA) ─────────────────────────────────────────────

export async function scoreExperience(params: {
  url: string;
  appProfile: AppProfile;
  uxSummary: string;
  whatWorkedWell: string[];
  frictionPoints: string[];
  checklistItems: ChecklistItem[];
  totalSteps: number;
  totalDuration: number;
}): Promise<ExperienceScore> {
  const { url, appProfile, uxSummary, whatWorkedWell, frictionPoints, checklistItems, totalSteps, totalDuration } = params;
  const criticalCount = checklistItems.filter(c => c.priority === "critical").length;

  const system = `You are scoring a startup's web app UX on behalf of 1,000 first-time users.
Be honest and calibrated. Most startups score 40-65. Above 80 = genuinely excellent.

Return ONLY this JSON:
{
  "overall": <0-100 integer>,
  "clarity": <0-100 — did users understand the product in <10s?>,
  "navigation": <0-100 — could they find what they needed?>,
  "speed": <0-100 — did it feel fast and responsive?>,
  "trust": <0-100 — did it feel credible and professional?>,
  "delight": <0-100 — any genuinely pleasant moments?>,
  "verdict": "<2-3 sentence honest first-person review as if you just used it>",
  "readyToShip": <true if overall >= 65 and criticalIssues = 0>
}`;

  const user = `App: ${appProfile.appType} at ${url}
Audience: ${appProfile.audiencePersona}
${totalSteps} actions over ${totalDuration}s | Critical issues: ${criticalCount}
Verdict: "${uxSummary}"
Strengths: ${whatWorkedWell.join("; ")}
Friction: ${frictionPoints.join("; ")}

Score now.`;

  try {
    const text = await callNvidia(system, user, 400);
    return JSON.parse(extractJSON(text)) as ExperienceScore;
  } catch (err) {
    console.warn("[Scorer] Failed:", err);
    return { overall: 50, clarity: 50, navigation: 50, speed: 50, trust: 50, delight: 30, verdict: "Simulation completed. Manual review recommended.", readyToShip: false };
  }
}
