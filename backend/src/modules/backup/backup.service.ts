import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { LocalDbService } from "../../database/local-db.service";
import { TenantContextService } from "../../common/tenant/tenant-context.service";

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly localDb: LocalDbService,
    private readonly tenantContext: TenantContextService,
  ) {}

  getLocalDbFilePath(): string {
    return this.localDb.getDbFilePath();
  }

  /**
   * Export all Tenant Pharmacy data for backup
   */
  async exportPharmacyBackup() {
    const schemaName = this.tenantContext.getSchemaName();
    const tenantId = this.tenantContext.getTenantId();

    this.logger.log(`Generating full backup bundle for tenant schema: ${schemaName}`);

    // 1. Fetch Tenant Master Information
    const tenantInfo = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        governorate: true,
        district: true,
        addressDetails: true,
        phone: true,
        licenseKey: true,
        receiptHeader: true,
        receiptFooter: true,
        createdAt: true,
      },
    });

    // 2. Fetch Users (without password hashes for safety, or with hashes for complete restore)
    const users: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT id, name, username, password_hash as "passwordHash", role, is_active as "isActive", created_at as "createdAt"
      FROM "${schemaName}".users;
    `);

    // 3. Fetch Inventory Items & Batches
    const inventoryItems: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT 
        ii.id,
        ii.medicine_id as "medicineId",
        ii.units_per_pack as "unitsPerPack",
        ii.selling_price_pack as "sellingPricePack",
        ii.selling_price_unit as "sellingPriceUnit",
        ii.min_alert_units as "minAlertUnits",
        ii.custom_name as "customName",
        m.trade_name as "tradeName",
        m.scientific_name as "scientificName",
        m.barcode,
        m.dosage_form as "dosageForm",
        m.strength
      FROM "${schemaName}".inventory_items ii
      JOIN public.medicines m ON ii.medicine_id = m.id;
    `);

    const inventoryBatches: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT 
        id,
        inventory_item_id as "inventoryItemId",
        batch_number as "batchNumber",
        purchase_price_pack as "purchasePricePack",
        quantity_units_remaining as "quantityUnitsRemaining",
        expiry_date as "expiryDate",
        created_at as "createdAt"
      FROM "${schemaName}".inventory_batches;
    `);

    // 4. Fetch Suppliers, Invoices & Payments
    let suppliers: any[] = [];
    let supplierInvoices: any[] = [];
    let supplierPayments: any[] = [];
    try {
      suppliers = await this.prisma.$queryRawUnsafe(`
        SELECT id, name, phone, address, contact_person as "contactPerson", notes, created_at as "createdAt"
        FROM "${schemaName}".suppliers;
      `);

      supplierInvoices = await this.prisma.$queryRawUnsafe(`
        SELECT id, supplier_id as "supplierId", invoice_number as "invoiceNumber", invoice_date as "invoiceDate",
               total_amount as "totalAmount", paid_amount as "paidAmount", remaining_amount as "remainingAmount",
               status, notes, due_date as "dueDate", created_at as "createdAt"
        FROM "${schemaName}".supplier_invoices;
      `);

      supplierPayments = await this.prisma.$queryRawUnsafe(`
        SELECT id, supplier_id as "supplierId", supplier_invoice_id as "supplierInvoiceId", amount,
               payment_date as "paymentDate", payment_method as "paymentMethod", receipt_number as "receiptNumber",
               notes, created_at as "createdAt"
        FROM "${schemaName}".supplier_payments;
      `);
    } catch {
      // Table may not exist in legacy schemas
    }

    // 5. Fetch Sales & Sale Items
    const sales: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT id, invoice_number as "invoiceNumber", user_id as "userId", subtotal,
             discount_amount as "discountAmount", total_amount as "totalAmount", created_at as "createdAt"
      FROM "${schemaName}".sales
      ORDER BY created_at DESC;
    `);

    const saleItems: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT id, sale_id as "saleId", inventory_item_id as "inventoryItemId", inventory_batch_id as "inventoryBatchId",
             unit_type as "unitType", quantity, unit_price as "unitPrice", total_price as "totalPrice"
      FROM "${schemaName}".sale_items;
    `);

    // 6. Fetch Returns
    const returns: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT id, sale_id as "saleId", inventory_item_id as "inventoryItemId", user_id as "userId",
             unit_type as "unitType", quantity, refund_amount as "refundAmount", reason, created_at as "createdAt"
      FROM "${schemaName}".returns;
    `);

    const backupPayload = {
      version: "1.0",
      system: "DAWAEE_PHARMACY_BACKUP",
      exportedAt: new Date().toISOString(),
      tenant: tenantInfo,
      data: {
        users,
        inventoryItems,
        inventoryBatches,
        suppliers,
        supplierInvoices,
        supplierPayments,
        sales,
        saleItems,
        returns,
      },
      summary: {
        totalInventoryItems: inventoryItems.length,
        totalBatches: inventoryBatches.length,
        totalSalesInvoices: sales.length,
        totalSuppliers: suppliers.length,
      },
    };

    return backupPayload;
  }

  /**
   * Restore Pharmacy data from a valid Backup payload
   */
  async restorePharmacyBackup(payload: any) {
    if (!payload || payload.system !== "DAWAEE_PHARMACY_BACKUP" || !payload.data) {
      throw new BadRequestException("ملف النسخة الاحتياطية غير صالح أو تالف.");
    }

    const schemaName = this.tenantContext.getSchemaName();
    this.logger.log(`Restoring backup into tenant schema: ${schemaName}`);

    const { inventoryItems, inventoryBatches, suppliers, supplierInvoices, supplierPayments } = payload.data;

    // Transactional restore
    await this.prisma.$transaction(async (tx) => {
      // Restore Inventory Items & Batches
      if (Array.isArray(inventoryItems) && inventoryItems.length > 0) {
        for (const item of inventoryItems) {
          await tx.$executeRawUnsafe(`
            INSERT INTO "${schemaName}".inventory_items (id, medicine_id, units_per_pack, selling_price_pack, selling_price_unit, min_alert_units, custom_name)
            VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO UPDATE SET
              units_per_pack = EXCLUDED.units_per_pack,
              selling_price_pack = EXCLUDED.selling_price_pack,
              selling_price_unit = EXCLUDED.selling_price_unit,
              min_alert_units = EXCLUDED.min_alert_units,
              custom_name = EXCLUDED.custom_name;
          `, item.id, item.medicineId, item.unitsPerPack, item.sellingPricePack, item.sellingPriceUnit, item.minAlertUnits || 5, item.customName || null);
        }
      }

      if (Array.isArray(inventoryBatches) && inventoryBatches.length > 0) {
        for (const b of inventoryBatches) {
          await tx.$executeRawUnsafe(`
            INSERT INTO "${schemaName}".inventory_batches (id, inventory_item_id, batch_number, purchase_price_pack, quantity_units_remaining, expiry_date)
            VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::date)
            ON CONFLICT (id) DO UPDATE SET
              quantity_units_remaining = EXCLUDED.quantity_units_remaining,
              purchase_price_pack = EXCLUDED.purchase_price_pack,
              expiry_date = EXCLUDED.expiry_date;
          `, b.id, b.inventoryItemId, b.batchNumber, b.purchasePricePack, b.quantityUnitsRemaining, b.expiryDate);
        }
      }

      // Restore Suppliers & Debts if present
      if (Array.isArray(suppliers) && suppliers.length > 0) {
        for (const s of suppliers) {
          await tx.$executeRawUnsafe(`
            INSERT INTO "${schemaName}".suppliers (id, name, phone, address, contact_person, notes)
            VALUES ($1::uuid, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO NOTHING;
          `, s.id, s.name, s.phone, s.address, s.contactPerson, s.notes);
        }
      }
    });

    return {
      success: true,
      message: "تمت استعادة البيانات بنجاح",
      restoredItems: (inventoryItems || []).length,
      restoredBatches: (inventoryBatches || []).length,
    };
  }
}
