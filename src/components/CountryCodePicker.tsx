import React, { useState, useRef, useEffect } from 'react';

const countries = [
  { code: '+1', country: 'US', flag: '🇺🇸', name: 'Estados Unidos' },
  { code: '+1', country: 'CA', flag: '🇨🇦', name: 'Canadá' },
  { code: '+34', country: 'ES', flag: '🇪🇸', name: 'España' },
  { code: '+52', country: 'MX', flag: '🇲🇽', name: 'México' },
  { code: '+54', country: 'AR', flag: '🇦🇷', name: 'Argentina' },
  { code: '+57', country: 'CO', flag: '🇨🇴', name: 'Colombia' },
  { code: '+56', country: 'CL', flag: '🇨🇱', name: 'Chile' },
  { code: '+51', country: 'PE', flag: '🇵🇪', name: 'Perú' },
  { code: '+58', country: 'VE', flag: '🇻🇪', name: 'Venezuela' },
  { code: '+593', country: 'EC', flag: '🇪🇨', name: 'Ecuador' },
  { code: '+502', country: 'GT', flag: '🇬🇹', name: 'Guatemala' },
  { code: '+53', country: 'CU', flag: '🇨🇺', name: 'Cuba' },
  { code: '+1', country: 'DO', flag: '🇩🇴', name: 'República Dominicana' },
  { code: '+504', country: 'HN', flag: '🇭🇳', name: 'Honduras' },
  { code: '+503', country: 'SV', flag: '🇸🇻', name: 'El Salvador' },
  { code: '+505', country: 'NI', flag: '🇳🇮', name: 'Nicaragua' },
  { code: '+506', country: 'CR', flag: '🇨🇷', name: 'Costa Rica' },
  { code: '+507', country: 'PA', flag: '🇵🇦', name: 'Panamá' },
  { code: '+598', country: 'UY', flag: '🇺🇾', name: 'Uruguay' },
  { code: '+595', country: 'PY', flag: '🇵🇾', name: 'Paraguay' },
  { code: '+591', country: 'BO', flag: '🇧🇴', name: 'Bolivia' },
  { code: '+55', country: 'BR', flag: '🇧🇷', name: 'Brasil' },
  { code: '+44', country: 'GB', flag: '🇬🇧', name: 'Reino Unido' },
  { code: '+33', country: 'FR', flag: '🇫🇷', name: 'Francia' },
  { code: '+49', country: 'DE', flag: '🇩🇪', name: 'Alemania' },
  { code: '+39', country: 'IT', flag: '🇮🇹', name: 'Italia' },
  { code: '+351', country: 'PT', flag: '🇵🇹', name: 'Portugal' },
  { code: '+86', country: 'CN', flag: '🇨🇳', name: 'China' },
  { code: '+91', country: 'IN', flag: '🇮🇳', name: 'India' },
];

interface CountryCodePickerProps {
  value: string;
  onChange: (code: string) => void;
}

export default function CountryCodePicker({ value, onChange }: CountryCodePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = countries.find(c => c.code === value) || countries[2];

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-3 bg-[#f0f2f5] dark:bg-slate-900 rounded-xl border border-transparent dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer text-sm"
      >
        <span className="text-lg leading-none">{selected.flag}</span>
        <span className="text-slate-700 dark:text-slate-300 font-medium text-sm">{selected.code}</span>
        <svg className={`w-3 h-3 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto min-w-[220px]">
          {countries.map((c) => (
            <button
              key={`${c.code}-${c.country}`}
              type="button"
              onClick={() => { onChange(c.code); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer ${value === c.code ? 'bg-[#3390ec]/10 dark:bg-[#3390ec]/20' : ''}`}
            >
              <span className="text-lg leading-none">{c.flag}</span>
              <span className="text-slate-800 dark:text-slate-200 font-medium">{c.code}</span>
              <span className="text-slate-400 dark:text-slate-500 text-xs ml-auto">{c.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
