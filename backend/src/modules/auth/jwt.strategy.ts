import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  name: string;
  username: string;
  role: 'OWNER' | 'CASHIER' | 'SUPER_ADMIN';
  tenantId?: string;
  schemaName?: string;
  subscriptionStatus?: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'dawaee-jwt-dev-secret-key-2026',
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub || !payload.role) {
      throw new UnauthorizedException('جلسة الدخول غير صالحة');
    }
    return payload;
  }
}
