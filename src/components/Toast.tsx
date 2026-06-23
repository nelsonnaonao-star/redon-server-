import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { setToastListener, clearToastListener } from '../services/toastService';

type ToastType = 'error' | 'info' | 'success';

interface ToastState {
  message: string;
  type: ToastType;
}

const ICONS: Record<ToastType, React.ReactNode> = {
  error: <AlertCircle className="w-4 h-4 text-rose-400" />,
  info: <Info className="w-4 h-4 text-[#3390ec]" />,
  success: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
};

const BG_CLASS: Record<ToastType, string> = {
  error: 'bg-rose-500/10 border-rose-500/30',
  info: 'bg-[#3390ec]/10 border-[#3390ec]/30',
  success: 'bg-emerald-500/10 border-emerald-500/30',
};

export default function Toast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [visible, setVisible] = useState(false);

  const show = useCallback((message: string, type: ToastType) => {
    setToast({ message, type });
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => setToast(null), 300);
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setToastListener((msg, type) => show(msg, type));
    return () => clearToastListener();
  }, [show]);

  return (
    <AnimatePresence>
      {toast && visible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 px-4 py-2.5 rounded-xl border shadow-lg backdrop-blur-sm ${BG_CLASS[toast.type]} max-w-xs w-full mx-4`}
        >
          {ICONS[toast.type]}
          <span className="text-sm text-slate-800 dark:text-slate-200 flex-1">{toast.message}</span>
          <button onClick={() => setVisible(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
