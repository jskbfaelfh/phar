
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function run() {
  const schema = "ph_ph_fanyla_f662af";
  let query = `
        SELECT p.id as p_id, p.created_at as created_at
        FROM "${schema}"."purchases" p
        WHERE NOT EXISTS (SELECT 1 FROM "${schema}"."purchase_invoices" pi WHERE pi.id = p.id)
        ORDER BY p.created_at DESC LIMIT 5
      `;
  try {
    const res: any = await prisma.$queryRawUnsafe(query);
    console.log(res);
  } catch (e: any) {
    console.error("Query Failed:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}
run();

