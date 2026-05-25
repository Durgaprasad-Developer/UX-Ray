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
exports.inferSmartTypingValue = inferSmartTypingValue;
exports.recognizeApp = recognizeApp;
exports.getAgentDecision = getAgentDecision;
exports.generateUXReport = generateUXReport;
exports.generateChecklistReport = generateChecklistReport;
exports.scoreExperience = scoreExperience;
var generative_ai_1 = require("@google/generative-ai");
var GEMINI_KEY = process.env.GEMINI_API_KEY || "";
var NVIDIA_KEY = process.env.NVIDIA_API_KEY || "";
var ai = new generative_ai_1.GoogleGenerativeAI(GEMINI_KEY);
// ── Helpers ───────────────────────────────────────────────────────────────────
function extractJSON(text) {
    var c = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    var s = c.indexOf("{"), e = c.lastIndexOf("}");
    return s !== -1 && e > s ? c.slice(s, e + 1) : c;
}
function extractArray(text) {
    var c = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    var s = c.indexOf("["), e = c.lastIndexOf("]");
    if (s !== -1 && e > s)
        return c.slice(s, e + 1);
    try {
        var os = c.indexOf("{"), oe = c.lastIndexOf("}");
        if (os !== -1 && oe > os) {
            var arr = Object.values(JSON.parse(c.slice(os, oe + 1))).find(Array.isArray);
            if (arr)
                return JSON.stringify(arr);
        }
    }
    catch (_a) { }
    return "[]";
}
// ── Smart typing values ───────────────────────────────────────────────────────
function inferSmartTypingValue(el, url, appProfile) {
    var hint = [el.placeholder || "", el.name || "", el.text || "", el.type || ""].join(" ").toLowerCase();
    if (/github|username|handle/.test(hint) || /github/.test(url))
        return "torvalds";
    if (/email|e-mail/.test(hint) || el.type === "email")
        return "tester@example.com";
    if (/password|passwd/.test(hint) || el.type === "password")
        return "TestPass123!";
    if (/search|query|find|keyword/.test(hint) || el.type === "search") {
        var at = ((appProfile === null || appProfile === void 0 ? void 0 : appProfile.appType) || "").toLowerCase();
        if (/job|career/.test(at))
            return "software engineer";
        if (/ecomm|product|shop/.test(at))
            return "laptop";
        return "example";
    }
    if (/name/.test(hint))
        return "Alex Turner";
    if (/phone|tel/.test(hint) || el.type === "tel")
        return "555-123-4567";
    if (/url|website/.test(hint) || el.type === "url")
        return "https://example.com";
    if (el.type === "number")
        return "1";
    return "hello";
}
// ── NVIDIA caller (primary for all decisions) ─────────────────────────────────
function callNvidia(system_1, user_1) {
    return __awaiter(this, arguments, void 0, function (system, user, maxTokens) {
        var models, last, _i, models_1, model, res, data, text, e_1;
        var _a, _b, _c, _d, _e, _f;
        if (maxTokens === void 0) { maxTokens = 700; }
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    if (!NVIDIA_KEY)
                        throw new Error("NVIDIA_API_KEY not set");
                    models = ["meta/llama-3.3-70b-instruct", "meta/llama-3.1-8b-instruct", "meta/llama-3.2-3b-instruct"];
                    _i = 0, models_1 = models;
                    _g.label = 1;
                case 1:
                    if (!(_i < models_1.length)) return [3 /*break*/, 9];
                    model = models_1[_i];
                    _g.label = 2;
                case 2:
                    _g.trys.push([2, 7, , 8]);
                    return [4 /*yield*/, fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
                            method: "POST",
                            headers: { Authorization: "Bearer ".concat(NVIDIA_KEY), "Content-Type": "application/json" },
                            body: JSON.stringify({
                                model: model,
                                messages: [{ role: "system", content: system }, { role: "user", content: user }],
                                max_tokens: maxTokens,
                                temperature: 0.2,
                            }),
                        })];
                case 3:
                    res = _g.sent();
                    if (!(res.status === 429)) return [3 /*break*/, 5];
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 1500); })];
                case 4:
                    _g.sent();
                    return [3 /*break*/, 8];
                case 5:
                    if (!res.ok)
                        throw new Error("HTTP ".concat(res.status));
                    return [4 /*yield*/, res.json()];
                case 6:
                    data = _g.sent();
                    text = (_d = (_c = (_b = (_a = data.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) === null || _d === void 0 ? void 0 : _d.trim();
                    if (!text)
                        throw new Error("empty");
                    console.log("[NVIDIA] OK: ".concat(model, " (").concat(maxTokens, " max)"));
                    return [2 /*return*/, text];
                case 7:
                    e_1 = _g.sent();
                    if (!((_e = e_1.message) === null || _e === void 0 ? void 0 : _e.includes("429")))
                        console.warn("[NVIDIA] ".concat(model, ": ").concat((_f = e_1.message) === null || _f === void 0 ? void 0 : _f.slice(0, 50)));
                    last = e_1;
                    return [3 /*break*/, 8];
                case 8:
                    _i++;
                    return [3 /*break*/, 1];
                case 9: throw last;
            }
        });
    });
}
// ── Gemini multimodal (screenshots only, for UX report) ──────────────────────
function callGeminiMultimodal(parts, system) {
    return __awaiter(this, void 0, void 0, function () {
        var _i, _a, model, m, r, text, e_2;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    if (!GEMINI_KEY)
                        throw new Error("no GEMINI_API_KEY");
                    _i = 0, _a = ["gemini-2.0-flash", "gemini-1.5-flash"];
                    _d.label = 1;
                case 1:
                    if (!(_i < _a.length)) return [3 /*break*/, 6];
                    model = _a[_i];
                    _d.label = 2;
                case 2:
                    _d.trys.push([2, 4, , 5]);
                    m = ai.getGenerativeModel({ model: model, systemInstruction: system, generationConfig: { responseMimeType: "application/json" } });
                    return [4 /*yield*/, m.generateContent(parts)];
                case 3:
                    r = _d.sent();
                    text = (_b = r.response.text()) === null || _b === void 0 ? void 0 : _b.trim();
                    if (text)
                        return [2 /*return*/, text];
                    return [3 /*break*/, 5];
                case 4:
                    e_2 = _d.sent();
                    console.warn("[Gemini] ".concat(model, ": ").concat((e_2 === null || e_2 === void 0 ? void 0 : e_2.status) || ((_c = e_2 === null || e_2 === void 0 ? void 0 : e_2.message) === null || _c === void 0 ? void 0 : _c.slice(0, 40))));
                    return [3 /*break*/, 5];
                case 5:
                    _i++;
                    return [3 /*break*/, 1];
                case 6: throw new Error("Gemini unavailable");
            }
        });
    });
}
// ── 1. App Recognizer ─────────────────────────────────────────────────────────
function recognizeApp(params) {
    return __awaiter(this, void 0, void 0, function () {
        var url, description, pageText, system, user, _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    url = params.url, description = params.description, pageText = params.pageText;
                    system = "You are a senior UX researcher. Analyze this web app and return ONLY JSON:\n{\n  \"appType\": \"<specific type: github-analyzer|saas-landing|ecommerce|developer-tool|portfolio|job-board|form-tool|waitlist>\",\n  \"primaryGoal\": \"<what a real user opens this to accomplish>\",\n  \"expectedUserActions\": [\"<step 1>\",\"<step 2>\",\"<step 3>\"],\n  \"sensitiveFields\": [\"<github_username|email|search_query|etc>\"],\n  \"testingPlan\": \"<2-3 sentence systematic plan covering all pages and key flows to test>\",\n  \"audiencePersona\": \"<who uses this, specific>\",\n  \"requiresAuth\": <true|false>,\n  \"navigationPages\": [\"<page 1>\",\"<page 2>\",\"<all pages in nav>\"]\n}";
                    user = "URL: ".concat(url, "\nDescription: ").concat(description, "\n\nLive page content:\n").concat(pageText);
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 3, , 4]);
                    _b = (_a = JSON).parse;
                    _c = extractJSON;
                    return [4 /*yield*/, callNvidia(system, user, 500)];
                case 2: return [2 /*return*/, _b.apply(_a, [_c.apply(void 0, [_e.sent()])])];
                case 3:
                    _d = _e.sent();
                    return [2 /*return*/, {
                            appType: "web-application",
                            primaryGoal: "Explore the site and try the main feature",
                            expectedUserActions: ["read landing page", "find main CTA", "try core feature"],
                            sensitiveFields: ["text_input"],
                            testingPlan: "Visit every page in navigation. Fill every form. Try every button. Test the core feature end-to-end.",
                            audiencePersona: "general users",
                            requiresAuth: false,
                            navigationPages: ["homepage"],
                        }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// ── 2. Deep Agentic Loop ────────────────────────────────────────────────────────
// Called at every step. The agent observes the LIVE page state, checks history, and picks the SINGLE next best action.
function getAgentDecision(params) {
    return __awaiter(this, void 0, void 0, function () {
        var scan, appProfile, history, visitedUrls, formsText, tabsText, historyText, elements, system, user, text, result_1, el, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    scan = params.scan, appProfile = params.appProfile, history = params.history, visitedUrls = params.visitedUrls;
                    formsText = scan.forms.length > 0
                        ? scan.forms.map(function (f, i) { return "Form ".concat(i + 1, " (").concat(f.purpose, "): inputs=").concat(JSON.stringify(f.inputIds), ", submit=").concat(f.submitId); }).join("\n")
                        : "No forms detected";
                    tabsText = scan.tabGroups.length > 0
                        ? scan.tabGroups.map(function (t) { return "TabGroup (".concat(t.purpose, "): tabIds=").concat(JSON.stringify(t.tabIds)); }).join("\n")
                        : "No tab groups detected";
                    historyText = history.slice(-12).map(function (h) { return "[".concat(h.action, "] ").concat(h.target || "—"); }).join("\n") || "No prior actions";
                    elements = scan.elements.slice(0, 40);
                    system = "You are an autonomous AI QA Agent testing a web app. You act exactly like a meticulous senior developer doing a deep-dive QA session.\nYou observe the screen, think about what needs testing, and take ONE ACTION at a time.\n\nApp: ".concat(appProfile.appType, " | Audience: ").concat(appProfile.audiencePersona, "\nGoal: ").concat(appProfile.primaryGoal, "\n\nCURRENT PAGE: ").concat(scan.currentUrl, "\n").concat(scan.pageText.slice(0, 400), "\n\nPAGE STRUCTURE:\n").concat(formsText, "\n").concat(tabsText, "\nAll visible interactable elements (id, tag, text/placeholder/type):\n").concat(JSON.stringify(elements.map(function (e) { var _a, _b; return ({ id: e.id, tag: e.tag, t: ((_a = e.text) === null || _a === void 0 ? void 0 : _a.slice(0, 40)) || ((_b = e.placeholder) === null || _b === void 0 ? void 0 : _b.slice(0, 40)) || e.type }); })), "\n\nRECENT HISTORY (What you just did):\n").concat(historyText, "\n\nVisited URLs: ").concat(visitedUrls.join(", ") || "none", "\n\nRULES FOR DEEP TESTING:\n1. STRICT SEQUENCE: If you just filled a form input (type action), your very next action MUST be to click the corresponding submit button or CTA. Do NOT type another value into the same input.\n2. If you just clicked a submit button or CTA, your next action MUST be \"wait\" to let the backend process and the UI update.\n3. If you see a tab group you haven't clicked yet, click one of the unvisited tabs to test its content.\n4. If you see inputs, fill them with realistic data ONCE.\n5. STRICT ANTI-LOOP: You MUST NOT repeat an action on the same element you see in your RECENT HISTORY. If you find yourself doing the same thing, choose \"navigate\" (click a nav link) or return \"done\".\n6. Return ONLY JSON.\n\nReturn format:\n{\n  \"thought\": \"<1 sentence reasoning why you are doing this>\",\n  \"action\": { \"type\": \"type\"|\"click\"|\"wait\"|\"scroll\"|\"done\", \"elementId\": <number>, \"value\": \"<if type>\", \"purpose\": \"<short label>\" }\n}\nFor \"done\", action should be: { \"type\": \"done\", \"summary\": \"<reason>\" }");
                    user = "Observe the state and history. Decide the single best next action. Return JSON.";
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, callNvidia(system, user, 600)];
                case 2:
                    text = _a.sent();
                    result_1 = JSON.parse(extractJSON(text));
                    if (!result_1.action || !result_1.action.type)
                        throw new Error("invalid schema");
                    // If the agent hallucinated a value for a type action but it's empty, try to fix it
                    if (result_1.action.type === "type" && result_1.action.elementId) {
                        el = scan.elements.find(function (e) { return e.id === result_1.action.elementId; });
                        if (el && (!result_1.action.value || result_1.action.value === "")) {
                            result_1.action.value = inferSmartTypingValue(el, scan.currentUrl, appProfile);
                        }
                    }
                    return [2 /*return*/, result_1];
                case 3:
                    err_1 = _a.sent();
                    console.warn("[Agent] Failed, returning fallback done:", err_1);
                    return [2 /*return*/, { thought: "Error communicating with intelligence engine.", action: { type: "done", summary: "API failure" } }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// ── 3. UX Report ──────────────────────────────────────────────────────────────
function generateUXReport(params) {
    return __awaiter(this, void 0, void 0, function () {
        var url, description, appProfile, timeline, screenshots, timelineText, appCtx, system, user, parts_1, _a, _b, _c, _d, _e, _f, _g, err_2;
        return __generator(this, function (_h) {
            switch (_h.label) {
                case 0:
                    url = params.url, description = params.description, appProfile = params.appProfile, timeline = params.timeline, screenshots = params.screenshots;
                    timelineText = timeline.slice(0, 15).map(function (t) {
                        return "[".concat(t.timestamp, "s] ").concat(t.action, ": ").concat((t.target || "").slice(0, 60));
                    }).join("\n");
                    appCtx = appProfile
                        ? "Type: ".concat(appProfile.appType, " | Audience: ").concat(appProfile.audiencePersona, " | Goal: ").concat(appProfile.primaryGoal)
                        : description;
                    system = "You are a simulation of 1000 real first-time users testing a startup's web app before it is published. You are providing honest, specific feedback directly to the developer based on their actual product.\n\n".concat(appCtx, " | URL: ").concat(url, "\n\nIMPORTANT \u2014 This is a UX analysis of the WEBSITE. Do not penalize the website if the simulation bot clicked the wrong thing or encountered automation errors. Filter out automation noise and focus strictly on the app's actual design quality, clarity, flows, and feature completeness.\n\nThink like a developer reviewing user sessions. What do they need to fix before launching to 1000 users? Be specific \u2014 reference real UI elements, copy, and flows you observed.\n\nInclude in behaviourPatterns: what users naturally try to do (even things the app doesn't support yet, based on your intuition of the product).\nInclude in featureSuggestions: 2-3 features users clearly want based on their behaviour.\n\nReturn ONLY this JSON:\n{\n  \"summary\": \"<2-3 sentence honest verdict as a representative for 1000 users>\",\n  \"whatWorkedWell\": [\"<specific strength with exact UI context>\",\"<another>\",\"<another>\"],\n  \"frictionPoints\": [\"<specific pain point real users would feel>\",\"<another>\",\"<another>\"],\n  \"improvements\": [\"<general area to improve>\",\"<another>\"],\n  \"behaviourPatterns\": [\"<observed pattern>\",\"<pattern>\"],\n  \"featureSuggestions\": [\"<feature users clearly want>\",\"<another>\"]\n}");
                    user = "Test timeline:\n".concat(timelineText, "\n\nAnalyze the site's UX quality and return the report JSON.");
                    _h.label = 1;
                case 1:
                    _h.trys.push([1, 3, , 4]);
                    parts_1 = [user + "\n\nScreenshots:"];
                    screenshots.forEach(function (s) { return parts_1.push({ inlineData: { mimeType: "image/png", data: s.base64 } }); });
                    _b = (_a = JSON).parse;
                    _c = extractJSON;
                    return [4 /*yield*/, callGeminiMultimodal(parts_1, system)];
                case 2: return [2 /*return*/, _b.apply(_a, [_c.apply(void 0, [_h.sent()])])];
                case 3:
                    _d = _h.sent();
                    console.warn("[UXReport] Gemini failed, trying NVIDIA");
                    return [3 /*break*/, 4];
                case 4:
                    _h.trys.push([4, 6, , 7]);
                    _f = (_e = JSON).parse;
                    _g = extractJSON;
                    return [4 /*yield*/, callNvidia(system, user, 600)];
                case 5: return [2 /*return*/, _f.apply(_e, [_g.apply(void 0, [_h.sent()])])];
                case 6:
                    err_2 = _h.sent();
                    console.warn("[UXReport] Both failed:", err_2);
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/, {
                        summary: "The simulation ran and interacted with the site. Review the session replay for detailed interaction logs.",
                        whatWorkedWell: ["The page loaded and responded to interactions"],
                        frictionPoints: ["Unable to generate detailed analysis — check API configuration"],
                        improvements: ["Ensure NVIDIA_API_KEY and GEMINI_API_KEY are valid"],
                        behaviourPatterns: [],
                        featureSuggestions: [],
                    }];
            }
        });
    });
}
// ── 4. Checklist ──────────────────────────────────────────────────────────────
function generateChecklistReport(params) {
    return __awaiter(this, void 0, void 0, function () {
        var url, appProfile, uxSummary, frictionPoints, timeline, system, user, _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    url = params.url, appProfile = params.appProfile, uxSummary = params.uxSummary, frictionPoints = params.frictionPoints, timeline = params.timeline;
                    system = "You are a startup technical advisor giving a dev-ready prioritized fix list. Be brutally specific \u2014 name exact UI elements to change, not vague advice.\n\nReturn ONLY a JSON array of 6-8 items:\n[{\"priority\":\"critical\"|\"high\"|\"medium\",\"effort\":\"5min\"|\"1hour\"|\"1day\",\"area\":\"<First Impression|Onboarding|Navigation|Copy|Performance|Trust|Feature|Accessibility>\",\"fix\":\"<exact actionable instruction naming the specific element>\",\"impact\":\"<why this matters to real users, 1 sentence>\"}]";
                    user = "App: ".concat(appProfile.appType, " at ").concat(url, "\nAudience: ").concat(appProfile.audiencePersona, "\nVerdict: \"").concat(uxSummary, "\"\nFriction found: ").concat(frictionPoints.map(function (f, i) { return "".concat(i + 1, ". ").concat(f); }).join("\n"), "\nActions taken: ").concat(timeline.length, " total interactions\n\nGenerate the prioritized checklist array.");
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 3, , 4]);
                    _b = (_a = JSON).parse;
                    _c = extractArray;
                    return [4 /*yield*/, callNvidia(system, user, 800)];
                case 2: return [2 /*return*/, _b.apply(_a, [_c.apply(void 0, [_e.sent()])])];
                case 3:
                    _d = _e.sent();
                    return [2 /*return*/, []];
                case 4: return [2 /*return*/];
            }
        });
    });
}
// ── 5. Experience Scorer ──────────────────────────────────────────────────────
function scoreExperience(params) {
    return __awaiter(this, void 0, void 0, function () {
        var url, appProfile, uxSummary, whatWorkedWell, frictionPoints, checklistItems, totalSteps, totalDuration, criticals, system, user, _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    url = params.url, appProfile = params.appProfile, uxSummary = params.uxSummary, whatWorkedWell = params.whatWorkedWell, frictionPoints = params.frictionPoints, checklistItems = params.checklistItems, totalSteps = params.totalSteps, totalDuration = params.totalDuration;
                    criticals = checklistItems.filter(function (c) { return c.priority === "critical"; }).length;
                    system = "You are scoring a startup's web app UX based on what 1000 real first-time users would experience.\nCalibration: most new startups score 40-65. Above 75 = genuinely polished. Above 85 = exceptional.\nScore based on the SITE QUALITY, not simulation execution.\n\nReturn ONLY JSON:\n{\"overall\":<0-100>,\"clarity\":<0-100>,\"navigation\":<0-100>,\"speed\":<0-100>,\"trust\":<0-100>,\"delight\":<0-100>,\"verdict\":\"<2-3 sentence honest review as if you just used it>\",\"readyToShip\":<true if overall>=65 and criticals=0>}";
                    user = "".concat(appProfile.appType, " at ").concat(url, " | ").concat(appProfile.audiencePersona, "\n").concat(totalSteps, " interactions over ").concat(totalDuration, "s | ").concat(criticals, " critical issues\nSummary: \"").concat(uxSummary, "\"\nStrengths: ").concat(whatWorkedWell.join("; "), "\nFriction: ").concat(frictionPoints.join("; "));
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 3, , 4]);
                    _b = (_a = JSON).parse;
                    _c = extractJSON;
                    return [4 /*yield*/, callNvidia(system, user, 350)];
                case 2: return [2 /*return*/, _b.apply(_a, [_c.apply(void 0, [_e.sent()])])];
                case 3:
                    _d = _e.sent();
                    return [2 /*return*/, { overall: 50, clarity: 50, navigation: 50, speed: 50, trust: 50, delight: 30, verdict: "Simulation completed. Manual review recommended.", readyToShip: false }];
                case 4: return [2 /*return*/];
            }
        });
    });
}
