import { IsOptional, IsString, IsInt, Min } from 'class-validator';

export class PublicSearchQueryDto {
  @IsString()
  @IsOptional()
  q?: string;

  @IsString()
  @IsOptional()
  governorate?: string;

  @IsString()
  @IsOptional()
  district?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 50;
}
