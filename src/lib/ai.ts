import { GoogleGenerativeAI } from "@google/generative-ai";
import type { PageScan } from "./playwright";

const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const NVIDIA_KEY = process.env.NVIDIA_API_KEY || "";
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || "";
const HF_KEY = process.env.HF_API_KEY || process.env.HUGGINGFACE_API_KEY || "";
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

// ── OpenRouter caller (free models) ──────────────────────────────────────────

async function callOpenRouter(system: string, user: string, model: string, maxTokens = 700): Promise<string> {
  if (!OPENROUTER_KEY) throw new Error("OPENROUTER_API_KEY not set");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/Durgaprasad-Developer/UX-Ray",
      "X-Title": "UX-Ray QA Agent"
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      max_tokens: maxTokens,
      temperature: 0.2,
    }),
  });
  if (res.status === 429) throw new Error("429 Rate Limit");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("empty response");
  console.log(`[OpenRouter] OK: ${model} (${maxTokens} max)`);
  return text;
}

// ── OpenRouter Multimodal Vision caller ──────────────────────────────────────

async function callOpenRouterMultimodal(parts: any[], system: string, model: string): Promise<string> {
  if (!OPENROUTER_KEY) throw new Error("OPENROUTER_API_KEY not set");
  
  const contentParts: any[] = [];
  for (const part of parts) {
    if (part.text) {
      contentParts.push({ type: "text", text: part.text });
    } else if (part.inlineData) {
      const mime = part.inlineData.mimeType || "image/jpeg";
      const base64 = part.inlineData.data;
      contentParts.push({
        type: "image_url",
        image_url: {
          url: `data:${mime};base64,${base64}`
        }
      });
    }
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/Durgaprasad-Developer/UX-Ray",
      "X-Title": "UX-Ray QA Agent"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: contentParts }
      ],
      temperature: 0.2,
    }),
  });
  if (res.status === 429) throw new Error("429 Rate Limit");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("empty response");
  console.log(`[OpenRouter Vision] OK: ${model}`);
  return text;
}

// ── Hugging Face caller (free inference models fallback) ──────────────────────

async function callHuggingFace(system: string, user: string, maxTokens = 700): Promise<string> {
  if (!HF_KEY) throw new Error("HF_API_KEY not set");
  const models = ["meta-llama/Llama-3.2-3B-Instruct", "Qwen/Qwen2.5-Coder-7B-Instruct", "mistralai/Mistral-7B-Instruct-v0.3"];
  let last: any;
  for (const model of models) {
    try {
      const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${HF_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: `<|system|>\n${system}\n<|user|>\n${user}\n<|assistant|>\n`,
          parameters: { max_new_tokens: maxTokens, temperature: 0.2 },
        }),
      });
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      let text = "";
      if (Array.isArray(data) && data[0]?.generated_text) {
        text = data[0].generated_text;
      } else if (data.generated_text) {
        text = data.generated_text;
      }
      if (text.includes("<|assistant|>")) {
        text = text.split("<|assistant|>").pop() || text;
      }
      text = text.trim();
      if (!text) throw new Error("empty");
      console.log(`[HuggingFace] OK: ${model} (${maxTokens} max)`);
      return text;
    } catch (e: any) {
      console.warn(`[HuggingFace] ${model}: ${e.message?.slice(0, 50)}`);
      last = e;
    }
  }
  throw last;
}

// ── Model Orchestra Routing Manager ───────────────────────────────────────────

interface ManagedModel {
  id: string;
  provider: "OpenRouter" | "NVIDIA" | "Gemini";
  type: "text" | "vision" | "both";
  failureCount: number;
  cooldownUntil: number;
}

