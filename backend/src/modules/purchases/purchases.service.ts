import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';

@Injectable()
export class PurchasesService {
  private static readonly verifiedSchemas = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Atomically generate a collision-free sequential business invoice number from database sequence
   * Format: PUR-YYYY-00001
   */
  async generatePurchaseInvoiceNumber(schema: string, tx?: any): Promise<string> {
    const client = tx || this.prisma;
    try {
      const res: any[] = await client.$queryRawUnsafe(
        `SELECT nextval('"${schema}".purchase_invoice_seq') as nextval;`
      );
      const seq = Number(res[0]?.nextval || 1);
      const year = new Date().getFullYear();
      return `PUR-${year}-${String(seq).padStart(5, '0')}`;
    } catch {
      await client.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS "${schema}".purchase_invoice_seq START 1;`);
      const res: any[] = await client.$queryRawUnsafe(
        `SELECT nextval('"${schema}".purchase_invoice_seq') as nextval;`
      );
      const seq = Number(res[0]?.nextval || 1);
      const year = new Date().getFullYear();
      return `PUR-${year}-${String(seq).padStart(5, '0')}`;
    }
  }

  /**
   * Record a new purchase invoice from a supplier/warehouse into tenant schema
   */
  async createPurchase(tenantId: string, dto: CreatePurchaseDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || !tenant.schemaName) {
      throw new BadRequestException('الصيدلية غير متوفرة أو ليس لديها قاعدة بيانات مهيأة');
    }

    const schema = tenant.schemaName;

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('يجب تضمين مادة واحدة على الأقل في فاتورة الشراء');
    }

    const paidAmount = Number(dto.paidAmount) || 0;
    const totalAmount = Number(dto.totalAmount) || 0;
    const remainingAmount = Math.max(0, totalAmount - paidAmount);
    const invoiceDate = dto.invoiceDate ? new Date(dto.invoiceDate) : new Date();
    const rawSupplierName = (dto.supplierName || '').trim();

    if (!dto.supplierId && !rawSupplierName) {
      throw new BadRequestException('يرجى تحديد المذخر أو اسم المورد المعتمد لفاتورة الشراء');
    }

    const purchaseId = crypto.randomUUID();
    const paymentStatus = remainingAmount === 0 ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'UNPAID');

    const earlyDiscountDays = dto.earlyDiscountDays ? Number(dto.earlyDiscountDays) : null;
    const earlyDiscountPercent = dto.earlyDiscountPercent ? Number(dto.earlyDiscountPercent) : null;
    let earlyDiscountDeadline: Date | null = null;
    let earlyDiscountAmount: number | null = null;

    if (earlyDiscountDays && earlyDiscountDays > 0 && earlyDiscountPercent && earlyDiscountPercent > 0) {
      earlyDiscountDeadline = new Date(invoiceDate.getTime() + earlyDiscountDays * 24 * 60 * 60 * 1000);
      earlyDiscountAmount = Math.round(totalAmount * (earlyDiscountPercent / 100));
    }

    const totalGrossAmount = dto.items.reduce((sum: number, it: any) => sum + (Number(it.quantityPacks) || 0) * (Number(it.purchasePricePack) || 0), 0);
    const subtotalAfterItemDiscounts = dto.items.reduce((sum: number, it: any) => {
      const q = Number(it.quantityPacks) || 0;
      const p = Number(it.purchasePricePack) || 0;
      const d = Number(it.discountPercent) || 0;
      return sum + q * p * (1 - d / 100);
    }, 0);
    const directDiscountAmount = dto.directDiscountAmount && Number(dto.directDiscountAmount) > 0
      ? Number(dto.directDiscountAmount)
      : Math.max(0, subtotalAfterItemDiscounts - totalAmount);
    const totalDiscountAmount = Math.max(0, totalGrossAmount - totalAmount);

    // Execute the complete purchase workflow atomically inside an ACID transaction
    const transactionResult = await this.prisma.$transaction(
      async (tx) => {
        // Resolve or generate atomic sequential invoice number
        const invoiceNumber = (dto.invoiceNumber && dto.invoiceNumber.trim().length > 0)
          ? dto.invoiceNumber.trim()
          : await this.generatePurchaseInvoiceNumber(schema, tx);

        // 1. Resolve or create Supplier strictly in tenant schema (No generic dummy suppliers)
        let finalSupplierId = dto.supplierId || null;
        let resolvedSupplierName = rawSupplierName;

        if (finalSupplierId) {
          const existingSupp: any[] = await tx.$queryRawUnsafe(`
            SELECT id, name FROM "${schema}"."suppliers" WHERE id = $1::uuid LIMIT 1;
          `, finalSupplierId);
          if (existingSupp.length === 0) {
            throw new NotFoundException('المذخر المحدد غير موجود في قاعدة بيانات الصيدلية');
          }
          resolvedSupplierName = existingSupp[0].name;
        } else if (rawSupplierName) {
          const existingSupp: any[] = await tx.$queryRawUnsafe(`
            SELECT id, name FROM "${schema}"."suppliers" WHERE LOWER(name) = LOWER($1) LIMIT 1;
          `, rawSupplierName);

          if (existingSupp.length > 0) {
            finalSupplierId = existingSupp[0].id;
            resolvedSupplierName = existingSupp[0].name;
          } else {
            const createdSupp: any[] = await tx.$queryRawUnsafe(`
              INSERT INTO "${schema}"."suppliers" ("name", "created_at")
              VALUES ($1, NOW())
              RETURNING id, name;
            `, rawSupplierName);
            finalSupplierId = createdSupp[0].id;
            resolvedSupplierName = createdSupp[0].name;
          }
        }

        // 2. Insert into purchases table (standard unified system)
        await tx.$executeRawUnsafe(`
          INSERT INTO "${schema}"."purchases" (
            "id", "invoice_number", "supplier_id", "supplier_name",
            "total_gross_amount", "total_discount_amount", "net_total_amount",
            "paid_amount", "remaining_amount", "payment_status", "notes", "created_at"
          ) VALUES (
            $1::uuid, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11, $12
          );
        `,
          purchaseId,
          invoiceNumber,
          finalSupplierId,
          resolvedSupplierName,
          totalGrossAmount,
          totalDiscountAmount,
          totalAmount,
          paidAmount,
          remainingAmount,
          paymentStatus,
          dto.notes || null,
          invoiceDate
        );

        // 3. Insert into purchase_invoices table for multi-view compatibility
        const discountTiersJson = dto.discountTiers && Array.isArray(dto.discountTiers) && dto.discountTiers.length > 0
          ? JSON.stringify(dto.discountTiers)
          : null;

        const invoiceInsert = await tx.$queryRawUnsafe<Array<{ id: string }>>(`
          INSERT INTO "${schema}"."purchase_invoices" (
            "id", "invoice_number", "supplier_id", "supplier_name", "invoice_date",
            "total_amount", "paid_amount", "remaining_amount", "notes", "items_count",
            "early_discount_days", "early_discount_percent", "early_discount_deadline", "early_discount_amount", "discount_tiers"
          ) VALUES (
            $1::uuid, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb
          ) RETURNING id;
        `,
          purchaseId,
          invoiceNumber,
          finalSupplierId,
          resolvedSupplierName,
          invoiceDate,
          totalAmount,
          paidAmount,
          remainingAmount,
          dto.notes || null,
          dto.items.length,
          earlyDiscountDays,
          earlyDiscountPercent,
          earlyDiscountDeadline,
          earlyDiscountAmount,
          discountTiersJson
        );

        const invoiceId = invoiceInsert[0].id;
        const processedMedicineIds: string[] = [];

        // 4. Process items, create medicines if needed, update inventory items & insert batches
        for (const item of dto.items) {
          const quantityPacks = Number(item.quantityPacks) || 1;
          const bonusPacks = Number(item.bonusPacks) || 0;
          const purchasePricePack = Number(item.purchasePricePack) || 0;
          const discountPercent = Number(item.discountPercent) || 0;
          const netCostPack = purchasePricePack * (1 - discountPercent / 100);
          const unitsPerPack = Number(item.unitsPerPack) || 1;
          const sellingPricePack = Number(item.sellingPricePack) || 0;
          const rawUnitPrice = item.sellingPriceUnit && Number(item.sellingPriceUnit) > 0
            ? Number(item.sellingPriceUnit)
            : (unitsPerPack > 1 ? (sellingPricePack / unitsPerPack) : sellingPricePack);
          const sellingPriceUnit = rawUnitPrice > 0
            ? (unitsPerPack > 1 ? Math.max(250, Math.round(rawUnitPrice / 250) * 250) : rawUnitPrice)
            : 0;
          const lineCostBeforeDirect = quantityPacks * netCostPack;
          const lineShareOfDirectDiscount = subtotalAfterItemDiscounts > 0 && directDiscountAmount > 0
            ? (lineCostBeforeDirect / subtotalAfterItemDiscounts) * directDiscountAmount
            : 0;
          const finalLineNet = Math.max(0, lineCostBeforeDirect - lineShareOfDirectDiscount);
          const totalCost = finalLineNet;
          const amortizeBonus = item.amortizeBonus !== false;
          const totalPacks = quantityPacks + bonusPacks;
          const effectiveNetCostPack = (amortizeBonus && bonusPacks > 0)
            ? (totalPacks > 0 ? Number((finalLineNet / totalPacks).toFixed(2)) : purchasePricePack)
            : (quantityPacks > 0 ? Number((finalLineNet / quantityPacks).toFixed(2)) : purchasePricePack);

          let expiryDate: Date | null = null;
          if (item.expiryDate && String(item.expiryDate).trim() && String(item.expiryDate).trim() !== 'null') {
            const d = new Date(item.expiryDate);
            if (!isNaN(d.getTime())) expiryDate = d;
          }

          const batchNumber = (item.batchNumber && String(item.batchNumber).trim() && String(item.batchNumber).trim() !== 'null' && String(item.batchNumber).trim() !== 'N/A')
            ? String(item.batchNumber).trim()
            : null;

          const finalTradeName = (item.customTradeName || item.tradeName || 'دواء جديد').trim();

          // Ensure medicine exists in public.medicines
          let medicineId = item.medicineId;
          if (medicineId) {
            const check = await tx.$queryRawUnsafe<any[]>(
              `SELECT id FROM public.medicines WHERE id = $1::uuid LIMIT 1;`,
              medicineId,
            );
            if (check.length === 0) {
              medicineId = undefined;
            }
          }

          if (!medicineId) {
            const existingMed: any[] = await tx.$queryRawUnsafe(`
              SELECT id FROM public.medicines 
              WHERE trade_name ILIKE $1 OR (barcode IS NOT NULL AND barcode = $2)
              LIMIT 1;
            `, finalTradeName, item.barcode || '__NO_BARCODE__');

            if (existingMed.length > 0) {
              medicineId = existingMed[0].id;
            } else {
              const createdMed: any[] = await tx.$queryRawUnsafe(`
                INSERT INTO public.medicines (
                  "id", "trade_name", "scientific_name", "barcode", "default_units_per_pack", "is_verified"
                ) VALUES (
                  gen_random_uuid(), $1, $2, $3, $4, false
                ) RETURNING id;
              `,
                finalTradeName,
                item.scientificName || finalTradeName,
                item.barcode || null,
                unitsPerPack
              );
              medicineId = createdMed[0].id;
            }
          }

          if (medicineId) {
            processedMedicineIds.push(medicineId);
          }

          // Find or create InventoryItem in Tenant schema
          let inventoryItem = (
            await tx.$queryRawUnsafe<Array<{
              id: string;
              units_per_pack: number;
              selling_price_pack: number;
              selling_price_unit: number;
              shelf_location: string | null;
            }>>(`
              SELECT id, units_per_pack, selling_price_pack, selling_price_unit, shelf_location 
              FROM "${schema}"."inventory_items" 
              WHERE "medicine_id" = $1::uuid LIMIT 1;
            `, medicineId)
          )[0];

          let inventoryItemId: string;

          // Resolve autofill values from previous pharmacy records if not passed or 0
          const resolvedUnits = Number(
            unitsPerPack > 1 ? unitsPerPack : inventoryItem?.units_per_pack || 1,
          );
          const resolvedSellingPack = Number(
            sellingPricePack > 0 ? sellingPricePack : inventoryItem?.selling_price_pack || 0,
          );
          let resolvedSellingUnit = Number(
            sellingPriceUnit > 0 ? sellingPriceUnit : inventoryItem?.selling_price_unit || 0,
          );
          if (resolvedSellingUnit <= 0 && resolvedSellingPack > 0 && resolvedUnits > 0) {
            resolvedSellingUnit = resolvedUnits > 1
              ? Math.max(250, Math.round((resolvedSellingPack / resolvedUnits) / 250) * 250)
              : resolvedSellingPack;
          } else if (resolvedSellingUnit > 0 && resolvedUnits > 1) {
            resolvedSellingUnit = Math.max(250, Math.round(resolvedSellingUnit / 250) * 250);
          }
          const resolvedShelf =
            item.shelfLocation && item.shelfLocation.trim().length > 0
              ? item.shelfLocation.trim()
              : inventoryItem?.shelf_location || null;

          // Clinical safety: NEVER inherit expiry date from previous batches (a new batch has its own independent expiry)
          const resolvedExpiryDate: Date | null = expiryDate;

          if (!inventoryItem) {
            const createdInv = await tx.$queryRawUnsafe<Array<{ id: string }>>(`
              INSERT INTO "${schema}"."inventory_items" (
                "medicine_id", "custom_name", "units_per_pack", "selling_price_pack", "selling_price_unit", "min_alert_units", "is_public_visible", "shelf_location"
              ) VALUES (
                $1::uuid, $2, $3, $4, $5, 5, true, $6
              ) RETURNING id;
            `, medicineId, finalTradeName, resolvedUnits, resolvedSellingPack, resolvedSellingUnit, resolvedShelf);
            inventoryItemId = createdInv[0].id;
          } else {
            inventoryItemId = inventoryItem.id;
            // Update price, units, and shelf
            await tx.$executeRawUnsafe(`
              UPDATE "${schema}"."inventory_items"
              SET "selling_price_pack" = CASE WHEN $1 > 0 THEN $1 ELSE "selling_price_pack" END,
                  "selling_price_unit" = CASE WHEN $2 > 0 THEN $2 ELSE "selling_price_unit" END,
                  "units_per_pack" = CASE WHEN $3 > 1 THEN $3 ELSE "units_per_pack" END,
                  "custom_name" = COALESCE($4, "custom_name"),
                  "shelf_location" = COALESCE($5, "shelf_location"),
                  "updated_at" = CURRENT_TIMESTAMP
              WHERE "id" = $6::uuid;
            `, resolvedSellingPack, resolvedSellingUnit, resolvedUnits, finalTradeName, resolvedShelf, inventoryItemId);
          }

          // Insert into purchase_items
          await tx.$executeRawUnsafe(`
            INSERT INTO "${schema}"."purchase_items" (
              "purchase_id", "inventory_item_id", "quantity_packs", "bonus_packs", "amortize_bonus", "units_per_pack",
              "purchase_price_pack", "discount_percent", "net_cost_pack", "selling_price_pack", "selling_price_unit",
              "expiry_date", "batch_number"
            ) VALUES (
              $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
            );
          `,
            purchaseId,
            inventoryItemId,
            quantityPacks,
            bonusPacks,
            amortizeBonus,
            resolvedUnits,
            purchasePricePack,
            discountPercent,
            netCostPack,
            resolvedSellingPack,
            resolvedSellingUnit,
            resolvedExpiryDate,
            batchNumber
          );

          // Insert into purchase_invoice_items
          await tx.$executeRawUnsafe(`
            INSERT INTO "${schema}"."purchase_invoice_items" (
              "purchase_invoice_id", "medicine_id", "trade_name", "scientific_name",
              "batch_number", "expiry_date", "quantity_packs", "bonus_packs", "amortize_bonus", "units_per_pack",
              "purchase_price_pack", "discount_percent", "selling_price_pack", "total_cost"
            ) VALUES (
              $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
            );
          `,
            invoiceId,
            medicineId,
            finalTradeName,
            item.scientificName || null,
            batchNumber,
            resolvedExpiryDate,
            quantityPacks,
            bonusPacks,
            amortizeBonus,
            resolvedUnits,
            purchasePricePack,
            discountPercent,
            resolvedSellingPack,
            totalCost
          );

          // Add Batch(es) to Inventory
          if (!amortizeBonus && bonusPacks > 0) {
            // 1. Purchased Batch (وجبة الشراء الأصلية بكامل السعر)
            const purchasedBatchUnits = quantityPacks * resolvedUnits;
            await tx.$executeRawUnsafe(`
              INSERT INTO "${schema}"."inventory_batches" (
                "inventory_item_id", "supplier_id", "purchase_id", "batch_number", "purchase_price_pack",
                "selling_price_pack", "selling_price_unit", "quantity_units_remaining", "expiry_date", "is_recalled", "is_bonus"
              ) VALUES (
                $1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, FALSE, FALSE
              );
            `,
              inventoryItemId,
              finalSupplierId,
              purchaseId,
              batchNumber,
              effectiveNetCostPack,
              resolvedSellingPack,
              resolvedSellingUnit,
              purchasedBatchUnits,
              resolvedExpiryDate
            );

            // 2. Bonus Batch (وجبة بونص كوجبة دواء مستقلة بسعر شراء 0 د.ع)
            const bonusBatchUnits = bonusPacks * resolvedUnits;
            const bonusBatchNumber = (item.bonusBatchNumber && String(item.bonusBatchNumber).trim().length > 0 && String(item.bonusBatchNumber).trim() !== 'null' && String(item.bonusBatchNumber).trim() !== 'N/A')
              ? String(item.bonusBatchNumber).trim()
              : (batchNumber ? `${batchNumber}-BONUS` : null);
            let bonusExpiryDate = resolvedExpiryDate;
            if (item.bonusExpiryDate && String(item.bonusExpiryDate).trim()) {
              const bd = new Date(item.bonusExpiryDate);
              if (!isNaN(bd.getTime())) bonusExpiryDate = bd;
            }

            await tx.$executeRawUnsafe(`
              INSERT INTO "${schema}"."inventory_batches" (
                "inventory_item_id", "supplier_id", "purchase_id", "batch_number", "purchase_price_pack",
                "selling_price_pack", "selling_price_unit", "quantity_units_remaining", "expiry_date", "is_recalled", "is_bonus"
              ) VALUES (
                $1::uuid, $2::uuid, $3::uuid, $4, 0, $5, $6, $7, $8, FALSE, TRUE
              );
            `,
              inventoryItemId,
              finalSupplierId,
              purchaseId,
              bonusBatchNumber,
              resolvedSellingPack,
              resolvedSellingUnit,
              bonusBatchUnits,
              bonusExpiryDate
            );
          } else {
            // Amortized Batch (وجبة مدمجة مذوّبة)
            const totalBatchUnits = (quantityPacks + bonusPacks) * resolvedUnits;
            await tx.$executeRawUnsafe(`
              INSERT INTO "${schema}"."inventory_batches" (
                "inventory_item_id", "supplier_id", "purchase_id", "batch_number", "purchase_price_pack",
                "selling_price_pack", "selling_price_unit", "quantity_units_remaining", "expiry_date", "is_recalled", "is_bonus"
              ) VALUES (
                $1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, FALSE, FALSE
              );
            `,
              inventoryItemId,
              finalSupplierId,
              purchaseId,
              batchNumber,
              effectiveNetCostPack,
              resolvedSellingPack,
              resolvedSellingUnit,
              totalBatchUnits,
              resolvedExpiryDate
            );
          }
        }

        // 5. Record payment in supplier_payments if paidAmount > 0
        if (paidAmount > 0 && finalSupplierId) {
          await tx.$executeRawUnsafe(`
            INSERT INTO "${schema}"."supplier_payments" (
              "supplier_id", "purchase_id", "amount", "payment_date", "payment_method", "receipt_number", "notes"
            ) VALUES (
              $1::uuid, $2::uuid, $3, $4, 'CASH', $5, $6
            );
          `,
            finalSupplierId,
            purchaseId,
            paidAmount,
            invoiceDate,
            invoiceNumber,
            `دفعة مسددة عند استلام فاتورة ${invoiceNumber}`
          );
        }

        return {
          invoiceId,
          invoiceNumber,
          totalAmount,
          itemsCount: dto.items.length,
          processedMedicineIds,
        };
      },
      {
        maxWait: 10000,
        timeout: 30000,
      }
    );

    // 6. Emit background sync event to update CentralSearchIndex for Public Search ONLY after transaction commits
    if (transactionResult.processedMedicineIds.length > 0) {
      this.eventEmitter.emit('inventory.synced', {
        tenantId,
        schemaName: schema,
        medicineIds: Array.from(new Set(transactionResult.processedMedicineIds)),
      });
    }

    return {
      message: 'تم تسجيل فاتورة الشراء وتحديث المخزون والوجبات بنجاح',
      invoiceId: transactionResult.invoiceId,
      invoiceNumber: transactionResult.invoiceNumber,
      totalAmount: transactionResult.totalAmount,
      itemsCount: transactionResult.itemsCount,
    };
  }

  /**
   * Get purchase invoices history with supplier details and items summary
   */
  async getPurchases(tenantId: string, search?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || !tenant.schemaName) {
      throw new BadRequestException('الصيدلية غير متوفرة');
    }

    const schema = tenant.schemaName;

    let query = `
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
      FROM "${schema}"."purchase_invoices" pi
      LEFT JOIN "${schema}"."purchases" p ON pi.id = p.id
    `;

    const params: any[] = [];
    if (search && search.trim()) {
      query += ` WHERE pi.invoice_number ILIKE $1 OR pi.supplier_name ILIKE $1`;
      params.push(`%${search.trim()}%`);
    }

    query += ` ORDER BY pi.created_at DESC LIMIT 100;`;

    const invoices = await this.prisma.$queryRawUnsafe<any[]>(query, ...params);
    const now = Date.now();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;

    return invoices.map((inv) => {
      const createdAt = inv.createdAt ? new Date(inv.createdAt).getTime() : 0;
      const diffMs = now - createdAt;
      const canEdit = diffMs >= 0 && diffMs <= twentyFourHoursMs;
      const remainingMs = Math.max(0, twentyFourHoursMs - diffMs);
      return {
        ...inv,
        canEdit,
        remainingHours: Math.floor(remainingMs / (60 * 60 * 1000)),
        remainingMinutes: Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000)),
      };
    });
  }

  /**
   * Get single purchase invoice details including all items, batch status, and 24h edit eligibility
   */
  async getPurchaseById(tenantId: string, id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || !tenant.schemaName) {
      throw new BadRequestException('الصيدلية غير متوفرة');
    }

    const schema = tenant.schemaName;

    const invoices = await this.prisma.$queryRawUnsafe<any[]>(`
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
      FROM "${schema}"."purchase_invoices" pi
      LEFT JOIN "${schema}"."purchases" p ON pi.id = p.id
      WHERE pi.id = $1::uuid;
    `, id);

    if (!invoices || invoices.length === 0) {
      throw new NotFoundException('فاتورة الشراء غير موجودة');
    }

    const invoice = invoices[0];

    const items = await this.prisma.$queryRawUnsafe<any[]>(`
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
      FROM "${schema}"."purchase_invoice_items" pii
      LEFT JOIN "${schema}"."inventory_items" ii ON ii.medicine_id = pii.medicine_id
      WHERE pii.purchase_invoice_id = $1::uuid
      ORDER BY pii.trade_name ASC;
    `, id);

    const batches = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        b.id,
        b.inventory_item_id as "inventoryItemId",
        b.batch_number as "batchNumber",
        b.quantity_units_remaining as "quantityUnitsRemaining",
        b.is_bonus as "isBonus",
        b.expiry_date as "expiryDate"
      FROM "${schema}"."inventory_batches" b
      WHERE b.purchase_id = $1::uuid;
    `, id);

    const createdAt = invoice.createdAt ? new Date(invoice.createdAt) : new Date();
    const now = Date.now();
    const diffMs = now - createdAt.getTime();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;
    const canEdit = diffMs >= 0 && diffMs <= twentyFourHoursMs;
    const remainingMs = Math.max(0, twentyFourHoursMs - diffMs);
    const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
    const remainingMinutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

    const enrichedItems = items.map((item) => {
      const itemBatches = batches.filter((b) => b.inventoryItemId === item.inventoryItemId);
      const unitsRemaining = itemBatches.reduce((sum, b) => sum + Number(b.quantityUnitsRemaining || 0), 0);
      const unitsPerPack = Number(item.unitsPerPack) || 1;
      const initialUnits = ((Number(item.quantityPacks) || 0) + (Number(item.bonusPacks) || 0)) * unitsPerPack;
      const soldUnits = Math.max(0, initialUnits - unitsRemaining);
      const minAllowedPacks = Math.ceil(soldUnits / unitsPerPack);
      const canDelete = soldUnits === 0;

      return {
        ...item,
        quantityPacks: Number(item.quantityPacks) || 0,
        bonusPacks: Number(item.bonusPacks) || 0,
        unitsPerPack,
        purchasePricePack: Number(item.purchasePricePack) || 0,
        discountPercent: Number(item.discountPercent) || 0,
        sellingPricePack: Number(item.sellingPricePack) || 0,
        sellingPriceUnit: Number(item.sellingPriceUnit) || 0,
        totalCost: Number(item.totalCost) || 0,
        initialUnits,
        unitsRemaining,
        soldUnits,
        minAllowedPacks,
        canDelete,
      };
    });

    return {
      ...invoice,
      canEdit,
      remainingHours,
      remainingMinutes,
      remainingMs,
      items: enrichedItems,
    };
  }

