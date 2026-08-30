import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Provision a new Tenant Pharmacy
   */
  async provisionPharmacy(dto: CreateTenantDto) {
    const rawSlug = dto.slug || dto.ownerUsername || `pharmacy_${Date.now()}`;
    const slug = rawSlug.toLowerCase().trim();

    // Check if slug already exists
    const existing = await this.prisma.tenant.findUnique({
      where: { slug },
    });

    if (existing) {
      throw new BadRequestException('معرف الصيدلية (Slug) مسجل مسبقاً، يرجى اختيار معرف آخر');
    }

    // Generate safe schema name: ph_<slug>_<rand>
    const randSuffix = crypto.randomBytes(3).toString('hex');
    const safeSlug = slug.replace(/[^a-z0-9_]/g, '_').slice(0, 30);
    const schemaName = `ph_${safeSlug}_${randSuffix}`;

    this.logger.log(`Starting schema provisioning for "${dto.name}" with schema: ${schemaName}`);

    // 1. Execute DDL to create isolated schema and all tenant tables
    await this.createTenantSchemaAndTables(schemaName);

    // 2. Hash Password for Owner
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(dto.ownerPassword, saltRounds);
    const ownerUserId = crypto.randomUUID();

    // 3. Insert Owner user record in the newly created tenant schema
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "${schemaName}".users (id, name, username, password_hash, role, is_active, created_at)
       VALUES ($1::uuid, $2, $3, $4, 'OWNER', TRUE, NOW())`,
      ownerUserId,
      dto.ownerName,
      dto.ownerUsername,
      passwordHash,
    );

    // 4. Create Cashier Accounts (Single or Multiple)
    const cashierAccounts: { username: string; password: string; name: string }[] = [];
    const count = dto.cashierCount !== undefined ? dto.cashierCount : (dto.createCashier !== false ? 1 : 0);

    for (let i = 1; i <= count; i++) {
      const suffix = count === 1 ? '_pos' : `_pos${i}`;
      const cashierUsername = `${dto.ownerUsername}${suffix}`;
      const cashierPassword = dto.cashierPassword || '123456';
      const cashierHash = await bcrypt.hash(cashierPassword, saltRounds);
      const cashierUserId = crypto.randomUUID();
      const cashierName = count === 1 ? `كاشير - ${dto.name}` : `كاشير ${i} - ${dto.name}`;

      await this.prisma.$executeRawUnsafe(
        `INSERT INTO "${schemaName}".users (id, name, username, password_hash, role, is_active, created_at)
         VALUES ($1::uuid, $2, $3, $4, 'CASHIER', TRUE, NOW())`,
        cashierUserId,
        cashierName,
        cashierUsername,
        cashierHash,
      );

      cashierAccounts.push({
        name: cashierName,
        username: cashierUsername,
        password: cashierPassword,
      });
    }

    // 5. Calculate Subscription End Date
    const months = dto.subscriptionMonths || 12;
    const endsAt = new Date();
    endsAt.setMonth(endsAt.getMonth() + months);

    // 6. Generate License Key
    const licenseKey = `DAWAEE-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${new Date().getFullYear()}`;

    // 7. Handle PharmacyChain if requested
    let chainId = dto.chainId || null;
    let chainRole = dto.chainRole || 'BRANCH';

    if (dto.isChain && !chainId) {
      const newChain = await this.prisma.pharmacyChain.create({
        data: {
          name: dto.chainName || `مجموعة ${dto.name}`,
          ownerName: dto.ownerName,
          ownerPhone: dto.phone || '',
        },
      });
      chainId = newChain.id;
      chainRole = 'HQ';
    }

    // 8. Register Tenant in Master Database
    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug,
        schemaName,
        governorate: dto.governorate,
        district: dto.district,
        addressDetails: dto.addressDetails,
        googleMapsUrl: dto.googleMapsUrl,
        latitude: dto.latitude,
        longitude: dto.longitude,
        phone: dto.phone || 'غير محدد',
        licenseKey,
        subscriptionStatus: 'ACTIVE',
        subscriptionEndsAt: endsAt,
        chainId,
        chainRole,
      },
    });

    this.logger.log(`Provisioning completed successfully for tenant ID: ${tenant.id}`);

    return {
      tenant,
      ownerAccount: {
        userId: ownerUserId,
        name: dto.ownerName,
        username: dto.ownerUsername,
        password: dto.ownerPassword,
        role: 'OWNER',
      },
      cashierAccounts,
      cashierAccount: cashierAccounts[0] || null,
      chainId,
      chainRole,
    };
  }

  async provisionTenant(dto: CreateTenantDto) {
    return this.provisionPharmacy(dto);
  }

  /**
   * SQL DDL Execution to create all tenant tables individually
   */
  public async createTenantSchemaAndTables(schemaName: string): Promise<void> {
    const statements = [
      `CREATE SCHEMA IF NOT EXISTS "${schemaName}"`,
      `CREATE TABLE IF NOT EXISTS "${schemaName}".users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'CASHIER',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS "${schemaName}".inventory_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        medicine_id UUID NOT NULL,
        custom_name VARCHAR(255),
        units_per_pack INT NOT NULL DEFAULT 1,
        selling_price_pack DECIMAL(12, 2) NOT NULL,
        selling_price_unit DECIMAL(12, 2) NOT NULL,
        min_alert_units INT DEFAULT 5,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS "idx_${schemaName}_inv_med" ON "${schemaName}".inventory_items (medicine_id)`,
      `CREATE TABLE IF NOT EXISTS "${schemaName}".inventory_batches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        inventory_item_id UUID REFERENCES "${schemaName}".inventory_items(id) ON DELETE CASCADE,
        supplier_id UUID,
        purchase_id UUID,
        batch_number VARCHAR(100),
        purchase_price_pack DECIMAL(12, 2) NOT NULL,
        selling_price_pack DECIMAL(12, 2),
        selling_price_unit DECIMAL(12, 2),
        quantity_units_remaining INT NOT NULL,
        expiry_date DATE NOT NULL,
        is_recalled BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS "idx_${schemaName}_batch_exp" ON "${schemaName}".inventory_batches (expiry_date)`,
      `CREATE TABLE IF NOT EXISTS "${schemaName}".sales (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_number VARCHAR(50) UNIQUE NOT NULL,
        user_id UUID REFERENCES "${schemaName}".users(id),
        subtotal DECIMAL(12, 2) NOT NULL,
        discount_amount DECIMAL(12, 2) DEFAULT 0,
        total_amount DECIMAL(12, 2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS "idx_${schemaName}_sales_dt" ON "${schemaName}".sales (created_at)`,
      `CREATE TABLE IF NOT EXISTS "${schemaName}".sale_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sale_id UUID REFERENCES "${schemaName}".sales(id) ON DELETE CASCADE,
        inventory_item_id UUID REFERENCES "${schemaName}".inventory_items(id),
        inventory_batch_id UUID REFERENCES "${schemaName}".inventory_batches(id),
        unit_type VARCHAR(10) NOT NULL,
        quantity INT NOT NULL,
        unit_price DECIMAL(12, 2) NOT NULL,
        total_price DECIMAL(12, 2) NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS "${schemaName}".returns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sale_id UUID REFERENCES "${schemaName}".sales(id),
        inventory_item_id UUID REFERENCES "${schemaName}".inventory_items(id),
        user_id UUID REFERENCES "${schemaName}".users(id),
        unit_type VARCHAR(10) NOT NULL,
        quantity INT NOT NULL,
        refund_amount DECIMAL(12, 2) NOT NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS "${schemaName}".suppliers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        address TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS "${schemaName}".purchases (
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
      )`,
      `CREATE INDEX IF NOT EXISTS "idx_${schemaName}_purchases_dt" ON "${schemaName}".purchases (created_at)`,
      `CREATE TABLE IF NOT EXISTS "${schemaName}".purchase_items (
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
      )`,
      `CREATE TABLE IF NOT EXISTS "${schemaName}".supplier_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        supplier_id UUID,
        purchase_id UUID,
        amount DECIMAL(12, 2) NOT NULL,
        payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
        payment_method VARCHAR(50) DEFAULT 'CASH',
        receipt_number VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS "idx_${schemaName}_supp_pay_dt" ON "${schemaName}".supplier_payments (created_at)`,
    ];

    for (const sql of statements) {
      await this.prisma.$executeRawUnsafe(sql);
    }
  }
}