class ModelOrchestraManager {
  private models: ManagedModel[] = [
    // 1. Native Gemini (Primary Manager models — super fast and now operational!)
    { id: "gemini-2.5-flash", provider: "Gemini", type: "both", failureCount: 0, cooldownUntil: 0 },
    { id: "gemini-2.5-pro", provider: "Gemini", type: "both", failureCount: 0, cooldownUntil: 0 },
    { id: "gemini-2.0-flash", provider: "Gemini", type: "both", failureCount: 0, cooldownUntil: 0 },

    // 2. OpenRouter verified working free tier
    { id: "nvidia/nemotron-3-super-120b-a12b:free", provider: "OpenRouter", type: "text", failureCount: 0, cooldownUntil: 0 },
    { id: "openai/gpt-oss-120b:free", provider: "OpenRouter", type: "text", failureCount: 0, cooldownUntil: 0 },
    { id: "openai/gpt-oss-20b:free", provider: "OpenRouter", type: "text", failureCount: 0, cooldownUntil: 0 },

    // 3. OpenRouter vision free tier
    { id: "google/gemma-4-31b-it:free", provider: "OpenRouter", type: "vision", failureCount: 0, cooldownUntil: 0 },
    { id: "nvidia/nemotron-nano-12b-v2-vl:free", provider: "OpenRouter", type: "vision", failureCount: 0, cooldownUntil: 0 },
    { id: "google/gemini-2.5-flash", provider: "OpenRouter", type: "both", failureCount: 0, cooldownUntil: 0 },
    { id: "google/gemini-2.5-pro", provider: "OpenRouter", type: "both", failureCount: 0, cooldownUntil: 0 },

    // 4. Dedicated NVIDIA developer catalog (Always reliable, no rate limits under new developer key!)
    { id: "mistralai/mistral-large-3-675b-instruct-2512", provider: "NVIDIA", type: "text", failureCount: 0, cooldownUntil: 0 },
    { id: "qwen/qwen3-coder-480b-a35b-instruct", provider: "NVIDIA", type: "text", failureCount: 0, cooldownUntil: 0 },
    { id: "meta/llama-4-maverick-17b-128e-instruct", provider: "NVIDIA", type: "text", failureCount: 0, cooldownUntil: 0 },
    { id: "meta/llama-3.3-70b-instruct", provider: "NVIDIA", type: "text", failureCount: 0, cooldownUntil: 0 },
    { id: "nvidia/nemotron-3-super-120b-a12b", provider: "NVIDIA", type: "text", failureCount: 0, cooldownUntil: 0 },
    { id: "meta/llama-3.1-8b-instruct", provider: "NVIDIA", type: "text", failureCount: 0, cooldownUntil: 0 },
    { id: "meta/llama-3.2-3b-instruct", provider: "NVIDIA", type: "text", failureCount: 0, cooldownUntil: 0 },
  ];

  private readonly COOLDOWN_MS = 5 * 60 * 1000; // 5 minute cool-down for flaking models

  getModelQueue(type: "text" | "vision"): ManagedModel[] {
    const now = Date.now();
    const available = this.models.filter(
      m => (m.type === type || m.type === "both") && m.cooldownUntil < now
    );
    
    // Load balancing: Separate clean active models and recovering models
    const active = available.filter(m => m.failureCount === 0);
    const recovering = available.filter(m => m.failureCount > 0).sort((a, b) => a.failureCount - b.failureCount);
    
    // Dynamic Shuffle for active models to balance load and avoid API rate limits
    const balancedActive = active.sort(() => Math.random() - 0.5);
    
    return [...balancedActive, ...recovering];
  }

  recordSuccess(modelId: string) {
    const m = this.models.find(x => x.id === modelId);
    if (m) {
      m.failureCount = 0;
      m.cooldownUntil = 0;
    }
  }

  recordFailure(modelId: string) {
    const m = this.models.find(x => x.id === modelId);
    if (m) {
      m.failureCount++;
      if (m.failureCount >= 2) {
        m.cooldownUntil = Date.now() + this.COOLDOWN_MS;
        console.warn(`[OrchestraManager] Model ${modelId} suspended on cooldown until ${new Date(m.cooldownUntil).toLocaleTimeString()}`);
      }
    }
  }

