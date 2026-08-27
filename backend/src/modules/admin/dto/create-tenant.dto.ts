import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  MinLength,
  IsInt,
  Min,
  IsBoolean,
} from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty({ message: 'اسم الصيدلية مطلوب' })
  name: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsNotEmpty({ message: 'المحافظة مطلوبة' })
  governorate: string;

  @IsString()
  @IsNotEmpty({ message: 'المنطقة / الحي مطلوب' })
  district: string;

  @IsString()
  @IsOptional()
  addressDetails?: string;

  @IsString()
  @IsOptional()
  googleMapsUrl?: string;

  @IsNumber()
  @IsOptional()
  latitude?: number;

  @IsNumber()
  @IsOptional()
  longitude?: number;

  @IsString()
  @IsOptional()
  phone?: string; // Optional

  @IsInt()
  @Min(1, { message: 'مدة الاشتراك يجب أن تكون شهراً واحداً على الأقل' })
  subscriptionMonths: number; // e.g. 1, 6, 12, 24 months

  // Owner Account Info
  @IsString()
  @IsNotEmpty({ message: 'اسم صاحب الصيدلية مطلوب' })
  ownerName: string;

  @IsString()
  @IsNotEmpty({ message: 'اسم مستخدم المالك مطلوب' })
  ownerUsername: string;

  @IsString()
  @MinLength(6, { message: 'كلمة مرور صاحب الصيدلية يجب أن لا تقل عن 6 أحرف' })
  ownerPassword: string;

  // Auto Create Cashier Account
  @IsBoolean()
  @IsOptional()
  createCashier?: boolean;

  @IsString()
  @IsOptional()
  cashierName?: string;

  @IsString()
  @IsOptional()
  cashierUsername?: string;

  @IsString()
  @IsOptional()
  cashierPassword?: string;
}

export class UpdateTenantDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  governorate?: string;

  @IsString()
  @IsOptional()
  district?: string;

  @IsString()
  @IsOptional()
  addressDetails?: string;

  @IsString()
  @IsOptional()
  googleMapsUrl?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  subscriptionStatus?: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';

  @IsString()
  @IsOptional()
  subscriptionEndsAt?: string;
}

export class UpdateSubscriptionDto {
  @IsInt()
  @Min(1, { message: 'عدد أشهر التمديد يجب أن يكون 1 على الأقل' })
  extendMonths: number;
}

export class UpdateStatusDto {
  @IsString()
  @IsNotEmpty()
  status: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(6, { message: 'كلمة المرور الجديدة يجب أن لا تقل عن 6 أحرف' })
  newPassword: string;
}
