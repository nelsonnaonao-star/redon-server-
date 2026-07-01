import React from 'react';
import { X, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface RedonIdCardProps {
  redonId: string;
  userId?: string;
  phone?: string;
  onClose: () => void;
}

export default function RedonIdCard({ redonId, userId, phone, onClose }: RedonIdCardProps) {
  const [copied, setCopied] = useState(false);

  const qrData = `redon://user/${userId || redonId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(qrData)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(redonId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-xs shadow-2xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <h3 className="text-slate-900 dark:text-white font-bold text-base">RED ON ID</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all cursor-pointer">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* QR Code */}
        <div className="flex justify-center py-4">
          <div className="bg-white p-3 rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
            <img
              src={qrUrl}
              alt="RED ON ID QR"
              className="w-44 h-44"
              crossOrigin="anonymous"
            />
          </div>
        </div>

        {/* ID Display */}
        <div className="px-5 pb-5 text-center">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">
            Tu ID único
          </p>
          <div
            onClick={handleCopy}
            className="inline-flex items-center gap-2 bg-slate-100 dark:bg-slate-700/80 px-4 py-2.5 rounded-xl cursor-pointer active:scale-95 transition-all group"
          >
            <span className="text-lg font-bold text-slate-900 dark:text-white tracking-tight select-all">
              {redonId}
            </span>
            {copied ? (
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <Copy className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 shrink-0" />
            )}
          </div>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-3 leading-relaxed">
            Comparte este código para que otros te agreguen al instante
          </p>
        </div>
      </div>
    </div>
  );
}