  /**
   * Decision-Based Verification & Self-Healing (Gemini manager model)
   */
  async verifyAndHeal(response: string, expectedFormat: string): Promise<{ valid: boolean; content: string }> {
    const trimmed = (response || "").trim();
    if (!trimmed) return { valid: false, content: "" };

    const requiresJSON = expectedFormat.toLowerCase().includes("json") || expectedFormat.toLowerCase().includes("array");
    if (requiresJSON) {
      try {
        const cleaned = extractJSON(trimmed);
        JSON.parse(cleaned);
        return { valid: true, content: trimmed };
      } catch (err) {
        // Self-Healing JSON: Ask the Manager Model to inspect and reconstruct
        if (GEMINI_KEY) {
          try {
            console.log("[OrchestraManager] JSON verification failed. Delegating correction to Manager Model...");
            const manager = ai.getGenerativeModel({
              model: "gemini-2.5-flash",
              systemInstruction: "You are the QA Manager. Clean and format the following text into a perfectly valid JSON object or array matching the format expected by the user. If the input is empty or completely unrecoverable, return ONLY the word 'FAILED'."
            });
            const r = await manager.generateContent(trimmed);
            const corrected = r.response.text()?.trim() || "";
            if (corrected && !corrected.includes("FAILED")) {
              const cleanedCorrected = extractJSON(corrected);
              JSON.parse(cleanedCorrected); // check if manager successfully healed it
              console.log("[OrchestraManager] Manager Model successfully healed the response!");
              return { valid: true, content: corrected };
            }
          } catch {}
        }
        return { valid: false, content: trimmed };
      }
    }
    return { valid: true, content: trimmed };
  }
}

export const orchestraManager = new ModelOrchestraManager();

// ── Unified Text LLM Caller (Manager) ──────────────────────────────────────────

