import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { MedicinesService } from '../medicines/medicines.service';
import {
  BulkStockEntryDto,
  UpdateItemPriceDto,
  CreateSupplierDto,
  UpdateSupplierDto,
  RecordSupplierPaymentDto,
} from './dto/bulk-stock-entry.dto';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);
  private static readonly verifiedSchemas = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly medicinesService: MedicinesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Helper to ensure suppliers & purchases tables & custom_name column exist in the tenant schema
   * Runs only ONCE per schema to eliminate massive DDL round-trip latency on subsequent calls.
   */
  private async ensurePurchaseTablesExist(schemaName: string) {
    if (InventoryService.verifiedSchemas.has(schemaName)) {
      return;
    }

    try {
      const ddl = `
        ALTER TABLE "${schemaName}".inventory_items ADD COLUMN IF NOT EXISTS custom_name VARCHAR(255);
        CREATE TABLE IF NOT EXISTS "${schemaName}".suppliers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          phone VARCHAR(50),
          address TEXT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS "${schemaName}".purchases (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          invoice_number VARCHAR(100),
          supplier_id UUID,
          supplier_name VARCHAR(255),
          total_gross_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
          total_discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
          net_total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
          paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
          remaining_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
          payment_status VARCHAR(20) NOT NULL DEFAULT 'PAID',
          due_date DATE,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS "idx_${schemaName}_purchases_dt" ON "${schemaName}".purchases (created_at);
        CREATE TABLE IF NOT EXISTS "${schemaName}".purchase_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          purchase_id UUID,
          inventory_item_id UUID,
          quantity_packs INT NOT NULL,
          bonus_packs INT NOT NULL DEFAULT 0,
          units_per_pack INT NOT NULL DEFAULT 1,
          purchase_price_pack DECIMAL(12, 2) NOT NULL,
          discount_percent DECIMAL(5, 2) NOT NULL DEFAULT 0,
          net_cost_pack DECIMAL(12, 2) NOT NULL,
          selling_price_pack DECIMAL(12, 2) NOT NULL,
          selling_price_unit DECIMAL(12, 2) NOT NULL,
          expiry_date DATE,
          batch_number VARCHAR(100)
        );
        CREATE TABLE IF NOT EXISTS "${schemaName}".supplier_payments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          supplier_id UUID,
          purchase_id UUID,
          amount DECIMAL(12, 2) NOT NULL,
          payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
          payment_method VARCHAR(50) DEFAULT 'CASH',
          receipt_number VARCHAR(100),
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS "idx_${schemaName}_supp_pay_dt" ON "${schemaName}".supplier_payments (created_at);
      `;

      await this.prisma.$executeRawUnsafe(ddl);
      InventoryService.verifiedSchemas.add(schemaName);
    } catch (err: any) {
      this.logger.warn(`Could not verify purchase tables for ${schemaName}: ${err.message}`);
    }
  }

  /**
   * Get suppliers debt overview metrics
   */
  async getSuppliersSummary() {
    const schemaName = this.tenantContext.getSchemaName();
    await this.ensurePurchaseTablesExist(schemaName);

    const sql = `
      SELECT 
        COUNT(DISTINCT s.id)::int as "suppliersCount",
        COUNT(DISTINCT CASE WHEN p.remaining_amount > 0 THEN s.id END)::int as "indebtedSuppliersCount",
        COALESCE(SUM(p.net_total_amount), 0)::numeric as "totalPurchasedAmount",
        COALESCE(SUM(p.paid_amount), 0)::numeric as "totalPaidAmount",
        COALESCE(SUM(p.remaining_amount), 0)::numeric as "totalRemainingDebt"
      FROM "${schemaName}".suppliers s
      LEFT JOIN "${schemaName}".purchases p ON s.id = p.supplier_id;
    `;

    const res: any[] = await this.prisma.$queryRawUnsafe(sql);
    const row = res[0] || {};

    return {
      suppliersCount: Number(row.suppliersCount || 0),
      indebtedSuppliersCount: Number(row.indebtedSuppliersCount || 0),
      totalPurchasedAmount: Number(row.totalPurchasedAmount || 0),
      totalPaidAmount: Number(row.totalPaidAmount || 0),
      totalRemainingDebt: Number(row.totalRemainingDebt || 0),
    };
  }

  /**
   * Get all suppliers with aggregated debts and purchase totals
   */
  async getSuppliers() {
    const schemaName = this.tenantContext.getSchemaName();
    await this.ensurePurchaseTablesExist(schemaName);

    const sql = `
      SELECT 
        s.id,
        s.name,
        s.phone,
        s.address,
        s.notes,
        s.created_at as "createdAt",
        COUNT(p.id)::int as "invoicesCount",
        COALESCE(SUM(p.net_total_amount), 0)::numeric as "totalPurchasedAmount",
        COALESCE(SUM(p.paid_amount), 0)::numeric as "totalPaidAmount",
        COALESCE(SUM(p.remaining_amount), 0)::numeric as "totalRemainingDebt",
        MAX(p.created_at) as "lastPurchaseDate",
        MIN(CASE WHEN p.remaining_amount > 0 THEN p.due_date END) as "nextDueDate"
      FROM "${schemaName}".suppliers s
      LEFT JOIN "${schemaName}".purchases p ON s.id = p.supplier_id
      GROUP BY s.id
      ORDER BY COALESCE(SUM(p.remaining_amount), 0) DESC, s.name ASC;
    `;

    const suppliers: any[] = await this.prisma.$queryRawUnsafe(sql);
    return suppliers;
  }

  /**
   * Create new supplier
   */
  async createSupplier(dto: CreateSupplierDto) {
    const schemaName = this.tenantContext.getSchemaName();
    await this.ensurePurchaseTablesExist(schemaName);

    const cleanName = dto.name.trim();
    const existing: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id FROM "${schemaName}".suppliers WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      cleanName,
    );

    if (existing.length > 0) {
      throw new BadRequestException('اسم المذخر مسجل مسبقاً في الصيدلية');
    }

    const supplierId = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "${schemaName}".suppliers (id, name, phone, address, notes, created_at)
       VALUES ($1::uuid, $2, $3, $4, $5, NOW())`,
      supplierId,
      cleanName,
      dto.phone || null,
      dto.address || null,
      dto.notes || null,
    );

    return {
      success: true,
      message: `تم إضافة مذخر (${cleanName}) بنجاح`,
      supplier: {
        id: supplierId,
        name: cleanName,
        phone: dto.phone,
        address: dto.address,
        notes: dto.notes,
      },
    };
  }

  /**
   * Update supplier details
   */
  async updateSupplier(id: string, dto: UpdateSupplierDto) {
    const schemaName = this.tenantContext.getSchemaName();
    await this.ensurePurchaseTablesExist(schemaName);

    const existing: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id FROM "${schemaName}".suppliers WHERE id = $1::uuid LIMIT 1`,
      id,
    );

    if (existing.length === 0) {
      throw new NotFoundException('المذخر غير موجود');
    }

    await this.prisma.$executeRawUnsafe(
      `UPDATE "${schemaName}".suppliers
       SET name = COALESCE($1, name),
           phone = $2,
           address = $3,
           notes = $4
       WHERE id = $5::uuid`,
      dto.name ? dto.name.trim() : null,
      dto.phone !== undefined ? dto.phone : null,
      dto.address !== undefined ? dto.address : null,
      dto.notes !== undefined ? dto.notes : null,
      id,
    );

    return {
      success: true,
      message: 'تم تحديث بيانات المذخر بنجاح',
    };
  }

  /**
   * Get detailed account statement (Ledger) for a specific supplier
   */
  async getSupplierLedger(supplierId: string) {
    const schemaName = this.tenantContext.getSchemaName();
    await this.ensurePurchaseTablesExist(schemaName);

    // 1. Get supplier
    const supRows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id, name, phone, address, notes, created_at as "createdAt"
       FROM "${schemaName}".suppliers WHERE id = $1::uuid LIMIT 1`,
      supplierId,
    );

    if (supRows.length === 0) {
      throw new NotFoundException('المذخر غير موجود');
    }

    const supplier = supRows[0];

    // 2. Get all purchase invoices for this supplier
    const invoices: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT 
        p.id,
        p.invoice_number as "invoiceNumber",
        p.total_gross_amount as "totalGrossAmount",
        p.total_discount_amount as "totalDiscountAmount",
        p.net_total_amount as "netTotalAmount",
        p.paid_amount as "paidAmount",
        p.remaining_amount as "remainingAmount",
        p.payment_status as "paymentStatus",
        p.due_date as "dueDate",
        p.notes,
        p.created_at as "createdAt",
        COUNT(pi.id)::int as "itemsCount"
      FROM "${schemaName}".purchases p
      LEFT JOIN "${schemaName}".purchase_items pi ON p.id = pi.purchase_id
      WHERE p.supplier_id = $1::uuid
      GROUP BY p.id
      ORDER BY p.created_at DESC;`,
      supplierId,
    );

    // 3. Get all payment vouchers made to this supplier
    const payments: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT 
        id,
        purchase_id as "purchaseId",
        amount,
        payment_date as "paymentDate",
        payment_method as "paymentMethod",
        receipt_number as "receiptNumber",
        notes,
        created_at as "createdAt"
      FROM "${schemaName}".supplier_payments
      WHERE supplier_id = $1::uuid
      ORDER BY payment_date DESC, created_at DESC;`,
      supplierId,
    );

    // Totals
    const totalPurchased = invoices.reduce((sum, i) => sum + Number(i.netTotalAmount || 0), 0);
    const totalPaid = invoices.reduce((sum, i) => sum + Number(i.paidAmount || 0), 0);
    const totalDebt = invoices.reduce((sum, i) => sum + Number(i.remainingAmount || 0), 0);

    return {
      supplier,
      summary: {
        totalPurchased,
        totalPaid,
        totalDebt,
        invoicesCount: invoices.length,
        paymentsCount: payments.length,
      },
      invoices,
      payments,
    };
  }

  /**
   * Record debt payment installment to a supplier
   */
  async recordSupplierPayment(supplierId: string, dto: RecordSupplierPaymentDto) {
    const schemaName = this.tenantContext.getSchemaName();
    await this.ensurePurchaseTablesExist(schemaName);

    // 1. Verify supplier
    const supRows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id, name FROM "${schemaName}".suppliers WHERE id = $1::uuid LIMIT 1`,
      supplierId,
    );

    if (supRows.length === 0) {
      throw new NotFoundException('المذخر غير موجود');
    }

    const supplier = supRows[0];
    const payAmount = Number(dto.amount);

    if (payAmount <= 0) {
      throw new BadRequestException('مبلغ الدفعة يجب أن يكون أكبر من صفر');
    }

    // 2. Insert Payment Voucher Record
    const paymentId = crypto.randomUUID();
    const payDate = dto.paymentDate || new Date().toISOString().slice(0, 10);

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "${schemaName}".supplier_payments
       (id, supplier_id, amount, payment_date, payment_method, receipt_number, notes, created_at)
       VALUES ($1::uuid, $2::uuid, $3, $4::date, $5, $6, $7, NOW())`,
      paymentId,
      supplierId,
      payAmount,
      payDate,
      dto.paymentMethod || 'CASH',
      dto.receiptNumber || null,
      dto.notes || null,
    );

    // 3. Deduct payment from unpaid purchases using FIFO
    const unpaidPurchases: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id, net_total_amount, paid_amount, remaining_amount
       FROM "${schemaName}".purchases
       WHERE supplier_id = $1::uuid AND remaining_amount > 0
       ORDER BY created_at ASC;`,
      supplierId,
    );

    let remainingToDeduct = payAmount;

    for (const p of unpaidPurchases) {
      if (remainingToDeduct <= 0) break;

      const pRemaining = Number(p.remaining_amount);
      const deductFromThis = Math.min(remainingToDeduct, pRemaining);

      const newPaid = Number(p.paid_amount) + deductFromThis;
      const newRemaining = pRemaining - deductFromThis;
      const newStatus = newRemaining === 0 ? 'PAID' : 'PARTIAL';

      await this.prisma.$executeRawUnsafe(
        `UPDATE "${schemaName}".purchases
         SET paid_amount = $1,
             remaining_amount = $2,
             payment_status = $3
         WHERE id = $4::uuid`,
        newPaid,
        newRemaining,
        newStatus,
        p.id,
      );

      remainingToDeduct -= deductFromThis;
    }

    this.logger.log(
      `Payment voucher of ${payAmount} IQD recorded for supplier ${supplier.name} in schema ${schemaName}`,
    );

    return {
      success: true,
      message: `تم توثيق تسديد دفعة بمبلغ (${payAmount.toLocaleString()} د.ع) لمذخر (${supplier.name}) بنجاح`,
      paymentId,
    };
  }

  /**
   * Create or find supplier by name
   */
  async upsertSupplier(name: string, phone?: string) {
    const schemaName = this.tenantContext.getSchemaName();
    await this.ensurePurchaseTablesExist(schemaName);

    const cleanName = name.trim();
    const existing: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id FROM "${schemaName}".suppliers WHERE LOWER(name) = LOWER($1) LIMIT 1`,
      cleanName,
    );

    if (existing.length > 0) {
      return existing[0].id;
    }

    const supplierId = crypto.randomUUID();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "${schemaName}".suppliers (id, name, phone, created_at)
       VALUES ($1::uuid, $2, $3, NOW())`,
      supplierId,
      cleanName,
      phone || null,
    );

    return supplierId;
  }

  /**
   * Get accurate inventory counts summary for stats cards
   */
  async getInventorySummary() {
    const schemaName = this.tenantContext.getSchemaName();
    await this.ensurePurchaseTablesExist(schemaName);

    const [totalRes, lowStockRes, expRes] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(
        `SELECT COUNT(id)::int as count FROM "${schemaName}".inventory_items;`,
      ),
      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT COUNT(*)::int as count FROM (
          SELECT i.id
          FROM "${schemaName}".inventory_items i
          LEFT JOIN "${schemaName}".inventory_batches b ON i.id = b.inventory_item_id
          GROUP BY i.id, i.min_alert_units
          HAVING COALESCE(SUM(b.quantity_units_remaining), 0) <= i.min_alert_units
        ) sub;
      `),
      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT COUNT(id)::int as count
        FROM "${schemaName}".inventory_batches
        WHERE quantity_units_remaining > 0 
          AND expiry_date <= (CURRENT_DATE + interval '3 months');
      `),
    ]);

    return {
      totalMedicines: totalRes[0]?.count || 0,
      lowStockCount: lowStockRes[0]?.count || 0,
      expiringSoonCount: expRes[0]?.count || 0,
    };
  }

  /**
   * Process Bulk Stock Entry (New shipment / invoice of medicines with bonus, discount & supplier debt)
   */
  async bulkStockEntry(dto: BulkStockEntryDto) {
    const schemaName = this.tenantContext.getSchemaName();
    const tenantId = this.tenantContext.getTenantId();

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('يجب إضافة مادة واحدة على الأقل في الوجبة');
    }

    await this.ensurePurchaseTablesExist(schemaName);

    // 1. Resolve Supplier
    let finalSupplierId: string | null = dto.supplierId || null;
    if (!finalSupplierId && dto.supplierName && dto.supplierName.trim().length > 0) {
      finalSupplierId = await this.upsertSupplier(dto.supplierName, dto.supplierPhone);
    }

    const processedMedicineIds: string[] = [];
    const purchaseId = crypto.randomUUID();

    let invoiceGrossTotal = 0;
    let invoiceDiscountTotal = 0;
    let invoiceNetTotal = 0;

    const purchaseItemsToInsert: any[] = [];

    // Process each item in the invoice
    for (const item of dto.items) {
      let finalMedicineId = item.medicineId;

      // 1.1 If item is a new medicine not in catalog -> create in Master DB
      if (!finalMedicineId && item.newMedicineData) {
        const createdMed = await this.medicinesService.create({
          ...item.newMedicineData,
          defaultUnitsPerPack: item.unitsPerPack,
          isVerified: false,
        });
        finalMedicineId = createdMed.id;
      }

      if (!finalMedicineId) {
        throw new BadRequestException('معرف الدواء غير محدد');
      }

      processedMedicineIds.push(finalMedicineId);

      // 1.2 Financial & Bonus calculations
      const qtyPacks = Number(item.quantityPacks || 1);
      const bonusPacks = Number(item.bonusPacks || 0);
      const totalPacksReceived = qtyPacks + bonusPacks;
      const discountPercent = Number(item.discountPercent || 0);
      const purchasePricePack = Number(item.purchasePricePack || 0);

      const lineGrossCost = qtyPacks * purchasePricePack;
      const lineDiscountAmount = lineGrossCost * (discountPercent / 100);
      const lineNetTotal = lineGrossCost - lineDiscountAmount;
      const effectiveNetCostPerPack = totalPacksReceived > 0 ? lineNetTotal / totalPacksReceived : purchasePricePack;

      invoiceGrossTotal += lineGrossCost;
      invoiceDiscountTotal += lineDiscountAmount;
      invoiceNetTotal += lineNetTotal;

      // 1.3 Format Expiry Date: YYYY-MM-01
      const expiryDateStr = `${item.expiryYear}-${String(item.expiryMonth).padStart(2, '0')}-01`;

      // 1.4 Upsert Inventory Item in Tenant Schema
      const existingItems: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT id FROM "${schemaName}".inventory_items WHERE medicine_id = $1::uuid LIMIT 1`,
        finalMedicineId,
      );

      let inventoryItemId: string;

      if (existingItems.length > 0) {
        inventoryItemId = existingItems[0].id;
        // Update custom_name, selling prices and units per pack
        await this.prisma.$executeRawUnsafe(
          `UPDATE "${schemaName}".inventory_items
           SET custom_name = COALESCE($1, custom_name),
               units_per_pack = $2,
               selling_price_pack = $3,
               selling_price_unit = $4,
               min_alert_units = COALESCE($5, min_alert_units),
               updated_at = NOW()
           WHERE id = $6::uuid`,
          item.customName || null,
          item.unitsPerPack,
          item.sellingPricePack,
          item.sellingPriceUnit,
          item.minAlertUnits || 5,
          inventoryItemId,
        );
      } else {
        inventoryItemId = crypto.randomUUID();
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO "${schemaName}".inventory_items
           (id, medicine_id, custom_name, units_per_pack, selling_price_pack, selling_price_unit, min_alert_units, created_at, updated_at)
           VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, NOW(), NOW())`,
          inventoryItemId,
          finalMedicineId,
          item.customName || null,
          item.unitsPerPack,
          item.sellingPricePack,
          item.sellingPriceUnit,
          item.minAlertUnits || 5,
        );
      }

      // 1.5 Insert Batch Record into Tenant Schema (Includes Quantity + Bonus!)
      const totalUnits = totalPacksReceived * item.unitsPerPack;
      const batchId = crypto.randomUUID();

      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "${schemaName}".inventory_batches
         (id, inventory_item_id, batch_number, purchase_price_pack, quantity_units_remaining, expiry_date, created_at)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::date, NOW())`,
        batchId,
        inventoryItemId,
        item.batchNumber || null,
        Math.round(effectiveNetCostPerPack),
        totalUnits,
        expiryDateStr,
      );

      purchaseItemsToInsert.push({
        id: crypto.randomUUID(),
        purchaseId,
        inventoryItemId,
        quantityPacks: qtyPacks,
        bonusPacks,
        unitsPerPack: item.unitsPerPack,
        purchasePricePack,
        discountPercent,
        netCostPack: effectiveNetCostPerPack,
        sellingPricePack: item.sellingPricePack,
        sellingPriceUnit: item.sellingPriceUnit,
        expiryDate: expiryDateStr,
        batchNumber: item.batchNumber || null,
      });
    }

    // 2. Determine Payment amounts
    const paymentStatus = dto.paymentStatus || 'PAID';
    let paidAmount = Number(dto.paidAmount !== undefined ? dto.paidAmount : invoiceNetTotal);
    if (paymentStatus === 'PAID') {
      paidAmount = invoiceNetTotal;
    } else if (paymentStatus === 'UNPAID') {
      paidAmount = 0;
    }
    const remainingAmount = Math.max(0, invoiceNetTotal - paidAmount);

    // 3. Record Purchase Header
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "${schemaName}".purchases
       (id, invoice_number, supplier_id, supplier_name, total_gross_amount, total_discount_amount, net_total_amount, paid_amount, remaining_amount, payment_status, due_date, notes, created_at)
       VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11::date, $12, NOW())`,
      purchaseId,
      dto.supplierInvoiceNumber || null,
      finalSupplierId,
      dto.supplierName || null,
      invoiceGrossTotal,
      invoiceDiscountTotal,
      invoiceNetTotal,
      paidAmount,
      remainingAmount,
      paymentStatus,
      dto.dueDate || null,
      dto.notes || null,
    );

    // 4. Record Purchase Line Items
    for (const pi of purchaseItemsToInsert) {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "${schemaName}".purchase_items
         (id, purchase_id, inventory_item_id, quantity_packs, bonus_packs, units_per_pack, purchase_price_pack, discount_percent, net_cost_pack, selling_price_pack, selling_price_unit, expiry_date, batch_number)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11, $12::date, $13)`,
        pi.id,
        pi.purchaseId,
        pi.inventoryItemId,
        pi.quantityPacks,
        pi.bonusPacks,
        pi.unitsPerPack,
        pi.purchasePricePack,
        pi.discountPercent,
        pi.netCostPack,
        pi.sellingPricePack,
        pi.sellingPriceUnit,
        pi.expiryDate,
        pi.batchNumber,
      );
    }

    // 5. Emit stock sync event to update CentralSearchIndex in background
    this.eventEmitter.emit('inventory.synced', {
      tenantId,
      schemaName,
      medicineIds: processedMedicineIds,
    });

    this.logger.log(
      `Bulk stock entry saved for tenant "${tenantId}". Purchase ID: ${purchaseId}. Total items: ${dto.items.length}`,
    );

    return {
      success: true,
      purchaseId,
      message: `تم اعتماد وحفظ فاتورة المشتريات بنجاح (${dto.items.length} مادة)`,
      invoiceSummary: {
        totalGross: invoiceGrossTotal,
        totalDiscount: invoiceDiscountTotal,
        netTotal: invoiceNetTotal,
        paidAmount,
        remainingAmount,
        paymentStatus,
      },
    };
  }

  /**
   * Get all pharmacy inventory items with master info, custom alias name, and calculated stock
   */
  async getPharmacyInventory(query?: { search?: string }) {
    const schemaName = this.tenantContext.getSchemaName();
    await this.ensurePurchaseTablesExist(schemaName);

    let searchFilter = '';
    const params: any[] = [];

    if (query?.search && query.search.trim().length > 0) {
      params.push(`%${query.search.trim()}%`);
      searchFilter = `AND (m.trade_name ILIKE $1 OR m.scientific_name ILIKE $1 OR m.barcode ILIKE $1 OR i.custom_name ILIKE $1)`;
    }

    const sql = `
      SELECT 
        i.id,
        i.medicine_id as "medicineId",
        i.custom_name as "customName",
        i.units_per_pack as "unitsPerPack",
        i.selling_price_pack as "sellingPricePack",
        i.selling_price_unit as "sellingPriceUnit",
        i.min_alert_units as "minAlertUnits",
        i.updated_at as "updatedAt",
        m.trade_name as "tradeName",
        m.scientific_name as "scientificName",
        m.dosage_form as "dosageForm",
        m.strength as "strength",
        m.manufacturer as "manufacturer",
        m.barcode as "barcode",
        COALESCE(SUM(b.quantity_units_remaining), 0)::int as "totalUnitsRemaining",
        FLOOR(COALESCE(SUM(b.quantity_units_remaining), 0) / i.units_per_pack)::int as "availablePacks",
        (COALESCE(SUM(b.quantity_units_remaining), 0) % i.units_per_pack)::int as "availableStrips"
      FROM "${schemaName}".inventory_items i
      JOIN public.medicines m ON i.medicine_id = m.id
      LEFT JOIN "${schemaName}".inventory_batches b ON i.id = b.inventory_item_id AND b.quantity_units_remaining > 0
      WHERE 1=1 ${searchFilter}
      GROUP BY i.id, m.id
      ORDER BY m.trade_name ASC;
    `;

    const items: any[] = await this.prisma.$queryRawUnsafe(sql, ...params);
    return items;
  }

  /**
   * Get active batches for a single inventory item
   */
  async getItemBatches(inventoryItemId: string) {
    const schemaName = this.tenantContext.getSchemaName();

    const sql = `
      SELECT 
        b.id,
        b.batch_number as "batchNumber",
        b.purchase_price_pack as "purchasePricePack",
        b.quantity_units_remaining as "quantityUnitsRemaining",
        TO_CHAR(b.expiry_date, 'MM/YYYY') as "expiryFormatted",
        b.expiry_date as "expiryDate",
        b.created_at as "createdAt"
      FROM "${schemaName}".inventory_batches b
      WHERE b.inventory_item_id = $1::uuid AND b.quantity_units_remaining > 0
      ORDER BY b.expiry_date ASC;
    `;

    const batches: any[] = await this.prisma.$queryRawUnsafe(sql, inventoryItemId);
    return batches;
  }

  /**
   * Update selling price, custom name, or low stock alert for an inventory item
   */
  async updateItemPrice(inventoryItemId: string, dto: UpdateItemPriceDto) {
    const schemaName = this.tenantContext.getSchemaName();
    const tenantId = this.tenantContext.getTenantId();

    const check: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT medicine_id FROM "${schemaName}".inventory_items WHERE id = $1::uuid`,
      inventoryItemId,
    );

    if (check.length === 0) {
      throw new NotFoundException('المادة غير موجودة في المخزون');
    }

    const medicineId = check[0].medicine_id;

    await this.prisma.$executeRawUnsafe(
      `UPDATE "${schemaName}".inventory_items
       SET custom_name = $1,
           selling_price_pack = $2,
           selling_price_unit = $3,
           min_alert_units = COALESCE($4, min_alert_units),
           updated_at = NOW()
       WHERE id = $5::uuid`,
      dto.customName !== undefined ? dto.customName : null,
      dto.sellingPricePack,
      dto.sellingPriceUnit,
      dto.minAlertUnits || null,
      inventoryItemId,
    );

    // Emit sync event
    this.eventEmitter.emit('inventory.synced', {
      tenantId,
      schemaName,
      medicineIds: [medicineId],
    });

    return { success: true, message: 'تم تحديث بيانات وسعر المادة بنجاح' };
  }

  /**
   * Get items that are below minimum alert threshold (Low Stock Alert)
   */
  async getLowStockAlerts() {
    const schemaName = this.tenantContext.getSchemaName();

    const sql = `
      SELECT 
        i.id,
        i.custom_name as "customName",
        m.trade_name as "tradeName",
        m.scientific_name as "scientificName",
        i.units_per_pack as "unitsPerPack",
        i.min_alert_units as "minAlertUnits",
        COALESCE(SUM(b.quantity_units_remaining), 0)::int as "totalUnitsRemaining",
        FLOOR(COALESCE(SUM(b.quantity_units_remaining), 0) / i.units_per_pack)::int as "availablePacks",
        (COALESCE(SUM(b.quantity_units_remaining), 0) % i.units_per_pack)::int as "availableStrips"
      FROM "${schemaName}".inventory_items i
      JOIN public.medicines m ON i.medicine_id = m.id
      LEFT JOIN "${schemaName}".inventory_batches b ON i.id = b.inventory_item_id
      GROUP BY i.id, m.id
      HAVING COALESCE(SUM(b.quantity_units_remaining), 0) <= i.min_alert_units
      ORDER BY COALESCE(SUM(b.quantity_units_remaining), 0) ASC;
    `;

    const lowStockItems: any[] = await this.prisma.$queryRawUnsafe(sql);
    return lowStockItems;
  }

  /**
   * Get batches expiring soon (e.g. within 3 or 6 months)
   */
  async getExpiringSoonAlerts(months: number = 3) {
    const schemaName = this.tenantContext.getSchemaName();

    const sql = `
      SELECT 
        b.id as "batchId",
        m.trade_name as "tradeName",
        m.scientific_name as "scientificName",
        b.batch_number as "batchNumber",
        b.quantity_units_remaining as "quantityUnitsRemaining",
        TO_CHAR(b.expiry_date, 'MM/YYYY') as "expiryFormatted",
        b.expiry_date as "expiryDate"
      FROM "${schemaName}".inventory_batches b
      JOIN "${schemaName}".inventory_items i ON b.inventory_item_id = i.id
      JOIN public.medicines m ON i.medicine_id = m.id
      WHERE b.quantity_units_remaining > 0 
        AND b.expiry_date <= (CURRENT_DATE + ($1 || ' months')::interval)
      ORDER BY b.expiry_date ASC;
    `;

    const expiringBatches: any[] = await this.prisma.$queryRawUnsafe(sql, months);
    return expiringBatches;
  }
}
