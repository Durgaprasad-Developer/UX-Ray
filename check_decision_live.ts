import { BrowserSimulator } from "./src/lib/playwright";
import { getAgentDecision } from "./src/lib/ai";

async function main() {
  const sim = new BrowserSimulator();
  console.log("Booting BrowserSimulator...");
  await sim.initialize();
  
  const targetUrl = "https://docs.google.com/forms/d/e/1FAIpQLScxIoFbhHsl7T01HfV1_e2pKt7E6WXv01Tk923c-HLwWWkLWw/viewform?usp=sharing&ouid=100886248847215272278";
  console.log(`Navigating to URL: ${targetUrl}`);
  await sim.navigate(targetUrl);
  
  console.log("Extracting elements...");
  const elements = await sim.getInteractableElements();
  console.log(`FOUND ${elements.length} ELEMENTS.`);
  
  console.log("Calling getAgentDecision...");
  const decision = await getAgentDecision({
    url: targetUrl,
    description: "A clean Google Form with a Name question and a submit button.",
    prompt: "Fill in the Name text field with Durga Prasad and click Submit.",
    elements: elements,
    history: []
  });
  
  console.log("\n--- AI DECISION RESULT ---");
  console.log(JSON.stringify(decision, null, 2));
  
  await sim.cleanup();
}

main().catch(console.error);
