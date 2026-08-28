import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Building2,
  Plus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Sparkles,
  UserCheck,
  Copy,
  Check,
  Edit,
  Trash2,
  MapPin,
  Phone,
  KeyRound,
  Users,
  Lock,
  Cloud,
  Play,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { IRAQ_LOCATIONS } from '../data/iraq-locations';

export const SuperAdminView: React.FC = () => {
  const [dashboard, setDashboard] = useState<any | null>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAdminTab, setActiveAdminTab] = useState<'tenants' | 'backups'>('tenants');

  // Backups Monitoring States
  const [backupReport, setBackupReport] = useState<any | null>(null);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [runningBackupJob, setRunningBackupJob] = useState(false);
  const [showR2ConfigModal, setShowR2ConfigModal] = useState(false);
  const [r2ConfigTenant, setR2ConfigTenant] = useState<any | null>(null);
  const [r2ConfigForm, setR2ConfigForm] = useState({
    r2BucketName: '',
    r2AccountId: '',
    r2AccessKeyId: '',
    r2SecretAccessKey: '',
  });
  const [savingR2Config, setSavingR2Config] = useState(false);

  // Master R2 Settings State
  const [showMasterR2Modal, setShowMasterR2Modal] = useState(false);
  const [masterR2Form, setMasterR2Form] = useState({
    r2BucketName: 'dawaee-backups',
    r2AccountId: '',
    r2AccessKeyId: '',
    r2SecretAccessKey: '',
  });
  const [savingMasterR2, setSavingMasterR2] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<any | null>(null);
  const [deleteConfirmTenant, setDeleteConfirmTenant] = useState<any | null>(null);
  const [newPharmacyResult, setNewPharmacyResult] = useState<any | null>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Accounts & Password Reset Modal State
  const [showAccountsModal, setShowAccountsModal] = useState(false);
  const [accountsPharmacy, setAccountsPharmacy] = useState<any | null>(null);
  const [pharmacyUsers, setPharmacyUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<any | null>(null);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetSuccessModal, setResetSuccessModal] = useState<any | null>(null);

  // Add Form State
  const [form, setForm] = useState({
    name: '',
    slug: '',
    governorate: 'بغداد',
    district: 'المنصور',
    customDistrict: '',
    addressDetails: '',
    googleMapsUrl: '',
    phone: '',
    subscriptionMonths: 12,
    ownerName: '',
    ownerUsername: '',
    ownerPassword: '',
    createCashier: true,
  });

  // Edit Form State
  const [editForm, setEditForm] = useState({
    name: '',
    governorate: 'بغداد',
    district: 'المنصور',
    customDistrict: '',
    addressDetails: '',
    googleMapsUrl: '',
    phone: '',
    subscriptionStatus: 'ACTIVE',
    subscriptionEndsAt: '',
  });

  const [isCustomDistrict, setIsCustomDistrict] = useState(false);
  const [isEditCustomDistrict, setIsEditCustomDistrict] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dash, list] = await Promise.all([
        apiRequest<any>('/admin/dashboard'),
        apiRequest<any[]>('/admin/tenants'),
      ]);
      setDashboard(dash);
      setTenants(list);
    } catch (err: any) {
      console.error(err);
      setMessage({ type: 'error', text: err.message || 'فشل تحميل بيانات الإدارة' });
    } finally {
      setLoading(false);
    }
  };

  const fetchBackupsData = async () => {
    setLoadingBackups(true);
    try {
      const data = await apiRequest<any>('/admin/backups/status');
      setBackupReport(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchBackupsData();
  }, []);

  const handleRunBackupJob = async () => {
    if (!confirm('هل تريد تشغيل عملية النسخ السحابي اليومي الآن لكافة الصيدليات؟')) return;
    setRunningBackupJob(true);
    setMessage(null);
    try {
      const res = await apiRequest<any>('/admin/backups/run-job', { method: 'POST' });
      setMessage({
        type: 'success',
        text: `تم اكتمال النسخ السحابي! الناجحة: ${res.successful} من أصل ${res.total}`,
      });
      fetchBackupsData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'فشل تشغيل النسخ السحابي' });
    } finally {
      setRunningBackupJob(false);
    }
  };

  const openR2ConfigModal = (tenant: any) => {
    setR2ConfigTenant(tenant);
    setR2ConfigForm({
      r2BucketName: tenant.r2BucketName || '',
      r2AccountId: tenant.r2AccountId || '',
      r2AccessKeyId: tenant.r2AccessKeyId || '',
      r2SecretAccessKey: '',
    });
    setShowR2ConfigModal(true);
  };

  const handleSaveR2Config = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!r2ConfigTenant) return;
    setSavingR2Config(true);
    try {
      await apiRequest(`/admin/tenants/${r2ConfigTenant.id}/r2-config`, {
        method: 'PATCH',
        body: JSON.stringify(r2ConfigForm),
      });
      setMessage({ type: 'success', text: `تم حفظ إعدادات Cloudflare R2 لصيدلية (${r2ConfigTenant.name})` });
      setShowR2ConfigModal(false);
      fetchBackupsData();
      fetchData();
    } catch (err: any) {
      alert(err.message || 'فشل حفظ إعدادات R2');
    } finally {
      setSavingR2Config(false);
    }
  };

  const openMasterR2Modal = () => {
    if (backupReport?.masterR2) {
      setMasterR2Form({
        r2BucketName: backupReport.masterR2.r2BucketName || 'dawaee-backups',
        r2AccountId: backupReport.masterR2.r2AccountId || '',
        r2AccessKeyId: backupReport.masterR2.r2AccessKeyId || '',
        r2SecretAccessKey: '',
      });
    }
    setShowMasterR2Modal(true);
  };

  const handleSaveMasterR2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMasterR2(true);
    try {
      await apiRequest('/admin/settings/master-r2', {
        method: 'POST',
        body: JSON.stringify(masterR2Form),
      });
      setMessage({ type: 'success', text: 'تم حفظ وتفعيل إعدادات Cloudflare R2 المركزية للنظام بنجاح' });
      setShowMasterR2Modal(false);
      fetchBackupsData();
    } catch (err: any) {
      alert(err.message || 'فشل حفظ إعدادات R2 المركزية');
    } finally {
      setSavingMasterR2(false);
    }
  };

  // Smart transliteration from Arabic name/title to clean English username
  const arabicToEnglishSlug = (text: string): string => {
    if (!text) return '';
    let str = text.trim();

    const isDoctor = /^(دكتور|د\.|د\s+|dr\.|dr\s+)/i.test(str);
    str = str.replace(/^(دكتور|د\.|د\s+|dr\.|dr\s+)/i, '');
    str = str.replace(/^(صيدلية|صيدليه)/i, '');

    const nameMap: Record<string, string> = {
      'محمد': 'mohammed',
      'احمد': 'ahmed',
      'أحمد': 'ahmed',
      'علي': 'ali',
      'مصطفى': 'mustafa',
      'عمر': 'omar',
      'عثمان': 'othman',
      'حسين': 'hussein',
      'حسن': 'hassan',
      'حيدر': 'haider',
      'كرار': 'karrar',
      'سجاد': 'sajjad',
      'يوسف': 'yousef',
      'مهدي': 'mahdi',
      'سيف': 'saif',
      'زيد': 'zaid',
      'عبدالله': 'abdullah',
      'عبد الله': 'abdullah',
      'عبدالرحمن': 'abdulrahman',
      'عبد الرحمن': 'abdulrahman',
      'نور': 'noor',
      'النور': 'noor',
      'اليرموك': 'yarmouk',
      'المنصور': 'mansour',
      'الكرادة': 'karrada',
      'الشفاء': 'shifa',
      'الامل': 'amal',
      'الأمل': 'amal',
      'الحياة': 'hayat',
      'طيبة': 'taiba',
      'مريم': 'maryam',
      'زينب': 'zainab',
      'فاطمة': 'fatima',
      'زهراء': 'zahraa',
      'سارة': 'sara',
      'هدى': 'huda',
      'كمال': 'kamal',
      'صالح': 'saleh',
      'جاسم': 'jassim',
      'كريم': 'kareem',
      'خالد': 'khalid',
      'صادق': 'sadiq',
      'باقر': 'baqir',
      'ماجد': 'majid',
      'سامر': 'samer',
      'بلال': 'bilal',
      'طارق': 'tariq',
      'ليث': 'laith',
      'غيث': 'ghaith',
      'جعفر': 'jaafar',
      'عباس': 'abbas',
      'سلمان': 'salman',
    };

    for (const [ar, en] of Object.entries(nameMap)) {
      const reg = new RegExp(ar, 'g');
      str = str.replace(reg, `_${en}_`);
    }

    const charMap: Record<string, string> = {
      'أ': 'a', 'إ': 'i', 'آ': 'a', 'ا': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th',
      'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z',
      'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'dh', 'ط': 't', 'ظ': 'z', 'ع': 'a',
      'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
      'ه': 'h', 'ة': 'a', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ء': '', 'ئ': 'e', 'ؤ': 'o',
      ' ': '_', '-': '_',
    };

    let result = '';
    for (const char of str) {
      if (charMap[char] !== undefined) {
        result += charMap[char];
      } else if (/[a-zA-Z0-9_]/.test(char)) {
        result += char;
      }
    }

    let clean = result.toLowerCase().replace(/_+/g, '_').replace(/^_|_$/g, '');
    if (isDoctor) {
      clean = `dr_${clean}`;
    }
    return clean;
  };

  const handleNameChange = (val: string) => {
    const derivedSlug = arabicToEnglishSlug(val) || 'pharmacy';
    setForm((prev) => ({
      ...prev,
      name: val,
      slug: `ph_${derivedSlug}`,
    }));
  };

  const handleOwnerNameChange = (val: string) => {
    const derivedUser = arabicToEnglishSlug(val);
    setForm((prev) => ({
      ...prev,
      ownerName: val,
      ownerUsername: derivedUser ? derivedUser : prev.ownerUsername,
    }));
  };

  const generateUsernameFromName = () => {
    const baseText = form.ownerName.trim() || form.name.trim();
    if (!baseText) {
      setForm((prev) => ({ ...prev, ownerUsername: `dr_owner_${Math.floor(10 + Math.random() * 90)}` }));
      return;
    }

    const clean = arabicToEnglishSlug(baseText);
    const randSuffix = Math.floor(10 + Math.random() * 90);
    const finalUsername = clean ? `${clean}_${randSuffix}` : `user_${randSuffix}`;
    setForm((prev) => ({ ...prev, ownerUsername: finalUsername }));
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const finalDistrict = isCustomDistrict ? form.customDistrict : form.district;

    try {
      const payload = {
        name: form.name,
        slug: form.slug || undefined,
        governorate: form.governorate,
        district: finalDistrict,
        addressDetails: form.addressDetails || undefined,
        googleMapsUrl: form.googleMapsUrl || undefined,
        phone: form.phone || undefined,
        subscriptionMonths: Number(form.subscriptionMonths),
        ownerName: form.ownerName,
        ownerUsername: form.ownerUsername,
        ownerPassword: form.ownerPassword,
        createCashier: form.createCashier,
      };

      const result = await apiRequest<any>('/admin/tenants', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setNewPharmacyResult(result);
      setShowAddModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'فشل إضافة الصيدلية');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (tenant: any) => {
    setEditingTenant(tenant);
    const govData = IRAQ_LOCATIONS.find((l) => l.name === tenant.governorate);
    const isKnownDistrict = govData?.districts.includes(tenant.district);

    setEditForm({
      name: tenant.name,
      governorate: tenant.governorate || 'بغداد',
      district: isKnownDistrict ? tenant.district : 'CUSTOM',
      customDistrict: isKnownDistrict ? '' : tenant.district,
      addressDetails: tenant.addressDetails || '',
      googleMapsUrl: tenant.googleMapsUrl || '',
      phone: tenant.phone === 'غير محدد' ? '' : tenant.phone || '',
      subscriptionStatus: tenant.subscriptionStatus,
      subscriptionEndsAt: tenant.subscriptionEndsAt ? tenant.subscriptionEndsAt.split('T')[0] : '',
    });

    setIsEditCustomDistrict(!isKnownDistrict);
    setShowEditModal(true);
  };

  const handleUpdateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTenant) return;
    setLoading(true);

    const finalDistrict = isEditCustomDistrict ? editForm.customDistrict : editForm.district;

    try {
      const payload = {
        name: editForm.name,
        governorate: editForm.governorate,
        district: finalDistrict,
        addressDetails: editForm.addressDetails || undefined,
        googleMapsUrl: editForm.googleMapsUrl || undefined,
        phone: editForm.phone || undefined,
        subscriptionStatus: editForm.subscriptionStatus,
        subscriptionEndsAt: editForm.subscriptionEndsAt || undefined,
      };

      await apiRequest(`/admin/tenants/${editingTenant.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      setMessage({ type: 'success', text: `تم تحديث بيانات (${editForm.name}) بنجاح` });
      setShowEditModal(false);
      setEditingTenant(null);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'فشل تحديث بيانات الصيدلية');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTenant = async () => {
    if (!deleteConfirmTenant) return;
    setLoading(true);

    try {
      await apiRequest(`/admin/tenants/${deleteConfirmTenant.id}`, {
        method: 'DELETE',
      });

      setMessage({ type: 'success', text: `تم حذف صيدلية (${deleteConfirmTenant.name}) وقاعدة بياناتها بالكامل` });
      setDeleteConfirmTenant(null);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'فشل حذف الصيدلية');
    } finally {
      setLoading(false);
    }
  };

  // Open Accounts Modal & Fetch Users
  const openAccountsModal = async (tenant: any) => {
    setAccountsPharmacy(tenant);
    setShowAccountsModal(true);
    setLoadingUsers(true);
    setResetTargetUser(null);
    setResetNewPassword('');

    try {
      const data = await apiRequest<any>(`/admin/tenants/${tenant.id}/users`);
      setPharmacyUsers(data.users || []);
    } catch (err: any) {
      alert(err.message || 'فشل جلب قائمة المستخدمين');
    } finally {
      setLoadingUsers(false);
    }
  };

  const generateRandomPassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789@#';
    let pass = '';
    for (let i = 0; i < 8; i++) {
      pass += chars[Math.floor(Math.random() * chars.length)];
    }
    setResetNewPassword(pass);
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountsPharmacy || !resetTargetUser || !resetNewPassword) return;

    try {
      await apiRequest(`/admin/tenants/${accountsPharmacy.id}/users/${resetTargetUser.id}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ newPassword: resetNewPassword }),
      });

      setResetSuccessModal({
        pharmacyName: accountsPharmacy.name,
        slug: accountsPharmacy.slug,
        userName: resetTargetUser.name,
        username: resetTargetUser.username,
        role: resetTargetUser.role,
        newPassword: resetNewPassword,
      });

      setResetTargetUser(null);
      setResetNewPassword('');
    } catch (err: any) {
      alert(err.message || 'فشل تغيير كلمة المرور');
    }
  };

  const extendSubscription = async (id: string, months: number = 12) => {
    try {
      await apiRequest(`/admin/tenants/${id}/subscription`, {
        method: 'PATCH',
        body: JSON.stringify({ extendMonths: months }),
      });
      setMessage({ type: 'success', text: `تم تجديد الاشتراك لمدة ${months} شهراً بنجاح` });
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await apiRequest(`/admin/tenants/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setMessage({ type: 'success', text: 'تم تحديث حالة الصيدلية' });
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const currentGovData = IRAQ_LOCATIONS.find((l) => l.name === form.governorate);
  const availableDistricts = currentGovData?.districts || [];

  const editGovData = IRAQ_LOCATIONS.find((l) => l.name === editForm.governorate);
  const editAvailableDistricts = editGovData?.districts || [];

  const copyAllCredentials = () => {
    if (!newPharmacyResult) return;
    const p = newPharmacyResult.tenant;
    const o = newPharmacyResult.ownerAccount;
    const c = newPharmacyResult.cashierAccount;

    let text = `🏥 *بيانات تفعيل صيدلية (${p.name})*\n\n` +
      `🌐 رابط الدخول: http://localhost:3000\n` +
      `🔑 معرف الصيدلية (Slug): ${p.slug}\n` +
      `📜 مفتاح الترخيص: ${p.licenseKey}\n\n` +
      `👤 *حساب المدير / المالك:*\n- اسم المستخدم: ${o.username}\n- كلمة المرور: ${o.password}\n\n`;

    if (c) {
      text += `🛒 *حساب الكاشير اليومي:*\n- اسم المستخدم: ${c.username}\n- كلمة المرور: ${c.password}\n`;
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const copyResetCredentials = () => {
    if (!resetSuccessModal) return;
    const r = resetSuccessModal;
    const text = `🔑 *بيانات الدخول الجديدة - صيدلية (${r.pharmacyName})*\n\n` +
      `🌐 رابط الدخول: http://localhost:3000\n` +
      `🏢 معرّف الصيدلية (Slug): ${r.slug}\n` +
      `👤 اسم المستخدم: ${r.username}\n` +
      `🔒 كلمة المرور الجديدة: ${r.newPassword}\n` +
      `💼 نوع الحساب: ${r.role === 'OWNER' ? 'مدير / صاحب الصيدلية' : 'كاشير'}\n`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Top Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-600" />
            لوحة الإدارة العليا (Super Admin)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            إدارة الصيدليات المشتركة، استرجاع وتعيين كلمات المرور، تعديل البيانات، وتجديد الاشتراكات.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          إضافة صيدلية جديدة
        </button>
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl flex items-center gap-2 text-sm font-bold ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
          {message.text}
        </div>
      )}

      {/* Navigation Tabs (1-2 Words Rule) */}
      <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl w-fit">
        <button
          onClick={() => setActiveAdminTab('tenants')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeAdminTab === 'tenants'
              ? 'bg-white text-indigo-950 shadow-xs'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4 text-indigo-600" />
          الصيدليات المشتركة
        </button>

        <button
          onClick={() => {
            setActiveAdminTab('backups');
            fetchBackupsData();
          }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeAdminTab === 'backups'
              ? 'bg-white text-indigo-950 shadow-xs'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Cloud className="w-4 h-4 text-sky-600" />
          النسخ السحابي
        </button>
      </div>

      {/* TAB 1: الصيدليات المشتركة */}
      {activeAdminTab === 'tenants' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          {dashboard && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-xs text-slate-500 font-bold">إجمالي الصيدليات</div>
                <div className="text-3xl font-black text-slate-900 mt-1">{dashboard.tenants.total}</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-xs text-emerald-700 font-bold">صيدليات باشتراك فعّال</div>
                <div className="text-3xl font-black text-emerald-700 mt-1">{dashboard.tenants.active}</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-xs text-rose-700 font-bold">اشتراكات منتهية (قراءة فقط)</div>
                <div className="text-3xl font-black text-rose-700 mt-1">{dashboard.tenants.expired}</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-xs text-indigo-700 font-bold">أدوية مفهرسة بالبحث العام</div>
                <div className="text-3xl font-black text-indigo-700 mt-1">{dashboard.catalog.totalActiveSearchItems}</div>
              </div>
            </div>
          )}

          {/* Pharmacies Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-600" />
                سجل الصيدليات ({tenants.length})
              </h2>
              <button onClick={fetchData} className="p-1 text-slate-500 hover:text-slate-800 cursor-pointer">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">اسم الصيدلية</th>
                    <th className="p-3">الموقع والهاتف</th>
                    <th className="p-3">مفتاح الترخيص (License)</th>
                    <th className="p-3">حالة الاشتراك</th>
                    <th className="p-3">تاريخ الانتهاء</th>
                    <th className="p-3 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tenants.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-slate-900 text-sm">{t.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">slug: {t.slug} • schema: {t.schemaName}</div>
                      </td>
                      <td className="p-3 text-slate-600">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          {t.governorate} — {t.district}
                        </div>
                        {t.addressDetails && (
                          <div className="text-[10px] text-slate-400 mt-0.5">{t.addressDetails}</div>
                        )}
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {t.phone || 'بدون هاتف'}
                        </div>
                      </td>
                      <td className="p-3 font-mono font-bold text-indigo-700 text-[11px]">
                        {t.licenseKey}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                            t.subscriptionStatus === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : t.subscriptionStatus === 'EXPIRED'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {t.subscriptionStatus === 'ACTIVE'
                            ? 'فعال'
                            : t.subscriptionStatus === 'EXPIRED'
                            ? 'منتهي (Read-Only)'
                            : 'معلق'}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 font-medium font-mono">
                        {t.subscriptionEndsAt ? new Date(t.subscriptionEndsAt).toLocaleDateString('ar-IQ') : '—'}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openAccountsModal(t)}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            title="الحسابات وتعيين كلمات المرور"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            الحسابات
                          </button>
                          <button
                            onClick={() => openEditModal(t)}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="تعديل بيانات الصيدلية"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => extendSubscription(t.id, 12)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="تجديد سنة"
                          >
                            <Sparkles className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleStatus(t.id, t.subscriptionStatus)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              t.subscriptionStatus === 'ACTIVE' ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={t.subscriptionStatus === 'ACTIVE' ? 'تعليق الاشتراك' : 'تفعيل'}
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmTenant(t)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="حذف الصيدلية نهائياً"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: النسخ السحابي (Cloudflare R2) */}
      {activeAdminTab === 'backups' && (
        <div className="space-y-6">
          {/* Top Backup KPI Cards */}
          {backupReport && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="text-xs text-slate-500 font-bold">إجمالي الصيدليات</div>
                <div className="text-3xl font-black text-slate-900 mt-1">
                  {backupReport.summary.totalPharmacies}
                </div>
              </div>

              <div className="bg-emerald-50/80 p-5 rounded-2xl border border-emerald-200 shadow-xs">
                <div className="text-xs text-emerald-800 font-bold flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  سليمة (آخر 24 ساعة)
                </div>
                <div className="text-3xl font-black text-emerald-900 mt-1">
                  {backupReport.summary.healthyCount}
                </div>
              </div>

              <div className="bg-amber-50/80 p-5 rounded-2xl border border-amber-200 shadow-xs">
                <div className="text-xs text-amber-800 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  متأخرة (1 - 3 أيام)
                </div>
                <div className="text-3xl font-black text-amber-900 mt-1">
                  {backupReport.summary.warningCount}
                </div>
              </div>

              <div className="bg-rose-50/80 p-5 rounded-2xl border border-rose-200 shadow-xs">
                <div className="text-xs text-rose-800 font-bold flex items-center gap-1">
                  <XCircle className="w-4 h-4 text-rose-600" />
                  حرجة (&gt; 3 أيام / بدون)
                </div>
                <div className="text-3xl font-black text-rose-900 mt-1">
                  {backupReport.summary.alertCount}
                </div>
              </div>
            </div>
          )}

          {/* Master R2 Settings Card */}
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-5 rounded-3xl text-white shadow-md flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-xs">
                <Cloud className="w-6 h-6 text-sky-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-sm">حساب Cloudflare R2 المركزي للنظام</h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                      backupReport?.masterR2?.isConfigured
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {backupReport?.masterR2?.isConfigured ? '🟢 متصل ومجهز' : '🔴 غير مجهز (انقر للضبط)'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  البوكت المركزي: <b className="text-sky-300 font-mono">{backupReport?.masterR2?.r2BucketName || 'dawaee-backups'}</b>
                  {backupReport?.masterR2?.r2AccountId && (
                    <span className="text-slate-400 font-mono text-[11px] mr-2">
                      (الحساب: {backupReport.masterR2.r2AccountId.slice(0, 8)}...)
                    </span>
                  )}
                  <span className="text-slate-400 text-[11px] mr-2">
                    • مسارات الحفظ: <code className="text-indigo-300">daily/</code> + <code className="text-indigo-300">monthly/</code>
                  </span>
                </p>
              </div>
            </div>

            <button
              onClick={openMasterR2Modal}
              className="px-4 py-2.5 bg-white hover:bg-slate-100 text-indigo-950 rounded-xl text-xs font-black shadow-xs transition-all active:scale-95 cursor-pointer whitespace-nowrap"
            >
              ضبط إعدادات R2 المركزية ⚙️
            </button>
          </div>

          {/* Action Toolbar */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Cloud className="w-5 h-5 text-sky-600" />
                مراقبة النسخ السحابي التلقائي (Cloudflare R2)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                نسخ معزول ومضغوط يومياً لكل صيدلية إلى بوكت النظام الرئيسي مع خيار الربط ببوكت الصيدلية الخاص.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={runningBackupJob}
                onClick={handleRunBackupJob}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Play className={`w-4 h-4 ${runningBackupJob ? 'animate-spin' : ''}`} />
                {runningBackupJob ? 'جاري النسخ الآن...' : 'تشغيل النسخ السحابي الآن'}
              </button>
              <button
                onClick={fetchBackupsData}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                title="تحديث"
              >
                <RefreshCw className={`w-4 h-4 ${loadingBackups ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Backups Status Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">اسم الصيدلية</th>
                    <th className="p-3">الموقع</th>
                    <th className="p-3">تاريخ آخر نسخة</th>
                    <th className="p-3 text-center">حالة النسخ</th>
                    <th className="p-3">حساب R2 المركزي</th>
                    <th className="p-3">حساب R2 الخاص بالصيدلية</th>
                    <th className="p-3 text-center">إعدادات R2</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(!backupReport?.pharmacies || backupReport.pharmacies.length === 0) ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 font-bold">
                        جاري تحميل بيانات النسخ السحابي...
                      </td>
                    </tr>
                  ) : (
                    backupReport.pharmacies.map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-slate-900 text-sm">{p.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">slug: {p.slug}</div>
                        </td>
                        <td className="p-3 text-slate-600 font-medium">
                          {p.governorate} — {p.district}
                        </td>
                        <td className="p-3">
                          {p.lastBackupAt ? (
                            <div>
                              <div className="font-bold text-slate-900">
                                {new Date(p.lastBackupAt).toLocaleString('ar-IQ')}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                قبل {p.hoursSinceLastBackup} ساعة
                              </div>
                            </div>
                          ) : (
                            <span className="text-rose-600 font-bold">لم تُسحب بعد</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                              p.health === 'HEALTHY'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : p.health === 'WARNING'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {p.health === 'HEALTHY'
                              ? '🟢 سليم (اليوم)'
                              : p.health === 'WARNING'
                              ? '🟡 متأخر'
                              : '🔴 حرج'}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 font-mono text-[11px]">
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded font-bold">
                            daily / monthly
                          </span>
                        </td>
                        <td className="p-3">
                          {p.hasCustomR2 ? (
                            <span className="px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded font-bold text-[11px]">
                              ☁️ {p.r2BucketName}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">غير مجهز</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => openR2ConfigModal(p)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                          >
                            إعداد R2
                          </button>
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

      {/* Manage Accounts & Reset Password Modal */}
      {showAccountsModal && accountsPharmacy && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  حسابات وكلمات مرور: {accountsPharmacy.name}
                </h3>
                <div className="text-xs text-slate-400 font-mono mt-0.5">slug: {accountsPharmacy.slug}</div>
              </div>
              <button onClick={() => setShowAccountsModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingUsers ? (
              <div className="py-12 text-center text-slate-400 text-sm font-bold flex items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin" />
                جاري جلب حسابات الصيدلية...
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-slate-500">
                  قائمة بجميع المستخدمين المسجلين في نظام هذه الصيدلية مع إمكانية تعيين كلمة مرور جديدة فوراً إذا نسيها الصيدلاني:
                </p>

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
                  {pharmacyUsers.map((u) => (
                    <div key={u.id} className="p-3.5 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-sm">{u.name}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                              u.role === 'OWNER'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {u.role === 'OWNER' ? 'مدير / صاحب الصيدلية' : 'كاشير يومي'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 font-mono mt-1">
                          اسم المستخدم: <b className="text-indigo-900 bg-slate-100 px-1.5 py-0.5 rounded">{u.username}</b>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setResetTargetUser(u);
                          generateRandomPassword();
                        }}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        تغيير كلمة المرور
                      </button>
                    </div>
                  ))}
                </div>

                {/* Reset Form Inline */}
                {resetTargetUser && (
                  <form onSubmit={handleResetPasswordSubmit} className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                        <Lock className="w-4 h-4 text-amber-600" />
                        تعيين كلمة مرور جديدة لـ ({resetTargetUser.name}) - [{resetTargetUser.username}]:
                      </span>
                      <button
                        type="button"
                        onClick={generateRandomPassword}
                        className="text-[11px] font-bold text-amber-800 bg-white hover:bg-amber-100 px-2 py-1 rounded-md border border-amber-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3 text-amber-600" />
                        توليد كلمة مرور
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={resetNewPassword}
                        onChange={(e) => setResetNewPassword(e.target.value)}
                        placeholder="اكتب كلمة المرور الجديدة..."
                        className="flex-1 px-3 py-2 bg-white border border-amber-300 rounded-xl text-sm font-mono font-bold text-slate-800"
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                      >
                        حفظ وتطبيق
                      </button>
                      <button
                        type="button"
                        onClick={() => setResetTargetUser(null)}
                        className="px-3 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Password Reset Success Popup */}
      {resetSuccessModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-emerald-200 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-black text-slate-900">تم تحديث كلمة المرور بنجاح!</h3>
            <p className="text-xs text-slate-500 mt-0.5">يمكنك نسخ البيانات وإرسالها للصيدلاني فوراً</p>

            <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-right space-y-2 text-xs font-mono">
              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                <span className="text-slate-500 font-sans">الصيدلية:</span>
                <span className="font-bold text-slate-900 font-sans">{resetSuccessModal.pharmacyName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                <span className="text-slate-500 font-sans">معرف الصيدلية (Slug):</span>
                <span className="font-bold text-indigo-700">{resetSuccessModal.slug}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-1.5">
                <span className="text-slate-500 font-sans">اسم المستخدم:</span>
                <span className="font-bold text-slate-900">{resetSuccessModal.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-sans">كلمة المرور الجديدة:</span>
                <span className="font-black text-emerald-600 text-sm">{resetSuccessModal.newPassword}</span>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={copyResetCredentials}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'تم نسخ البيانات بنجاح!' : 'نسخ البيانات لإرسالها للصيدلي'}
              </button>

              <button
                onClick={() => setResetSuccessModal(null)}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Pharmacy Modal */}
      {showEditModal && editingTenant && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                  <Edit className="w-5 h-5 text-indigo-600" />
                  تعديل بيانات الصيدلية
                </h3>
                <div className="text-xs text-slate-400 font-mono mt-0.5">slug: {editingTenant.slug}</div>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateTenant} className="mt-4 space-y-4">
              {/* Pharmacy Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الصيدلية *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* Governorate & District */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المحافظة *</label>
                  <select
                    value={editForm.governorate}
                    onChange={(e) => {
                      const newGov = e.target.value;
                      const gData = IRAQ_LOCATIONS.find((l) => l.name === newGov);
                      setEditForm({
                        ...editForm,
                        governorate: newGov,
                        district: gData?.districts[0] || 'المركز',
                      });
                      setIsEditCustomDistrict(false);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800"
                  >
                    {IRAQ_LOCATIONS.map((gov) => (
                      <option key={gov.name} value={gov.name}>
                        {gov.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المنطقة / الحي *</label>
                  {isEditCustomDistrict ? (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        required
                        value={editForm.customDistrict}
                        onChange={(e) => setEditForm({ ...editForm, customDistrict: e.target.value })}
                        placeholder="اكتب اسم المنطقة..."
                        className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setIsEditCustomDistrict(false)}
                        className="px-2.5 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        القائمة
                      </button>
                    </div>
                  ) : (
                    <select
                      value={editForm.district}
                      onChange={(e) => {
                        if (e.target.value === 'CUSTOM') {
                          setIsEditCustomDistrict(true);
                          setEditForm({ ...editForm, customDistrict: '' });
                        } else {
                          setEditForm({ ...editForm, district: e.target.value });
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800"
                    >
                      {editAvailableDistricts.map((dist) => (
                        <option key={dist} value={dist}>
                          {dist}
                        </option>
                      ))}
                      <option value="CUSTOM">➕ منطقة أخرى (كتابة يدوية)</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Address Details & Phone */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">العنوان التفصيلي وأقرب نقطة دالة</label>
                  <input
                    type="text"
                    value={editForm.addressDetails}
                    onChange={(e) => setEditForm({ ...editForm, addressDetails: e.target.value })}
                    placeholder="مثال: شارع 14 رمضان — قرب مطعم صمد"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف</label>
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="07701234567"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
              </div>

              {/* Google Maps Link */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رابط خرائط جوجل (Google Maps Link)</label>
                <input
                  type="text"
                  value={editForm.googleMapsUrl}
                  onChange={(e) => setEditForm({ ...editForm, googleMapsUrl: e.target.value })}
                  placeholder="https://maps.google.com/?q=..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono text-left"
                />
              </div>

              {/* Subscription Status & Expiration Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-indigo-50/40 p-3.5 rounded-2xl border border-indigo-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">حالة الاشتراك</label>
                  <select
                    value={editForm.subscriptionStatus}
                    onChange={(e) => setEditForm({ ...editForm, subscriptionStatus: e.target.value as any })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800"
                  >
                    <option value="ACTIVE">🟢 فعال (Active)</option>
                    <option value="EXPIRED">🟡 منتهي - قراءة فقط (Expired / Read-Only)</option>
                    <option value="SUSPENDED">🔴 معطل (Suspended)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ انتهاء الاشتراك</label>
                  <input
                    type="date"
                    value={editForm.subscriptionEndsAt}
                    onChange={(e) => setEditForm({ ...editForm, subscriptionEndsAt: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  {loading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmTenant && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-rose-200">
            <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-black text-slate-900 text-center">هل أنت متأكد من حذف الصيدلية؟</h3>
            <p className="text-xs text-slate-600 text-center mt-2 leading-relaxed">
              أنت على وشك حذف صيدلية <b className="text-slate-900 font-black">({deleteConfirmTenant.name})</b>.
              سيتم حذف مخطط قاعدة البيانات المعزول <span className="font-mono text-rose-700 font-bold">({deleteConfirmTenant.schemaName})</span> بالكامل مع جميع بيانات الأدوية والمخزون وسجلات المبيعات نهائياً.
            </p>

            <div className="mt-6 flex gap-2">
              <button
                onClick={handleDeleteTenant}
                disabled={loading}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
              >
                {loading ? 'جاري الحذف...' : 'نعم، حذف الصيدلية نهائياً'}
              </button>
              <button
                onClick={() => setDeleteConfirmTenant(null)}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Pharmacy Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                إضافة صيدلية جديدة وتوليد بياناتها
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTenant} className="mt-4 space-y-4">
              {/* Pharmacy Name & Auto Slug */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الصيدلية *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="مثال: صيدلية النور الحديثة"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* Location: Governorate & District Dropdowns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المحافظة *</label>
                  <select
                    value={form.governorate}
                    onChange={(e) => {
                      const newGov = e.target.value;
                      const gData = IRAQ_LOCATIONS.find((l) => l.name === newGov);
                      setForm({
                        ...form,
                        governorate: newGov,
                        district: gData?.districts[0] || 'المركز',
                      });
                      setIsCustomDistrict(false);
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800"
                  >
                    {IRAQ_LOCATIONS.map((gov) => (
                      <option key={gov.name} value={gov.name}>
                        {gov.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المنطقة / الحي *</label>
                  {isCustomDistrict ? (
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        required
                        value={form.customDistrict}
                        onChange={(e) => setForm({ ...form, customDistrict: e.target.value })}
                        placeholder="اكتب اسم المنطقة..."
                        className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setIsCustomDistrict(false)}
                        className="px-2.5 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        القائمة
                      </button>
                    </div>
                  ) : (
                    <select
                      value={form.district}
                      onChange={(e) => {
                        if (e.target.value === 'CUSTOM') {
                          setIsCustomDistrict(true);
                          setForm({ ...form, customDistrict: '' });
                        } else {
                          setForm({ ...form, district: e.target.value });
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800"
                    >
                      {availableDistricts.map((dist) => (
                        <option key={dist} value={dist}>
                          {dist}
                        </option>
                      ))}
                      <option value="CUSTOM">➕ منطقة أخرى (كتابة يدوية)</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Optional Landmark Address & Phone */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">العنوان التفصيلي وأقرب نقطة دالة (اختياري)</label>
                  <input
                    type="text"
                    value={form.addressDetails}
                    onChange={(e) => setForm({ ...form, addressDetails: e.target.value })}
                    placeholder="مثال: شارع 14 رمضان — قرب مطعم صمد"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف (اختياري)</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="07701234567"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm"
                  />
                </div>
              </div>

              {/* Google Maps & Subscription Plan */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رابط خرائط جوجل (اختياري)</label>
                  <input
                    type="text"
                    value={form.googleMapsUrl}
                    onChange={(e) => setForm({ ...form, googleMapsUrl: e.target.value })}
                    placeholder="https://maps.google.com/?q=..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono text-left"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">باقة ومدة الاشتراك *</label>
                  <select
                    value={form.subscriptionMonths}
                    onChange={(e) => setForm({ ...form, subscriptionMonths: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800"
                  >
                    <option value={1}>🟡 تجريبي (شهر واحد - 30 يوم)</option>
                    <option value={6}>🔵 نصف سنوي (6 أشهر)</option>
                    <option value={12}>🟢 سنة كاملة (12 شهراً) - الافتراضي</option>
                    <option value={24}>🟣 سنتان (24 شهراً)</option>
                  </select>
                </div>
              </div>

              {/* Owner Credentials */}
              <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3">
                <div className="text-xs font-black text-indigo-950 flex items-center justify-between">
                  <span>بيانات حساب صاحب الصيدلية الرئيسي (OWNER)</span>
                  <button
                    type="button"
                    onClick={generateUsernameFromName}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-white px-2.5 py-1 rounded-md border border-indigo-200 shadow-2xs hover:bg-indigo-50 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    توليد من اسم الدكتور / الصيدلية
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">اسم المالك</label>
                    <input
                      type="text"
                      required
                      value={form.ownerName}
                      onChange={(e) => handleOwnerNameChange(e.target.value)}
                      placeholder="د. مصطفى كمال"
                      className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">اسم المستخدم *</label>
                    <input
                      type="text"
                      required
                      value={form.ownerUsername}
                      onChange={(e) => setForm({ ...form, ownerUsername: e.target.value })}
                      placeholder="mustafa_owner"
                      className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-0.5">كلمة المرور (إجبارية) *</label>
                    <input
                      type="password"
                      required
                      value={form.ownerPassword}
                      onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })}
                      placeholder="••••••••"
                      className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Option to auto-create Cashier Account */}
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  id="createCashier"
                  checked={form.createCashier}
                  onChange={(e) => setForm({ ...form, createCashier: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                />
                <label htmlFor="createCashier" className="text-xs font-bold text-slate-800 cursor-pointer flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-slate-500" />
                  إنشاء حساب كاشير إضافي تلقائياً (بنفس كلمة المرور لسرعة بدء العمل)
                </label>
              </div>

              {/* Submit & Cancel */}
              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  {loading ? 'جاري تجهيز الصيدلية وتوليد الـ Schema...' : 'إنشاء وتفعيل الصيدلية'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Pharmacy Success Dialog */}
      {newPharmacyResult && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-slate-900">تم إنشاء وتفعيل الصيدلية بنجاح!</h3>
              <p className="text-xs text-slate-500">تم توليد الـ Schema الخاص بها والتراخيص</p>
            </div>

            <div className="mt-4 p-4 bg-slate-50 rounded-2xl space-y-3 text-xs border border-slate-200 font-mono">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-sans">اسم الصيدلية:</span>
                <span className="font-bold text-slate-900">{newPharmacyResult.tenant.name}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-sans">المعرف (Slug):</span>
                <span className="font-bold text-indigo-700">{newPharmacyResult.tenant.slug}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-500 font-sans">مفتاح الترخيص:</span>
                <span className="font-bold text-slate-800">{newPharmacyResult.tenant.licenseKey}</span>
              </div>

              {/* Owner Creds */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                <div className="font-sans font-black text-indigo-900 text-[11px]">👤 حساب المدير / المالك:</div>
                <div className="flex justify-between text-slate-700">
                  <span>اسم المستخدم: <b>{newPharmacyResult.ownerAccount.username}</b></span>
                  <span>كلمة المرور: <b>{newPharmacyResult.ownerAccount.password}</b></span>
                </div>
              </div>

              {/* Cashier Creds */}
              {newPharmacyResult.cashierAccount && (
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                  <div className="font-sans font-black text-blue-900 text-[11px]">🛒 حساب الكاشير اليومي:</div>
                  <div className="flex justify-between text-slate-700">
                    <span>اسم المستخدم: <b>{newPharmacyResult.cashierAccount.username}</b></span>
                    <span>كلمة المرور: <b>{newPharmacyResult.cashierAccount.password}</b></span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={copyAllCredentials}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'تم نسخ جميع البيانات بنجاح!' : 'نسخ جميع بيانات الدخول'}
              </button>

              <button
                onClick={() => setNewPharmacyResult(null)}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cloudflare R2 Configuration Modal for Tenant */}
      {showR2ConfigModal && r2ConfigTenant && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-sky-600" />
                  إعداد Cloudflare R2: {r2ConfigTenant.name}
                </h3>
                <div className="text-xs text-slate-400 font-mono mt-0.5">slug: {r2ConfigTenant.slug}</div>
              </div>
              <button onClick={() => setShowR2ConfigModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveR2Config} className="mt-4 space-y-4">
              <p className="text-xs text-slate-500">
                عند تحديد بيانات حساب Cloudflare R2 الخاص بالصيدلية، سيقوم السيرفر يومياً برفع نسخة احتياطية مباشرة إلى البوكت الخاص بها بالإضافة للبوكت المركزي للنظام.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم البوكت (Bucket Name)</label>
                <input
                  type="text"
                  placeholder="e.g. pharmacy-private-backups"
                  value={r2ConfigForm.r2BucketName}
                  onChange={(e) => setR2ConfigForm({ ...r2ConfigForm, r2BucketName: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">معرف الحساب (Account ID)</label>
                <input
                  type="text"
                  placeholder="32-character Cloudflare Account ID"
                  value={r2ConfigForm.r2AccountId}
                  onChange={(e) => setR2ConfigForm({ ...r2ConfigForm, r2AccountId: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">مفتاح الوصول (Access Key ID)</label>
                <input
                  type="text"
                  placeholder="R2 Access Key ID"
                  value={r2ConfigForm.r2AccessKeyId}
                  onChange={(e) => setR2ConfigForm({ ...r2ConfigForm, r2AccessKeyId: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المفتاح السري (Secret Access Key)</label>
                <input
                  type="password"
                  placeholder="R2 Secret Access Key"
                  value={r2ConfigForm.r2SecretAccessKey}
                  onChange={(e) => setR2ConfigForm({ ...r2ConfigForm, r2SecretAccessKey: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:border-indigo-500 outline-none"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  disabled={savingR2Config}
                  className="flex-1 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {savingR2Config ? 'جاري الحفظ...' : 'حفظ الإعدادات 💾'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowR2ConfigModal(false)}
                  className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Master System Cloudflare R2 Modal */}
      {showMasterR2Modal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-indigo-600" />
                  إعداد Cloudflare R2 المركزي للنظام
                </h3>
                <div className="text-xs text-slate-400 font-mono mt-0.5">Master System Backup Storage</div>
              </div>
              <button onClick={() => setShowMasterR2Modal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMasterR2} className="mt-4 space-y-4">
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-2xl text-xs text-indigo-900 leading-relaxed font-medium">
                💡 <b>ملاحظة:</b> بمجرد إدخال هذه المفاتيح هنا، سيقوم السيرفر تلقائياً برفع وتحديث النسخ اليومية والشهرية لكافة الصيدليات في هذا البوكت دون الحاجة لتعديل أي إعدادات في السيرفر أو الاستضافة.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم البوكت الرئيسي (Bucket Name)</label>
                <input
                  type="text"
                  placeholder="e.g. dawaee-backups"
                  value={masterR2Form.r2BucketName}
                  onChange={(e) => setMasterR2Form({ ...masterR2Form, r2BucketName: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:border-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">معرف الحساب (Account ID)</label>
                <input
                  type="text"
                  placeholder="32-character Cloudflare Account ID"
                  value={masterR2Form.r2AccountId}
                  onChange={(e) => setMasterR2Form({ ...masterR2Form, r2AccountId: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:border-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">مفتاح الوصول (Access Key ID)</label>
                <input
                  type="text"
                  placeholder="R2 Access Key ID"
                  value={masterR2Form.r2AccessKeyId}
                  onChange={(e) => setMasterR2Form({ ...masterR2Form, r2AccessKeyId: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:border-indigo-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المفتاح السري (Secret Access Key)</label>
                <input
                  type="password"
                  placeholder="R2 Secret Access Key"
                  value={masterR2Form.r2SecretAccessKey}
                  onChange={(e) => setMasterR2Form({ ...masterR2Form, r2SecretAccessKey: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:border-indigo-500 outline-none"
                  required
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="submit"
                  disabled={savingMasterR2}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {savingMasterR2 ? 'جاري الحفظ والتفعيل...' : 'حفظ وتفعيل R2 للنظام 💾'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowMasterR2Modal(false)}
                  className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
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
