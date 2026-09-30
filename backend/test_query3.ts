
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function run() {
  const schema = "ph_ph_fanyla_f662af";
  let query = `
        SELECT 
          COALESCE(pi.id, p.id) as id,
          COALESCE(pi.invoice_number, p.invoice_number) as "invoiceNumber",
          COALESCE(pi.supplier_id, p.supplier_id) as "supplierId",
          COALESCE(pi.supplier_name, p.supplier_name) as "supplierName",
          COALESCE(pi.invoice_date, p.created_at) as "invoiceDate",
          COALESCE(p.net_total_amount, pi.total_amount) as "totalAmount",
          COALESCE(p.paid_amount, pi.paid_amount) as "paidAmount",
          COALESCE(p.remaining_amount, pi.remaining_amount) as "remainingAmount",
          COALESCE(pi.notes, p.notes) as notes,
          COALESCE(pi.items_count, (SELECT COUNT(*)::int FROM "${schema}"."inventory_batches" WHERE purchase_id = COALESCE(pi.id, p.id))) as "itemsCount",
          pi.early_discount_days as "earlyDiscountDays",
          pi.early_discount_percent as "earlyDiscountPercent",
          pi.early_discount_deadline as "earlyDiscountDeadline",
          pi.early_discount_amount as "earlyDiscountAmount",
          pi.early_discount_applied as "earlyDiscountApplied",
          pi.early_discount_applied_amount as "earlyDiscountAppliedAmount",
          COALESCE(pi.created_at, p.created_at) as "createdAt"
        FROM "${schema}"."purchases" p
        FULL OUTER JOIN "${schema}"."purchase_invoices" pi ON p.id = pi.id
        ORDER BY COALESCE(pi.created_at, p.created_at) DESC LIMIT 10;
      `;
  try {
    const res: any = await prisma.$queryRawUnsafe(query);
    console.log(JSON.stringify(res, null, 2));
  } catch (e: any) {
    console.error("Query Failed:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}
run();

