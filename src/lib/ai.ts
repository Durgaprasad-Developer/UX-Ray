import { GoogleGenerativeAI } from "@google/generative-ai";
import type { PageScan } from "./playwright";

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const NVIDIA_KEY = process.env.NVIDIA_API_KEY || "";
const ai = new GoogleGenerativeAI(GEMINI_KEY);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DomElement {
  id: number;
  tag: string;
  type?: string;
  text?: string;
  placeholder?: string;
  name?: string;
  role?: string;
  ariaLabel?: string;
  disabled?: boolean;
  href?: string;
  width?: number;
  height?: number;
}

// Queue item — deterministic action plan built once per page
export type QueueItem =
  | { type: "type"; elementId: number; value: string; purpose: string }
  | { type: "typeOnly"; elementId: number; value: string; purpose: string } // fill without Enter
  | { type: "click"; elementId: number; purpose: string }
  | { type: "wait"; purpose: string }
  | { type: "scroll"; purpose: string }
  | { type: "done"; summary: string };

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractJSON(text: string): string {
  const c = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const s = c.indexOf("{"), e = c.lastIndexOf("}");
  return s !== -1 && e > s ? c.slice(s, e + 1) : c;
}

function extractArray(text: string): string {
  const c = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const s = c.indexOf("["), e = c.lastIndexOf("]");
  if (s !== -1 && e > s) return c.slice(s, e + 1);
  try {
    const os = c.indexOf("{"), oe = c.lastIndexOf("}");
    if (os !== -1 && oe > os) {
      const arr = Object.values(JSON.parse(c.slice(os, oe + 1))).find(Array.isArray);
      if (arr) return JSON.stringify(arr);
    }
  } catch {}
  return "[]";
}

// ── Smart typing values ───────────────────────────────────────────────────────

export function inferSmartTypingValue(el: DomElement, url: string, appProfile?: AppProfile, credentials?: { username?: string; password?: string }): string {
  const hint = [el.placeholder || "", el.name || "", el.text || "", el.type || ""].join(" ").toLowerCase();
  if (/github|username|handle|email|e-mail/.test(hint) || el.type === "email") return credentials?.username || "tester@example.com";
  if (/password|passwd/.test(hint) || el.type === "password") return credentials?.password || "TestPass123!";
  if (/search|query|find|keyword/.test(hint) || el.type === "search") {
    const at = (appProfile?.appType || "").toLowerCase();
    if (/job|career/.test(at)) return "software engineer";
    if (/ecomm|product|shop/.test(at)) return "laptop";
    return "example";
  }
  if (/name/.test(hint)) return "Alex Turner";
  if (/phone|tel/.test(hint) || el.type === "tel") return "555-123-4567";
  if (/url|website/.test(hint) || el.type === "url") return "https://example.com";
  if (el.type === "number") return "1";
  return "hello";
}

// ── NVIDIA caller (primary for all decisions) ─────────────────────────────────

async function callNvidia(system: string, user: string, maxTokens = 700): Promise<string> {
  if (!NVIDIA_KEY) throw new Error("NVIDIA_API_KEY not set");
  // Use llama-3.3-70b as primary (fastest good model), fall back to 8b
  const models = ["meta/llama-3.3-70b-instruct", "meta/llama-3.1-8b-instruct", "meta/llama-3.2-3b-instruct"];
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
          temperature: 0.2,
        }),
      });
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) throw new Error("empty");
      console.log(`[NVIDIA] OK: ${model} (${maxTokens} max)`);
      return text;
    } catch (e: any) {
      if (!e.message?.includes("429")) console.warn(`[NVIDIA] ${model}: ${e.message?.slice(0, 50)}`);
      last = e;
    }
  }
  throw last;
}

// ── Gemini multimodal (screenshots only, for UX report) ──────────────────────

async function callGeminiMultimodal(parts: any[], system: string): Promise<string> {
  if (!GEMINI_KEY) throw new Error("no GEMINI_API_KEY");
  for (const model of ["gemini-2.0-flash", "gemini-1.5-flash"]) {
    try {
      const m = ai.getGenerativeModel({ model, systemInstruction: system, generationConfig: { responseMimeType: "application/json" } });
      const r = await m.generateContent(parts);
      const text = r.response.text()?.trim();
      if (text) return text;
    } catch (e: any) {
      console.warn(`[Gemini] ${model}: ${e?.status || e?.message?.slice(0, 40)}`);
    }
  }
  throw new Error("Gemini unavailable");
}

