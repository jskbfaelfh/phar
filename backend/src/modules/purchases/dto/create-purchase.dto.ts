import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PurchaseItemDto {
  @IsString()
  @IsNotEmpty()
  medicineId!: string;

  @IsString()
  @IsNotEmpty()
  tradeName!: string;

  @IsString()
  @IsOptional()
  scientificName?: string;

  @IsString()
  @IsOptional()
  batchNumber?: string;

  @IsString()
  @IsNotEmpty()
  expiryDate!: string;

  @IsNumber()
  @Min(1)
  quantityPacks!: number;

  @IsNumber()
  @Min(1)
  unitsPerPack!: number;

  @IsNumber()
  @Min(0)
  purchasePricePack!: number;

  @IsNumber()
  @Min(0)
  sellingPricePack!: number;
}

export class CreatePurchaseDto {
  @IsString()
  @IsNotEmpty()
  invoiceNumber!: string;

  @IsString()
  @IsOptional()
  supplierId?: string;

  @IsString()
  @IsOptional()
  supplierName?: string;

  @IsString()
  @IsOptional()
  invoiceDate?: string;

  @IsNumber()
  @Min(0)
  totalAmount!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  paidAmount?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items!: PurchaseItemDto[];
}
