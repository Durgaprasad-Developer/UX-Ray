import { BrowserSimulator } from "../src/lib/playwright";
import { getAgentDecision, AppProfile } from "../src/lib/ai";

const url = process.argv[2] || "https://githubx-ray.vercel.app/";

async function main() {
  console.log(`🚀 Starting Test Harness for: ${url}`);
  const simulator = new BrowserSimulator();
  await simulator.initialize();
  await simulator.navigate(url);

  const history: Array<{ action: string; target?: string }> = [];
  const visitedUrls: string[] = [url];
  const appProfile: AppProfile = {
    appType: "Web App",
    primaryGoal: "Explore and test all interactive elements",
    sensitiveFields: [],
    testingPlan: "Test everything.",
    audiencePersona: "Tester",
    requiresAuth: false,
    navigationPages: [],
    expectedUserActions: []
  };

  let steps = 0;
  while (steps < 5) {
    steps++;
    console.log(`\n--- Step ${steps} ---`);
    const scan = await simulator.getPageScan();
    console.log(`Scan: ${scan.elements.length} elements, ${scan.forms.length} forms, ${scan.tabGroups.length} tabs`);

    try {
      const decision = await getAgentDecision({ scan, appProfile, history, visitedUrls });
      console.log(`💡 THOUGHT: ${decision.thought}`);
      const action = decision.action;
      console.log(`🏃 ACTION:`, action);

      if (action.type === "done") {
        console.log("Agent decided it is done.");
        break;
      }

      let elInfo = "";
      if ("elementId" in action && action.elementId) {
        const el = scan.elements.find(e => e.id === action.elementId);
        if (el) elInfo = el.placeholder || el.name || el.tag || String(action.elementId);
      }

      let targetText = "";
      if (action.type === "type" && "elementId" in action && "value" in action) {
        const val = await simulator.type(action.elementId, action.value);
        targetText = `[${elInfo}] <- "${val}"`;
      } else if (action.type === "click" && "elementId" in action) {
        targetText = `[${elInfo}] click`;
        await simulator.click(action.elementId);
      } else if (action.type === "wait") {
        targetText = "wait";
        await simulator.wait();
      }

      console.log(`✅ EXECUTED: ${targetText}`);
      history.push({ action: action.type, target: targetText });
      
      // Wait a moment for page updates
      await new Promise(r => setTimeout(r, 2000));
    } catch (err: any) {
      console.error(`❌ Error in step ${steps}:`, err.message);
    }
  }

  console.log("🏁 Test completed.");
}

main().catch(console.error);