// ── 1. App Recognizer ─────────────────────────────────────────────────────────

export async function recognizeApp(params: { url: string; description: string; pageText: string; userObjective?: string }): Promise<AppProfile> {
  const { url, description, pageText, userObjective } = params;

  const system = `You are a senior UX researcher. Analyze this web app and return ONLY JSON:
{
  "appType": "<specific type: github-analyzer|saas-landing|ecommerce|developer-tool|portfolio|job-board|form-tool|waitlist>",
  "primaryGoal": "<what a real user opens this to accomplish>",
  "expectedUserActions": ["<step 1>","<step 2>","<step 3>"],
  "sensitiveFields": ["<github_username|email|search_query|etc>"],
  "testingPlan": "<2-3 sentence systematic plan covering all pages and key flows to test>",
  "audiencePersona": "<who uses this, specific>",
  "requiresAuth": <true|false>,
  "navigationPages": ["<page 1>","<page 2>","<all pages in nav>"]
}`;

  const user = `URL: ${url}\nDescription: ${description}\nUSER OBJECTIVE (THEIR GOAL): ${userObjective || 'Explore the app'}\n\nLive page content:\n${pageText}`;

  try {
    return JSON.parse(extractJSON(await callNvidia(system, user, 500))) as AppProfile;
  } catch {
    return {
      appType: "web-application",
      primaryGoal: "Explore the site and try the main feature",
      expectedUserActions: ["read landing page", "find main CTA", "try core feature"],
      sensitiveFields: ["text_input"],
      testingPlan: "Visit every page in navigation. Fill every form. Try every button. Test the core feature end-to-end.",
      audiencePersona: "general users",
      requiresAuth: false,
      navigationPages: ["homepage"],
    };
  }
}

// ── 2. Deep Agentic Loop ────────────────────────────────────────────────────────
// Called at every step. The agent observes the LIVE page state, checks history, and picks the SINGLE next best action.

