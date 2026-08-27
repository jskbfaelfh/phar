import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  PackagePlus,
  Package,
  TrendingUp,
  ShieldCheck,
  Search,
  LogOut,
  Building2,
  AlertTriangle,
  Pill,
  UserCheck,
  Settings,
  Banknote,
} from 'lucide-react';
import { PosView } from './views/PosView';
import { BulkStockEntryView } from './views/BulkStockEntryView';
import { InventoryView } from './views/InventoryView';
import { ReportsView } from './views/ReportsView';
import { SuperAdminView } from './views/SuperAdminView';
import { PublicSearchView } from './views/PublicSearchView';
import { PharmacyProfileView } from './views/PharmacyProfileView';
import { SuppliersDebtView } from './views/SuppliersDebtView';
import { LoginView } from './views/LoginView';
import {
  getAuthToken,
  getStoredUser,
  getStoredPharmacy,
  clearAuthToken,
} from './api/client';

type ActiveTab =
  | 'POS'
  | 'BULK_STOCK'
  | 'INVENTORY'
  | 'SUPPLIERS'
  | 'REPORTS'
  | 'PROFILE'
  | 'ADMIN'
  | 'PUBLIC_SEARCH'
  | 'LOGIN';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any | null>(getStoredUser());
  const [currentPharmacy, setCurrentPharmacy] = useState<any | null>(getStoredPharmacy());
  const [activeTab, setActiveTab] = useState<ActiveTab>('PUBLIC_SEARCH');

  // If token exists on first load, switch to POS or Admin
  useEffect(() => {
    const token = getAuthToken();
    if (token && currentUser) {
      if (currentUser.role === 'SUPER_ADMIN') {
        setActiveTab('ADMIN');
      } else {
        setActiveTab('POS');
      }
    }
  }, []);

  const handleLoginSuccess = (user: any, pharmacy?: any) => {
    setCurrentUser(user);
    setCurrentPharmacy(pharmacy || null);

    if (user.role === 'SUPER_ADMIN') {
      setActiveTab('ADMIN');
    } else {
      setActiveTab('POS');
    }
  };

  const handleLogout = () => {
    clearAuthToken();
    setCurrentUser(null);
    setCurrentPharmacy(null);
    setActiveTab('LOGIN');
  };

  // If viewing public search screen
  if (activeTab === 'PUBLIC_SEARCH') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* Public Navigation */}
        <header className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500 text-white rounded-xl flex items-center justify-center font-black">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <span className="font-black text-lg tracking-tight text-white">دوائي</span>
              <span className="text-[10px] text-emerald-400 font-bold mr-1.5 px-1.5 py-0.5 bg-emerald-950/60 rounded">
                شبكة البحث
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <button
                onClick={() => setActiveTab(currentUser.role === 'SUPER_ADMIN' ? 'ADMIN' : 'POS')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                العودة للوحة التحكم
              </button>
            ) : (
              <button
                onClick={() => setActiveTab('LOGIN')}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                دخول الصيدليات / الإدارة
              </button>
            )}
          </div>
        </header>

        <PublicSearchView />
      </div>
    );
  }

  // If viewing Login screen
  if (activeTab === 'LOGIN' && !currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Top Main Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
          {/* Logo & Pharmacy Name */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              {currentPharmacy?.logoUrl ? (
                <img
                  src={currentPharmacy.logoUrl}
                  alt="Logo"
                  className="w-9 h-9 rounded-xl object-contain bg-white border border-slate-200 p-0.5 shadow-xs"
                />
              ) : (
                <div className="w-9 h-9 bg-emerald-600 text-white rounded-xl flex items-center justify-center font-black shadow-xs">
                  <Pill className="w-5 h-5" />
                </div>
              )}
              <div>
                <span className="font-black text-lg text-slate-900">دوائي</span>
                <span className="text-[10px] font-bold text-slate-400 mr-1 font-mono">POS</span>
              </div>
            </div>

            {/* Current Pharmacy Badge */}
            {currentPharmacy && (
              <div className="hidden md:flex items-center gap-2 pr-4 border-r border-slate-200">
                <Building2 className="w-4 h-4 text-slate-400" />
                <span className="font-bold text-xs text-slate-800">{currentPharmacy.name}</span>
                {currentPharmacy.subscriptionStatus === 'EXPIRED' && (
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-extrabold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    وضع القراءة فقط (انتهى الاشتراك)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1">
            {currentUser?.role === 'SUPER_ADMIN' ? (
              <button
                onClick={() => setActiveTab('ADMIN')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'ADMIN'
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                الإدارة
              </button>
            ) : (
              <>
                <button
                  onClick={() => setActiveTab('POS')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'POS'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <ShoppingCart className="w-4 h-4" />
                  الكاشير
                </button>

                <button
                  onClick={() => setActiveTab('BULK_STOCK')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'BULK_STOCK'
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <PackagePlus className="w-4 h-4" />
                  إدخال وجبة
                </button>

                <button
                  onClick={() => setActiveTab('INVENTORY')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    activeTab === 'INVENTORY'
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  المخزون
                </button>

                {currentUser?.role === 'OWNER' && (
                  <button
                    onClick={() => setActiveTab('SUPPLIERS')}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'SUPPLIERS'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    المذاخر
                  </button>
                )}

                {currentUser?.role === 'OWNER' && (
                  <button
                    onClick={() => setActiveTab('REPORTS')}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'REPORTS'
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <TrendingUp className="w-4 h-4" />
                    التقارير
                  </button>
                )}

                {currentUser?.role === 'OWNER' && (
                  <button
                    onClick={() => setActiveTab('PROFILE')}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      activeTab === 'PROFILE'
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    الإعدادات
                  </button>
                )}
              </>
            )}

            {/* Public Search Button */}
            <button
              onClick={() => setActiveTab('PUBLIC_SEARCH')}
              className="flex items-center gap-1.5 px-3 py-2 text-slate-500 hover:text-slate-800 text-xs font-bold hover:bg-slate-50 rounded-xl transition-colors mr-2 cursor-pointer"
              title="صفحة البحث المفتوحة للجمهور"
            >
              <Search className="w-4 h-4" />
              البحث
            </button>
          </nav>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (currentUser?.role === 'OWNER') {
                  setActiveTab('PROFILE');
                }
              }}
              className={`text-left pl-2 hidden sm:flex items-center gap-2 p-1.5 rounded-xl transition-colors ${
                currentUser?.role === 'OWNER' ? 'hover:bg-slate-100 cursor-pointer' : ''
              }`}
              title={currentUser?.role === 'OWNER' ? 'فتح الملف الشخصي وإعدادات الصيدلية' : ''}
            >
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">{currentUser?.name || 'مستخدم'}</div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {currentUser?.role === 'OWNER' ? 'صاحب الصيدلية' : currentUser?.role === 'SUPER_ADMIN' ? 'المدير العام' : 'كاشير'}
                </div>
              </div>
            </button>

            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full px-4 py-5 flex-1">
        {activeTab === 'POS' && <PosView />}
        {activeTab === 'BULK_STOCK' && <BulkStockEntryView />}
        {activeTab === 'INVENTORY' && <InventoryView />}
        {activeTab === 'SUPPLIERS' && <SuppliersDebtView />}
        {activeTab === 'REPORTS' && <ReportsView />}
        {activeTab === 'PROFILE' && <PharmacyProfileView />}
        {activeTab === 'ADMIN' && <SuperAdminView />}
      </main>
    </div>
  );
};

export default App;
