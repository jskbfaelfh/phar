
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function run() {
  const schema = "ph_ph_fanyla_f662af";
  let query = `
        SELECT p.id as p_id, pi.id as pi_id
        FROM "${schema}"."purchases" p
        FULL OUTER JOIN "${schema}"."purchase_invoices" pi ON p.id = pi.id
      `;
  try {
    const res: any = await prisma.$queryRawUnsafe(query);
    console.log(res.length);
    console.log(res);
  } catch (e: any) {
    console.error("Query Failed:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}
run();

