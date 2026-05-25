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

export function inferSmartTypingValue(el: DomElement, url: string, appProfile?: AppProfile): string {
  const hint = [el.placeholder || "", el.name || "", el.text || "", el.type || ""].join(" ").toLowerCase();
  if (/github|username|handle/.test(hint) || /github/.test(url)) return "torvalds";
  if (/email|e-mail/.test(hint) || el.type === "email") return "tester@example.com";
  if (/password|passwd/.test(hint) || el.type === "password") return "TestPass123!";
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

export async function recognizeApp(params: { url: string; description: string; pageText: string }): Promise<AppProfile> {
  const { url, description, pageText } = params;

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

  const user = `URL: ${url}\nDescription: ${description}\n\nLive page content:\n${pageText}`;

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

// ── 2. Queue-based Page Planner (the core intelligence) ──────────────────────
// Called ONCE per page — builds a deterministic action plan the run loop executes

export async function buildPagePlan(params: {
  scan: PageScan;
  appProfile: AppProfile;
  credentials: { username?: string; password?: string } | null;
  history: Array<{ action: string; target?: string }>;
  visitedUrls: string[];
}): Promise<QueueItem[]> {
  const { scan, appProfile, credentials, history, visitedUrls } = params;

  const credNote = credentials?.username
    ? `LOGIN CREDENTIALS: username="${credentials.username}" password="${credentials.password}". Use them if you see a login form.`
    : "";

  const formsText = scan.forms.length > 0
    ? scan.forms.map((f, i) => `Form ${i + 1} (${f.purpose}): inputs=${JSON.stringify(f.inputIds)}, submit=${f.submitId}`).join("\n")
    : "No forms detected";

  const tabsText = scan.tabGroups.length > 0
    ? scan.tabGroups.map(t => `TabGroup (${t.purpose}): tabIds=${JSON.stringify(t.tabIds)}`).join("\n")
    : "No tab groups detected";

  const historyText = history.slice(-8).map(h => `[${h.action}] ${h.target || "—"}`).join("\n") || "No prior actions";

  const elements = scan.elements.slice(0, 30);

  const system = `You are a systematic QA engineer testing a web application. You think like an expert who tests every feature exhaustively.

App: ${appProfile.appType} | Audience: ${appProfile.audiencePersona}
Goal: ${appProfile.primaryGoal}
${credNote}

CURRENT PAGE: ${scan.currentUrl}
${scan.pageText.slice(0, 400)}

PAGE STRUCTURE:
${formsText}
${tabsText}
Primary CTAs (element IDs): ${JSON.stringify(scan.primaryCTAIds)}
Nav links (element IDs): ${JSON.stringify(scan.navLinkIds)}
All elements (id, tag, text/placeholder): ${JSON.stringify(elements.map(e => ({id: e.id, tag: e.tag, t: e.text?.slice(0,30)||e.placeholder?.slice(0,30)||e.type})))}

PRIOR ACTIONS:
${historyText}

Already visited URLs: ${visitedUrls.join(", ") || "none yet"}

PLANNING RULES:
1. For EACH form: first fill ALL inputs (use typeOnly for each), then click submit
2. For tab groups: click EACH tab in sequence, then interact with the content under each tab  
3. For primary CTAs not in forms: click them to see what happens
4. Try nav links to pages not yet visited
5. Use realistic data — GitHub usernames use "torvalds", emails use "tester@example.com", passwords "TestPass123!"
6. If nothing meaningful left to do on this page, return done
7. MAXIMUM 12 actions per page plan

Return ONLY a JSON array of actions. Each action has:
{ "type": "typeOnly"|"type"|"click"|"wait"|"scroll"|"done", "elementId": <number or null>, "value": "<for type/typeOnly>", "purpose": "<why, 10 words max>" }

For "done", use: { "type": "done", "summary": "<what was tested on this page>" }`;

  const user = "Build the complete action plan for this page as a JSON array.";

  try {
    const text = await callNvidia(system, user, 800);
    const arr = JSON.parse(extractArray(text)) as QueueItem[];
    if (!Array.isArray(arr) || arr.length === 0) throw new Error("empty plan");
    console.log(`[Planner] Built plan with ${arr.length} steps for ${scan.currentUrl}`);
    return arr;
  } catch (err) {
    console.warn("[Planner] Failed, using smart default plan:", err);
    return buildDefaultPlan(scan, appProfile);
  }
}

// Smart fallback plan when AI planner fails
function buildDefaultPlan(scan: PageScan, appProfile: AppProfile): QueueItem[] {
  const plan: QueueItem[] = [];

  // Fill all forms
  for (const form of scan.forms) {
    for (const inputId of form.inputIds) {
      const el = scan.elements.find(e => e.id === inputId);
      if (el) {
        plan.push({ type: "typeOnly", elementId: inputId, value: inferSmartTypingValue(el, scan.currentUrl, appProfile), purpose: `fill ${el.placeholder || el.name || "input"}` });
      }
    }
    if (form.submitId) {
      plan.push({ type: "click", elementId: form.submitId, purpose: "submit form" });
      plan.push({ type: "wait", purpose: "wait for result" });
    }
  }

  // Click each tab
  for (const tabGroup of scan.tabGroups) {
    for (const tabId of tabGroup.tabIds.slice(0, 4)) {
      plan.push({ type: "click", elementId: tabId, purpose: `try tab in ${tabGroup.purpose}` });
    }
  }

  // Click primary CTAs not already covered
  for (const ctaId of scan.primaryCTAIds.slice(0, 3)) {
    if (!scan.forms.some(f => f.submitId === ctaId)) {
      plan.push({ type: "click", elementId: ctaId, purpose: "try primary CTA" });
      plan.push({ type: "wait", purpose: "wait for CTA result" });
    }
  }

  // Nav links if nothing else
  if (plan.length === 0 && scan.navLinkIds.length > 0) {
    plan.push({ type: "click", elementId: scan.navLinkIds[0], purpose: "navigate to next page" });
  }

  if (plan.length === 0) {
    plan.push({ type: "done", summary: "No interactive elements found on this page" });
  }

  return plan;
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
  const { url, description, appProfile, timeline, screenshots } = params;

  const timelineText = timeline.slice(0, 15).map(t =>
    `[${t.timestamp}s] ${t.action}: ${(t.target || "").slice(0, 60)}`
  ).join("\n");

  const appCtx = appProfile
    ? `Type: ${appProfile.appType} | Audience: ${appProfile.audiencePersona} | Goal: ${appProfile.primaryGoal}`
    : description;

  const system = `You are a senior UX researcher reviewing a startup's web app on behalf of real developers who need honest, specific feedback.

${appCtx} | URL: ${url}

IMPORTANT — this is a UX analysis of the WEBSITE, not the simulation. If the tester made a mistake (e.g., clicked wrong thing), IGNORE that — focus on the app's actual design quality.

Report what 1000 real first-time users would experience. Be specific — reference real UI elements, copy, flows you observed.

Include in behaviourPatterns: what users naturally try to do (even things the app doesn't support).
Include in featureSuggestions: 2-3 features users clearly wanted based on their behaviour.

Return ONLY this JSON:
{
  "summary": "<2-3 sentence honest verdict as if you just used it>",
  "whatWorkedWell": ["<specific strength with exact UI context>","<another>","<another>"],
  "frictionPoints": ["<specific pain point real users would feel>","<another>","<another>"],
  "improvements": ["<general area to improve>","<another>"],
  "behaviourPatterns": ["<observed pattern>","<pattern>"],
  "featureSuggestions": ["<feature users clearly wanted>","<another>"]
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
