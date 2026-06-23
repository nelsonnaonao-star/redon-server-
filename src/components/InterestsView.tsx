import React, { useState, useEffect } from 'react';
import { InterestNews } from '../types';
import { loadInterestNews } from '../lib/supabaseData';
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  ArrowRightLeft, 
  RefreshCcw, 
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
  const [usdInput, setUsdInput] = useState('');
  const [vesResult, setVesResult] = useState('');
  const [eurResult, setEurResult] = useState('');

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

  const handleClear = () => {
    setUsdInput('');
    setVesResult('');
    setEurResult('');
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
            <div className="bg-gradient-to-br from-emerald-50/40 to-white dark:from-slate-800/40 dark:to-slate-950 border border-emerald-500/20 hover:shadow-md transition-all rounded-2xl p-4">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block">Dólar (USD)</span>
              <span className="text-emerald-600 dark:text-emerald-400 text-2xl font-bold tracking-tight mt-0.5 block">
                {usdRate.toFixed(2)}
              </span>
              <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                usdChange >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {usdChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {usdChange >= 0 ? '+' : ''}{usdChange.toFixed(2)}%
              </span>
            </div>
            <div className="bg-gradient-to-br from-blue-50/40 to-white dark:from-slate-800/40 dark:to-slate-950 border border-blue-500/20 hover:shadow-md transition-all rounded-2xl p-4">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block">Euro (EUR)</span>
              <span className="text-blue-600 dark:text-blue-400 text-2xl font-bold tracking-tight mt-0.5 block">
                {eurRate.toFixed(2)}
              </span>
              <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                eurChange >= 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {eurChange >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {eurChange >= 0 ? '+' : ''}{eurChange.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Interactive Micro Calculator — high-end financial widget */}
          <div className="pt-3 border-t border-slate-100/70 dark:border-slate-700/60">
            <div className="flex items-center justify-between mb-3 px-0.5">
              <div className="flex items-center gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold uppercase tracking-wider">Calculadora Rápida</span>
              </div>
              <button
                onClick={handleClear}
                className="text-[9px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-semibold uppercase tracking-wide transition-colors cursor-pointer"
              >
                Limpiar
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative shadow-sm rounded-xl">
                <span className="absolute left-3 text-xs font-bold text-slate-400 dark:text-slate-500 top-3 z-10">$</span>
                <input 
                  type="number" 
                  value={usdInput}
                  onChange={(e) => handleConvert(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm font-bold pl-7 pr-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#3390ec]/20 focus:border-[#3390ec] transition-all"
                  title="Monto en USD"
                  placeholder="0.00"
                />
              </div>
              <div className="flex-1 relative shadow-sm rounded-xl">
                <span className="absolute right-2.5 text-[10px] font-bold text-white bg-[#3390ec] px-1.5 py-0.5 rounded-md top-2.5 z-10">USD</span>
                <div className="w-full bg-gradient-to-r from-blue-50 to-white dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm font-bold pl-3 pr-11 py-2.5 rounded-xl truncate">
                  {vesResult} <span className="text-[10px] text-slate-400 font-medium">Bs</span>
                </div>
              </div>
              <div className="flex-1 relative shadow-sm rounded-xl">
                <span className="absolute right-2.5 text-[10px] font-bold text-white bg-emerald-500 px-1.5 py-0.5 rounded-md top-2.5 z-10">EUR</span>
                <div className="w-full bg-gradient-to-r from-emerald-50 to-white dark:from-slate-800 dark:to-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm font-bold pl-3 pr-11 py-2.5 rounded-xl truncate">
                  {eurResult} <span className="text-[10px] text-slate-400 font-medium">Bs</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>



    </div>
  );
}
