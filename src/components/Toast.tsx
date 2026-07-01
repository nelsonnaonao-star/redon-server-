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
  error: <AlertCircle className="w-4 h-4 text-white/80" />,
  info: <Info className="w-4 h-4 text-white/80" />,
  success: <CheckCircle2 className="w-4 h-4 text-white/80" />,
};

const BG_CLASS: Record<ToastType, string> = {
  error: 'bg-emerald-600 border-emerald-700 shadow-emerald-500/20',
  info: 'bg-emerald-600 border-emerald-700 shadow-emerald-500/20',
  success: 'bg-emerald-600 border-emerald-700 shadow-emerald-500/20',
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
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 px-4 py-3 rounded-xl border shadow-lg ${BG_CLASS[toast.type]} max-w-xs w-full mx-4`}
        >
          {ICONS[toast.type]}
          <span className="text-sm text-white font-medium flex-1">{toast.message}</span>
          <button onClick={() => setVisible(false)} className="text-white/60 hover:text-white transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
