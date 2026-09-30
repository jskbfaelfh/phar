import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { validateAndSanitizeSchemaName } from '../../common/utils/security.util';

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record a new operating expense in tenant schema
   */
  async createExpense(tenantId: string, dto: CreateExpenseDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || !tenant.schemaName) {
      throw new BadRequestException('الصيدلية غير متوفرة');
    }

    const schema = validateAndSanitizeSchemaName(tenant.schemaName);

    const category = dto.category || 'OTHER';
    const expenseDate = dto.expenseDate ? new Date(dto.expenseDate) : new Date();

    const result = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(`
      INSERT INTO "${schema}"."expenses" (
        "category", "title", "amount", "expense_date", "recipient", "notes"
      ) VALUES (
        $1, $2, $3, $4, $5, $6
      ) RETURNING id;
    `,
      category,
      dto.title,
      dto.amount,
      expenseDate,
      dto.recipient || null,
      dto.notes || null
    );

    return {
      message: 'تم تسجيل المصروف بنجاح',
      id: result[0].id,
      title: dto.title,
      amount: dto.amount,
      category,
    };
  }

  /**
   * Get list of expenses with parameterized category and date filters (No SQL Injection)
   */
  async getExpenses(tenantId: string, category?: string, startDate?: string, endDate?: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || !tenant.schemaName) return { expenses: [], totalExpenses: 0, byCategory: {} };

    const schema = validateAndSanitizeSchemaName(tenant.schemaName);

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (category && category !== 'ALL') {
      params.push(category);
      whereClauses.push(`category = $${params.length}`);
    }

    if (startDate) {
      const cleanStart = startDate.includes(' ') ? startDate : `${startDate} 00:00:00`;
      params.push(cleanStart);
      whereClauses.push(`expense_date >= $${params.length}::timestamp`);
    }

    if (endDate) {
      const cleanEnd = endDate.includes(' ') ? endDate : `${endDate} 23:59:59`;
      params.push(cleanEnd);
      whereClauses.push(`expense_date <= $${params.length}::timestamp`);
    }

    const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const expenses = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        id,
        category,
        title,
        amount,
        expense_date as "expenseDate",
        recipient,
        notes,
        created_at as "createdAt"
      FROM "${schema}"."expenses"
      ${whereStr}
      ORDER BY expense_date DESC, created_at DESC;
    `, ...params);

    // Category aggregations with the exact same parameterized filters
    const totalsByCategory = await this.prisma.$queryRawUnsafe<Array<{ category: string; total: string }>>(`
      SELECT category, SUM(amount)::text as total
      FROM "${schema}"."expenses"
      ${whereStr}
      GROUP BY category;
    `, ...params);

    const byCategory: Record<string, number> = {};
    let totalExpenses = 0;

    for (const row of (totalsByCategory || [])) {
      const val = Number(row.total || 0);
      byCategory[row.category] = val;
      totalExpenses += val;
    }

    return {
      expenses: expenses || [],
      totalExpenses,
      byCategory,
    };
  }

  /**
   * Delete an expense entry
   */
  async deleteExpense(tenantId: string, id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || !tenant.schemaName) throw new NotFoundException('الصيدلية غير متوفرة');

    const schema = validateAndSanitizeSchemaName(tenant.schemaName);

    await this.prisma.$executeRawUnsafe(`
      DELETE FROM "${schema}"."expenses" WHERE id = $1::uuid;
    `, id);

    return { message: 'تم حذف المصروف بنجاح' };
  }

  /**
   * Update an expense entry
   */
  async updateExpense(id: string, dto: any, tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant || !tenant.schemaName) throw new NotFoundException('الصيدلية غير متوفرة');

    const schema = validateAndSanitizeSchemaName(tenant.schemaName);
    
    const updateFields: string[] = [];
    const params: any[] = [];

    if (dto.amount !== undefined) {
      params.push(dto.amount);
      updateFields.push(`"amount" = $${params.length}`);
    }
    if (dto.category !== undefined) {
      params.push(dto.category);
      updateFields.push(`"category" = $${params.length}`);
    }
    if (dto.description !== undefined) {
      params.push(dto.description);
      updateFields.push(`"notes" = $${params.length}`);
    }
    if (dto.expenseDate !== undefined) {
      params.push(new Date(dto.expenseDate));
      updateFields.push(`"expense_date" = $${params.length}`);
    }

    if (updateFields.length === 0) {
      return { message: 'لا توجد حقول للتحديث' };
    }

    params.push(id);
    const idIndex = params.length;

    const result = await this.prisma.$queryRawUnsafe<any[]>(`
      UPDATE "${schema}"."expenses"
      SET ${updateFields.join(', ')}
      WHERE id = $${idIndex}::uuid
      RETURNING *;
    `, ...params);

    if (!result || result.length === 0) {
      throw new NotFoundException('المصروف غير موجود');
    }

    return {
      message: 'تم تحديث المصروف بنجاح',
      expense: result[0],
    };
  }
}
