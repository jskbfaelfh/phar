import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../database/prisma.service';

export interface InventorySyncedEvent {
  tenantId: string;
  schemaName: string;
  medicineIds: string[];
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent('inventory.synced', { async: true })
  async handleInventorySync(event: InventorySyncedEvent) {
    const { tenantId, schemaName, medicineIds } = event;

    try {
      // 1. Get Tenant Information from Master DB
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      if (!tenant || tenant.subscriptionStatus === 'SUSPENDED') {
        return;
      }

      // 2. For each updated medicine, calculate stock and upsert into CentralSearchIndex
      for (const medicineId of medicineIds) {
        // Query item price and total units remaining from tenant schema
        const itemRows: any[] = await this.prisma.$queryRawUnsafe(
          `SELECT 
             i.selling_price_pack as "sellingPricePack",
             COALESCE(SUM(b.quantity_units_remaining), 0)::int as "totalUnitsRemaining"
           FROM "${schemaName}".inventory_items i
           LEFT JOIN "${schemaName}".inventory_batches b ON i.id = b.inventory_item_id
           WHERE i.medicine_id = $1::uuid
           GROUP BY i.id`,
          medicineId,
        );

        if (itemRows.length === 0) continue;

        const item = itemRows[0];
        const isAvailable = item.totalUnitsRemaining > 0;

        // Get Master Medicine info
        const medicine = await this.prisma.medicine.findUnique({
          where: { id: medicineId },
        });

        if (!medicine) continue;

        // Upsert into CentralSearchIndex
        await this.prisma.centralSearchIndex.upsert({
          where: {
            tenantId_medicineId: {
              tenantId,
              medicineId,
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
            tenantId,
            medicineId,
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
      }

      this.logger.log(`Synced ${medicineIds.length} items to CentralSearchIndex for tenant "${tenant.name}"`);
    } catch (error) {
      this.logger.error(`Error during central index sync for tenant ${tenantId}`, error);
    }
  }
}
