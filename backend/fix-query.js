
const fs = require("fs");
const path = require("path");
const filePath = "C:/Users/Dell/Desktop/دوائي/backend/src/modules/purchases/purchases.service.ts";
let content = fs.readFileSync(filePath, "utf-8");

const oldQueryRegex = /let query = `[\s\S]*?LEFT JOIN "\$\{schema\}"\."purchases" p ON pi\.id = p\.id\s*`;/;

const newQuery = `let query = \`
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
          COALESCE(pi.items_count, (SELECT COUNT(*)::int FROM "\${schema}"."inventory_batches" WHERE purchase_id = COALESCE(pi.id, p.id))) as "itemsCount",
          pi.early_discount_days as "earlyDiscountDays",
          pi.early_discount_percent as "earlyDiscountPercent",
          pi.early_discount_deadline as "earlyDiscountDeadline",
          pi.early_discount_amount as "earlyDiscountAmount",
          pi.early_discount_applied as "earlyDiscountApplied",
          pi.early_discount_applied_amount as "earlyDiscountAppliedAmount",
          COALESCE(pi.created_at, p.created_at) as "createdAt"
        FROM "\${schema}"."purchases" p
        FULL OUTER JOIN "\${schema}"."purchase_invoices" pi ON p.id = pi.id
      \`;`;

if (content.match(oldQueryRegex)) {
  content = content.replace(oldQueryRegex, newQuery);
  // We also need to fix the WHERE clause since pi might be null
  content = content.replace(
    /query \+= ` WHERE pi\.invoice_number ILIKE \$1 OR pi\.supplier_name ILIKE \$1`;/g,
    "query += ` WHERE COALESCE(pi.invoice_number, p.invoice_number) ILIKE $1 OR COALESCE(pi.supplier_name, p.supplier_name) ILIKE $1`;"
  );
  content = content.replace(
    /query \+= ` ORDER BY pi\.created_at DESC LIMIT 100;`;/g,
    "query += ` ORDER BY COALESCE(pi.created_at, p.created_at) DESC LIMIT 100;`;"
  );
  fs.writeFileSync(filePath, content, "utf-8");
  console.log("Query Update Complete");
} else {
  console.log("Regex did not match!");
}