  /**
   * Update purchase invoice within 24 hours of creation
   * Strictly enforces:
   * 1. 24-hour time window (throws ForbiddenException if elapsed)
   * 2. POS sales safety: cannot decrease quantities below units already sold in POS
   * 3. Cannot delete items that have recorded POS sales
   * 4. Synchronizes inventory batches, inventory items, purchases, invoices, and payments atomically
   */
  async updatePurchase(tenantId: string, purchaseId: string, dto: UpdatePurchaseDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || !tenant.schemaName) {
      throw new BadRequestException('الصيدلية غير متوفرة');
    }

    const schema = tenant.schemaName;

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('يجب أن تحتوي الفاتورة على مادة واحدة على الأقل');
    }

    const transactionResult = await this.prisma.$transaction(
      async (tx) => {
        // 1. Fetch existing invoice FOR UPDATE
        const existingInvoices = await tx.$queryRawUnsafe<any[]>(`
          SELECT * FROM "${schema}"."purchase_invoices"
          WHERE id = $1::uuid
          FOR UPDATE;
        `, purchaseId);

        if (!existingInvoices || existingInvoices.length === 0) {
          throw new NotFoundException('فاتورة الشراء غير موجودة');
        }

        const existingInvoice = existingInvoices[0];

        // 2. Enforce 24-hour edit window
        const createdAt = new Date(existingInvoice.created_at);
        const now = new Date();
        const diffMs = now.getTime() - createdAt.getTime();
        const twentyFourHoursMs = 24 * 60 * 60 * 1000;
        if (diffMs > twentyFourHoursMs) {
          throw new ForbiddenException(
            'انقضت مهلة الـ 24 ساعة المسموحة لتعديل هذه الفاتورة. أصبحت الفاتورة للقراءة والطباعة فقط حفاظاً على دقة الحسابات والمخزون.'
          );
        }

        // 3. Resolve Supplier strictly in tenant schema
        let finalSupplierId = dto.supplierId || existingInvoice.supplier_id || null;
        let resolvedSupplierName = (dto.supplierName || existingInvoice.supplier_name || '').trim();

        if (finalSupplierId && finalSupplierId !== existingInvoice.supplier_id) {
          const existingSupp: any[] = await tx.$queryRawUnsafe(`
            SELECT id, name FROM "${schema}"."suppliers" WHERE id = $1::uuid LIMIT 1;
          `, finalSupplierId);
          if (existingSupp.length > 0) {
            resolvedSupplierName = existingSupp[0].name;
          }
        } else if (dto.supplierName && dto.supplierName.trim() !== (existingInvoice.supplier_name || '').trim()) {
          const existingSupp: any[] = await tx.$queryRawUnsafe(`
            SELECT id, name FROM "${schema}"."suppliers" WHERE LOWER(name) = LOWER($1) LIMIT 1;
          `, resolvedSupplierName);
          if (existingSupp.length > 0) {
            finalSupplierId = existingSupp[0].id;
            resolvedSupplierName = existingSupp[0].name;
          } else {
            const createdSupp: any[] = await tx.$queryRawUnsafe(`
              INSERT INTO "${schema}"."suppliers" ("name", "created_at")
              VALUES ($1, NOW())
              RETURNING id, name;
            `, resolvedSupplierName);
            finalSupplierId = createdSupp[0].id;
            resolvedSupplierName = createdSupp[0].name;
          }
        }

        const invoiceNumber = (dto.invoiceNumber || existingInvoice.invoice_number || '').trim();
        const invoiceDate = dto.invoiceDate ? new Date(dto.invoiceDate) : existingInvoice.invoice_date;

        // 4. Fetch existing purchase items and batches FOR UPDATE
        const existingPurchaseItems = await tx.$queryRawUnsafe<any[]>(`
          SELECT pi.*, ii.medicine_id, ii.custom_name as trade_name
          FROM "${schema}"."purchase_items" pi
          JOIN "${schema}"."inventory_items" ii ON pi.inventory_item_id = ii.id
          WHERE pi.purchase_id = $1::uuid;
        `, purchaseId);

        const existingBatches = await tx.$queryRawUnsafe<any[]>(`
          SELECT b.*, ii.medicine_id
          FROM "${schema}"."inventory_batches" b
          JOIN "${schema}"."inventory_items" ii ON b.inventory_item_id = ii.id
          WHERE b.purchase_id = $1::uuid
          FOR UPDATE;
        `, purchaseId);

        // Group existing batches by medicine_id
        const batchesByMedicine = new Map<string, any[]>();
        for (const b of existingBatches) {
          const list = batchesByMedicine.get(b.medicine_id) || [];
          list.push(b);
          batchesByMedicine.set(b.medicine_id, list);
        }

        // Map existing purchase items by medicine_id
        const oldItemsByMedicine = new Map<string, any>();
        for (const pi of existingPurchaseItems) {
          oldItemsByMedicine.set(pi.medicine_id, pi);
        }

        // 5. Calculate financials
        let subtotalAfterItemDiscounts = 0;
        for (const item of dto.items) {
          const qty = Number(item.quantityPacks) || 0;
          const price = Number(item.purchasePricePack) || 0;
          const disc = Number(item.discountPercent) || 0;
          const netCostPack = price * (1 - disc / 100);
          subtotalAfterItemDiscounts += qty * netCostPack;
        }

        const directDiscountAmount = Number(dto.directDiscountAmount) || 0;
        const totalAmount = Math.max(0, subtotalAfterItemDiscounts - directDiscountAmount);
        const paidAmount = Number(dto.paidAmount !== undefined ? dto.paidAmount : existingInvoice.paid_amount) || 0;
        const remainingAmount = Math.max(0, totalAmount - paidAmount);
        const paymentStatus = remainingAmount <= 0 ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'UNPAID');

        const processedMedicineIds: string[] = [];
        const updatedMedicineIds = new Set<string>();

        // Clear existing purchase items and invoice items prior to re-inserting updated rows
        await tx.$executeRawUnsafe(`
          DELETE FROM "${schema}"."purchase_items" WHERE "purchase_id" = $1::uuid;
        `, purchaseId);

        await tx.$executeRawUnsafe(`
          DELETE FROM "${schema}"."purchase_invoice_items" WHERE "purchase_invoice_id" = $1::uuid;
        `, purchaseId);

        // 6. Process each item in dto.items
        for (const item of dto.items) {
          const quantityPacks = Number(item.quantityPacks) || 0;
          const bonusPacks = Number(item.bonusPacks) || 0;
          const purchasePricePack = Number(item.purchasePricePack) || 0;
          const discountPercent = Number(item.discountPercent) || 0;
          const netCostPack = purchasePricePack * (1 - discountPercent / 100);
          const unitsPerPack = Number(item.unitsPerPack) || 1;
          const sellingPricePack = Number(item.sellingPricePack) || 0;
          const rawUnitPrice = item.sellingPriceUnit && Number(item.sellingPriceUnit) > 0
            ? Number(item.sellingPriceUnit)
            : (unitsPerPack > 1 ? (sellingPricePack / unitsPerPack) : sellingPricePack);
          const sellingPriceUnit = rawUnitPrice > 0
            ? (unitsPerPack > 1 ? Math.max(250, Math.round(rawUnitPrice / 250) * 250) : rawUnitPrice)
            : 0;

          const lineCostBeforeDirect = quantityPacks * netCostPack;
          const lineShareOfDirectDiscount = subtotalAfterItemDiscounts > 0 && directDiscountAmount > 0
            ? (lineCostBeforeDirect / subtotalAfterItemDiscounts) * directDiscountAmount
            : 0;
          const finalLineNet = Math.max(0, lineCostBeforeDirect - lineShareOfDirectDiscount);
          const totalCost = finalLineNet;
          const amortizeBonus = item.amortizeBonus !== false;
          const totalPacks = quantityPacks + bonusPacks;
          const effectiveNetCostPack = (amortizeBonus && bonusPacks > 0)
            ? (totalPacks > 0 ? Number((finalLineNet / totalPacks).toFixed(2)) : purchasePricePack)
            : (quantityPacks > 0 ? Number((finalLineNet / quantityPacks).toFixed(2)) : purchasePricePack);

          let expiryDate: Date | null = null;
          if (item.expiryDate && String(item.expiryDate).trim() && String(item.expiryDate).trim() !== 'null') {
            const d = new Date(item.expiryDate);
            if (!isNaN(d.getTime())) expiryDate = d;
          }

          const batchNumber = (item.batchNumber && String(item.batchNumber).trim() && String(item.batchNumber).trim() !== 'null' && String(item.batchNumber).trim() !== 'N/A')
            ? String(item.batchNumber).trim()
            : null;

          const finalTradeName = (item.tradeName || 'دواء جديد').trim();

          // Resolve medicine in public.medicines
          let medicineId = item.medicineId;
          if (medicineId) {
            const check = await tx.$queryRawUnsafe<any[]>(
              `SELECT id FROM public.medicines WHERE id = $1::uuid LIMIT 1;`,
              medicineId
            );
            if (check.length === 0) medicineId = undefined;
          }

          if (!medicineId) {
            const existingMed = await tx.$queryRawUnsafe<any[]>(`
              SELECT id FROM public.medicines 
              WHERE trade_name ILIKE $1 OR (barcode IS NOT NULL AND barcode = $2)
              LIMIT 1;
            `, finalTradeName, item.barcode || '__NO_BARCODE__');

            if (existingMed.length > 0) {
              medicineId = existingMed[0].id;
            } else {
              const createdMed = await tx.$queryRawUnsafe<any[]>(`
                INSERT INTO public.medicines (
                  "id", "trade_name", "scientific_name", "barcode", "default_units_per_pack", "is_verified"
                ) VALUES (
                  gen_random_uuid(), $1, $2, $3, $4, false
                ) RETURNING id;
              `,
                finalTradeName,
                item.scientificName || finalTradeName,
                item.barcode || null,
                unitsPerPack
              );
              medicineId = createdMed[0].id;
            }
          }

          const finalMedicineId: string = medicineId!;
          processedMedicineIds.push(finalMedicineId);
          updatedMedicineIds.add(finalMedicineId);

          // Find or create InventoryItem in Tenant schema
          let inventoryItem = (
            await tx.$queryRawUnsafe<Array<{
              id: string;
              units_per_pack: number;
              selling_price_pack: number;
              selling_price_unit: number;
              shelf_location: string | null;
            }>>(`
              SELECT id, units_per_pack, selling_price_pack, selling_price_unit, shelf_location 
              FROM "${schema}"."inventory_items" 
              WHERE "medicine_id" = $1::uuid LIMIT 1;
            `, finalMedicineId)
          )[0];

          let inventoryItemId: string;
          const resolvedUnits = Number(unitsPerPack > 1 ? unitsPerPack : inventoryItem?.units_per_pack || 1);
          const resolvedSellingPack = Number(sellingPricePack > 0 ? sellingPricePack : inventoryItem?.selling_price_pack || 0);
          let resolvedSellingUnit = Number(sellingPriceUnit > 0 ? sellingPriceUnit : inventoryItem?.selling_price_unit || 0);
          if (resolvedSellingUnit <= 0 && resolvedSellingPack > 0 && resolvedUnits > 0) {
            resolvedSellingUnit = resolvedUnits > 1
              ? Math.max(250, Math.round((resolvedSellingPack / resolvedUnits) / 250) * 250)
              : resolvedSellingPack;
          }

          const resolvedShelf = item.shelfLocation && item.shelfLocation.trim().length > 0
            ? item.shelfLocation.trim()
            : inventoryItem?.shelf_location || null;

          if (!inventoryItem) {
            const createdInv = await tx.$queryRawUnsafe<Array<{ id: string }>>(`
              INSERT INTO "${schema}"."inventory_items" (
                "medicine_id", "custom_name", "units_per_pack", "selling_price_pack", "selling_price_unit", "min_alert_units", "is_public_visible", "shelf_location"
              ) VALUES (
                $1::uuid, $2, $3, $4, $5, 5, true, $6
              ) RETURNING id;
            `, medicineId, finalTradeName, resolvedUnits, resolvedSellingPack, resolvedSellingUnit, resolvedShelf);
            inventoryItemId = createdInv[0].id;
          } else {
            inventoryItemId = inventoryItem.id;
            await tx.$executeRawUnsafe(`
              UPDATE "${schema}"."inventory_items"
              SET "selling_price_pack" = CASE WHEN $1 > 0 THEN $1 ELSE "selling_price_pack" END,
                  "selling_price_unit" = CASE WHEN $2 > 0 THEN $2 ELSE "selling_price_unit" END,
                  "units_per_pack" = CASE WHEN $3 > 1 THEN $3 ELSE "units_per_pack" END,
                  "custom_name" = COALESCE($4, "custom_name"),
                  "shelf_location" = COALESCE($5, "shelf_location"),
                  "updated_at" = CURRENT_TIMESTAMP
              WHERE "id" = $6::uuid;
            `, resolvedSellingPack, resolvedSellingUnit, resolvedUnits, finalTradeName, resolvedShelf, inventoryItemId);
          }

          // POS Sales Safety Validation
          const oldItem = oldItemsByMedicine.get(finalMedicineId);
          const mBatches = batchesByMedicine.get(finalMedicineId) || [];
          let soldUnits = 0;
          if (oldItem) {
            const oldInitialUnits = ((Number(oldItem.quantity_packs) || 0) + (Number(oldItem.bonus_packs) || 0)) * (Number(oldItem.units_per_pack) || 1);
            const oldRemainingUnits = mBatches.reduce((sum, b) => sum + Number(b.quantity_units_remaining || 0), 0);
            soldUnits = Math.max(0, oldInitialUnits - oldRemainingUnits);
          }

          const newTotalUnits = (quantityPacks + bonusPacks) * resolvedUnits;
          if (soldUnits > 0 && newTotalUnits < soldUnits) {
            const minAllowedPacks = Math.ceil(soldUnits / resolvedUnits);
            throw new BadRequestException(
              `لا يمكن تقليل كمية (${finalTradeName}) إلى أقل من الكمية المباعة بالفعل في الكاشير (${soldUnits} وحدة / ما لا يقل عن ${minAllowedPacks} علبة)`
            );
          }

          // Update or Insert Batches
          if (mBatches.length > 0) {
            const newRemaining = Math.max(0, newTotalUnits - soldUnits);
            const mainBatch = mBatches[0];
            await tx.$executeRawUnsafe(`
              UPDATE "${schema}"."inventory_batches"
              SET "batch_number" = $1,
                  "purchase_price_pack" = $2,
                  "selling_price_pack" = $3,
                  "selling_price_unit" = $4,
                  "quantity_units_remaining" = $5,
                  "expiry_date" = $6,
                  "supplier_id" = $7::uuid
              WHERE "id" = $8::uuid;
            `,
              batchNumber,
              effectiveNetCostPack,
              resolvedSellingPack,
              resolvedSellingUnit,
              newRemaining,
              expiryDate,
              finalSupplierId,
              mainBatch.id
            );

            // Clean up any extra secondary batch if user changed bonus scheme
            if (mBatches.length > 1) {
              for (let bIdx = 1; bIdx < mBatches.length; bIdx++) {
                await tx.$executeRawUnsafe(`
                  DELETE FROM "${schema}"."inventory_batches" WHERE id = $1::uuid;
                `, mBatches[bIdx].id);
              }
            }
          } else {
            // New medicine added to this purchase during update
            await tx.$executeRawUnsafe(`
              INSERT INTO "${schema}"."inventory_batches" (
                "inventory_item_id", "supplier_id", "purchase_id", "batch_number", "purchase_price_pack",
                "selling_price_pack", "selling_price_unit", "quantity_units_remaining", "expiry_date", "is_recalled", "is_bonus"
              ) VALUES (
                $1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, FALSE, FALSE
              );
            `,
              inventoryItemId,
              finalSupplierId,
              purchaseId,
              batchNumber,
              effectiveNetCostPack,
              resolvedSellingPack,
              resolvedSellingUnit,
              newTotalUnits,
              expiryDate
            );
          }

          // Insert into purchase_items
          await tx.$executeRawUnsafe(`
            INSERT INTO "${schema}"."purchase_items" (
              "purchase_id", "inventory_item_id", "quantity_packs", "bonus_packs", "amortize_bonus", "units_per_pack",
              "purchase_price_pack", "discount_percent", "net_cost_pack", "selling_price_pack", "selling_price_unit",
              "expiry_date", "batch_number"
            ) VALUES (
              $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
            );
          `,
            purchaseId,
            inventoryItemId,
            quantityPacks,
            bonusPacks,
            amortizeBonus,
            resolvedUnits,
            purchasePricePack,
            discountPercent,
            netCostPack,
            resolvedSellingPack,
            resolvedSellingUnit,
            expiryDate,
            batchNumber
          );

          // Insert into purchase_invoice_items
          await tx.$executeRawUnsafe(`
            INSERT INTO "${schema}"."purchase_invoice_items" (
              "purchase_invoice_id", "medicine_id", "trade_name", "scientific_name",
              "batch_number", "expiry_date", "quantity_packs", "bonus_packs", "amortize_bonus", "units_per_pack",
              "purchase_price_pack", "discount_percent", "selling_price_pack", "total_cost"
            ) VALUES (
              $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
            );
          `,
            purchaseId,
            finalMedicineId,
            finalTradeName,
            item.scientificName || null,
            batchNumber,
            expiryDate,
            quantityPacks,
            bonusPacks,
            amortizeBonus,
            resolvedUnits,
            purchasePricePack,
            discountPercent,
            resolvedSellingPack,
            totalCost
          );
        }

        // 7. Check removed items: if any deleted item had sales, reject! Otherwise delete batch.
        for (const [oldMedId, oldItem] of oldItemsByMedicine.entries()) {
          if (!updatedMedicineIds.has(oldMedId)) {
            const mBatches = batchesByMedicine.get(oldMedId) || [];
            const oldInitialUnits = ((Number(oldItem.quantity_packs) || 0) + (Number(oldItem.bonus_packs) || 0)) * (Number(oldItem.units_per_pack) || 1);
            const oldRemainingUnits = mBatches.reduce((sum, b) => sum + Number(b.quantity_units_remaining || 0), 0);
            const soldUnits = Math.max(0, oldInitialUnits - oldRemainingUnits);

            if (soldUnits > 0) {
              throw new BadRequestException(
                `لا يمكن حذف مادة (${oldItem.trade_name || 'دواء سابق'}) من الفاتورة لوجود مبيعات مسجلة منها في الكاشير (${soldUnits} وحدة).`
              );
            }

            // Safe to delete batch
            await tx.$executeRawUnsafe(`
              DELETE FROM "${schema}"."inventory_batches"
              WHERE "purchase_id" = $1::uuid AND "inventory_item_id" = $2::uuid;
            `, purchaseId, oldItem.inventory_item_id);
          }
        }

        // 8. Update purchases and purchase_invoices header
        await tx.$executeRawUnsafe(`
          UPDATE "${schema}"."purchases"
          SET "supplier_id" = $1::uuid,
              "supplier_name" = $2,
              "invoice_number" = $3,
              "total_gross_amount" = $4,
              "net_total_amount" = $5,
              "paid_amount" = $6,
              "remaining_amount" = $7,
              "payment_status" = $8,
              "notes" = $9
          WHERE "id" = $10::uuid;
        `,
          finalSupplierId,
          resolvedSupplierName,
          invoiceNumber,
          subtotalAfterItemDiscounts,
          totalAmount,
          paidAmount,
          remainingAmount,
          paymentStatus,
          dto.notes !== undefined ? dto.notes : existingInvoice.notes,
          purchaseId
        );

        await tx.$executeRawUnsafe(`
          UPDATE "${schema}"."purchase_invoices"
          SET "invoice_number" = $1,
              "supplier_id" = $2::uuid,
              "supplier_name" = $3,
              "invoice_date" = $4,
              "total_amount" = $5,
              "paid_amount" = $6,
              "remaining_amount" = $7,
              "notes" = $8,
              "items_count" = $9
          WHERE "id" = $10::uuid;
        `,
          invoiceNumber,
          finalSupplierId,
          resolvedSupplierName,
          invoiceDate,
          totalAmount,
          paidAmount,
          remainingAmount,
          dto.notes !== undefined ? dto.notes : existingInvoice.notes,
          dto.items.length,
          purchaseId
        );

        // 9. Sync supplier_payments
        const existingPayments = await tx.$queryRawUnsafe<any[]>(`
          SELECT id FROM "${schema}"."supplier_payments" WHERE purchase_id = $1::uuid LIMIT 1;
        `, purchaseId);

        if (existingPayments.length > 0) {
          if (paidAmount > 0) {
            await tx.$executeRawUnsafe(`
              UPDATE "${schema}"."supplier_payments"
              SET "amount" = $1,
                  "supplier_id" = $2::uuid,
                  "receipt_number" = $3,
                  "notes" = $4
              WHERE "id" = $5::uuid;
            `,
              paidAmount,
              finalSupplierId,
              invoiceNumber,
              `دفعة معدلة عند تحديث فاتورة ${invoiceNumber}`,
              existingPayments[0].id
            );
          } else {
            await tx.$executeRawUnsafe(`
              DELETE FROM "${schema}"."supplier_payments" WHERE "id" = $1::uuid;
            `, existingPayments[0].id);
          }
        } else if (paidAmount > 0 && finalSupplierId) {
          await tx.$executeRawUnsafe(`
            INSERT INTO "${schema}"."supplier_payments" (
              "supplier_id", "purchase_id", "amount", "payment_date", "payment_method", "receipt_number", "notes"
            ) VALUES (
              $1::uuid, $2::uuid, $3, $4, 'CASH', $5, $6
            );
          `,
            finalSupplierId,
            purchaseId,
            paidAmount,
            invoiceDate,
            invoiceNumber,
            `دفعة مسددة عند استلام فاتورة ${invoiceNumber}`
          );
        }

        return {
          invoiceId: purchaseId,
          invoiceNumber,
          totalAmount,
          processedMedicineIds,
        };
      },
      {
        maxWait: 15000,
        timeout: 60000,
      }
    );

    // 10. Emit background sync event
    if (transactionResult.processedMedicineIds.length > 0) {
      this.eventEmitter.emit('inventory.synced', {
        tenantId,
        schemaName: schema,
        medicineIds: Array.from(new Set(transactionResult.processedMedicineIds)),
      });
    }

    return {
      success: true,
      message: 'تم تحديث فاتورة الشراء والمخزون بنجاح',
      invoiceId: transactionResult.invoiceId,
      invoiceNumber: transactionResult.invoiceNumber,
      totalAmount: transactionResult.totalAmount,
    };
  }

  /**
   * Apply early settlement discount to a purchase invoice
   */
  async applyEarlyDiscount(tenantId: string, invoiceId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || !tenant.schemaName) {
      throw new BadRequestException('الصيدلية غير متوفرة');
    }

    const schema = tenant.schemaName;

    const { discountAmount, newRemaining } = await this.prisma.$transaction(
      async (tx) => {
        const invoices = await tx.$queryRawUnsafe<any[]>(`
          SELECT * FROM "${schema}"."purchase_invoices" WHERE id = $1::uuid;
        `, invoiceId);

        if (!invoices || invoices.length === 0) {
          throw new NotFoundException('فاتورة الشراء غير موجودة');
        }

        const inv = invoices[0];
        if (inv.early_discount_applied) {
          throw new BadRequestException('تم تطبيق خصم التسديد المبكر لهذه الفاتورة مسبقاً');
        }

        const totalAmount = Number(inv.total_amount) || 0;
        const remainingAmount = Number(inv.remaining_amount) || 0;
        let discountAmount = Number(inv.early_discount_amount);

        if (!discountAmount || discountAmount <= 0) {
          const pct = Number(inv.early_discount_percent) || 0;
          discountAmount = Math.round(totalAmount * (pct / 100));
        }

        if (discountAmount <= 0) {
          throw new BadRequestException('لا توجد نسبة خصم تسديد مبكر محددة لهذه الفاتورة');
        }

        const newRemaining = Math.max(0, remainingAmount - discountAmount);

        await tx.$executeRawUnsafe(`
          UPDATE "${schema}"."purchase_invoices"
          SET 
            early_discount_applied = TRUE,
            early_discount_applied_amount = $1,
            remaining_amount = $2,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $3::uuid;
        `, discountAmount, newRemaining, invoiceId);

        // Also update purchases table if exists
        try {
          await tx.$executeRawUnsafe(`
            UPDATE "${schema}"."purchases"
            SET 
              remaining_amount = $1,
              payment_status = CASE WHEN $1 <= 0 THEN 'PAID' ELSE 'PARTIAL' END
            WHERE id = $2::uuid;
          `, newRemaining, invoiceId);
        } catch (err) {
          // Ignore if table mismatch
        }

        return { discountAmount, newRemaining };
      },
      {
        maxWait: 15000,
        timeout: 60000,
      }
    );

    return {
      success: true,
      message: `تم تطبيق خصم التسديد المبكر بقيمة (${discountAmount.toLocaleString()} د.ع) وتخفيض الدين إلى (${newRemaining.toLocaleString()} د.ع)`,
      discountAmount,
      newRemainingAmount: newRemaining,
    };
  }

  /**
   * Get active early discount alerts for upcoming invoice deadlines
   */
  async getEarlyDiscountAlerts(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || !tenant.schemaName) {
      return [];
    }

    const schema = tenant.schemaName;

    const alerts = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        pi.id,
        pi.invoice_number as "invoiceNumber",
        pi.supplier_name as "supplierName",
        pi.total_amount as "totalAmount",
        pi.remaining_amount as "remainingAmount",
        pi.early_discount_days as "earlyDiscountDays",
        pi.early_discount_percent as "earlyDiscountPercent",
        pi.early_discount_deadline as "earlyDiscountDeadline",
        pi.early_discount_amount as "earlyDiscountAmount",
        (pi.early_discount_deadline::date - CURRENT_DATE) as "daysRemaining"
      FROM "${schema}"."purchase_invoices" pi
      WHERE pi.remaining_amount > 0
        AND (pi.early_discount_applied IS FALSE OR pi.early_discount_applied IS NULL)
        AND pi.early_discount_deadline IS NOT NULL
        AND pi.early_discount_deadline >= CURRENT_DATE
      ORDER BY pi.early_discount_deadline ASC
      LIMIT 20;
    `);

    return alerts;
  }
}
