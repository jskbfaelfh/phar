import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { LocalDbService } from '../../database/local-db.service';
import { CloudSyncService } from '../../database/cloud-sync.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { CheckoutDto, CreateReturnDto, SyncOfflineSalesDto, UnitTypeEnum } from './dto/create-sale.dto';

@Injectable()
export class PosService {
  private readonly logger = new Logger(PosService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly localDb: LocalDbService,
    private readonly cloudSync: CloudSyncService,
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

    const itemIds = Array.from(new Set(dto.items.map((i) => i.inventoryItemId)));
    const itemIdsListSql = itemIds.map((id) => `'${id}'::uuid`).join(',');

    // 1. Fetch all inventory items in ONE single network query
    const itemRows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id, medicine_id, units_per_pack, selling_price_pack, selling_price_unit 
       FROM "${schemaName}".inventory_items 
       WHERE id IN (${itemIdsListSql})`,
    );

    const itemMap = new Map<string, any>();
    for (const row of itemRows) {
      itemMap.set(row.id, row);
    }

    // 2. Fetch all active inventory batches in ONE single network query
    const batchesRows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id, inventory_item_id, quantity_units_remaining, purchase_price_pack, selling_price_pack, selling_price_unit, expiry_date 
       FROM "${schemaName}".inventory_batches 
       WHERE inventory_item_id IN (${itemIdsListSql}) 
         AND expiry_date >= CURRENT_DATE
         AND (is_recalled IS FALSE OR is_recalled IS NULL)
       ORDER BY expiry_date ASC`,
    );

    const batchesByItemMap = new Map<string, any[]>();
    for (const b of batchesRows) {
      const list = batchesByItemMap.get(b.inventory_item_id) || [];
      list.push({ ...b, remaining: Number(b.quantity_units_remaining) });
      batchesByItemMap.set(b.inventory_item_id, list);
    }

    let subtotal = 0;
    const lineItemsToInsert: any[] = [];
    const affectedMedicineIds: string[] = [];
    const sqlStatements: string[] = [];

    // 3. Perform in-memory FEFO calculations (0ms latency)
    for (const item of dto.items) {
      const invItem = itemMap.get(item.inventoryItemId);
      if (!invItem) {
        throw new NotFoundException(`المادة ${item.inventoryItemId} غير موجودة في المخزون`);
      }
      affectedMedicineIds.push(invItem.medicine_id);

      const isPack = item.unitType === UnitTypeEnum.PACK;
      const unitsPerPack = Number(invItem.units_per_pack) || 1;
      const defaultPackPrice = Number(invItem.selling_price_pack);
      const defaultUnitPrice = Number(invItem.selling_price_unit);

      const unitsToDeduct = isPack ? item.quantity * unitsPerPack : item.quantity;
      let unitsLeftToDeduct = unitsToDeduct;

      let itemBatches = batchesByItemMap.get(item.inventoryItemId) || [];
      if (item.inventoryBatchId) {
        // Priority to user selected batch
        itemBatches = [...itemBatches].sort((a, b) => (a.id === item.inventoryBatchId ? -1 : 1));
      }

      if (itemBatches.length > 0) {
        for (const batch of itemBatches) {
          if (unitsLeftToDeduct <= 0) break;
          if (batch.remaining > 0) {
            const deductUnits = Math.min(batch.remaining, unitsLeftToDeduct);
            batch.remaining -= deductUnits;
            unitsLeftToDeduct -= deductUnits;

            sqlStatements.push(
              `UPDATE "${schemaName}".inventory_batches SET quantity_units_remaining = quantity_units_remaining - ${deductUnits} WHERE id = '${batch.id}'::uuid;`,
            );

            const batchSellingPackPrice = batch.selling_price_pack != null ? Number(batch.selling_price_pack) : defaultPackPrice;
            const batchSellingUnitPrice = batch.selling_price_unit != null ? Number(batch.selling_price_unit) : defaultUnitPrice;

            const portionQty = isPack ? Math.round((deductUnits / unitsPerPack) * 100) / 100 : deductUnits;
            const portionUnitPrice = isPack ? batchSellingPackPrice : batchSellingUnitPrice;
            const portionLineTotal = portionUnitPrice * portionQty;

            subtotal += portionLineTotal;

            lineItemsToInsert.push({
              id: crypto.randomUUID(),
              saleId,
              inventoryItemId: item.inventoryItemId,
              inventoryBatchId: batch.id,
              unitType: item.unitType,
              quantity: portionQty,
              unitPrice: portionUnitPrice,
              totalPrice: portionLineTotal,
            });
          }
        }

        if (unitsLeftToDeduct > 0) {
          const latestBatch = itemBatches[itemBatches.length - 1];
          sqlStatements.push(
            `UPDATE "${schemaName}".inventory_batches SET quantity_units_remaining = quantity_units_remaining - ${unitsLeftToDeduct} WHERE id = '${latestBatch.id}'::uuid;`,
          );

          const latestPackPrice = latestBatch.selling_price_pack != null ? Number(latestBatch.selling_price_pack) : defaultPackPrice;
          const latestUnitPrice = latestBatch.selling_price_unit != null ? Number(latestBatch.selling_price_unit) : defaultUnitPrice;

          const deficitQty = isPack ? Math.round((unitsLeftToDeduct / unitsPerPack) * 100) / 100 : unitsLeftToDeduct;
          const deficitUnitPrice = isPack ? latestPackPrice : latestUnitPrice;
          const deficitLineTotal = deficitUnitPrice * deficitQty;

          subtotal += deficitLineTotal;

          lineItemsToInsert.push({
            id: crypto.randomUUID(),
            saleId,
            inventoryItemId: item.inventoryItemId,
            inventoryBatchId: latestBatch.id,
            unitType: item.unitType,
            quantity: deficitQty,
            unitPrice: deficitUnitPrice,
            totalPrice: deficitLineTotal,
          });
        }
      } else {
        // Auto deficit batch placeholder
        const placeholderBatchId = crypto.randomUUID();
        sqlStatements.push(
          `INSERT INTO "${schemaName}".inventory_batches (id, inventory_item_id, batch_number, purchase_price_pack, selling_price_pack, selling_price_unit, quantity_units_remaining, expiry_date, is_recalled, created_at) VALUES ('${placeholderBatchId}'::uuid, '${item.inventoryItemId}'::uuid, 'AUTO-DEFICIT', 0, ${defaultPackPrice}, ${defaultUnitPrice}, -${unitsToDeduct}, (CURRENT_DATE + interval '2 years')::date, FALSE, NOW());`,
        );

        const lineTotal = (isPack ? defaultPackPrice : defaultUnitPrice) * item.quantity;
        subtotal += lineTotal;

        lineItemsToInsert.push({
          id: crypto.randomUUID(),
          saleId,
          inventoryItemId: item.inventoryItemId,
          inventoryBatchId: placeholderBatchId,
          unitType: item.unitType,
          quantity: item.quantity,
          unitPrice: isPack ? defaultPackPrice : defaultUnitPrice,
          totalPrice: lineTotal,
        });
      }
    }

