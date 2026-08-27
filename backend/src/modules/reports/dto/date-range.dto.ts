import { IsOptional, IsString, IsInt, Min } from 'class-validator';

export class DateRangeDto {
  @IsString()
  @IsOptional()
  from?: string; // YYYY-MM-DD

  @IsString()
  @IsOptional()
  to?: string; // YYYY-MM-DD

  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 10;
}
