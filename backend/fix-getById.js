
const fs = require("fs");
const path = require("path");
const filePath = "C:/Users/Dell/Desktop/دوائي/backend/src/modules/purchases/purchases.service.ts";
let content = fs.readFileSync(filePath, "utf-8");

const oldGetById = `    const invoices = await this.prisma.$queryRawUnsafe<any[]>(*
      SELECT 
        pi.id,
        pi.invoice_number as "invoiceNumber",
        pi.supplier_id as "supplierId",
        pi.supplier_name as "supplierName",
        pi.invoice_date as "invoiceDate",
        COALESCE(p.net_total_amount, pi.total_amount) as "totalAmount",
        COALESCE(p.paid_amount, pi.paid_amount) as "paidAmount",
        COALESCE(p.remaining_amount, pi.remaining_amount) as "remainingAmount",
        pi.notes,
        pi.items_count as "itemsCount",
        pi.early_discount_days as "earlyDiscountDays",
        pi.early_discount_percent as "earlyDiscountPercent",
        pi.early_discount_deadline as "earlyDiscountDeadline",
        pi.early_discount_amount as "earlyDiscountAmount",
        pi.early_discount_applied as "earlyDiscountApplied",
        pi.early_discount_applied_amount as "earlyDiscountAppliedAmount",
        pi.created_at as "createdAt"
      FROM "\${schema}"."purchase_invoices" pi
      LEFT JOIN "\${schema}"."purchases" p ON pi.id = p.id
      WHERE pi.id = $1::uuid;
    *, id);

    if (!invoices || invoices.length === 0) {
      throw new NotFoundException(*U?O OU^OOc O U,O*OO O OUSO U.U^OU^O_Oc*);
    }

    const invoice = invoices[0];

    const items = await this.prisma.$queryRawUnsafe<any[]>(*
      SELECT 
        pii.id,
        pii.medicine_id as "medicineId",
        pii.trade_name as "tradeName",
        pii.scientific_name as "scientificName",
        pii.batch_number as "batchNumber",
        pii.expiry_date as "expiryDate",
        pii.quantity_packs as "quantityPacks",
        pii.bonus_packs as "bonusPacks",
        pii.amortize_bonus as "amortizeBonus",
        pii.units_per_pack as "unitsPerPack",
        pii.purchase_price_pack as "purchasePricePack",
        pii.discount_percent as "discountPercent",
        pii.selling_price_pack as "sellingPricePack",
        pii.total_cost as "totalCost",
        ii.id as "inventoryItemId",
        ii.selling_price_unit as "sellingPriceUnit",
        ii.shelf_location as "shelfLocation"
      FROM "\${schema}"."purchase_invoice_items" pii
      LEFT JOIN "\${schema}"."inventory_items" ii ON ii.medicine_id = pii.medicine_id
      WHERE pii.purchase_invoice_id = $1::uuid
      ORDER BY pii.trade_name ASC;
    *, id);`.replace(/\*/g, "`");

