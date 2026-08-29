import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum UnitTypeEnum {
  PACK = 'PACK',
  STRIP = 'STRIP',
}

export class CartItemDto {
  @IsString()
  @IsNotEmpty({ message: 'معرف المادة في المخزن مطلوب' })
  inventoryItemId: string;

  @IsString()
  @IsOptional()
  inventoryBatchId?: string;

  @IsEnum(UnitTypeEnum, { message: 'نوع الوحدة يجب أن يكون PACK أو STRIP' })
  unitType: UnitTypeEnum;

  @IsInt()
  @Min(1, { message: 'الكمية يجب أن تكون 1 على الأقل' })
  quantity: number;
}

export class CheckoutDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];

  @IsNumber()
  @IsOptional()
  @Min(0)
  discountAmount?: number = 0; // خصم مبلغ مباشر (IQD)
}

export class CreateReturnDto {
  @IsString()
  @IsOptional()
  saleId?: string; // رابط الفاتورة الأصلية (اختياري)

  @IsString()
  @IsNotEmpty({ message: 'معرف المادة مطلوب' })
  inventoryItemId: string;

  @IsEnum(UnitTypeEnum)
  unitType: UnitTypeEnum;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  refundAmount?: number; // المبلغ المرجع (إذا تُرك فارغاً يُحسب تلقائياً)

  @IsString()
  @IsOptional()
  reason?: string;
}

export class OfflineSaleItemDto {
  @IsString()
  @IsNotEmpty()
  offlineId: string;

  @IsString()
  @IsOptional()
  offlineInvoiceNumber?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  items: CartItemDto[];

  @IsNumber()
  @IsOptional()
  @Min(0)
  discountAmount?: number = 0;

  @IsString()
  @IsOptional()
  createdAt?: string;
}

export class SyncOfflineSalesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OfflineSaleItemDto)
  sales: OfflineSaleItemDto[];
}