    const discountAmount = Math.min(Number(dto.discountAmount || 0), subtotal);
    const totalAmount = Math.max(0, subtotal - discountAmount);

    // 4. Combine ALL SQL writes into ONE single multi-statement block
    sqlStatements.push(
      `INSERT INTO "${schemaName}".sales (id, invoice_number, user_id, subtotal, discount_amount, total_amount, created_at) VALUES ('${saleId}'::uuid, '${invoiceNumber}', ${userId ? `'${userId}'::uuid` : 'NULL'}, ${subtotal}, ${discountAmount}, ${totalAmount}, NOW());`,
    );

    for (const line of lineItemsToInsert) {
      sqlStatements.push(
        `INSERT INTO "${schemaName}".sale_items (id, sale_id, inventory_item_id, inventory_batch_id, unit_type, quantity, unit_price, total_price) VALUES ('${line.id}'::uuid, '${line.saleId}'::uuid, '${line.inventoryItemId}'::uuid, '${line.inventoryBatchId}'::uuid, '${line.unitType}', ${line.quantity}, ${line.unitPrice}, ${line.totalPrice});`,
      );
    }

    // Execute ALL database updates in ONE single PL/pgSQL round-trip!
    const combinedPlpgsql = `DO $$
BEGIN
${sqlStatements.join('\n')}
END $$;`;
    await this.prisma.$executeRawUnsafe(combinedPlpgsql);

    // Also mirror to local SQLite file for instant file availability
    try {
      this.localDb.execute(
        `INSERT OR REPLACE INTO sales (id, invoice_number, user_id, subtotal, discount_amount, total_amount) VALUES (?, ?, ?, ?, ?, ?)`,
        [saleId, invoiceNumber, userId || null, subtotal, discountAmount, totalAmount],
      );
    } catch {}

    this.eventEmitter.emit('inventory.synced', {
      tenantId,
      schemaName,
      medicineIds: affectedMedicineIds,
    });

    const completedSaleRecord = {
      id: saleId,
      invoiceNumber,
      subtotal,
      discountAmount,
      totalAmount,
      createdAt: new Date().toISOString(),
      items: lineItemsToInsert,
    };

    this.eventEmitter.emit('sale.completed', {
      tenantId,
      schemaName,
      sale: completedSaleRecord,
    });

    this.logger.log(`Instant checkout completed in 1 roundtrip. Invoice: ${invoiceNumber}`);

