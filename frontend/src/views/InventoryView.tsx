import React, { useState, useEffect } from 'react';
import {
  Package,
  AlertTriangle,
  Clock,
  Search,
  Edit,
  Eye,
  RefreshCw,
  X,
  CheckCircle2,
  Filter,
  Layers,
  Tag,
  ShieldAlert,
  Building2,
  Ban,
  FileText,
  Globe,
  Barcode,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { calculateStripPrice } from '../utils/currency';
import { usePharmacyLiveSync } from '../hooks/usePharmacyLiveSync';
import { BarcodeGeneratorModal } from '../components/BarcodeGeneratorModal';
import {
  getLocalInventory,
  saveLocalInventoryBulk,
  getLocalSuppliers,
  saveLocalSuppliers,
} from '../utils/localDatabase';

export const InventoryView: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'LOW_STOCK' | 'EXPIRING_SOON'>('ALL');

  // Exact real-time counts from local DB / backend summary
  const [totalCount, setTotalCount] = useState<number>(0);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [expiringCount, setExpiringCount] = useState<number>(0);

  // Suppliers filter
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');

  // Batch Recall & Traceability Modal State
  const [showRecallModal, setShowRecallModal] = useState(false);
  const [traceBatchNumber, setTraceBatchNumber] = useState('');
  const [traceLoading, setTraceLoading] = useState(false);
  const [traceResult, setTraceResult] = useState<any | null>(null);
  const [recallActionLoading, setRecallActionLoading] = useState(false);

  // Edit price & unit settings modal state
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    customName: '',
    sellingPricePack: 0,
    sellingPriceUnit: 0,
    minAlertUnits: 5,
  });

  // Batches details modal state
  const [batchesItem, setBatchesItem] = useState<any | null>(null);
  const [batchesList, setBatchesList] = useState<any[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  // Barcode generator modal state
  const [barcodeItem, setBarcodeItem] = useState<any | null>(null);

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch summary counts (Local-first calculation)
  const fetchSummaryCounts = async () => {
    // 1. Calculate from local DB first (0ms)
    try {
      const local = await getLocalInventory();
      setTotalCount(local.summary.total);
      setLowStockCount(local.summary.lowStock);
      setExpiringCount(local.summary.expiring);
    } catch (e) {
      console.warn('Local summary calculation error:', e);
    }

    // 2. Refresh from server in background if online
    if (navigator.onLine) {
      try {
        const summary = await apiRequest<any>('/inventory/summary');
        if (summary) {
          setTotalCount(Number(summary.totalMedicines || 0));
          setLowStockCount(Number(summary.lowStockCount || 0));
          setExpiringCount(Number(summary.expiringSoonCount || 0));
        }
      } catch (err) {
        // Silently keep local summary active
      }
    }
  };

  const fetchSuppliers = async () => {
    try {
      const localSuppliers = await getLocalSuppliers();
      if (localSuppliers.length > 0) {
        setSuppliers(localSuppliers);
      }
    } catch (e) {}

    if (navigator.onLine) {
      try {
        const data = await apiRequest<any[]>('/inventory/suppliers');
        if (Array.isArray(data)) {
          setSuppliers(data);
          saveLocalSuppliers(data);
        }
      } catch (err) {}
    }
  };

  const fetchInventory = async () => {
    // 1. Instant local read from machine's database
    try {
      const local = await getLocalInventory({
        search: searchTerm,
        filter: activeFilter,
        supplierId: selectedSupplierId,
      });
      setItems(local.items);
      setTotalCount(local.summary.total);
      setLowStockCount(local.summary.lowStock);
      setExpiringCount(local.summary.expiring);
      if (local.items.length > 0) {
        setLoading(false);
      }
    } catch (e) {
      console.warn('Local inventory read error:', e);
    }

    // 2. Background sync from server if online
    if (navigator.onLine) {
      try {
        if (activeFilter === 'LOW_STOCK') {
          const data = await apiRequest<any[]>('/inventory/low-stock');
          if (Array.isArray(data)) setItems(data);
        } else if (activeFilter === 'EXPIRING_SOON') {
          const data = await apiRequest<any[]>('/inventory/expiring-soon?months=3');
          if (Array.isArray(data)) setItems(data);
        } else {
          let url = `/inventory?search=${encodeURIComponent(searchTerm)}`;
          if (selectedSupplierId) {
            url += `&supplierId=${encodeURIComponent(selectedSupplierId)}`;
          }
          const data = await apiRequest<any[]>(url);
          if (Array.isArray(data)) {
            setItems(data);
            if (!searchTerm && !selectedSupplierId) {
              setTotalCount(data.length);
              saveLocalInventoryBulk(data);
            }
          }
        }
      } catch (err) {
        // Background sync failed, local data remains smoothly displayed
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummaryCounts();
    fetchSuppliers();
  }, []);

  // Connect Cloud WebSockets Live Sync
  usePharmacyLiveSync((eventType) => {
    if (eventType === 'STOCK_UPDATED' || eventType === 'STOCK_ENTERED' || eventType === 'SALE_COMPLETED') {
      fetchInventory();
      fetchSummaryCounts();
    }
  });

  useEffect(() => {
    fetchInventory();
  }, [activeFilter, searchTerm, selectedSupplierId]);

  const handleTraceBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!traceBatchNumber.trim()) return;

    setTraceLoading(true);
    try {
      const res = await apiRequest<any>(`/inventory/batches/trace/${encodeURIComponent(traceBatchNumber.trim())}`);
      setTraceResult(res);
    } catch (err: any) {
      alert(err.message || 'فشل تتبع التشغيلة');
    } finally {
      setTraceLoading(false);
    }
  };

  const handleToggleRecall = async (batchNumber: string, currentStatus: boolean) => {
    setRecallActionLoading(true);
    try {
      const res = await apiRequest<any>('/inventory/batches/recall', {
        method: 'POST',
        body: JSON.stringify({
          batchNumber,
          isRecalled: !currentStatus,
        }),
      });

      setMessage({ type: 'success', text: res.message });
      const updatedTrace = await apiRequest<any>(`/inventory/batches/trace/${encodeURIComponent(batchNumber)}`);
      setTraceResult(updatedTrace);
      fetchInventory();
    } catch (err: any) {
      alert(err.message || 'فشل تحديث حالة سحب التشغيلة');
    } finally {
      setRecallActionLoading(false);
    }
  };

  const toggleItemVisibility = async (item: any) => {
    try {
      const res = await apiRequest<any>(`/inventory/${item.id}/visibility`, {
        method: 'PATCH',
      });
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, isPublicVisible: res.isPublicVisible } : it)),
      );
      setMessage({ type: 'success', text: res.message });
    } catch (err: any) {
      alert(err.message || 'فشل تعديل حالة ظهور الدواء');
    }
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    setEditForm({
      customName: item.customName || '',
      sellingPricePack: Number(item.sellingPricePack || 0),
      sellingPriceUnit: Number(item.sellingPriceUnit || 0),
      minAlertUnits: Number(item.minAlertUnits || 5),
    });
  };

  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      await apiRequest(`/inventory/${editingItem.id}/price`, {
        method: 'PATCH',
        body: JSON.stringify({
          customName: editForm.customName || undefined,
          sellingPricePack: Number(editForm.sellingPricePack),
          sellingPriceUnit: Number(editForm.sellingPriceUnit),
          minAlertUnits: Number(editForm.minAlertUnits),
        }),
      });

      setMessage({ type: 'success', text: `تم تحديث سعر وبيانات (${editingItem.tradeName}) بنجاح` });
      setEditingItem(null);
      fetchInventory();
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      alert(err.message || 'فشل تحديث السعر');
    }
  };

  const viewBatches = async (item: any) => {
    setBatchesItem(item);
    setLoadingBatches(true);
    try {
      const data = await apiRequest<any[]>(`/inventory/${item.id}/batches`);
      setBatchesList(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBatches(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-16">
      {/* Top Header & Fast Overview Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Card 1: Total Medicines */}
        <button
          onClick={() => setActiveFilter('ALL')}
          className={`p-4 rounded-2xl border text-right transition-all cursor-pointer ${
            activeFilter === 'ALL'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-400 ring-offset-2'
              : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="font-bold text-xs opacity-90">إجمالي المواد</div>
            <Package className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-xl font-black mt-1.5">
            {totalCount} <span className="text-xs font-normal">مادة</span>
          </div>
          <div className="mt-1 text-[11px] opacity-75">
            {activeFilter === 'ALL' ? '● جميع المواد' : 'عرض الكل'}
          </div>
        </button>

        {/* Card 2: Low Stock Alerts */}
        <button
          onClick={() => setActiveFilter('LOW_STOCK')}
          className={`p-4 rounded-2xl border text-right transition-all cursor-pointer ${
            activeFilter === 'LOW_STOCK'
              ? 'bg-amber-500 text-white border-amber-500 shadow-md ring-2 ring-amber-400 ring-offset-2'
              : 'bg-amber-50 text-amber-950 border-amber-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="font-bold text-xs">النواقص</div>
            <AlertTriangle className="w-5 h-5 text-amber-700" />
          </div>
          <div className="text-xl font-black mt-1.5 text-amber-950">
            {lowStockCount} <span className="text-xs font-normal">مادة</span>
          </div>
          <div className="mt-1 text-[11px] text-amber-800">
            {activeFilter === 'LOW_STOCK' ? (
              <span className="text-amber-900 font-bold bg-amber-200/70 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                <Filter className="w-3 h-3" />
                النواقص فقط
              </span>
            ) : (
              'فلترة النواقص'
            )}
          </div>
        </button>

        {/* Card 3: Expiring Soon (3 Months) */}
        <button
          onClick={() => setActiveFilter('EXPIRING_SOON')}
          className={`p-4 rounded-2xl border text-right transition-all cursor-pointer ${
            activeFilter === 'EXPIRING_SOON'
              ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-400 ring-offset-2'
              : 'bg-rose-50 text-rose-950 border-rose-200 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="font-bold text-xs">قريبة الانتهاء</div>
            <Clock className="w-5 h-5 text-rose-700" />
          </div>
          <div className="text-xl font-black mt-1.5 text-rose-950">
            {expiringCount} <span className="text-xs font-normal">وجبة</span>
          </div>
          <div className="mt-1 text-[11px] text-rose-800">
            {activeFilter === 'EXPIRING_SOON' ? (
              <span className="text-rose-900 font-bold bg-rose-200/70 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                <Filter className="w-3 h-3" />
                المنتهية قريباً
              </span>
            ) : (
              'فلترة الصلاحية'
            )}
          </div>
        </button>
      </div>

      {message && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {message.text}
        </div>
      )}

      {/* Main Inventory Table Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث في المخزون (الاسم التجاري، العلمي، الباركود)..."
              className="w-full pr-9 pl-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Supplier Filter */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 px-2 py-1 rounded-xl">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-hidden cursor-pointer"
              >
                <option value="">جميع المذاخر والمصادر</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Trace & Recall Button */}
            <button
              onClick={() => {
                setShowRecallModal(true);
                setTraceResult(null);
                setTraceBatchNumber('');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              سحب وتتبع التشغيلات
            </button>

            {activeFilter !== 'ALL' && (
              <button
                onClick={() => setActiveFilter('ALL')}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                عرض الكل
              </button>
            )}

            <button
              onClick={() => {
                fetchInventory();
                fetchSummaryCounts();
              }}
              className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              title="تحديث"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100/75 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="p-2.5">الدواء</th>
                <th className="p-2.5">الاسم العلمي</th>
                <th className="p-2.5">الأشرطة/علبة</th>
                <th className="p-2.5">الكمية المتوفرة</th>
                <th className="p-2.5">بيع العلبة</th>
                <th className="p-2.5">بيع الشريط</th>
                <th className="p-2.5">حد التنبيه</th>
                <th className="p-2.5 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-400 font-bold">
                    جاري تحميل بيانات المخزون...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-400 font-bold">
                    {activeFilter === 'LOW_STOCK'
                      ? '🎉 لا توجد نواقص حالياً! جميع الأدوية رصيدها أعلى من حد التنبيه.'
                      : activeFilter === 'EXPIRING_SOON'
                      ? '🎉 لا توجد وجبات قريبة من الانتهاء خلال الأشهر الثلاثة القادمة.'
                      : 'لا توجد أدوية تطابق البحث في المخزون.'}
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const unitsPerPack = Number(item.unitsPerPack || 1);
                  const isUnitOnly = unitsPerPack === 1;

                  return (
                    <tr key={item.id || item.batchId} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & Form & Custom Name */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">{item.tradeName}</span>
                          {item.customName && (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-md text-[10px] font-black flex items-center gap-1">
                              <Tag className="w-2.5 h-2.5 text-amber-700" />
                              {item.customName}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          {item.dosageForm || '—'} {item.strength || ''} {item.manufacturer ? `• ${item.manufacturer}` : ''}
                        </div>
                      </td>

                      {/* Scientific Name */}
                      <td className="p-3 text-slate-600 font-medium">
                        {item.scientificName}
                      </td>

                      {/* Units Per Pack (Pack Structure) */}
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md font-bold text-xs">
                          <Layers className="w-3 h-3 text-slate-500" />
                          {isUnitOnly ? 'علبة / قطعة واحدة' : `${unitsPerPack} أشرطة بالعلبة`}
                        </span>
                      </td>

                      {/* Stock Quantity Available */}
                      <td className="p-3">
                        {activeFilter === 'EXPIRING_SOON' ? (
                          <div>
                            <span className="font-black text-rose-700 text-sm">
                              {item.quantityUnitsRemaining} {isUnitOnly ? 'علبة' : 'شريط'} متبقي
                            </span>
                            <div className="text-[10px] text-slate-500 font-mono font-bold">انتهاء: {item.expiryFormatted}</div>
                          </div>
                        ) : (
                          <div>
                            <span className="font-black text-slate-900 text-sm">
                              {item.availablePacks} علبة {isUnitOnly ? '' : `و ${item.availableStrips} شريط`}
                            </span>
                            <div className="text-[10px] text-slate-500 font-medium">
                              ({item.totalUnitsRemaining} {isUnitOnly ? 'علبة إجمالي' : 'شريط إجمالي بالمخزن'})
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Selling Price Pack */}
                      <td className="p-3 font-bold text-emerald-800 text-sm">
                        {Number(item.sellingPricePack || 0).toLocaleString()} د.ع
                      </td>

                      {/* Selling Price Unit (Strip/Piece) */}
                      <td className="p-3 font-bold text-blue-800 text-sm">
                        {Number(item.sellingPriceUnit || 0).toLocaleString()} د.ع
                      </td>

                      {/* Min Alert Threshold */}
                      <td className="p-3 text-slate-600 font-medium">
                        {item.minAlertUnits || 5} {isUnitOnly ? 'علب' : 'أشرطة'}
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => toggleItemVisibility(item)}
                            className={`px-2 py-1 rounded-md font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors ${
                              item.isPublicVisible !== false
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-300'
                            }`}
                            title={
                              item.isPublicVisible !== false
                                ? 'الدواء ظاهر بالبحث الشبكي - انقر للإخفاء'
                                : 'الدواء مخفي عن البحث الشبكي - انقر للإظهار'
                            }
                          >
                            <Globe className="w-3.5 h-3.5" />
                            <span>{item.isPublicVisible !== false ? 'ظاهر 🌐' : 'مخفي 🔒'}</span>
                          </button>
                          <button
                            onClick={() => viewBatches(item)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                            title="عرض تفاصيل الوجبات وتواريخ الانتهاء"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            الوجبات
                          </button>
                          <button
                            onClick={() => setBarcodeItem(item)}
                            className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-md font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                            title="توليد وطباعة ملصق الباركود الحراري"
                          >
                            <Barcode className="w-3.5 h-3.5 text-purple-600" />
                            باركود
                          </button>
                          <button
                            onClick={() => openEditModal(item)}
                            className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                            title="تعديل سعر البيع والاسم المخصص وحد التنبيه"
                          >
                            <Edit className="w-3.5 h-3.5 text-indigo-600" />
                            تعديل
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Price & Custom Name Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">تعديل بيانات وسعر الدواء</h3>
              <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-3 text-xs text-slate-500">
              <div className="font-bold text-slate-900 text-sm">{editingItem.tradeName}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">الأشرطة: {editingItem.unitsPerPack}</div>
            </div>

            <form onSubmit={handleUpdatePrice} className="space-y-3">
              {/* Custom Name / Alias */}
              <div>
                <label className="block text-xs font-bold text-amber-900 mb-1 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-amber-600" />
                  الاسم الدارج (اختياري)
                </label>
                <input
                  type="text"
                  value={editForm.customName}
                  onChange={(e) => setEditForm({ ...editForm, customName: e.target.value })}
                  placeholder="مثال: بنادول أحمر"
                  className="w-full px-3 py-2 bg-amber-50/50 border border-amber-300 rounded-lg text-xs font-bold text-amber-950"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">سعر العلبة (د.ع)</label>
                <input
                  type="number"
                  min="250"
                  step="250"
                  required
                  value={editForm.sellingPricePack}
                  onChange={(e) => {
                    const packPrice = Number(e.target.value);
                    const units = Number(editingItem.unitsPerPack || 1);
                    setEditForm({
                      ...editForm,
                      sellingPricePack: packPrice,
                      sellingPriceUnit: calculateStripPrice(packPrice, units),
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-emerald-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">سعر الشريط (د.ع)</label>
                <input
                  type="number"
                  min="250"
                  step="250"
                  required
                  value={editForm.sellingPriceUnit}
                  onChange={(e) => setEditForm({ ...editForm, sellingPriceUnit: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-blue-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">حد التنبيه</label>
                <input
                  type="number"
                  min="1"
                  value={editForm.minAlertUnits}
                  onChange={(e) => setEditForm({ ...editForm, minAlertUnits: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  حفظ
                </button>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batches View Modal */}
      {batchesItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-600" />
                  تفاصيل وجبات الدواء والصلاحية
                </h3>
                <p className="text-xs text-slate-500 font-bold">{batchesItem.tradeName}</p>
              </div>
              <button onClick={() => setBatchesItem(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 divide-y divide-slate-100">
              {loadingBatches ? (
                <p className="text-center py-6 text-slate-400 text-xs font-bold">جاري تحميل الوجبات...</p>
              ) : batchesList.length === 0 ? (
                <p className="text-center py-6 text-slate-400 text-xs font-bold">لا توجد وجبات نشطة مسجلة</p>
              ) : (
                batchesList.map((batch) => (
                  <div key={batch.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-800">
                          الصلاحية: <span className="text-indigo-700 font-mono font-black">{batch.expiryFormatted}</span>
                        </span>
                        {batch.isRecalled && (
                          <span className="px-1.5 py-0.2 bg-rose-100 text-rose-700 rounded text-[9px] font-black border border-rose-200 flex items-center gap-0.5">
                            <Ban className="w-2.5 h-2.5" />
                            مسحوبة (ممنوع البيع)
                          </span>
                        )}
                      </div>
                      <div className="text-slate-500 mt-0.5">
                        تشغيلة: <span className="font-mono font-bold text-slate-700">{batch.batchNumber || '—'}</span> • شراء: {Number(batch.purchasePricePack).toLocaleString()} د.ع
                        {batch.sellingPricePack ? ` • بيع: ${Number(batch.sellingPricePack).toLocaleString()} د.ع` : ''}
                      </div>
                      {batch.supplierName && (
                        <div className="text-[10px] text-indigo-600 font-bold mt-0.5 flex items-center gap-1">
                          <Building2 className="w-2.5 h-2.5" />
                          المورد: {batch.supplierName}
                        </div>
                      )}
                    </div>
                    <div className="text-left font-black text-slate-900">
                      {batch.quantityUnitsRemaining} {Number(batchesItem.unitsPerPack || 1) === 1 ? 'علبة' : 'شريط'}
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => setBatchesItem(null)}
              className="w-full mt-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              إلغاء / إغلاق
            </button>
          </div>
        </div>
      )}

      {/* Modal: Batch Recall & Traceability Modal */}
      {showRecallModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-5 max-w-2xl w-full shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">تتبع وسحب التشغيلات (Batch Recall)</h3>
                  <p className="text-[11px] text-slate-500 font-medium">البحث عن مسار أي تشغيلة، فواتير زبائنها، وقفل بيعها</p>
                </div>
              </div>
              <button onClick={() => setShowRecallModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input Bar */}
            <form onSubmit={handleTraceBatch} className="flex gap-2 my-3">
              <input
                type="text"
                required
                value={traceBatchNumber}
                onChange={(e) => setTraceBatchNumber(e.target.value)}
                placeholder="أدخل رقم التشغيلة (Batch Number) مثلاً: BND24001..."
                className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
              <button
                type="submit"
                disabled={traceLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:bg-slate-300"
              >
                {traceLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                تتبع التشغيلة
              </button>
            </form>

            {/* Modal Body / Results */}
            <div className="flex-1 overflow-y-auto min-h-0 space-y-3 pr-1">
              {traceResult && !traceResult.found && (
                <div className="p-8 text-center text-slate-400 text-xs font-bold bg-slate-50 rounded-xl">
                  {traceResult.message}
                </div>
              )}

              {traceResult && traceResult.found && (
                <>
                  {/* Batch Info Cards */}
                  {traceResult.batches?.map((b: any) => (
                    <div key={b.batchId} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-black text-sm text-slate-900">{b.tradeName}</span>
                          <span className="text-slate-500 text-[11px] mr-1.5">({b.scientificName} - {b.dosageForm} {b.strength})</span>
                        </div>

                        {/* Status Badge & Action */}
                        <div className="flex items-center gap-2">
                          {b.isRecalled ? (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-700 border border-rose-200 rounded-md font-black text-[10px] flex items-center gap-1">
                              <Ban className="w-3 h-3" />
                              مسحوبة من التداول (محظورة)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md font-black text-[10px] flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              صالحة للتداول
                            </span>
                          )}

                          <button
                            type="button"
                            disabled={recallActionLoading}
                            onClick={() => handleToggleRecall(b.batchNumber, b.isRecalled)}
                            className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                              b.isRecalled
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                                : 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                            }`}
                          >
                            {b.isRecalled ? 'إلغاء السحب (إتاحة البيع)' : 'سحب التشغيلة (قفل البيع)'}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-200 text-[11px]">
                        <div>
                          <span className="text-slate-400 block">رقم التشغيلة:</span>
                          <span className="font-mono font-bold text-slate-800">{b.batchNumber}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">المورد / المذخر:</span>
                          <span className="font-bold text-indigo-700">{b.supplierName || 'غير مسجل'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">تاريخ الانتهاء:</span>
                          <span className="font-mono font-bold text-slate-800">{new Date(b.expiryDate).toLocaleDateString('ar-IQ')}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">الرصيد المتبقي:</span>
                          <span className="font-black text-rose-700">{b.quantityUnitsRemaining} وحدة</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Historical Sales Table */}
                  <div className="mt-4">
                    <h4 className="font-black text-xs text-slate-800 mb-2 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-slate-600" />
                      فواتير المبيعات الصادرة من هذه التشغيلة ({traceResult.salesHistory?.length || 0})
                    </h4>

                    {traceResult.salesHistory?.length === 0 ? (
                      <p className="p-4 text-center text-slate-400 text-xs font-bold bg-slate-50 rounded-xl">
                        لم يتم بيع أي حبة من هذه التشغيلة بعد.
                      </p>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                            <tr>
                              <th className="p-2">رقم الفاتورة</th>
                              <th className="p-2">تاريخ البيع</th>
                              <th className="p-2">الكاشير</th>
                              <th className="p-2">الكمية المباعة</th>
                              <th className="p-2">الإجمالي</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {traceResult.salesHistory?.map((sale: any) => (
                              <tr key={sale.saleItemId} className="hover:bg-slate-50">
                                <td className="p-2 font-mono font-bold text-indigo-700">{sale.invoiceNumber}</td>
                                <td className="p-2 text-slate-600">{new Date(sale.soldAt).toLocaleString('ar-IQ')}</td>
                                <td className="p-2 text-slate-800 font-medium">{sale.cashierName || 'الكاشير'}</td>
                                <td className="p-2 font-bold text-slate-900">
                                  {sale.quantitySold} {sale.unitType === 'PACK' ? 'علبة' : 'شريط'}
                                </td>
                                <td className="p-2 font-mono font-bold text-slate-900">{Number(sale.totalPrice).toLocaleString()} د.ع</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowRecallModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Label Generator Modal */}
      {barcodeItem && (
        <BarcodeGeneratorModal
          item={barcodeItem}
          onClose={() => setBarcodeItem(null)}
        />
      )}
    </div>
  );
};
