import React, { useState, useEffect, useRef } from 'react';
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
  Mic,
  MicOff,
  Check,
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

  // Voice Search States
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  // Platform Live Stats
  const [stats, setStats] = useState<{
    totalMedicines: number;
    totalPharmacies: number;
    onDutyPharmacies: number;
    governoratesCount: number;
  }>({
    totalMedicines: 15420,
    totalPharmacies: 120,
    onDutyPharmacies: 24,
    governoratesCount: 18,
  });

  // Pharmacy Join Inquiry Modal
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinForm, setJoinForm] = useState({
    pharmacyName: '',
    ownerName: '',
    governorate: 'بغداد',
    phone: '',
  });

  const [results, setResults] = useState<any[]>([]);
  const [alternatives, setAlternatives] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState(false);

  // Popular Therapeutic Categories
  const therapeuticCategories = [
    { label: 'مسكنات وخافض حرارة', term: 'Panadol', icon: '💊' },
    { label: 'مضادات حيوية', term: 'Augmentin', icon: '🧪' },
    { label: 'الضغط والقلب', term: 'Concor', icon: '❤️' },
    { label: 'علاجات السكري', term: 'Glucophage', icon: '🩸' },
    { label: 'المعدة والقولون', term: 'Omeprazole', icon: '🩺' },
    { label: 'فيتامينات ومقويات', term: 'Vitamin D3', icon: '🍊' },
    { label: 'الحساسية والرشح', term: 'Zyrtec', icon: '🫁' },
    { label: 'صحة الأطفال', term: 'Brufen Syrup', icon: '👶' },
  ];

  // Popular Quick Search Chips
  const quickSearchChips = [
    'Panadol Extra',
    'Augmentin 1g',
    'Cataflam 50mg',
    'Amoxil 500mg',
    'Brufen 400mg',
    'Omeprazole 20mg',
    'Vitamin C 1000mg',
    'Zithromax 500mg',
    'Glucophage 500mg',
    'Lipitor 20mg',
  ];

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'ar-IQ'; // Iraqi Arabic locale

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setSearchTerm(transcript);
        }
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      setSpeechSupported(false);
    }
  }, []);

  const toggleVoiceSearch = () => {
    if (!recognitionRef.current) {
      alert('البحث الصوتي غير مدعوم في هذا المتصفح. يرجى تجربة متصفح Google Chrome.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Failed to start speech recognition', err);
        setIsListening(false);
      }
    }
  };

  // Fetch available locations & public stats
  useEffect(() => {
    apiRequest<any[]>('/public/locations')
      .then((data) => setLocations(data || []))
      .catch(() => {});

    apiRequest<any>('/public/stats')
      .then((data) => {
        if (data) {
          setStats(data);
        }
      })
      .catch(() => {});
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
          title: `توفر دواء ${item.tradeName} عبر دوائي`,
          text: text,
          url: window.location.href,
        });
      } catch {
        // Fallback
      }
    } else {
      navigator.clipboard.writeText(text);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleSharePlatform = () => {
    const text = `منصة دوائي 🇮🇶💊 — ابحث عن أي دواء واعرف الصيدليات المتوفر لديها جغرافياً والأسعار والصيدليات الخافرة 24 ساعة: ${window.location.origin}`;
    if (navigator.share) {
      navigator.share({ title: 'منصة دوائي العراق', text, url: window.location.origin }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 3000);
    }
  };

  const handleJoinPharmacySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const msg = encodeURIComponent(
      `السلام عليكم إدارة دوائي، أرغب بتسجيل صيدليتي (${joinForm.pharmacyName}) في ${joinForm.governorate} - المالك: ${joinForm.ownerName} - هاتف: ${joinForm.phone}`,
    );
    window.open(`https://wa.me/9647700000000?text=${msg}`, '_blank');
    setShowJoinModal(false);
  };

  // Render a Pharmacy Result Card
  const renderPharmacyCard = (item: any, isAlt: boolean = false) => (
    <div
      key={item.id}
      className={`rounded-3xl p-5 shadow-xs border flex flex-col justify-between gap-4 transition-all hover:shadow-lg ${
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
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-[11px] font-black animate-pulse">
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
        <div className="mt-4 p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800/80 space-y-2">
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

      {/* Action Buttons: WhatsApp Direct Booking, Call, Google Maps Directions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800/80">
        {/* WhatsApp Direct Booking Button */}
        {item.whatsappUrl ? (
          <a
            href={item.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer"
          >
            <MessageCircle className="w-4 h-4 fill-slate-950" />
            <span>احجز عبر واتساب 💬</span>
          </a>
        ) : item.phone ? (
          <a
            href={`tel:${item.phone}`}
            className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition-all active:scale-95"
          >
            <Phone className="w-4 h-4" />
            <span>اتصال بالصيدلية</span>
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
          className="py-2.5 px-3 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/60 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
          title="الاتجاهات في خرائط جوجل"
        >
          <Navigation className="w-4 h-4 text-indigo-400" />
          <span>المسار بالخريطة</span>
        </a>

        {/* Share Button */}
        <button
          onClick={() => handleShare(item)}
          className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <Share2 className="w-4 h-4 text-slate-400" />
          <span>{copiedId === item.id ? 'تم النسخ!' : 'مشاركة'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-emerald-500 selection:text-slate-950">
      {/* 1. Top Navbar */}
      <nav className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-4 sm:px-8 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-md shadow-emerald-500/20">
              <Pill className="w-5 h-5 font-black" />
            </div>
            <div>
              <span className="font-black text-white text-base tracking-tight">منصة دوائي</span>
              <span className="mr-1.5 text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full font-bold">
                العراق 🇮🇶
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSharePlatform}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              {shareSuccess ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{shareSuccess ? 'تم نسخ الرابط' : 'مشاركة المنصة'}</span>
            </button>

            <button
              onClick={() => setShowJoinModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-xs font-black shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>انضمام الصيدليات 🚀</span>
            </button>
          </div>
        </div>
      </nav>

      {/* 2. Hero Search Section */}
      <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-b border-slate-800/80 px-4 sm:px-8 py-10 lg:py-14">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header Title */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-black">
              <Sparkles className="w-3.5 h-3.5" />
              <span>محرك البحث الدوائي الوطني الموحد للصيدليات المعتمدة</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              ابحث عن أي دواء واكتشف الصيدلية الأقرب المتوفر لديها 💊
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium max-w-xl mx-auto">
              اكتشف توفر الأدوية، الأسعار الرسمية، الصيدليات الخافرة ليلاً، واحجز علاجك مباشرة بنقرة واحدة عبر الواتساب.
            </p>

            {/* Live Metrics Row */}
            <div className="flex items-center justify-center gap-3 sm:gap-6 pt-2 flex-wrap text-xs text-slate-300 font-bold">
              <div className="flex items-center gap-1.5 bg-slate-800/60 px-3 py-1 rounded-full border border-slate-800">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>+{stats.totalMedicines.toLocaleString()} صنف دوائي مفهرس</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-800/60 px-3 py-1 rounded-full border border-slate-800">
                <Moon className="w-3 h-3 text-amber-400" />
                <span>صيدليات خافرة 24/7</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-800/60 px-3 py-1 rounded-full border border-slate-800">
                <MapPin className="w-3 h-3 text-rose-400" />
                <span>تغطية لكافة محافظات العراق</span>
              </div>
            </div>
          </div>

          {/* Main Search Input Bar with Voice Search */}
          <div className="relative shadow-2xl rounded-3xl mt-4">
            <Search className="w-5 h-5 absolute right-4 top-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="اكتب اسم الدواء التجاري أو العلمي أو العرض (مثال: Panadol, Augmentin, صداع)..."
              className="w-full pr-12 pl-24 py-4 bg-slate-900/90 border border-slate-700 rounded-3xl text-sm font-bold text-white placeholder:text-slate-500 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 shadow-inner"
            />

            {/* Clear & Voice Search Buttons */}
            <div className="absolute left-3 top-2.5 flex items-center gap-1.5">
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="p-2 text-slate-400 hover:text-white cursor-pointer"
                  title="مسح البحث"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleVoiceSearch}
                  className={`p-2 rounded-2xl transition-all cursor-pointer ${
                    isListening
                      ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/30'
                      : 'bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700'
                  }`}
                  title="البحث الصوتي (تحدث باسم الدواء)"
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>

          {/* Voice Listening Active Wave */}
          {isListening && (
            <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-2xl text-xs font-black text-rose-300 flex items-center justify-center gap-2 animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span>جاري الاستماع إليك... تكلّم باسم الدواء الآن 🎙️</span>
            </div>
          )}

          {/* GPS Error Alert */}
          {gpsError && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs font-bold text-amber-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{gpsError}</span>
            </div>
          )}

          {/* Geographic & 24H Quick Filters */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 pt-1">
            {/* GPS Locate Button */}
            <button
              onClick={handleGetGpsLocation}
              disabled={gpsLoading}
              className={`px-3.5 py-2 rounded-2xl text-xs font-black whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs ${
                userCoords
                  ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/20'
                  : 'bg-slate-900 text-slate-200 border border-slate-800 hover:bg-slate-800'
              }`}
            >
              <LocateFixed className={`w-3.5 h-3.5 ${gpsLoading ? 'animate-spin' : ''}`} />
              <span>{userCoords ? 'موقعي نشط 📍 (الأقرب إليك)' : 'الصيدليات الأقرب إليّ 📍'}</span>
            </button>

            {/* 24h Night Shift Filter */}
            <button
              onClick={() => setOnly24Hours(!only24Hours)}
              className={`px-3.5 py-2 rounded-2xl text-xs font-black whitespace-nowrap transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
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
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
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
                className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
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

          {/* Therapeutic Categories & Quick Chips */}
          {!searchTerm && (
            <div className="space-y-3 pt-2">
              {/* Category Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {therapeuticCategories.map((cat, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSearchTerm(cat.term)}
                    className="p-2.5 bg-slate-900/90 hover:bg-slate-850 text-slate-200 border border-slate-800 hover:border-emerald-500/40 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer text-right shadow-2xs hover:scale-[1.02]"
                  >
                    <span className="text-base">{cat.icon}</span>
                    <span className="truncate">{cat.label}</span>
                  </button>
                ))}
              </div>

              {/* Quick Drugs Chips */}
              <div className="pt-2">
                <div className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  الأدوية الأكثر طلباً في الصيدليات الآن:
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
            </div>
          )}
        </div>
      </div>

      {/* 3. Results Container Section */}
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-8 flex-1 space-y-8">
        {loading ? (
          <div className="text-center py-20 space-y-4">
            <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm font-bold text-slate-400">جاري البحث في الصيدليات وسجلات الأدوية المعتمدة...</p>
          </div>
        ) : results.length === 0 && alternatives.length === 0 ? (
          <div className="text-center py-16 px-4 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
            <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center mx-auto text-slate-600">
              <Pill className="w-8 h-8 stroke-[1.5]" />
            </div>
            <h4 className="text-base font-bold text-slate-300">
              {searchTerm ? 'لم يتم العثور على صيدلية متوفر لديها هذا الصنف حالياً' : 'ابحث باسم أي دواء في شبكة الصيدليات'}
            </h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              اكتب اسم العلاج التجاري أو العلمي لمعرفة الصيدليات المتوفر لديها في منطقتك، مع إمكانية الحجز المباشر عبر الواتساب.
            </p>
          </div>
        ) : (
          <>
            {/* Primary Search Results */}
            {results.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1">
                  <span>الصيدليات المتوفر لديها الدواء ({results.length})</span>
                  <span>{userCoords ? 'مرتب حسب الأقرب لموقعك 📍' : 'الأقل سعراً والأحدث'}</span>
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

        {/* 4. Promotional Banner for Pharmacies to Join */}
        <div className="p-6 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 rounded-3xl border border-indigo-800/60 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1.5 text-center md:text-right">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-full text-[11px] font-black">
              <Building2 className="w-3.5 h-3.5" />
              <span>لأصحاب الصيدليات والمذاخر</span>
            </div>
            <h3 className="text-lg font-black text-white">هل تمتلك صيدلية في العراق؟ انضم إلى شبكة دوائي 🚀</h3>
            <p className="text-xs text-slate-400 max-w-lg font-medium">
              اربط صيدليتك بالمنصة لتظهر أدويتك لآلاف المرضى يومياً في منطقتك وتستقبل الحجوزات والطلبات المباشرة فوراً.
            </p>
          </div>

          <button
            onClick={() => setShowJoinModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-2xl text-xs font-black shadow-lg shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer whitespace-nowrap"
          >
            طلب انضمام صيدلية معتمدة ⚡
          </button>
        </div>

        {/* 5. Health & Medical Disclaimer */}
        <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-800/80 text-xs text-slate-400 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-slate-300">إرشادات السلامة الدوائية:</div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              منصة "دوائي" هي محرك بحث جغرافي للمساعدة في العثور على الصيدليات وتوفر الأدوية. يرجى دائماً استشارة الطبيب أو الصيدلاني المرخص قبل تناول أي دواء والالتزام بالوصفة الطبية المعتمدة.
            </p>
          </div>
        </div>
      </div>

      {/* 6. Pharmacy Join Inquiry Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white text-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-base">تسجيل صيدلية في شبكة دوائي</h3>
              </div>
              <button
                onClick={() => setShowJoinModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 font-medium">
              املأ البيانات التالية للتواصل المباشر مع فريق الإدارة وتفعيل اشتراك صيدليتك وربط مخزونها بالبحث العام:
            </p>

            <form onSubmit={handleJoinPharmacySubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الصيدلية *</label>
                <input
                  type="text"
                  required
                  value={joinForm.pharmacyName}
                  onChange={(e) => setJoinForm({ ...joinForm, pharmacyName: e.target.value })}
                  placeholder="مثال: صيدلية النور"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الدكتور / صاحب الصيدلية *</label>
                <input
                  type="text"
                  required
                  value={joinForm.ownerName}
                  onChange={(e) => setJoinForm({ ...joinForm, ownerName: e.target.value })}
                  placeholder="مثال: د. مصطفى كمال"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المحافظة *</label>
                  <select
                    value={joinForm.governorate}
                    onChange={(e) => setJoinForm({ ...joinForm, governorate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold"
                  >
                    {['بغداد', 'البصرة', 'أربيل', 'النجف', 'كربلاء', 'بابل', 'نينوى', 'السليمانية', 'كركوك', 'ديالى', 'ذي قار', 'ميسان', 'واسط', 'المثنى', 'صلاح الدين', 'الأنبار', 'القادسية'].map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف / واتساب *</label>
                  <input
                    type="text"
                    required
                    value={joinForm.phone}
                    onChange={(e) => setJoinForm({ ...joinForm, phone: e.target.value })}
                    placeholder="07701234567"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/30 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>إرسال الطلب عبر واتساب الإدارة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Footer */}
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
