import { chromium, Browser, BrowserContext, Page } from "playwright";
import { DomElement } from "./ai";

// Rich page structure for queue-based planning
export interface PageScan {
  elements: DomElement[];
  forms: Array<{
    purpose: string;
    inputIds: number[];
    submitId: number | null;
  }>;
  tabGroups: Array<{
    purpose: string;
    tabIds: number[];
  }>;
  primaryCTAIds: number[];
  navLinkIds: number[];
  pageText: string;
  currentUrl: string;
}

export class BrowserSimulator {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private elementsMap: Map<number, { text: string }> = new Map();

  async initialize() {
    this.browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    });
    this.page = await this.context.newPage();
    await this.page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });
  }

  async navigate(url: string) {
    if (!this.page) throw new Error("Browser not initialized.");
    await this.page.goto(url, { waitUntil: "networkidle", timeout: 25000 });
  }

  async getCurrentUrl(): Promise<string> {
    return this.page?.url() || "";
  }

  // ── Core: Full page scan for queue-based planning ─────────────────────────

  async getPageScan(): Promise<PageScan> {
    if (!this.page) throw new Error("Browser not initialized.");

    // Step 1: assign data-uxray-id to all visible interactables
    const elements = await this.getInteractableElements();

    // Step 2: group them semantically using DOM structure
    const groups = await this.page.evaluate(() => {
      const forms: Array<{ purpose: string; inputIds: number[]; submitId: number | null }> = [];
      const tabGroups: Array<{ purpose: string; tabIds: number[] }> = [];
      const primaryCTAIds: number[] = [];
      const navLinkIds: number[] = [];

      const getId = (el: HTMLElement | null) =>
        el ? parseInt(el.getAttribute("data-uxray-id") || "-1") : -1;
      const validId = (id: number) => id > 0;

      // ── Detect forms (explicit <form> tags)
      document.querySelectorAll("form").forEach((form) => {
        const inputEls = Array.from(
          form.querySelectorAll<HTMLElement>(
            "input:not([type=hidden]):not([type=submit]):not([type=button]), textarea, select"
          )
        );
        const inputIds = inputEls.map(getId).filter(validId);

        const submitEl =
          form.querySelector<HTMLElement>("button[type=submit], input[type=submit]") ||
          form.querySelector<HTMLElement>("button");
        const submitId = validId(getId(submitEl)) ? getId(submitEl) : null;

        // Get form purpose from legend, fieldset label, aria-label, or nearest heading
        const purposeEl =
          form.querySelector("legend, [aria-label], label") ||
          (form.closest("section, article, div") ? form.closest("section, article, div")!.querySelector("h1,h2,h3,h4") : null);
        let purposeText = "";
        if (purposeEl) {
          purposeText = (purposeEl as HTMLElement).textContent ? (purposeEl as HTMLElement).textContent!.trim().slice(0, 60) : "";
        }
        const purpose = purposeText || "form";

        if (inputIds.length > 0) {
          forms.push({ purpose, inputIds, submitId });
        }
      });

      // ── Detect tab groups (role=tablist or common tab patterns)
      const tabContainers = document.querySelectorAll<HTMLElement>(
        "[role=tablist], .tabs, .tab-list, .tab-group, .tab-bar"
      );
      tabContainers.forEach((container) => {
        const tabEls = Array.from(
          container.querySelectorAll<HTMLElement>("[role=tab], .tab, button")
        );
        const tabIds = tabEls.map(getId).filter(validId);
        const purpose =
          container.getAttribute("aria-label") ||
          container.closest("section, div")?.querySelector("h1,h2,h3,h4,p")?.textContent?.trim().slice(0, 40) ||
          "tab group";
        if (tabIds.length > 1) {
          tabGroups.push({ purpose, tabIds });
        }
      });

      // ── Detect nav links (header/nav anchors)
      document
        .querySelectorAll<HTMLElement>("nav a, header a, [role=navigation] a, footer a")
        .forEach((el) => {
          const id = getId(el);
          if (validId(id)) navLinkIds.push(id);
        });

      // ── Detect primary CTAs (large/prominent buttons not in forms)
      document.querySelectorAll<HTMLElement>("button, [role=button]").forEach((el) => {
        const id = getId(el);
        if (!validId(id)) return;
        const rect = el.getBoundingClientRect();
        const area = rect.width * rect.height;
        const text = el.textContent?.toLowerCase() || "";
        const isPrimary =
          area > 3000 ||
          /get.?start|sign.?up|try|analyze|submit|continue|next|create|login|join|launch|run|start/i.test(text);
        if (isPrimary && !el.closest("form")) {
          primaryCTAIds.push(id);
        }
      });

      return { forms, tabGroups, primaryCTAIds, navLinkIds };
    });

    const pageText = await this.getPageText();

    return {
      elements,
      forms: groups.forms,
      tabGroups: groups.tabGroups,
      primaryCTAIds: groups.primaryCTAIds,
      navLinkIds: groups.navLinkIds,
      pageText,
      currentUrl: this.page!.url(),
    };
  }

  // ── Core: All visible interactable elements with stable IDs ───────────────

  async getInteractableElements(): Promise<DomElement[]> {
    if (!this.page) throw new Error("Browser not initialized.");

    const elements = await this.page.evaluate(() => {
      const list: any[] = [];
      let currentId = 1;

      document.querySelectorAll("[data-uxray-id]").forEach((el) => {
        el.removeAttribute("data-uxray-id");
      });

      function isVisible(el: HTMLElement) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const isInput = ["input", "textarea", "select"].includes(el.tagName.toLowerCase()) ||
          el.getAttribute("contenteditable") === "true" ||
          ["textbox", "checkbox", "radio"].includes(el.getAttribute("role") || "");
        const ok =
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          style.opacity !== "0" &&
          (isInput || style.pointerEvents !== "none");
        if (!ok) return false;
        return rect.top < window.innerHeight && rect.bottom > 0 &&
          rect.left < window.innerWidth && rect.right > 0;
      }

      const selectors = [
        "a", "button", "input", "textarea", "select",
        "[role='button']", "[role='link']", "[role='textbox']",
        "[role='tab']", "[role='checkbox']", "[role='radio']",
        "[contenteditable='true']", "[onclick]",
      ];

      document.querySelectorAll(selectors.join(",")).forEach((node) => {
        const el = node as HTMLElement;
        if (!isVisible(el)) return;
        el.setAttribute("data-uxray-id", String(currentId));
        let rawText =
          el.tagName === "IFRAME"
            ? `[IFRAME] ${el.getAttribute("title") || "Embedded"}`
            : el.innerText || (el as HTMLInputElement).value || el.textContent || "";
        let text = rawText.trim().slice(0, 60);
        const rect = el.getBoundingClientRect();
        list.push({
          id: currentId++,
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute("type") || undefined,
          text: text || undefined,
          placeholder: el.getAttribute("placeholder") || undefined,
          name: el.getAttribute("name") || el.id || undefined,
          role: el.getAttribute("role") || undefined,
          ariaLabel: el.getAttribute("aria-label") || undefined,
          disabled: (el as HTMLInputElement).disabled || el.getAttribute("aria-disabled") === "true",
          href: el.getAttribute("href") || undefined,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      });

      return list;
    });

    this.elementsMap.clear();
    elements.forEach((el) => {
      this.elementsMap.set(el.id, { text: el.text || el.placeholder || el.name || el.tag });
    });

    return elements;
  }

  // ── Page state detection ──────────────────────────────────────────────────

  async getPageState(): Promise<{ isLoaded: boolean; documentState: string; hasLoader: boolean }> {
    if (!this.page) return { isLoaded: true, documentState: "complete", hasLoader: false };
    return await this.page.evaluate(() => {
      const docState = document.readyState;
      const loaderSelectors = [
        '[class*="spinner"]', '[class*="loader"]', '[class*="loading"]',
        '[role="progressbar"]', '[aria-busy="true"]',
        'svg.animate-spin', '[class*="animate-spin"]', '[class*="skeleton"]',
      ];
      let hasLoader = false;
      for (const sel of loaderSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          const s = window.getComputedStyle(el);
          if (s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0") {
            hasLoader = true; break;
          }
        }
      }
      if (!hasLoader) {
        const phrases = ["analyzing","fetching","generating","processing","loading","please wait","scanning"];
        for (const node of Array.from(document.querySelectorAll("p,span,div,h1,h2,h3"))) {
          const el = node as HTMLElement;
          const r = el.getBoundingClientRect();
          const s = window.getComputedStyle(el);
          if (r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.bottom > 0 &&
              s.display !== "none" && s.visibility !== "hidden") {
            const t = (el.textContent || "").toLowerCase().trim();
            if (t.length < 120 && phrases.some(p => t.includes(p))) { hasLoader = true; break; }
          }
        }
      }
      return { isLoaded: docState === "complete" && !hasLoader, documentState: docState, hasLoader };
    });
  }

  // ── Page text extraction ──────────────────────────────────────────────────

  async getPageText(): Promise<string> {
    if (!this.page) return "";
    return await this.page.evaluate(() => {
      const p: string[] = [];
      const title = document.title;
      if (title) p.push(`TITLE: ${title}`);
      const h1s = Array.from(document.querySelectorAll("h1")).map(h => h.textContent ? h.textContent.trim() : "").filter(Boolean);
      if (h1s.length) p.push(`H1: ${h1s.join(" | ")}`);
      const h2s = Array.from(document.querySelectorAll("h2")).slice(0, 6).map(h => h.textContent ? h.textContent.trim() : "").filter(Boolean);
      if (h2s.length) p.push(`H2: ${h2s.join(" | ")}`);
      const nav = Array.from(document.querySelectorAll("nav a, header a")).slice(0, 12).map(a => (a as HTMLElement).textContent ? (a as HTMLElement).textContent!.trim() : "").filter(Boolean);
      if (nav.length) p.push(`NAV: ${nav.join(", ")}`);
      const btns = Array.from(document.querySelectorAll("button, [role=button]")).slice(0, 8).map(b => (b as HTMLElement).textContent ? (b as HTMLElement).textContent!.trim() : "").filter(Boolean);
      if (btns.length) p.push(`BUTTONS: ${btns.join(", ")}`);
      const inputs = Array.from(document.querySelectorAll("input, textarea")).slice(0, 6).map(i => { const e = i as HTMLInputElement; return e.placeholder || e.getAttribute("aria-label") || e.name || e.type; }).filter(Boolean);
      if (inputs.length) p.push(`INPUTS: ${inputs.join(", ")}`);
      p.push(`CONTENT: ${(document.body.innerText || "").slice(0, 500).replace(/\s+/g, " ")}`);
      return p.join("\n");
    });
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  private async getFreshCoords(id: number): Promise<{ x: number; y: number } | null> {
    if (!this.page) return null;
    return await this.page.evaluate((targetId) => {
      const el = document.querySelector(`[data-uxray-id="${targetId}"]`) as HTMLElement;
      if (!el) return null;
      el.scrollIntoView({ block: "center", inline: "center" });
      const rect = el.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }, id);
  }

  private async waitForLoaders(maxSeconds = 15) {
    if (!this.page) return;
    let elapsed = 0;
    while (elapsed < maxSeconds) {
      const state = await this.getPageState();
      if (!state.isLoaded || state.hasLoader) {
        await this.page.waitForTimeout(1000);
        elapsed++;
      } else {
        break;
      }
    }
  }

  async click(id: number): Promise<string> {
    if (!this.page) throw new Error("Browser not initialized.");
    const coords = await this.getFreshCoords(id);
    if (!coords) throw new Error(`Element ${id} not found.`);
    await this.page.mouse.click(coords.x, coords.y);
    await this.waitForLoaders();
    await this.page.waitForTimeout(800);
    return this.elementsMap.get(id)?.text || "element clicked";
  }

  async type(id: number, text: string): Promise<string> {
    if (!this.page) throw new Error("Browser not initialized.");
    const coords = await this.getFreshCoords(id);
    if (!coords) throw new Error(`Element ${id} not found.`);
    await this.page.mouse.click(coords.x, coords.y);
    await this.page.waitForTimeout(150);
    await this.page.keyboard.down("ControlOrMeta");
    await this.page.keyboard.press("a");
    await this.page.keyboard.up("ControlOrMeta");
    await this.page.keyboard.press("Backspace");
    await this.page.keyboard.type(text, { delay: 40 });
    await this.waitForLoaders();
    await this.page.waitForTimeout(500);
    return `${this.elementsMap.get(id)?.text || "input"} ← "${text}"`;
  }

  // Type without pressing Enter — for multi-field forms
  async typeOnly(id: number, text: string): Promise<string> {
    if (!this.page) throw new Error("Browser not initialized.");
    const coords = await this.getFreshCoords(id);
    if (!coords) throw new Error(`Element ${id} not found.`);
    await this.page.mouse.click(coords.x, coords.y);
    await this.page.waitForTimeout(150);
    await this.page.keyboard.down("ControlOrMeta");
    await this.page.keyboard.press("a");
    await this.page.keyboard.up("ControlOrMeta");
    await this.page.keyboard.press("Backspace");
    await this.page.keyboard.type(text, { delay: 40 });
    await this.waitForLoaders();
    await this.page.waitForTimeout(300);
    return `${this.elementsMap.get(id)?.text || "input"} ← "${text}"`;
  }

  async scroll(): Promise<string> {
    if (!this.page) throw new Error("Browser not initialized.");
    await this.page.evaluate(() => window.scrollBy({ top: 350, behavior: "smooth" }));
    await this.page.waitForTimeout(800);
    return "scrolled down";
  }

  async wait(maxSeconds = 30): Promise<string> {
    if (!this.page) throw new Error("Browser not initialized.");
    let elapsed = 0;
    let wasLoading = false;
    while (elapsed < maxSeconds) {
      const state = await this.getPageState();
      if (!state.isLoaded) {
        wasLoading = true;
        await this.page.waitForTimeout(1000);
        elapsed++;
        continue;
      }
      break;
    }
    if (wasLoading) return `waited ${elapsed}s for loading to complete`;
    await this.page.waitForTimeout(1000);
    return "waited 1s (page was ready)";
  }

  async screenshotBase64(): Promise<string> {
    if (!this.page) throw new Error("Browser not initialized.");
    const buffer = await this.page.screenshot({ type: "png" });
    return buffer.toString("base64");
  }

  async cleanup() {
    try {
      if (this.page) await this.page.close();
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();
    } catch {}
  }
}
