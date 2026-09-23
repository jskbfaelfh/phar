import { Injectable, UnauthorizedException, ForbiddenException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { getOrGenerateDevJwtSecret } from '../../common/utils/security.util';

export interface JwtPayload {
  sub: string;
  name: string;
  username: string;
  role: 'OWNER' | 'CASHIER' | 'SUPER_ADMIN';
  tenantId?: string;
  schemaName?: string;
  subscriptionStatus?: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
}

interface CachedSession {
  user: any;
  cachedAt: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);
  private static readonly sessionCache = new Map<string, CachedSession>();
  private static readonly CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

  public static clearSessionCache(userId?: string) {
    if (userId) {
      for (const key of JwtStrategy.sessionCache.keys()) {
        if (key.startsWith(`${userId}:`)) {
          JwtStrategy.sessionCache.delete(key);
        }
      }
    } else {
      JwtStrategy.sessionCache.clear();
    }
  }

  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = configService.get<string>('JWT_SECRET') || getOrGenerateDevJwtSecret();
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: any) => {
          if (req && req.cookies && req.cookies.dawaee_token) {
            return req.cookies.dawaee_token;
          }
          return null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub || !payload.role) {
      throw new UnauthorizedException('جلسة الدخول غير صالحة');
    }

    // 1. Super Admin authorization
    if (payload.role === 'SUPER_ADMIN') {
      return payload;
    }

    // 2. Tenant Pharmacy verification
    if (!payload.tenantId) {
      throw new UnauthorizedException('بيانات الصيدلية مفقودة في الجلسة');
    }

    const cacheKey = `${payload.sub}:${payload.tenantId}`;
    const cached = JwtStrategy.sessionCache.get(cacheKey);
    const now = Date.now();

    // Fast-path: Return cached authenticated session to avoid redundant DB roundtrips and pool resets
    if (cached && now - cached.cachedAt < JwtStrategy.CACHE_TTL_MS) {
      return cached.user;
    }

    // Cache miss or expired: verify against database with auto-retry
    try {
      const user = await this.verifyWithRetry(payload);
      JwtStrategy.sessionCache.set(cacheKey, { user, cachedAt: now });
      return user;
    } catch (err: any) {
      if (err instanceof UnauthorizedException || err instanceof ForbiddenException) {
        JwtStrategy.sessionCache.delete(cacheKey);
        throw err;
      }

      // If DB glitch occurred and we have a cached session (even slightly expired), fall back gracefully
      if (cached) {
        this.logger.warn(
          `Database connection glitch during JWT auth for ${payload.username}. Using cached session. Error: ${err?.message?.slice(0, 80)}`,
        );
        return cached.user;
      }

      this.logger.error(`Error validating user session for ${payload.username}: ${err?.message}`);
      throw new UnauthorizedException('تعذر الاتصال بقاعدة البيانات مؤقتاً، يرجى المحاولة مرة أخرى');
    }
  }

  private async verifyWithRetry(payload: JwtPayload, attempt = 1): Promise<any> {
    try {
      return await this.fetchAndValidateUser(payload);
    } catch (err: any) {
      const isConnError =
        err?.code === 'P1001' ||
        err?.code === 'P1017' ||
        err?.message?.includes('closed the connection') ||
        err?.message?.includes('ConnectionReset') ||
        err?.message?.includes('10054') ||
        err?.message?.includes("Can't reach database server");

      if (isConnError && attempt <= 2) {
        this.logger.warn(
          `Neon connection blip during auth check for ${payload.username}. Retrying attempt ${attempt + 1}...`,
        );
        await new Promise((r) => setTimeout(r, 250));
        return this.verifyWithRetry(payload, attempt + 1);
      }
      throw err;
    }
  }

  private async fetchAndValidateUser(payload: JwtPayload): Promise<any> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: payload.tenantId },
      select: {
        id: true,
        name: true,
        schemaName: true,
        subscriptionStatus: true,
        subscriptionEndsAt: true,
      },
    });

    if (!tenant) {
      throw new UnauthorizedException('الصيدلية غير مسجلة أو تم حذفها من النظام');
    }

    // 1. Block suspended pharmacies completely
    if (tenant.subscriptionStatus === 'SUSPENDED') {
      throw new ForbiddenException('تم إيقاف حساب هذه الصيدلية مؤقتاً، يرجى مراجعة إدارة النظام');
    }

    // 2. Auto-sync expired status if end date has elapsed
    let effectiveSubscriptionStatus = tenant.subscriptionStatus;
    const now = new Date();
    if (
      tenant.subscriptionEndsAt &&
      tenant.subscriptionEndsAt < now &&
      tenant.subscriptionStatus === 'ACTIVE'
    ) {
      effectiveSubscriptionStatus = 'EXPIRED';
      try {
        await this.prisma.tenant.update({
          where: { id: tenant.id },
          data: { subscriptionStatus: 'EXPIRED' },
        });
      } catch (updateErr: any) {
        this.logger.warn(`Failed to update expired tenant status: ${updateErr?.message}`);
      }
    }

    // 3. User account active verification inside isolated tenant schema
    const schemaName = tenant.schemaName || payload.schemaName;
    const userRecords: any[] = await this.prisma.$queryRawUnsafe(
      `SELECT id, name, username, role, is_active FROM "${schemaName}".users WHERE id = $1::uuid LIMIT 1`,
      payload.sub,
    );

    if (!userRecords || userRecords.length === 0) {
      throw new UnauthorizedException('المستخدم غير موجود داخل قاعدة بيانات الصيدلية');
    }

    const dbUser = userRecords[0];
    if (!dbUser.is_active) {
      throw new UnauthorizedException('تم تعطيل هذا الحساب، يرجى مراجعة إدارة الصيدلية');
    }

    // Sync role and schema from DB to prevent token privilege tampering, and attach effective subscription status
    return {
      ...payload,
      name: dbUser.name,
      role: dbUser.role,
      schemaName: tenant.schemaName,
      subscriptionStatus: effectiveSubscriptionStatus,
    };
  }
}
