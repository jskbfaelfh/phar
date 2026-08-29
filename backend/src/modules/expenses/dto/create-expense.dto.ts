import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, Min } from 'class-validator';

export enum ExpenseCategory {
  RENT = 'RENT',
  SALARIES = 'SALARIES',
  ELECTRICITY = 'ELECTRICITY',
  MAINTENANCE = 'MAINTENANCE',
  SUPPLIES = 'SUPPLIES',
  TAXES = 'TAXES',
  OTHER = 'OTHER',
}

export class CreateExpenseDto {
  @IsEnum(ExpenseCategory)
  @IsOptional()
  category?: ExpenseCategory;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @IsOptional()
  expenseDate?: string;

  @IsString()
  @IsOptional()
  recipient?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
