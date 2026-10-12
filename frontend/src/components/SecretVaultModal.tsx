import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  Unlock,
  KeyRound,
  X,
  Package,
  Plus,
  Trash2,
  Edit3,
  ShoppingCart,
  ArrowDownRight,
  ArrowUpRight,
  History,
  AlertTriangle,
  Check,
  Search,
  TrendingUp,
  RefreshCw,
  LogOut,
  Save,
  Minus,
} from 'lucide-react';
import { apiRequest } from '../api/client';

interface SecretItem {
  id: string;
  tradeName: string;
  scientificName?: string;
  barcode?: string;
  strength?: string;
  dosageForm?: string;
  purchasePrice: number;
  sellingPrice: number;
  quantity: number;
  minAlertQty: number;
  expiryDate?: string;
  notes?: string;
}

interface SecretTransaction {
  id: string;
  itemId: string;
  tradeName: string;
  strength?: string;
  dosageForm?: string;
  type: 'IN' | 'OUT' | 'SALE';
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  customerOrSource?: string;
  notes?: string;
  createdAt: string;
}

interface SecretVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecretVaultModal: React.FC<SecretVaultModalProps> = ({ isOpen, onClose }) => {
  // Authentication State
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isPinConfigured, setIsPinConfigured] = useState(true);
  const [pinInput, setPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmPinInput, setConfirmPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Vault Main Tabs: 'POS' | 'INVENTORY' | 'LEDGER' | 'REPORTS' | 'SETTINGS'
  const [activeTab, setActiveTab] = useState<'POS' | 'INVENTORY' | 'LEDGER' | 'REPORTS' | 'SETTINGS'>('POS');

  // Data States
  const [items, setItems] = useState<SecretItem[]>([]);
  const [transactions, setTransactions] = useState<SecretTransaction[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Secret POS Cart State
  const [cart, setCart] = useState<Array<{ item: SecretItem; quantity: number; sellingPrice: number }>>([]);
  const [buyerName, setBuyerName] = useState('');
  const [saleNotes, setSaleNotes] = useState('');
  const [completingSale, setCompletingSale] = useState(false);
  const [saleSuccessMessage, setSaleSuccessMessage] = useState('');

  // Item Modal (Add/Edit)
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<SecretItem> | null>(null);
  const [savingItem, setSavingItem] = useState(false);

  // In / Out Quick Modals
  const [showQuickMovementModal, setShowQuickMovementModal] = useState(false);
  const [movementType, setMovementType] = useState<'IN' | 'OUT'>('IN');
  const [movementItem, setMovementItem] = useState<SecretItem | null>(null);
  const [movementQty, setMovementQty] = useState<number | ''>('');
  const [movementPrice, setMovementPrice] = useState<number | ''>('');
  const [movementSource, setMovementSource] = useState('');
  const [movementNotes, setMovementNotes] = useState('');
  const [savingMovement, setSavingMovement] = useState(false);

  // Change PIN State
  const [currentPinChange, setCurrentPinChange] = useState('');
  const [newPinChange, setNewPinChange] = useState('');
  const [pinChangeMsg, setPinChangeMsg] = useState('');

  const pinInputRef = useRef<HTMLInputElement>(null);

  // On open: check PIN configuration
  useEffect(() => {
    if (isOpen) {
      setPinError('');
      setPinInput('');
      apiRequest<any>('/vault/pin-status')
        .then((res) => {
          setIsPinConfigured(res.isConfigured);
        })
        .catch(() => {});
    } else {
      setIsUnlocked(false);
      setCart([]);
    }
  }, [isOpen]);

  // Focus PIN input
  useEffect(() => {
    if (isOpen && !isUnlocked) {
      setTimeout(() => {
        pinInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, isUnlocked, isPinConfigured]);

  // Global ESC handler for immediate panic close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch Vault Data when unlocked
  const fetchVaultData = async () => {
    try {
      const [itemsData, transData, summaryData] = await Promise.all([
        apiRequest<SecretItem[]>('/vault/items'),
        apiRequest<SecretTransaction[]>('/vault/transactions?limit=200'),
        apiRequest<any>('/vault/summary'),
      ]);
      setItems(itemsData || []);
      setTransactions(transData || []);
      setSummary(summaryData || null);
    } catch (err: any) {
      console.error('Failed to fetch secret vault data:', err);
    }
  };

  useEffect(() => {
    if (isUnlocked) {
      fetchVaultData();
    }
  }, [isUnlocked]);

  // Handle PIN verification
  const handleVerifyPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!pinInput || pinInput.length < 4) {
      setPinError('أدخل رمز الـ PIN المكون من 4 أرقام على الأقل');
      return;
    }

    setIsAuthenticating(true);
    setPinError('');
    try {
      const res = await apiRequest<any>('/vault/verify-pin', {
        method: 'POST',
        body: JSON.stringify({ pin: pinInput }),
      });

      if (res.valid) {
        setIsUnlocked(true);
        setPinInput('');
      } else {
        setPinError('رمز PIN غير صحيح! تم رفض الدخول.');
        setPinInput('');
      }
    } catch (err: any) {
      setPinError(err.message || 'فشل التحقق من الرمز');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Handle Setting Initial PIN
  const handleSetupInitialPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPinInput || newPinInput.length < 4) {
      setPinError('يجب أن يتكون الرمز من 4 أرقام على الأقل');
      return;
    }
    if (newPinInput !== confirmPinInput) {
      setPinError('الرمزان غير متطابقين!');
      return;
    }

    setIsAuthenticating(true);
    setPinError('');
    try {
      await apiRequest<any>('/vault/setup-pin', {
        method: 'POST',
        body: JSON.stringify({ newPin: newPinInput }),
      });
      setIsPinConfigured(true);
      setIsUnlocked(true);
      setNewPinInput('');
      setConfirmPinInput('');
    } catch (err: any) {
      setPinError(err.message || 'فشل ضبط الرمز السري');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // POS Cart Management
  const addToCart = (item: SecretItem) => {
    setCart((prev) => {
      const existing = prev.find((line) => line.item.id === item.id);
      if (existing) {
        if (existing.quantity >= item.quantity) {
          alert(`الكمية المتوفرة بالمخزن السري (${item.quantity}) لا تسمح بإضافة المزيد!`);
          return prev;
        }
        return prev.map((line) =>
          line.item.id === item.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }
      if (item.quantity <= 0) {
        alert('هذه المادة نافذة من المخزن السري حالياً!');
        return prev;
      }
      return [...prev, { item, quantity: 1, sellingPrice: item.sellingPrice }];
    });
  };

  const updateCartQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((line) => {
          if (line.item.id === itemId) {
            const newQty = line.quantity + delta;
            if (newQty > line.item.quantity) {
              alert(`الرصيد المتوفر هو ${line.item.quantity} فقط!`);
              return line;
            }
            return newQty > 0 ? { ...line, quantity: newQty } : null;
          }
          return line;
        })
        .filter(Boolean) as any,
    );
  };

  const updateCartPrice = (itemId: string, newPrice: number) => {
    setCart((prev) =>
      prev.map((line) =>
        line.item.id === itemId ? { ...line, sellingPrice: Number(newPrice) || 0 } : line,
      ),
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart((prev) => prev.filter((line) => line.item.id !== itemId));
  };

  const cartTotal = cart.reduce((sum, line) => sum + line.quantity * line.sellingPrice, 0);
  const cartCostTotal = cart.reduce((sum, line) => sum + line.quantity * line.item.purchasePrice, 0);
  const cartEstProfit = cartTotal - cartCostTotal;

  // Complete Sale
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCompletingSale(true);
    try {
      const res = await apiRequest<any>('/vault/sale', {
        method: 'POST',
        body: JSON.stringify({
          items: cart.map((line) => ({
            itemId: line.item.id,
            quantity: line.quantity,
            unitPrice: line.sellingPrice,
          })),
          customerName: buyerName.trim() || undefined,
          notes: saleNotes.trim() || undefined,
        }),
      });

      setSaleSuccessMessage(`✅ تم إتمام البيع بنجاح! الإجمالي: ${cartTotal.toLocaleString()} د.ع (ربح: ${res.netProfit.toLocaleString()} د.ع)`);
      setCart([]);
      setBuyerName('');
      setSaleNotes('');
      fetchVaultData();
      setTimeout(() => setSaleSuccessMessage(''), 5000);
    } catch (err: any) {
      alert(`خطأ: ${err.message || 'فشل إتمام البيع'}`);
    } finally {
      setCompletingSale(false);
    }
  };

  // Save Item (Add / Edit)
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem?.tradeName) return;
    setSavingItem(true);
    try {
      await apiRequest<any>('/vault/items', {
        method: 'POST',
        body: JSON.stringify(editingItem),
      });
      setShowItemModal(false);
      setEditingItem(null);
      fetchVaultData();
    } catch (err: any) {
      alert(`خطأ: ${err.message || 'فشل حفظ العلاج'}`);
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف [${name}] من المخزن السري نهائياً؟`)) return;
    try {
      await apiRequest<any>(`/vault/items/${id}`, { method: 'DELETE' });
      fetchVaultData();
    } catch (err: any) {
      alert(`خطأ: ${err.message || 'فشل الحذف'}`);
    }
  };

  // Handle Quick In / Out Movement
  const handleSaveMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementItem || !movementQty || Number(movementQty) <= 0) return;

    setSavingMovement(true);
    try {
      if (movementType === 'IN') {
        await apiRequest<any>('/vault/stock-in', {
          method: 'POST',
          body: JSON.stringify({
            itemId: movementItem.id,
            quantity: Number(movementQty),
            unitPrice: Number(movementPrice || movementItem.purchasePrice),
            source: movementSource || undefined,
            notes: movementNotes || undefined,
          }),
        });
      } else {
        await apiRequest<any>('/vault/stock-out', {
          method: 'POST',
          body: JSON.stringify({
            itemId: movementItem.id,
            quantity: Number(movementQty),
            reason: movementSource || undefined,
            notes: movementNotes || undefined,
          }),
        });
      }

      setShowQuickMovementModal(false);
      setMovementItem(null);
      setMovementQty('');
      setMovementPrice('');
      setMovementSource('');
      setMovementNotes('');
      fetchVaultData();
    } catch (err: any) {
      alert(`خطأ: ${err.message || 'فشل تسجيل الحركة'}`);
    } finally {
      setSavingMovement(false);
    }
  };

  // Change PIN
  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPinChange || newPinChange.length < 4) {
      alert('الرمز الجديد يجب أن يتكون من 4 أرقام على الأقل');
      return;
    }
    try {
      await apiRequest<any>('/vault/setup-pin', {
        method: 'POST',
        body: JSON.stringify({
          oldPin: currentPinChange,
          newPin: newPinChange,
        }),
      });
      setPinChangeMsg('✅ تم تغيير الرمز السري بنجاح');
      setCurrentPinChange('');
      setNewPinChange('');
      setTimeout(() => setPinChangeMsg(''), 4000);
    } catch (err: any) {
      alert(`خطأ: ${err.message || 'فشل تغيير الرمز'}`);
    }
  };

  if (!isOpen) return null;

  // ----------------------------------------------------
  // 1. PIN LOCK SCREEN
  // ----------------------------------------------------
  if (!isUnlocked) {
    return (
      <div className="fixed inset-0 z-99999 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-slate-900 border-2 border-slate-800 text-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
          <button
            onClick={onClose}
            className="absolute top-4 left-4 text-slate-500 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
            title="إلغاء (Esc)"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3 shadow-inner">
              <Shield className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-white">المخزن السري الآمن</h3>
            <p className="text-xs text-slate-400 mt-1">
              {isPinConfigured
                ? 'أدخل رمز الـ PIN المخصص لفتح المخزن'
                : 'قم بإنشاء رمز PIN سري للمخزن لأول مرة'}
            </p>
          </div>

          {pinError && (
            <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-bold text-center flex items-center justify-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{pinError}</span>
            </div>
          )}

          {isPinConfigured ? (
            <form onSubmit={handleVerifyPin} className="space-y-4">
              <div>
                <input
                  ref={pinInputRef}
                  type="password"
                  maxLength={12}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="••••"
                  autoFocus
                  className="w-full text-center tracking-widest text-2xl font-black py-3.5 bg-slate-950 border border-slate-800 rounded-2xl text-emerald-400 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder:text-slate-700"
                />
              </div>

              {/* Numpad for convenience */}
              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      if (k === 'C') setPinInput('');
                      else if (k === '⌫') setPinInput((prev) => prev.slice(0, -1));
                      else setPinInput((prev) => (prev.length < 8 ? prev + k : prev));
                    }}
                    className="py-3 bg-slate-800/60 hover:bg-slate-800 text-white font-black text-lg rounded-xl active:scale-95 transition-all cursor-pointer"
                  >
                    {k}
                  </button>
                ))}
              </div>

              <button
                type="submit"
                disabled={isAuthenticating || pinInput.length < 4}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black rounded-2xl transition-all shadow-lg shadow-emerald-950 cursor-pointer flex items-center justify-center gap-2"
              >
                {isAuthenticating ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Unlock className="w-5 h-5" />
                    <span>دخول آمن</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSetupInitialPin} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">رمز PIN السري الجديد:</label>
                <input
                  type="password"
                  maxLength={12}
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value)}
                  placeholder="مثلاً: 1234"
                  className="w-full text-center text-xl font-bold py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">تأكيد الرمز:</label>
                <input
                  type="password"
                  maxLength={12}
                  value={confirmPinInput}
                  onChange={(e) => setConfirmPinInput(e.target.value)}
                  placeholder="أعد إدخال الرمز"
                  className="w-full text-center text-xl font-bold py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>
              <button
                type="submit"
                disabled={isAuthenticating || newPinInput.length < 4}
                className="w-full mt-2 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                <KeyRound className="w-4 h-4" />
                <span>حفظ الرمز والفتح</span>
              </button>
            </form>
          )}

          <div className="mt-4 text-center">
            <span className="text-[11px] text-slate-500 font-bold">
              اضغط <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-slate-400">Esc</kbd> للخروج الفوري
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // 2. UNLOCKED SECRET VAULT INTERFACE
  // ----------------------------------------------------
  const filteredItems = items.filter((it) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      it.tradeName.toLowerCase().includes(q) ||
      (it.barcode && it.barcode.toLowerCase().includes(q)) ||
      (it.scientificName && it.scientificName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-99999 bg-slate-950 text-slate-100 flex flex-col overflow-hidden animate-in fade-in duration-100">
      {/* Stealth Header */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white">المخزن السري الموازي</h2>
              <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                🔒 وضع معزول تماماً
              </span>
            </div>
            <p className="text-[11px] text-slate-400">حركات وبيانات هذا المخزن لا تظهر في الكاشير أو التقارير العامة</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="hidden md:flex items-center gap-1 bg-slate-950 p-1 rounded-2xl border border-slate-800 text-xs font-black">
          <button
            onClick={() => setActiveTab('POS')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'POS' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>نقطة بيع سرية</span>
          </button>
          <button
            onClick={() => setActiveTab('INVENTORY')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'INVENTORY' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>إدارة المواد ({items.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('LEDGER')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'LEDGER' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            <span>الوارد والصادر ({transactions.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('REPORTS')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'REPORTS' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>الأرباح والإحصائيات</span>
          </button>
          <button
            onClick={() => setActiveTab('SETTINGS')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'SETTINGS' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>تغيير الـ PIN</span>
          </button>
        </div>

        {/* Emergency Panic Exit Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3.5 py-2 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
            title="إغلاق فوري (Esc)"
          >
            <LogOut className="w-4 h-4" />
            <span>إغلاق فوري (Esc)</span>
          </button>
        </div>
      </header>

      {/* Mobile Tab Bar */}
      <div className="md:hidden flex items-center gap-1 overflow-x-auto bg-slate-900 border-b border-slate-800 p-2 text-xs font-bold shrink-0">
        <button
          onClick={() => setActiveTab('POS')}
          className={`px-3 py-1.5 rounded-lg shrink-0 ${activeTab === 'POS' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
        >
          نقطة بيع
        </button>
        <button
          onClick={() => setActiveTab('INVENTORY')}
          className={`px-3 py-1.5 rounded-lg shrink-0 ${activeTab === 'INVENTORY' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
        >
          المواد ({items.length})
        </button>
        <button
          onClick={() => setActiveTab('LEDGER')}
          className={`px-3 py-1.5 rounded-lg shrink-0 ${activeTab === 'LEDGER' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
        >
          الوارد والصادر
        </button>
        <button
          onClick={() => setActiveTab('REPORTS')}
          className={`px-3 py-1.5 rounded-lg shrink-0 ${activeTab === 'REPORTS' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
        >
          الأرباح
        </button>
        <button
          onClick={() => setActiveTab('SETTINGS')}
          className={`px-3 py-1.5 rounded-lg shrink-0 ${activeTab === 'SETTINGS' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
        >
          الـ PIN
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {/* ============================================================ */}
        {/* TAB 1: SECRET POS                                             */}
        {/* ============================================================ */}
        {activeTab === 'POS' && (
          <div className="h-full flex flex-col md:flex-row overflow-hidden">
            {/* Products Search & List */}
            <div className="flex-1 flex flex-col p-4 overflow-hidden border-b md:border-b-0 md:border-l border-slate-800">
              {saleSuccessMessage && (
                <div className="mb-3 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold flex items-center justify-between">
                  <span>{saleSuccessMessage}</span>
                  <button onClick={() => setSaleSuccessMessage('')} className="cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Search input */}
              <div className="relative mb-3 shrink-0">
                <Search className="w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث في المخزن السري بالاسم أو الباركود..."
                  className="w-full pr-12 pl-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-white placeholder:text-slate-500 text-sm font-bold focus:outline-hidden focus:border-emerald-500 transition-all"
                />
              </div>

              {/* Items Cards */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-2">
                {filteredItems.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-slate-500 text-center">
                    <Package className="w-10 h-10 mb-2 opacity-30" />
                    <p className="text-sm font-bold">لا توجد مواد تطابق البحث</p>
                    <button
                      onClick={() => {
                        setActiveTab('INVENTORY');
                        setEditingItem({ tradeName: searchQuery });
                        setShowItemModal(true);
                      }}
                      className="mt-3 text-xs text-emerald-400 underline font-black cursor-pointer"
                    >
                      + أضف مادة جديدة إلى المخزن السري
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {filteredItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => addToCart(item)}
                        className={`p-3.5 bg-slate-900 hover:bg-slate-850 border rounded-2xl transition-all cursor-pointer flex flex-col justify-between group active:scale-98 ${
                          item.quantity <= 0
                            ? 'border-rose-900/40 opacity-60'
                            : item.quantity <= item.minAlertQty
                            ? 'border-amber-800/40'
                            : 'border-slate-800 hover:border-emerald-500/50'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-1 mb-1">
                            <h4 className="text-sm font-black text-white group-hover:text-emerald-400 transition-colors">
                              {item.tradeName}
                            </h4>
                            <span
                              className={`text-[11px] font-black px-2 py-0.5 rounded-lg ${
                                item.quantity <= 0
                                  ? 'bg-rose-500/20 text-rose-400'
                                  : item.quantity <= item.minAlertQty
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-emerald-500/10 text-emerald-400'
                              }`}
                            >
                              الرصيد: {item.quantity}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            {item.strength && `${item.strength} • `}
                            {item.dosageForm || 'علاج سري'}
                          </p>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs font-bold">
                          <div>
                            <span className="text-slate-400 text-[10px] block">سعر البيع:</span>
                            <span className="text-emerald-400 font-black text-sm">
                              {item.sellingPrice.toLocaleString()} د.ع
                            </span>
                          </div>
                          <div className="text-left">
                            <span className="text-slate-400 text-[10px] block">سعر الشراء:</span>
                            <span className="text-slate-400 text-xs">
                              {item.purchasePrice.toLocaleString()} د.ع
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Secret Cart Panel */}
            <div className="w-full md:w-96 bg-slate-900 flex flex-col shrink-0 h-1/2 md:h-full">
              <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-black text-white">سلة البيع السري ({cart.length})</h3>
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    className="text-[11px] text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
                  >
                    تفريغ السلة
                  </button>
                )}
              </div>

              {/* Cart Items List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center p-4">
                    <ShoppingCart className="w-8 h-8 mb-2 opacity-20" />
                    <p className="text-xs font-bold">السلة فارغة</p>
                    <p className="text-[10px] text-slate-500 mt-1">انقر على أي مادة من القائمة لإضافتها للبيع</p>
                  </div>
                ) : (
                  cart.map((line) => (
                    <div
                      key={line.item.id}
                      className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <h5 className="text-xs font-black text-white">{line.item.tradeName}</h5>
                          <span className="text-[10px] text-slate-400">
                            تكلفة الوحدة: {line.item.purchasePrice.toLocaleString()} د.ع
                          </span>
                        </div>
                        <button
                          onClick={() => removeFromCart(line.item.id)}
                          className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                        {/* Quantity Counter */}
                        <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800">
                          <button
                            onClick={() => updateCartQuantity(line.item.id, -1)}
                            className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-black text-white px-1.5">{line.quantity}</span>
                          <button
                            onClick={() => updateCartQuantity(line.item.id, 1)}
                            className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Editable Unit Price */}
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={line.sellingPrice}
                            onChange={(e) => updateCartPrice(line.item.id, Number(e.target.value))}
                            className="w-20 px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-emerald-400 text-xs font-black text-center focus:outline-hidden focus:border-emerald-500"
                          />
                          <span className="text-[10px] text-slate-500">د.ع</span>
                        </div>

                        {/* Line Total */}
                        <div className="text-left">
                          <span className="text-xs font-black text-white">
                            {(line.quantity * line.sellingPrice).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Cart Footer */}
              {cart.length > 0 && (
                <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-2">
                  <div className="space-y-1">
                    <input
                      type="text"
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      placeholder="اسم المستلم / الزبون (اختياري)..."
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-600 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span>إجمالي التكلفة:</span>
                      <span>{cartCostTotal.toLocaleString()} د.ع</span>
                    </div>
                    <div className="flex items-center justify-between text-emerald-400 font-bold text-xs">
                      <span>الربح الصافي المتوقع:</span>
                      <span>+{cartEstProfit.toLocaleString()} د.ع</span>
                    </div>
                    <div className="flex items-center justify-between text-white font-black text-sm pt-1 border-t border-slate-800">
                      <span>المطلوب استلامه:</span>
                      <span className="text-emerald-400 text-base">{cartTotal.toLocaleString()} د.ع</span>
                    </div>
                  </div>

                  <button
                    onClick={handleCheckout}
                    disabled={completingSale}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black rounded-xl text-sm transition-all shadow-md shadow-emerald-950 cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                  >
                    {completingSale ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>إتمام البيع السري</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: INVENTORY MANAGEMENT                                   */}
        {/* ============================================================ */}
        {activeTab === 'INVENTORY' && (
          <div className="h-full flex flex-col p-4 overflow-hidden">
            <div className="flex items-center justify-between gap-3 mb-4 shrink-0">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث في أسماء وأكواد المواد السرية..."
                  className="w-full pr-9 pl-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-white placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchVaultData}
                  className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 rounded-xl cursor-pointer"
                  title="تحديث"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setEditingItem({
                      tradeName: '',
                      purchasePrice: 0,
                      sellingPrice: 0,
                      quantity: 0,
                      minAlertQty: 2,
                    });
                    setShowItemModal(true);
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة مادة سرية جديدة</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto bg-slate-900 border border-slate-800 rounded-2xl">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950 text-slate-400 font-black border-b border-slate-800 sticky top-0">
                  <tr>
                    <th className="p-3">اسم العلاج السري</th>
                    <th className="p-3">الباركود</th>
                    <th className="p-3">التركيز / الشكل</th>
                    <th className="p-3">سعر الشراء</th>
                    <th className="p-3">سعر البيع</th>
                    <th className="p-3">الرصيد المتوفر</th>
                    <th className="p-3">تاريخ النفاذ</th>
                    <th className="p-3 text-center">إجراءات سريعة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-bold">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        لا توجد مواد مخزنة في المخزن السري بعد.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-850/50 transition-colors">
                        <td className="p-3 font-black text-white">{item.tradeName}</td>
                        <td className="p-3 text-slate-400 font-mono text-[11px]">{item.barcode || '—'}</td>
                        <td className="p-3 text-slate-400">
                          {item.strength || ''} {item.dosageForm ? `• ${item.dosageForm}` : ''}
                        </td>
                        <td className="p-3 text-slate-300">{item.purchasePrice.toLocaleString()} د.ع</td>
                        <td className="p-3 text-emerald-400 font-black">{item.sellingPrice.toLocaleString()} د.ع</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-md font-black text-[11px] ${
                              item.quantity <= 0
                                ? 'bg-rose-500/20 text-rose-400'
                                : item.quantity <= item.minAlertQty
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {item.quantity}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400 text-[11px]">
                          {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('en-GB') : '—'}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setMovementItem(item);
                                setMovementType('IN');
                                setMovementPrice(item.purchasePrice);
                                setShowQuickMovementModal(true);
                              }}
                              className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-black cursor-pointer"
                              title="تسجيل وارد للمادة"
                            >
                              + وارد
                            </button>
                            <button
                              onClick={() => {
                                setMovementItem(item);
                                setMovementType('OUT');
                                setShowQuickMovementModal(true);
                              }}
                              className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-[10px] font-black cursor-pointer"
                              title="تسجيل صادر من المادة"
                            >
                              - صادر
                            </button>
                            <button
                              onClick={() => {
                                setEditingItem(item);
                                setShowItemModal(true);
                              }}
                              className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                              title="تعديل"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id, item.tradeName)}
                              className="p-1 text-slate-500 hover:text-rose-400 rounded-lg cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: LEDGER (IN / OUT / SALE TRANSACTIONS)                  */}
        {/* ============================================================ */}
        {activeTab === 'LEDGER' && (
          <div className="h-full flex flex-col p-4 overflow-hidden">
            <div className="flex items-center justify-between gap-3 mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (items.length === 0) {
                      alert('يرجى إضافة مادة أولاً من تبويب إدارة المواد');
                      return;
                    }
                    setMovementItem(items[0]);
                    setMovementType('IN');
                    setMovementPrice(items[0].purchasePrice);
                    setShowQuickMovementModal(true);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowDownRight className="w-4 h-4" />
                  <span>تسجيل وارد جديد (📥)</span>
                </button>
                <button
                  onClick={() => {
                    if (items.length === 0) {
                      alert('يرجى إضافة مادة أولاً من تبويب إدارة المواد');
                      return;
                    }
                    setMovementItem(items[0]);
                    setMovementType('OUT');
                    setShowQuickMovementModal(true);
                  }}
                  className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>تسجيل صادر / إتلاف (📤)</span>
                </button>
              </div>

              <button
                onClick={fetchVaultData}
                className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 rounded-xl cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            {/* Transactions Table */}
            <div className="flex-1 overflow-auto bg-slate-900 border border-slate-800 rounded-2xl">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-950 text-slate-400 font-black border-b border-slate-800 sticky top-0">
                  <tr>
                    <th className="p-3">التاريخ والوقت</th>
                    <th className="p-3">نوع الحركة</th>
                    <th className="p-3">اسم المادة</th>
                    <th className="p-3">الكمية</th>
                    <th className="p-3">سعر الوحدة</th>
                    <th className="p-3">الإجمالي</th>
                    <th className="p-3">الجهة / المصدر</th>
                    <th className="p-3">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-bold">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        لا توجد حركات مسجلة بعد.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tr) => (
                      <tr key={tr.id} className="hover:bg-slate-850/50">
                        <td className="p-3 text-slate-400 text-[11px]">
                          {new Date(tr.createdAt).toLocaleString('ar-IQ')}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-md font-black text-[10px] ${
                              tr.type === 'IN'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : tr.type === 'SALE'
                                ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {tr.type === 'IN' ? '📥 وارد' : tr.type === 'SALE' ? '🛒 بيع' : '📤 صادر'}
                          </span>
                        </td>
                        <td className="p-3 font-black text-white">{tr.tradeName || 'مادة محذوفة'}</td>
                        <td className="p-3 font-black">{tr.quantity}</td>
                        <td className="p-3 text-slate-300">{tr.unitPrice.toLocaleString()} د.ع</td>
                        <td className="p-3 font-black text-emerald-400">{tr.totalAmount.toLocaleString()} د.ع</td>
                        <td className="p-3 text-slate-400">{tr.customerOrSource || '—'}</td>
                        <td className="p-3 text-slate-500 text-[11px]">{tr.notes || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: REPORTS & ANALYTICS                                   */}
        {/* ============================================================ */}
        {activeTab === 'REPORTS' && summary && (
          <div className="h-full p-4 overflow-y-auto max-w-4xl mx-auto space-y-4">
            <h3 className="text-sm font-black text-slate-300">الملخص المالي للمخزن السري:</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                <span className="text-[11px] text-slate-400 font-bold block mb-1">رأس مال المخزن (شراء)</span>
                <span className="text-xl font-black text-white">
                  {summary.totalPurchaseValue.toLocaleString()} د.ع
                </span>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                <span className="text-[11px] text-slate-400 font-bold block mb-1">القيمة البيعية للمخزون</span>
                <span className="text-xl font-black text-emerald-400">
                  {summary.totalSellingValue.toLocaleString()} د.ع
                </span>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                <span className="text-[11px] text-slate-400 font-bold block mb-1">إجمالي المبيعات المنفذة</span>
                <span className="text-xl font-black text-sky-400">
                  {summary.totalSalesAmount.toLocaleString()} د.ع
                </span>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
                <span className="text-[11px] text-slate-400 font-bold block mb-1">إجمالي الوارد (شراء)</span>
                <span className="text-xl font-black text-amber-400">
                  {summary.totalInAmount.toLocaleString()} د.ع
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <h4 className="text-xs font-black text-white">إحصائيات إضافية:</h4>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-slate-950 rounded-xl">
                  <span className="text-slate-400 block mb-1">عدد المواد المعرفة:</span>
                  <span className="text-lg font-black text-white">{summary.totalItemsCount} مادة</span>
                </div>
                <div className="p-3 bg-slate-950 rounded-xl">
                  <span className="text-slate-400 block mb-1">المواد التي اقترب نفاذها:</span>
                  <span className="text-lg font-black text-amber-400">{summary.lowStockCount} مادة</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 5: PIN SETTINGS                                          */}
        {/* ============================================================ */}
        {activeTab === 'SETTINGS' && (
          <div className="h-full p-4 overflow-y-auto max-w-md mx-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <KeyRound className="w-6 h-6 text-emerald-400" />
                <h3 className="text-base font-black text-white">تغيير رمز PIN السري</h3>
              </div>

              {pinChangeMsg && (
                <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-bold text-center">
                  {pinChangeMsg}
                </div>
              )}

              <form onSubmit={handleChangePin} className="space-y-4 text-xs font-bold">
                <div>
                  <label className="block text-slate-400 mb-1">رمز PIN الحالي:</label>
                  <input
                    type="password"
                    value={currentPinChange}
                    onChange={(e) => setCurrentPinChange(e.target.value)}
                    placeholder="••••"
                    required
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-base text-center tracking-widest focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">رمز PIN الجديد (4 أرقام على الأقل):</label>
                  <input
                    type="password"
                    value={newPinChange}
                    onChange={(e) => setNewPinChange(e.target.value)}
                    placeholder="••••"
                    required
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-base text-center tracking-widest focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl transition-all cursor-pointer shadow-md"
                >
                  تحديث الرمز السري
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* MODAL: ADD / EDIT SECRET ITEM                                */}
      {/* ============================================================ */}
      {showItemModal && editingItem && (
        <div className="fixed inset-0 z-100000 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 max-w-lg w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-white">
                {editingItem.id ? 'تعديل مادة في المخزن السري' : 'إضافة مادة سرية جديدة'}
              </h3>
              <button
                onClick={() => setShowItemModal(false)}
                className="text-slate-500 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3 text-xs font-bold">
              <div>
                <label className="block text-slate-300 mb-1">اسم العلاج التجاري *:</label>
                <input
                  type="text"
                  required
                  value={editingItem.tradeName || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, tradeName: e.target.value })}
                  placeholder="مثلاً: دواء سري خاص 500 ملغ"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1">الباركود (اختياري):</label>
                  <input
                    type="text"
                    value={editingItem.barcode || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, barcode: e.target.value })}
                    placeholder="رقم الباركود"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">الاسم العلمي:</label>
                  <input
                    type="text"
                    value={editingItem.scientificName || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, scientificName: e.target.value })}
                    placeholder="الاسم العلمي"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1">التركيز (Strength):</label>
                  <input
                    type="text"
                    value={editingItem.strength || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, strength: e.target.value })}
                    placeholder="مثلاً: 500mg"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">الشكل الصيدلاني:</label>
                  <input
                    type="text"
                    value={editingItem.dosageForm || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, dosageForm: e.target.value })}
                    placeholder="حبوب / حقن / شراب"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1">سعر الشراء (التكلفة):</label>
                  <input
                    type="number"
                    value={editingItem.purchasePrice || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, purchasePrice: Number(e.target.value) })}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">سعر البيع:</label>
                  <input
                    type="number"
                    value={editingItem.sellingPrice || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, sellingPrice: Number(e.target.value) })}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-emerald-400 font-black focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1">الرصيد الابتدائي بالمخزن:</label>
                  <input
                    type="number"
                    value={editingItem.quantity ?? ''}
                    onChange={(e) => setEditingItem({ ...editingItem, quantity: Number(e.target.value) })}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">تاريخ النفاذ:</label>
                  <input
                    type="date"
                    value={editingItem.expiryDate ? editingItem.expiryDate.split('T')[0] : ''}
                    onChange={(e) => setEditingItem({ ...editingItem, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1">ملاحظات سرية:</label>
                <textarea
                  value={editingItem.notes || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, notes: e.target.value })}
                  placeholder="أي تفاصيل خاصة..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingItem}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {savingItem ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>حفظ المادة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: QUICK IN / OUT MOVEMENT                               */}
      {/* ============================================================ */}
      {showQuickMovementModal && movementItem && (
        <div className="fixed inset-0 z-100000 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-white rounded-3xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-white">
                {movementType === 'IN' ? 'تسجيل وارد جديد 📥' : 'تسجيل صادر / إتلاف 📤'}
              </h3>
              <button
                onClick={() => setShowQuickMovementModal(false)}
                className="text-slate-500 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl mb-3 border border-slate-800">
              <h4 className="text-xs font-black text-white">{movementItem.tradeName}</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">الرصيد الحالي بالمخزن: {movementItem.quantity}</p>
            </div>

            <form onSubmit={handleSaveMovement} className="space-y-3 text-xs font-bold">
              <div>
                <label className="block text-slate-300 mb-1">الكمية *:</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={movementQty}
                  onChange={(e) => setMovementQty(Number(e.target.value) || '')}
                  placeholder="أدخل الكمية"
                  autoFocus
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-base font-black text-center focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              {movementType === 'IN' && (
                <div>
                  <label className="block text-slate-300 mb-1">سعر الشراء للوحدة (د.ع):</label>
                  <input
                    type="number"
                    value={movementPrice}
                    onChange={(e) => setMovementPrice(Number(e.target.value) || '')}
                    placeholder={movementItem.purchasePrice.toString()}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-center focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-300 mb-1">
                  {movementType === 'IN' ? 'المصدر / المورد:' : 'السبب / الجهة المستلمة:'}
                </label>
                <input
                  type="text"
                  value={movementSource}
                  onChange={(e) => setMovementSource(e.target.value)}
                  placeholder={movementType === 'IN' ? 'اسم المصدر أو المورد' : 'إتلاف، سحب شخصي...'}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">ملاحظات:</label>
                <input
                  type="text"
                  value={movementNotes}
                  onChange={(e) => setMovementNotes(e.target.value)}
                  placeholder="ملاحظة إضافية..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickMovementModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingMovement || !movementQty}
                  className={`px-5 py-2 font-black rounded-xl text-white transition-all cursor-pointer flex items-center gap-1.5 ${
                    movementType === 'IN' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {savingMovement ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>{movementType === 'IN' ? 'تأكيد الوارد' : 'تأكيد الصادر'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
