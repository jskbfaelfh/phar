import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { CheckoutDto, CreateReturnDto, UnitTypeEnum } from './dto/create-sale.dto';

@Injectable()
export class PosService {
  private readonly logger = new Logger(PosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Generate Invoice Number: INV-YYYYMMDD-XXXX
   */
  private generateInvoiceNumber(): string {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `INV-${today}-${rand}`;
  }

  /**
   * Process Checkout / Sale with FEFO inventory deduction and negative stock allowance
   */
  async checkout(dto: CheckoutDto) {
    const schemaName = this.tenantContext.getSchemaName();
    const tenantId = this.tenantContext.getTenantId();
    const ctx = this.tenantContext.getContext();
    const userId = ctx?.userId;

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('سلة المشتريات فارغة');
    }

    const invoiceNumber = this.generateInvoiceNumber();
    const saleId = crypto.randomUUID();

    let subtotal = 0;
    const lineItemsToInsert: any[] = [];
    const affectedMedicineIds: string[] = [];

    // Process each cart item
    for (const item of dto.items) {
      // 1. Fetch inventory item details
      const itemRows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT id, medicine_id, units_per_pack, selling_price_pack, selling_price_unit 
         FROM "${schemaName}".inventory_items 
         WHERE id = $1::uuid`,
        item.inventoryItemId,
      );

      if (itemRows.length === 0) {
        throw new NotFoundException(`المادة ${item.inventoryItemId} غير موجودة في المخزون`);
      }

      const invItem = itemRows[0];
      affectedMedicineIds.push(invItem.medicine_id);

      const isPack = item.unitType === UnitTypeEnum.PACK;
      const unitPrice = isPack
        ? Number(invItem.selling_price_pack)
        : Number(invItem.selling_price_unit);

      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;

      const unitsToDeduct = isPack
        ? item.quantity * Number(invItem.units_per_pack)
        : item.quantity;

      // 2. FEFO Deduction from batches (Allowing negative stock)
      let unitsLeftToDeduct = unitsToDeduct;
      let primaryBatchId: string | null = null;

      const batches: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT id, quantity_units_remaining, purchase_price_pack 
         FROM "${schemaName}".inventory_batches 
         WHERE inventory_item_id = $1::uuid 
         ORDER BY expiry_date ASC`,
        item.inventoryItemId,
      );

      if (batches.length > 0) {
        primaryBatchId = batches[0].id;
        for (const batch of batches) {
          if (unitsLeftToDeduct <= 0) break;

          const availableInBatch = Number(batch.quantity_units_remaining);
          if (availableInBatch > 0) {
            const deductFromThis = Math.min(availableInBatch, unitsLeftToDeduct);
            await this.prisma.$executeRawUnsafe(
              `UPDATE "${schemaName}".inventory_batches 
               SET quantity_units_remaining = quantity_units_remaining - $1 
               WHERE id = $2::uuid`,
              deductFromThis,
              batch.id,
            );
            unitsLeftToDeduct -= deductFromThis;
          }
        }

        // If there is still deficit after exhausting all batches (Negative Stock):
        if (unitsLeftToDeduct > 0) {
          const latestBatch = batches[batches.length - 1];
          await this.prisma.$executeRawUnsafe(
            `UPDATE "${schemaName}".inventory_batches 
             SET quantity_units_remaining = quantity_units_remaining - $1 
             WHERE id = $2::uuid`,
            unitsLeftToDeduct,
            latestBatch.id,
          );
        }
      } else {
        // No batches exist at all -> Create placeholder batch with negative units
        const placeholderBatchId = crypto.randomUUID();
        primaryBatchId = placeholderBatchId;
        await this.prisma.$executeRawUnsafe(
          `INSERT INTO "${schemaName}".inventory_batches 
           (id, inventory_item_id, batch_number, purchase_price_pack, quantity_units_remaining, expiry_date, created_at)
           VALUES ($1::uuid, $2::uuid, 'AUTO-DEFICIT', 0, $3, (CURRENT_DATE + interval '2 years')::date, NOW())`,
          placeholderBatchId,
          item.inventoryItemId,
          -unitsToDeduct,
        );
      }

      lineItemsToInsert.push({
        id: crypto.randomUUID(),
        saleId,
        inventoryItemId: item.inventoryItemId,
        inventoryBatchId: primaryBatchId,
        unitType: item.unitType,
        quantity: item.quantity,
        unitPrice,
        totalPrice: lineTotal,
      });
    }

