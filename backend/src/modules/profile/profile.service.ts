import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  UpdatePharmacyProfileDto,
  ChangeOwnerPasswordDto,
  CreateCashierDto,
  ResetCashierPasswordDto,
} from './dto/update-profile.dto';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Get full pharmacy profile, owner info, cashiers, and license status
   */
  async getPharmacyProfile() {
    const tenantId = this.tenantContext.getTenantId();
    const schemaName = this.tenantContext.getSchemaName();
    const ctx = this.tenantContext.getContext();

    // 1. Get Tenant details from Master DB
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('الصيدلية غير موجودة');
    }

    // 2. Get Users from Tenant Schema
    const users: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT id, name, username, role, is_active as "isActive", created_at as "createdAt"
      FROM "${schemaName}".users
      ORDER BY role ASC, created_at ASC;
    `);

    const owner = users.find((u) => u.role === 'OWNER') || {
      id: ctx?.userId || '',
      name: 'صاحب الصيدلية',
      username: 'owner',
      role: 'OWNER',
    };

    const cashiers = users.filter((u) => u.role === 'CASHIER');

    // Calculate days remaining
    const now = new Date();
    const endsAt = new Date(tenant.subscriptionEndsAt);
    const diffMs = endsAt.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    return {
      pharmacy: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        governorate: tenant.governorate,
        district: tenant.district,
        addressDetails: tenant.addressDetails || '',
        phone: tenant.phone || '',
        googleMapsUrl: tenant.googleMapsUrl || '',
        logoUrl: tenant.logoUrl || null,
        receiptHeader: tenant.receiptHeader || `أهلاً بكم في ${tenant.name}`,
        receiptFooter: tenant.receiptFooter || 'نتمنى لكم الشفاء العاجل • الأدوية المباعة لا ترد ولا تستبدل بعد 3 أيام',
        licenseKey: tenant.licenseKey,
        subscriptionStatus: tenant.subscriptionStatus,
        subscriptionEndsAt: tenant.subscriptionEndsAt,
        daysRemaining,
      },
      owner,
      cashiers,
    };
  }

  /**
   * Update Pharmacy Info, Logo, and Receipt settings
   */
  async updatePharmacyProfile(dto: UpdatePharmacyProfileDto) {
    const tenantId = this.tenantContext.getTenantId();

    const updateData: any = {};
    if (dto.name) updateData.name = dto.name;
    if (dto.phone) updateData.phone = dto.phone;
    if (dto.governorate) updateData.governorate = dto.governorate;
    if (dto.district) updateData.district = dto.district;
    if (dto.addressDetails !== undefined) updateData.addressDetails = dto.addressDetails;
    if (dto.googleMapsUrl !== undefined) updateData.googleMapsUrl = dto.googleMapsUrl;
    if (dto.logoUrl !== undefined) updateData.logoUrl = dto.logoUrl;
    if (dto.receiptHeader !== undefined) updateData.receiptHeader = dto.receiptHeader;
    if (dto.receiptFooter !== undefined) updateData.receiptFooter = dto.receiptFooter;

    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
    });

    // Sync with CentralSearchIndex
    await this.prisma.centralSearchIndex.updateMany({
      where: { tenantId },
      data: {
        pharmacyName: updated.name,
        governorate: updated.governorate,
        district: updated.district,
        addressDetails: updated.addressDetails,
        googleMapsUrl: updated.googleMapsUrl,
        phone: updated.phone,
      },
    });

    this.logger.log(`Pharmacy profile updated for tenant ${tenantId}`);

    return {
      success: true,
      message: 'تم تحديث بيانات وشعار الصيدلية بنجاح',
      pharmacy: updated,
    };
  }

  /**
   * Change Owner Personal Password
   */
  async changeOwnerPassword(dto: ChangeOwnerPasswordDto) {
    const schemaName = this.tenantContext.getSchemaName();
    const ctx = this.tenantContext.getContext();
    const userId = ctx?.userId;

    if (!userId) {
      throw new ForbiddenException('غير مصرح لك بتغيير كلمة المرور');
    }

    // 1. Fetch current user password hash from tenant schema
    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT password_hash FROM "${schemaName}".users WHERE id = $1::uuid LIMIT 1`,
      userId,
    );

    if (rows.length === 0) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    const user = rows[0];

    // 2. Validate current password
    const isMatch = await bcrypt.compare(dto.currentPassword, user.password_hash);
    if (!isMatch) {
      throw new BadRequestException('كلمة المرور الحالية غير صحيحة');
    }

    // 3. Hash new password and update
    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.$executeRawUnsafe(
      `UPDATE "${schemaName}".users SET password_hash = $1 WHERE id = $2::uuid`,
      newHash,
      userId,
    );

    this.logger.log(`Owner password updated successfully in schema ${schemaName}`);

    return {
      success: true,
      message: 'تم تغيير كلمة المرور بنجاح',
    };
  }

  /**
   * Create a new Cashier account in the pharmacy
   */
  async createCashier(dto: CreateCashierDto) {
    const schemaName = this.tenantContext.getSchemaName();

    const cleanUsername = dto.username.toLowerCase().trim();

    // Check if username already exists in this tenant
    const existing: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id FROM "${schemaName}".users WHERE LOWER(username) = LOWER($1) LIMIT 1`,
      cleanUsername,
    );

    if (existing.length > 0) {
      throw new BadRequestException('اسم مستخدم الكاشير مسجل مسبقاً في هذه الصيدلية');
    }

    const newId = crypto.randomUUID();
    const hash = await bcrypt.hash(dto.password, 10);

    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "${schemaName}".users (id, name, username, password_hash, role, is_active, created_at)
       VALUES ($1::uuid, $2, $3, $4, 'CASHIER', TRUE, NOW())`,
      newId,
      dto.name,
      cleanUsername,
      hash,
    );

    this.logger.log(`Cashier "${cleanUsername}" created in tenant schema "${schemaName}"`);

    return {
      success: true,
      message: `تم إضافة حساب الكاشير (${dto.name}) بنجاح`,
      cashier: {
        id: newId,
        name: dto.name,
        username: cleanUsername,
        role: 'CASHIER',
      },
    };
  }

  /**
   * Reset password for a Cashier
   */
  async resetCashierPassword(cashierId: string, dto: ResetCashierPasswordDto) {
    const schemaName = this.tenantContext.getSchemaName();

    // Verify it's a cashier
    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id, role, name FROM "${schemaName}".users WHERE id = $1::uuid LIMIT 1`,
      cashierId,
    );

    if (rows.length === 0) {
      throw new NotFoundException('حساب الكاشير غير موجود');
    }

    const targetUser = rows[0];
    if (targetUser.role === 'OWNER') {
      throw new ForbiddenException('لا يمكن تغيير كلمة سر المالك من هذا المسار');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.$executeRawUnsafe(
      `UPDATE "${schemaName}".users SET password_hash = $1 WHERE id = $2::uuid`,
      newHash,
      cashierId,
    );

    return {
      success: true,
      message: `تم تغيير كلمة مرور الكاشير (${targetUser.name}) بنجاح`,
    };
  }

  /**
   * Delete a Cashier user
   */
  async deleteCashier(cashierId: string) {
    const schemaName = this.tenantContext.getSchemaName();

    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id, role, name FROM "${schemaName}".users WHERE id = $1::uuid LIMIT 1`,
      cashierId,
    );

    if (rows.length === 0) {
      throw new NotFoundException('الحساب غير موجود');
    }

    if (rows[0].role === 'OWNER') {
      throw new ForbiddenException('لا يمكن حذف حساب صاحب الصيدلية الأساسي');
    }

    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "${schemaName}".users WHERE id = $1::uuid`,
      cashierId,
    );

    return {
      success: true,
      message: `تم حذف حساب الكاشير (${rows[0].name}) بنجاح`,
    };
  }
}