export async function getAgentDecision(params: {
  scan: PageScan;
  appProfile: AppProfile;
  history: Array<{ action: string; target?: string }>;
  visitedUrls: string[];
  typedElementIds?: number[];
  credentials?: { username?: string; password?: string };
  userObjective?: string;
}): Promise<{ observation: string; thought: string; action: QueueItem }> {
  const { scan, appProfile, history, visitedUrls, credentials, userObjective } = params;

  const formsText = scan.forms.length > 0
    ? scan.forms.map((f, i) => `Form ${i + 1} (${f.purpose}): inputs=${JSON.stringify(f.inputIds)}, submit=${f.submitId}`).join("\n")
    : "No forms detected";

  const tabsText = scan.tabGroups.length > 0
    ? scan.tabGroups.map(t => `TabGroup (${t.purpose}): tabIds=${JSON.stringify(t.tabIds)}`).join("\n")
    : "No tab groups detected";

  const historyText = history.slice(-12).map(h => `[${h.action}] ${h.target || "—"}`).join("\n") || "No prior actions";

  const typedIds = params.typedElementIds || [];
  const elements = scan.elements.filter(e => !typedIds.includes(e.id)).slice(0, 50);

  const system = `You are an autonomous AI QA Agent testing a web app. You act exactly like a meticulous senior developer doing a deep-dive QA session.
You observe the screen, think about what needs testing, and take ONE ACTION at a time.

App: ${appProfile.appType} | Audience: ${appProfile.audiencePersona}
Goal: ${appProfile.primaryGoal}
USER OBJECTIVE: ${userObjective || 'Generic testing'}
TESTING PLAN: ${appProfile.testingPlan}
${credentials ? `\nPROVIDED CREDENTIALS (YOU MUST USE THESE WHEN TYPING): Username/Email: "${credentials.username || ''}" | Password: "${credentials.password || ''}"` : ""}

CURRENT PAGE: ${scan.currentUrl}
${scan.pageText.slice(0, 400)}

PAGE STRUCTURE:
${formsText}
${tabsText}
All visible interactable elements (id, tag, text, spatial & semantic data):
${JSON.stringify(elements.map(e => ({
  id: e.id, 
  tag: e.tag, 
  t: e.text?.slice(0,40) || e.placeholder?.slice(0,40) || e.ariaLabel?.slice(0,20),
  w: e.width,
  h: e.height,
  href: e.href?.slice(0,30),
  disabled: e.disabled ? true : undefined
})))}

RECENT HISTORY (What you just did):
${historyText}

Visited URLs: ${visitedUrls.join(", ") || "none"}

ALGORITHMIC QA EXPLORATION RULES:
1. POPUP HANDLING (CRITICAL): If you see a cookie banner, newsletter popup, or blocking modal, your ABSOLUTE PRIORITY is to interact with it (Accept, Reject, or Close) before interacting with anything else on the page.
2. SPATIAL AWARENESS: Use the width (w) and height (h) to deduce visual hierarchy. Large buttons are primary CTAs. Small elements are secondary/tertiary. Focus on testing primary CTAs first.
3. SEMANTIC AWARENESS: Do not click disabled elements. If an element has an href to a page you've already visited, avoid it unless necessary.
4. OBJECTIVE FOCUS: Evaluate every visible element. Choose the action that most directly advances your USER OBJECTIVE and TESTING PLAN. Do not click random links that distract from the goal!
5. EDGE CASE TESTING: Try to break the UI. Submit forms with edge-case data, or click primary CTAs to see what happens.
6. STRICT SEQUENCE: If you just filled a form input (type action), your very next action MUST be to click the corresponding submit button or CTA. Do NOT type another value into the same input.
7. WAIT PATIENCE: If you just clicked a submit button or CTA, your next action MUST be "wait" to let the backend process and the UI update.
8. STRICT ANTI-LOOP: You MUST NOT repeat an action on the same element you see in your RECENT HISTORY. If you find yourself doing the same thing, choose "navigate" (click a nav link) or return "done".
9. SCROLLING: You only see elements in the current viewport. If you are exploring the page or looking for more features, you MUST use the "scroll" action to move down and reveal new elements.
10. Return ONLY JSON.

Return format:
{
  "observation": "<What do you see right now? Did your last action succeed? Is there a popup blocking the screen?>",
  "thought": "<Based on your observation, what is your 1-sentence strategy?>",
  "action": { "type": "type"|"click"|"wait"|"scroll"|"done", "elementId": <number>, "value": "<if type>", "purpose": "<short label>" }
}
For "done", action should be: { "type": "done", "summary": "<reason>" }`;

  const user = "Observe the state and history. Write your observation and thought. Decide the single best next action. Return JSON.";

  try {
    const text = await callNvidia(system, user, 600);
    const result = JSON.parse(extractJSON(text));
    if (!result.action || !result.action.type) throw new Error("invalid schema");
    
    // If the agent hallucinated a value for a type action but it's empty, try to fix it
    if (result.action.type === "type" && result.action.elementId) {
      const el = scan.elements.find(e => e.id === result.action.elementId);
      if (el && (!result.action.value || result.action.value === "")) {
        result.action.value = inferSmartTypingValue(el, scan.currentUrl, appProfile, credentials);
      }
    }
    
    return result;
  } catch (err) {
    console.warn("[Agent] Failed, returning fallback done:", err);
    return { observation: "System error", thought: "Error communicating with intelligence engine.", action: { type: "done", summary: "API failure" } };
  }
}



