import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { DateRangeDto } from './dto/date-range.dto';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Financial Profit & Loss Report for a given date range
   */
  async getFinancialReport(dto: DateRangeDto) {
    const schemaName = this.tenantContext.getSchemaName();

    let dateFilter = '';
    const params: any[] = [];

    if (dto.from && dto.to) {
      params.push(`${dto.from} 00:00:00`, `${dto.to} 23:59:59`);
      dateFilter = `WHERE s.created_at >= $1::timestamp AND s.created_at <= $2::timestamp`;
    } else if (dto.from) {
      params.push(`${dto.from} 00:00:00`);
      dateFilter = `WHERE s.created_at >= $1::timestamp`;
    }

    // 1. Calculate Sales Revenue & Discounts
    const salesSql = `
      SELECT 
        COUNT(s.id)::int as "totalInvoicesCount",
        COALESCE(SUM(s.subtotal), 0)::numeric as "grossSales",
        COALESCE(SUM(s.discount_amount), 0)::numeric as "totalDiscounts",
        COALESCE(SUM(s.total_amount), 0)::numeric as "netRevenue"
      FROM "${schemaName}".sales s
      ${dateFilter};
    `;
    const salesStats: any[] = await this.prisma.$queryRawUnsafe(salesSql, ...params);
    const s = salesStats[0];

    // 2. Calculate Refunds from Returns
    let returnDateFilter = '';
    if (dto.from && dto.to) {
      returnDateFilter = `WHERE r.created_at >= $1::timestamp AND r.created_at <= $2::timestamp`;
    } else if (dto.from) {
      returnDateFilter = `WHERE r.created_at >= $1::timestamp`;
    }

    const returnsSql = `
      SELECT 
        COUNT(r.id)::int as "totalReturnsCount",
        COALESCE(SUM(r.refund_amount), 0)::numeric as "totalRefunds"
      FROM "${schemaName}".returns r
      ${returnDateFilter};
    `;
    const returnsStats: any[] = await this.prisma.$queryRawUnsafe(returnsSql, ...params);
    const r = returnsStats[0];

    // 3. Calculate Cost of Goods Sold (COGS)
    let cogsDateFilter = '';
    if (dto.from && dto.to) {
      cogsDateFilter = `WHERE s.created_at >= $1::timestamp AND s.created_at <= $2::timestamp`;
    } else if (dto.from) {
      cogsDateFilter = `WHERE s.created_at >= $1::timestamp`;
    }

    const cogsSql = `
      SELECT 
        COALESCE(SUM(
          CASE 
            WHEN si.unit_type = 'PACK' THEN si.quantity * COALESCE(b.purchase_price_pack, 0)
            ELSE (si.quantity::numeric / GREATEST(ii.units_per_pack, 1)) * COALESCE(b.purchase_price_pack, 0)
          END
        ), 0)::numeric as "cogs"
      FROM "${schemaName}".sale_items si
      JOIN "${schemaName}".sales s ON si.sale_id = s.id
      JOIN "${schemaName}".inventory_items ii ON si.inventory_item_id = ii.id
      LEFT JOIN "${schemaName}".inventory_batches b ON si.inventory_batch_id = b.id
      ${cogsDateFilter};
    `;
    const cogsStats: any[] = await this.prisma.$queryRawUnsafe(cogsSql, ...params);
    const cogs = Number(cogsStats[0].cogs);

    const netRevenue = Number(s.netRevenue) - Number(r.totalRefunds);
    const grossProfit = netRevenue - cogs;
    const profitMarginPercent = netRevenue > 0
      ? Number(((grossProfit / netRevenue) * 100).toFixed(2))
      : 0;

    return {
      period: {
        from: dto.from || 'البداية',
        to: dto.to || 'الآن',
      },
      sales: {
        totalInvoices: s.totalInvoicesCount,
        grossSales: Number(s.grossSales),
        totalDiscounts: Number(s.totalDiscounts),
        netRevenue,
      },
      returns: {
        totalReturnsCount: r.totalReturnsCount,
        totalRefunds: Number(r.totalRefunds),
      },
      profitability: {
        costOfGoodsSold: cogs,
        grossProfit,
        profitMarginPercent,
      },
    };
  }

  /**
   * Top Selling Medicines by revenue and quantity
   */
  async getTopSellingMedicines(dto: DateRangeDto) {
    const schemaName = this.tenantContext.getSchemaName();
    const limit = Math.min(Number(dto.limit || 10), 50);

    let dateFilter = '';
    const params: any[] = [limit];

    if (dto.from && dto.to) {
      params.push(`${dto.from} 00:00:00`, `${dto.to} 23:59:59`);
      dateFilter = `AND s.created_at >= $2::timestamp AND s.created_at <= $3::timestamp`;
    }

    const sql = `
      SELECT 
        m.id as "medicineId",
        m.trade_name as "tradeName",
        m.scientific_name as "scientificName",
        m.dosage_form as "dosageForm",
        COUNT(DISTINCT s.id)::int as "invoicesCount",
        SUM(CASE WHEN si.unit_type = 'PACK' THEN si.quantity ELSE 0 END)::int as "soldPacks",
        SUM(CASE WHEN si.unit_type = 'STRIP' THEN si.quantity ELSE 0 END)::int as "soldStrips",
        COALESCE(SUM(si.total_price), 0)::numeric as "totalRevenue"
      FROM "${schemaName}".sale_items si
      JOIN "${schemaName}".sales s ON si.sale_id = s.id
      JOIN "${schemaName}".inventory_items ii ON si.inventory_item_id = ii.id
      JOIN public.medicines m ON ii.medicine_id = m.id
      WHERE 1=1 ${dateFilter}
      GROUP BY m.id
      ORDER BY "totalRevenue" DESC
      LIMIT $1;
    `;

    const topItems: any[] = await this.prisma.$queryRawUnsafe(sql, ...params);
    return topItems;
  }

  /**
   * Inventory Valuation (Current total stock value at cost and at retail selling price)
   */
  async getInventoryValuation() {
    const schemaName = this.tenantContext.getSchemaName();

    const sql = `
      SELECT 
        COUNT(DISTINCT i.id)::int as "totalDistinctItems",
        COALESCE(SUM(
          (b.quantity_units_remaining::numeric / GREATEST(i.units_per_pack, 1)) * b.purchase_price_pack
        ), 0)::numeric as "totalCostValue",
        COALESCE(SUM(
          (b.quantity_units_remaining::numeric / GREATEST(i.units_per_pack, 1)) * i.selling_price_pack
        ), 0)::numeric as "totalRetailValue"
      FROM "${schemaName}".inventory_items i
      JOIN "${schemaName}".inventory_batches b ON i.id = b.inventory_item_id
      WHERE b.quantity_units_remaining > 0;
    `;

    const stats: any[] = await this.prisma.$queryRawUnsafe(sql);
    const row = stats[0];

    const totalCostValue = Number(row.totalCostValue);
    const totalRetailValue = Number(row.totalRetailValue);
    const expectedProfit = totalRetailValue - totalCostValue;

    return {
      totalDistinctItems: row.totalDistinctItems,
      totalCostValue,
      totalRetailValue,
      expectedProfit,
    };
  }
}
