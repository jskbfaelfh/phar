import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../database/prisma.service';
import { ProvisioningService } from './provisioning.service';
import {
  CreateTenantDto,
  UpdateTenantDto,
  UpdateSubscriptionDto,
  UpdateStatusDto,
  ResetPasswordDto,
} from './dto/create-tenant.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provisioningService: ProvisioningService,
  ) {}

  /**
   * Provision a brand new pharmacy with schema and owner account
   */
  async createTenant(dto: CreateTenantDto) {
    return this.provisioningService.provisionPharmacy(dto);
  }

  /**
   * List all pharmacies with filtering and counts
   */
  async getAllTenants(query?: { status?: string; search?: string }) {
    const where: any = {};

    if (query?.status) {
      where.subscriptionStatus = query.status;
    }

    if (query?.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
        { governorate: { contains: query.search, mode: 'insensitive' } },
        { district: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const tenants = await this.prisma.tenant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { searchIndexes: true },
        },
      },
    });

    return tenants;
  }

  /**
   * Get single pharmacy details
   */
  async getTenantById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: { searchIndexes: true },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('الصيدلية غير موجودة');
    }

    return tenant;
  }

  /**
   * Get all users/accounts for a specific pharmacy (Owner, Cashier)
   */
  async getTenantUsers(tenantId: string) {
    const tenant = await this.getTenantById(tenantId);

    const users: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT id, name, username, role, is_active, created_at
      FROM "${tenant.schemaName}".users
      ORDER BY role ASC, created_at ASC;
    `);

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
      users,
    };
  }

  /**
   * Reset/change password for any user inside a pharmacy tenant
   */
  async resetTenantUserPassword(tenantId: string, userId: string, dto: ResetPasswordDto) {
    const tenant = await this.getTenantById(tenantId);
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    const updated = await this.prisma.$executeRawUnsafe(`
      UPDATE "${tenant.schemaName}".users
      SET password_hash = $1
      WHERE id = $2::uuid;
    `, passwordHash, userId);

    if (!updated) {
      throw new NotFoundException('المستخدم غير موجود داخل هذه الصيدلية');
    }

    this.logger.log(`Password reset for user ${userId} in tenant ${tenant.slug}`);

    return {
      success: true,
      message: 'تم تغيير كلمة المرور بنجاح',
      newPassword: dto.newPassword,
    };
  }

  /**
   * Update pharmacy info (Name, locations, phone, status, expiry)
   */
  async updateTenant(id: string, dto: UpdateTenantDto) {
    const tenant = await this.getTenantById(id);

    const updateData: any = {};
    if (dto.name) updateData.name = dto.name;
    if (dto.governorate) updateData.governorate = dto.governorate;
    if (dto.district) updateData.district = dto.district;
    if (dto.addressDetails !== undefined) updateData.addressDetails = dto.addressDetails;
    if (dto.googleMapsUrl !== undefined) updateData.googleMapsUrl = dto.googleMapsUrl;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.subscriptionStatus) updateData.subscriptionStatus = dto.subscriptionStatus;
    if (dto.subscriptionEndsAt) updateData.subscriptionEndsAt = new Date(dto.subscriptionEndsAt);

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: updateData,
    });

    // Sync updated info with CentralSearchIndex
    await this.prisma.centralSearchIndex.updateMany({
      where: { tenantId: id },
      data: {
        pharmacyName: updated.name,
        governorate: updated.governorate,
        district: updated.district,
        addressDetails: updated.addressDetails,
        googleMapsUrl: updated.googleMapsUrl,
        phone: updated.phone,
      },
    });

    this.logger.log(`Tenant ${id} (${updated.name}) updated successfully.`);
    return updated;
  }

  /**
   * Delete pharmacy tenant, drops its PostgreSQL schema & search index completely
   */
  async deleteTenant(id: string) {
    const tenant = await this.getTenantById(id);

    this.logger.warn(`Deleting tenant ${id} (${tenant.name}) and dropping schema "${tenant.schemaName}"...`);

    // 1. Drop tenant PostgreSQL schema and all its tables
    await this.prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${tenant.schemaName}" CASCADE;`);

    // 2. Delete all records from CentralSearchIndex
    await this.prisma.centralSearchIndex.deleteMany({
      where: { tenantId: id },
    });

    // 3. Delete Tenant Master record
    await this.prisma.tenant.delete({
      where: { id },
    });

    this.logger.log(`Tenant ${id} and schema "${tenant.schemaName}" deleted successfully.`);

    return {
      success: true,
      message: `تم حذف صيدلية (${tenant.name}) وقاعدة بياناتها بالكامل بنجاح`,
    };
  }

  /**
   * Extend or renew subscription
   */
  async extendSubscription(id: string, dto: UpdateSubscriptionDto) {
    const tenant = await this.getTenantById(id);

    const currentEnd = new Date(tenant.subscriptionEndsAt);
    const now = new Date();
    // If already expired, start from now, otherwise add to existing end date
    const baseDate = currentEnd > now ? currentEnd : now;
    baseDate.setMonth(baseDate.getMonth() + dto.extendMonths);

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: {
        subscriptionEndsAt: baseDate,
        subscriptionStatus: 'ACTIVE',
      },
    });

    return updated;
  }

  /**
   * Update tenant status (ACTIVE, EXPIRED, SUSPENDED)
   */
  async updateTenantStatus(id: string, dto: UpdateStatusDto) {
    await this.getTenantById(id);

    const updated = await this.prisma.tenant.update({
      where: { id },
      data: {
        subscriptionStatus: dto.status as any,
      },
    });

    return updated;
  }

  private static dashboardCache: { data: any; expiry: number } | null = null;

  /**
   * Super Admin Dashboard Overview Metrics (Aggregated Single-Query & In-Memory Cache)
   */
  async getDashboardMetrics() {
    const now = Date.now();
    if (AdminService.dashboardCache && AdminService.dashboardCache.expiry > now) {
      return AdminService.dashboardCache.data;
    }

    const [tenantStats, totalMedicines, totalIndexedStock] = await Promise.all([
      this.prisma.$queryRawUnsafe<any[]>(`
        SELECT 
          COUNT(*)::int as total,
          COUNT(*) FILTER (WHERE subscription_status = 'ACTIVE')::int as active,
          COUNT(*) FILTER (WHERE subscription_status = 'EXPIRED')::int as expired,
          COUNT(*) FILTER (WHERE subscription_status = 'SUSPENDED')::int as suspended
        FROM tenants;
      `),
      this.prisma.medicine.count(),
      this.prisma.centralSearchIndex.count({ where: { isAvailable: true } }),
    ]);

    const stats = tenantStats[0] || {};
    const result = {
      tenants: {
        total: Number(stats.total || 0),
        active: Number(stats.active || 0),
        expired: Number(stats.expired || 0),
        suspended: Number(stats.suspended || 0),
      },
      catalog: {
        totalMedicines,
        totalActiveSearchItems: totalIndexedStock,
      },
    };

    AdminService.dashboardCache = {
      data: result,
      expiry: now + 15000, // 15 seconds cache
    };

    return result;
  }

  /**
   * Configure Cloudflare R2 bucket credentials for a specific tenant
   */
  async updateTenantR2Config(
    id: string,
    dto: {
      r2BucketName?: string;
      r2AccountId?: string;
      r2AccessKeyId?: string;
      r2SecretAccessKey?: string;
    },
  ) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('الصيدلية غير موجودة');
    }

    return this.prisma.tenant.update({
      where: { id },
      data: {
        r2BucketName: dto.r2BucketName || null,
        r2AccountId: dto.r2AccountId || null,
        r2AccessKeyId: dto.r2AccessKeyId || null,
        r2SecretAccessKey: dto.r2SecretAccessKey || null,
      },
    });
  }
}
