import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function resetDatabase() {
  console.log('🧹 Starting full database reset...');

  // 1. Get all tenant schemas to drop
  const tenants = await prisma.tenant.findMany({ select: { schemaName: true } });
  for (const t of tenants) {
    if (t.schemaName && t.schemaName.startsWith('ph_')) {
      console.log(`🔥 Dropping schema: ${t.schemaName}`);
      await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${t.schemaName}" CASCADE;`);
    }
  }

  // 2. Clear central search index, transfers, chains, tenants
  console.log('🗑️ Clearing central search index and tenant records...');
  await prisma.centralSearchIndex.deleteMany({});
  await prisma.stockTransfer.deleteMany({});
  await prisma.tenant.deleteMany({});
  await prisma.pharmacyChain.deleteMany({});

  console.log('✅ Wiped all test pharmacies and transactions successfully!');

  // 3. Provision fresh demo pharmacy (pharmacy_yarmouk)
  console.log('🏥 Provisioning clean demo pharmacy (صيدلية اليرموك)...');
  const slug = 'pharmacy_yarmouk';
  const schemaName = 'ph_pharmacy_yarmouk_01';

  // Drop schema if it exists
  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}";`);

  // Create tables in demo schema
  const statements = [
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
      shelf_location VARCHAR(100),
      is_search_visible BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".inventory_batches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      inventory_item_id UUID REFERENCES "${schemaName}".inventory_items(id) ON DELETE CASCADE,
      batch_number VARCHAR(100),
      supplier_name VARCHAR(255),
      supplier_invoice_number VARCHAR(100),
      purchase_price_pack DECIMAL(12, 2) NOT NULL,
      quantity_units_remaining INT NOT NULL,
      expiry_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".sales (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_number VARCHAR(50) UNIQUE NOT NULL,
      user_id UUID REFERENCES "${schemaName}".users(id),
      cashier_name VARCHAR(255),
      customer_name VARCHAR(255),
      customer_phone VARCHAR(50),
      payment_type VARCHAR(20) DEFAULT 'CASH',
      subtotal DECIMAL(12, 2) NOT NULL,
      discount_amount DECIMAL(12, 2) DEFAULT 0,
      total_amount DECIMAL(12, 2) NOT NULL,
      paid_amount DECIMAL(12, 2) NOT NULL,
      remaining_amount DECIMAL(12, 2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".sale_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      sale_id UUID REFERENCES "${schemaName}".sales(id) ON DELETE CASCADE,
      inventory_item_id UUID REFERENCES "${schemaName}".inventory_items(id),
      trade_name VARCHAR(255) NOT NULL,
      unit_type VARCHAR(20) NOT NULL,
      quantity INT NOT NULL,
      unit_price DECIMAL(12, 2) NOT NULL,
      total_price DECIMAL(12, 2) NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".suppliers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      company_name VARCHAR(255),
      balance_due DECIMAL(12, 2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".purchase_invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      supplier_id UUID REFERENCES "${schemaName}".suppliers(id) ON DELETE SET NULL,
      invoice_number VARCHAR(100),
      total_amount DECIMAL(12, 2) NOT NULL,
      paid_amount DECIMAL(12, 2) NOT NULL,
      remaining_amount DECIMAL(12, 2) DEFAULT 0,
      payment_status VARCHAR(20) DEFAULT 'PAID',
      invoice_date TIMESTAMP DEFAULT NOW(),
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".expenses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      category VARCHAR(100) NOT NULL,
      description TEXT,
      amount DECIMAL(12, 2) NOT NULL,
      expense_date DATE DEFAULT CURRENT_DATE,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".shift_closures (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES "${schemaName}".users(id),
      cashier_name VARCHAR(255) NOT NULL,
      opened_at TIMESTAMP NOT NULL,
      closed_at TIMESTAMP DEFAULT NOW(),
      total_sales_cash DECIMAL(12, 2) NOT NULL,
      total_sales_debt DECIMAL(12, 2) DEFAULT 0,
      total_expenses DECIMAL(12, 2) DEFAULT 0,
      net_cash_in_drawer DECIMAL(12, 2) NOT NULL,
      notes TEXT
    )`
  ];

  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
  }

  // Insert Tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'صيدلية اليرموك نموذجية',
      slug,
      schemaName,
      governorate: 'بغداد',
      district: 'اليرموك',
      addressDetails: 'شارع الأربعين - مقابل جامع الشواف',
      phone: '07701234567',
      licenseKey: `LIC-YARMOUK-${Date.now()}`,
      subscriptionStatus: 'ACTIVE',
      subscriptionEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  // Insert Owner and Cashier Users
  const passwordHash = await bcrypt.hash('Password123', 10);

  await prisma.$executeRawUnsafe(
    `INSERT INTO "${schemaName}".users (name, username, password_hash, role)
     VALUES ($1, $2, $3, 'OWNER'), ($4, $5, $3, 'CASHIER')`,
    'د. أحمد اليرموك',
    'yarmouk_owner',
    passwordHash,
    'كاشير صيدلية اليرموك',
    'yarmouk_pos'
  );

  console.log('🎉 Reset Completed Successfully!');
  console.log('----------------------------------------------------');
  console.log('🔑 Super Admin Credentials:');
  console.log('   Username: superadmin');
  console.log('   Password: Admin@Dawaee2026');
  console.log('----------------------------------------------------');
  console.log('🏥 Clean Demo Pharmacy Credentials:');
  console.log('   Slug: pharmacy_yarmouk');
  console.log('   Owner Username: yarmouk_owner | Password: Password123');
  console.log('   Cashier Username: yarmouk_pos | Password: Password123');
  console.log('----------------------------------------------------');
}

resetDatabase()
  .catch((err) => {
    console.error('❌ Reset failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