// ── 3. UX Report ──────────────────────────────────────────────────────────────

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
    `[${t.timestamp}s] ${t.action}: ${(t.target || "").slice(0, 60)}`
  ).join("\n");

  const appCtx = appProfile
    ? `Type: ${appProfile.appType} | Audience: ${appProfile.audiencePersona} | Goal: ${appProfile.primaryGoal}`
    : description;

  const system = `You are a Senior UX/UI Engineer and accessibility expert analyzing a startup's web application. You are evaluating the app against Nielsen's 10 Usability Heuristics and modern design standards (WCAG, visual hierarchy, spacing).

${appCtx} | URL: ${url}
USER OBJECTIVE FOR THIS TEST: ${prompt || 'General UX Evaluation'}

IMPORTANT: Filter out any bot automation noise (e.g. if the bot clicked the wrong element). Focus STRICTLY on whether the UI/UX successfully served the USER OBJECTIVE.

Your job is to provide HIGHLY ACTIONABLE, developer-ready feedback tailored to this objective. Do not give generic advice like "make it look better" or "improve instructions".
Instead, provide exact, technical UI/UX fixes:
- "Increase the contrast ratio of the secondary button in the header from #555 to #333 for accessibility."
- "Add a 24px margin-bottom to the form groups to improve visual separation."
- "The 'Submit' button is visually lost; change its background to a primary brand color and add a hover state."

Include in behaviourPatterns: What users naturally try to do (even things the app doesn't support yet, based on your intuition).
Include in featureSuggestions: 2-3 features users clearly want based on their behaviour.

Return ONLY this JSON:
{
  "summary": "<2-3 sentence honest verdict as a Senior UX Engineer>",
  "whatWorkedWell": ["<specific UI/UX strength with exact element context>","<another>","<another>"],
  "frictionPoints": ["<specific heuristic violation or UI pain point>","<another>","<another>"],
  "improvements": ["<exact, technical developer-ready fix (e.g. CSS, layout, copy)>","<another>"],
  "behaviourPatterns": ["<observed pattern>","<pattern>"],
  "featureSuggestions": ["<feature users clearly want>","<another>"]
}`;

  const user = `Test timeline:\n${timelineText}\n\nAnalyze the site's UX quality and return the report JSON.`;

  // Primary: Gemini multimodal (screenshots give visual context)
  try {
    const parts: any[] = [user + "\n\nScreenshots:"];
    screenshots.forEach(s => parts.push({ inlineData: { mimeType: "image/png", data: s.base64 } }));
    return JSON.parse(extractJSON(await callGeminiMultimodal(parts, system))) as UXReport;
  } catch {
    console.warn("[UXReport] Gemini failed, trying NVIDIA");
  }

  // Fallback: NVIDIA text-only
  try {
    return JSON.parse(extractJSON(await callNvidia(system, user, 600))) as UXReport;
  } catch (err) {
    console.warn("[UXReport] Both failed:", err);
  }

  return {
    summary: "The simulation ran and interacted with the site. Review the session replay for detailed interaction logs.",
    whatWorkedWell: ["The page loaded and responded to interactions"],
    frictionPoints: ["Unable to generate detailed analysis — check API configuration"],
    improvements: ["Ensure NVIDIA_API_KEY and GEMINI_API_KEY are valid"],
    behaviourPatterns: [],
    featureSuggestions: [],
  };
}

// ── 4. Checklist ──────────────────────────────────────────────────────────────

export async function generateChecklistReport(params: {
  url: string;
  appProfile: AppProfile;
  uxSummary: string;
  frictionPoints: string[];
  timeline: Array<{ action: string; target?: string }>;
}): Promise<ChecklistItem[]> {
  const { url, appProfile, uxSummary, frictionPoints, timeline } = params;

  const system = `You are a startup technical advisor giving a dev-ready prioritized fix list. Be brutally specific — name exact UI elements to change, not vague advice.

Return ONLY a JSON array of 6-8 items:
[{"priority":"critical"|"high"|"medium","effort":"5min"|"1hour"|"1day","area":"<First Impression|Onboarding|Navigation|Copy|Performance|Trust|Feature|Accessibility>","fix":"<exact actionable instruction naming the specific element>","impact":"<why this matters to real users, 1 sentence>"}]`;

  const user = `App: ${appProfile.appType} at ${url}
Audience: ${appProfile.audiencePersona}
Verdict: "${uxSummary}"
Friction found: ${frictionPoints.map((f, i) => `${i + 1}. ${f}`).join("\n")}
Actions taken: ${timeline.length} total interactions

Generate the prioritized checklist array.`;

  try {
    return JSON.parse(extractArray(await callNvidia(system, user, 800))) as ChecklistItem[];
  } catch { return []; }
}

// ── 5. Experience Scorer ──────────────────────────────────────────────────────

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
  const criticals = checklistItems.filter(c => c.priority === "critical").length;

  const system = `You are scoring a startup's web app UX based on what 1000 real first-time users would experience.
Calibration: most new startups score 40-65. Above 75 = genuinely polished. Above 85 = exceptional.
Score based on the SITE QUALITY, not simulation execution.

Return ONLY JSON:
{"overall":<0-100>,"clarity":<0-100>,"navigation":<0-100>,"speed":<0-100>,"trust":<0-100>,"delight":<0-100>,"verdict":"<2-3 sentence honest review as if you just used it>","readyToShip":<true if overall>=65 and criticals=0>}`;

  const user = `${appProfile.appType} at ${url} | ${appProfile.audiencePersona}
${totalSteps} interactions over ${totalDuration}s | ${criticals} critical issues
Summary: "${uxSummary}"
Strengths: ${whatWorkedWell.join("; ")}
Friction: ${frictionPoints.join("; ")}`;

  try {
    return JSON.parse(extractJSON(await callNvidia(system, user, 350))) as ExperienceScore;
  } catch {
    return { overall: 50, clarity: 50, navigation: 50, speed: 50, trust: 50, delight: 30, verdict: "Simulation completed. Manual review recommended.", readyToShip: false };
  }
}
