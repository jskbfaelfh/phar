import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function resetDatabase() {
  console.log('🧹 Starting TOTAL DATABASE WIPE of all medicines and pharmacy data...');

  // 1. Get all tenant schemas to drop
  const tenants = await prisma.tenant.findMany({ select: { schemaName: true } });
  for (const t of tenants) {
    if (t.schemaName && t.schemaName.startsWith('ph_')) {
      console.log(`🔥 Dropping schema: ${t.schemaName}`);
      await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${t.schemaName}" CASCADE;`);
    }
  }

  // 2. Clear central search index, transfers, chains, tenants, and master catalog medicines
  console.log('🗑️ Clearing central search index, tenant records, and master medicines catalog...');
  await prisma.centralSearchIndex.deleteMany({});
  await prisma.stockTransfer.deleteMany({});
  await prisma.tenant.deleteMany({});
  await prisma.pharmacyChain.deleteMany({});
  await prisma.medicine.deleteMany({});

  console.log('✅ Wiped all test medicines, catalog, and transactions successfully!');

  // 3. Provision clean active pharmacy tenant "h"
  console.log('🏥 Provisioning clean active pharmacy (صيدلية H)...');
  const slug = 'h';
  const schemaName = 'ph_ph_h_ba0ff5';

  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE;`);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schemaName}";`);

  // Create tables in schema
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
      supplier_id UUID,
      purchase_id UUID,
      batch_number VARCHAR(100),
      purchase_price_pack DECIMAL(12, 2) NOT NULL,
      selling_price_pack DECIMAL(12, 2) NOT NULL,
      selling_price_unit DECIMAL(12, 2) NOT NULL,
      quantity_units_remaining INT NOT NULL,
      expiry_date DATE NOT NULL,
      is_recalled BOOLEAN DEFAULT FALSE,
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
      address TEXT,
      company_name VARCHAR(255),
      balance_due DECIMAL(12, 2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".purchase_invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      supplier_id UUID REFERENCES "${schemaName}".suppliers(id) ON DELETE SET NULL,
      supplier_name VARCHAR(255),
      invoice_number VARCHAR(100),
      total_amount DECIMAL(12, 2) NOT NULL,
      paid_amount DECIMAL(12, 2) NOT NULL,
      remaining_amount DECIMAL(12, 2) DEFAULT 0,
      early_discount_days INT,
      early_discount_percent DECIMAL(5,2),
      early_discount_deadline TIMESTAMP,
      early_discount_amount DECIMAL(12,2) DEFAULT 0,
      early_discount_applied BOOLEAN DEFAULT FALSE,
      early_discount_applied_amount DECIMAL(12,2) DEFAULT 0,
      payment_status VARCHAR(20) DEFAULT 'PAID',
      invoice_date TIMESTAMP DEFAULT NOW(),
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".purchase_invoice_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      purchase_invoice_id UUID REFERENCES "${schemaName}".purchase_invoices(id) ON DELETE CASCADE,
      medicine_id UUID,
      trade_name VARCHAR(255) NOT NULL,
      scientific_name VARCHAR(255),
      batch_number VARCHAR(100),
      expiry_date DATE NOT NULL,
      quantity_packs INT NOT NULL,
      units_per_pack INT DEFAULT 1,
      purchase_price_pack DECIMAL(12, 2) NOT NULL,
      selling_price_pack DECIMAL(12, 2) NOT NULL,
      total_cost DECIMAL(12, 2) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS "${schemaName}".expenses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      category VARCHAR(100) NOT NULL,
      title VARCHAR(255),
      amount DECIMAL(12, 2) NOT NULL,
      expense_date DATE DEFAULT CURRENT_DATE,
      recipient VARCHAR(255),
      notes TEXT,
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
  await prisma.tenant.create({
    data: {
      name: 'صيدلية H',
      slug,
      schemaName,
      governorate: 'بغداد',
      district: 'المنصور',
      addressDetails: 'شارع الأميرة',
      phone: '07800000000',
      licenseKey: 'DAWAEE-EF7B6F46-2026',
      subscriptionStatus: 'ACTIVE',
      subscriptionEndsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  // Insert Owner user with password "h"
  const passwordHash = await bcrypt.hash('h', 10);

  await prisma.$executeRawUnsafe(
    `INSERT INTO "${schemaName}".users (name, username, password_hash, role)
     VALUES ($1, $2, $3, 'OWNER')`,
    'صيدلية H',
    'h',
    passwordHash
  );

  console.log('🎉 TOTAL WIPE COMPLETE!');
  console.log('----------------------------------------------------');
  console.log('📊 Current DB Status:');
  console.log('   Medicines in Catalog: 0');
  console.log('   Pharmacies: 1 (صيدلية H)');
  console.log('   Pharmacy Login: Username: h | Password: h');
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
