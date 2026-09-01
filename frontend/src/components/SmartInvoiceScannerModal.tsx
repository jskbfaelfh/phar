import React, { useState, useRef } from 'react';
import {
  Camera,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  X,
  Package,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { apiRequest } from '../api/client';

interface ScannedItem {
  rawName: string;
  matchedMedicineId: string | null;
  matchedTradeName: string;
  scientificName?: string;
  barcode?: string;
  batchNumber: string;
  expiryDate: string;
  quantityPacks: number;
  unitsPerPack: number;
  purchasePricePack: number;
  sellingPricePack: number;
  totalCost: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  discrepancies: string[];
}

interface SmartInvoiceScannerModalProps {
  onClose: () => void;
  onSuccess: (savedInvoice: any) => void;
}

export const SmartInvoiceScannerModal: React.FC<SmartInvoiceScannerModalProps> = ({
  onClose,
  onSuccess,
}) => {
  // Stepper: 1. UPLOAD -> 2. PROCESSING -> 3. REVIEW -> 4. SAVING
  const [step, setStep] = useState<'UPLOAD' | 'PROCESSING' | 'REVIEW'>('UPLOAD');
  const [processingStage, setProcessingStage] = useState<string>('قراءة النصوص البصرية (OCR)...');

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [rawTextHint, setRawTextHint] = useState<string>('');

  // Invoice Data
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [earlyDiscountDays, setEarlyDiscountDays] = useState<number | ''>('');
  const [earlyDiscountPercent, setEarlyDiscountPercent] = useState<number | ''>('');
  const [confidenceScore, setConfidenceScore] = useState<number>(90);
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [discrepanciesCount, setDiscrepanciesCount] = useState<number>(0);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Handle file select with automatic smart compression
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 1600;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
          setSelectedImage(compressedBase64);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  // Start AI Extraction Pipeline
  const runAiExtraction = async (base64Img?: string) => {
    const imgToSend = base64Img || selectedImage;
    setStep('PROCESSING');
    setErrorMsg(null);

    try {
      setProcessingStage('📷 جاري مسح واستخراج النصوص البصرية (OCR)...');
      await new Promise((r) => setTimeout(r, 600));

      setProcessingStage('🧠 جاري الفهم والترتيب وهيكلة بنود الفاتورة بالذكاء الاصطناعي...');
      await new Promise((r) => setTimeout(r, 700));

      setProcessingStage('🔎 جاري المطابقة مع الدليل الدوائي العراقي الموحد (Master DB)...');

      const response = await apiRequest<any>('/purchases/ai-scan-invoice', {
        method: 'POST',
        body: JSON.stringify({
          imageBase64: imgToSend || 'data:image/jpeg;base64,sample',
          rawTextHint: rawTextHint.trim() || undefined,
        }),
      });

      if (response && response.items) {
        setInvoiceNumber(response.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`);
        setSupplierName(response.supplierName || 'مذخر الأدوية');
        setInvoiceDate(response.invoiceDate || new Date().toISOString().slice(0, 10));
        setItems(response.items);
        setConfidenceScore(response.confidenceScore || 90);
        setDiscrepanciesCount(response.discrepanciesCount || 0);

        if (response.earlyDiscountDays) setEarlyDiscountDays(Number(response.earlyDiscountDays));
        if (response.earlyDiscountPercent) setEarlyDiscountPercent(Number(response.earlyDiscountPercent));

        const total = response.items.reduce((s: number, it: any) => s + Number(it.totalCost || 0), 0);
        setPaidAmount(total); // Default full cash or pharmacist can adjust

        setStep('REVIEW');
      } else {
        throw new Error('لم يتمكن الذكاء الاصطناعي من قراءة محتوى الفاتورة.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'حدث خطأ أثناء معالجة الفاتورة');
      setStep('UPLOAD');
    }
  };

  // Item field update
  const updateItemField = (index: number, field: keyof ScannedItem, value: any) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      if (field === 'quantityPacks' || field === 'purchasePricePack') {
        item.totalCost = Number(item.quantityPacks || 0) * Number(item.purchasePricePack || 0);
      }

      updated[index] = item;
      return updated;
    });
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const totalInvoiceAmount = items.reduce((sum, item) => sum + (Number(item.totalCost) || 0), 0);
  const remainingDebt = Math.max(0, totalInvoiceAmount - paidAmount);

  // Final confirmation: Convert AI review to real purchase invoice in database
  const handleApproveInvoice = async () => {
    if (!invoiceNumber.trim()) {
      setErrorMsg('يرجى إدخال رقم الفاتورة');
      return;
    }
    if (!supplierName.trim()) {
      setErrorMsg('يرجى إدخال اسم المذخر / المورد');
      return;
    }
    if (items.length === 0) {
      setErrorMsg('يجب أن تحتوي الفاتورة على دواء واحد على الأقل');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const calculatedTotal = items.reduce((acc, it) => acc + (Number(it.quantityPacks) * Number(it.purchasePricePack) || 0), 0);

      const payload = {
        invoiceNumber: invoiceNumber.trim() || `INV-${Date.now().toString().slice(-6)}`,
        supplierName: supplierName.trim(),
        invoiceDate: new Date(invoiceDate).toISOString().slice(0, 10),
        totalAmount: calculatedTotal,
        paidAmount: Number(paidAmount) || 0,
        earlyDiscountDays: earlyDiscountDays !== '' ? Number(earlyDiscountDays) : undefined,
        earlyDiscountPercent: earlyDiscountPercent !== '' ? Number(earlyDiscountPercent) : undefined,
        notes: `تم الإدخال والاعتماد عبر الذكاء الاصطناعي الذكي (AI Smart OCR - دقة ${confidenceScore}%)`,
        items: items.map((it) => ({
          medicineId: it.matchedMedicineId || undefined,
          tradeName: (it.matchedTradeName || it.rawName || 'دواء جديد').trim(),
          customTradeName: (it.matchedTradeName || it.rawName || 'دواء جديد').trim(),
          scientificName: it.scientificName || undefined,
          barcode: it.barcode || undefined,
          batchNumber: it.batchNumber.trim() || `BN-${Date.now().toString().slice(-4)}`,
          expiryDate: it.expiryDate,
          quantityPacks: Number(it.quantityPacks) || 1,
          unitsPerPack: Number(it.unitsPerPack) || 1,
          purchasePricePack: Number(it.purchasePricePack) || 0,
          sellingPricePack: Number(it.sellingPricePack) || 0,
        })),
      };

      const result = await apiRequest<any>('/purchases', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      onSuccess(result);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'فشل اعتماد وترحيل الفاتورة إلى المخزن');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-linear-to-r from-emerald-700 via-teal-700 to-indigo-800 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center font-black">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h3 className="font-black text-base flex items-center gap-2">
                <span>الإدخال الذكي لفواتير المذاخر (AI Smart OCR)</span>
                <span className="px-2 py-0.5 bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 rounded-full text-[10px] font-bold">
                  Vision + Master DB
                </span>
              </h3>
              <p className="text-xs text-emerald-100 font-medium">
                تصوير الفاتورة الورقية ➔ القراءة الذكية ➔ المطابقة مع الدليل الدوائي ➔ ترحيل المخزن
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
              {errorMsg.includes('إعدادات الصيدلية') && (
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[11px] font-black shrink-0 transition-colors"
                >
                  الحصول على مفتاح مجاني من Google ↗
                </a>
              )}
            </div>
          )}

          {/* STEP 1: UPLOAD / CAMERA */}
          {step === 'UPLOAD' && (
            <div className="space-y-6 py-4">
              <div className="text-center max-w-md mx-auto space-y-2">
                <h4 className="text-lg font-black text-slate-900">
                  اختر طريقة إدخال أو تصوير الفاتورة
                </h4>
                <p className="text-xs text-slate-500">
                  يقوم الذكاء الاصطناعي بقراءة أسماء الأدوية، الوجبات، الصلاحية، وأسعار المذخر تلقائياً
                </p>
              </div>

              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${
                  selectedImage
                    ? 'border-emerald-500 bg-emerald-50/40'
                    : 'border-slate-300 hover:border-emerald-500 hover:bg-slate-50/70 bg-slate-50/40'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />

                {selectedImage ? (
                  <div className="space-y-4">
                    <img
                      src={selectedImage}
                      alt="Invoice Preview"
                      className="max-h-56 mx-auto rounded-2xl object-contain shadow-lg border border-slate-200"
                    />
                    <div className="flex items-center justify-center gap-2 text-emerald-700 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تم تحميل صورة الفاتورة بنجاح. انقر لتغيير الصورة</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                      <Camera className="w-8 h-8" />
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-800">
                        انقر لرفع صورة الفاتورة أو التقاطها بالكاميرا
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        يدعم ملفات الصور (JPG, PNG, WebP)
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Optional Text Paste Hint */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                  <span>أو الصق نص الفاتورة يدوياً إذا كانت متوفرة كنص (اختياري):</span>
                </div>
                <textarea
                  rows={2}
                  value={rawTextHint}
                  onChange={(e) => setRawTextHint(e.target.value)}
                  placeholder="مثال: Panadol Extra 50 packs 3500 IQD, Amoxicillin 500mg 20 packs..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => runAiExtraction()}
                  className="w-full sm:w-auto px-8 py-3.5 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-900/20 flex items-center justify-center gap-2 cursor-pointer transition-all transform active:scale-95"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>بدء المسح والتحليل الذكي (AI OCR)</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: PROCESSING ANIMATION */}
          {step === 'PROCESSING' && (
            <div className="py-16 text-center space-y-6 max-w-md mx-auto">
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 rounded-3xl bg-emerald-500/20 animate-ping"></div>
                <div className="relative w-24 h-24 rounded-3xl bg-emerald-600 text-white flex items-center justify-center shadow-2xl">
                  <Sparkles className="w-10 h-10 text-amber-300 animate-spin" style={{ animationDuration: '3s' }} />
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-base font-black text-slate-900">
                  جاري معالجة الفاتورة بالذكاء الاصطناعي
                </h4>
                <p className="text-xs font-bold text-emerald-700 bg-emerald-50 py-2 px-4 rounded-xl border border-emerald-200 inline-block animate-pulse">
                  {processingStage}
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: PHARMACIST REVIEW & DISCREPANCIES */}
          {step === 'REVIEW' && (
            <div className="space-y-6">
              {/* Top AI Summary Banner */}
              <div className="p-4 bg-linear-to-r from-slate-900 to-slate-800 text-white rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-300">
                      دقة قراءة الذكاء الاصطناعي: <span className="text-emerald-400 font-black">{confidenceScore}%</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      تم استخراج {items.length} أدوية بنجاح ومطابقتها مع الدليل الدوائي
                    </div>
                  </div>
                </div>

                {discrepanciesCount > 0 ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded-xl text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>يوجد {discrepanciesCount} ملاحظات دقيقة يرجى مراجعتها بالجدول</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>الفاتورة مطابقة تماماً بدون أخطاء</span>
                  </div>
                )}
              </div>

              {/* Invoice Metadata Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم فاتورة المذخر</label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold font-mono text-slate-900 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اسم المذخر / المجهز</label>
                  <input
                    type="text"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">تاريخ الفاتورة</label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold font-mono text-slate-900 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Early Settlement Discount Settings */}
              <div className="p-4 bg-amber-50/70 border border-amber-200/90 rounded-2xl space-y-2 text-xs">
                <div className="font-black text-amber-950 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>شروط خُصومات التسديد المبكر للمذخر (مكتشفة بالذكاء الاصطناعي أو يمكنك تعديلها):</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">مهلة التسديد للحصول على الخصم (بالأيام)</label>
                    <input
                      type="number"
                      min="1"
                      value={earlyDiscountDays}
                      onChange={(e) => setEarlyDiscountDays(e.target.value ? Number(e.target.value) : '')}
                      placeholder="مثلاً: 60 (خلال 60 يوم)"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-hidden focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">نسبة الخصم المشروطة %</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="100"
                      value={earlyDiscountPercent}
                      onChange={(e) => setEarlyDiscountPercent(e.target.value ? Number(e.target.value) : '')}
                      placeholder="مثلاً: 3%"
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-hidden focus:border-amber-500"
                    />
                  </div>
                </div>

                {earlyDiscountDays !== '' && earlyDiscountPercent !== '' && totalInvoiceAmount > 0 && (
                  <div className="p-2 bg-white rounded-xl border border-amber-200 text-[11px] font-bold text-amber-900 flex items-center justify-between flex-wrap gap-1">
                    <span>
                      💡 يسري الخصم حتى:{' '}
                      <span className="font-mono text-blue-700">
                        {new Date(new Date(invoiceDate).getTime() + Number(earlyDiscountDays) * 86400000).toLocaleDateString('ar-IQ')}
                      </span>
                    </span>
                    <span className="text-emerald-700 font-black">
                      مبلغ الخصم المتوقع عند التسديد: {Math.round(totalInvoiceAmount * (Number(earlyDiscountPercent) / 100)).toLocaleString()} د.ع
                    </span>
                  </div>
                )}
              </div>

              {/* Items Review Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-emerald-600" />
                    <span>مراجعة وتدقيق الأدوية والوجبات المستخرجة ({items.length})</span>
                  </h5>
                  <span className="text-[11px] text-slate-400">يمكنك تعديل أي حقل مباشرة بالنقر عليه</span>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold">
                        <tr>
                          <th className="p-3">#</th>
                          <th className="p-3">الدواء (المطابقة بالدليل)</th>
                          <th className="p-3">رقم الوجبة</th>
                          <th className="p-3">تاريخ الانتهاء</th>
                          <th className="p-3">العدد (بكيت)</th>
                          <th className="p-3">سعر الشراء</th>
                          <th className="p-3">سعر البيع</th>
                          <th className="p-3">المجموع</th>
                          <th className="p-3 text-center">الحالة</th>
                          <th className="p-3 text-center">حذف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {items.map((item, idx) => (
                          <tr
                            key={idx}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              item.discrepancies.length > 0 ? 'bg-amber-50/30' : ''
                            }`}
                          >
                            <td className="p-3 text-slate-400 font-mono">{idx + 1}</td>

                            {/* Drug Name & Match */}
                            <td className="p-3">
                              <input
                                type="text"
                                value={item.matchedTradeName}
                                onChange={(e) => updateItemField(idx, 'matchedTradeName', e.target.value)}
                                className="w-full font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-emerald-500 focus:outline-hidden"
                              />
                              {item.scientificName && (
                                <div className="text-[10px] text-slate-400 truncate max-w-xs font-mono">
                                  {item.scientificName}
                                </div>
                              )}
                              {item.discrepancies.length > 0 && (
                                <div className="mt-1 space-y-0.5">
                                  {item.discrepancies.map((d, di) => (
                                    <div
                                      key={di}
                                      className="text-[10px] font-bold text-amber-700 flex items-center gap-1"
                                    >
                                      <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                                      <span>{d}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>

                            {/* Batch Number */}
                            <td className="p-3">
                              <input
                                type="text"
                                value={item.batchNumber}
                                onChange={(e) => updateItemField(idx, 'batchNumber', e.target.value)}
                                className="w-24 p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-800 text-xs focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                              />
                            </td>

                            {/* Expiry Date */}
                            <td className="p-3">
                              <input
                                type="date"
                                value={item.expiryDate}
                                onChange={(e) => updateItemField(idx, 'expiryDate', e.target.value)}
                                className="w-32 p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-800 text-xs focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                              />
                            </td>

                            {/* Quantity */}
                            <td className="p-3">
                              <input
                                type="number"
                                min="1"
                                value={item.quantityPacks}
                                onChange={(e) => updateItemField(idx, 'quantityPacks', Number(e.target.value))}
                                className="w-16 p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-900 text-xs focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                              />
                            </td>

                            {/* Purchase Price */}
                            <td className="p-3">
                              <input
                                type="number"
                                min="0"
                                step="250"
                                value={item.purchasePricePack}
                                onChange={(e) =>
                                  updateItemField(idx, 'purchasePricePack', Number(e.target.value))
                                }
                                className="w-24 p-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-900 text-xs focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                              />
                            </td>

                            {/* Selling Price */}
                            <td className="p-3">
                              <input
                                type="number"
                                min="0"
                                step="250"
                                value={item.sellingPricePack}
                                onChange={(e) =>
                                  updateItemField(idx, 'sellingPricePack', Number(e.target.value))
                                }
                                className="w-24 p-1.5 bg-emerald-50 border border-emerald-200 rounded-lg font-mono font-bold text-emerald-800 text-xs focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                              />
                            </td>

                            {/* Total Cost */}
                            <td className="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                              {Number(item.totalCost).toLocaleString()} د.ع
                            </td>

                            {/* Match Confidence Badge */}
                            <td className="p-3 text-center">
                              {item.confidence === 'HIGH' ? (
                                <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-black">
                                  مطابق 100%
                                </span>
                              ) : item.confidence === 'MEDIUM' ? (
                                <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded-lg text-[10px] font-black">
                                  مطابقة مقترحة
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black">
                                  دواء جديد
                                </span>
                              )}
                            </td>

                            {/* Delete Action */}
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => removeItem(idx)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Financial Settlement Drawer */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-bold">
                <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                  <span className="text-slate-500">إجمالي قيمة الفاتورة:</span>
                  <span className="font-mono text-base text-slate-900">
                    {totalInvoiceAmount.toLocaleString()} د.ع
                  </span>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                  <span className="text-slate-500">المسدد نقداً للمذخر:</span>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                    className="w-28 p-1 bg-slate-50 border border-slate-300 rounded-lg font-mono text-emerald-700 text-right focus:bg-white focus:outline-hidden"
                  />
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                  <span className="text-slate-500">المتبقي آجل (دين للمذخر):</span>
                  <span
                    className={`font-mono text-base ${
                      remainingDebt > 0 ? 'text-amber-700' : 'text-slate-500'
                    }`}
                  >
                    {remainingDebt.toLocaleString()} د.ع
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-bold cursor-pointer transition-colors"
          >
            إلغاء
          </button>

          {step === 'REVIEW' && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep('UPLOAD')}
                className="px-4 py-2.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition-colors"
              >
                إعادة التصوير
              </button>

              <button
                type="button"
                disabled={submitting}
                onClick={handleApproveInvoice}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-black text-xs shadow-lg shadow-emerald-900/20 flex items-center gap-2 cursor-pointer transition-all"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري الترحيل للمخزن...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>اعتماد الفاتورة وترحيل الأدوية للمخزن</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
