import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, AlertCircle } from 'lucide-react';

export default function DollarRate() {
  const [bcvRate, setBcvRate] = useState<number | null>(null);
  const [change, setChange] = useState<'up' | 'down' | 'same'>('same');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let prev = 0;
    const fetchRate = async () => {
      try {
        console.log('[BCV] Fetching...');
        const res = await fetch('https://tasa-bcv-api-production.up.railway.app/v1/rates/latest');
        console.log('[BCV] Status:', res.status);
        const json = await res.json();
        console.log('[BCV] JSON:', json);
        const rate = json?.usd || 0;
        console.log('[BCV] Rate:', rate);
        if (rate > 0) {
          setBcvRate(rate);
          setChange(prev === 0 ? 'same' : rate > prev ? 'up' : 'down');
          prev = rate;
          setError(false);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('[BCV] Fetch error:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchRate();
    const interval = setInterval(fetchRate, 120000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return null;

  return (
    <div className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/30 text-xs font-semibold whitespace-nowrap">
      <DollarSign className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
      {error || !bcvRate ? (
        <span className="text-red-500 dark:text-red-400">BCV no disponible</span>
      ) : (
        <>
          <span className="text-emerald-700 dark:text-emerald-300">
            BCV: {bcvRate.toFixed(2)} Bs/USD
          </span>
          {change === 'up' && <TrendingUp className="w-3 h-3 text-emerald-500" />}
          {change === 'down' && <TrendingDown className="w-3 h-3 text-red-500" />}
        </>
      )}
    </div>
  );
}
