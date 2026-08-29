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

  /**
   * Detailed Current Stocktake List
   */
  async getDetailedCurrentStocktake() {
    const schemaName = this.tenantContext.getSchemaName();

    const sql = `
      SELECT 
        ii.id as "inventoryItemId",
        ii.medicine_id as "medicineId",
        m.trade_name as "tradeName",
        m.scientific_name as "scientificName",
        m.dosage_form as "dosageForm",
        m.strength,
        m.barcode,
        ii.custom_name as "customName",
        ii.units_per_pack as "unitsPerPack",
        ii.selling_price_pack as "sellingPricePack",
        ii.selling_price_unit as "sellingPriceUnit",
        ii.min_alert_units as "minAlertUnits",
        COALESCE(SUM(b.quantity_units_remaining), 0)::int as "totalUnitsRemaining",
        FLOOR(COALESCE(SUM(b.quantity_units_remaining), 0)::numeric / GREATEST(ii.units_per_pack, 1))::int as "fullPacksRemaining",
        (COALESCE(SUM(b.quantity_units_remaining), 0) % GREATEST(ii.units_per_pack, 1))::int as "looseUnitsRemaining",
        COALESCE(AVG(b.purchase_price_pack), 0)::numeric as "avgCostPack",
        COALESCE(SUM((b.quantity_units_remaining::numeric / GREATEST(ii.units_per_pack, 1)) * b.purchase_price_pack), 0)::numeric as "totalCostValue",
        COALESCE(SUM((b.quantity_units_remaining::numeric / GREATEST(ii.units_per_pack, 1)) * ii.selling_price_pack), 0)::numeric as "totalRetailValue"
      FROM "${schemaName}".inventory_items ii
      JOIN public.medicines m ON ii.medicine_id = m.id
      LEFT JOIN "${schemaName}".inventory_batches b ON ii.id = b.inventory_item_id AND b.quantity_units_remaining > 0
      GROUP BY ii.id, m.id
      ORDER BY m.trade_name ASC;
    `;

    const items: any[] = await this.prisma.$queryRawUnsafe(sql);
    return items;
  }

  /**
   * Sold Medicines Outflow Stocktake (Daily, Weekly, Monthly, Yearly)
   */
  async getSoldMedicinesStocktake(dto: DateRangeDto) {
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

    const sql = `
      SELECT 
        m.id as "medicineId",
        m.trade_name as "tradeName",
        m.scientific_name as "scientificName",
        m.dosage_form as "dosageForm",
        m.barcode,
        ii.units_per_pack as "unitsPerPack",
        COUNT(DISTINCT s.id)::int as "invoicesCount",
        SUM(CASE WHEN si.unit_type = 'PACK' THEN si.quantity ELSE 0 END)::int as "soldPacks",
        SUM(CASE WHEN si.unit_type = 'STRIP' THEN si.quantity ELSE 0 END)::int as "soldStrips",
        COALESCE(SUM(
          CASE 
            WHEN si.unit_type = 'PACK' THEN si.quantity * COALESCE(b.purchase_price_pack, 0)
            ELSE (si.quantity::numeric / GREATEST(ii.units_per_pack, 1)) * COALESCE(b.purchase_price_pack, 0)
          END
        ), 0)::numeric as "totalCost",
        COALESCE(SUM(si.total_price), 0)::numeric as "totalRevenue",
        COALESCE(SUM(si.total_price), 0)::numeric - COALESCE(SUM(
          CASE 
            WHEN si.unit_type = 'PACK' THEN si.quantity * COALESCE(b.purchase_price_pack, 0)
            ELSE (si.quantity::numeric / GREATEST(ii.units_per_pack, 1)) * COALESCE(b.purchase_price_pack, 0)
          END
        ), 0)::numeric as "totalProfit"
      FROM "${schemaName}".sale_items si
      JOIN "${schemaName}".sales s ON si.sale_id = s.id
      JOIN "${schemaName}".inventory_items ii ON si.inventory_item_id = ii.id
      JOIN public.medicines m ON ii.medicine_id = m.id
      LEFT JOIN "${schemaName}".inventory_batches b ON si.inventory_batch_id = b.id
      ${dateFilter}
      GROUP BY m.id, ii.id
      ORDER BY "totalRevenue" DESC;
    `;

    const items: any[] = await this.prisma.$queryRawUnsafe(sql, ...params);
    return items;
  }

  /**
   * Periodic Debts & Supplier Invoices Report
   */
  async getDebtsReport(dto: DateRangeDto) {
    const schemaName = this.tenantContext.getSchemaName();

    let dateFilter = '';
    const params: any[] = [];

    if (dto.from && dto.to) {
      params.push(`${dto.from} 00:00:00`, `${dto.to} 23:59:59`);
      dateFilter = `WHERE si.invoice_date >= $1::date AND si.invoice_date <= $2::date`;
    } else if (dto.from) {
      params.push(`${dto.from} 00:00:00`);
      dateFilter = `WHERE si.invoice_date >= $1::date`;
    }

    try {
      const sql = `
        SELECT 
          s.id as "supplierId",
          s.name as "supplierName",
          s.phone,
          COUNT(si.id)::int as "invoicesCount",
          COALESCE(SUM(si.total_amount), 0)::numeric as "totalPurchases",
          COALESCE(SUM(si.paid_amount), 0)::numeric as "totalPaid",
          COALESCE(SUM(si.remaining_amount), 0)::numeric as "remainingDebt"
        FROM "${schemaName}".suppliers s
        LEFT JOIN "${schemaName}".supplier_invoices si ON s.id = si.supplier_id
        ${dateFilter}
        GROUP BY s.id
        ORDER BY "remainingDebt" DESC;
      `;

      const suppliersReport: any[] = await this.prisma.$queryRawUnsafe(sql, ...params);

      // Summary
      let totalPurchases = 0;
      let totalPaid = 0;
      let totalRemainingDebt = 0;
      for (const sup of suppliersReport) {
        totalPurchases += Number(sup.totalPurchases || 0);
        totalPaid += Number(sup.totalPaid || 0);
        totalRemainingDebt += Number(sup.remainingDebt || 0);
      }

      return {
        summary: {
          totalPurchases,
          totalPaid,
          totalRemainingDebt,
          totalSuppliers: suppliersReport.length,
        },
        suppliers: suppliersReport,
      };
    } catch {
      return {
        summary: { totalPurchases: 0, totalPaid: 0, totalRemainingDebt: 0, totalSuppliers: 0 },
        suppliers: [],
      };
    }
  }

  /**
   * Comprehensive Net Profit (P&L) Report with Operating Expenses Breakdown
   */
  async getNetProfitReport(dto: DateRangeDto) {
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

    // 1. Sales Revenue
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
    const s = salesStats[0] || { totalInvoicesCount: 0, grossSales: 0, totalDiscounts: 0, netRevenue: 0 };

    // 2. Returns
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
    const r = returnsStats[0] || { totalReturnsCount: 0, totalRefunds: 0 };

    // 3. COGS
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
    const cogs = Number(cogsStats[0]?.cogs || 0);

    // 4. Operating Expenses
    let expDateFilter = '';
    const expParams: any[] = [];
    if (dto.from && dto.to) {
      expParams.push(dto.from, dto.to);
      expDateFilter = `WHERE expense_date >= $1::date AND expense_date <= $2::date`;
    } else if (dto.from) {
      expParams.push(dto.from);
      expDateFilter = `WHERE expense_date >= $1::date`;
    }

    let totalExpenses = 0;
    let expensesByCategory: Record<string, number> = {};

    try {
      const expensesQuery = `
        SELECT category, SUM(amount)::numeric as total
        FROM "${schemaName}".expenses
        ${expDateFilter}
        GROUP BY category;
      `;
      const expRows: any[] = await this.prisma.$queryRawUnsafe(expensesQuery, ...expParams);
      for (const row of expRows) {
        const amt = Number(row.total || 0);
        expensesByCategory[row.category] = amt;
        totalExpenses += amt;
      }
    } catch {
      // If expenses table not yet populated
    }

    const netSales = Number(s.netRevenue) - Number(r.totalRefunds);
    const grossProfit = netSales - cogs;
    const netProfit = grossProfit - totalExpenses;
    const netProfitMarginPercent = netSales > 0 ? Number(((netProfit / netSales) * 100).toFixed(2)) : 0;

    return {
      period: {
        from: dto.from || 'البداية',
        to: dto.to || 'الآن',
      },
      revenue: {
        grossSales: Number(s.grossSales),
        totalDiscounts: Number(s.totalDiscounts),
        totalRefunds: Number(r.totalRefunds),
        netSales,
      },
      cogs,
      grossProfit,
      expenses: {
        total: totalExpenses,
        byCategory: expensesByCategory,
      },
      netProfit,
      netProfitMarginPercent,
    };
  }

  /**
   * Dead Stock (Stagnant Inventory) Analytics Report
   */
  async getDeadStockReport(thresholdDays: number = 60) {
    const schemaName = this.tenantContext.getSchemaName();
    const days = Number(thresholdDays) || 60;

    const sql = `
      SELECT 
        ii.id as "inventoryItemId",
        m.trade_name as "tradeName",
        m.scientific_name as "scientificName",
        m.barcode,
        ii.units_per_pack as "unitsPerPack",
        ii.selling_price_pack as "sellingPricePack",
        COALESCE(SUM(b.quantity_units_remaining), 0)::int as "totalUnitsRemaining",
        COALESCE(
          SUM((b.quantity_units_remaining::numeric / GREATEST(ii.units_per_pack, 1)) * COALESCE(b.purchase_price_pack, 0)),
          0
        )::numeric as "stagnantCapital",
        MAX(s.created_at) as "lastSoldAt"
      FROM "${schemaName}".inventory_items ii
      JOIN public.medicines m ON ii.medicine_id = m.id
      LEFT JOIN "${schemaName}".inventory_batches b ON ii.id = b.inventory_item_id
      LEFT JOIN "${schemaName}".sale_items si ON ii.id = si.inventory_item_id
      LEFT JOIN "${schemaName}".sales s ON si.sale_id = s.id
      GROUP BY ii.id, m.trade_name, m.scientific_name, m.barcode, ii.units_per_pack, ii.selling_price_pack
      HAVING 
        COALESCE(SUM(b.quantity_units_remaining), 0) > 0
        AND (
          MAX(s.created_at) IS NULL 
          OR MAX(s.created_at) < (CURRENT_TIMESTAMP - INTERVAL '${days} days')
        )
      ORDER BY "stagnantCapital" DESC
      LIMIT 100;
    `;

    try {
      const items: any[] = await this.prisma.$queryRawUnsafe(sql);
      let totalStagnantCapital = 0;
      let totalStagnantItemsCount = items.length;

      for (const it of items) {
        totalStagnantCapital += Number(it.stagnantCapital || 0);
      }

      return {
        thresholdDays: days,
        summary: {
          totalStagnantItemsCount,
          totalStagnantCapital,
        },
        items: items || [],
      };
    } catch {
      return {
        thresholdDays: days,
        summary: { totalStagnantItemsCount: 0, totalStagnantCapital: 0 },
        items: [],
      };
    }
  }
}
