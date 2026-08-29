import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  AlertTriangle,
  RefreshCw,
  Clock,
  User,
  TrendingDown,
} from 'lucide-react';
import { apiRequest } from '../api/client';

export const OwnerMobileDashboardView: React.FC = () => {
  const [dailySummary, setDailySummary] = useState<any | null>(null);
  const [netProfitData, setNetProfitData] = useState<any | null>(null);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [expiringCount, setExpiringCount] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    setRefreshing(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const [summary, profit, sales, lowStock, expiring] = await Promise.all([
        apiRequest<any>('/pos/daily-summary').catch(() => null),
        apiRequest<any>(`/reports/net-profit?from=${today}&to=${today}`).catch(() => null),
        apiRequest<any[]>('/pos/sales?limit=8').catch(() => []),
        apiRequest<any[]>('/inventory/low-stock').catch(() => []),
        apiRequest<any[]>('/inventory/expiring-soon').catch(() => []),
      ]);

      setDailySummary(summary);
      setNetProfitData(profit);
      setRecentSales(sales || []);
      setLowStockCount(lowStock?.length || 0);
      setExpiringCount(expiring?.length || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 30000); // Live poll every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-12 text-slate-900 font-sans">
      {/* Top Mobile Bar */}
      <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-xl flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
            <span className="text-xs font-bold text-slate-300">لوحة المتابعة اللحظية للمالك</span>
          </div>
          <h1 className="text-lg font-black mt-1">مبيعات وأرباح اليوم 📊</h1>
          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
            {new Date().toLocaleDateString('ar-IQ', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
        </div>

        <button
          onClick={fetchDashboardData}
          disabled={refreshing}
          className="p-3 bg-slate-800 hover:bg-slate-700 active:scale-95 text-emerald-400 rounded-2xl transition-all cursor-pointer shadow-md"
          title="تحديث البيانات الآن"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Main KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total Cash in Drawer */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-4 rounded-3xl shadow-md space-y-1">
          <div className="text-[11px] font-bold text-emerald-100 flex items-center justify-between">
            <span>نقد الدرج الفعلي (كاش)</span>
            <DollarSign className="w-4 h-4 text-emerald-200" />
          </div>
          <div className="text-xl font-black font-mono">
            {Number(dailySummary?.netCashInDrawer || 0).toLocaleString()}{' '}
            <span className="text-xs font-sans">د.ع</span>
          </div>
          <div className="text-[10px] text-emerald-100">بعد خصم الإرجاعات والخصومات</div>
        </div>

        {/* Estimated Net Profit */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white p-4 rounded-3xl shadow-md space-y-1">
          <div className="text-[11px] font-bold text-blue-100 flex items-center justify-between">
            <span>صافي ربح اليوم المقدر</span>
            <TrendingUp className="w-4 h-4 text-blue-200" />
          </div>
          <div className="text-xl font-black font-mono">
            {Number(netProfitData?.netProfit || 0).toLocaleString()}{' '}
            <span className="text-xs font-sans">د.ع</span>
          </div>
          <div className="text-[10px] text-blue-100">
            هامش ربح: {netProfitData?.netProfitMarginPercent || 0}%
          </div>
        </div>

        {/* Sales Invoices count & revenue */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-xs font-bold text-slate-500 flex items-center justify-between">
            <span>عدد فواتير البيع</span>
            <ShoppingCart className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-lg font-black text-slate-900 font-mono">
            {dailySummary?.totalInvoices || 0} <span className="text-xs font-sans text-slate-500">فاتورة</span>
          </div>
          <div className="text-[10px] text-slate-400">
            المبيعات الإجمالية: {Number(dailySummary?.totalSalesRevenue || 0).toLocaleString()} د.ع
          </div>
        </div>

        {/* Today's Expenses */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs space-y-1">
          <div className="text-xs font-bold text-slate-500 flex items-center justify-between">
            <span>مصاريف اليوم</span>
            <TrendingDown className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-lg font-black text-rose-600 font-mono">
            {Number(netProfitData?.expenses?.total || 0).toLocaleString()}{' '}
            <span className="text-xs font-sans">د.ع</span>
          </div>
          <div className="text-[10px] text-slate-400">رواتب ونثريات اليوم</div>
        </div>
      </div>

      {/* Stock Alerts Notice Bar */}
      {(lowStockCount > 0 || expiringCount > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-center justify-between text-xs font-bold text-amber-900 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              يوجد <span className="font-black underline">{lowStockCount}</span> أدوية نافدة، و{' '}
              <span className="font-black underline">{expiringCount}</span> تنتهي قريباً.
            </span>
          </div>
        </div>
      )}

      {/* Recent Live Sales Stream */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>آخر حركات البيع اللحظية (Live)</span>
          </div>
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            تحديث فوري
          </span>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {recentSales.length === 0 ? (
            <div className="text-center py-6 text-slate-400">لا توجد مبيعات مسجلة اليوم حتى الآن</div>
          ) : (
            recentSales.map((sale) => (
              <div key={sale.id} className="py-2.5 flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-800">{sale.invoiceNumber}</span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {sale.cashierName || 'الكاشير'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {new Date(sale.createdAt).toLocaleTimeString('ar-IQ', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>

                <div className="text-left font-black text-emerald-700 font-mono text-sm">
                  {Number(sale.totalAmount).toLocaleString()} د.ع
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
