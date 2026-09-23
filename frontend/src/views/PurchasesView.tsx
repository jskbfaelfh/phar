import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Package,
  Eye,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Printer,
  Sparkles,
  Camera,
  Zap,
  Edit,
  Lock,
  Clock,
  Plus,
  Trash2,
  Save,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { SmartInvoiceScannerModal } from '../components/SmartInvoiceScannerModal';

interface PurchaseInvoiceItem {
  id?: string;
  medicineId: string;
  tradeName: string;
  scientificName?: string;
  barcode?: string;
  batchNumber?: string;
  expiryDate: string;
  quantityPacks: number;
  bonusPacks?: number;
  amortizeBonus?: boolean;
  unitsPerPack: number;
  purchasePricePack: number;
  discountPercent?: number;
  sellingPricePack: number;
  sellingPriceUnit?: number;
  shelfLocation?: string;
  totalCost?: number;
  initialUnits?: number;
  unitsRemaining?: number;
  soldUnits?: number;
  minAllowedPacks?: number;
  canDelete?: boolean;
}

interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplierId?: string;
  supplierName?: string;
  invoiceDate: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  notes?: string;
  itemsCount: number;
  createdAt: string;
  canEdit?: boolean;
  remainingHours?: number;
  remainingMinutes?: number;
  items?: PurchaseInvoiceItem[];
}

