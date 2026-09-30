
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function run() {
  let query = `
        SELECT schema_name
        FROM information_schema.schemata;
      `;
  try {
    const res: any = await prisma.$queryRawUnsafe(query);
    console.log("Schemas:", res);
  } catch (e: any) {
    console.error("Query Failed:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}
run();

