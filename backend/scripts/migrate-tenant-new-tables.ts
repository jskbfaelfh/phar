import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const existingSchemas = await prisma.$queryRaw<Array<{ schema_name: string }>>`
    SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'ph_%';
  `;

  console.log(`Found ${existingSchemas.length} active tenant schemas in Postgres.`);

  for (const row of existingSchemas) {
    const schema = row.schema_name;
    console.log(`Migrating new tables for: "${schema}"`);

    // Create expenses table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schema}"."expenses" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "category" VARCHAR(50) DEFAULT 'OTHER',
        "title" VARCHAR(255) NOT NULL,
        "amount" DECIMAL(12, 2) NOT NULL,
        "expense_date" DATE DEFAULT CURRENT_DATE,
        "recipient" VARCHAR(255),
        "notes" TEXT,
        "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create purchase_invoices table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schema}"."purchase_invoices" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "invoice_number" VARCHAR(100) NOT NULL,
        "supplier_id" UUID,
        "supplier_name" VARCHAR(255),
        "invoice_date" DATE DEFAULT CURRENT_DATE,
        "total_amount" DECIMAL(12, 2) NOT NULL,
        "paid_amount" DECIMAL(12, 2) DEFAULT 0,
        "remaining_amount" DECIMAL(12, 2) DEFAULT 0,
        "notes" TEXT,
        "items_count" INT DEFAULT 0,
        "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create purchase_invoice_items table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schema}"."purchase_invoice_items" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "purchase_invoice_id" UUID NOT NULL REFERENCES "${schema}"."purchase_invoices"("id") ON DELETE CASCADE,
        "medicine_id" UUID NOT NULL,
        "trade_name" VARCHAR(255) NOT NULL,
        "scientific_name" VARCHAR(255),
        "batch_number" VARCHAR(100),
        "expiry_date" DATE NOT NULL,
        "quantity_packs" INT NOT NULL,
        "units_per_pack" INT DEFAULT 1,
        "purchase_price_pack" DECIMAL(12, 2) NOT NULL,
        "selling_price_pack" DECIMAL(12, 2) NOT NULL,
        "total_cost" DECIMAL(12, 2) NOT NULL
      );
    `);

    // Create shift_logs table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${schema}"."shift_logs" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL,
        "user_name" VARCHAR(255) NOT NULL,
        "opened_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
        "closed_at" TIMESTAMP(3),
        "opening_cash" DECIMAL(12, 2) DEFAULT 0,
        "expected_cash" DECIMAL(12, 2) DEFAULT 0,
        "actual_cash" DECIMAL(12, 2) DEFAULT 0,
        "cash_difference" DECIMAL(12, 2) DEFAULT 0,
        "total_sales_count" INT DEFAULT 0,
        "total_sales_amount" DECIMAL(12, 2) DEFAULT 0,
        "notes" TEXT,
        "status" VARCHAR(50) DEFAULT 'CLOSED'
      );
    `);
  }

  console.log('✅ Successfully migrated new tables across all active tenant schemas!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
