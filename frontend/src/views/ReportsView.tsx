import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  ShoppingBag,
  RefreshCw,
  Calendar,
  Package,
  FileSpreadsheet,
  Printer,
  Search,
  Users,
  CreditCard,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { apiRequest } from '../api/client';

export const ReportsView: React.FC = () => {
  const today = new Date().toISOString().slice(0, 10);
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  // Active Tab: 'inventory' | 'sold' | 'debts' | 'financial' | 'net_profit' | 'dead_stock'
  const [activeTab, setActiveTab] = useState<'inventory' | 'sold' | 'debts' | 'financial' | 'net_profit' | 'dead_stock'>('inventory');

  // Date Range States
  const [periodPreset, setPeriodPreset] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [from, setFrom] = useState(firstDayOfMonth);
  const [to, setTo] = useState(today);
  const [deadStockDays, setDeadStockDays] = useState<number>(60);

  // Search filter inside tables
  const [tableSearch, setTableSearch] = useState('');

  // Loading States
  const [loading, setLoading] = useState(false);

  // Data States
  const [financialData, setFinancialData] = useState<any | null>(null);
  const [netProfitReport, setNetProfitReport] = useState<any | null>(null);
  const [deadStockReport, setDeadStockReport] = useState<any | null>(null);
  const [topMedicines, setTopMedicines] = useState<any[]>([]);
  const [inventoryValuation, setInventoryValuation] = useState<any | null>(null);
  const [currentStocktake, setCurrentStocktake] = useState<any[]>([]);
  const [soldStocktake, setSoldStocktake] = useState<any[]>([]);
  const [debtsReport, setDebtsReport] = useState<any | null>(null);

  // Set Preset Date Ranges
  const handleSetPreset = (preset: 'today' | 'week' | 'month' | 'year') => {
    setPeriodPreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    setTo(todayStr);

    if (preset === 'today') {
      setFrom(todayStr);
    } else if (preset === 'week') {
      const pastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setFrom(pastWeek.toISOString().slice(0, 10));
    } else if (preset === 'month') {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setFrom(firstOfMonth.toISOString().slice(0, 10));
    } else if (preset === 'year') {
      const firstOfYear = new Date(now.getFullYear(), 0, 1);
      setFrom(firstOfYear.toISOString().slice(0, 10));
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      if (activeTab === 'inventory') {
        const [val, stock] = await Promise.all([
          apiRequest<any>('/reports/inventory-valuation'),
          apiRequest<any[]>('/reports/stocktake/current'),
        ]);
        setInventoryValuation(val);
        setCurrentStocktake(stock || []);
      } else if (activeTab === 'sold') {
        const sold = await apiRequest<any[]>(`/reports/stocktake/sold?from=${from}&to=${to}`);
        setSoldStocktake(sold || []);
      } else if (activeTab === 'debts') {
        const debts = await apiRequest<any>(`/reports/debts/summary?from=${from}&to=${to}`);
        setDebtsReport(debts);
      } else if (activeTab === 'financial') {
        const [fin, top, val] = await Promise.all([
          apiRequest<any>(`/reports/financial?from=${from}&to=${to}`),
          apiRequest<any[]>(`/reports/top-selling?from=${from}&to=${to}&limit=10`),
          apiRequest<any>('/reports/inventory-valuation'),
        ]);
        setFinancialData(fin);
        setTopMedicines(top || []);
        setInventoryValuation(val);
      } else if (activeTab === 'net_profit') {
        const profit = await apiRequest<any>(`/reports/net-profit?from=${from}&to=${to}`);
        setNetProfitReport(profit);
      } else if (activeTab === 'dead_stock') {
        const dead = await apiRequest<any>(`/reports/dead-stock?days=${deadStockDays}`);
        setDeadStockReport(dead);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [activeTab, from, to, deadStockDays]);

  // Export CSV Helper
  const exportToCSV = (filename: string, rows: (string | number)[][], headers: string[]) => {
    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join(
        '\n',
      );
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered Lists
  const filteredCurrentStock = currentStocktake.filter(
    (item) =>
      !tableSearch ||
      item.tradeName?.toLowerCase().includes(tableSearch.toLowerCase()) ||
      item.scientificName?.toLowerCase().includes(tableSearch.toLowerCase()) ||
      item.customName?.toLowerCase().includes(tableSearch.toLowerCase()) ||
      item.barcode?.includes(tableSearch),
  );

  const filteredSoldStock = soldStocktake.filter(
    (item) =>
      !tableSearch ||
      item.tradeName?.toLowerCase().includes(tableSearch.toLowerCase()) ||
      item.scientificName?.toLowerCase().includes(tableSearch.toLowerCase()) ||
      item.barcode?.includes(tableSearch),
  );

  return (
    <div className="flex flex-col gap-5 pb-12 font-sans">
      {/* 1. Header & Tabs */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Navigation Tabs (Concise 1-2 words) */}
        <div className="flex items-center gap-1.5 bg-slate-100/80 p-1.5 rounded-2xl w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'inventory'
                ? 'bg-white text-indigo-950 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Package className="w-4 h-4 text-indigo-600" />
            جرد المخزون
          </button>

          <button
            onClick={() => setActiveTab('sold')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'sold'
                ? 'bg-white text-indigo-950 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
            جرد المباع
          </button>

          <button
            onClick={() => setActiveTab('debts')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'debts'
                ? 'bg-white text-indigo-950 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <CreditCard className="w-4 h-4 text-rose-600" />
            كشف الديون
          </button>

          <button
            onClick={() => setActiveTab('financial')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'financial'
                ? 'bg-white text-indigo-950 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-purple-600" />
            مجمل الأرباح
          </button>

          <button
            onClick={() => setActiveTab('net_profit')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'net_profit'
                ? 'bg-white text-indigo-950 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <DollarSign className="w-4 h-4 text-emerald-600" />
            صافي الأرباح (P&L)
          </button>

          <button
            onClick={() => setActiveTab('dead_stock')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'dead_stock'
                ? 'bg-white text-indigo-950 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            الراكد (Dead Stock)
          </button>
        </div>

        {/* Action Tools: Print */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            طباعة
          </button>
          <button
            onClick={fetchReports}
            className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            title="تحديث"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Periodic Filters (For Sold, Debts, and Financial tabs) */}
      {activeTab !== 'inventory' && (
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
          {/* Quick Presets */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-400 ml-1">الفترة:</span>
            {[
              { id: 'today', label: 'اليوم' },
              { id: 'week', label: 'أسبوع' },
              { id: 'month', label: 'شهر' },
              { id: 'year', label: 'سنة' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handleSetPreset(p.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  periodPreset === p.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date Picker Range */}
          <div className="flex items-center gap-2 text-xs font-bold">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>من:</span>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPeriodPreset('custom');
              }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
            />
            <span>إلى:</span>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPeriodPreset('custom');
              }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
            />
          </div>
        </div>
      )}

      {/* 3. Tab Contents */}

      {/* TAB 1: جرد المخزون الحالي */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Inventory KPI Summary */}
          {inventoryValuation && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-xs text-slate-400 font-bold">إجمالي المواد</div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {inventoryValuation.totalDistinctItems} مادة
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-xs text-slate-400 font-bold">رأس المال (سعر الشراء)</div>
                <div className="text-xl font-black text-amber-900 mt-1">
                  {Number(inventoryValuation.totalCostValue).toLocaleString()} د.ع
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-xs text-slate-400 font-bold">القيمة بالبيع (سعر الرف)</div>
                <div className="text-xl font-black text-blue-900 mt-1">
                  {Number(inventoryValuation.totalRetailValue).toLocaleString()} د.ع
                </div>
              </div>

              <div className="bg-emerald-50/80 p-4 rounded-2xl border border-emerald-200 shadow-xs">
                <div className="text-xs text-emerald-800 font-bold">الربح المتوقع</div>
                <div className="text-2xl font-black text-emerald-900 mt-1">
                  {Number(inventoryValuation.expectedProfit).toLocaleString()} د.ع
                </div>
              </div>
            </div>
          )}

          {/* Search & Export Toolbar */}
          <div className="flex items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="بحث في مواد الجرد..."
                className="w-full pr-9 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold placeholder:text-slate-400 focus:outline-hidden focus:bg-white"
              />
            </div>

            <button
              onClick={() =>
                exportToCSV(
                  'جرد_المخزون_الحالي',
                  filteredCurrentStock.map((i, idx) => [
                    idx + 1,
                    i.tradeName,
                    i.scientificName,
                    i.fullPacksRemaining,
                    i.looseUnitsRemaining,
                    i.totalUnitsRemaining,
                    Number(i.avgCostPack).toFixed(0),
                    Number(i.sellingPricePack),
                    Number(i.totalCostValue).toFixed(0),
                    Number(i.totalRetailValue).toFixed(0),
                  ]),
                  ['#', 'الدواء', 'الاسم العلمي', 'العلب', 'الأشرطة المتبقية', 'إجمالي القطع', 'سعر الشراء', 'سعر البيع', 'قيمة الشراء', 'قيمة البيع'],
                )
              }
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              تصدير Excel
            </button>
          </div>

          {/* Stocktake Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-10 text-center">#</th>
                    <th className="p-3">الدواء</th>
                    <th className="p-3">الاسم العلمي</th>
                    <th className="p-3 text-center">العلب</th>
                    <th className="p-3 text-center">الأشرطة</th>
                    <th className="p-3 text-center">شراء العلبة</th>
                    <th className="p-3 text-center">بيع العلبة</th>
                    <th className="p-3">إجمالي الكلفة</th>
                    <th className="p-3">إجمالي البيع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredCurrentStock.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400 font-bold">
                        لا توجد مواد مطابقة للبحث
                      </td>
                    </tr>
                  ) : (
                    filteredCurrentStock.map((item, idx) => (
                      <tr key={item.inventoryItemId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{item.tradeName}</div>
                          {item.customName && (
                            <div className="text-[10px] text-amber-700 font-bold">({item.customName})</div>
                          )}
                        </td>
                        <td className="p-3 text-slate-500">{item.scientificName}</td>
                        <td className="p-3 text-center font-bold text-slate-900">{item.fullPacksRemaining}</td>
                        <td className="p-3 text-center font-bold text-blue-700">
                          {item.looseUnitsRemaining} / {item.unitsPerPack}
                        </td>
                        <td className="p-3 text-center text-slate-600">
                          {Number(item.avgCostPack).toLocaleString()} د.ع
                        </td>
                        <td className="p-3 text-center font-bold text-emerald-700">
                          {Number(item.sellingPricePack).toLocaleString()} د.ع
                        </td>
                        <td className="p-3 text-amber-950 font-bold">
                          {Number(item.totalCostValue).toLocaleString()} د.ع
                        </td>
                        <td className="p-3 text-emerald-900 font-black">
                          {Number(item.totalRetailValue).toLocaleString()} د.ع
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: جرد المواد المباعة (Outflow Stock Movement) */}
      {activeTab === 'sold' && (
        <div className="space-y-4">
          {/* Search & Export Toolbar */}
          <div className="flex items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="بحث في المواد المباعة..."
                className="w-full pr-9 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold placeholder:text-slate-400 focus:outline-hidden focus:bg-white"
              />
            </div>

            <button
              onClick={() =>
                exportToCSV(
                  `جرد_المبيعات_${from}_الى_${to}`,
                  filteredSoldStock.map((i, idx) => [
                    idx + 1,
                    i.tradeName,
                    i.scientificName,
                    i.soldPacks,
                    i.soldStrips,
                    i.invoicesCount,
                    Number(i.totalCost),
                    Number(i.totalRevenue),
                    Number(i.totalProfit),
                  ]),
                  ['#', 'الدواء', 'الاسم العلمي', 'العلب المباعة', 'الأشرطة المباعة', 'الفواتير', 'الكلفة', 'الإيراد', 'صافي الربح'],
                )
              }
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              تصدير Excel
            </button>
          </div>

          {/* Sold Stock Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-10 text-center">#</th>
                    <th className="p-3">الدواء</th>
                    <th className="p-3">الاسم العلمي</th>
                    <th className="p-3 text-center">العلب المباعة</th>
                    <th className="p-3 text-center">الأشرطة المباعة</th>
                    <th className="p-3 text-center">عدد الفواتير</th>
                    <th className="p-3">إجمالي الكلفة</th>
                    <th className="p-3">إجمالي المبيعات</th>
                    <th className="p-3">صافي الربح</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredSoldStock.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400 font-bold">
                        لا توجد مبيعات مسجلة في هذه الفترة المحددة
                      </td>
                    </tr>
                  ) : (
                    filteredSoldStock.map((item, idx) => (
                      <tr key={item.medicineId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{item.tradeName}</div>
                          <div className="text-[10px] text-slate-400">{item.dosageForm}</div>
                        </td>
                        <td className="p-3 text-slate-500">{item.scientificName}</td>
                        <td className="p-3 text-center font-black text-slate-900">{item.soldPacks}</td>
                        <td className="p-3 text-center font-black text-blue-700">{item.soldStrips}</td>
                        <td className="p-3 text-center font-bold text-slate-600">{item.invoicesCount}</td>
                        <td className="p-3 text-amber-950 font-bold">
                          {Number(item.totalCost).toLocaleString()} د.ع
                        </td>
                        <td className="p-3 text-slate-900 font-black">
                          {Number(item.totalRevenue).toLocaleString()} د.ع
                        </td>
                        <td className="p-3 text-emerald-700 font-black">
                          {Number(item.totalProfit).toLocaleString()} د.ع
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: كشف الديون وحسابات المشتريات */}
      {activeTab === 'debts' && (
        <div className="space-y-4">
          {debtsReport && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-xs text-slate-400 font-bold">إجمالي المشتريات في الفترة</div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {Number(debtsReport.summary.totalPurchases).toLocaleString()} د.ع
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-xs text-slate-400 font-bold">المبالغ المسددة</div>
                <div className="text-2xl font-black text-emerald-800 mt-1">
                  {Number(debtsReport.summary.totalPaid).toLocaleString()} د.ع
                </div>
              </div>

              <div className="bg-rose-50/80 p-4 rounded-2xl border border-rose-200 shadow-xs">
                <div className="text-xs text-rose-800 font-bold">الديون المتبقية في الذمة</div>
                <div className="text-2xl font-black text-rose-900 mt-1">
                  {Number(debtsReport.summary.totalRemainingDebt).toLocaleString()} د.ع
                </div>
              </div>
            </div>
          )}

          {/* Suppliers Debt Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600" />
                كشف حساب المذاخر
              </h3>

              {debtsReport?.suppliers && (
                <button
                  onClick={() =>
                    exportToCSV(
                      `كشف_ديون_المذاخر_${from}_الى_${to}`,
                      debtsReport.suppliers.map((s: any, idx: number) => [
                        idx + 1,
                        s.supplierName,
                        s.phone || 'غير مسجل',
                        s.invoicesCount,
                        Number(s.totalPurchases),
                        Number(s.totalPaid),
                        Number(s.remainingDebt),
                      ]),
                      ['#', 'المذخر', 'الهاتف', 'الفواتير', 'المشتريات', 'المسدد', 'الديون المتبقية'],
                    )
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  تصدير Excel
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-10 text-center">#</th>
                    <th className="p-3">المذخر</th>
                    <th className="p-3">الهاتف</th>
                    <th className="p-3 text-center">الفواتير</th>
                    <th className="p-3">إجمالي المشتريات</th>
                    <th className="p-3">المسدد نقداً</th>
                    <th className="p-3">الديون المتبقية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {(!debtsReport?.suppliers || debtsReport.suppliers.length === 0) ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 font-bold">
                        لا توجد فواتير أو ديون للمذاخر في هذه الفترة
                      </td>
                    </tr>
                  ) : (
                    debtsReport.suppliers.map((sup: any, idx: number) => (
                      <tr key={sup.supplierId} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3 text-center text-slate-400 font-bold">{idx + 1}</td>
                        <td className="p-3 font-bold text-slate-900 text-sm">{sup.supplierName}</td>
                        <td className="p-3 text-slate-500 font-mono">{sup.phone || '—'}</td>
                        <td className="p-3 text-center font-bold text-slate-700">{sup.invoicesCount}</td>
                        <td className="p-3 text-slate-900 font-bold">
                          {Number(sup.totalPurchases).toLocaleString()} د.ع
                        </td>
                        <td className="p-3 text-emerald-700 font-bold">
                          {Number(sup.totalPaid).toLocaleString()} د.ع
                        </td>
                        <td className="p-3 text-rose-700 font-black">
                          {Number(sup.remainingDebt).toLocaleString()} د.ع
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: كشف الأرباح والتقرير المالي */}
      {activeTab === 'financial' && financialData && (
        <div className="space-y-5">
          {/* Top 4 Financial KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>صافي الإيرادات</span>
                <DollarSign className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">
                {Number(financialData.sales.netRevenue).toLocaleString()} د.ع
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-bold">
                عدد الفواتير: {financialData.sales.totalInvoices}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>تكلفة الشراء (COGS)</span>
                <ShoppingBag className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-amber-900 mt-2">
                {Number(financialData.profitability.costOfGoodsSold).toLocaleString()} د.ع
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-bold">
                المرتجعات: {Number(financialData.returns.totalRefunds).toLocaleString()} د.ع
              </div>
            </div>

            <div className="bg-emerald-50/70 p-5 rounded-2xl border border-emerald-200 shadow-xs">
              <div className="flex items-center justify-between text-emerald-800 text-xs font-bold">
                <span>صافي الأرباح</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-3xl font-black text-emerald-900 mt-2">
                {Number(financialData.profitability.grossProfit).toLocaleString()} د.ع
              </div>
              <div className="text-[11px] text-emerald-700 font-bold mt-1">
                (الإيراد - كلفة الشراء)
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
              <div className="text-[11px] text-slate-400 mt-1 font-bold">
                متوسط ربحية المبيعات
              </div>
            </div>
          </div>

          {/* Top 10 Best Selling Medicines */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-slate-600" />
                الأدوية الأكثر مبيعاً في الفترة
              </h2>
              <span className="text-xs text-slate-500 font-bold">أعلى 10 أدوية طلباً</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100/75 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3 w-12 text-center">#</th>
                    <th className="p-3">اسم الدواء</th>
                    <th className="p-3">الاسم العلمي</th>
                    <th className="p-3 text-center">العلب</th>
                    <th className="p-3 text-center">الأشرطة</th>
                    <th className="p-3 text-center">الفواتير</th>
                    <th className="p-3">الإيراد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topMedicines.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 font-bold">
                        لا توجد عمليات بيع مسجلة في هذه الفترة
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
                        <td className="p-3 text-center font-black text-slate-800">{item.soldPacks}</td>
                        <td className="p-3 text-center font-black text-blue-700">{item.soldStrips}</td>
                        <td className="p-3 text-center text-slate-600 font-bold">{item.invoicesCount}</td>
                        <td className="p-3 font-black text-emerald-800 text-sm">
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
      )}

      {/* 5. Net Profit (P&L) Tab View */}
      {activeTab === 'net_profit' && netProfitReport && (
        <div className="flex flex-col gap-5">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>صافي الإيرادات</span>
                <DollarSign className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-xl font-black text-slate-900 mt-2 font-mono">
                {Number(netProfitReport.revenue.netSales).toLocaleString()} د.ع
              </div>
              <div className="text-[10px] text-slate-400 mt-1">بعد الخصومات والمرتجعات</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>تكلفة البضاعة (COGS)</span>
                <ShoppingBag className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-xl font-black text-amber-900 mt-2 font-mono">
                {Number(netProfitReport.cogs).toLocaleString()} د.ع
              </div>
              <div className="text-[10px] text-slate-400 mt-1">سعر شراء الأدوية المباعة</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>مجمل الربح التجاري</span>
                <TrendingUp className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-xl font-black text-indigo-900 mt-2 font-mono">
                {Number(netProfitReport.grossProfit).toLocaleString()} د.ع
              </div>
              <div className="text-[10px] text-slate-400 mt-1">(الإيراد - كلفة الشراء)</div>
            </div>

            <div className="bg-rose-50/60 p-4 rounded-2xl border border-rose-200 shadow-xs">
              <div className="flex items-center justify-between text-rose-800 text-xs font-bold">
                <span>المصاريف التشغيلية</span>
                <TrendingDown className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-xl font-black text-rose-700 mt-2 font-mono">
                {Number(netProfitReport.expenses.total).toLocaleString()} د.ع
              </div>
              <div className="text-[10px] text-rose-600 mt-1">رواتب، إيجار، كهرباء، نثريات</div>
            </div>

            <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-md">
              <div className="flex items-center justify-between text-emerald-100 text-xs font-bold">
                <span>صافي الربح الفعلي</span>
                <DollarSign className="w-4 h-4 text-emerald-200" />
              </div>
              <div className="text-2xl font-black mt-2 font-mono">
                {Number(netProfitReport.netProfit).toLocaleString()} د.ع
              </div>
              <div className="text-[11px] text-emerald-100 mt-1 font-bold">
                هامش الربح: {netProfitReport.netProfitMarginPercent}%
              </div>
            </div>
          </div>

          {/* Expenses Breakdown by Category */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-600" />
                تفصيل المصاريف التشغيلية للفترة
              </h2>
              <span className="text-xs text-slate-500 font-bold">
                إجمالي المصاريف: {Number(netProfitReport.expenses.total).toLocaleString()} د.ع
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100/75 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">فئة المصروف</th>
                    <th className="p-3">المبلغ الإجمالي</th>
                    <th className="p-3 text-center">النسبة من إجمالي المصاريف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {Object.keys(netProfitReport.expenses.byCategory || {}).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-slate-400 font-bold">
                        لا توجد مصاريف مسجلة في هذه الفترة
                      </td>
                    </tr>
                  ) : (
                    Object.entries(netProfitReport.expenses.byCategory).map(([cat, amt]: any) => {
                      const pct =
                        netProfitReport.expenses.total > 0
                          ? ((Number(amt) / netProfitReport.expenses.total) * 100).toFixed(1)
                          : '0';
                      return (
                        <tr key={cat} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-900">{cat}</td>
                          <td className="p-3 font-mono font-black text-rose-600 text-sm">
                            {Number(amt).toLocaleString()} د.ع
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-slate-600">{pct}%</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. Dead Stock (Stagnant Inventory) Tab View */}
      {activeTab === 'dead_stock' && (
        <div className="flex flex-col gap-5">
          {/* Days Threshold & Action Bar */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">فترة الركود (عدم البيع):</span>
              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                {[30, 60, 90, 180].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDeadStockDays(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      deadStockDays === d
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {d} يوم
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!deadStockReport?.items) return;
                  const rows = deadStockReport.items.map((it: any) => [
                    it.tradeName,
                    it.scientificName || '',
                    it.barcode || '',
                    it.totalUnitsRemaining,
                    it.sellingPricePack,
                    it.stagnantCapital,
                    it.lastSoldAt ? new Date(it.lastSoldAt).toLocaleDateString('ar-IQ') : 'لم يُباع قط',
                  ]);
                  exportToCSV(
                    'تقرير_الراكد_دوائي',
                    rows,
                    ['اسم الدواء', 'الاسم العلمي', 'الباركود', 'الكمية', 'سعر البيع', 'رأس المال المجمد', 'آخر بيع'],
                  );
                }}
                className="flex items-center gap-1 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-200 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                تصدير Excel (CSV)
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-amber-50/70 p-5 rounded-2xl border border-amber-200 shadow-xs">
              <div className="flex items-center justify-between text-amber-900 text-xs font-bold">
                <span>إجمالي رأس المال المجمد (التكلفة)</span>
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-amber-950 mt-2 font-mono">
                {Number(deadStockReport?.summary?.totalStagnantCapital || 0).toLocaleString()} د.ع
              </div>
              <div className="text-[11px] text-amber-800 font-medium mt-1">
                سيولة محبوسة في بضاعة راكدة لم تتحرك لأكثر من {deadStockDays} يوم
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>عدد الأدوية الراكدة</span>
                <Package className="w-5 h-5 text-slate-400" />
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
                {deadStockReport?.summary?.totalStagnantItemsCount || 0} دواء
              </div>
              <div className="text-[11px] text-slate-400 mt-1 font-bold">
                يُنصح بعمل عروض ترويجية أو إرجاعها للمذاخر
              </div>
            </div>
          </div>

          {/* Dead Stock Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100/75 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">اسم الدواء</th>
                    <th className="p-3">الاسم العلمي</th>
                    <th className="p-3 text-center">الكمية بالمخزن</th>
                    <th className="p-3">سعر البيع</th>
                    <th className="p-3">رأس المال المجمد</th>
                    <th className="p-3">تاريخ آخر بيع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {!deadStockReport?.items || deadStockReport.items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">
                        ممتاز! لا توجد أدوية راكدة متجاوزة {deadStockDays} يوماً
                      </td>
                    </tr>
                  ) : (
                    deadStockReport.items.map((it: any) => (
                      <tr key={it.inventoryItemId} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 font-bold text-slate-900">{it.tradeName}</td>
                        <td className="p-3 text-slate-500">{it.scientificName || '—'}</td>
                        <td className="p-3 text-center font-bold font-mono text-amber-800">
                          {it.totalUnitsRemaining} وحدة
                        </td>
                        <td className="p-3 font-mono">{Number(it.sellingPricePack).toLocaleString()} د.ع</td>
                        <td className="p-3 font-black text-rose-600 font-mono text-sm">
                          {Number(it.stagnantCapital).toLocaleString()} د.ع
                        </td>
                        <td className="p-3 font-mono text-slate-500">
                          {it.lastSoldAt ? (
                            new Date(it.lastSoldAt).toLocaleDateString('ar-IQ')
                          ) : (
                            <span className="text-rose-500 font-bold">لم يُباع قط</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
