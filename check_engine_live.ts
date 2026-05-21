import { BrowserSimulator } from "./src/lib/playwright";

async function main() {
  const sim = new BrowserSimulator();
  console.log("Booting BrowserSimulator...");
  await sim.initialize();
  
  const targetUrl = "https://docs.google.com/forms/d/e/1FAIpQLScxIoFbhHsl7T01HfV1_e2pKt7E6WXv01Tk923c-HLwWWkLWw/viewform?usp=sharing&ouid=100886248847215272278";
  console.log(`Navigating to URL: ${targetUrl}`);
  await sim.navigate(targetUrl);
  
  console.log("Extracting interactable elements...");
  const elements = await sim.getInteractableElements();
  console.log(`FOUND ${elements.length} ELEMENTS:`);
  console.log(JSON.stringify(elements, null, 2));
  
  await sim.cleanup();
}

main().catch(console.error);
