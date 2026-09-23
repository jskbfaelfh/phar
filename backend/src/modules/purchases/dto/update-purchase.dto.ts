import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  IsDateString,
  IsUUID,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePurchaseItemDto {
  @IsOptional()
  @IsUUID('4', { message: 'معرف البند غير صالح' })
  id?: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرف الدواء غير صالح' })
  medicineId?: string;

  @IsString({ message: 'اسم الدواء التجاري مطلوب' })
  @IsNotEmpty({ message: 'اسم الدواء التجاري لا يمكن أن يكون فارغاً' })
  tradeName: string;

  @IsOptional()
  @IsString()
  scientificName?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsNumber({}, { message: 'عدد العلب يجب أن يكون رقماً' })
  @Min(0, { message: 'عدد العلب لا يمكن أن يكون سالباً' })
  quantityPacks: number;

  @IsOptional()
  @IsNumber({}, { message: 'عدد علب البونص يجب أن يكون رقماً' })
  @Min(0, { message: 'علب البونص لا يمكن أن تكون سالبة' })
  bonusPacks?: number;

  @IsOptional()
  @IsBoolean()
  amortizeBonus?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  unitsPerPack?: number;

  @IsNumber({}, { message: 'سعر الشراء للعلبة مطلوب' })
  @Min(0, { message: 'سعر الشراء لا يمكن أن يكون سالباً' })
  purchasePricePack: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPercent?: number;

  @IsNumber({}, { message: 'سعر البيع للعلبة مطلوب' })
  @Min(0, { message: 'سعر البيع لا يمكن أن يكون سالباً' })
  sellingPricePack: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sellingPriceUnit?: number;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsOptional()
  @IsString()
  bonusBatchNumber?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  bonusExpiryDate?: string;

  @IsOptional()
  @IsString()
  shelfLocation?: string;
}

export class UpdatePurchaseDto {
  @IsOptional()
  @IsUUID('4', { message: 'معرف المذخر غير صالح' })
  supplierId?: string;

  @IsOptional()
  @IsString({ message: 'اسم المذخر يجب أن يكون نصاً' })
  supplierName?: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsOptional()
  @IsDateString({}, { message: 'تاريخ الفاتورة غير صالح' })
  invoiceDate?: string;

  @IsOptional()
  @IsNumber({}, { message: 'المبلغ المدفوع يجب أن يكون رقماً' })
  @Min(0, { message: 'المبلغ المدفوع لا يمكن أن يكون سالباً' })
  paidAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  directDiscountAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray({ message: 'يجب تقديم قائمة بالمواد' })
  @ValidateNested({ each: true })
  @Type(() => UpdatePurchaseItemDto)
  items: UpdatePurchaseItemDto[];
}
