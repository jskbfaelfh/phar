import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function syncAllTenants() {
  console.log('Starting full sync of all tenant inventories to CentralSearchIndex...');

  const tenants = await prisma.tenant.findMany({
    where: { subscriptionStatus: 'ACTIVE', isSearchVisible: true },
  });

  let totalSynced = 0;

  for (const tenant of tenants) {
    if (!tenant.schemaName) continue;
    const schema = tenant.schemaName;

    console.log(`Syncing tenant "${tenant.name}" (${schema})...`);

    // Get all inventory items in tenant schema
    const items: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        i.medicine_id as "medicineId",
        i.selling_price_pack as "sellingPricePack",
        COALESCE(SUM(b.quantity_units_remaining), 0)::int as "totalUnitsRemaining"
      FROM "${schema}".inventory_items i
      LEFT JOIN "${schema}".inventory_batches b ON i.id = b.inventory_item_id
      GROUP BY i.id, i.medicine_id, i.selling_price_pack;
    `);

    for (const item of items) {
      if (!item.medicineId) continue;

      const medicine = await prisma.medicine.findUnique({
        where: { id: item.medicineId },
      });

      if (!medicine) continue;

      const isAvailable = Number(item.totalUnitsRemaining) > 0;

      await prisma.centralSearchIndex.upsert({
        where: {
          tenantId_medicineId: {
            tenantId: tenant.id,
            medicineId: item.medicineId,
          },
        },
        update: {
          pharmacyName: tenant.name,
          governorate: tenant.governorate,
          district: tenant.district,
          addressDetails: tenant.addressDetails,
          googleMapsUrl: tenant.googleMapsUrl,
          latitude: tenant.latitude,
          longitude: tenant.longitude,
          phone: tenant.phone,
          tradeName: medicine.tradeName,
          scientificName: medicine.scientificName,
          sellingPricePack: item.sellingPricePack,
          isAvailable,
          lastSyncedAt: new Date(),
        },
        create: {
          tenantId: tenant.id,
          medicineId: item.medicineId,
          pharmacyName: tenant.name,
          governorate: tenant.governorate,
          district: tenant.district,
          addressDetails: tenant.addressDetails,
          googleMapsUrl: tenant.googleMapsUrl,
          latitude: tenant.latitude,
          longitude: tenant.longitude,
          phone: tenant.phone,
          tradeName: medicine.tradeName,
          scientificName: medicine.scientificName,
          sellingPricePack: item.sellingPricePack,
          isAvailable,
          lastSyncedAt: new Date(),
        },
      });

      totalSynced++;
    }
  }

  console.log(`✅ Full sync complete! Synced ${totalSynced} inventory items to CentralSearchIndex.`);
}

syncAllTenants()
  .catch((err) => console.error('Sync failed:', err))
  .finally(() => prisma.$disconnect());
