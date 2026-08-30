import {
  IsOptional,
  IsString,
  IsNotEmpty,
  MinLength,
} from 'class-validator';

export class UpdatePharmacyProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  governorate?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  addressDetails?: string;

  @IsOptional()
  @IsString()
  googleMapsUrl?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  receiptHeader?: string;

  @IsOptional()
  @IsString()
  receiptFooter?: string;

  @IsOptional()
  isSearchVisible?: boolean;

  @IsOptional()
  showSellingPrices?: boolean;

  @IsOptional()
  showPhoneNumber?: boolean;

  @IsOptional()
  showWhatsapp?: boolean;

  @IsOptional()
  is24Hours?: boolean;

  @IsOptional()
  @IsString()
  geminiApiKey?: string;
}

export class ChangeOwnerPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'كلمة المرور الحالية مطلوبة' })
  currentPassword: string;

  @IsString()
  @MinLength(6, { message: 'كلمة المرور الجديدة يجب أن تكون 6 خانات على الأقل' })
  newPassword: string;
}

export class CreateCashierDto {
  @IsString()
  @IsNotEmpty({ message: 'اسم الكاشير مطلوب' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'اسم المستخدم مطلوب' })
  username: string;

  @IsString()
  @MinLength(6, { message: 'كلمة المرور يجب أن تكون 6 خانات على الأقل' })
  password: string;
}

export class ResetCashierPasswordDto {
  @IsString()
  @MinLength(6, { message: 'كلمة المرور يجب أن تكون 6 خانات على الأقل' })
  newPassword: string;
}
