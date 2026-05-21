const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const session = await prisma.session.findFirst({
    orderBy: { createdAt: "desc" },
    include: { events: true }
  });

  if (!session) {
    console.log("No sessions found.");
    return;
  }

  console.log("SESSION ID:", session.id);
  console.log("URL:", session.url);
  console.log("STATUS:", session.status);
  console.log("EVENTS COUNT:", session.events.length);
  
  session.events.forEach(e => {
    console.log(`[${e.timestamp}s] Action: ${e.action} | Target: ${e.target} | Reasoning: ${e.reasoning}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
