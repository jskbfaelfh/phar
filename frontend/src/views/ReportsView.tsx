import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  PieChart,
  ShoppingBag,
  RefreshCw,
  Calendar,
  Layers,
} from 'lucide-react';
import { apiRequest } from '../api/client';

export const ReportsView: React.FC = () => {
  const today = new Date().toISOString().slice(0, 10);
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const [from, setFrom] = useState(firstDayOfMonth);
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(false);

  const [financialData, setFinancialData] = useState<any | null>(null);
  const [topMedicines, setTopMedicines] = useState<any[]>([]);
  const [inventoryValuation, setInventoryValuation] = useState<any | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const [fin, top, val] = await Promise.all([
        apiRequest<any>(`/reports/financial?from=${from}&to=${to}`),
        apiRequest<any[]>(`/reports/top-selling?from=${from}&to=${to}&limit=10`),
        apiRequest<any>('/reports/inventory-valuation'),
      ]);

      setFinancialData(fin);
      setTopMedicines(top);
      setInventoryValuation(val);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [from, to]);

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Header & Date Range Filter */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-emerald-600" />
            التقارير المالية وحسابات الأرباح
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            عرض تفصيلي للمبيعات، تكلفة البضاعة، صافي الأرباح، والأدوية الأكثر طلباً.
          </p>
        </div>

        {/* Date Filters */}
        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-bold text-slate-600">من:</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold"
          />
          <span className="text-xs font-bold text-slate-600 mr-2">إلى:</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold"
          />
          <button
            onClick={fetchReports}
            className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Top 4 Financial KPI Cards */}
      {financialData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
              <span>صافي الإيرادات</span>
              <DollarSign className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 mt-2">
              {Number(financialData.sales.netRevenue).toLocaleString()} د.ع
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              عدد الفواتير: {financialData.sales.totalInvoices}
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
              <span>تكلفة البضاعة المباعة (COGS)</span>
              <ShoppingBag className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-900 mt-2">
              {Number(financialData.profitability.costOfGoodsSold).toLocaleString()} د.ع
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              المبالغ المستردة للمرتجعات: {financialData.returns.totalRefunds.toLocaleString()} د.ع
            </div>
          </div>

          <div className="bg-emerald-50/70 p-5 rounded-2xl border border-emerald-200 shadow-xs">
            <div className="flex items-center justify-between text-emerald-800 text-xs font-bold">
              <span>صافي الربح التقديري</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-3xl font-black text-emerald-900 mt-2">
              {Number(financialData.profitability.grossProfit).toLocaleString()} د.ع
            </div>
            <div className="text-[11px] text-emerald-700 font-bold mt-1">
              (الإيرادات - تكلفة الشراء - المرتجعات)
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
              <span>هامش الربح %</span>
              <PieChart className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-3xl font-black text-purple-900 mt-2">
              {financialData.profitability.profitMarginPercent}%
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              متوسط ربحية المبيعات في هذه الفترة
            </div>
          </div>
        </div>
      )}

      {/* Inventory Valuation Card */}
      {inventoryValuation && (
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <div className="text-xs text-indigo-300 font-bold flex items-center gap-1.5">
              <Layers className="w-4 h-4" />
              تقييم المخزون الحالي في الرفوف
            </div>
            <div className="text-xl font-bold mt-1">
              تحتوي الصيدلية على <span className="text-indigo-400 font-black">{inventoryValuation.totalDistinctItems}</span> صنف دوائي
            </div>
          </div>

          <div className="flex items-center gap-8 text-right">
            <div>
              <div className="text-xs text-slate-400">إجمالي رأس المال بالمخزن (سعر الشراء)</div>
              <div className="text-xl font-black text-slate-100">
                {Number(inventoryValuation.totalCostValue).toLocaleString()} د.ع
              </div>
            </div>
            <div>
              <div className="text-xs text-indigo-300">القيمة التقديرية بالبيع (سعر الرف)</div>
              <div className="text-2xl font-black text-emerald-400">
                {Number(inventoryValuation.totalRetailValue).toLocaleString()} د.ع
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Selling Medicines Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-slate-600" />
            الأدوية الأكثر مبيعاً وإيراداً خلال الفترة
          </h2>
          <span className="text-xs text-slate-500 font-medium">أعلى 10 أدوية طلباً</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100/75 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3 w-12 text-center">#</th>
                <th className="p-3">اسم الدواء</th>
                <th className="p-3">الاسم العلمي</th>
                <th className="p-3 text-center">العلب المباعة</th>
                <th className="p-3 text-center">الأشرطة المباعة</th>
                <th className="p-3 text-center">عدد الفواتير</th>
                <th className="p-3">إجمالي الإيراد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topMedicines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    لا توجد عمليات بيع مسجلة في هذه الفترة الزمنية.
                  </td>
                </tr>
              ) : (
                topMedicines.map((item, idx) => (
                  <tr key={item.medicineId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                    <td className="p-3">
                      <div className="font-bold text-slate-900 text-sm">{item.tradeName}</div>
                      <div className="text-[10px] text-slate-500">{item.dosageForm || ''}</div>
                    </td>
                    <td className="p-3 text-slate-600 font-medium">{item.scientificName}</td>
                    <td className="p-3 text-center font-bold text-slate-800">{item.soldPacks}</td>
                    <td className="p-3 text-center font-bold text-blue-700">{item.soldStrips}</td>
                    <td className="p-3 text-center text-slate-600 font-semibold">{item.invoicesCount}</td>
                    <td className="p-3 font-bold text-emerald-800 text-sm">
                      {Number(item.totalRevenue).toLocaleString()} د.ع
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
