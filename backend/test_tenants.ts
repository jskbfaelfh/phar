
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function run() {
  let query = `
        SELECT id, schema_name
        FROM public."Tenant";
      `;
  try {
    const res: any = await prisma.$queryRawUnsafe(query);
    console.log("Tenants:");
    console.log(res);
  } catch (e: any) {
    console.error("Query Failed:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}
run();

