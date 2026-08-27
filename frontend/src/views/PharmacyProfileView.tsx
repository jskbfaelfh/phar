import React, { useState, useEffect } from 'react';
import {
  Building2,
  Key,
  Users,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Save,
  Plus,
  Trash2,
  Receipt,
  X,
  RefreshCw,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { IRAQ_LOCATIONS, type GovernorateData } from '../data/iraq-locations';

export const PharmacyProfileView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState<any | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Pharmacy details form
  const [pharmacyForm, setPharmacyForm] = useState({
    name: '',
    phone: '',
    governorate: 'بغداد',
    district: 'اليرموك',
    addressDetails: '',
    googleMapsUrl: '',
    logoUrl: '',
    receiptHeader: '',
    receiptFooter: '',
  });

  // Owner password form
  const [ownerPasswordForm, setOwnerPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Cashier Modals
  const [showAddCashierModal, setShowAddCashierModal] = useState(false);
  const [newCashierForm, setNewCashierForm] = useState({ name: '', username: '', password: '' });

  const [resetCashierItem, setResetCashierItem] = useState<any | null>(null);
  const [cashierNewPassword, setCashierNewPassword] = useState('');

  // Load Profile
  const fetchProfile = async () => {
    setLoading(true);
    try {
      const data = await apiRequest<any>('/pharmacy/profile');
      setProfileData(data);
      if (data?.pharmacy) {
        setPharmacyForm({
          name: data.pharmacy.name || '',
          phone: data.pharmacy.phone || '',
          governorate: data.pharmacy.governorate || 'بغداد',
          district: data.pharmacy.district || 'اليرموك',
          addressDetails: data.pharmacy.addressDetails || '',
          googleMapsUrl: data.pharmacy.googleMapsUrl || '',
          logoUrl: data.pharmacy.logoUrl || '',
          receiptHeader: data.pharmacy.receiptHeader || '',
          receiptFooter: data.pharmacy.receiptFooter || '',
        });
      }
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'فشل تحميل بيانات الملف الشخصي' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Handle Logo Upload via file
  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 2 ميغابايت');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPharmacyForm((prev) => ({ ...prev, logoUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  // Save Pharmacy Info & Logo
  const handleSavePharmacyInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await apiRequest<any>('/pharmacy/profile', {
        method: 'PATCH',
        body: JSON.stringify(pharmacyForm),
      });

      setMessage({ type: 'success', text: res.message || 'تم حفظ بيانات وشعار الصيدلية بنجاح' });
      fetchProfile();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'فشل حفظ بيانات الصيدلية' });
    } finally {
      setSaving(false);
    }
  };

  // Save Owner Password Change
  const handleChangeOwnerPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ownerPasswordForm.newPassword !== ownerPasswordForm.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'كلمة المرور الجديدة وتأكيدها غير متطابقين' });
      return;
    }

    try {
      const res = await apiRequest<any>('/pharmacy/profile/owner-password', {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword: ownerPasswordForm.currentPassword,
          newPassword: ownerPasswordForm.newPassword,
        }),
      });

      setPasswordMessage({ type: 'success', text: res.message || 'تم تغيير كلمة المرور بنجاح' });
      setOwnerPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setPasswordMessage({ type: 'error', text: err.message || 'فشل تغيير كلمة المرور' });
    }
  };

  // Add Cashier
  const handleCreateCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/pharmacy/profile/cashiers', {
        method: 'POST',
        body: JSON.stringify(newCashierForm),
      });

      setShowAddCashierModal(false);
      setNewCashierForm({ name: '', username: '', password: '' });
      fetchProfile();
    } catch (err: any) {
      alert(err.message || 'فشل إضافة الكاشير');
    }
  };

  // Reset Cashier Password
  const handleResetCashierPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetCashierItem) return;

    try {
      await apiRequest(`/pharmacy/profile/cashiers/${resetCashierItem.id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ newPassword: cashierNewPassword }),
      });

      alert(`تم تغيير كلمة مرور الكاشير (${resetCashierItem.name}) بنجاح`);
      setResetCashierItem(null);
      setCashierNewPassword('');
    } catch (err: any) {
      alert(err.message || 'فشل تغيير كلمة المرور');
    }
  };

  // Delete Cashier
  const handleDeleteCashier = async (cashierId: string, cashierName: string) => {
    if (!confirm(`هل أنت متأكد من حذف حساب الكاشير (${cashierName})؟`)) return;

    try {
      await apiRequest(`/pharmacy/profile/cashiers/${cashierId}`, {
        method: 'DELETE',
      });
      fetchProfile();
    } catch (err: any) {
      alert(err.message || 'فشل حذف الكاشير');
    }
  };

  const selectedGovObj = IRAQ_LOCATIONS.find((g: GovernorateData) => g.name === pharmacyForm.governorate);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex items-center gap-2 text-slate-500 font-bold text-sm">
          <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
          جاري تحميل بيانات الملف الشخصي...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-20 max-w-6xl mx-auto">
      {/* Top Banner & Subscription Status */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center overflow-hidden shadow-xs">
            {pharmacyForm.logoUrl ? (
              <img src={pharmacyForm.logoUrl} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              <Building2 className="w-8 h-8 text-indigo-600" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900">{profileData?.pharmacy?.name}</h1>
              <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-black">
                {profileData?.pharmacy?.subscriptionStatus === 'ACTIVE' ? 'اشتراك نشط' : 'منتهي'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-bold mt-1 flex items-center gap-2">
              <span>المعرف (Slug): <span className="font-mono text-slate-700 font-extrabold">{profileData?.pharmacy?.slug}</span></span>
              <span>•</span>
              <span>المدير: <span className="text-indigo-700 font-extrabold">{profileData?.owner?.name}</span></span>
            </p>
          </div>
        </div>

        {/* License & Days Remaining Badge */}
        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-right">
          <div className="text-[11px] font-bold text-slate-500">رقم الترخيص (License Key)</div>
          <div className="text-xs font-mono font-black text-slate-900">{profileData?.pharmacy?.licenseKey}</div>
          <div className="text-[11px] font-bold text-indigo-700 mt-1">
            متبقي {profileData?.pharmacy?.daysRemaining} يوماً على التجديد
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-2xl flex items-center gap-2 text-sm font-bold shadow-xs ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600" />
          )}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Logo & Visual Identity */}
        <div className="lg:col-span-1 space-y-6">
          {/* 1. Pharmacy Logo Box */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
            <h3 className="font-black text-slate-900 text-base flex items-center gap-2 mb-3">
              <ImageIcon className="w-5 h-5 text-indigo-600" />
              شعار الصيدلية (Logo)
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              يظهر الشعار في رأس النظام، وأعلى الفواتير المطبوعة للكاشير، وفي البحث العام.
            </p>

            {/* Logo Preview Area */}
            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl mb-4 relative">
              {pharmacyForm.logoUrl ? (
                <div className="relative group">
                  <img
                    src={pharmacyForm.logoUrl}
                    alt="Pharmacy Logo"
                    className="w-32 h-32 object-contain rounded-xl bg-white shadow-xs p-2 border border-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => setPharmacyForm((prev) => ({ ...prev, logoUrl: '' }))}
                    className="absolute -top-2 -right-2 p-1.5 bg-rose-600 text-white rounded-full shadow-md hover:bg-rose-700 cursor-pointer"
                    title="حذف الشعار"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <ImageIcon className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                  <span className="text-xs font-bold text-slate-600 block">لا يوجد شعار مخصص</span>
                  <span className="text-[10px] text-slate-400">PNG أو JPG (بحد أقصى 2MB)</span>
                </div>
              )}
            </div>

            {/* Upload Button */}
            <label className="block w-full text-center py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-black cursor-pointer transition-colors mb-2">
              <span>{pharmacyForm.logoUrl ? '🔄 تغيير صورة الشعار' : '📁 رفع صورة الشعار من الجهاز'}</span>
              <input type="file" accept="image/*" onChange={handleLogoFileUpload} className="hidden" />
            </label>

            {/* Receipt Header & Footer Customization */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <h4 className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-slate-600" />
                تخصيص الفاتورة المطبوعة (Thermal Receipt)
              </h4>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">نص الترويسة (أعلى الفاتورة)</label>
                <input
                  type="text"
                  value={pharmacyForm.receiptHeader}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, receiptHeader: e.target.value })}
                  placeholder="مثال: صيدلية اليرموك - د. علي"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">نص التذييل (أسفل الفاتورة)</label>
                <textarea
                  rows={2}
                  value={pharmacyForm.receiptFooter}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, receiptFooter: e.target.value })}
                  placeholder="مثال: نتمنى لكم الشفاء العاجل • الأدوية المباعة لا ترد ولا تستبدل"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Pharmacy Info Form & Staff Management */}
        <div className="lg:col-span-2 space-y-6">
          {/* 2. Pharmacy Info & Location Form */}
          <form onSubmit={handleSavePharmacyInfo} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-black text-slate-900 text-base flex items-center gap-2 pb-3 border-b border-slate-100">
              <Building2 className="w-5 h-5 text-indigo-600" />
              بيانات وموقع الصيدلية
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الصيدلية *</label>
                <input
                  type="text"
                  required
                  value={pharmacyForm.name}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, name: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم هاتف الصيدلية</label>
                <input
                  type="text"
                  value={pharmacyForm.phone}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, phone: e.target.value })}
                  placeholder="07701234567"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold"
                />
              </div>
            </div>

            {/* Governorate & District */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المحافظة</label>
                <select
                  value={pharmacyForm.governorate}
                  onChange={(e) => {
                    const gName = e.target.value;
                    const found = IRAQ_LOCATIONS.find((item: GovernorateData) => item.name === gName);
                    setPharmacyForm({
                      ...pharmacyForm,
                      governorate: gName,
                      district: found ? found.districts[0] : '',
                    });
                  }}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold"
                >
                  {IRAQ_LOCATIONS.map((g: GovernorateData) => (
                    <option key={g.name} value={g.name}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المنطقة / القضاء</label>
                <select
                  value={pharmacyForm.district}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, district: e.target.value })}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold"
                >
                  {selectedGovObj?.districts.map((d: string) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Address Details & Google Maps */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">العنوان التفصيلي ونقطة دالة</label>
                <input
                  type="text"
                  value={pharmacyForm.addressDetails}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, addressDetails: e.target.value })}
                  placeholder="مثال: شارع المشجر - قرب جامع النور"
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رابط خرائط جوجل (Google Maps)</label>
                <input
                  type="text"
                  value={pharmacyForm.googleMapsUrl}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, googleMapsUrl: e.target.value })}
                  placeholder="https://maps.app.goo.gl/..."
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer transition-all active:scale-95"
            >
              <Save className="w-4 h-4" />
              {saving ? 'جاري الحفظ...' : 'حفظ تعديلات الصيدلية والشعار'}
            </button>
          </form>

          {/* 3. Owner Password Change Form */}
          <form onSubmit={handleChangeOwnerPassword} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-black text-slate-900 text-base flex items-center gap-2 pb-3 border-b border-slate-100">
              <Key className="w-5 h-5 text-indigo-600" />
              أمان حساب صاحب الصيدلية ({profileData?.owner?.name})
            </h3>

            {passwordMessage && (
              <div
                className={`p-3 rounded-xl flex items-center gap-2 text-xs font-bold ${
                  passwordMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {passwordMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                )}
                {passwordMessage.text}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور الحالية *</label>
                <input
                  type="password"
                  required
                  value={ownerPasswordForm.currentPassword}
                  onChange={(e) => setOwnerPasswordForm({ ...ownerPasswordForm, currentPassword: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور الجديدة *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={ownerPasswordForm.newPassword}
                  onChange={(e) => setOwnerPasswordForm({ ...ownerPasswordForm, newPassword: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تأكيد كلمة المرور الجديدة *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={ownerPasswordForm.confirmPassword}
                  onChange={(e) => setOwnerPasswordForm({ ...ownerPasswordForm, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-all"
            >
              تحديث كلمة المرور الشخصية
            </button>
          </form>

          {/* 4. Cashiers & Staff Management */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                كادر وموظفو الكاشير ({profileData?.cashiers?.length || 0})
              </h3>
              <button
                onClick={() => setShowAddCashierModal(true)}
                className="flex items-center gap-1 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                إضافة كاشير جديد
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100/75 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">اسم الكاشير</th>
                    <th className="p-3">اسم المستخدم (Username)</th>
                    <th className="p-3">تاريخ الإنشاء</th>
                    <th className="p-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {profileData?.cashiers?.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-400 font-bold">
                        لا يوجد حساب كاشير مضاف حالياً. اضغط على "إضافة كاشير جديد" بالأعلى لإنشاء حساب.
                      </td>
                    </tr>
                  ) : (
                    profileData?.cashiers?.map((cashier: any) => (
                      <tr key={cashier.id} className="hover:bg-slate-50/70">
                        <td className="p-3 font-bold text-slate-900">{cashier.name}</td>
                        <td className="p-3 font-mono font-bold text-indigo-700">{cashier.username}</td>
                        <td className="p-3 text-slate-500">{new Date(cashier.createdAt).toLocaleDateString('ar-IQ')}</td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setResetCashierItem(cashier);
                                setCashierNewPassword('');
                              }}
                              className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-bold text-xs flex items-center gap-1 cursor-pointer"
                            >
                              <Key className="w-3 h-3 text-slate-500" />
                              تغيير كلمة المرور
                            </button>
                            <button
                              onClick={() => handleDeleteCashier(cashier.id, cashier.name)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                              title="حذف حساب الكاشير"
                            >
                              <Trash2 className="w-4 h-4" />
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
        </div>
      </div>

      {/* Add Cashier Modal */}
      {showAddCashierModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">إضافة كاشير جديد</h3>
              <button onClick={() => setShowAddCashierModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCashier} className="space-y-3 mt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الكاشير *</label>
                <input
                  type="text"
                  required
                  value={newCashierForm.name}
                  onChange={(e) => setNewCashierForm({ ...newCashierForm, name: e.target.value })}
                  placeholder="مثال: أحمد مصطفى"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المستخدم (Username) *</label>
                <input
                  type="text"
                  required
                  value={newCashierForm.username}
                  onChange={(e) => setNewCashierForm({ ...newCashierForm, username: e.target.value.toLowerCase().trim() })}
                  placeholder="مثال: ahmed_pos"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newCashierForm.password}
                  onChange={(e) => setNewCashierForm({ ...newCashierForm, password: e.target.value })}
                  placeholder="******"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  إنشاء الحساب
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddCashierModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Cashier Password Modal */}
      {resetCashierItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">تغيير كلمة مرور الكاشير</h3>
              <button onClick={() => setResetCashierItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 my-3">
              تغيير كلمة المرور للكاشير: <span className="font-bold text-slate-900">{resetCashierItem.name}</span>
            </p>

            <form onSubmit={handleResetCashierPassword} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">كلمة المرور الجديدة *</label>
                <input
                  type="text"
                  required
                  minLength={6}
                  value={cashierNewPassword}
                  onChange={(e) => setCashierNewPassword(e.target.value)}
                  placeholder="اكتب كلمة مرور جديدة"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-mono font-bold"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  حفظ كلمة المرور
                </button>
                <button
                  type="button"
                  onClick={() => setResetCashierItem(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
