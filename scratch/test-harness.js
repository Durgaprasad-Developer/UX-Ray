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
var playwright_1 = require("../src/lib/playwright");
var ai_1 = require("../src/lib/ai");
var url = process.argv[2] || "https://githubx-ray.vercel.app/";
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var simulator, history, visitedUrls, appProfile, steps, _loop_1, state_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("\uD83D\uDE80 Starting Test Harness for: ".concat(url));
                    simulator = new playwright_1.BrowserSimulator();
                    return [4 /*yield*/, simulator.initialize()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, simulator.navigate(url)];
                case 2:
                    _a.sent();
                    history = [];
                    visitedUrls = [url];
                    appProfile = {
                        appType: "Web App",
                        primaryGoal: "Explore and test all interactive elements",
                        sensitiveFields: [],
                        testingPlan: "Test everything.",
                        audiencePersona: "Tester",
                        requiresAuth: false,
                        navigationPages: [],
                        expectedUserActions: []
                    };
                    steps = 0;
                    _loop_1 = function () {
                        var scan, annotatedScreenshot, decision, action_1, elInfo, el, targetText, val, err_1;
                        return __generator(this, function (_b) {
                            switch (_b.label) {
                                case 0:
                                    steps++;
                                    console.log("\n--- Step ".concat(steps, " ---"));
                                    return [4 /*yield*/, simulator.getPageScan()];
                                case 1:
                                    scan = _b.sent();
                                    console.log("Scan: ".concat(scan.elements.length, " elements, ").concat(scan.forms.length, " forms, ").concat(scan.tabGroups.length, " tabs"));
                                    _b.label = 2;
                                case 2:
                                    _b.trys.push([2, 12, , 13]);
                                    return [4 /*yield*/, simulator.getAnnotatedScreenshot()];
                                case 3:
                                    annotatedScreenshot = _b.sent();
                                    return [4 /*yield*/, (0, ai_1.getAgentDecision)({ scan: scan, appProfile: appProfile, history: history, visitedUrls: visitedUrls, annotatedScreenshot: annotatedScreenshot })];
                                case 4:
                                    decision = _b.sent();
                                    console.log("\uD83D\uDC40 OBSERVATION: ".concat(decision.observation));
                                    console.log("\uD83D\uDCA1 THOUGHT: ".concat(decision.thought));
                                    action_1 = decision.action;
                                    console.log("\uD83C\uDFC3 ACTION:", action_1);
                                    if (action_1.type === "done") {
                                        console.log("Agent decided it is done.");
                                        return [2 /*return*/, "break"];
                                    }
                                    elInfo = "";
                                    if ("elementId" in action_1 && action_1.elementId) {
                                        el = scan.elements.find(function (e) { return e.id === action_1.elementId; });
                                        if (el)
                                            elInfo = el.placeholder || el.name || el.tag || String(action_1.elementId);
                                    }
                                    targetText = "";
                                    if (!(action_1.type === "type" && "elementId" in action_1 && "value" in action_1)) return [3 /*break*/, 6];
                                    return [4 /*yield*/, simulator.type(action_1.elementId, action_1.value)];
                                case 5:
                                    val = _b.sent();
                                    targetText = "[".concat(elInfo, "] <- \"").concat(val, "\"");
                                    return [3 /*break*/, 10];
                                case 6:
                                    if (!(action_1.type === "click" && "elementId" in action_1)) return [3 /*break*/, 8];
                                    targetText = "[".concat(elInfo, "] click");
                                    return [4 /*yield*/, simulator.click(action_1.elementId)];
                                case 7:
                                    _b.sent();
                                    return [3 /*break*/, 10];
                                case 8:
                                    if (!(action_1.type === "wait")) return [3 /*break*/, 10];
                                    targetText = "wait";
                                    return [4 /*yield*/, simulator.wait()];
                                case 9:
                                    _b.sent();
                                    _b.label = 10;
                                case 10:
                                    console.log("\u2705 EXECUTED: ".concat(targetText));
                                    history.push({ action: action_1.type, target: targetText });
                                    // Wait a moment for page updates
                                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 2000); })];
                                case 11:
                                    // Wait a moment for page updates
                                    _b.sent();
                                    return [3 /*break*/, 13];
                                case 12:
                                    err_1 = _b.sent();
                                    console.error("\u274C Error in step ".concat(steps, ":"), err_1.message);
                                    return [3 /*break*/, 13];
                                case 13: return [2 /*return*/];
                            }
                        });
                    };
                    _a.label = 3;
                case 3:
                    if (!(steps < 5)) return [3 /*break*/, 5];
                    return [5 /*yield**/, _loop_1()];
                case 4:
                    state_1 = _a.sent();
                    if (state_1 === "break")
                        return [3 /*break*/, 5];
                    return [3 /*break*/, 3];
                case 5:
                    console.log("🏁 Test completed.");
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(console.error);
