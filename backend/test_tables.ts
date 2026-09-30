
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function run() {
  const schema = "tenant_3f44db43-33fd-4f5b-8efc-de61fc63fb76";
  let query = `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1;
      `;
  try {
    const res: any = await prisma.$queryRawUnsafe(query, schema);
    console.log("Tables:");
    console.log(res);
  } catch (e: any) {
    console.error("Query Failed:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}
run();

