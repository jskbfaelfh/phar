import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record a new purchase invoice from a supplier/warehouse into tenant schema
   */
  async createPurchase(tenantId: string, dto: CreatePurchaseDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || !tenant.schemaName) {
      throw new BadRequestException('الصيدلية غير متوفرة أو ليس لديها قاعدة بيانات مهيأة');
    }

    const schema = tenant.schemaName;
    const paidAmount = dto.paidAmount || 0;
    const remainingAmount = Math.max(0, dto.totalAmount - paidAmount);
    const invoiceDate = dto.invoiceDate ? new Date(dto.invoiceDate) : new Date();

    // 1. Insert Purchase Invoice Header
    const invoiceInsert = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(`
      INSERT INTO "${schema}"."purchase_invoices" (
        "invoice_number", "supplier_id", "supplier_name", "invoice_date",
        "total_amount", "paid_amount", "remaining_amount", "notes", "items_count"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      ) RETURNING id;
    `,
      dto.invoiceNumber,
      dto.supplierId || null,
      dto.supplierName || null,
      invoiceDate,
      dto.totalAmount,
      paidAmount,
      remainingAmount,
      dto.notes || null,
      dto.items.length
    );

    const invoiceId = invoiceInsert[0].id;

    // 2. Insert items and update inventory
    for (const item of dto.items) {
      const totalCost = item.quantityPacks * item.purchasePricePack;
      const expiryDate = new Date(item.expiryDate);
      const unitsPerPack = item.unitsPerPack || 1;
      const totalUnits = item.quantityPacks * unitsPerPack;
      const sellingPriceUnit = unitsPerPack > 0 ? item.sellingPricePack / unitsPerPack : item.sellingPricePack;

      // Insert Purchase Invoice Item
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO "${schema}"."purchase_invoice_items" (
          "purchase_invoice_id", "medicine_id", "trade_name", "scientific_name",
          "batch_number", "expiry_date", "quantity_packs", "units_per_pack",
          "purchase_price_pack", "selling_price_pack", "total_cost"
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        );
      `,
        invoiceId,
        item.medicineId,
        item.tradeName,
        item.scientificName || null,
        item.batchNumber || null,
        expiryDate,
        item.quantityPacks,
        unitsPerPack,
        item.purchasePricePack,
        item.sellingPricePack,
        totalCost
      );

      // Find or create InventoryItem
      let inventoryItem = (
        await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(`
          SELECT id FROM "${schema}"."inventory_items" WHERE "medicine_id" = $1 LIMIT 1;
        `, item.medicineId)
      )[0];

      if (!inventoryItem) {
        const createdInv = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(`
          INSERT INTO "${schema}"."inventory_items" (
            "medicine_id", "units_per_pack", "selling_price_pack", "selling_price_unit", "min_alert_units", "is_public_visible"
          ) VALUES (
            $1, $2, $3, $4, 5, true
          ) RETURNING id;
        `, item.medicineId, unitsPerPack, item.sellingPricePack, sellingPriceUnit);
        inventoryItem = createdInv[0];
      } else {
        // Update price
        await this.prisma.$executeRawUnsafe(`
          UPDATE "${schema}"."inventory_items"
          SET "selling_price_pack" = $1, "selling_price_unit" = $2, "updated_at" = CURRENT_TIMESTAMP
          WHERE "id" = $3;
        `, item.sellingPricePack, sellingPriceUnit, inventoryItem.id);
      }

      // Add Batch to Inventory
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO "${schema}"."inventory_batches" (
          "inventory_item_id", "batch_number", "purchase_price_pack", "quantity_units_remaining", "expiry_date"
        ) VALUES (
          $1, $2, $3, $4, $5
        );
      `,
        inventoryItem.id,
        item.batchNumber || null,
        item.purchasePricePack,
        totalUnits,
        expiryDate
      );
    }

    // 3. Update Supplier Ledger if supplier specified
    if (dto.supplierId) {
      await this.prisma.$executeRawUnsafe(`
        UPDATE "${schema}"."suppliers"
        SET "current_balance" = "current_balance" + $1, "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = $2;
      `, remainingAmount, dto.supplierId);

      await this.prisma.$executeRawUnsafe(`
        INSERT INTO "${schema}"."supplier_transactions" (
          "supplier_id", "type", "amount", "notes"
        ) VALUES (
          $1, 'INVOICE', $2, $3
        );
      `,
        dto.supplierId,
        dto.totalAmount,
        `فاتورة شراء رقم ${dto.invoiceNumber}`
      );

      if (paidAmount > 0) {
        await this.prisma.$executeRawUnsafe(`
          INSERT INTO "${schema}"."supplier_transactions" (
            "supplier_id", "type", "amount", "notes"
          ) VALUES (
            $1, 'PAYMENT', $2, $3
          );
        `,
          dto.supplierId,
          paidAmount,
          `دفعة مسددة عند استلام فاتورة ${dto.invoiceNumber}`
        );
      }
    }

    return {
      message: 'تم تسجيل فاتورة الشراء وتحديث المخزون بنجاح',
      invoiceId,
      invoiceNumber: dto.invoiceNumber,
      totalAmount: dto.totalAmount,
      itemsCount: dto.items.length,
    };
  }

  /**
   * Get all purchase invoices in tenant schema
   */
  async getPurchases(tenantId: string, search?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || !tenant.schemaName) return [];

    const schema = tenant.schemaName;
    let query = `
      SELECT 
        id,
        invoice_number as "invoiceNumber",
        supplier_id as "supplierId",
        supplier_name as "supplierName",
        invoice_date as "invoiceDate",
        total_amount as "totalAmount",
        paid_amount as "paidAmount",
        remaining_amount as "remainingAmount",
        notes,
        items_count as "itemsCount",
        created_at as "createdAt"
      FROM "${schema}"."purchase_invoices"
    `;

    if (search && search.trim()) {
      query += ` WHERE invoice_number ILIKE '%${search.trim()}%' OR supplier_name ILIKE '%${search.trim()}%'`;
    }

    query += ` ORDER BY invoice_date DESC, created_at DESC LIMIT 100;`;

    return this.prisma.$queryRawUnsafe(query);
  }

  /**
   * Get single purchase invoice with items
   */
  async getPurchaseById(tenantId: string, id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || !tenant.schemaName) {
      throw new NotFoundException('الصيدلية غير متوفرة');
    }

    const schema = tenant.schemaName;

    const invoices = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        id,
        invoice_number as "invoiceNumber",
        supplier_id as "supplierId",
        supplier_name as "supplierName",
        invoice_date as "invoiceDate",
        total_amount as "totalAmount",
        paid_amount as "paidAmount",
        remaining_amount as "remainingAmount",
        notes,
        items_count as "itemsCount",
        created_at as "createdAt"
      FROM "${schema}"."purchase_invoices"
      WHERE id = $1 LIMIT 1;
    `, id);

    if (!invoices || invoices.length === 0) {
      throw new NotFoundException('فاتورة الشراء غير موجودة');
    }

    const invoice = invoices[0];

    const items = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        id,
        medicine_id as "medicineId",
        trade_name as "tradeName",
        scientific_name as "scientificName",
        batch_number as "batchNumber",
        expiry_date as "expiryDate",
        quantity_packs as "quantityPacks",
        units_per_pack as "unitsPerPack",
        purchase_price_pack as "purchasePricePack",
        selling_price_pack as "sellingPricePack",
        total_cost as "totalCost"
      FROM "${schema}"."purchase_invoice_items"
      WHERE purchase_invoice_id = $1;
    `, id);

    return {
      ...invoice,
      items: items || [],
    };
  }
}
