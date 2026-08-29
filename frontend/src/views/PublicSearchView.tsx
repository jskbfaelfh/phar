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
  Share2,
  X,
  Navigation,
  Moon,
  Layers,
  LocateFixed,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { apiRequest } from '../api/client';

export const PublicSearchView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [district, setDistrict] = useState('');
  const [only24Hours, setOnly24Hours] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const [results, setResults] = useState<any[]>([]);
  const [alternatives, setAlternatives] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
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
    'Glucophage',
    'Lipitor',
  ];

  // Fetch available locations
  useEffect(() => {
    apiRequest<any[]>('/public/locations')
      .then((data) => setLocations(data || []))
      .catch((err) => console.error(err));
  }, []);

const IRAQ_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'كربلاء': { lat: 32.6160, lng: 44.0249 },
  'كربلاء المقدسة': { lat: 32.6160, lng: 44.0249 },
  'النجف': { lat: 32.0000, lng: 44.3333 },
  'النجف الأشرف': { lat: 32.0000, lng: 44.3333 },
  'بغداد': { lat: 33.3152, lng: 44.3661 },
  'البصرة': { lat: 30.5081, lng: 47.7835 },
  'أربيل': { lat: 36.1911, lng: 44.0091 },
  'نينوى': { lat: 36.3400, lng: 43.1300 },
  'السليمانية': { lat: 35.5570, lng: 45.4350 },
  'بابل': { lat: 32.4789, lng: 44.4312 },
  'كركوك': { lat: 35.4681, lng: 44.3922 },
  'ديالى': { lat: 33.7489, lng: 44.6461 },
  'ميسان': { lat: 31.8400, lng: 47.1400 },
  'ذي قار': { lat: 31.0500, lng: 46.2600 },
  'واسط': { lat: 32.5100, lng: 45.8200 },
  'المثنى': { lat: 31.3100, lng: 45.2800 },
  'صلاح الدين': { lat: 34.6000, lng: 43.6800 },
  'الأنبار': { lat: 33.4200, lng: 43.3000 },
  'القادسية': { lat: 31.9900, lng: 44.9200 },
};

  // Request GPS User Location with resilient fallback
  const handleGetGpsLocation = () => {
    setGpsLoading(true);
    setGpsError(null);

    if (!navigator.geolocation) {
      if (governorate && IRAQ_COORDINATES[governorate]) {
        setUserCoords(IRAQ_COORDINATES[governorate]);
      } else {
        setGpsError('خدمة تحديد الموقع (GPS) غير متوفرة في متصفحك. يرجى اختيار محافظتك من القائمة أعلاه.');
      }
      setGpsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGpsLoading(false);
      },
      (err) => {
        console.warn('GPS hardware error or permission off:', err);
        if (governorate && IRAQ_COORDINATES[governorate]) {
          setUserCoords(IRAQ_COORDINATES[governorate]);
          setGpsError(null);
        } else {
          setGpsError(
            'يرجى تفعيل إذن الموقع (Allow Location) في المتصفح، أو انقر على اسم محافظتك أعلاه (مثل كربلاء، بغداد) لعرض الأقرب فوراً.',
          );
        }
        setGpsLoading(false);
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  };

  const handleSelectGovernorate = (gov: string) => {
    setGovernorate(gov);
    setDistrict('');
    if (gov && IRAQ_COORDINATES[gov]) {
      setUserCoords(IRAQ_COORDINATES[gov]);
      setGpsError(null);
    } else if (!gov) {
      setUserCoords(null);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm && !governorate && !district && !userCoords && !only24Hours) return;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('q', searchTerm);
      if (governorate) params.append('governorate', governorate);
      if (district) params.append('district', district);
      if (only24Hours) params.append('only24Hours', 'true');
      if (userCoords) {
        params.append('userLat', String(userCoords.lat));
        params.append('userLng', String(userCoords.lng));
      }

      const data = await apiRequest<any>(`/public/search?${params.toString()}`);
      setResults(data.results || []);
      setAlternatives(data.alternatives || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchTerm.length >= 2 || governorate || district || userCoords || only24Hours) {
      const timer = setTimeout(() => handleSearch(), 300);
      return () => clearTimeout(timer);
    } else if (!searchTerm && !governorate && !district) {
      setResults([]);
      setAlternatives([]);
    }
  }, [searchTerm, governorate, district, userCoords, only24Hours]);

  const uniqueGovernorates = Array.from(new Set(locations.map((l) => l.governorate).filter(Boolean)));
  const uniqueDistricts = Array.from(
    new Set(
      locations
        .filter((l) => !governorate || l.governorate === governorate)
        .map((l) => l.district)
        .filter(Boolean),
    ),
  );

  const handleShare = async (item: any) => {
    const priceText = item.priceHidden ? '' : `بسعر ${Number(item.sellingPricePack).toLocaleString()} د.ع`;
    const text = `دواء (${item.tradeName}) متوفر في صيدلية (${item.pharmacyName}) - ${item.governorate} ${priceText}. ${item.phone ? 'هاتف: ' + item.phone : ''}`;
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

  // Render a Professional Pharmacy Card
  const renderPharmacyCard = (item: any, isAlt: boolean = false) => (
    <div
      key={item.id}
      className={`rounded-3xl p-5 shadow-sm border flex flex-col justify-between gap-4 transition-all hover:shadow-md ${
        isAlt
          ? 'bg-slate-900/90 border-indigo-500/30 hover:border-indigo-500/60'
          : 'bg-slate-900/95 border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Top Header: Medicine Details & Price */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black text-lg text-white truncate">{item.tradeName}</span>
              {item.is24Hours && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-[11px] font-black">
                  <Moon className="w-3 h-3" />
                  خافرة 24 ساعة
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
              <span className="text-indigo-300 font-bold">{item.scientificName}</span>
              {item.strength && <span className="text-slate-500">•</span>}
              {item.strength && <span className="text-slate-300 font-semibold">{item.strength}</span>}
              {item.dosageForm && <span className="text-slate-500">•</span>}
              {item.dosageForm && <span className="text-slate-300">{item.dosageForm}</span>}
            </div>
          </div>

          <div className="text-left shrink-0">
            {item.priceHidden ? (
              <div className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-2xl text-slate-300 font-bold text-xs">
                السعر عند الاستفسار
              </div>
            ) : (
              <div className="px-3.5 py-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-emerald-400 font-black text-base font-mono">
                {Number(item.sellingPricePack).toLocaleString()} <span className="text-xs font-sans">د.ع</span>
              </div>
            )}
          </div>
        </div>

        {/* Pharmacy Details Box */}
        <div className="mt-4 p-3.5 bg-slate-950/60 rounded-2xl border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-slate-200 font-black text-sm">
              <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="truncate">{item.pharmacyName}</span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {item.distanceText && (
                <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-xs font-bold">
                  📍 {item.distanceText}
                </span>
              )}
              <span
                className={`inline-flex items-center gap-1 text-xs font-black px-2.5 py-0.5 rounded-full ${
                  item.stockStatus === 'LOW_STOCK'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                {item.stockStatusText}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate">
              {item.governorate} — {item.district} {item.addressDetails ? `(${item.addressDetails})` : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons: WhatsApp, Call, Google Maps Directions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800/80">
        {/* WhatsApp Direct Chat Button */}
        {item.whatsappUrl ? (
          <a
            href={item.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-slate-950 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95 cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 fill-slate-950" />
            <span>واتساب مباشر</span>
          </a>
        ) : item.phone ? (
          <a
            href={`tel:${item.phone}`}
            className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-slate-950 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
          >
            <Phone className="w-4 h-4" />
            <span>اتصال</span>
          </a>
        ) : (
          <div className="py-2.5 px-3 bg-slate-800 text-slate-400 rounded-xl text-xs font-bold text-center">
            تواصل بالصيدلية
          </div>
        )}

        {/* Google Maps Route Button */}
        <a
          href={item.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="py-2.5 px-3 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/60 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
          title="الاتجاهات في خرائط جوجل"
        >
          <Navigation className="w-4 h-4 text-indigo-400" />
          <span>الموقع والمسار</span>
        </a>

        {/* Share Button */}
        <button
          onClick={() => handleShare(item)}
          className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <Share2 className="w-4 h-4 text-slate-400" />
          <span>{copiedId === item.id ? 'تم النسخ' : 'مشاركة'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* 1. Hero Search Section */}
      <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-b border-slate-800/80 px-4 sm:px-8 py-10 lg:py-14">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header Title & GPS Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-md">
                  <Pill className="w-6 h-6 font-black" />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                    البحث الدوائي الشبكي
                    <span className="text-xs px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-bold">
                      العراق
                    </span>
                  </h1>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 font-medium">
                ابحث عن أي دواء أو علاج واكتشف الصيدليات المتوفر لديها جغرافياً مع الأسعار والتواصل المباشر.
              </p>
            </div>

            {/* GPS Locate Button */}
            <button
              onClick={handleGetGpsLocation}
              disabled={gpsLoading}
              className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer shadow-xs ${
                userCoords
                  ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/20'
                  : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700'
              }`}
            >
              <LocateFixed className={`w-4 h-4 ${gpsLoading ? 'animate-spin' : ''}`} />
              <span>{userCoords ? 'موقعي نشط 📍 (الأقرب إليك)' : 'تحديد أقرب الصيدليات لموقعي'}</span>
            </button>
          </div>

          {gpsError && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs font-bold text-amber-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{gpsError}</span>
            </div>
          )}

          {/* Main Search Input Bar */}
          <div className="relative shadow-2xl rounded-3xl">
            <Search className="w-5 h-5 absolute right-4 top-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="اكتب اسم الدواء التجاري أو العلمي (مثل: Panadol, Augmentin, أوميبرازول)..."
              className="w-full pr-12 pl-10 py-4 bg-slate-900/90 border border-slate-700 rounded-3xl text-sm font-bold text-white placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-inner"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute left-4 top-4 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Filters Bar: Governorates, District, 24 Hours */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {/* 24h Night Shift Filter */}
            <button
              onClick={() => setOnly24Hours(!only24Hours)}
              className={`px-4 py-2 rounded-2xl text-xs font-black whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                only24Hours
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'bg-slate-900 text-amber-300 border border-amber-500/30 hover:bg-slate-800'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>صيدليات خافرة 24 ساعة 🌙</span>
            </button>

            {/* All Iraq button */}
            <button
              onClick={() => handleSelectGovernorate('')}
              className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                !governorate
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-xs'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
              }`}
            >
              كل العراق
            </button>

            {/* Governorates list */}
            {Array.from(
              new Set([
                ...uniqueGovernorates,
                'كربلاء',
                'النجف',
                'بغداد',
                'البصرة',
                'بابل',
                'أربيل',
                'نينوى',
                'السليمانية',
                'كركوك',
                'ديالى',
              ]),
            ).map((gov) => (
              <button
                key={gov}
                onClick={() => handleSelectGovernorate(gov)}
                className={`px-4 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                  governorate === gov
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-xs'
                    : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                }`}
              >
                {gov}
              </button>
            ))}
          </div>

          {/* District selector if governorate selected */}
          {governorate && uniqueDistricts.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
              <span className="text-xs font-bold text-slate-400 whitespace-nowrap">المنطقة / القضاء:</span>
              <button
                onClick={() => setDistrict('')}
                className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                  !district ? 'bg-indigo-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-400'
                }`}
              >
                الكل
              </button>
              {uniqueDistricts.map((dist) => (
                <button
                  key={dist}
                  onClick={() => setDistrict(dist)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                    district === dist ? 'bg-indigo-600 text-white' : 'bg-slate-900 border border-slate-800 text-slate-400'
                  }`}
                >
                  {dist}
                </button>
              ))}
            </div>
          )}

          {/* Quick Search Chips */}
          {!searchTerm && (
            <div className="pt-2">
              <div className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                الأدوية الأكثر طلباً في الصيدليات:
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {quickSearchChips.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => setSearchTerm(chip)}
                    className="px-3 py-1.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Results Container Section */}
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-8 flex-1 space-y-8">
        {loading ? (
          <div className="text-center py-20 space-y-4">
            <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm font-bold text-slate-400">جاري البحث في الصيدليات وقواعد البيانات...</p>
          </div>
        ) : results.length === 0 && alternatives.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center mx-auto text-slate-600">
              <Pill className="w-8 h-8 stroke-[1.5]" />
            </div>
            <h4 className="text-base font-bold text-slate-300">
              {searchTerm ? 'لم يتم العثور على صيدلية متوفر لديها حالياً' : 'ابحث باسم أي دواء في الصيدليات'}
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              اكتب اسم العلاج التجاري أو العلمي لمعرفة الصيدليات المتوفر لديها في منطقتك، مع إمكانية التواصل الفوري عبر الواتساب.
            </p>
          </div>
        ) : (
          <>
            {/* Primary Search Results */}
            {results.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1">
                  <span>الصيدليات المتوفر لديها الدواء ({results.length})</span>
                  <span>{userCoords ? 'مرتب حسب الأقرب لموقعك 📍' : 'الأقل سعراً'}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {results.map((item) => renderPharmacyCard(item, false))}
                </div>
              </div>
            )}

            {/* Smart Generic Alternatives Section */}
            {alternatives.length > 0 && (
              <div className="space-y-4 pt-6 border-t border-slate-800">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-indigo-400" />
                    <div>
                      <h3 className="text-sm font-black text-indigo-300">
                        بدائل دوائية متطابقة بنفس المادة الفعالة والتركيز ({alternatives.length})
                      </h3>
                      <p className="text-[11px] text-slate-400">تحتوي على نفس التركيب العلمي ومتوفرة في صيدليات مجاورة</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {alternatives.map((item) => renderPharmacyCard(item, true))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 px-6 py-6 text-center text-xs text-slate-500 font-medium">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-black text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>منصة دوائي للبحث الشبكي الموحد للصيدليات المعتمدة</span>
          </div>
          <div>جميع الحقوق محفوظة © {new Date().getFullYear()}</div>
        </div>
      </footer>
    </div>
  );
};
