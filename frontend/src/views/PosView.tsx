import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Printer,
  DollarSign,
  AlertCircle,
  Package,
  Layers,
  X,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { roundTo250 } from '../utils/currency';

interface SearchMedicine {
  id: string;
  medicineId: string;
  customName?: string;
  tradeName: string;
  scientificName: string;
  unitsPerPack: number;
  sellingPricePack: number;
  sellingPriceUnit: number;
  availablePacks: number;
  availableStrips: number;
  totalUnitsRemaining: number;
  barcode?: string;
}

interface CartItem {
  inventoryItemId: string;
  customName?: string;
  tradeName: string;
  scientificName: string;
  unitType: 'PACK' | 'STRIP';
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unitsPerPack: number;
}

export const PosView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchMedicine[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [completedSale, setCompletedSale] = useState<any | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showShiftSummary, setShowShiftSummary] = useState(false);
  const [shiftSummary, setShiftSummary] = useState<any | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Return state
  const [returnItemId, setReturnItemId] = useState('');
  const [returnUnitType, setReturnUnitType] = useState<'PACK' | 'STRIP'>('PACK');
  const [returnQty, setReturnQty] = useState(1);
  const [returnReason, setReturnReason] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search bar on load
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Search medicines when search term changes
  useEffect(() => {
    if (searchTerm.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const data = await apiRequest<SearchMedicine[]>(`/inventory?search=${encodeURIComponent(searchTerm)}`);
        setSearchResults(data);
      } catch (err) {
        console.error('Search error:', err);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const addToCart = (med: SearchMedicine, unitType: 'PACK' | 'STRIP') => {
    const isPack = unitType === 'PACK';
    const price = isPack ? Number(med.sellingPricePack) : Number(med.sellingPriceUnit);

    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.inventoryItemId === med.id && item.unitType === unitType,
      );

      if (existingIndex > -1) {
        const updated = [...prev];
        const current = updated[existingIndex];
        const newQty = current.quantity + 1;
        updated[existingIndex] = {
          ...current,
          quantity: newQty,
          totalPrice: newQty * current.unitPrice,
        };
        return updated;
      }

      return [
        ...prev,
        {
          inventoryItemId: med.id,
          customName: med.customName,
          tradeName: med.tradeName,
          scientificName: med.scientificName,
          unitType,
          quantity: 1,
          unitPrice: price,
          totalPrice: price,
          unitsPerPack: med.unitsPerPack,
        },
      ];
    });

    setSearchTerm('');
    setSearchResults([]);
    searchInputRef.current?.focus();
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev];
      const item = updated[index];
      const newQty = item.quantity + delta;

      if (newQty <= 0) {
        return prev.filter((_, i) => i !== index);
      }

      updated[index] = {
        ...item,
        quantity: newQty,
        totalPrice: newQty * item.unitPrice,
      };
      return updated;
    });
  };

  const removeItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  const total = Math.max(0, roundTo250(subtotal - discountAmount));

  const handleCheckout = async () => {
    if (cart.length === 0) return;

    setLoading(true);
    setMessage(null);

    try {
      const payload = {
        discountAmount: Number(discountAmount || 0),
        items: cart.map((item) => ({
          inventoryItemId: item.inventoryItemId,
          unitType: item.unitType,
          quantity: item.quantity,
        })),
      };

      const result = await apiRequest<any>('/pos/checkout', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setCompletedSale(result);
      setCart([]);
      setDiscountAmount(0);
      setMessage({ type: 'success', text: `تم إتمام عملية البيع بنجاح! رقم الفاتورة: ${result.invoiceNumber}` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'فشل إتمام عملية البيع' });
    } finally {
      setLoading(false);
      searchInputRef.current?.focus();
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnItemId) return;

    try {
      const res = await apiRequest<any>('/pos/return', {
        method: 'POST',
        body: JSON.stringify({
          inventoryItemId: returnItemId,
          unitType: returnUnitType,
          quantity: Number(returnQty),
          reason: returnReason,
        }),
      });

      setMessage({ type: 'success', text: res.message });
      setShowReturnModal(false);
      setReturnItemId('');
      setReturnQty(1);
      setReturnReason('');
    } catch (err: any) {
      alert(err.message || 'فشل إرجاع المادة');
    }
  };

  const fetchShiftSummary = async () => {
    try {
      const data = await apiRequest<any>('/pos/daily-summary');
      setShiftSummary(data);
      setShowShiftSummary(true);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] gap-4">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-emerald-600" />
            الكاشير
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowReturnModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            إرجاع
          </button>

          <button
            onClick={fetchShiftSummary}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors cursor-pointer"
          >
            <DollarSign className="w-3.5 h-3.5" />
            اليومية
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded-lg flex items-center gap-2 text-sm font-medium ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
          {message.text}
          <button onClick={() => setMessage(null)} className="mr-auto text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Grid: Search & Catalog on Right, Cart on Left */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 min-h-0">
        {/* Right Section: Fast Search & Results (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50">
            <div className="relative">
              <Search className="w-5 h-5 absolute right-3.5 top-3.5 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث أو باركود..."
                className="w-full pr-11 pl-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm font-bold shadow-xs"
              />
            </div>
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto p-3 divide-y divide-slate-100">
            {searchResults.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10">
                <Package className="w-10 h-10 mb-2 text-slate-300 stroke-[1.5]" />
                <p className="text-sm font-bold">امسح الباركود أو ابحث</p>
              </div>
            ) : (
              searchResults.map((med) => (
                <div key={med.id} className="py-2.5 flex items-center justify-between hover:bg-slate-50 px-2 rounded-lg transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">{med.tradeName}</span>
                      {med.customName && (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-md text-xs font-black">
                          🏷️ {med.customName}
                        </span>
                      )}
                      {med.totalUnitsRemaining <= 0 ? (
                        <span className="text-xs px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-full font-bold">
                          نافد
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full font-bold">
                          متوفر: {med.availablePacks} علبة و {med.availableStrips} شريط
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">{med.scientificName}</div>
                  </div>

                  <div className="flex items-center gap-1.5 mr-3">
                    {/* Add Pack Button */}
                    <button
                      onClick={() => addToCart(med, 'PACK')}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      علبة ({Number(med.sellingPricePack).toLocaleString()} د.ع)
                    </button>

                    {/* Add Strip Button (Only if units per pack > 1) */}
                    {med.unitsPerPack > 1 && (
                      <button
                        onClick={() => addToCart(med, 'STRIP')}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        شريط ({Number(med.sellingPriceUnit).toLocaleString()} د.ع)
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Left Section: Active Invoice / Cart (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Cart Header */}
          <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h2 className="font-black text-slate-800 flex items-center gap-2 text-sm">
              <ShoppingCart className="w-4 h-4 text-slate-600" />
              السلة
            </h2>
            <span className="text-xs font-bold px-2.5 py-0.5 bg-slate-200 text-slate-700 rounded-full">
              {cart.length}
            </span>
          </div>

          {/* Cart Items Table */}
          <div className="flex-1 overflow-y-auto p-3 divide-y divide-slate-100 min-h-0">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 py-10">
                <ShoppingCart className="w-9 h-9 mb-2 text-slate-300 stroke-[1.5]" />
                <p className="text-xs font-bold">السلة فارغة</p>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={`${item.inventoryItemId}-${item.unitType}`} className="py-2 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 text-xs truncate flex items-center gap-1">
                      <span>{item.tradeName}</span>
                      {item.customName && (
                        <span className="text-amber-800 font-bold text-[10px] bg-amber-50 px-1 rounded">
                          ({item.customName})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                      <span className={`px-1 py-0.2 rounded text-[9px] font-bold ${item.unitType === 'PACK' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                        {item.unitType === 'PACK' ? 'علبة' : 'شريط'}
                      </span>
                      <span>{item.unitPrice.toLocaleString()} د.ع</span>
                    </div>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                    <button
                      onClick={() => updateQuantity(idx, -1)}
                      className="w-5 h-5 rounded bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center shadow-2xs cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-5 text-center font-bold text-xs text-slate-900">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(idx, 1)}
                      className="w-5 h-5 rounded bg-white hover:bg-slate-200 text-slate-700 flex items-center justify-center shadow-2xs cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Line Total */}
                  <div className="w-16 text-left font-bold text-xs text-slate-900">
                    {item.totalPrice.toLocaleString()} د.ع
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => removeItem(idx)}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Cart Footer & Checkout */}
          <div className="p-3.5 border-t border-slate-200 bg-slate-50/70 space-y-2.5">
            {/* Subtotal */}
            <div className="flex justify-between text-xs text-slate-600">
              <span>المجموع:</span>
              <span className="font-bold text-slate-900">{subtotal.toLocaleString()} د.ع</span>
            </div>

            {/* Discount */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">الخصم:</span>
              <input
                type="number"
                min="0"
                step="250"
                value={discountAmount || ''}
                onChange={(e) => setDiscountAmount(Number(e.target.value))}
                placeholder="0"
                className="w-20 px-2 py-1 bg-white border border-slate-300 rounded text-left text-xs font-bold text-rose-600 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Total */}
            <div className="flex justify-between items-center pt-1.5 border-t border-slate-200 text-sm font-black text-slate-900">
              <span>الإجمالي:</span>
              <span className="text-xl text-emerald-700 font-extrabold">{total.toLocaleString()} د.ع</span>
            </div>

            {/* Checkout Button */}
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-xl font-black text-sm shadow-xs flex items-center justify-center gap-1.5 active:scale-98 transition-all cursor-pointer"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  إتمام البيع ({total.toLocaleString()} د.ع)
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Sale Success / Receipt Modal */}
      {completedSale && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in duration-200">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-black text-slate-900">تمت عملية البيع بنجاح</h3>
              <p className="text-xs text-slate-500 mt-1">رقم الفاتورة: {completedSale.invoiceNumber}</p>
            </div>

            <div className="mt-4 p-3 bg-slate-50 rounded-xl space-y-1.5 text-xs text-slate-600 border border-slate-200">
              <div className="flex justify-between">
                <span>الوقت:</span>
                <span>{new Date(completedSale.createdAt).toLocaleTimeString('ar-IQ')}</span>
              </div>
              <div className="flex justify-between">
                <span>الكاشير:</span>
                <span>{completedSale.cashierName || 'الكاشير'}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
                <span>المبلغ المدفوع:</span>
                <span className="text-emerald-700">{Number(completedSale.totalAmount).toLocaleString()} د.ع</span>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-5">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                طباعة الوصل
              </button>
              <button
                onClick={() => setCompletedSale(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
              >
                إغلاق (بيع جديد)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-amber-600" />
                إرجاع دواء للمخزن
              </h3>
              <button onClick={() => setShowReturnModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReturnSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المادة المرجعة</label>
                <input
                  type="text"
                  placeholder="اكتب اسم الدواء للبحث..."
                  onChange={async (e) => {
                    if (e.target.value.length > 1) {
                      const res = await apiRequest<any[]>(`/inventory?search=${encodeURIComponent(e.target.value)}`);
                      if (res.length > 0) setReturnItemId(res[0].id);
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">نوع الوحدة</label>
                  <select
                    value={returnUnitType}
                    onChange={(e) => setReturnUnitType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  >
                    <option value="PACK">علبة</option>
                    <option value="STRIP">شريط</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الكمية المرجعة</label>
                  <input
                    type="number"
                    min="1"
                    value={returnQty}
                    onChange={(e) => setReturnQty(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">سبب الإرجاع (اختياري)</label>
                <input
                  type="text"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="مثال: تبديل جرعة، زائد عن الحاجة..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold"
                >
                  تأكيد الإرجاع واسترداد المبلغ
                </button>
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Shift Summary Drawer */}
      {showShiftSummary && shiftSummary && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                ملخص وردية اليوم
              </h3>
              <button onClick={() => setShowShiftSummary(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">عدد الفواتير الصادرة:</span>
                <span className="font-bold text-slate-900">{shiftSummary.totalInvoices}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">مجموع المبيعات:</span>
                <span className="font-bold text-slate-900">{shiftSummary.totalSalesRevenue.toLocaleString()} د.ع</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">إجمالي الخصومات:</span>
                <span className="font-bold text-rose-600">{shiftSummary.totalDiscounts.toLocaleString()} د.ع</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">إجمالي المرتجعات:</span>
                <span className="font-bold text-amber-600">{shiftSummary.totalRefunds.toLocaleString()} د.ع</span>
              </div>
              <div className="flex justify-between py-2 bg-emerald-50 px-3 rounded-lg text-emerald-900 font-extrabold text-base">
                <span>صافي الكاش في الدرج:</span>
                <span>{shiftSummary.netCashInDrawer.toLocaleString()} د.ع</span>
              </div>
            </div>

            <button
              onClick={() => setShowShiftSummary(false)}
              className="w-full mt-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