    return completedSaleRecord;
  }

  /**
   * Bulk Sync Offline Sales created during internet outage
   */
  async syncOfflineSales(dto: SyncOfflineSalesDto) {
    const results: { offlineId: string; success: boolean; sale?: any; error?: string }[] = [];

    for (const offlineSale of dto.sales) {
      try {
        const checkoutDto: CheckoutDto = {
          items: offlineSale.items,
          discountAmount: Number(offlineSale.discountAmount || 0),
        };
        const sale = await this.checkout(checkoutDto);
        results.push({
          offlineId: offlineSale.offlineId,
          success: true,
          sale,
        });
      } catch (err: any) {
        results.push({
          offlineId: offlineSale.offlineId,
          success: false,
          error: err.message || 'فشلت المزامنة',
        });
      }
    }

    return {
      syncedCount: results.filter((r) => r.success).length,
      totalCount: dto.sales.length,
      results,
    };
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

    // 2. Add units back to the original batch if saleId provided, otherwise newest batch
    const unitsToAdd = isPack
      ? dto.quantity * Number(invItem.units_per_pack)
      : dto.quantity;

    let targetBatchId: string | null = null;

    if (dto.saleId) {
      const originalSaleItem: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT inventory_batch_id 
         FROM "${schemaName}".sale_items 
         WHERE sale_id = $1::uuid AND inventory_item_id = $2::uuid 
         LIMIT 1`,
        dto.saleId,
        dto.inventoryItemId,
      );
      if (originalSaleItem.length > 0 && originalSaleItem[0].inventory_batch_id) {
        targetBatchId = originalSaleItem[0].inventory_batch_id;
      }
    }

    if (!targetBatchId) {
      const batches: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT id FROM "${schemaName}".inventory_batches 
         WHERE inventory_item_id = $1::uuid 
         ORDER BY created_at DESC LIMIT 1`,
        dto.inventoryItemId,
      );
      if (batches.length > 0) {
        targetBatchId = batches[0].id;
      }
    }

    if (targetBatchId) {
      await this.prisma.$executeRawUnsafe(
        `UPDATE "${schemaName}".inventory_batches 
         SET quantity_units_remaining = quantity_units_remaining + $1 
         WHERE id = $2::uuid`,
        unitsToAdd,
        targetBatchId,
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
         b.batch_number as "batchNumber",
         m.trade_name as "tradeName",
         m.scientific_name as "scientificName",
         m.dosage_form as "dosageForm"
       FROM "${schemaName}".sale_items si
       JOIN "${schemaName}".inventory_items i ON si.inventory_item_id = i.id
       JOIN public.medicines m ON i.medicine_id = m.id
       LEFT JOIN "${schemaName}".inventory_batches b ON si.inventory_batch_id = b.id
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

  /**
   * Close Shift Handover with cash reconciliation
   */
  async closeShiftHandover(user: any, dto: { actualCash: number; openingCash?: number; notes?: string }) {
    const schemaName = this.tenantContext.getSchemaName();

    // Calculate today's sales and returns for expected cash
    const summary = await this.getDailySummary();
    const openingCash = Number(dto.openingCash || 0);
    const expectedCash = openingCash + summary.netCashInDrawer;
    const actualCash = Number(dto.actualCash || 0);
    const cashDifference = actualCash - expectedCash;

    const result: any[] = await this.prisma.$queryRawUnsafe(`
      INSERT INTO "${schemaName}".shift_logs (
        user_id, user_name, opening_cash, expected_cash, actual_cash, cash_difference,
        total_sales_count, total_sales_amount, notes, status, closed_at
      ) VALUES (
        $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, 'CLOSED', CURRENT_TIMESTAMP
      ) RETURNING id, opened_at as "openedAt", closed_at as "closedAt";
    `,
      user.id,
      user.name || 'الكاشير',
      openingCash,
      expectedCash,
      actualCash,
      cashDifference,
      summary.totalInvoices,
      summary.totalSalesRevenue,
      dto.notes || null
    );

    return {
      message: 'تم إغلاق الوردية وتوثيق المطابقة النقدية بنجاح',
      shiftId: result[0]?.id,
      openedAt: result[0]?.openedAt,
      closedAt: result[0]?.closedAt,
      openingCash,
      expectedCash,
      actualCash,
      cashDifference,
      totalSalesCount: summary.totalInvoices,
      totalSalesAmount: summary.totalSalesRevenue,
      netCashInDrawer: summary.netCashInDrawer,
    };
  }

  /**
   * Get shift history logs
   */
  async getShiftHistory(limit: number = 30) {
    const schemaName = this.tenantContext.getSchemaName();
    const sql = `
      SELECT 
        id,
        user_id as "userId",
        user_name as "userName",
        opened_at as "openedAt",
        closed_at as "closedAt",
        opening_cash as "openingCash",
        expected_cash as "expectedCash",
        actual_cash as "actualCash",
        cash_difference as "cashDifference",
        total_sales_count as "totalSalesCount",
        total_sales_amount as "totalSalesAmount",
        notes,
        status
      FROM "${schemaName}".shift_logs
      ORDER BY closed_at DESC, opened_at DESC
      LIMIT $1;
    `;
    try {
      return await this.prisma.$queryRawUnsafe(sql, limit);
    } catch {
      return [];
    }
  }
}
