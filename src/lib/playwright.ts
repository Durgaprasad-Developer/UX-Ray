import { chromium, Browser, BrowserContext, Page } from "playwright";
import { DomElement } from "./ai";

export class BrowserSimulator {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private elementsMap: Map<number, { text: string }> = new Map();

  async initialize() {
    this.browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    });
    this.page = await this.context.newPage();
    // Stealth injection to hide Playwright signature from Google reCAPTCHA
    await this.page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });
  }

  async navigate(url: string) {
    if (!this.page) throw new Error("Browser not initialized.");
    await this.page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
  }

  async getInteractableElements(): Promise<DomElement[]> {
    if (!this.page) throw new Error("Browser not initialized.");

    const elements = await this.page.evaluate(() => {
      const list: any[] = [];
      let currentId = 1;

      // Clear previous attributes to keep DOM clean
      document.querySelectorAll("[data-uxray-id]").forEach(el => {
        el.removeAttribute("data-uxray-id");
      });

      function isVisible(el: HTMLElement) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        
        // Native inputs should bypass pointer-events checks (useful for custom styled forms like Google Forms/Shadcn)
        const isNativeInput = ["input", "textarea", "select"].includes(el.tagName.toLowerCase()) || 
                              el.getAttribute("contenteditable") === "true" ||
                              ["textbox", "checkbox", "radio"].includes(el.getAttribute("role") || "");

        const basicVisible = (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          style.opacity !== "0" &&
          (isNativeInput || style.pointerEvents !== "none")
        );

        if (!basicVisible) return false;

        // Viewport Check: Check if element overlaps with active window viewport boundaries
        return (
          rect.top < window.innerHeight &&
          rect.bottom > 0 &&
          rect.left < window.innerWidth &&
          rect.right > 0
        );
      }

      // Query broad set of selectors including contenteditable, textboxes, radios, checkboxes
      const selectors = [
        "a", "button", "input", "textarea", "select", "iframe",
        "[role='button']", "[role='link']", "[role='textbox']", 
        "[role='checkbox']", "[role='radio']", "[contenteditable='true']",
        "[onclick]"
      ];
      
      const allElements = document.querySelectorAll(selectors.join(","));

      allElements.forEach((node) => {
        const el = node as HTMLElement;
        if (isVisible(el)) {
          // Tag element with dynamic identifier for robust backend callbacks
          el.setAttribute("data-uxray-id", String(currentId));

          // Clean text content (max 60 chars to save tokens)
          let rawText = el.tagName.toLowerCase() === "iframe" 
            ? `[IFRAME] ${el.getAttribute("title") || el.getAttribute("name") || "Embedded Content"}`
            : (el.innerText || el.getAttribute("value") || el.textContent || "");
          
          let cleanText = rawText.trim();
          if (cleanText.length > 60) {
            cleanText = cleanText.substring(0, 57) + "...";
          }

          list.push({
            id: currentId++,
            tag: el.tagName.toLowerCase(),
            type: el.getAttribute("type") || undefined,
            text: cleanText || undefined,
            placeholder: el.getAttribute("placeholder") || undefined,
            name: el.getAttribute("name") || el.id || undefined,
            role: el.getAttribute("role") || undefined
          });
        }
      });

      return list;
    });

    // Populate local cache map for executing actions
    this.elementsMap.clear();
    elements.forEach((el) => {
      this.elementsMap.set(el.id, { text: el.text || el.placeholder || el.name || el.tag });
    });

    return elements;
  }

  /**
   * Evaluates if the page is currently in a loading state.
   */
  async getPageState(): Promise<{ isLoaded: boolean; documentState: string; hasLoader: boolean }> {
    if (!this.page) return { isLoaded: true, documentState: "complete", hasLoader: false };
    
    return await this.page.evaluate(() => {
      const docState = document.readyState;
      
      // Look for common loading indicators (spinners, skeletons, progress bars)
      const loaderSelectors = [
        '[class*="spinner"]', '[class*="loader"]', '[class*="loading"]',
        '[role="progressbar"]', '[aria-busy="true"]',
        'svg.animate-spin'
      ];
      
      let hasLoader = false;
      for (const sel of loaderSelectors) {
        const el = document.querySelector(sel);
        if (el) {
          const style = window.getComputedStyle(el);
          if (style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0") {
            hasLoader = true;
            break;
          }
        }
      }
      
      return {
        isLoaded: docState === "complete" && !hasLoader,
        documentState: docState,
        hasLoader
      };
    });
  }

  /**
   * Helper to scroll element to center and retrieve fresh viewport-relative coordinates
   */
  private async getFreshCoordinates(id: number): Promise<{ x: number; y: number } | null> {
    if (!this.page) return null;
    return await this.page.evaluate((targetId) => {
      const el = document.querySelector(`[data-uxray-id="${targetId}"]`) as HTMLElement;
      if (el) {
        // Scroll element to center smoothly
        el.scrollIntoView({ block: "center", inline: "center" });
        const rect = el.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        };
      }
      return null;
    }, id);
  }

  async click(id: number): Promise<string> {
    if (!this.page) throw new Error("Browser not initialized.");
    
    // Get fresh coordinates after scroll-to-center
    const coords = await this.getFreshCoordinates(id);
    if (!coords) throw new Error(`Element with ID ${id} not found in DOM.`);

    const cached = this.elementsMap.get(id);

    // Perform exact click at coordinates
    await this.page.mouse.click(coords.x, coords.y);
    await this.page.waitForTimeout(1500);
    
    return cached?.text || "element clicked";
  }

  async type(id: number, text: string): Promise<string> {
    if (!this.page) throw new Error("Browser not initialized.");
    
    // Get fresh coordinates after scroll-to-center
    const coords = await this.getFreshCoordinates(id);
    if (!coords) throw new Error(`Element with ID ${id} not found in DOM.`);

    const cached = this.elementsMap.get(id);

    // Click input to focus
    await this.page.mouse.click(coords.x, coords.y);
    await this.page.waitForTimeout(200);
    
    // Select all and delete to clear existing text
    await this.page.keyboard.down("ControlOrMeta");
    await this.page.keyboard.press("a");
    await this.page.keyboard.up("ControlOrMeta");
    await this.page.keyboard.press("Backspace");

    await this.page.keyboard.type(text, { delay: 50 });
    await this.page.keyboard.press("Enter");
    await this.page.waitForTimeout(1000);
    
    return `${cached?.text || "input"} (typed: "${text}")`;
  }

  async scroll(): Promise<string> {
    if (!this.page) throw new Error("Browser not initialized.");
    await this.page.evaluate(() => {
      window.scrollBy({ top: 350, behavior: "smooth" });
    });
    await this.page.waitForTimeout(1000);
    return "page scrolled down";
  }

  async wait(seconds: number = 2): Promise<string> {
    if (!this.page) throw new Error("Browser not initialized.");
    await this.page.waitForTimeout(seconds * 1000);
    return `waited ${seconds} seconds`;
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
    } catch (e) {
      console.error("Playwright cleanup error:", e);
    }
  }
}
