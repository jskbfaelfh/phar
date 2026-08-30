import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class AiSmartSearchDto {
  @IsString()
  @IsNotEmpty({ message: 'يرجى إدخال نص الاستفسار أو الحديث الصوتي' })
  query!: string;

  @IsBoolean()
  @IsOptional()
  inStockOnly?: boolean;
}
