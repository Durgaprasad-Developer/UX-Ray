"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrowserSimulator = void 0;
var playwright_1 = require("playwright");
var BrowserSimulator = /** @class */ (function () {
    function BrowserSimulator() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.elementsMap = new Map();
    }
    BrowserSimulator.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _a = this;
                        return [4 /*yield*/, playwright_1.chromium.launch({
                                headless: true,
                                args: ["--no-sandbox", "--disable-setuid-sandbox"],
                            })];
                    case 1:
                        _a.browser = _d.sent();
                        _b = this;
                        return [4 /*yield*/, this.browser.newContext({
                                viewport: { width: 1280, height: 800 },
                                userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                            })];
                    case 2:
                        _b.context = _d.sent();
                        _c = this;
                        return [4 /*yield*/, this.context.newPage()];
                    case 3:
                        _c.page = _d.sent();
                        return [4 /*yield*/, this.page.addInitScript(function () {
                                Object.defineProperty(navigator, "webdriver", { get: function () { return undefined; } });
                            })];
                    case 4:
                        _d.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    BrowserSimulator.prototype.navigate = function (url) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.page)
                            throw new Error("Browser not initialized.");
                        return [4 /*yield*/, this.page.goto(url, { waitUntil: "networkidle", timeout: 25000 })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    BrowserSimulator.prototype.getCurrentUrl = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                return [2 /*return*/, ((_a = this.page) === null || _a === void 0 ? void 0 : _a.url()) || ""];
            });
        });
    };
    // ── Core: Full page scan for queue-based planning ─────────────────────────
    BrowserSimulator.prototype.getPageScan = function () {
        return __awaiter(this, void 0, void 0, function () {
            var elements, groups, pageText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.page)
                            throw new Error("Browser not initialized.");
                        return [4 /*yield*/, this.getInteractableElements()];
                    case 1:
                        elements = _a.sent();
                        return [4 /*yield*/, this.page.evaluate(function () {
                                var forms = [];
                                var tabGroups = [];
                                var primaryCTAIds = [];
                                var navLinkIds = [];
                                var getId = function (el) {
                                    return el ? parseInt(el.getAttribute("data-uxray-id") || "-1") : -1;
                                };
                                var validId = function (id) { return id > 0; };
                                // ── Detect forms (explicit <form> tags)
                                document.querySelectorAll("form").forEach(function (form) {
                                    var inputEls = Array.from(form.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button]), textarea, select"));
                                    var inputIds = inputEls.map(getId).filter(validId);
                                    var submitEl = form.querySelector("button[type=submit], input[type=submit]") ||
                                        form.querySelector("button");
                                    var submitId = validId(getId(submitEl)) ? getId(submitEl) : null;
                                    // Get form purpose from legend, fieldset label, aria-label, or nearest heading
                                    var purposeEl = form.querySelector("legend, [aria-label], label") ||
                                        (form.closest("section, article, div") ? form.closest("section, article, div").querySelector("h1,h2,h3,h4") : null);
                                    var purposeText = "";
                                    if (purposeEl) {
                                        purposeText = purposeEl.textContent ? purposeEl.textContent.trim().slice(0, 60) : "";
                                    }
                                    var purpose = purposeText || "form";
                                    if (inputIds.length > 0) {
                                        forms.push({ purpose: purpose, inputIds: inputIds, submitId: submitId });
                                    }
                                });
                                // ── Detect tab groups (role=tablist or common tab patterns)
                                var tabContainers = document.querySelectorAll("[role=tablist], .tabs, .tab-list, .tab-group, .tab-bar");
                                tabContainers.forEach(function (container) {
                                    var _a, _b, _c;
                                    var tabEls = Array.from(container.querySelectorAll("[role=tab], .tab, button"));
                                    var tabIds = tabEls.map(getId).filter(validId);
                                    var purpose = container.getAttribute("aria-label") ||
                                        ((_c = (_b = (_a = container.closest("section, div")) === null || _a === void 0 ? void 0 : _a.querySelector("h1,h2,h3,h4,p")) === null || _b === void 0 ? void 0 : _b.textContent) === null || _c === void 0 ? void 0 : _c.trim().slice(0, 40)) ||
                                        "tab group";
                                    if (tabIds.length > 1) {
                                        tabGroups.push({ purpose: purpose, tabIds: tabIds });
                                    }
                                });
                                // ── Detect nav links (header/nav anchors)
                                document
                                    .querySelectorAll("nav a, header a, [role=navigation] a, footer a")
                                    .forEach(function (el) {
                                    var id = getId(el);
                                    if (validId(id))
                                        navLinkIds.push(id);
                                });
                                // ── Detect primary CTAs (large/prominent buttons not in forms)
                                document.querySelectorAll("button, [role=button]").forEach(function (el) {
                                    var _a;
                                    var id = getId(el);
                                    if (!validId(id))
                                        return;
                                    var rect = el.getBoundingClientRect();
                                    var area = rect.width * rect.height;
                                    var text = ((_a = el.textContent) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || "";
                                    var isPrimary = area > 3000 ||
                                        /get.?start|sign.?up|try|analyze|submit|continue|next|create|login|join|launch|run|start/i.test(text);
                                    if (isPrimary && !el.closest("form")) {
                                        primaryCTAIds.push(id);
                                    }
                                });
                                return { forms: forms, tabGroups: tabGroups, primaryCTAIds: primaryCTAIds, navLinkIds: navLinkIds };
                            })];
                    case 2:
                        groups = _a.sent();
                        return [4 /*yield*/, this.getPageText()];
                    case 3:
                        pageText = _a.sent();
                        return [2 /*return*/, {
                                elements: elements,
                                forms: groups.forms,
                                tabGroups: groups.tabGroups,
                                primaryCTAIds: groups.primaryCTAIds,
                                navLinkIds: groups.navLinkIds,
                                pageText: pageText,
                                currentUrl: this.page.url(),
                            }];
                }
            });
        });
    };
    // ── Core: All visible interactable elements with stable IDs ───────────────
    BrowserSimulator.prototype.getInteractableElements = function () {
        return __awaiter(this, void 0, void 0, function () {
            var elements;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.page)
                            throw new Error("Browser not initialized.");
                        return [4 /*yield*/, this.page.evaluate(function () {
                                var list = [];
                                var currentId = 1;
                                document.querySelectorAll("[data-uxray-id]").forEach(function (el) {
                                    el.removeAttribute("data-uxray-id");
                                });
                                function isVisible(el) {
                                    var rect = el.getBoundingClientRect();
                                    var style = window.getComputedStyle(el);
                                    var isInput = ["input", "textarea", "select"].includes(el.tagName.toLowerCase()) ||
                                        el.getAttribute("contenteditable") === "true" ||
                                        ["textbox", "checkbox", "radio"].includes(el.getAttribute("role") || "");
                                    var ok = rect.width > 0 &&
                                        rect.height > 0 &&
                                        style.visibility !== "hidden" &&
                                        style.display !== "none" &&
                                        style.opacity !== "0" &&
                                        (isInput || style.pointerEvents !== "none");
                                    if (!ok)
                                        return false;
                                    return rect.top < window.innerHeight && rect.bottom > 0 &&
                                        rect.left < window.innerWidth && rect.right > 0;
                                }
                                var selectors = [
                                    "a", "button", "input", "textarea", "select",
                                    "[role='button']", "[role='link']", "[role='textbox']",
                                    "[role='tab']", "[role='checkbox']", "[role='radio']",
                                    "[contenteditable='true']", "[onclick]",
                                ];
                                document.querySelectorAll(selectors.join(",")).forEach(function (node) {
                                    var el = node;
                                    if (!isVisible(el))
                                        return;
                                    el.setAttribute("data-uxray-id", String(currentId));
                                    var rawText = el.tagName === "IFRAME"
                                        ? "[IFRAME] ".concat(el.getAttribute("title") || "Embedded")
                                        : el.innerText || el.value || el.textContent || "";
                                    var text = rawText.trim().slice(0, 60);
                                    list.push({
                                        id: currentId++,
                                        tag: el.tagName.toLowerCase(),
                                        type: el.getAttribute("type") || undefined,
                                        text: text || undefined,
                                        placeholder: el.getAttribute("placeholder") || undefined,
                                        name: el.getAttribute("name") || el.id || undefined,
                                        role: el.getAttribute("role") || undefined,
                                    });
                                });
                                return list;
                            })];
                    case 1:
                        elements = _a.sent();
                        this.elementsMap.clear();
                        elements.forEach(function (el) {
                            _this.elementsMap.set(el.id, { text: el.text || el.placeholder || el.name || el.tag });
                        });
                        return [2 /*return*/, elements];
                }
            });
        });
    };
    // ── Page state detection ──────────────────────────────────────────────────
    BrowserSimulator.prototype.getPageState = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.page)
                            return [2 /*return*/, { isLoaded: true, documentState: "complete", hasLoader: false }];
                        return [4 /*yield*/, this.page.evaluate(function () {
                                var docState = document.readyState;
                                var loaderSelectors = [
                                    '[class*="spinner"]', '[class*="loader"]', '[class*="loading"]',
                                    '[role="progressbar"]', '[aria-busy="true"]',
                                    'svg.animate-spin', '[class*="animate-spin"]', '[class*="skeleton"]',
                                ];
                                var hasLoader = false;
                                for (var _i = 0, loaderSelectors_1 = loaderSelectors; _i < loaderSelectors_1.length; _i++) {
                                    var sel = loaderSelectors_1[_i];
                                    var el = document.querySelector(sel);
                                    if (el) {
                                        var s = window.getComputedStyle(el);
                                        if (s.display !== "none" && s.visibility !== "hidden" && s.opacity !== "0") {
                                            hasLoader = true;
                                            break;
                                        }
                                    }
                                }
                                if (!hasLoader) {
                                    var phrases = ["analyzing", "fetching", "generating", "processing", "loading", "please wait", "scanning"];
                                    var _loop_1 = function (node) {
                                        var el = node;
                                        var r = el.getBoundingClientRect();
                                        var s = window.getComputedStyle(el);
                                        if (r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.bottom > 0 &&
                                            s.display !== "none" && s.visibility !== "hidden") {
                                            var t_1 = (el.textContent || "").toLowerCase().trim();
                                            if (t_1.length < 120 && phrases.some(function (p) { return t_1.includes(p); })) {
                                                hasLoader = true;
                                                return "break";
                                            }
                                        }
                                    };
                                    for (var _a = 0, _b = Array.from(document.querySelectorAll("p,span,div,h1,h2,h3")); _a < _b.length; _a++) {
                                        var node = _b[_a];
                                        var state_1 = _loop_1(node);
                                        if (state_1 === "break")
                                            break;
                                    }
                                }
                                return { isLoaded: docState === "complete" && !hasLoader, documentState: docState, hasLoader: hasLoader };
                            })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    // ── Page text extraction ──────────────────────────────────────────────────
    BrowserSimulator.prototype.getPageText = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.page)
                            return [2 /*return*/, ""];
                        return [4 /*yield*/, this.page.evaluate(function () {
                                var p = [];
                                var title = document.title;
                                if (title)
                                    p.push("TITLE: ".concat(title));
                                var h1s = Array.from(document.querySelectorAll("h1")).map(function (h) { return h.textContent ? h.textContent.trim() : ""; }).filter(Boolean);
                                if (h1s.length)
                                    p.push("H1: ".concat(h1s.join(" | ")));
                                var h2s = Array.from(document.querySelectorAll("h2")).slice(0, 6).map(function (h) { return h.textContent ? h.textContent.trim() : ""; }).filter(Boolean);
                                if (h2s.length)
                                    p.push("H2: ".concat(h2s.join(" | ")));
                                var nav = Array.from(document.querySelectorAll("nav a, header a")).slice(0, 12).map(function (a) { return a.textContent ? a.textContent.trim() : ""; }).filter(Boolean);
                                if (nav.length)
                                    p.push("NAV: ".concat(nav.join(", ")));
                                var btns = Array.from(document.querySelectorAll("button, [role=button]")).slice(0, 8).map(function (b) { return b.textContent ? b.textContent.trim() : ""; }).filter(Boolean);
                                if (btns.length)
                                    p.push("BUTTONS: ".concat(btns.join(", ")));
                                var inputs = Array.from(document.querySelectorAll("input, textarea")).slice(0, 6).map(function (i) { var e = i; return e.placeholder || e.getAttribute("aria-label") || e.name || e.type; }).filter(Boolean);
                                if (inputs.length)
                                    p.push("INPUTS: ".concat(inputs.join(", ")));
                                p.push("CONTENT: ".concat((document.body.innerText || "").slice(0, 500).replace(/\s+/g, " ")));
                                return p.join("\n");
                            })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    // ── Actions ───────────────────────────────────────────────────────────────
    BrowserSimulator.prototype.getFreshCoords = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.page)
                            return [2 /*return*/, null];
                        return [4 /*yield*/, this.page.evaluate(function (targetId) {
                                var el = document.querySelector("[data-uxray-id=\"".concat(targetId, "\"]"));
                                if (!el)
                                    return null;
                                el.scrollIntoView({ block: "center", inline: "center" });
                                var rect = el.getBoundingClientRect();
                                return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
                            }, id)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    BrowserSimulator.prototype.click = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var coords;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.page)
                            throw new Error("Browser not initialized.");
                        return [4 /*yield*/, this.getFreshCoords(id)];
                    case 1:
                        coords = _b.sent();
                        if (!coords)
                            throw new Error("Element ".concat(id, " not found."));
                        return [4 /*yield*/, this.page.mouse.click(coords.x, coords.y)];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, this.page.waitForTimeout(1500)];
                    case 3:
                        _b.sent();
                        return [2 /*return*/, ((_a = this.elementsMap.get(id)) === null || _a === void 0 ? void 0 : _a.text) || "element clicked"];
                }
            });
        });
    };
    BrowserSimulator.prototype.type = function (id, text) {
        return __awaiter(this, void 0, void 0, function () {
            var coords;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.page)
                            throw new Error("Browser not initialized.");
                        return [4 /*yield*/, this.getFreshCoords(id)];
                    case 1:
                        coords = _b.sent();
                        if (!coords)
                            throw new Error("Element ".concat(id, " not found."));
                        return [4 /*yield*/, this.page.mouse.click(coords.x, coords.y)];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, this.page.waitForTimeout(150)];
                    case 3:
                        _b.sent();
                        return [4 /*yield*/, this.page.keyboard.down("ControlOrMeta")];
                    case 4:
                        _b.sent();
                        return [4 /*yield*/, this.page.keyboard.press("a")];
                    case 5:
                        _b.sent();
                        return [4 /*yield*/, this.page.keyboard.up("ControlOrMeta")];
                    case 6:
                        _b.sent();
                        return [4 /*yield*/, this.page.keyboard.press("Backspace")];
                    case 7:
                        _b.sent();
                        return [4 /*yield*/, this.page.keyboard.type(text, { delay: 40 })];
                    case 8:
                        _b.sent();
                        return [4 /*yield*/, this.page.waitForTimeout(500)];
                    case 9:
                        _b.sent();
                        return [2 /*return*/, "".concat(((_a = this.elementsMap.get(id)) === null || _a === void 0 ? void 0 : _a.text) || "input", " \u2190 \"").concat(text, "\"")];
                }
            });
        });
    };
    // Type without pressing Enter — for multi-field forms
    BrowserSimulator.prototype.typeOnly = function (id, text) {
        return __awaiter(this, void 0, void 0, function () {
            var coords;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.page)
                            throw new Error("Browser not initialized.");
                        return [4 /*yield*/, this.getFreshCoords(id)];
                    case 1:
                        coords = _b.sent();
                        if (!coords)
                            throw new Error("Element ".concat(id, " not found."));
                        return [4 /*yield*/, this.page.mouse.click(coords.x, coords.y)];
                    case 2:
                        _b.sent();
                        return [4 /*yield*/, this.page.waitForTimeout(150)];
                    case 3:
                        _b.sent();
                        return [4 /*yield*/, this.page.keyboard.down("ControlOrMeta")];
                    case 4:
                        _b.sent();
                        return [4 /*yield*/, this.page.keyboard.press("a")];
                    case 5:
                        _b.sent();
                        return [4 /*yield*/, this.page.keyboard.up("ControlOrMeta")];
                    case 6:
                        _b.sent();
                        return [4 /*yield*/, this.page.keyboard.press("Backspace")];
                    case 7:
                        _b.sent();
                        return [4 /*yield*/, this.page.keyboard.type(text, { delay: 40 })];
                    case 8:
                        _b.sent();
                        return [4 /*yield*/, this.page.waitForTimeout(300)];
                    case 9:
                        _b.sent();
                        return [2 /*return*/, "".concat(((_a = this.elementsMap.get(id)) === null || _a === void 0 ? void 0 : _a.text) || "input", " \u2190 \"").concat(text, "\"")];
                }
            });
        });
    };
    BrowserSimulator.prototype.scroll = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.page)
                            throw new Error("Browser not initialized.");
                        return [4 /*yield*/, this.page.evaluate(function () { return window.scrollBy({ top: 350, behavior: "smooth" }); })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.page.waitForTimeout(800)];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, "scrolled down"];
                }
            });
        });
    };
    BrowserSimulator.prototype.wait = function () {
        return __awaiter(this, arguments, void 0, function (maxSeconds) {
            var elapsed, wasLoading, state;
            if (maxSeconds === void 0) { maxSeconds = 30; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.page)
                            throw new Error("Browser not initialized.");
                        elapsed = 0;
                        wasLoading = false;
                        _a.label = 1;
                    case 1:
                        if (!(elapsed < maxSeconds)) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.getPageState()];
                    case 2:
                        state = _a.sent();
                        if (!!state.isLoaded) return [3 /*break*/, 4];
                        wasLoading = true;
                        return [4 /*yield*/, this.page.waitForTimeout(1000)];
                    case 3:
                        _a.sent();
                        elapsed++;
                        return [3 /*break*/, 1];
                    case 4: return [3 /*break*/, 5];
                    case 5:
                        if (wasLoading)
                            return [2 /*return*/, "waited ".concat(elapsed, "s for loading to complete")];
                        return [4 /*yield*/, this.page.waitForTimeout(1000)];
                    case 6:
                        _a.sent();
                        return [2 /*return*/, "waited 1s (page was ready)"];
                }
            });
        });
    };
    BrowserSimulator.prototype.screenshotBase64 = function () {
        return __awaiter(this, void 0, void 0, function () {
            var buffer;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.page)
                            throw new Error("Browser not initialized.");
                        return [4 /*yield*/, this.page.screenshot({ type: "png" })];
                    case 1:
                        buffer = _a.sent();
                        return [2 /*return*/, buffer.toString("base64")];
                }
            });
        });
    };
    BrowserSimulator.prototype.cleanup = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 7, , 8]);
                        if (!this.page) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.page.close()];
                    case 1:
                        _b.sent();
                        _b.label = 2;
                    case 2:
                        if (!this.context) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.context.close()];
                    case 3:
                        _b.sent();
                        _b.label = 4;
                    case 4:
                        if (!this.browser) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.browser.close()];
                    case 5:
                        _b.sent();
                        _b.label = 6;
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        _a = _b.sent();
                        return [3 /*break*/, 8];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    return BrowserSimulator;
}());
exports.BrowserSimulator = BrowserSimulator;