const newGetById = `    let invoices = await this.prisma.$queryRawUnsafe<any[]>(*
      SELECT 
        pi.id,
        pi.invoice_number as "invoiceNumber",
        pi.supplier_id as "supplierId",
        pi.supplier_name as "supplierName",
        pi.invoice_date as "invoiceDate",
        COALESCE(p.net_total_amount, pi.total_amount) as "totalAmount",
        COALESCE(p.paid_amount, pi.paid_amount) as "paidAmount",
        COALESCE(p.remaining_amount, pi.remaining_amount) as "remainingAmount",
        pi.notes,
        pi.items_count as "itemsCount",
        pi.early_discount_days as "earlyDiscountDays",
        pi.early_discount_percent as "earlyDiscountPercent",
        pi.early_discount_deadline as "earlyDiscountDeadline",
        pi.early_discount_amount as "earlyDiscountAmount",
        pi.early_discount_applied as "earlyDiscountApplied",
        pi.early_discount_applied_amount as "earlyDiscountAppliedAmount",
        pi.created_at as "createdAt"
      FROM "\${schema}"."purchase_invoices" pi
      LEFT JOIN "\${schema}"."purchases" p ON pi.id = p.id
      WHERE pi.id = $1::uuid;
    *, id);

    if (!invoices || invoices.length === 0) {
      invoices = await this.prisma.$queryRawUnsafe<any[]>(*
        SELECT 
          p.id,
          p.invoice_number as "invoiceNumber",
          p.supplier_id as "supplierId",
          p.supplier_name as "supplierName",
          p.created_at as "invoiceDate",
          p.net_total_amount as "totalAmount",
          p.paid_amount as "paidAmount",
          p.remaining_amount as "remainingAmount",
          p.notes,
          (SELECT COUNT(*)::int FROM "\${schema}"."inventory_batches" WHERE purchase_id = p.id) as "itemsCount",
          NULL as "earlyDiscountDays",
          NULL as "earlyDiscountPercent",
          NULL as "earlyDiscountDeadline",
          NULL as "earlyDiscountAmount",
          NULL as "earlyDiscountApplied",
          NULL as "earlyDiscountAppliedAmount",
          p.created_at as "createdAt"
        FROM "\${schema}"."purchases" p
        WHERE p.id = $1::uuid;
      *, id);
    }

    if (!invoices || invoices.length === 0) {
      throw new NotFoundException("Invoice not found");
    }

    const invoice = invoices[0];

    let items = await this.prisma.$queryRawUnsafe<any[]>(*
      SELECT 
        pii.id,
        pii.medicine_id as "medicineId",
        pii.trade_name as "tradeName",
        pii.scientific_name as "scientificName",
        pii.batch_number as "batchNumber",
        pii.expiry_date as "expiryDate",
        pii.quantity_packs as "quantityPacks",
        pii.bonus_packs as "bonusPacks",
        pii.amortize_bonus as "amortizeBonus",
        pii.units_per_pack as "unitsPerPack",
        pii.purchase_price_pack as "purchasePricePack",
        pii.discount_percent as "discountPercent",
        pii.selling_price_pack as "sellingPricePack",
        pii.total_cost as "totalCost",
        ii.id as "inventoryItemId",
        ii.selling_price_unit as "sellingPriceUnit",
        ii.shelf_location as "shelfLocation"
      FROM "\${schema}"."purchase_invoice_items" pii
      LEFT JOIN "\${schema}"."inventory_items" ii ON ii.medicine_id = pii.medicine_id
      WHERE pii.purchase_invoice_id = $1::uuid
      ORDER BY pii.trade_name ASC;
    *, id);

    if (!items || items.length === 0) {
      items = await this.prisma.$queryRawUnsafe<any[]>(*
        SELECT 
          pii.id,
          ii.medicine_id as "medicineId",
          ii.custom_name as "tradeName",
          * * as "scientificName",
          pii.batch_number as "batchNumber",
          pii.expiry_date as "expiryDate",
          pii.quantity_packs as "quantityPacks",
          pii.bonus_packs as "bonusPacks",
          pii.amortize_bonus as "amortizeBonus",
          pii.units_per_pack as "unitsPerPack",
          pii.purchase_price_pack as "purchasePricePack",
          pii.discount_percent as "discountPercent",
          pii.selling_price_pack as "sellingPricePack",
          (pii.quantity_packs * pii.net_cost_pack) as "totalCost",
          ii.id as "inventoryItemId",
          ii.selling_price_unit as "sellingPriceUnit",
          ii.shelf_location as "shelfLocation"
        FROM "\${schema}"."purchase_items" pii
        JOIN "\${schema}"."inventory_items" ii ON ii.id = pii.inventory_item_id
        WHERE pii.purchase_id = $1::uuid
        ORDER BY ii.custom_name ASC;
      *, id);
    }`.replace(/\*/g, "`");

const idx = content.indexOf(`const invoices = await this.prisma.$queryRawUnsafe<any[]>`);
if (idx !== -1) {
    const endIdx = content.indexOf(`const batches = await this.prisma.$queryRawUnsafe<any[]>`);
    if (endIdx !== -1) {
        content = content.substring(0, idx) + newGetById + "\n\n    " + content.substring(endIdx);
        fs.writeFileSync(filePath, content, "utf-8");
        console.log("Replaced successfully!");
    }
}

