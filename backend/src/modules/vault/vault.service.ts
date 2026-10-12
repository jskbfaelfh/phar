import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { validateAndSanitizeSchemaName } from '../../common/utils/security.util';
import * as bcrypt from 'bcrypt';

@Injectable()
export class VaultService {
  constructor(private readonly prisma: PrismaService) {}

  private async getSchema(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || !tenant.schemaName) {
      throw new BadRequestException('الصيدلية غير متوفرة');
    }
    return validateAndSanitizeSchemaName(tenant.schemaName);
  }

  /**
   * Verify Vault PIN or check if PIN is configured
   */
  async checkPinStatus(tenantId: string) {
    const schema = await this.getSchema(tenantId);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id, pin_hash FROM "${schema}".secret_vault_settings LIMIT 1;
    `);

    return {
      isConfigured: rows.length > 0 && !!rows[0].pin_hash,
    };
  }

  async verifyPin(tenantId: string, pin: string) {
    const schema = await this.getSchema(tenantId);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id, pin_hash FROM "${schema}".secret_vault_settings LIMIT 1;
    `);

    if (rows.length === 0 || !rows[0].pin_hash) {
      return { valid: false, isConfigured: false, message: 'لم يتم تعيين رمز PIN للمخزن السري بعد' };
    }

    const valid = await bcrypt.compare(pin, rows[0].pin_hash);
    return { valid, isConfigured: true };
  }

  async setupOrChangePin(tenantId: string, newPin: string, oldPin?: string) {
    if (!newPin || newPin.trim().length < 4) {
      throw new BadRequestException('رمز PIN يجب أن يتكون من 4 أرقام على الأقل');
    }

    const schema = await this.getSchema(tenantId);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id, pin_hash FROM "${schema}".secret_vault_settings LIMIT 1;
    `);

    if (rows.length > 0 && rows[0].pin_hash) {
      if (!oldPin) {
        throw new BadRequestException('يجب إدخال رمز PIN الحالي لتغييره');
      }
      const match = await bcrypt.compare(oldPin, rows[0].pin_hash);
      if (!match) {
        throw new UnauthorizedException('رمز PIN الحالي غير صحيح');
      }
    }

    const hashed = await bcrypt.hash(newPin.trim(), 10);

    if (rows.length > 0) {
      await this.prisma.$executeRawUnsafe(`
        UPDATE "${schema}".secret_vault_settings
        SET pin_hash = $1, updated_at = NOW()
        WHERE id = $2;
      `, hashed, rows[0].id);
    } else {
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO "${schema}".secret_vault_settings (pin_hash)
        VALUES ($1);
      `, hashed);
    }

    return { success: true, message: 'تم حفظ رمز PIN السري بنجاح' };
  }

  /**
   * Get all secret items in vault
   */
  async getItems(tenantId: string, search?: string) {
    const schema = await this.getSchema(tenantId);

    let query = `
      SELECT 
        id,
        trade_name as "tradeName",
        scientific_name as "scientificName",
        barcode,
        strength,
        dosage_form as "dosageForm",
        purchase_price as "purchasePrice",
        selling_price as "sellingPrice",
        quantity,
        min_alert_qty as "minAlertQty",
        expiry_date as "expiryDate",
        notes,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM "${schema}".secret_vault_items
    `;

    const params: any[] = [];
    if (search && search.trim()) {
      query += ` WHERE trade_name ILIKE $1 OR barcode ILIKE $1 OR scientific_name ILIKE $1`;
      params.push(`%${search.trim()}%`);
    }

    query += ` ORDER BY trade_name ASC;`;

    const items = await this.prisma.$queryRawUnsafe<any[]>(query, ...params);
    return items.map((it) => ({
      ...it,
      purchasePrice: Number(it.purchasePrice || 0),
      sellingPrice: Number(it.sellingPrice || 0),
      quantity: Number(it.quantity || 0),
      minAlertQty: Number(it.minAlertQty || 0),
    }));
  }

  /**
   * Save or update a secret item
   */
  async saveItem(tenantId: string, data: any) {
    const schema = await this.getSchema(tenantId);

    if (!data.tradeName || !data.tradeName.trim()) {
      throw new BadRequestException('اسم العلاج مطلوب');
    }

    const purchasePrice = Number(data.purchasePrice || 0);
    const sellingPrice = Number(data.sellingPrice || 0);
    const quantity = Number(data.quantity || 0);
    const minAlertQty = Number(data.minAlertQty || 2);
    const expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;

    if (data.id) {
      await this.prisma.$executeRawUnsafe(`
        UPDATE "${schema}".secret_vault_items
        SET 
          trade_name = $1,
          scientific_name = $2,
          barcode = $3,
          strength = $4,
          dosage_form = $5,
          purchase_price = $6,
          selling_price = $7,
          quantity = $8,
          min_alert_qty = $9,
          expiry_date = $10,
          notes = $11,
          updated_at = NOW()
        WHERE id = $12;
      `,
        data.tradeName.trim(),
        data.scientificName || null,
        data.barcode || null,
        data.strength || null,
        data.dosageForm || null,
        purchasePrice,
        sellingPrice,
        quantity,
        minAlertQty,
        expiryDate,
        data.notes || null,
        data.id,
      );

      return { id: data.id, message: 'تم تحديث العلاج بنجاح' };
    } else {
      const res = await this.prisma.$queryRawUnsafe<any[]>(`
        INSERT INTO "${schema}".secret_vault_items (
          trade_name, scientific_name, barcode, strength, dosage_form,
          purchase_price, selling_price, quantity, min_alert_qty, expiry_date, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        ) RETURNING id;
      `,
        data.tradeName.trim(),
        data.scientificName || null,
        data.barcode || null,
        data.strength || null,
        data.dosageForm || null,
        purchasePrice,
        sellingPrice,
        quantity,
        minAlertQty,
        expiryDate,
        data.notes || null,
      );

      const newItemId = res[0].id;

      // If initial quantity is greater than 0, record initial stock-in transaction
      if (quantity > 0) {
        await this.prisma.$executeRawUnsafe(`
          INSERT INTO "${schema}".secret_vault_transactions (
            item_id, type, quantity, unit_price, total_amount, customer_or_source, notes
          ) VALUES (
            $1, 'IN', $2, $3, $4, 'رصيد أولي / مخزن سري', 'إدخال تأسيسي'
          );
        `, newItemId, quantity, purchasePrice, purchasePrice * quantity);
      }

      return { id: newItemId, message: 'تمت إضافة العلاج إلى المخزن السري بنجاح' };
    }
  }

  async deleteItem(tenantId: string, id: string) {
    const schema = await this.getSchema(tenantId);
    await this.prisma.$executeRawUnsafe(`
      DELETE FROM "${schema}".secret_vault_items WHERE id = $1;
    `, id);
    return { success: true, message: 'تم حذف المادة من المخزن السري' };
  }

  /**
   * Record Stock In (وارد)
   */
  async recordStockIn(tenantId: string, data: { itemId: string; quantity: number; unitPrice: number; source?: string; notes?: string }) {
    const schema = await this.getSchema(tenantId);
    const qty = Number(data.quantity);
    const price = Number(data.unitPrice || 0);

    if (qty <= 0) {
      throw new BadRequestException('الكمية يجب أن تكون أكبر من صفر');
    }

    await this.prisma.$transaction(async (tx) => {
      // 1. Update item stock and purchase price
      await tx.$executeRawUnsafe(`
        UPDATE "${schema}".secret_vault_items
        SET quantity = quantity + $1,
            purchase_price = CASE WHEN $2 > 0 THEN $2 ELSE purchase_price END,
            updated_at = NOW()
        WHERE id = $3;
      `, qty, price, data.itemId);

      // 2. Insert transaction
      await tx.$executeRawUnsafe(`
        INSERT INTO "${schema}".secret_vault_transactions (
          item_id, type, quantity, unit_price, total_amount, customer_or_source, notes
        ) VALUES (
          $1, 'IN', $2, $3, $4, $5, $6
        );
      `, data.itemId, qty, price, qty * price, data.source || 'توريد مباشر', data.notes || null);
    });

    return { success: true, message: 'تم تسجيل الوارد بنجاح' };
  }

  /**
   * Record Stock Out / Disposal (صادر / إتلاف)
   */
  async recordStockOut(tenantId: string, data: { itemId: string; quantity: number; reason?: string; notes?: string }) {
    const schema = await this.getSchema(tenantId);
    const qty = Number(data.quantity);

    if (qty <= 0) {
      throw new BadRequestException('الكمية يجب أن تكون أكبر من صفر');
    }

    const item = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT id, quantity, purchase_price as "purchasePrice" FROM "${schema}".secret_vault_items WHERE id = $1;
    `, data.itemId);

    if (item.length === 0) {
      throw new BadRequestException('المادة غير موجودة');
    }

    if (Number(item[0].quantity) < qty) {
      throw new BadRequestException(`الكمية المتوفرة بالمخزن السري (${item[0].quantity}) لا تكفي`);
    }

    const costPrice = Number(item[0].purchasePrice || 0);

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`
        UPDATE "${schema}".secret_vault_items
        SET quantity = quantity - $1, updated_at = NOW()
        WHERE id = $2;
      `, qty, data.itemId);

      await tx.$executeRawUnsafe(`
        INSERT INTO "${schema}".secret_vault_transactions (
          item_id, type, quantity, unit_price, total_amount, customer_or_source, notes
        ) VALUES (
          $1, 'OUT', $2, $3, $4, $5, $6
        );
      `, data.itemId, qty, costPrice, qty * costPrice, data.reason || 'إخراج مخزني', data.notes || null);
    });

    return { success: true, message: 'تم إخراج الكمية من المخزن السري بنجاح' };
  }

  /**
   * Record Secret Sale (نقطة البيع السرية)
   */
  async recordSale(tenantId: string, data: {
    items: Array<{ itemId: string; quantity: number; unitPrice: number }>;
    customerName?: string;
    notes?: string;
  }) {
    const schema = await this.getSchema(tenantId);

    if (!data.items || data.items.length === 0) {
      throw new BadRequestException('سلة البيع فارغة');
    }

    let totalSaleAmount = 0;
    let totalCostAmount = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const line of data.items) {
        const qty = Number(line.quantity);
        const price = Number(line.unitPrice);

        if (qty <= 0) continue;

        const itemRows = await tx.$queryRawUnsafe<any[]>(`
          SELECT id, trade_name, quantity, purchase_price as "purchasePrice"
          FROM "${schema}".secret_vault_items
          WHERE id = $1 FOR UPDATE;
        `, line.itemId);

        if (itemRows.length === 0) {
          throw new BadRequestException(`العلاج المحدد غير موجود`);
        }

        const item = itemRows[0];
        if (Number(item.quantity) < qty) {
          throw new BadRequestException(`الرصيد المتوفر من [${item.trade_name}] هو ${item.quantity} فقط`);
        }

        const lineCost = Number(item.purchasePrice || 0) * qty;
        const lineTotal = price * qty;

        totalSaleAmount += lineTotal;
        totalCostAmount += lineCost;

        // Deduct quantity
        await tx.$executeRawUnsafe(`
          UPDATE "${schema}".secret_vault_items
          SET quantity = quantity - $1, updated_at = NOW()
          WHERE id = $2;
        `, qty, line.itemId);

        // Record sale transaction
        await tx.$executeRawUnsafe(`
          INSERT INTO "${schema}".secret_vault_transactions (
            item_id, type, quantity, unit_price, total_amount, customer_or_source, notes
          ) VALUES (
            $1, 'SALE', $2, $3, $4, $5, $6
          );
        `, line.itemId, qty, price, lineTotal, data.customerName || 'بيع سري مباشر', data.notes || null);
      }
    });

    const netProfit = totalSaleAmount - totalCostAmount;

    return {
      success: true,
      totalSaleAmount,
      totalCostAmount,
      netProfit,
      message: 'تم إتمام عملية البيع السري بنجاح',
    };
  }

  /**
   * Get Transactions (سجل الوارد والصادر والمبيعات)
   */
  async getTransactions(tenantId: string, type?: string, limit = 100) {
    const schema = await this.getSchema(tenantId);

    let query = `
      SELECT 
        t.id,
        t.item_id as "itemId",
        t.type,
        t.quantity,
        t.unit_price as "unitPrice",
        t.total_amount as "totalAmount",
        t.customer_or_source as "customerOrSource",
        t.notes,
        t.created_at as "createdAt",
        i.trade_name as "tradeName",
        i.strength,
        i.dosage_form as "dosageForm",
        i.purchase_price as "currentPurchasePrice"
      FROM "${schema}".secret_vault_transactions t
      LEFT JOIN "${schema}".secret_vault_items i ON t.item_id = i.id
    `;

    const params: any[] = [];
    if (type && type !== 'ALL') {
      query += ` WHERE t.type = $1`;
      params.push(type);
    }

    query += ` ORDER BY t.created_at DESC LIMIT ${Math.min(limit, 500)};`;

    const rows = await this.prisma.$queryRawUnsafe<any[]>(query, ...params);
    return rows.map((r) => ({
      ...r,
      quantity: Number(r.quantity || 0),
      unitPrice: Number(r.unitPrice || 0),
      totalAmount: Number(r.totalAmount || 0),
      currentPurchasePrice: Number(r.currentPurchasePrice || 0),
    }));
  }

  /**
   * Secret Vault Summary & Analytics
   */
  async getSummary(tenantId: string) {
    const schema = await this.getSchema(tenantId);

    const items = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        COUNT(*)::int as "totalItemsCount",
        COALESCE(SUM(quantity * purchase_price), 0)::numeric as "totalPurchaseValue",
        COALESCE(SUM(quantity * selling_price), 0)::numeric as "totalSellingValue",
        COALESCE(SUM(CASE WHEN quantity <= min_alert_qty THEN 1 ELSE 0 END), 0)::int as "lowStockCount"
      FROM "${schema}".secret_vault_items;
    `);

    const trans = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'SALE' THEN total_amount ELSE 0 END), 0)::numeric as "totalSalesAmount",
        COALESCE(SUM(CASE WHEN type = 'IN' THEN total_amount ELSE 0 END), 0)::numeric as "totalInAmount",
        COALESCE(SUM(CASE WHEN type = 'OUT' THEN total_amount ELSE 0 END), 0)::numeric as "totalOutAmount"
      FROM "${schema}".secret_vault_transactions;
    `);

    const summaryItem = items[0] || {};
    const summaryTrans = trans[0] || {};

    return {
      totalItemsCount: Number(summaryItem.totalItemsCount || 0),
      totalPurchaseValue: Number(summaryItem.totalPurchaseValue || 0),
      totalSellingValue: Number(summaryItem.totalSellingValue || 0),
      lowStockCount: Number(summaryItem.lowStockCount || 0),
      totalSalesAmount: Number(summaryTrans.totalSalesAmount || 0),
      totalInAmount: Number(summaryTrans.totalInAmount || 0),
      totalOutAmount: Number(summaryTrans.totalOutAmount || 0),
    };
  }
}
