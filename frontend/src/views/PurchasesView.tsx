import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  Package,
  Eye,
  X,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Printer,
  Trash2,
  Sparkles,
  Camera,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { SmartInvoiceScannerModal } from '../components/SmartInvoiceScannerModal';

interface PurchaseInvoiceItem {
  id?: string;
  medicineId: string;
  tradeName: string;
  scientificName?: string;
  batchNumber?: string;
  expiryDate: string;
  quantityPacks: number;
  unitsPerPack: number;
  purchasePricePack: number;
  sellingPricePack: number;
  totalCost?: number;
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
  items?: PurchaseInvoiceItem[];
}

export const PurchasesView: React.FC = () => {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showAiScanModal, setShowAiScanModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New Invoice Form State
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [invoiceItems, setInvoiceItems] = useState<PurchaseInvoiceItem[]>([]);

  // Medicine selection for new item
  const [itemSearch, setItemSearch] = useState('');
  const [filteredMedicines, setFilteredMedicines] = useState<any[]>([]);
  const [selectedMed, setSelectedMed] = useState<any | null>(null);
  const [itemBatch, setItemBatch] = useState('');
  const [itemExpiry, setItemExpiry] = useState('');
  const [itemQtyPacks, setItemQtyPacks] = useState<number>(1);
  const [itemPurchasePrice, setItemPurchasePrice] = useState<number>(0);
  const [itemSellingPrice, setItemSellingPrice] = useState<number>(0);

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
      const [sups, meds] = await Promise.all([
        apiRequest<any[]>('/inventory/suppliers').catch(() => []),
        apiRequest<any[]>('/medicines/search?limit=100').catch(() => []),
      ]);
      setSuppliers(sups || []);
      setMedicines(meds || []);
    } catch (err) {
      console.error(err);
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

  // Handle medicine search for line item
  useEffect(() => {
    if (!itemSearch || itemSearch.length < 2) {
      setFilteredMedicines([]);
      return;
    }
    const q = itemSearch.toLowerCase();
    const filtered = medicines.filter(
      (m) =>
        m.tradeName?.toLowerCase().includes(q) ||
        m.scientificName?.toLowerCase().includes(q) ||
        m.barcode?.includes(q),
    );
    setFilteredMedicines(filtered.slice(0, 8));
  }, [itemSearch, medicines]);

  const handleSelectMed = (med: any) => {
    setSelectedMed(med);
    setItemSearch(med.tradeName);
    setItemPurchasePrice(Number(med.defaultPurchasePrice || 0));
    setItemSellingPrice(Number(med.defaultSellingPrice || 0));
    setFilteredMedicines([]);
  };

  const addItemToInvoice = () => {
    if (!selectedMed) {
      alert('يرجى اختيار الدواء أولاً');
      return;
    }
    if (!itemExpiry) {
      alert('يرجى تحديد تاريخ انتهاء الصلاحية');
      return;
    }
    if (itemQtyPacks <= 0) {
      alert('يرجى إدخال كمية صحيحة');
      return;
    }

    const newItem: PurchaseInvoiceItem = {
      medicineId: selectedMed.id,
      tradeName: selectedMed.tradeName,
      scientificName: selectedMed.scientificName,
      batchNumber: itemBatch || undefined,
      expiryDate: itemExpiry,
      quantityPacks: Number(itemQtyPacks),
      unitsPerPack: Number(selectedMed.unitsPerPack || 1),
      purchasePricePack: Number(itemPurchasePrice),
      sellingPricePack: Number(itemSellingPrice),
      totalCost: Number(itemQtyPacks) * Number(itemPurchasePrice),
    };

    setInvoiceItems([...invoiceItems, newItem]);

    // Reset item input
    setSelectedMed(null);
    setItemSearch('');
    setItemBatch('');
    setItemExpiry('');
    setItemQtyPacks(1);
    setItemPurchasePrice(0);
    setItemSellingPrice(0);
  };

  const removeItemFromInvoice = (index: number) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
  };

  const totalInvoiceAmount = invoiceItems.reduce(
    (sum, it) => sum + (it.quantityPacks * it.purchasePricePack),
    0,
  );

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNumber.trim()) {
      alert('يرجى إدخال رقم الفاتورة');
      return;
    }
    if (invoiceItems.length === 0) {
      alert('يرجى إضافة مادة واحدة على الأقل في الفاتورة');
      return;
    }

    setSaving(true);
    try {
      const sup = suppliers.find((s) => s.id === selectedSupplierId);
      const res = await apiRequest<any>('/purchases', {
        method: 'POST',
        body: JSON.stringify({
          invoiceNumber: invoiceNumber.trim(),
          supplierId: selectedSupplierId || undefined,
          supplierName: sup ? sup.name : supplierName.trim() || undefined,
          invoiceDate,
          totalAmount: totalInvoiceAmount,
          paidAmount: Number(paidAmount) || 0,
          notes: notes.trim() || undefined,
          items: invoiceItems,
        }),
      });

      setMessage({ type: 'success', text: res.message || 'تم حفظ فاتورة الشراء بنجاح' });
      setShowNewModal(false);
      // Reset form
      setInvoiceNumber('');
      setSelectedSupplierId('');
      setSupplierName('');
      setPaidAmount(0);
      setNotes('');
      setInvoiceItems([]);
      fetchInvoices();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'فشل حفظ فاتورة الشراء' });
    } finally {
      setSaving(false);
    }
  };

  const openInvoiceDetails = async (invoice: PurchaseInvoice) => {
    try {
      const full = await apiRequest<PurchaseInvoice>(`/purchases/${invoice.id}`);
      setSelectedInvoice(full);
    } catch {
      setSelectedInvoice(invoice);
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
            <h1 className="text-lg font-black text-slate-800">أرشيف وفواتير المشتريات</h1>
            <p className="text-xs text-slate-500 font-medium">
              توثيق فواتير الشراء الواردة من المذاخر والموردين وتحديث المخزون آلياً
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAiScanModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-900/20 active:scale-95 transition-all cursor-pointer"
            title="تصوير وقراءة فاتورة المذخر الورقية بالذكاء الاصطناعي وترحيلها"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <Camera className="w-4 h-4" />
            <span>تصوير ومسح بالذكاء الاصطناعي (AI OCR)</span>
          </button>

          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إدخال يدوي</span>
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

      {/* Search and Summary Filters */}
      <div className="flex items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث برقم الفاتورة أو اسم المذخر / المورد..."
            className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500"
          />
        </div>
        <div className="text-xs font-bold text-slate-500 shrink-0">
          إجمالي الفواتير: <span className="text-slate-900 font-black">{invoices.length}</span>
        </div>
      </div>

      {/* Invoices List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="p-3.5">رقم الفاتورة</th>
                <th className="p-3.5">المذخر / المورد</th>
                <th className="p-3.5">تاريخ الفاتورة</th>
                <th className="p-3.5">عدد المواد</th>
                <th className="p-3.5">إجمالي المبلغ</th>
                <th className="p-3.5">المدفوع</th>
                <th className="p-3.5">المتبقي (الآجل)</th>
                <th className="p-3.5 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    جاري تحميل فواتير الشراء...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <Package className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
                    لا توجد فواتير شراء مسجلة حالياً.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-bold font-mono text-blue-700">{inv.invoiceNumber}</td>
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
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => openInvoiceDetails(inv)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>عرض التفاصيل</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-3xl w-full shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-black">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">
                    فاتورة شراء رقم: <span className="font-mono text-blue-600">{selectedInvoice.invoiceNumber}</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    المورد: {selectedInvoice.supplierName || 'غير محدد'} • التاريخ:{' '}
                    {new Date(selectedInvoice.invoiceDate).toLocaleDateString('ar-IQ')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Invoice Items Table */}
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

            {/* Summary Footer */}
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
              <button
                onClick={() => window.print()}
                className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Purchase Invoice Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-4xl w-full shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-black">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">تسجيل فاتورة شراء جديدة</h3>
                  <p className="text-xs text-slate-400">إدخال بضاعة من المذخر مع تحديث رصيد المورد والمخزن</p>
                </div>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Invoice Header Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم الفاتورة *</label>
                  <input
                    type="text"
                    required
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="مثال: INV-2026-001"
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">المذخر / المورد</label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => {
                      setSelectedSupplierId(e.target.value);
                      const sup = suppliers.find((s) => s.id === e.target.value);
                      if (sup) setSupplierName(sup.name);
                    }}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 focus:outline-hidden focus:border-blue-500"
                  >
                    <option value="">-- اختر مورد مسجل أو اكتب اسمه --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (رصيده: {Number(s.currentBalance || 0).toLocaleString()} د.ع)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">تاريخ الفاتورة</label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-mono text-slate-900 focus:outline-hidden focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Add Medicine Line Item Box */}
              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-200/80 space-y-3">
                <div className="text-xs font-black text-blue-900 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-blue-600" />
                  إضافة دواء إلى الفاتورة:
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                  {/* Medicine Search */}
                  <div className="sm:col-span-2 relative">
                    <label className="block font-bold text-slate-700 mb-1">اسم الدواء *</label>
                    <input
                      type="text"
                      value={itemSearch}
                      onChange={(e) => {
                        setItemSearch(e.target.value);
                        setSelectedMed(null);
                      }}
                      placeholder="ابحث بالاسم أو الباركود..."
                      className="w-full p-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-hidden focus:border-blue-500"
                    />
                    {filteredMedicines.length > 0 && (
                      <div className="absolute top-full right-0 left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-48 overflow-y-auto">
                        {filteredMedicines.map((m) => (
                          <div
                            key={m.id}
                            onClick={() => handleSelectMed(m)}
                            className="p-2.5 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0"
                          >
                            <div className="font-bold text-slate-900">{m.tradeName}</div>
                            <div className="text-[10px] text-slate-400">{m.scientificName}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">رقم الوجبة (Batch)</label>
                    <input
                      type="text"
                      value={itemBatch}
                      onChange={(e) => setItemBatch(e.target.value)}
                      placeholder="اختياري"
                      className="w-full p-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-900 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">تاريخ الانتهاء *</label>
                    <input
                      type="date"
                      value={itemExpiry}
                      onChange={(e) => setItemExpiry(e.target.value)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-xl font-mono text-slate-900 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">الكمية (علب) *</label>
                    <input
                      type="number"
                      min="1"
                      value={itemQtyPacks}
                      onChange={(e) => setItemQtyPacks(Number(e.target.value))}
                      className="w-full p-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">سعر الشراء للعلبة *</label>
                    <input
                      type="number"
                      min="0"
                      value={itemPurchasePrice}
                      onChange={(e) => setItemPurchasePrice(Number(e.target.value))}
                      className="w-full p-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">سعر البيع للعلبة *</label>
                    <input
                      type="number"
                      min="0"
                      value={itemSellingPrice}
                      onChange={(e) => setItemSellingPrice(Number(e.target.value))}
                      className="w-full p-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-emerald-700 focus:outline-hidden focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={addItemToInvoice}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-xs cursor-pointer"
                    >
                      إضافة للجدول +
                    </button>
                  </div>
                </div>
              </div>

              {/* Added Items Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="p-2.5">الدواء</th>
                      <th className="p-2.5">الوجبة</th>
                      <th className="p-2.5">الصلاحية</th>
                      <th className="p-2.5">الكمية</th>
                      <th className="p-2.5">سعر الشراء</th>
                      <th className="p-2.5">سعر البيع</th>
                      <th className="p-2.5">الإجمالي</th>
                      <th className="p-2.5 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoiceItems.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-6 text-slate-400">
                          لم تقم بإضافة أي أدوية بعد
                        </td>
                      </tr>
                    ) : (
                      invoiceItems.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2.5 font-bold text-slate-900">{it.tradeName}</td>
                          <td className="p-2.5 font-mono text-slate-600">{it.batchNumber || '—'}</td>
                          <td className="p-2.5 font-mono">{it.expiryDate}</td>
                          <td className="p-2.5 font-bold">{it.quantityPacks} علبة</td>
                          <td className="p-2.5 font-mono">{it.purchasePricePack.toLocaleString()} د.ع</td>
                          <td className="p-2.5 font-mono text-emerald-700 font-bold">
                            {it.sellingPricePack.toLocaleString()} د.ع
                          </td>
                          <td className="p-2.5 font-mono font-black">
                            {(it.quantityPacks * it.purchasePricePack).toLocaleString()} د.ع
                          </td>
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => removeItemFromInvoice(idx)}
                              className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Payment Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">إجمالي الفاتورة</label>
                  <div className="text-base font-black text-slate-900 font-mono">
                    {totalInvoiceAmount.toLocaleString()} د.ع
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">المبلغ المسدد نقداً</label>
                  <input
                    type="number"
                    min="0"
                    max={totalInvoiceAmount}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                    className="w-full p-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-emerald-700 focus:outline-hidden focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">المتبقي (ديون على الصيدلية)</label>
                  <div className="text-base font-black text-rose-600 font-mono">
                    {Math.max(0, totalInvoiceAmount - paidAmount).toLocaleString()} د.ع
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving || invoiceItems.length === 0}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-black shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>حفظ وتحديث المخزون</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Smart AI OCR Invoice Scanner Modal */}
      {showAiScanModal && (
        <SmartInvoiceScannerModal
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
