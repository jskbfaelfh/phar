
const fs = require("fs");
const filePath = "C:/Users/Dell/Desktop/دوائي/backend/src/modules/purchases/purchases.service.ts";
let content = fs.readFileSync(filePath, "utf-8");

// 1. Add `let isBulkEntry = false;` to the fallback logic
const fallbackRegex = /let existingInvoices = await tx\.\$queryRawUnsafe<any\[\]>\([\s\S]*?if \(\!existingInvoices \|\| existingInvoices\.length === 0\) \{/m;
content = content.replace(fallbackRegex, `let isBulkEntry = false;\n        let existingInvoices = await tx.$queryRawUnsafe<any[]>(!
          SELECT * FROM "\${schema}"."purchase_invoices"
          WHERE id = $1::uuid
          FOR UPDATE;
        !, purchaseId);\n\n        if (!existingInvoices || existingInvoices.length === 0) {\n          isBulkEntry = true;`.replace(/!/g, "`"));

// 2. Add the isBulkEntry INSERT branch before the UPDATE
const updateInvoiceRegex = /await tx\.\$executeRawUnsafe\(`\s*UPDATE "\$\{schema\}"\."purchase_invoices"[\s\S]*?purchaseId\s*\);/m;
const updateInvoiceMatch = content.match(updateInvoiceRegex);

if (updateInvoiceMatch) {
    const replacement = `if (isBulkEntry) {
            await tx.$executeRawUnsafe(\`
              INSERT INTO "\${schema}"."purchase_invoices" (
                "id", "invoice_number", "supplier_id", "supplier_name", "invoice_date",
                "total_amount", "paid_amount", "remaining_amount", "notes", "items_count"
              ) VALUES (
                $1::uuid, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10
              );
            \`,
              purchaseId,
              invoiceNumber,
              finalSupplierId,
              resolvedSupplierName,
              invoiceDate,
              totalAmount,
              paidAmount,
              remainingAmount,
              dto.notes !== undefined ? dto.notes : existingInvoice.notes,
              dto.items.length
            );
          } else {
            ${updateInvoiceMatch[0]}
          }`;
    content = content.replace(updateInvoiceRegex, replacement);
    fs.writeFileSync(filePath, content, "utf-8");
    console.log("Successfully patched updatePurchase");
} else {
    console.log("Could not find updateInvoiceRegex");
}