async function callTextLLM(system: string, user: string, maxTokens = 700): Promise<string> {
  const queue = orchestraManager.getModelQueue("text");
  let lastError: any = null;

  for (const model of queue) {
    try {
      let result = "";
      if (model.provider === "Gemini" && GEMINI_KEY) {
        const m = ai.getGenerativeModel({ model: model.id, systemInstruction: system });
        const r = await m.generateContent(user);
        result = r.response.text()?.trim() || "";
      } else if (model.provider === "OpenRouter" && OPENROUTER_KEY) {
        result = await callOpenRouter(system, user, model.id, maxTokens);
      } else if (model.provider === "NVIDIA" && NVIDIA_KEY) {
        const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${NVIDIA_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: model.id,
            messages: [{ role: "system", content: system }, { role: "user", content: user }],
            max_tokens: maxTokens,
            temperature: 0.2,
          }),
        });
        if (res.status === 429) {
          await new Promise(r => setTimeout(r, 1500));
          throw new Error("429 Rate Limit");
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        result = data.choices?.[0]?.message?.content?.trim() || "";
      }

      if (result) {
        const verified = await orchestraManager.verifyAndHeal(result, system);
        if (verified.valid) {
          orchestraManager.recordSuccess(model.id);
          return verified.content;
        }
        throw new Error("response verification failed");
      }
      throw new Error("empty response");
    } catch (e: any) {
      lastError = e;
      orchestraManager.recordFailure(model.id);
      console.warn(`[OrchestraManager] Model ${model.id} failed: ${e.message}`);
    }
  }

  // Emergency: Fallback directly to dedicated NVIDIA meta/llama-3.3-70b-instruct
  if (NVIDIA_KEY) {
    try {
      console.log("[OrchestraManager] Emergency fallback directly to NVIDIA llama-3.3-70b-instruct");
      const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${NVIDIA_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "meta/llama-3.3-70b-instruct",
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
          max_tokens: maxTokens,
          temperature: 0.2,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices?.[0]?.message?.content?.trim() || "";
      }
    } catch (err: any) {
      lastError = err;
    }
  }

  // Emergency: Fallback to Hugging Face free models
  if (HF_KEY) {
    try {
      return await callHuggingFace(system, user, maxTokens);
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error("All text models in the orchestra failed.");
}

// ── Gemini multimodal (screenshots only, for UX report) ──────────────────────

async function callGeminiMultimodal(parts: any[], system: string, retries = 3): Promise<string> {
  const queue = orchestraManager.getModelQueue("vision");
  let lastError: any = null;

  for (const model of queue) {
    try {
      let result = "";
      if (model.provider === "Gemini" && GEMINI_KEY) {
        const sanitizedParts = parts.map(p => typeof p === "string" ? { text: p } : p);
        const m = ai.getGenerativeModel({ model: model.id, systemInstruction: system, generationConfig: { responseMimeType: "application/json" } });
        const r = await m.generateContent(sanitizedParts);
        result = r.response.text()?.trim() || "";
      } else if (model.provider === "OpenRouter" && OPENROUTER_KEY) {
        result = await callOpenRouterMultimodal(parts, system, model.id);
      }

      if (result) {
        const verified = await orchestraManager.verifyAndHeal(result, system);
        if (verified.valid) {
          orchestraManager.recordSuccess(model.id);
          return verified.content;
        }
        throw new Error("response verification failed");
      }
      throw new Error("empty response");
    } catch (e: any) {
      lastError = e;
      orchestraManager.recordFailure(model.id);
      console.warn(`[OrchestraManager Vision] Model ${model.id} failed: ${e.message}`);
    }
  }

  // Emergency: Fallback to native gemini-2.5-flash
  if (GEMINI_KEY) {
    try {
      console.log("[OrchestraManager Vision] Emergency fallback directly to native gemini-2.5-flash");
      const sanitizedParts = parts.map(p => typeof p === "string" ? { text: p } : p);
      const m = ai.getGenerativeModel({ model: "gemini-2.5-flash", systemInstruction: system, generationConfig: { responseMimeType: "application/json" } });
      const r = await m.generateContent(sanitizedParts);
      return r.response.text()?.trim() || "";
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error("All multimodal intelligence models in the orchestra failed.");
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
    return JSON.parse(extractJSON(await callTextLLM(system, user, 500))) as AppProfile;
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
  annotatedScreenshot: string;
  mode?: string;
}): Promise<{ observation: string; thought: string; action: QueueItem }> {
  const { scan, appProfile, history, visitedUrls, credentials, userObjective, annotatedScreenshot, mode } = params;

  const formsText = scan.forms.length > 0
    ? scan.forms.map((f, i) => `Form ${i + 1} (${f.purpose}): inputs=${JSON.stringify(f.inputIds)}, submit=${f.submitId}`).join("\n")
    : "No forms detected";

  const tabsText = scan.tabGroups.length > 0
    ? scan.tabGroups.map(t => `TabGroup (${t.purpose}): tabIds=${JSON.stringify(t.tabIds)}`).join("\n")
    : "No tab groups detected";

  const historyText = history.slice(-12).map(h => `[${h.action}] ${h.target || "—"}`).join("\n") || "No prior actions";

  const typedIds = params.typedElementIds || [];
  const elements = scan.elements.filter(e => !typedIds.includes(e.id)).slice(0, 50);

  const isTaskMode = mode === "task";

  const system = isTaskMode
    ? `You are an autonomous AI Task Doer Agent. Your goal is to execute the USER OBJECTIVE on the website.
You have been provided with an annotated screenshot of the current page. Every interactable element is overlaid with a red numeric bounding box (e.g. [14], [45]).
You observe the screen visually, cross-reference the bounding box IDs with the text list below, and decide the next single best action to fulfill the objective.

USER OBJECTIVE: ${userObjective || 'Execute the task'}
${credentials ? `\nPROVIDED CREDENTIALS (YOU MUST USE THESE WHEN TYPING): Username/Email: "${credentials.username || ''}" | Password: "${credentials.password || ''}"` : ""}

CURRENT PAGE: ${scan.currentUrl}
${scan.pageText.slice(0, 400)}

PAGE STRUCTURE:
${formsText}
${tabsText}
Interactable Elements mapping (cross-reference these IDs with the red boxes on the image):
${JSON.stringify(elements.map(e => ({
  id: e.id, 
  tag: e.tag, 
  t: e.text?.slice(0,40) || e.placeholder?.slice(0,40) || e.ariaLabel?.slice(0,20),
  disabled: e.disabled ? true : undefined
})))}

RECENT HISTORY (What you just did):
${historyText}

Visited URLs: ${visitedUrls.join(", ") || "none"}

CRITICAL RULES FOR POPUPS & MODALS:
- If any popup, modal, cookie banner, newsletter signup, or overlay blocks the screen (e.g., "Sign in to Google", "Before you continue", "Try Premium", "Accept cookies", "Consent", etc.) that is NOT the main task, you MUST find the close button (often marked with "X", "x", "Close", "Dismiss", "Cancel", or a cross/close icon) and click it immediately to close the popup.
- Once closed, proceed with the main objective.

OBJECTIVE EXECUTION RULES:
- Carefully search for elements, inputs, and buttons related to the user's objective.
- For YouTube: if you need to search, type the search query in the search bar/box and press enter, or click the search button. To play a video, click on the video's card/link. If you need to play multiple videos, do them sequentially (e.g. click one, wait/scroll/go back, click the next).
- If your last action failed or did not change the page state, DO NOT repeat the same action. Look at the visual annotations, adapt, and try a different element.
- Once the user's objective is fully accomplished (e.g., you searched for songs and played 3 videos on YouTube), return "done" as the action type.
- Return ONLY JSON.

Return format:
{
  "observation": "<What do you see on the screenshot right now? Did your last action succeed? Is there a popup blocking the screen?>",
  "thought": "<Based on your visual observation, what is your 1-sentence strategy?>",
  "action": { "type": "type"|"click"|"wait"|"scroll"|"done", "elementId": <number_from_red_box>, "value": "<if type>", "purpose": "<short label>" }
}
For "done", action should be: { "type": "done", "summary": "<reason>" }`
    : `You are an autonomous AI Vision Agent testing a web app. You act exactly like a meticulous senior developer doing a deep-dive QA session.
You have been provided with an annotated screenshot of the current page. Every interactable element is overlaid with a red numeric bounding box (e.g. [14], [45]).
You observe the screen visually, cross-reference the bounding box IDs with the text list below, think about what needs testing, and take ONE ACTION at a time by outputting the ID of the box you wish to interact with.

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
Interactable Elements mapping (cross-reference these IDs with the red boxes on the image):
${JSON.stringify(elements.map(e => ({
  id: e.id, 
  tag: e.tag, 
  t: e.text?.slice(0,40) || e.placeholder?.slice(0,40) || e.ariaLabel?.slice(0,20),
  disabled: e.disabled ? true : undefined
})))}

RECENT HISTORY (What you just did):
${historyText}

Visited URLs: ${visitedUrls.join(", ") || "none"}

DYNAMIC SITUATIONAL REASONING:
You must dynamically adapt to the situation visually instead of following static robotic rules:
- DYNAMIC ADAPTATION: If your last action failed or didn't change the page, do NOT repeat it. Look at the image, think about why it failed, and adapt your strategy.
- POPUPS & OVERLAYS: If you visually see a cookie banner, newsletter, or modal blocking the screen, you must immediately dismiss or interact with it before doing anything else.
- INTELLIGENT EXPLORATION: Use the "scroll" action if you need to find more content. Use your visual intuition to decide which buttons are primary CTAs.
- OBJECTIVE FOCUS: Above all, every action you take must actively and intelligently advance the USER OBJECTIVE and TESTING PLAN.
- Return ONLY JSON.

Return format:
{
  "observation": "<What do you see on the screenshot right now? Did your last action succeed? Is there a popup blocking the screen?>",
  "thought": "<Based on your visual observation, what is your 1-sentence strategy?>",
  "action": { "type": "type"|"click"|"wait"|"scroll"|"done", "elementId": <number_from_red_box>, "value": "<if type>", "purpose": "<short label>" }
}
For "done", action should be: { "type": "done", "summary": "<reason>" }`;

  const user = "Observe the annotated screenshot and history. Write your visual observation and thought. Decide the single best next action by choosing a numeric ID. Return JSON.";

  try {
    const parts = [
      { text: user },
      { inlineData: { mimeType: "image/jpeg", data: annotatedScreenshot } }
    ];
    const text = await callGeminiMultimodal(parts, system);
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
    console.warn("[Agent] Gemini failed, trying text-only LLM fallback...", err);
    try {
      const textOnlyUser = "Observe the page structure, elements list, and recent history text. Write your observation and thought based on the text structure (ignore the screenshot as you are in text-only fallback mode). Decide the single best next action by choosing a numeric ID from the list. Return JSON.";
      const text = await callTextLLM(system, textOnlyUser, 500);
      const result = JSON.parse(extractJSON(text));
      if (!result.action || !result.action.type) throw new Error("invalid schema from NVIDIA fallback");
      
      // If the agent hallucinated a value for a type action but it's empty, try to fix it
      if (result.action.type === "type" && result.action.elementId) {
        const el = scan.elements.find(e => e.id === result.action.elementId);
        if (el && (!result.action.value || result.action.value === "")) {
          result.action.value = inferSmartTypingValue(el, scan.currentUrl, appProfile, credentials);
        }
      }
      return result;
    } catch (nvidiaErr) {
      console.error("[Agent] NVIDIA fallback failed too:", nvidiaErr);
    }
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
    const parts: any[] = [{ text: user + "\n\nScreenshots:" }];
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
