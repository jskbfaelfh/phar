import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  IsUUID,
} from 'class-validator';

export class LinkBranchDto {
  @IsString()
  @IsNotEmpty({ message: 'معرف الصيدلية (slug) مطلوب' })
  targetSlug: string;

  @IsString()
  @IsNotEmpty({ message: 'كود ترخيص الصيدلية مطلوب' })
  licenseKey: string;

  @IsOptional()
  @IsString()
  chainName?: string;
}

export class CreateBranchDto {
  @IsString()
  @IsNotEmpty({ message: 'اسم الفرع الجديد مطلوب' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'اسم المعرف (Slug) مطلوب' })
  slug: string;

  @IsString()
  @IsNotEmpty({ message: 'المحافظة مطلوبة' })
  governorate: string;

  @IsString()
  @IsNotEmpty({ message: 'المنطقة أو الحي مطلوب' })
  district: string;

  @IsString()
  @IsNotEmpty({ message: 'رقم هاتف الفرع مطلوب' })
  phone: string;

  @IsString()
  @IsNotEmpty({ message: 'كلمة مرور المالك للفرع مطلوبة' })
  ownerPassword: string;
}

export class CreateStockTransferDto {
  @IsUUID('4', { message: 'معرف الفرع المستلم غير صالح' })
  @IsNotEmpty({ message: 'الفرع المستلم مطلوب' })
  targetTenantId: string;

  @IsUUID('4', { message: 'معرف الدواء غير صالح' })
  @IsNotEmpty({ message: 'الدواء مطلوب' })
  medicineId: string;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsInt({ message: 'عدد العلب يجب أن يكون رقماً صحيحاً' })
  @Min(1, { message: 'يجب تحويل علبة واحدة على الأقل' })
  quantityPacks: number;

  @IsOptional()
  @IsInt()
  quantityUnits?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReceiveStockTransferDto {
  @IsOptional()
  @IsString()
  shelfLocation?: string;
}

export class SwitchBranchDto {
  @IsUUID('4', { message: 'معرف الفرع غير صالح' })
  @IsNotEmpty({ message: 'الفرع المستهدف مطلوب' })
  targetTenantId: string;
}
