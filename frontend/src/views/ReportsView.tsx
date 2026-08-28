import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
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
} from 'lucide-react';
import { apiRequest } from '../api/client';

export const ReportsView: React.FC = () => {
  const today = new Date().toISOString().slice(0, 10);
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  // Active Tab: 'inventory' | 'sold' | 'debts' | 'financial'
  const [activeTab, setActiveTab] = useState<'inventory' | 'sold' | 'debts' | 'financial'>('inventory');

  // Date Range States
  const [periodPreset, setPeriodPreset] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [from, setFrom] = useState(firstDayOfMonth);
  const [to, setTo] = useState(today);

  // Search filter inside tables
  const [tableSearch, setTableSearch] = useState('');

  // Loading States
  const [loading, setLoading] = useState(false);

  // Data States
  const [financialData, setFinancialData] = useState<any | null>(null);
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
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [activeTab, from, to]);

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
            كشف الأرباح
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
    </div>
  );
};