export const PurchasesView: React.FC = () => {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [showAiScanModal, setShowAiScanModal] = useState(false);
  const [modalSkipMatching, setModalSkipMatching] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [earlyDiscountAlerts, setEarlyDiscountAlerts] = useState<any[]>([]);
  const [applyingDiscountId, setApplyingDiscountId] = useState<string | null>(null);

  // 24-Hour Interactive Full Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    supplierName: string;
    invoiceNumber: string;
    invoiceDate: string;
    paidAmount: number;
    directDiscountAmount: number;
    notes: string;
    items: PurchaseInvoiceItem[];
  }>({
    supplierName: '',
    invoiceNumber: '',
    invoiceDate: '',
    paidAmount: 0,
    directDiscountAmount: 0,
    notes: '',
    items: [],
  });

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<PurchaseInvoice[]>(
        `/purchases${searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : ''}`,
      );
      setInvoices(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInitialData = async () => {
    try {
      const alerts = await apiRequest<any[]>('/purchases/early-discount-alerts').catch(() => []);
      setEarlyDiscountAlerts(alerts || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleApplyEarlyDiscount = async (invId: string) => {
    if (!confirm('هل تريد تطبيق خصم التسديد المبكر لهذه الفاتورة الآن وتخفيض الدين المستحق؟')) return;
    setApplyingDiscountId(invId);
    try {
      const res = await apiRequest<any>(`/purchases/${invId}/apply-early-discount`, {
        method: 'POST',
      });
      setMessage({ type: 'success', text: res.message || 'تم تطبيق خصم التسديد المبكر بنجاح!' });
      fetchInvoices();
      fetchInitialData();
    } catch (err: any) {
      alert(err.message || 'فشل تطبيق الخصم');
    } finally {
      setApplyingDiscountId(null);
    }
  };

  useEffect(() => {
    fetchInvoices();
    fetchInitialData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInvoices();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const openInvoiceDetails = async (invoice: PurchaseInvoice) => {
    setIsEditing(false);
    setEditError(null);
    try {
      const full = await apiRequest<PurchaseInvoice>(`/purchases/${invoice.id}`);
      setSelectedInvoice(full);
    } catch {
      setSelectedInvoice(invoice);
    }
  };

  const handleStartEdit = () => {
    if (!selectedInvoice) return;
    setEditError(null);
    setEditForm({
      supplierName: selectedInvoice.supplierName || '',
      invoiceNumber: selectedInvoice.invoiceNumber || '',
      invoiceDate: selectedInvoice.invoiceDate
        ? new Date(selectedInvoice.invoiceDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      paidAmount: Number(selectedInvoice.paidAmount) || 0,
      directDiscountAmount: 0,
      notes: selectedInvoice.notes || '',
      items: (selectedInvoice.items || []).map((it) => ({
        ...it,
        tradeName: it.tradeName || '',
        batchNumber: it.batchNumber || '',
        quantityPacks: Number(it.quantityPacks) || 1,
        bonusPacks: Number(it.bonusPacks) || 0,
        unitsPerPack: Number(it.unitsPerPack) || 1,
        purchasePricePack: Number(it.purchasePricePack) || 0,
        discountPercent: Number(it.discountPercent) || 0,
        sellingPricePack: Number(it.sellingPricePack) || 0,
        sellingPriceUnit: Number(it.sellingPriceUnit) || 0,
        shelfLocation: it.shelfLocation || '',
        soldUnits: Number(it.soldUnits) || 0,
        minAllowedPacks: Number(it.minAllowedPacks) || 1,
        canDelete: it.canDelete !== false,
        expiryDate: it.expiryDate
          ? new Date(it.expiryDate).toISOString().split('T')[0]
          : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      })),
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditError(null);
  };

  const handleAddItem = () => {
    const newItem: PurchaseInvoiceItem = {
      medicineId: '',
      tradeName: '',
      batchNumber: '',
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      quantityPacks: 1,
      bonusPacks: 0,
      unitsPerPack: 1,
      purchasePricePack: 0,
      discountPercent: 0,
      sellingPricePack: 0,
      sellingPriceUnit: 0,
      shelfLocation: '',
      canDelete: true,
      soldUnits: 0,
      minAllowedPacks: 1,
    };
    setEditForm((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
  };

  const handleItemChange = (index: number, field: keyof PurchaseInvoiceItem, value: any) => {
    setEditForm((prev) => {
      const updated = [...prev.items];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, items: updated };
    });
  };

  const handleRemoveItem = (index: number) => {
    const item = editForm.items[index];
    if (item.soldUnits && item.soldUnits > 0) {
      alert(`لا يمكن حذف مادة (${item.tradeName}) لوجود مبيعات مسجلة منها في الكاشير (${item.soldUnits} وحدة).`);
      return;
    }
    setEditForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const calculateEditTotals = () => {
    let grossTotal = 0;
    for (const it of editForm.items) {
      const q = Number(it.quantityPacks) || 0;
      const p = Number(it.purchasePricePack) || 0;
      const d = Number(it.discountPercent) || 0;
      const net = q * p * (1 - d / 100);
      grossTotal += net;
    }
    const directDiscount = Number(editForm.directDiscountAmount) || 0;
    const netTotal = Math.max(0, grossTotal - directDiscount);
    const paid = Number(editForm.paidAmount) || 0;
    const remaining = Math.max(0, netTotal - paid);
    return { grossTotal, netTotal, paid, remaining };
  };

  const handleSaveEdit = async () => {
    if (!selectedInvoice) return;
    setEditError(null);

    if (editForm.items.length === 0) {
      setEditError('يجب أن تحتوي الفاتورة على دواء واحد على الأقل');
      return;
    }

    for (const it of editForm.items) {
      if (!it.tradeName.trim()) {
        setEditError('يرجى كتابة اسم الدواء لجميع المواد');
        return;
      }
      if (Number(it.quantityPacks) < (it.minAllowedPacks || 0)) {
        setEditError(
          `لا يمكن تقليل كمية (${it.tradeName}) إلى أقل من الكمية المباعة (${it.soldUnits} وحدة / ما يعادل ${it.minAllowedPacks} علبة)`
        );
        return;
      }
    }

    setIsSaving(true);
    try {
      const payload = {
        supplierName: editForm.supplierName.trim() || undefined,
        invoiceNumber: editForm.invoiceNumber.trim() || undefined,
        invoiceDate: editForm.invoiceDate ? new Date(editForm.invoiceDate).toISOString() : undefined,
        paidAmount: Number(editForm.paidAmount) || 0,
        directDiscountAmount: Number(editForm.directDiscountAmount) || 0,
        notes: editForm.notes || undefined,
        items: editForm.items.map((it) => ({
          id: it.id || undefined,
          medicineId: it.medicineId || undefined,
          tradeName: it.tradeName.trim(),
          scientificName: it.scientificName?.trim() || undefined,
          barcode: it.barcode?.trim() || undefined,
          batchNumber: it.batchNumber?.trim() || undefined,
          expiryDate: it.expiryDate || undefined,
          quantityPacks: Number(it.quantityPacks) || 0,
          bonusPacks: Number(it.bonusPacks) || 0,
          unitsPerPack: Number(it.unitsPerPack) || 1,
          purchasePricePack: Number(it.purchasePricePack) || 0,
          discountPercent: Number(it.discountPercent) || 0,
          sellingPricePack: Number(it.sellingPricePack) || 0,
          sellingPriceUnit: Number(it.sellingPriceUnit) || undefined,
          shelfLocation: it.shelfLocation?.trim() || undefined,
        })),
      };

      const res = await apiRequest<any>(`/purchases/${selectedInvoice.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      setMessage({ type: 'success', text: res.message || 'تم تحديث فاتورة الشراء والمخزون بنجاح' });
      setIsEditing(false);
      // Refresh current modal invoice details
      const refreshed = await apiRequest<PurchaseInvoice>(`/purchases/${selectedInvoice.id}`);
      setSelectedInvoice(refreshed);
      // Refresh invoices list
      fetchInvoices();
    } catch (err: any) {
      setEditError(err.message || 'فشل حفظ التعديلات');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-800">المشتريات</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setModalSkipMatching(false);
              setShowAiScanModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-900/20 active:scale-95 transition-all cursor-pointer"
            title="مسح ذكي للفاتورة مع مطابقة الكتالوج الدوائي"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <Camera className="w-4 h-4" />
            <span>🤖 مسح ذكي (مع مطابقة)</span>
          </button>

          <button
            onClick={() => {
              setModalSkipMatching(true);
              setShowAiScanModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-linear-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl text-xs font-black shadow-md shadow-orange-900/20 active:scale-95 transition-all cursor-pointer"
            title="مسح استخراجي مباشر - قراءة نص الورقة فقط بدون مطابقة الدليل"
          >
            <Zap className="w-4 h-4 text-yellow-200" />
            <span>⚡ مسح مباشر (بدون مطابقة)</span>
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between text-xs font-bold ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Early Settlement Discount Urgent Alerts */}
      {earlyDiscountAlerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl space-y-2">
          <div className="flex items-center gap-2 font-black text-amber-950 text-xs">
            <Sparkles className="w-4 h-4 text-amber-600 animate-bounce" />
            <span>تنبيهات السداد المبكر والتوفير (Early Payment Discounts):</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {earlyDiscountAlerts.map((alt) => (
              <div
                key={alt.id}
                className="bg-white p-3 rounded-xl border border-amber-200 shadow-2xs flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-slate-900">
                    فاتورة <span className="font-mono text-blue-700">{alt.invoiceNumber}</span> — {alt.supplierName}
                  </div>
                  <div className="text-[11px] text-amber-800 font-bold mt-0.5">
                    خصم {alt.earlyDiscountPercent}% (توفير {Number(alt.earlyDiscountAmount || 0).toLocaleString()} د.ع) • متبقي {alt.daysRemaining} أيام
                  </div>
                </div>
                <button
                  disabled={applyingDiscountId === alt.id}
                  onClick={() => handleApplyEarlyDiscount(alt.id)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-black cursor-pointer shadow-xs active:scale-95 transition-all"
                >
                  {applyingDiscountId === alt.id ? 'جاري التطبيق...' : '⚡ تطبيق الخصم وتخفيض الدين'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search and Summary Filters */}
      <div className="flex items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث برقم الفاتورة أو المذخر..."
            className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500"
          />
        </div>
        <div className="text-xs font-bold text-slate-500 shrink-0">
          الفواتير: <span className="text-slate-900 font-black">{invoices.length}</span>
        </div>
      </div>

      {/* Invoices List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="p-3.5">رقم الفاتورة</th>
                <th className="p-3.5">المذخر</th>
                <th className="p-3.5">التاريخ</th>
                <th className="p-3.5">المواد</th>
                <th className="p-3.5">المجموع</th>
                <th className="p-3.5">الواصل</th>
                <th className="p-3.5">الباقي</th>
                <th className="p-3.5">خصم الدفع</th>
                <th className="p-3.5 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    جاري التحميل...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">
                    <Package className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                    لا توجد فواتير
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-bold font-mono text-blue-700">
                      <div>{inv.invoiceNumber}</div>
                      {inv.canEdit ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 mt-1">
                          <Clock className="w-3 h-3 text-emerald-600" />
                          <span>تعديل متاح ({inv.remainingHours}س {inv.remainingMinutes}د)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200 mt-1">
                          <Lock className="w-3 h-3 text-slate-400" />
                          <span>مقفلة للتعديل</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 font-bold text-slate-900">{inv.supplierName || '—'}</td>
                    <td className="p-3.5 text-slate-500 font-mono">
                      {new Date(inv.invoiceDate).toLocaleDateString('ar-IQ')}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-bold text-[11px]">
                        {inv.itemsCount} مواد
                      </span>
                    </td>
                    <td className="p-3.5 font-black text-slate-900 font-mono">
                      {Number(inv.totalAmount).toLocaleString()} د.ع
                    </td>
                    <td className="p-3.5 text-emerald-700 font-bold font-mono">
                      {Number(inv.paidAmount).toLocaleString()} د.ع
                    </td>
                    <td className="p-3.5 font-bold font-mono">
                      {Number(inv.remainingAmount) > 0 ? (
                        <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md">
                          {Number(inv.remainingAmount).toLocaleString()} د.ع
                        </span>
                      ) : (
                        <span className="text-emerald-600">مسدد بالكامل</span>
                      )}
                    </td>
                    <td className="p-3.5 text-xs">
                      {(inv as any).earlyDiscountApplied ? (
                        <span className="px-2 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md font-bold text-[10px] inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          خصم {(inv as any).earlyDiscountPercent}% مُطبّق (وفر {Number((inv as any).earlyDiscountAppliedAmount || 0).toLocaleString()} د.ع)
                        </span>
                      ) : (inv as any).earlyDiscountDeadline && Number(inv.remainingAmount) > 0 ? (
                        <div className="space-y-1">
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-md font-bold text-[10px] block w-fit">
                            ⚡ خصم {(inv as any).earlyDiscountPercent}% متاح (توفير {Number((inv as any).earlyDiscountAmount || 0).toLocaleString()} د.ع)
                          </span>
                          <button
                            disabled={applyingDiscountId === inv.id}
                            onClick={() => handleApplyEarlyDiscount(inv.id)}
                            className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[10px] font-black cursor-pointer shadow-2xs active:scale-95 transition-all"
                          >
                            {applyingDiscountId === inv.id ? 'جاري التطبيق...' : '⚡ تطبيق الخصم الآن'}
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">—</span>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => openInvoiceDetails(inv)}
                        className={`px-3 py-1.5 ${
                          inv.canEdit
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        } rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer`}
                      >
                        {inv.canEdit ? <Edit className="w-3.5 h-3.5 text-emerald-600" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{inv.canEdit ? 'تفاصيل وتعديل' : 'تفاصيل'}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Details & Edit Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div
            className={`bg-white rounded-3xl p-6 ${
              isEditing ? 'max-w-6xl' : 'max-w-3xl'
            } w-full shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col space-y-4 transition-all`}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl ${
                    isEditing ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
                  } flex items-center justify-center font-black`}
                >
                  {isEditing ? <Edit className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                    <span>{isEditing ? 'تعديل فاتورة الشراء والمخزون' : 'تفاصيل فاتورة الشراء'}</span>
                    <span className="font-mono text-blue-600">({selectedInvoice.invoiceNumber})</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    المورد: {selectedInvoice.supplierName || 'غير محدد'} • التاريخ:{' '}
                    {new Date(selectedInvoice.invoiceDate).toLocaleDateString('ar-IQ')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedInvoice(null);
                  setIsEditing(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 24-Hour Eligibility Status Banner */}
            {selectedInvoice.canEdit ? (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl shrink-0">
                <div className="flex items-center gap-2 text-xs font-black text-emerald-900">
                  <Clock className="w-4 h-4 text-emerald-600 animate-pulse shrink-0" />
                  <span>ميزة التعديل الشامل مفعلة (أول 24 ساعة من تسجيل الفاتورة):</span>
                  <span className="bg-emerald-200/70 text-emerald-900 px-2.5 py-0.5 rounded-full text-[11px] font-mono">
                    متبقي {selectedInvoice.remainingHours || 0} ساعة و {selectedInvoice.remainingMinutes || 0} دقيقة
                  </span>
                </div>
                {!isEditing && (
                  <button
                    onClick={handleStartEdit}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>✏️ تعديل الفاتورة بالكامل</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-slate-100 border border-slate-200 rounded-2xl text-xs font-bold text-slate-600 shrink-0">
                <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  🔒 انقضت مهلة الـ 24 ساعة المسموحة لتعديل الفاتورة • الفاتورة للقراءة والطباعة فقط حفاظاً على دقة الحسابات والمخزون
                </span>
              </div>
            )}

            {/* Edit Error Alert if any */}
            {isEditing && editError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{editError}</span>
                </div>
                <button onClick={() => setEditError(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Modal Body: VIEW MODE vs EDIT MODE */}
            {!isEditing ? (
              <>
                {/* View Mode: Items Table */}
                <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold sticky top-0">
                      <tr>
                        <th className="p-3">اسم الدواء</th>
                        <th className="p-3">الوجبة</th>
                        <th className="p-3">الصلاحية</th>
                        <th className="p-3">الكمية (علب)</th>
                        <th className="p-3">سعر الشراء</th>
                        <th className="p-3">سعر البيع</th>
                        <th className="p-3">إجمالي التكلفة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      {selectedInvoice.items && selectedInvoice.items.length > 0 ? (
                        selectedInvoice.items.map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-900">
                              {it.tradeName}
                              {it.scientificName && (
                                <div className="text-[10px] text-slate-400">{it.scientificName}</div>
                              )}
                              {it.soldUnits !== undefined && it.soldUnits > 0 && (
                                <div className="text-[10px] text-amber-700 font-bold mt-0.5">
                                  ⚠️ بيع منه {it.soldUnits} وحدة بالكاشير
                                </div>
                              )}
                            </td>
                            <td className="p-3 font-mono text-slate-600">{it.batchNumber || '—'}</td>
                            <td className="p-3 font-mono text-slate-600">
                              {new Date(it.expiryDate).toLocaleDateString('ar-IQ')}
                            </td>
                            <td className="p-3 font-bold">{it.quantityPacks} علبة</td>
                            <td className="p-3 font-mono text-slate-700">
                              {Number(it.purchasePricePack).toLocaleString()} د.ع
                            </td>
                            <td className="p-3 font-mono text-emerald-700 font-bold">
                              {Number(it.sellingPricePack).toLocaleString()} د.ع
                            </td>
                            <td className="p-3 font-mono font-black text-slate-900">
                              {Number(it.totalCost || it.quantityPacks * it.purchasePricePack).toLocaleString()} د.ع
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="text-center py-6 text-slate-400">
                            لا توجد بنود مفصلة متاحة لهذه الفاتورة
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* View Mode Footer */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 shrink-0 text-xs">
                  <div>
                    <span className="text-slate-500">إجمالي الفاتورة: </span>
                    <span className="font-black text-slate-900 text-sm font-mono mr-1">
                      {Number(selectedInvoice.totalAmount).toLocaleString()} د.ع
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">المدفوع: </span>
                    <span className="font-bold text-emerald-700 font-mono mr-1">
                      {Number(selectedInvoice.paidAmount).toLocaleString()} د.ع
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">المتبقي: </span>
                    <span className="font-bold text-rose-600 font-mono mr-1">
                      {Number(selectedInvoice.remainingAmount).toLocaleString()} د.ع
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => window.print()}
                      className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>طباعة</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Edit Mode: Header Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 shrink-0 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">اسم المذخر / المورد</label>
                    <input
                      type="text"
                      value={editForm.supplierName}
                      onChange={(e) => setEditForm({ ...editForm, supplierName: e.target.value })}
                      placeholder="اسم المورد..."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">رقم الفاتورة</label>
                    <input
                      type="text"
                      value={editForm.invoiceNumber}
                      onChange={(e) => setEditForm({ ...editForm, invoiceNumber: e.target.value })}
                      placeholder="رقم الفاتورة..."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-slate-800 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">تاريخ الفاتورة</label>
                    <input
                      type="date"
                      value={editForm.invoiceDate}
                      onChange={(e) => setEditForm({ ...editForm, invoiceDate: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-800 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">المدفوع نقداً (الواصل)</label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.paidAmount}
                      onChange={(e) => setEditForm({ ...editForm, paidAmount: Number(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-emerald-700 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">خصم مباشر على الفاتورة (د.ع)</label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.directDiscountAmount}
                      onChange={(e) => setEditForm({ ...editForm, directDiscountAmount: Number(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-blue-700 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">ملاحظات الفاتورة</label>
                    <input
                      type="text"
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      placeholder="أي ملاحظات إضافية..."
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Edit Mode: Items Table */}
                <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl max-h-[420px]">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold sticky top-0 z-10">
                      <tr>
                        <th className="p-2.5">اسم الدواء</th>
                        <th className="p-2.5 w-24">الوجبة</th>
                        <th className="p-2.5 w-32">الصلاحية</th>
                        <th className="p-2.5 w-24">الكمية (علب)</th>
                        <th className="p-2.5 w-20">بونص</th>
                        <th className="p-2.5 w-28">سعر الشراء</th>
                        <th className="p-2.5 w-28">سعر البيع</th>
                        <th className="p-2.5 w-20">الوحدات</th>
                        <th className="p-2.5 w-24">الرف</th>
                        <th className="p-2.5 w-28">إجمالي التكلفة</th>
                        <th className="p-2.5 w-12 text-center">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      {editForm.items.map((it, idx) => {
                        const lineTotal =
                          (Number(it.quantityPacks) || 0) *
                          (Number(it.purchasePricePack) || 0) *
                          (1 - (Number(it.discountPercent) || 0) / 100);
                        const hasSales = Boolean(it.soldUnits && it.soldUnits > 0);

                        return (
                          <tr key={idx} className="hover:bg-slate-50/80">
                            <td className="p-2">
                              <input
                                type="text"
                                value={it.tradeName}
                                onChange={(e) => handleItemChange(idx, 'tradeName', e.target.value)}
                                placeholder="اسم الدواء..."
                                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-800 focus:outline-hidden focus:border-blue-500"
                              />
                              {hasSales && (
                                <div className="text-[10px] text-amber-700 font-bold mt-1">
                                  ⚠️ بيع {it.soldUnits} وحدة بالكاشير (حد أدنى: {it.minAllowedPacks} علبة)
                                </div>
                              )}
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={it.batchNumber || ''}
                                onChange={(e) => handleItemChange(idx, 'batchNumber', e.target.value)}
                                placeholder="الوجبة"
                                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg font-mono text-slate-700 focus:outline-hidden focus:border-blue-500"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="date"
                                value={it.expiryDate}
                                onChange={(e) => handleItemChange(idx, 'expiryDate', e.target.value)}
                                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg font-mono text-slate-700 focus:outline-hidden focus:border-blue-500"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min={it.minAllowedPacks || 0}
                                value={it.quantityPacks}
                                onChange={(e) =>
                                  handleItemChange(idx, 'quantityPacks', Number(e.target.value) || 0)
                                }
                                className={`w-full px-2 py-1.5 bg-white border ${
                                  hasSales && Number(it.quantityPacks) < (it.minAllowedPacks || 0)
                                    ? 'border-rose-400 bg-rose-50 text-rose-700'
                                    : 'border-slate-200'
                                } rounded-lg font-bold text-center focus:outline-hidden focus:border-blue-500`}
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="0"
                                value={it.bonusPacks || 0}
                                onChange={(e) =>
                                  handleItemChange(idx, 'bonusPacks', Number(e.target.value) || 0)
                                }
                                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-center focus:outline-hidden focus:border-blue-500"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="0"
                                value={it.purchasePricePack}
                                onChange={(e) =>
                                  handleItemChange(idx, 'purchasePricePack', Number(e.target.value) || 0)
                                }
                                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg font-mono font-bold text-slate-800 focus:outline-hidden focus:border-blue-500"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="0"
                                value={it.sellingPricePack}
                                onChange={(e) =>
                                  handleItemChange(idx, 'sellingPricePack', Number(e.target.value) || 0)
                                }
                                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg font-mono font-bold text-emerald-700 focus:outline-hidden focus:border-blue-500"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="1"
                                value={it.unitsPerPack || 1}
                                onChange={(e) =>
                                  handleItemChange(idx, 'unitsPerPack', Number(e.target.value) || 1)
                                }
                                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg font-mono text-center focus:outline-hidden focus:border-blue-500"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={it.shelfLocation || ''}
                                onChange={(e) => handleItemChange(idx, 'shelfLocation', e.target.value)}
                                placeholder="الرف"
                                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-hidden focus:border-blue-500"
                              />
                            </td>
                            <td className="p-2 font-mono font-black text-slate-900">
                              {Math.round(lineTotal).toLocaleString()} د.ع
                            </td>
                            <td className="p-2 text-center">
                              {hasSales ? (
                                <button
                                  type="button"
                                  disabled
                                  title="لا يمكن حذف دواء بيع منه في الكاشير"
                                  className="text-slate-300 cursor-not-allowed p-1.5"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                                  title="حذف هذا الدواء من الفاتورة"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Add Row Button */}
                <div className="flex justify-start shrink-0">
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-black inline-flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ إضافة دواء للفاتورة</span>
                  </button>
                </div>

                {/* Edit Mode Footer with Live Totals & Action Buttons */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 shrink-0 text-xs">
                  {(() => {
                    const totals = calculateEditTotals();
                    return (
                      <div className="flex flex-wrap items-center gap-4">
                        <div>
                          <span className="text-slate-500">إجمالي المواد: </span>
                          <span className="font-black text-slate-900 font-mono mr-1">
                            {Math.round(totals.grossTotal).toLocaleString()} د.ع
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">الصافي: </span>
                          <span className="font-black text-blue-700 text-sm font-mono mr-1">
                            {Math.round(totals.netTotal).toLocaleString()} د.ع
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">الواصل: </span>
                          <span className="font-bold text-emerald-700 font-mono mr-1">
                            {Math.round(totals.paid).toLocaleString()} د.ع
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">الباقي: </span>
                          <span className="font-bold text-rose-600 font-mono mr-1">
                            {Math.round(totals.remaining).toLocaleString()} د.ع
                          </span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={handleCancelEdit}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold cursor-pointer transition-colors"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={handleSaveEdit}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black inline-flex items-center gap-1.5 shadow-sm shadow-emerald-700/20 active:scale-95 transition-all cursor-pointer"
                    >
                      {isSaving ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>جاري الحفظ والمزامنة...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>💾 حفظ التعديلات والمخزون</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Smart AI OCR Invoice Scanner Modal */}
      {showAiScanModal && (
        <SmartInvoiceScannerModal
          initialSkipMatching={modalSkipMatching}
          onClose={() => setShowAiScanModal(false)}
          onSuccess={(savedInvoice) => {
            setShowAiScanModal(false);
            setMessage({
              type: 'success',
              text: `تم بنجاح قراءة واعتماد فاتورة المذخر (${savedInvoice.invoiceNumber || 'رقم جديد'}) وترحيل الأدوية للمخزن`,
            });
            fetchInvoices();
          }}
        />
      )}
    </div>
  );
};
