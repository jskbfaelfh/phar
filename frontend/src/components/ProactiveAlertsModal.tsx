import React from 'react';
import {
  AlertTriangle,
  Clock,
  Package,
  X,
  ArrowRight,
} from 'lucide-react';

interface ProactiveAlertsModalProps {
  expiringItems: any[];
  lowStockItems: any[];
  onClose: () => void;
  onNavigateToInventory: () => void;
}

export const ProactiveAlertsModal: React.FC<ProactiveAlertsModalProps> = ({
  expiringItems,
  lowStockItems,
  onClose,
  onNavigateToInventory,
}) => {
  const totalAlerts = expiringItems.length + lowStockItems.length;

  if (totalAlerts === 0) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                تنبيهات استباقية مهمة
                <span className="px-2 py-0.5 bg-amber-500 text-white rounded-full text-xs font-mono">
                  {totalAlerts}
                </span>
              </h3>
              <p className="text-xs text-slate-500">نواقص وأدوية تقترب من انتهاء الصلاحية تستوجب انتباهك</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alerts Content List */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Expiring Soon Section */}
          {expiringItems.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-black text-rose-700 flex items-center gap-1.5 px-1">
                <Clock className="w-4 h-4 text-rose-600" />
                أدوية تنتهي صلاحيتها قريباً ({expiringItems.length}):
              </div>
              <div className="divide-y divide-rose-100 bg-rose-50/60 rounded-2xl border border-rose-200 overflow-hidden text-xs">
                {expiringItems.slice(0, 5).map((it, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-slate-900">{it.tradeName}</span>
                      <div className="text-[11px] text-slate-500">
                        {it.batchNumber ? `وجبة: ${it.batchNumber} • ` : ''}المتبقي: {it.availablePacks || it.quantityUnitsRemaining} علبة
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-lg font-bold font-mono text-[11px]">
                        ينتهي: {new Date(it.expiryDate).toLocaleDateString('ar-IQ')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Low Stock Section */}
          {lowStockItems.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-black text-amber-800 flex items-center gap-1.5 px-1">
                <Package className="w-4 h-4 text-amber-600" />
                أدوية نفدت أو وصلت للحد الأدنى ({lowStockItems.length}):
              </div>
              <div className="divide-y divide-amber-100 bg-amber-50/60 rounded-2xl border border-amber-200 overflow-hidden text-xs">
                {lowStockItems.slice(0, 5).map((it, idx) => (
                  <div key={idx} className="p-3 flex items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-slate-900">{it.tradeName}</span>
                      <div className="text-[11px] text-slate-500">
                        {it.scientificName ? `${it.scientificName} • ` : ''}حد التنبيه: {it.minAlertUnits || 5} علب
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      <span className="px-2.5 py-1 bg-amber-100 text-amber-900 rounded-lg font-black font-mono text-[11px]">
                        {Number(it.totalUnitsRemaining || 0) <= 0 ? 'نافد تماماً' : `متبقي: ${it.availablePacks || 0} علبة`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
          >
            تخطي ومتابعة العمل
          </button>
          <button
            onClick={() => {
              onClose();
              onNavigateToInventory();
            }}
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>الانتقال لإدارة المخزون</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
