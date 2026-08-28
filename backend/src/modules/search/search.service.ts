import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PublicSearchQueryDto } from './dto/public-search.dto';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public Network Search for Medicines across all active pharmacies
   */
  async searchPublicNetwork(query: PublicSearchQueryDto) {
    const { q, governorate, district, limit = 50 } = query;
    const where: any = {
      isAvailable: true, // Only show available medicines
    };

    if (governorate && governorate.trim().length > 0) {
      where.governorate = { contains: governorate.trim(), mode: 'insensitive' };
    }

    if (district && district.trim().length > 0) {
      where.district = { contains: district.trim(), mode: 'insensitive' };
    }

    if (q && q.trim().length > 0) {
      const term = q.trim();
      where.OR = [
        { tradeName: { contains: term, mode: 'insensitive' } },
        { scientificName: { contains: term, mode: 'insensitive' } },
      ];
    }

    const results = await this.prisma.centralSearchIndex.findMany({
      where,
      take: Math.min(Number(limit), 100),
      orderBy: [
        { tradeName: 'asc' },
        { sellingPricePack: 'asc' }, // Order by lowest price first
      ],
      select: {
        id: true,
        pharmacyName: true,
        governorate: true,
        district: true,
        addressDetails: true,
        googleMapsUrl: true,
        latitude: true,
        longitude: true,
        phone: true,
        tradeName: true,
        scientificName: true,
        sellingPricePack: true,
        isAvailable: true,
        lastSyncedAt: true,
      },
    });

    return {
      query: { q, governorate, district },
      count: results.length,
      results,
    };
  }

  private static locationsCache: { data: any[]; expiry: number } | null = null;

  /**
   * Get list of governorates and districts available in the network (Cached in-memory)
   */
  async getAvailableLocations() {
    const now = Date.now();
    if (SearchService.locationsCache && SearchService.locationsCache.expiry > now) {
      return SearchService.locationsCache.data;
    }

    const locations = await this.prisma.centralSearchIndex.findMany({
      where: { isAvailable: true },
      select: {
        governorate: true,
        district: true,
      },
      distinct: ['governorate', 'district'],
    });

    SearchService.locationsCache = {
      data: locations,
      expiry: now + 5 * 60 * 1000, // 5 minutes cache
    };

    return locations;
  }
}
