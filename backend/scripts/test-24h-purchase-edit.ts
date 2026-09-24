import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  console.log('--- Testing 24-Hour Purchase Invoice Full Edit Feature ---');

  try {
    // 1. Find a test pharmacy/tenant
    const tenant = await prisma.tenant.findFirst();

    if (!tenant || !tenant.schemaName) {
      console.error('No tenant with schema found');
      return;
    }

    const schema = tenant.schemaName;
    console.log(`Using Tenant: ${tenant.name} (${tenant.id}), Schema: ${schema}`);

    // 2. Insert a test purchase created NOW (within 24 hours)
    const testInvoiceNum = `TEST-PUR-${Date.now()}`;
    const [purchaseInsert]: any[] = await prisma.$queryRawUnsafe(`
      INSERT INTO "${schema}"."purchases" (
        "total_gross_amount", "total_discount_amount", "net_total_amount",
        "paid_amount", "remaining_amount", "payment_status"
      ) VALUES (
        50000, 0, 50000, 20000, 30000, 'PARTIAL'
      ) RETURNING id;
    `);
    const purchaseId = purchaseInsert.id;

    await prisma.$queryRawUnsafe(`
      INSERT INTO "${schema}"."purchase_invoices" (
        "id", "invoice_number", "supplier_name",
        "invoice_date", "total_amount", "paid_amount", "remaining_amount",
        "notes", "items_count", "created_at"
      ) VALUES (
        $1::uuid, $2, 'مذخر النهرين التجريبي',
        CURRENT_DATE, 50000, 20000, 30000,
        'فاتورة فحص التعديل خلال 24 ساعة', 1, NOW()
      );
    `, purchaseId, testInvoiceNum);

    // Create a medicine and inventory item for this test
    const [testMed]: any[] = await prisma.$queryRawUnsafe(`
      INSERT INTO public.medicines ("id", "trade_name", "scientific_name", "default_units_per_pack", "is_verified")
      VALUES (gen_random_uuid(), 'Panadol 24h Test ' || $1, 'Paracetamol Test', 10, false)
      RETURNING id;
    `, String(Date.now()));

    const [testInvItem]: any[] = await prisma.$queryRawUnsafe(`
      INSERT INTO "${schema}"."inventory_items" (
        "medicine_id", "custom_name", "units_per_pack", "selling_price_pack", "selling_price_unit", "min_alert_units", "is_public_visible"
      ) VALUES (
        $1::uuid, 'Panadol 24h Test', 10, 5000, 500, 5, true
      ) RETURNING id;
    `, testMed.id);

    // Insert purchase item & batch
    await prisma.$queryRawUnsafe(`
      INSERT INTO "${schema}"."purchase_items" (
        "purchase_id", "inventory_item_id", "quantity_packs", "bonus_packs", "amortize_bonus", "units_per_pack",
        "purchase_price_pack", "discount_percent", "net_cost_pack", "selling_price_pack", "selling_price_unit", "batch_number"
      ) VALUES (
        $1::uuid, $2::uuid, 10, 0, true, 10, 5000, 0, 5000, 6000, 600, 'BATCH-24H-001'
      );
    `, purchaseId, testInvItem.id);

    await prisma.$queryRawUnsafe(`
      INSERT INTO "${schema}"."purchase_invoice_items" (
        "purchase_invoice_id", "medicine_id", "trade_name", "batch_number",
        "quantity_packs", "bonus_packs", "units_per_pack", "purchase_price_pack", "discount_percent", "selling_price_pack", "total_cost"
      ) VALUES (
        $1::uuid, $2::uuid, 'Panadol 24h Test', 'BATCH-24H-001', 10, 0, 10, 5000, 0, 6000, 50000
      );
    `, purchaseId, testMed.id);

    const [testBatch]: any[] = await prisma.$queryRawUnsafe(`
      INSERT INTO "${schema}"."inventory_batches" (
        "inventory_item_id", "purchase_id", "batch_number", "purchase_price_pack",
        "selling_price_pack", "selling_price_unit", "quantity_units_remaining", "expiry_date", "is_recalled", "is_bonus"
      ) VALUES (
        $1::uuid, $2::uuid, 'BATCH-24H-001', 5000, 6000, 600, 100, CURRENT_DATE + INTERVAL '1 year', false, false
      ) RETURNING id;
    `, testInvItem.id, purchaseId);

    console.log(`✅ Created test purchase invoice: ${purchaseId}, batch: ${testBatch.id}`);

    // 3. Test verification via HTTP API
    const users: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, username, name, role FROM "${schema}".users WHERE role = 'OWNER' LIMIT 1;`
    );
    const owner = users[0] || { id: 'test-user', username: 'owner', name: 'Owner', role: 'OWNER' };
    const jwt = require('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'dawaee-jwt-dev-secret-key-2026';
    const token = jwt.sign(
      {
        sub: owner.id,
        userId: owner.id,
        username: owner.username,
        name: owner.name,
        role: 'OWNER',
        tenantId: tenant.id,
        schemaName: tenant.schemaName,
        subscriptionStatus: 'ACTIVE',
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    console.log('✅ Generated JWT token for Owner');

    if (token) {
      // 3.1 Fetch purchase by ID
      const getRes = await fetch(`http://localhost:4000/api/purchases/${purchaseId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const purchaseDetails: any = await getRes.json();

      console.log('Purchase Details response:', {
        invoiceNumber: purchaseDetails.invoiceNumber,
        canEdit: purchaseDetails.canEdit,
        remainingHours: purchaseDetails.remainingHours,
        itemsCount: purchaseDetails.items?.length,
        itemSoldUnits: purchaseDetails.items?.[0]?.soldUnits,
        itemCanDelete: purchaseDetails.items?.[0]?.canDelete,
      });

      if (purchaseDetails.canEdit !== true) {
        throw new Error('Expected canEdit === true for fresh invoice!');
      }

      // 3.2 Update Purchase within 24h
      console.log('Testing update within 24h...');
      const updatePayload = {
        supplierName: 'مذخر الرافدين المحدث',
        invoiceNumber: `${testInvoiceNum}-UPDATED`,
        paidAmount: 30000,
        notes: 'ملاحظة محدثة',
        items: [
          {
            medicineId: testMed.id,
            tradeName: 'Panadol 24h Test Updated',
            batchNumber: 'BATCH-24H-UPDATED',
            quantityPacks: 15, // Increased from 10 to 15
            purchasePricePack: 5500, // Updated price
            sellingPricePack: 7000,
            unitsPerPack: 10,
            discountPercent: 0,
          },
        ],
      };

      const putRes = await fetch(`http://localhost:4000/api/purchases/${purchaseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatePayload),
      });

      const putData: any = await putRes.json();
      console.log('PUT Response status:', putRes.status, putData);

      if (!putRes.ok || !putData.success) {
        throw new Error(`Failed to update purchase within 24h: ${JSON.stringify(putData)}`);
      }

      // 3.3 Verify database was updated
      const updatedBatches: any[] = await prisma.$queryRawUnsafe(`
        SELECT * FROM "${schema}"."inventory_batches" WHERE purchase_id = $1::uuid;
      `, purchaseId);

      console.log('Updated batch in DB:', {
        batchNumber: updatedBatches[0].batch_number,
        remainingUnits: updatedBatches[0].quantity_units_remaining,
        purchasePrice: updatedBatches[0].purchase_price_pack,
        sellingPrice: updatedBatches[0].selling_price_pack,
      });

      if (
        updatedBatches[0].batch_number !== 'BATCH-24H-UPDATED' ||
        Number(updatedBatches[0].quantity_units_remaining) !== 150
      ) {
        throw new Error('Batch was not correctly updated in database!');
      }
      console.log('✅ Batch and stock verified updated (150 units)!');

      // 3.4 Test POS sold units safety safeguard:
      console.log('Simulating 50 units sold in POS...');
      // Set remaining units to 100 (50 units sold out of 150)
      await prisma.$queryRawUnsafe(`
        UPDATE "${schema}"."inventory_batches"
        SET quantity_units_remaining = 100
        WHERE id = $1::uuid;
      `, updatedBatches[0].id);

      // Attempt to decrease quantity to 3 packs (30 units < 50 sold units)
      console.log('Testing decrease below sold units...');
      const illegalDecreasePayload = {
        items: [
          {
            medicineId: testMed.id,
            tradeName: 'Panadol 24h Test Updated',
            quantityPacks: 3, // 30 units, but 50 were sold!
            purchasePricePack: 5500,
            sellingPricePack: 7000,
            unitsPerPack: 10,
          },
        ],
      };

      const illegalRes = await fetch(`http://localhost:4000/api/purchases/${purchaseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(illegalDecreasePayload),
      });

      const illegalData: any = await illegalRes.json();
      console.log('Illegal decrease status:', illegalRes.status, illegalData.message);

      if (illegalRes.status !== 400) {
        throw new Error(`Expected 400 Bad Request when reducing below sold stock, got ${illegalRes.status}`);
      }
      console.log('✅ Safeguard PASSED: Cannot decrease quantity below sold units!');

      // Attempt to delete item that has sold units
      console.log('Testing deleting an item that has sold units...');
      const illegalDeletePayload = {
        items: [
          {
            tradeName: 'Another Different Medicine',
            quantityPacks: 5,
            purchasePricePack: 2000,
            sellingPricePack: 3000,
            unitsPerPack: 1,
          },
        ],
      };

      const illegalDelRes = await fetch(`http://localhost:4000/api/purchases/${purchaseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(illegalDeletePayload),
      });

      const illegalDelData: any = await illegalDelRes.json();
      console.log('Illegal delete status:', illegalDelRes.status, illegalDelData.message);

      if (illegalDelRes.status !== 400) {
        throw new Error(`Expected 400 Bad Request when deleting item with sold stock, got ${illegalDelRes.status}`);
      }
      console.log('✅ Safeguard PASSED: Cannot delete item with sold units!');

      // 3.5 Test 24-Hour Expiry Window:
      console.log('Simulating 25 hours elapsed on invoice created_at...');
      await prisma.$queryRawUnsafe(`
        UPDATE "${schema}"."purchase_invoices"
        SET created_at = NOW() - INTERVAL '25 hours'
        WHERE id = $1::uuid;
      `, purchaseId);

      const expiredRes = await fetch(`http://localhost:4000/api/purchases/${purchaseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatePayload),
      });

      const expiredData: any = await expiredRes.json();
      console.log('Expired 24h status:', expiredRes.status, expiredData.message);

      if (expiredRes.status !== 403) {
        throw new Error(`Expected 403 Forbidden for invoice > 24 hours, got ${expiredRes.status}`);
      }
      console.log('✅ Safeguard PASSED: 403 Forbidden strictly enforced after 24 hours!');
    }

    // Clean up test records
    await prisma.$queryRawUnsafe(`DELETE FROM "${schema}"."inventory_batches" WHERE purchase_id = $1::uuid;`, purchaseId);
    await prisma.$queryRawUnsafe(`DELETE FROM "${schema}"."purchase_items" WHERE purchase_id = $1::uuid;`, purchaseId);
    await prisma.$queryRawUnsafe(`DELETE FROM "${schema}"."purchase_invoice_items" WHERE purchase_invoice_id = $1::uuid;`, purchaseId);
    await prisma.$queryRawUnsafe(`DELETE FROM "${schema}"."purchase_invoices" WHERE id = $1::uuid;`, purchaseId);
    await prisma.$queryRawUnsafe(`DELETE FROM "${schema}"."purchases" WHERE id = $1::uuid;`, purchaseId);
    await prisma.$queryRawUnsafe(`DELETE FROM "${schema}"."inventory_items" WHERE id = $1::uuid;`, testInvItem.id);
    await prisma.$queryRawUnsafe(`DELETE FROM public.medicines WHERE id = $1::uuid;`, testMed.id);

    console.log('🧹 Cleaned up test data.');
    console.log('🎉 ALL 24-HOUR PURCHASE EDITING TESTS PASSED 100%! 🎉');
  } catch (err) {
    console.error('Test failed with error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
