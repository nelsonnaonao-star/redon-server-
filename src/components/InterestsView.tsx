import React, { useState, useEffect } from 'react';
import { InterestNews } from '../types';
import { loadInterestNews } from '../lib/supabaseData';
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  Heart, 
  Share2, 
  Newspaper, 
  ArrowRightLeft, 
  RefreshCcw, 
  Check,
  Bookmark,
  Sparkles
} from 'lucide-react';

export default function InterestsView() {
  const [news, setNews] = useState<InterestNews[]>([]);
  const [usdRate, setUsdRate] = useState(607.39);
  const [eurRate, setEurRate] = useState(697.36);
  const [usdChange, setUsdChange] = useState(0);
  const [eurChange, setEurChange] = useState(0);

  useEffect(() => {
    loadInterestNews().then(setNews);
    fetch('https://tasa-bcv-api-production.up.railway.app/v1/rates/latest')
      .then(r => r.json())
      .then(json => {
        if (json?.usd) setUsdRate(json.usd);
        if (json?.eur) setEurRate(json.eur);
      })
      .catch(() => {});
  }, []);
  const [usdInput, setUsdInput] = useState('10');
  const [vesResult, setVesResult] = useState('6073.90');
  const [eurResult, setEurResult] = useState('6973.65');

  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [showToast, setShowToast] = useState(false);

  const handleConvert = (val: string) => {
    setUsdInput(val);
    const num = parseFloat(val);
    if (!isNaN(num) && val !== '') {
      setVesResult((num * usdRate).toFixed(2));
      setEurResult((num * eurRate).toFixed(2));
    } else {
      setVesResult('0.00');
      setEurResult('0.00');
    }
  };

  const handleRefreshRate = () => {
    const prevUsd = usdRate;
    const prevEur = eurRate;
    fetch('https://tasa-bcv-api-production.up.railway.app/v1/rates/latest')
      .then(r => r.json())
      .then(json => {
        if (json?.usd) {
          setUsdRate(json.usd);
          setUsdChange(((json.usd - prevUsd) / prevUsd) * 100);
          const num = parseFloat(usdInput);
          if (!isNaN(num)) {
            setVesResult((num * json.usd).toFixed(2));
            setEurResult((num * (json.eur || eurRate)).toFixed(2));
          }
        }
        if (json?.eur) {
          setEurRate(json.eur);
          setEurChange(((json.eur - prevEur) / prevEur) * 100);
          const num = parseFloat(usdInput);
          if (!isNaN(num)) setEurResult((num * json.eur).toFixed(2));
        }
      })
      .catch(() => {});

    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const handleLike = (id: string) => {
    if (likedIds.includes(id)) {
      setLikedIds(prev => prev.filter(x => x !== id));
      setNews(prev => prev.map(item => item.id === id ? { ...item, likes: item.likes - 1 } : item));
    } else {
      setLikedIds(prev => [...prev, id]);
      setNews(prev => prev.map(item => item.id === id ? { ...item, likes: item.likes + 1 } : item));
    }
  };

  const handleBookmark = (id: string) => {
    if (bookmarkedIds.includes(id)) {
      setBookmarkedIds(prev => prev.filter(x => x !== id));
    } else {
      setBookmarkedIds(prev => [...prev, id]);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5] dark:bg-slate-900 overflow-y-auto pb-4 relative font-sans transition-colors duration-300">
      
      {/* Mini Refresh Toast */}
      {showToast && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900/90 dark:bg-slate-850/95 text-white text-xs px-4 py-2.5 rounded-full flex items-center gap-2 shadow-lg backdrop-blur-md border border-transparent dark:border-slate-700">
          <RefreshCcw className="w-3.5 h-3.5 text-[#3390ec] animate-spin" />
          <span>Tasa de cambio RED ON sincronizada con éxito</span>
        </div>
      )}

      {/* --- FINANCIAL EXCHANGE BOARD (Tasa de cambio) --- */}
      <div className="px-4 pt-4 mb-5">
        <div className="bg-white dark:bg-slate-800 rounded-[24px] p-5 shadow-[0_1px_2.5px_rgba(0,0,0,0.03)] border border-slate-100 dark:border-slate-700 transition-colors duration-300">
          
          {/* Board Header */}
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-950/45 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center shadow-sm">
                <DollarSign className="w-5 h-5 font-bold" />
              </div>
              <div>
                <h3 className="text-slate-900 dark:text-white font-bold text-sm tracking-tight">Indicadores Económicos</h3>
                <p className="text-[10px] text-slate-455 dark:text-slate-400 font-semibold tracking-wide uppercase">Tasa promedio RED ON USD</p>
              </div>
            </div>

            <button 
              onClick={handleRefreshRate}
              className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 rounded-full transition-all cursor-pointer active:rotate-180 duration-500"
              title="Sincronizar tasa"
            >
              <RefreshCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Rate display - USD & EUR */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-[#f0f2f5]/60 dark:bg-slate-900/40 hover:bg-[#f0f2f5] dark:hover:bg-slate-900/70 transition-all rounded-2xl p-4 shadow-xs border border-transparent dark:border-slate-700/60">
              <span className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider block">Dólar (USD)</span>
              <span className="text-slate-900 dark:text-white text-xl font-black tracking-tight mt-0.5 block">
                {usdRate.toFixed(2)}
              </span>
              <div className={`inline-flex items-center gap-0.5 mt-1 px-1.5 py-0.5 rounded-lg text-[10px] font-bold ${usdChange >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600' : 'bg-red-50 dark:bg-red-950/50 text-red-500'}`}>
                {usdChange >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                {usdChange >= 0 ? '+' : ''}{usdChange.toFixed(2)}%
              </div>
            </div>
            <div className="bg-[#f0f2f5]/60 dark:bg-slate-900/40 hover:bg-[#f0f2f5] dark:hover:bg-slate-900/70 transition-all rounded-2xl p-4 shadow-xs border border-transparent dark:border-slate-700/60">
              <span className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider block">Euro (EUR)</span>
              <span className="text-slate-900 dark:text-white text-xl font-black tracking-tight mt-0.5 block">
                {eurRate.toFixed(2)}
              </span>
              <div className={`inline-flex items-center gap-0.5 mt-1 px-1.5 py-0.5 rounded-lg text-[10px] font-bold ${eurChange >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600' : 'bg-red-50 dark:bg-red-950/50 text-red-500'}`}>
                {eurChange >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                {eurChange >= 0 ? '+' : ''}{eurChange.toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Interactive Micro Calculator inside */}
          <div className="pt-2.5 border-t border-slate-100/70 dark:border-slate-700/60">
            <div className="flex items-center justify-between mb-2 px-0.5">
              <span className="text-[10px] text-slate-450 dark:text-slate-400 font-bold uppercase tracking-wider">Calculadora Rápida</span>
              <button
                onClick={() => handleConvert('')}
                className="text-[9px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-semibold uppercase tracking-wide transition-colors cursor-pointer"
              >
                Limpiar
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-2.5 text-xs font-bold text-slate-400 dark:text-slate-500 top-2.5">$</span>
                <input 
                  type="number" 
                  value={usdInput}
                  onChange={(e) => handleConvert(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-xs font-bold pl-6 pr-2 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:bg-white dark:focus:bg-slate-900"
                  title="Monto"
                />
              </div>
              <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
              <div className="flex-1 relative">
                <span className="absolute right-2.5 text-[9px] font-bold text-[#3390ec] dark:text-[#3390ec] top-2.5">USD</span>
                <div className="w-full bg-blue-50 dark:bg-blue-950/30 border border-blue-100/50 dark:border-blue-800/40 text-slate-800 dark:text-slate-200 text-xs font-bold pl-2 pr-9 py-2 rounded-xl truncate">
                  {vesResult}
                </div>
              </div>
              <div className="flex-1 relative">
                <span className="absolute right-2.5 text-[9px] font-bold text-emerald-500 dark:text-emerald-400 top-2.5">EUR</span>
                <div className="w-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100/50 dark:border-emerald-800/40 text-slate-800 dark:text-slate-200 text-xs font-bold pl-2 pr-9 py-2 rounded-xl truncate">
                  {eurResult}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* --- FEED DE INTERESES (Noticias y Temas) --- */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-t-[32px] px-6 pt-6 shadow-[0_-2px_12px_rgba(0,0,0,0.02)] border-t border-transparent dark:border-slate-800 transition-colors duration-300">
        <div className="max-w-md mx-auto">
          
          <div className="flex items-center gap-2 mb-4 px-1">
            <Newspaper className="w-4.5 h-4.5 text-[#3390ec]" />
            <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-500 tracking-wider uppercase">Feed de Mi Interés</h2>
          </div>

          <div className="space-y-4 pb-4">
            {news.map((item) => {
              const isLiked = likedIds.includes(item.id);
              const isBookmarked = bookmarkedIds.includes(item.id);

              return (
                <div 
                  key={item.id} 
                  className="bg-[#f8fafc]/70 dark:bg-slate-800/40 hover:bg-[#f8fafc] dark:hover:bg-slate-800/70 border border-slate-100 dark:border-slate-700/60 p-4 rounded-2xl shadow-[0_1px_1.5px_rgba(0,0,0,0.01)] space-y-3 transition-colors flex flex-col justify-between"
                >
                  <div className="flex gap-3 justify-between items-start">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      {/* Category Label */}
                      <span className="inline-block text-[9px] font-bold tracking-widest text-[#3390ec] bg-[#3390ec]/8 dark:bg-[#3390ec]/15 px-2 py-0.5 rounded-full select-none">
                        {item.category}
                      </span>
                      <h4 className="text-slate-900 dark:text-slate-105 font-bold text-xs leading-snug">
                        {item.title}
                      </h4>
                    </div>

                    {/* Optional small image preview */}
                    {item.image && (
                      <img 
                        src={item.image} 
                        alt="News preview" 
                        className="w-16 h-16 rounded-xl object-cover border border-slate-100 dark:border-slate-700/60 flex-shrink-0"
                      />
                    )}
                  </div>

                  {/* News footer metadata */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 dark:border-slate-705">
                    <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-[10px]">
                      <span className="font-semibold text-slate-500 dark:text-slate-400">{item.source}</span>
                      <span>•</span>
                      <span>{item.time}</span>
                    </div>

                    {/* Reactions */}
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleLike(item.id)}
                        className={`p-1.5 rounded-lg flex items-center gap-1 hover:bg-slate-200/50 dark:hover:bg-slate-700/55 cursor-pointer transition-colors ${
                          isLiked ? 'text-rose-500 bg-rose-50/50 dark:bg-rose-950/20' : 'text-slate-450 dark:text-slate-400'
                        }`}
                        title="Me gusta"
                      >
                        <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-rose-500' : ''}`} />
                        <span className="text-[10px] font-semibold">{item.likes}</span>
                      </button>

                      <button 
                        onClick={() => handleBookmark(item.id)}
                        className={`p-1.5 rounded-lg hover:bg-slate-250/50 dark:hover:bg-slate-700/55 cursor-pointer transition-colors ${
                          isBookmarked ? 'text-[#3390ec] bg-blue-50/50 dark:bg-blue-950/20' : 'text-slate-450 dark:text-slate-400'
                        }`}
                        title="Guardar noticia"
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-[#3390ec]' : ''}`} />
                      </button>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>

        </div>
      </div>

    </div>
  );
}
