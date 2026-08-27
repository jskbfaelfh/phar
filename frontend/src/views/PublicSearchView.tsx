import React, { useState, useEffect } from 'react';
import {
  Search,
  MapPin,
  Phone,
  MessageCircle,
  CheckCircle2,
  Building2,
  Pill,
  Sparkles,
  Smartphone,
  Monitor,
  Share2,
  X,
  Navigation,
  Clock,
  Compass,
} from 'lucide-react';
import { apiRequest } from '../api/client';

export const PublicSearchView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [district, setDistrict] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [isMobileFrame, setIsMobileFrame] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Popular quick search chips
  const quickSearchChips = [
    'Panadol',
    'Augmentin',
    'Cataflam',
    'Amoxil',
    'Brufen',
    'Omeprazole',
    'فيتامين D3',
    'Zithromax',
  ];

  // Fetch available locations
  useEffect(() => {
    apiRequest<any[]>('/public/locations')
      .then((data) => setLocations(data || []))
      .catch((err) => console.error(err));
  }, []);

  const handleSearch = async (term = searchTerm, gov = governorate, dist = district) => {
    if (!term && !gov && !dist) return;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (term) params.append('q', term);
      if (gov) params.append('governorate', gov);
      if (dist) params.append('district', dist);

      const data = await apiRequest<any>(`/public/search?${params.toString()}`);
      setResults(data.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchTerm.length >= 2 || governorate || district) {
      const timer = setTimeout(() => handleSearch(searchTerm, governorate, district), 300);
      return () => clearTimeout(timer);
    } else if (!searchTerm && !governorate && !district) {
      setResults([]);
    }
  }, [searchTerm, governorate, district]);

  const uniqueGovernorates = Array.from(new Set(locations.map((l) => l.governorate).filter(Boolean)));
  const uniqueDistricts = Array.from(
    new Set(
      locations
        .filter((l) => !governorate || l.governorate === governorate)
        .map((l) => l.district)
        .filter(Boolean),
    ),
  );

  const handleWhatsAppChat = (item: any) => {
    const rawPhone = (item.phone || '').replace(/[^0-9]/g, '');
    let cleanPhone = rawPhone;
    if (cleanPhone.startsWith('07')) {
      cleanPhone = '964' + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith('7')) {
      cleanPhone = '964' + cleanPhone;
    }
    const message = encodeURIComponent(
      `السلام عليكم صيدلية (${item.pharmacyName})، هل يتوفر لديكم دواء (${item.tradeName})؟ وجدته عبر تطبيق دوائي.`,
    );
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  };

  const handleShare = async (item: any) => {
    const text = `دواء (${item.tradeName}) متوفر في صيدلية (${item.pharmacyName}) - ${item.governorate} بسعر ${Number(item.sellingPricePack).toLocaleString()} د.ع. هاتف: ${item.phone}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `توفر دواء ${item.tradeName}`,
          text: text,
          url: window.location.href,
        });
      } catch {
        // Fallback to clipboard
      }
    } else {
      navigator.clipboard.writeText(text);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // The actual mobile search page content
  const renderSearchBody = () => (
    <div className="flex flex-col min-h-full bg-slate-900 text-slate-100 font-sans select-none pb-20">
      {/* 1. Mobile App Top Bar */}
      <div className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 pt-3 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-md">
              <Pill className="w-4 h-4 font-black" />
            </div>
            <div>
              <div className="text-sm font-black text-white flex items-center gap-1">
                <span>دوائي</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded-md font-bold">
                  الشبكي
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-bold">شبكة الصيدليات العراقية</div>
            </div>
          </div>

          {/* Location Badge Indicator */}
          <div className="flex items-center gap-1 bg-slate-800/90 px-2.5 py-1 rounded-full text-[11px] font-bold text-slate-300 border border-slate-700">
            <MapPin className="w-3 h-3 text-emerald-400" />
            <span>{governorate || 'كل العراق'}</span>
          </div>
        </div>

        {/* Search Bar Input */}
        <div className="mt-3 relative">
          <Search className="w-4 h-4 absolute right-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث بالدواء (Panadol, أوجمنتين)..."
            className="w-full pr-10 pl-9 py-2.5 bg-slate-900/90 border border-slate-700/80 rounded-2xl text-xs font-bold text-white placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-inner"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute left-3 top-2.5 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Horizontal Governorates Scroll */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2.5 pb-1">
          <button
            onClick={() => {
              setGovernorate('');
              setDistrict('');
            }}
            className={`px-3 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
              !governorate
                ? 'bg-emerald-500 text-slate-950 shadow-xs'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            كل العراق
          </button>
          {Array.from(new Set([...uniqueGovernorates, 'بغداد', 'البصرة', 'أربيل', 'النجف', 'كربلاء', 'نينوى', 'السليمانية', 'بابل', 'كركوك', 'ديالى'])).map(
            (gov) => (
              <button
                key={gov}
                onClick={() => {
                  setGovernorate(gov);
                  setDistrict('');
                }}
                className={`px-3 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                  governorate === gov
                    ? 'bg-emerald-500 text-slate-950 shadow-xs'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {gov}
              </button>
            ),
          )}
        </div>
      </div>

      {/* 2. Quick Tags & Districts (if governorate selected) */}
      <div className="px-4 pt-3 pb-1 space-y-2">
        {/* District Filter if specific governorate is selected */}
        {governorate && uniqueDistricts.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">المنطقة:</span>
            <button
              onClick={() => setDistrict('')}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all shrink-0 ${
                !district ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              الكل
            </button>
            {uniqueDistricts.map((dist) => (
              <button
                key={dist}
                onClick={() => setDistrict(dist)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all shrink-0 ${
                  district === dist ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {dist}
              </button>
            ))}
          </div>
        )}

        {/* Quick Search Chips */}
        {!searchTerm && (
          <div>
            <div className="text-[11px] font-bold text-slate-400 mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              الأكثر بحثاً:
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {quickSearchChips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => setSearchTerm(chip)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. Results Section */}
      <div className="px-4 py-3 flex-1">
        {loading ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-bold text-slate-400">جاري البحث في الصيدليات...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl bg-slate-800/40 border border-slate-800">
            <Pill className="w-10 h-10 text-slate-600 mx-auto mb-2 stroke-[1.5]" />
            <h4 className="text-sm font-bold text-slate-300">
              {searchTerm ? 'لم يتم العثور على صيدلية متوفر لديها' : 'ابحث باسم الدواء'}
            </h4>
            <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
              اكتب اسم العلاج التجاري أو العلمي لاكتشاف الصيدليات الأقرب إليك وأسعارها فوراً.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 px-1">
              <span>النتائج المتوفرة ({results.length})</span>
              <span>الأقل سعراً أولاً</span>
            </div>

            {results.map((item) => (
              <div
                key={item.id}
                className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3.5 shadow-md flex flex-col justify-between gap-3 hover:border-slate-600 transition-all"
              >
                {/* Top: Medicine Info & Price Badge */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-sm text-white truncate">{item.tradeName}</div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">{item.scientificName}</div>
                    </div>
                    <div className="text-left shrink-0">
                      <div className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 font-black text-xs font-mono">
                        {Number(item.sellingPricePack).toLocaleString()} د.ع
                      </div>
                    </div>
                  </div>

                  {/* Pharmacy Identity */}
                  <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-200 font-bold">
                      <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate">{item.pharmacyName}</span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                      متوفر
                    </span>
                  </div>

                  {/* Location info */}
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
                    <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                    <span className="truncate">
                      {item.governorate} — {item.district} {item.addressDetails ? `(${item.addressDetails})` : ''}
                    </span>
                  </div>
                </div>

                {/* Mobile Action Buttons (Thumb reach) */}
                <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-700/60">
                  {/* Call Button */}
                  <a
                    href={`tel:${item.phone}`}
                    className="col-span-2 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-slate-950 rounded-xl text-xs font-black flex items-center justify-center gap-1 shadow-sm transition-all"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    اتصال
                  </a>

                  {/* WhatsApp Button */}
                  <button
                    onClick={() => handleWhatsAppChat(item)}
                    className="py-2 bg-teal-900/80 hover:bg-teal-800 text-teal-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                    title="مراسلة واتساب"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-teal-400" />
                    واتساب
                  </button>

                  {/* Map / Share Button */}
                  {item.googleMapsUrl ? (
                    <a
                      href={item.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                      title="الخريطة"
                    >
                      <Navigation className="w-3.5 h-3.5 text-indigo-400" />
                      الخريطة
                    </a>
                  ) : (
                    <button
                      onClick={() => handleShare(item)}
                      className="py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      title="مشاركة"
                    >
                      <Share2 className="w-3.5 h-3.5 text-slate-300" />
                      {copiedId === item.id ? 'تم النسخ' : 'مشاركة'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Bottom Fixed Mobile App Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-6 py-2 flex items-center justify-between text-[11px] font-bold text-slate-400 z-40">
        <button
          onClick={() => {
            setSearchTerm('');
            setGovernorate('');
            setDistrict('');
          }}
          className="flex flex-col items-center gap-1 text-emerald-400 cursor-pointer"
        >
          <Search className="w-4 h-4" />
          <span>بحث</span>
        </button>

        <button
          onClick={() => setGovernorate('بغداد')}
          className="flex flex-col items-center gap-1 hover:text-slate-200 cursor-pointer"
        >
          <Compass className="w-4 h-4" />
          <span>الأقرب</span>
        </button>

        <button
          onClick={() => alert('خدمة التنبيه عند توفر الدواء قيد التفعيل')}
          className="flex flex-col items-center gap-1 hover:text-slate-200 cursor-pointer"
        >
          <Clock className="w-4 h-4" />
          <span>التنبيهات</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center py-4 px-2 font-sans">
      {/* Top Device Switcher Toolbar */}
      <div className="mb-4 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 flex items-center gap-2 text-xs font-bold text-slate-300 shadow-md">
        <button
          onClick={() => setIsMobileFrame(true)}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
            isMobileFrame
              ? 'bg-emerald-500 text-slate-950 font-black shadow-xs'
              : 'hover:text-white'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          قياس الموبايل (iPhone)
        </button>

        <button
          onClick={() => setIsMobileFrame(false)}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer ${
            !isMobileFrame
              ? 'bg-emerald-500 text-slate-950 font-black shadow-xs'
              : 'hover:text-white'
          }`}
        >
          <Monitor className="w-4 h-4" />
          ملء الشاشة
        </button>
      </div>

      {/* Main Container */}
      {isMobileFrame ? (
        /* Mobile Smartphone Frame Simulation */
        <div className="relative w-full max-w-[390px] h-[820px] bg-slate-950 rounded-[48px] border-[10px] border-slate-800 shadow-2xl overflow-hidden flex flex-col ring-1 ring-slate-700/50">
          {/* Smartphone Notch / Dynamic Island */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-5 bg-slate-950 rounded-full z-50 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-slate-900 ml-3"></div>
            <div className="w-2 h-2 rounded-full bg-slate-800"></div>
          </div>

          {/* Screen Content */}
          <div className="flex-1 overflow-y-auto pt-4 no-scrollbar">
            {renderSearchBody()}
          </div>

          {/* Smartphone Home Indicator Bar */}
          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-slate-700 rounded-full z-50 pointer-events-none"></div>
        </div>
      ) : (
        /* Full Width Container */
        <div className="w-full max-w-4xl rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
          {renderSearchBody()}
        </div>
      )}
    </div>
  );
};
