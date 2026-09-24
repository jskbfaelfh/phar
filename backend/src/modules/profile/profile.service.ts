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
import { maskSecretKey, isWeakPassword, encryptSecret, decryptSecret } from '../../common/utils/security.util';
import {
  UpdatePharmacyProfileDto,
  ChangeOwnerPasswordDto,
  CreateCashierDto,
  ResetCashierPasswordDto,
} from './dto/update-profile.dto';
import { AuditLogService } from '../audit/audit.service';
import { AuditAction, AuditEntityType } from '../audit/dto/audit-log.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly auditLogService: AuditLogService,
    private readonly eventEmitter: EventEmitter2,
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
        isSearchVisible: (tenant as any).isSearchVisible ?? true,
        showSellingPrices: (tenant as any).showSellingPrices ?? true,
        showPhoneNumber: (tenant as any).showPhoneNumber ?? true,
        showWhatsapp: (tenant as any).showWhatsapp ?? true,
        is24Hours: (tenant as any).is24Hours ?? false,
        allowCashierInventoryAccess: Boolean((tenant as any).allowCashierInventoryAccess),
        hasGeminiApiKey: Boolean((tenant as any).geminiApiKey),
        geminiApiKeyMasked: maskSecretKey(decryptSecret((tenant as any).geminiApiKey)),
        geminiApiKey: '', // Sensitive secret NEVER returned to frontend!
        licenseKey: maskSecretKey(tenant.licenseKey),
        licenseKeyMasked: maskSecretKey(tenant.licenseKey),
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
    const schemaName = this.tenantContext.getSchemaName();
    const ctx = this.tenantContext.getContext();

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
    if (dto.isSearchVisible !== undefined) updateData.isSearchVisible = dto.isSearchVisible;
    if (dto.showSellingPrices !== undefined) updateData.showSellingPrices = dto.showSellingPrices;
    if (dto.showPhoneNumber !== undefined) updateData.showPhoneNumber = dto.showPhoneNumber;
    if (dto.showWhatsapp !== undefined) updateData.showWhatsapp = dto.showWhatsapp;
    if (dto.is24Hours !== undefined) updateData.is24Hours = dto.is24Hours;
    if (dto.allowCashierInventoryAccess !== undefined) updateData.allowCashierInventoryAccess = dto.allowCashierInventoryAccess;

    if (dto.geminiApiKey !== undefined) {
      const raw = dto.geminiApiKey?.trim();
      if (raw && !raw.includes('••••') && !raw.startsWith('•••') && raw !== '__REMOVE__') {
        // New valid key provided
        updateData.geminiApiKey = encryptSecret(raw);
      } else if (raw === '__REMOVE__') {
        // Explicit removal
        updateData.geminiApiKey = null;
      }
      // If raw is empty or contains mask characters (••••), ignore it to preserve existing valid key
    }

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
        showSellingPrices: (updated as any).showSellingPrices ?? true,
        showPhoneNumber: (updated as any).showPhoneNumber ?? true,
        showWhatsapp: (updated as any).showWhatsapp ?? true,
        is24Hours: (updated as any).is24Hours ?? false,
      },
    });

    this.logger.log(`Pharmacy profile updated for tenant ${tenantId}`);

    // Audit log profile change
    await this.auditLogService.log(
      {
        userId: ctx?.userId || null,
        userName: 'صاحب الصيدلية',
        userRole: 'OWNER',
        action: AuditAction.UPDATE_PHARMACY_PROFILE,
        entityType: AuditEntityType.PHARMACY_PROFILE,
        entityId: tenantId,
        description: `تحديث بيانات وإعدادات الصيدلية (${updated.name})`,
        details: { updatedFields: Object.keys(updateData) },
      },
      schemaName,
    );

    const sanitizedPharmacy = {
      ...updated,
      geminiApiKey: '',
      hasGeminiApiKey: Boolean((updated as any).geminiApiKey),
      geminiApiKeyMasked: maskSecretKey(decryptSecret((updated as any).geminiApiKey)),
      licenseKey: maskSecretKey(updated.licenseKey),
      licenseKeyMasked: maskSecretKey(updated.licenseKey),
    };

    // Broadcast realtime settings update to all connected clients in this pharmacy
    this.eventEmitter.emit('pharmacy.settings_updated', {
      tenantId,
      pharmacy: sanitizedPharmacy,
    });

    return {
      success: true,
      message: 'تم تحديث بيانات وإعدادات خصوصية الصيدلية بنجاح',
      pharmacy: sanitizedPharmacy,
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

    const weakCheck = isWeakPassword(dto.newPassword);
    if (weakCheck.isWeak) {
      throw new BadRequestException(weakCheck.reason || 'كلمة المرور الجديدة ضعيفة جداً');
    }

    // 3. Hash new password and update
    const newHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.$executeRawUnsafe(
      `UPDATE "${schemaName}".users SET password_hash = $1 WHERE id = $2::uuid`,
      newHash,
      userId,
    );

    await this.auditLogService.log(
      {
        userId,
        userName: 'صاحب الصيدلية',
        userRole: 'OWNER',
        action: AuditAction.CHANGE_OWNER_PASSWORD,
        entityType: AuditEntityType.USER,
        entityId: userId,
        description: 'تغيير كلمة المرور الشخصية لحساب المالك',
      },
      schemaName,
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
    const ctx = this.tenantContext.getContext();

    const weakCheck = isWeakPassword(dto.password);
    if (weakCheck.isWeak) {
      throw new BadRequestException(weakCheck.reason || 'كلمة مرور الكاشير غير آمنة');
    }

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

    await this.auditLogService.log(
      {
        userId: ctx?.userId || null,
        userName: 'صاحب الصيدلية',
        userRole: 'OWNER',
        action: AuditAction.USER_CREATE,
        entityType: AuditEntityType.USER,
        entityId: newId,
        description: `إنشاء حساب كاشير جديد: (${dto.name}) باسم مستخدم (@${cleanUsername})`,
        details: { cashierId: newId, name: dto.name, username: cleanUsername, role: 'CASHIER' },
      },
      schemaName,
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
    const ctx = this.tenantContext.getContext();

    const weakCheck = isWeakPassword(dto.newPassword);
    if (weakCheck.isWeak) {
      throw new BadRequestException(weakCheck.reason || 'كلمة المرور الجديدة ضعيفة جداً');
    }

    // Verify it's a cashier
    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id, role, name, username FROM "${schemaName}".users WHERE id = $1::uuid LIMIT 1`,
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

    await this.auditLogService.log(
      {
        userId: ctx?.userId || null,
        userName: 'صاحب الصيدلية',
        userRole: 'OWNER',
        action: AuditAction.USER_PASSWORD_RESET,
        entityType: AuditEntityType.USER,
        entityId: cashierId,
        description: `إعادة تعيين كلمة مرور الكاشير (${targetUser.name}) - @${targetUser.username}`,
        details: { cashierId, username: targetUser.username, name: targetUser.name },
      },
      schemaName,
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
    const ctx = this.tenantContext.getContext();

    const rows: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id, role, name, username FROM "${schemaName}".users WHERE id = $1::uuid LIMIT 1`,
      cashierId,
    );

    if (rows.length === 0) {
      throw new NotFoundException('الحساب غير موجود');
    }

    if (rows[0].role === 'OWNER') {
      throw new ForbiddenException('لا يمكن حذف حساب صاحب الصيدلية الأساسي');
    }

    const targetUser = rows[0];

    await this.prisma.$executeRawUnsafe(
      `DELETE FROM "${schemaName}".users WHERE id = $1::uuid`,
      cashierId,
    );

    await this.auditLogService.log(
      {
        userId: ctx?.userId || null,
        userName: 'صاحب الصيدلية',
        userRole: 'OWNER',
        action: AuditAction.USER_DELETE,
        entityType: AuditEntityType.USER,
        entityId: cashierId,
        description: `حذف حساب الكاشير (${targetUser.name}) - @${targetUser.username}`,
        details: { cashierId, username: targetUser.username, name: targetUser.name },
      },
      schemaName,
    );

    return {
      success: true,
      message: `تم حذف حساب الكاشير (${rows[0].name}) بنجاح`,
    };
  }

  /**
   * Test Gemini API Key connectivity and validity
   */
  async testGeminiKey(providedKey?: string): Promise<{
    success: boolean;
    message: string;
    model?: string;
    maskedKey?: string;
  }> {
    const tenantId = this.tenantContext.getTenantId();
    let keyToTest = providedKey?.trim();

    if (!keyToTest || keyToTest.includes('••••') || keyToTest === '__REMOVE__') {
      // Fetch saved key from Tenant
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { geminiApiKey: true },
      });
      if (tenant?.geminiApiKey) {
        keyToTest = decryptSecret(tenant.geminiApiKey);
      }
    }

    if (!keyToTest) {
      throw new BadRequestException('لا يوجد مفتاح Gemini محفوظ أو مدخل لفحصه. يرجى لصق المفتاح أولاً.');
    }

    const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(keyToTest)}`;

    try {
      const response = await fetch(testUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'ping' }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errMsg = errorData?.error?.message || `HTTP ${response.status} ${response.statusText}`;
        if (response.status === 400 || response.status === 403) {
          throw new BadRequestException(`مفتاح Gemini غير صالح أو غير مفعل: ${errMsg}`);
        } else if (response.status === 429) {
          throw new BadRequestException(`المفتاح صالح ولكن تم تجاوز الحصة المتاحة (Rate Limit / Quota): ${errMsg}`);
        }
        throw new BadRequestException(`فشل الاتصال بـ Gemini: ${errMsg}`);
      }

      return {
        success: true,
        message: 'تم فحص المفتاح بنجاح! الاتصال بسيرفرات Google Gemini (موديل 2.5 Flash) فعال وجاهز للاستخدام.',
        model: 'gemini-2.5-flash',
        maskedKey: maskSecretKey(keyToTest),
      };
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`تعذر الاتصال بسيرفرات Google Gemini: ${err.message}`);
    }
  }
}
