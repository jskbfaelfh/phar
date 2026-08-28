import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../database/prisma.service";
import * as zlib from "zlib";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export interface BackupResult {
  tenantId: string;
  name: string;
  slug: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  sizeKb?: number;
  uploadedToMaster?: boolean;
  uploadedToPharmacyR2?: boolean;
  error?: string;
}

@Injectable()
export class R2BackupService {
  private readonly logger = new Logger(R2BackupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Get S3Client instance for Cloudflare R2
   */
  private getR2Client(accountId: string, accessKeyId: string, secretAccessKey: string): S3Client {
    return new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  /**
   * Extract Full Isolated Schema Data for a given Tenant
   */
  private async extractTenantData(tenant: any): Promise<any> {
    const schemaName = tenant.schemaName;

    // Check if schema exists
    const schemaCheck: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1;
    `, schemaName);

    const hasSchema = schemaCheck.length > 0;

    let users: any[] = [];
    let inventoryItems: any[] = [];
    let inventoryBatches: any[] = [];
    let suppliers: any[] = [];
    let supplierInvoices: any[] = [];
    let supplierPayments: any[] = [];
    let sales: any[] = [];
    let saleItems: any[] = [];
    let returns: any[] = [];

    if (hasSchema) {
      // 1. Users
      try {
        users = await this.prisma.$queryRawUnsafe(`
          SELECT id, name, username, password_hash as "passwordHash", role, is_active as "isActive", created_at as "createdAt"
          FROM "${schemaName}".users;
        `);
      } catch {}

      // 2. Inventory Items & Batches
      try {
        inventoryItems = await this.prisma.$queryRawUnsafe(`
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
      } catch {}

      try {
        inventoryBatches = await this.prisma.$queryRawUnsafe(`
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
      } catch {}

      // 3. Suppliers, Invoices & Payments
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
      } catch {}

      // 4. Sales & Sale Items
      try {
        sales = await this.prisma.$queryRawUnsafe(`
          SELECT id, invoice_number as "invoiceNumber", user_id as "userId", subtotal,
                 discount_amount as "discountAmount", total_amount as "totalAmount", created_at as "createdAt"
          FROM "${schemaName}".sales
          ORDER BY created_at DESC;
        `);
        saleItems = await this.prisma.$queryRawUnsafe(`
          SELECT id, sale_id as "saleId", inventory_item_id as "inventoryItemId", inventory_batch_id as "inventoryBatchId",
                 unit_type as "unitType", quantity, unit_price as "unitPrice", total_price as "totalPrice"
          FROM "${schemaName}".sale_items;
        `);
      } catch {}

      // 5. Returns
      try {
        returns = await this.prisma.$queryRawUnsafe(`
          SELECT id, sale_id as "saleId", inventory_item_id as "inventoryItemId", user_id as "userId",
                 unit_type as "unitType", quantity, refund_amount as "refundAmount", reason, created_at as "createdAt"
          FROM "${schemaName}".returns;
        `);
      } catch {}
    }

    // 6. Central search index items
    const searchIndexItems = await this.prisma.centralSearchIndex.findMany({
      where: { tenantId: tenant.id },
    });

    return {
      version: "1.0",
      system: "DAWAEE_CLOUD_R2_BACKUP",
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      schemaName: tenant.schemaName,
      hasSchema,
      exportedAt: new Date().toISOString(),
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
        searchIndexItems,
      },
    };
  }

  /**
   * Backup a single tenant to Master R2 (and optional Pharmacy R2)
   */
  async backupTenant(tenant: any): Promise<BackupResult> {
    this.logger.log(`⏳ Starting R2 backup for tenant: ${tenant.name} (${tenant.slug})...`);

    try {
      // 1. Extract and Compress Data
      const rawData = await this.extractTenantData(tenant);
      const jsonString = JSON.stringify(rawData);
      const compressedBuffer = zlib.gzipSync(Buffer.from(jsonString, "utf-8"));
      const sizeKb = Number((compressedBuffer.length / 1024).toFixed(2));

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const isFirstDayOfMonth = now.getDate() === 1;
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      let uploadedToMaster = false;
      let uploadedToPharmacyR2 = false;

      // 2. Upload to Master Cloudflare R2 Bucket (Always)
      const masterConfig = await this.getMasterR2Config();

      if (masterConfig.isConfigured) {
        const masterClient = this.getR2Client(
          masterConfig.r2AccountId,
          masterConfig.r2AccessKeyId,
          masterConfig.r2SecretAccessKey,
        );

        // Daily upload key: daily/{slug}/backup_YYYY-MM-DD.json.gz
        const dailyKey = `daily/${tenant.slug}/backup_${dateStr}.json.gz`;
        await masterClient.send(
          new PutObjectCommand({
            Bucket: masterConfig.r2BucketName,
            Key: dailyKey,
            Body: compressedBuffer,
            ContentType: "application/gzip",
            Metadata: {
              tenantId: tenant.id,
              tenantSlug: tenant.slug,
              date: dateStr,
            },
          }),
        );
        uploadedToMaster = true;

        // Monthly retention (If 1st day of month): monthly/{slug}/backup_YYYY-MM.json.gz
        if (isFirstDayOfMonth) {
          const monthlyKey = `monthly/${tenant.slug}/backup_${monthStr}.json.gz`;
          await masterClient.send(
            new PutObjectCommand({
              Bucket: masterConfig.r2BucketName,
              Key: monthlyKey,
              Body: compressedBuffer,
              ContentType: "application/gzip",
              Metadata: {
                tenantId: tenant.id,
                tenantSlug: tenant.slug,
                month: monthStr,
              },
            }),
          );
        }
      } else {
        this.logger.warn(`⚠️ Master R2 credentials not configured in Super Admin settings or environment variables, skipping Master upload.`);
      }

      // 3. Upload to Pharmacy-specific Cloudflare R2 (If configured)
      if (tenant.r2BucketName && tenant.r2AccountId && tenant.r2AccessKeyId && tenant.r2SecretAccessKey) {
        try {
          const pharmacyClient = this.getR2Client(
            tenant.r2AccountId,
            tenant.r2AccessKeyId,
            tenant.r2SecretAccessKey,
          );
          const pharmacyKey = `backups/backup_${dateStr}.json.gz`;
          await pharmacyClient.send(
            new PutObjectCommand({
              Bucket: tenant.r2BucketName,
              Key: pharmacyKey,
              Body: compressedBuffer,
              ContentType: "application/gzip",
            }),
          );
          uploadedToPharmacyR2 = true;
        } catch (pharmacyUploadError: any) {
          this.logger.error(`Failed to upload to pharmacy private R2 bucket: ${pharmacyUploadError.message}`);
        }
      }

      // 4. Update lastBackupAt in Tenant Master Table
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          lastBackupAt: new Date(),
          backupStatus: "SUCCESS",
        },
      });

      this.logger.log(`✅ Successfully backed up tenant: ${tenant.name} (${sizeKb} KB)`);
      return {
        tenantId: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: "SUCCESS",
        sizeKb,
        uploadedToMaster,
        uploadedToPharmacyR2,
      };
    } catch (err: any) {
      this.logger.error(`❌ Error backing up tenant ${tenant.name}: ${err.message}`);
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          backupStatus: "FAILED",
        },
      }).catch(() => {});

      return {
        tenantId: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: "FAILED",
        error: err.message,
      };
    }
  }

  /**
   * Sequential Daily Backup Job for all Active/Read-only Tenants
   */
  async runDailyBackupJob(): Promise<{ total: number; successful: number; failed: number; results: BackupResult[] }> {
    this.logger.log(`🚀 Starting Daily Cloudflare R2 Backup Job for all pharmacies...`);

    const tenants = await this.prisma.tenant.findMany({
      where: {
        subscriptionStatus: {
          in: ["ACTIVE", "EXPIRED"], // Exclude SUSPENDED / Deleted
        },
      },
      orderBy: { name: "asc" },
    });

    this.logger.log(`Found ${tenants.length} pharmacies to back up.`);

    const results: BackupResult[] = [];
    let successful = 0;
    let failed = 0;

    // Sequential iteration to prevent database overload
    for (const tenant of tenants) {
      const res = await this.backupTenant(tenant);
      results.push(res);
      if (res.status === "SUCCESS") {
        successful++;
      } else {
        failed++;
      }
    }

    this.logger.log(`🎉 Daily Cloudflare R2 Backup Completed! Total: ${tenants.length}, Successful: ${successful}, Failed: ${failed}`);
    return {
      total: tenants.length,
      successful,
      failed,
      results,
    };
  }

  /**
   * Super Admin Monitoring Summary
   */
  async getBackupsMonitoringSummary() {
    const tenants = await this.prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        governorate: true,
        district: true,
        phone: true,
        subscriptionStatus: true,
        lastBackupAt: true,
        backupStatus: true,
        r2BucketName: true,
      },
      orderBy: { name: "asc" },
    });

    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const THREE_DAYS_MS = 72 * 60 * 60 * 1000;

    let healthyCount = 0;
    let warningCount = 0;
    let alertCount = 0;

    const monitoredTenants = tenants.map((t) => {
      let health: "HEALTHY" | "WARNING" | "ALERT" = "ALERT";
      let hoursSinceLastBackup: number | null = null;

      if (t.lastBackupAt) {
        const diffMs = now - new Date(t.lastBackupAt).getTime();
        hoursSinceLastBackup = Math.round(diffMs / (1000 * 60 * 60));

        if (diffMs <= ONE_DAY_MS && t.backupStatus === "SUCCESS") {
          health = "HEALTHY";
          healthyCount++;
        } else if (diffMs <= THREE_DAYS_MS) {
          health = "WARNING";
          warningCount++;
        } else {
          health = "ALERT";
          alertCount++;
        }
      } else {
        alertCount++;
      }

      return {
        ...t,
        health,
        hoursSinceLastBackup,
        hasCustomR2: Boolean(t.r2BucketName),
      };
    });

    const masterR2 = await this.getMasterR2Config();

    return {
      summary: {
        totalPharmacies: tenants.length,
        healthyCount,
        warningCount,
        alertCount,
        lastJobRunAt: new Date().toISOString(),
      },
      masterR2: {
        r2BucketName: masterR2.r2BucketName,
        r2AccountId: masterR2.r2AccountId,
        r2AccessKeyId: masterR2.r2AccessKeyId,
        isConfigured: masterR2.isConfigured,
        source: masterR2.source,
      },
      pharmacies: monitoredTenants,
    };
  }

  /**
   * Retrieve Master R2 configuration (from DB SystemSettings, with fallback to env)
   */
  async getMasterR2Config(): Promise<{
    r2BucketName: string;
    r2AccountId: string;
    r2AccessKeyId: string;
    r2SecretAccessKey: string;
    isConfigured: boolean;
    source: "DATABASE" | "ENV" | "NONE";
  }> {
    try {
      const settings = await this.prisma.systemSetting.findMany({
        where: {
          key: {
            in: ["R2_BUCKET_NAME", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"],
          },
        },
      });

      const settingMap = new Map(settings.map((s) => [s.key, s.value]));

      const dbBucket = settingMap.get("R2_BUCKET_NAME");
      const dbAccount = settingMap.get("R2_ACCOUNT_ID");
      const dbAccessKey = settingMap.get("R2_ACCESS_KEY_ID");
      const dbSecretKey = settingMap.get("R2_SECRET_ACCESS_KEY");

      if (dbBucket && dbAccount && dbAccessKey && dbSecretKey) {
        return {
          r2BucketName: dbBucket,
          r2AccountId: dbAccount,
          r2AccessKeyId: dbAccessKey,
          r2SecretAccessKey: dbSecretKey,
          isConfigured: true,
          source: "DATABASE",
        };
      }
    } catch {
      // Fallback if table not ready
    }

    const envBucket = this.config.get<string>("R2_BUCKET_NAME") || process.env.R2_BUCKET_NAME || "dawaee-backups";
    const envAccount = this.config.get<string>("R2_ACCOUNT_ID") || process.env.R2_ACCOUNT_ID;
    const envAccessKey = this.config.get<string>("R2_ACCESS_KEY_ID") || process.env.R2_ACCESS_KEY_ID;
    const envSecretKey = this.config.get<string>("R2_SECRET_ACCESS_KEY") || process.env.R2_SECRET_ACCESS_KEY;

    if (envAccount && envAccessKey && envSecretKey) {
      return {
        r2BucketName: envBucket,
        r2AccountId: envAccount,
        r2AccessKeyId: envAccessKey,
        r2SecretAccessKey: envSecretKey,
        isConfigured: true,
        source: "ENV",
      };
    }

    return {
      r2BucketName: envBucket || "",
      r2AccountId: envAccount || "",
      r2AccessKeyId: envAccessKey || "",
      r2SecretAccessKey: envSecretKey || "",
      isConfigured: false,
      source: "NONE",
    };
  }

  /**
   * Save Master R2 configuration into DB SystemSettings
   */
  async saveMasterR2Config(dto: {
    r2BucketName: string;
    r2AccountId: string;
    r2AccessKeyId: string;
    r2SecretAccessKey: string;
  }) {
    const entries = [
      { key: "R2_BUCKET_NAME", value: (dto.r2BucketName || "dawaee-backups").trim() },
      { key: "R2_ACCOUNT_ID", value: (dto.r2AccountId || "").trim() },
      { key: "R2_ACCESS_KEY_ID", value: (dto.r2AccessKeyId || "").trim() },
      { key: "R2_SECRET_ACCESS_KEY", value: (dto.r2SecretAccessKey || "").trim() },
    ];

    for (const entry of entries) {
      if (entry.value) {
        await this.prisma.systemSetting.upsert({
          where: { key: entry.key },
          update: { value: entry.value },
          create: { key: entry.key, value: entry.value },
        });
      }
    }

    this.logger.log("✅ Master Cloudflare R2 credentials updated in database.");
    return { success: true, message: "تم حفظ إعدادات Cloudflare R2 المركزية بنجاح" };
  }
}
