import React, { useState, useEffect } from 'react';
import {
  X,
  Mic,
  MicOff,
  Sparkles,
  Search,
  ShoppingCart,
  AlertTriangle,
} from 'lucide-react';
import { apiRequest } from '../api/client';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';

interface SmartSearchModalProps {
  onClose: () => void;
  onAddToCart?: (medicine: any, unitType: 'PACK' | 'UNIT') => void;
  initialQuery?: string;
  autoStartVoice?: boolean;
}

export const SmartSearchModal: React.FC<SmartSearchModalProps> = ({
  onClose,
  onAddToCart,
  initialQuery = '',
  autoStartVoice = false,
}) => {
  const [queryText, setQueryText] = useState(initialQuery);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchResponse, setSearchResponse] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Voice recognition hook
  const {
    isListening,
    transcript,
    error: voiceError,
    isSupported,
    startListening,
    stopListening,
  } = useVoiceRecognition((finalText) => {
    setQueryText(finalText);
    executeSearch(finalText, inStockOnly);
  });

  // Keep input synchronized with voice transcript while speaking
  useEffect(() => {
    if (transcript) {
      setQueryText(transcript);
    }
  }, [transcript]);

  // If autoStartVoice is true on open, start listening immediately
  useEffect(() => {
    if (autoStartVoice && isSupported) {
      startListening();
    } else if (initialQuery.trim()) {
      executeSearch(initialQuery, inStockOnly);
    }
  }, []);

  const executeSearch = async (text: string, inStock: boolean) => {
    if (!text || !text.trim()) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await apiRequest<any>('/medicines/ai-smart-search', {
        method: 'POST',
        body: JSON.stringify({
          query: text.trim(),
          inStockOnly: inStock,
        }),
      });

      if (response && response.success) {
        setSearchResponse(response);
      } else {
        setErrorMessage('لم يتم العثور على نتائج مطابقة');
      }
    } catch (err: any) {
      console.error('Smart search error:', err);
      setErrorMessage(err.message || 'فشل البحث بالذكاء الاصطناعي');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isListening) stopListening();
    executeSearch(queryText, inStockOnly);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQueryText(suggestion);
    if (isListening) stopListening();
    executeSearch(suggestion, inStockOnly);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-900 via-purple-950 to-slate-900 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center font-black">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <h3 className="font-black text-base flex items-center gap-2">
                <span>المساعد الصيدلاني والبحث الصوتي الذكي</span>
                <span className="px-2 py-0.5 bg-amber-400/20 text-amber-300 border border-amber-400/30 rounded-full text-[10px] font-bold">
                  AI Natural Search & Voice 🎙️
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                تحدث أو اكتب بلهجتك الطبيعية للبحث عن البدائل، المواد الفعالة، والأشكال الدوائية
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (isListening) stopListening();
              onClose();
            }}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input Bar with Voice Button */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3 shrink-0">
          <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
              <input
                type="text"
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                placeholder="تحدث أو اكتب: 'أريد بديل أوجمنتين 1 غرام'، 'أدوية باراسيتامول للأطفال شراب'..."
                className="w-full pl-3 pr-10 py-3 bg-white border-2 border-slate-300 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 placeholder-slate-400 focus:border-indigo-600 focus:outline-hidden transition-all shadow-inner"
              />
            </div>

            {/* Microphone Button */}
            {isSupported && (
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                className={`p-3 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95 ${
                  isListening
                    ? 'bg-rose-600 hover:bg-rose-700 text-white ring-4 ring-rose-400/40 animate-pulse'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
                title={isListening ? 'اضغط لإيقاف الاستماع' : 'اضغط للتحدث بالمايكروفون'}
              >
                {isListening ? <MicOff className="w-5 h-5 animate-bounce" /> : <Mic className="w-5 h-5" />}
              </button>
            )}

            <button
              type="submit"
              disabled={loading || !queryText.trim()}
              className="px-5 py-3 bg-slate-900 hover:bg-black text-white rounded-2xl text-xs font-black transition-all cursor-pointer disabled:bg-slate-300 shadow-md shrink-0"
            >
              {loading ? 'جاري التحليل...' : 'بحث ذكي'}
            </button>
          </form>

          {/* Voice Listening Active Wave Animation */}
          {isListening && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between animate-in fade-in">
              <div className="flex items-center gap-2 text-xs font-black text-rose-800">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-ping" />
                <span>جاري الاستماع لصوتك الآن... تحدث باسم الدواء أو الاستفسار</span>
              </div>
              <button
                type="button"
                onClick={stopListening}
                className="px-3 py-1 bg-rose-600 text-white rounded-xl text-[11px] font-bold cursor-pointer hover:bg-rose-700"
              >
                تم والبحث ➔
              </button>
            </div>
          )}

          {voiceError && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>{voiceError}</span>
            </div>
          )}

          {/* Quick Suggestions Chips & In-Stock Checkbox */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-500">أمثلة سريعة:</span>
              {[
                'أريد بديل أوجمنتين 1 غرام متوفر عندي',
                'أدوية باراسيتامول للأطفال شراب',
                'مضادات حيوية كبسول بالمخزن',
                'مسكنات ألم أمبولات',
              ].map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSuggestionClick(s)}
                  className="px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-slate-200 hover:border-indigo-300 rounded-xl text-[11px] font-medium transition-all cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700 text-[11px]">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => {
                  setInStockOnly(e.target.checked);
                  if (queryText.trim()) executeSearch(queryText, e.target.checked);
                }}
                className="w-3.5 h-3.5 text-indigo-600 rounded-sm cursor-pointer"
              />
              <span>المتوفر بالمخزن فقط</span>
            </label>
          </div>
        </div>

        {/* Body Content / Results */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-10 h-10 border-3 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-black text-slate-600">
                جاري تحليل قصد الاستفسار ومطابقة المواد الفعالة والبدائل بالذكاء الاصطناعي...
              </p>
            </div>
          ) : errorMessage ? (
            <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-2xl space-y-2">
              <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
              <p className="text-xs font-black text-rose-900">{errorMessage}</p>
            </div>
          ) : searchResponse ? (
            <div className="space-y-4">
              {/* AI Clinical Interpretation Banner */}
              {searchResponse.explanationAr && (
                <div className="p-3.5 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl flex items-start gap-2.5">
                  <Sparkles className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-black text-purple-900 uppercase tracking-wider block">
                      التفسير والتحليل السريري للذكاء الاصطناعي:
                    </span>
                    <p className="text-xs font-bold text-slate-800 mt-0.5">
                      {searchResponse.explanationAr}
                    </p>
                  </div>
                </div>
              )}

              {/* Results Count */}
              <div className="flex items-center justify-between text-xs text-slate-500 font-bold px-1">
                <span>تم العثور على ({searchResponse.resultsCount || 0}) دواء مطابق:</span>
                {searchResponse.intentType === 'ALTERNATIVE' && (
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-black">
                    🔄 تم ترتيب البدائل المتوفرة أولاً
                  </span>
                )}
              </div>

              {/* Medicine Cards */}
              {searchResponse.results && searchResponse.results.length > 0 ? (
                <div className="grid grid-cols-1 gap-2.5">
                  {searchResponse.results.map((item: any) => {
                    const inStock = item.inStock;
                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                          inStock
                            ? 'bg-white border-slate-200 hover:border-indigo-400 shadow-xs'
                            : 'bg-slate-50/70 border-slate-200 opacity-75'
                        }`}
                      >
                        {/* Info */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <b className="text-sm font-black text-slate-900">{item.tradeName}</b>
                            {item.shelfLocation && (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-300 rounded-md text-[10px] font-black font-mono shadow-2xs">
                                📍 الرف: {item.shelfLocation}
                              </span>
                            )}
                            {inStock ? (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black">
                                ✅ متوفر بالمخزن
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded-full text-[10px] font-bold">
                                ❌ غير متوفر حالياً
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                            {item.scientificName && (
                              <span className="font-mono text-slate-700 font-bold">
                                {item.scientificName}
                              </span>
                            )}
                            <span>•</span>
                            <span>{item.dosageForm} {item.strength}</span>
                            {item.manufacturer && (
                              <>
                                <span>•</span>
                                <span className="text-slate-400">{item.manufacturer}</span>
                              </>
                            )}
                          </div>

                          {/* Inventory stock & price numbers */}
                          <div className="flex items-center gap-3 pt-1 text-xs font-mono">
                            <span className="text-slate-700">
                              الرصيد:{' '}
                              <b className="text-indigo-700 font-black">
                                {item.availablePacks} علبة
                              </b>
                              {item.availableStrips > 0 && ` + ${item.availableStrips} شريط`}
                            </span>
                            <span>•</span>
                            <span className="text-slate-700">
                              سعر العلبة:{' '}
                              <b className="text-emerald-700 font-black">
                                {Number(item.sellingPricePack || 0).toLocaleString()} د.ع
                              </b>
                            </span>
                          </div>
                        </div>

                        {/* Add to Cart in POS */}
                        {onAddToCart && inStock && (
                          <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto justify-end">
                            <button
                              onClick={() => onAddToCart(item, 'PACK')}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-xs transition-all cursor-pointer active:scale-95"
                            >
                              <ShoppingCart className="w-3.5 h-3.5" />
                              <span>علبة</span>
                            </button>
                            {item.unitsPerPack > 1 && (
                              <button
                                onClick={() => onAddToCart(item, 'UNIT')}
                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black flex items-center gap-1 shadow-xs transition-all cursor-pointer active:scale-95"
                              >
                                <span>شريط</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs font-bold bg-slate-50 rounded-2xl">
                  لا توجد أدوية متطابقة مع الاستفسار المحدد
                </div>
              )}
            </div>
          ) : (
            /* Empty Initial State Instructions */
            <div className="py-12 text-center space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
                <Mic className="w-8 h-8 animate-pulse" />
              </div>
              <h4 className="text-base font-black text-slate-900">
                تحدث أو اكتب استفسارك الطبي بحرية كاملة
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                يفهم النظام اللهجة العراقية والعربية والمصطلحات الطبية ويبحث عن البدائل والمكافئات الحيوية وأرصدة المخزون بلحظات.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={() => {
              if (isListening) stopListening();
              onClose();
            }}
            className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-black cursor-pointer transition-all"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