    const discountAmount = Math.min(Number(dto.discountAmount || 0), subtotal);
    const totalAmount = Math.max(0, subtotal - discountAmount);

    // 3. Insert Sale Header
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "${schemaName}".sales 
       (id, invoice_number, user_id, subtotal, discount_amount, total_amount, created_at)
       VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6, NOW())`,
      saleId,
      invoiceNumber,
      userId || null,
      subtotal,
      discountAmount,
      totalAmount,
    );

    // 4. Insert Sale Line Items
    for (const line of lineItemsToInsert) {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "${schemaName}".sale_items 
         (id, sale_id, inventory_item_id, inventory_batch_id, unit_type, quantity, unit_price, total_price)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8)`,
        line.id,
        line.saleId,
        line.inventoryItemId,
        line.inventoryBatchId,
        line.unitType,
        line.quantity,
        line.unitPrice,
        line.totalPrice,
      );
    }

    // 5. Emit Event to update Central Search Index in background
    this.eventEmitter.emit('inventory.synced', {
      tenantId,
      schemaName,
      medicineIds: affectedMedicineIds,
    });

    this.logger.log(`Checkout completed. Invoice: ${invoiceNumber}, Total: ${totalAmount} IQD`);

    return this.getSaleById(saleId);
  }

  /**
   * Process Quick Return (Refund item back to stock)
   */
  async processReturn(dto: CreateReturnDto) {
    const schemaName = this.tenantContext.getSchemaName();
    const tenantId = this.tenantContext.getTenantId();
    const ctx = this.tenantContext.getContext();
    const userId = ctx?.userId;

    const itemRows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id, medicine_id, units_per_pack, selling_price_pack, selling_price_unit 
       FROM "${schemaName}".inventory_items 
       WHERE id = $1::uuid`,
      dto.inventoryItemId,
    );

    if (itemRows.length === 0) {
      throw new NotFoundException('المادة غير موجودة في المخزون');
    }

    const invItem = itemRows[0];
    const isPack = dto.unitType === UnitTypeEnum.PACK;

    const defaultUnitPrice = isPack
      ? Number(invItem.selling_price_pack)
      : Number(invItem.selling_price_unit);

    const refundAmount = dto.refundAmount !== undefined
      ? Number(dto.refundAmount)
      : defaultUnitPrice * dto.quantity;

    const returnId = crypto.randomUUID();

    // 1. Insert Return Record
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "${schemaName}".returns 
       (id, sale_id, inventory_item_id, user_id, unit_type, quantity, refund_amount, reason, created_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8, NOW())`,
      returnId,
      dto.saleId || null,
      dto.inventoryItemId,
      userId || null,
      dto.unitType,
      dto.quantity,
      refundAmount,
      dto.reason || 'إرجاع سريع',
    );

    // 2. Add units back to the newest batch
    const unitsToAdd = isPack
      ? dto.quantity * Number(invItem.units_per_pack)
      : dto.quantity;

    const batches: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id FROM "${schemaName}".inventory_batches 
       WHERE inventory_item_id = $1::uuid 
       ORDER BY created_at DESC LIMIT 1`,
      dto.inventoryItemId,
    );

    if (batches.length > 0) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "${schemaName}".inventory_batches 
         SET quantity_units_remaining = quantity_units_remaining + $1 
         WHERE id = $2::uuid`,
        unitsToAdd,
        batches[0].id,
      );
    }

    // 3. Emit sync event
    this.eventEmitter.emit('inventory.synced', {
      tenantId,
      schemaName,
      medicineIds: [invItem.medicine_id],
    });

    return {
      success: true,
      returnId,
      refundAmount,
      message: `تم إرجاع المادة واسترداد ${refundAmount} د.ع بنجاح`,
    };
  }

  /**
   * Get single Sale / Invoice details with line items
   */
  async getSaleById(saleId: string) {
    const schemaName = this.tenantContext.getSchemaName();

    const sales: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT 
         s.id,
         s.invoice_number as "invoiceNumber",
         s.subtotal,
         s.discount_amount as "discountAmount",
         s.total_amount as "totalAmount",
         s.created_at as "createdAt",
         u.name as "cashierName"
       FROM "${schemaName}".sales s
       LEFT JOIN "${schemaName}".users u ON s.user_id = u.id
       WHERE s.id = $1::uuid`,
      saleId,
    );

    if (sales.length === 0) {
      throw new NotFoundException('الفاتورة غير موجودة');
    }

    const sale = sales[0];

    const items: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT 
         si.id,
         si.unit_type as "unitType",
         si.quantity,
         si.unit_price as "unitPrice",
         si.total_price as "totalPrice",
         m.trade_name as "tradeName",
         m.scientific_name as "scientificName",
         m.dosage_form as "dosageForm"
       FROM "${schemaName}".sale_items si
       JOIN "${schemaName}".inventory_items ii ON si.inventory_item_id = ii.id
       JOIN public.medicines m ON ii.medicine_id = m.id
       WHERE si.sale_id = $1::uuid`,
      saleId,
    );

    return {
      ...sale,
      items,
    };
  }

  /**
   * Get Cashier Daily Shift Summary (Sales, Refunds, Cash in Drawer)
   */
  async getDailySummary() {
    const schemaName = this.tenantContext.getSchemaName();

    // Today's Sales
    const salesSummary: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT 
         COUNT(id)::int as "totalInvoices",
         COALESCE(SUM(subtotal), 0)::numeric as "totalSubtotal",
         COALESCE(SUM(discount_amount), 0)::numeric as "totalDiscounts",
         COALESCE(SUM(total_amount), 0)::numeric as "totalSalesRevenue"
       FROM "${schemaName}".sales
       WHERE created_at >= CURRENT_DATE`,
    );

    // Today's Returns
    const returnsSummary: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT 
         COUNT(id)::int as "totalReturnsCount",
         COALESCE(SUM(refund_amount), 0)::numeric as "totalRefunds"
       FROM "${schemaName}".returns
       WHERE created_at >= CURRENT_DATE`,
    );

    const s = salesSummary[0];
    const r = returnsSummary[0];

    const netCashInDrawer = Number(s.totalSalesRevenue) - Number(r.totalRefunds);

    return {
      date: new Date().toISOString().slice(0, 10),
      totalInvoices: s.totalInvoices,
      totalSalesRevenue: Number(s.totalSalesRevenue),
      totalDiscounts: Number(s.totalDiscounts),
      totalReturnsCount: r.totalReturnsCount,
      totalRefunds: Number(r.totalRefunds),
      netCashInDrawer,
    };
  }

  /**
   * Get Sales History with pagination and search
   */
  async getSalesHistory(query?: { limit?: number; search?: string }) {
    const schemaName = this.tenantContext.getSchemaName();
    const limit = Math.min(Number(query?.limit || 50), 100);

    let searchFilter = '';
    const params: any[] = [limit];

    if (query?.search && query.search.trim().length > 0) {
      params.push(`%${query.search.trim()}%`);
      searchFilter = `AND (s.invoice_number ILIKE $2 OR u.name ILIKE $2)`;
    }

    const sql = `
      SELECT 
        s.id,
        s.invoice_number as "invoiceNumber",
        s.subtotal,
        s.discount_amount as "discountAmount",
        s.total_amount as "totalAmount",
        s.created_at as "createdAt",
        u.name as "cashierName",
        (SELECT COUNT(id)::int FROM "${schemaName}".sale_items WHERE sale_id = s.id) as "itemsCount"
      FROM "${schemaName}".sales s
      LEFT JOIN "${schemaName}".users u ON s.user_id = u.id
      WHERE 1=1 ${searchFilter}
      ORDER BY s.created_at DESC
      LIMIT $1;
    `;

    const sales: any[] = await this.prisma.$queryRawUnsafe(sql, ...params);
    return sales;
  }
}
