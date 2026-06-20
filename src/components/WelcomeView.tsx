import React from 'react';
import { Sparkles, ArrowRight, MessageCircleCode, CheckCircle2 } from 'lucide-react';

interface WelcomeViewProps {
  onStart: () => void;
}

export default function WelcomeView({ onStart }: WelcomeViewProps) {
  return (
    <div className="flex flex-col justify-between h-full bg-white dark:bg-slate-900 px-6 py-8 font-sans transition-colors duration-300">
      
      {/* Visual background details */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#3390ec]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-24 left-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Meta info */}
      <div className="flex justify-between items-center select-none">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 bg-[#3390ec] rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
            R
          </div>
          <span className="text-xs font-bold text-slate-850 dark:text-slate-100 tracking-wider">RED ON</span>
        </div>
        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold px-2 py-0.5 rounded-full border border-transparent dark:border-slate-700/60">
          v2.0 Native
        </span>
      </div>

      {/* Central Brand Body */}
      <div className="my-auto flex flex-col items-center text-center">
        {/* Animated Central Brand Ring Balloon */}
        <div className="relative mb-6">
          <div className="w-20 h-20 bg-[#3390ec]/10 rounded-3xl flex items-center justify-center text-[#3390ec] shadow-[0_4px_16px_rgba(51,144,236,0.12)]">
            <MessageCircleCode className="w-10 h-10" />
          </div>
          <span className="absolute -top-1 -right-1 bg-emerald-500 text-white p-1 rounded-full shadow-md animate-bounce">
            <Sparkles className="w-3.5 h-3.5" />
          </span>
        </div>

        <h1 className="text-slate-900 dark:text-white text-3xl font-bold tracking-tight mb-3">
          Bienvenido a <br />
          <span className="text-[#3390ec]">RED ON</span>
        </h1>
        
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs leading-relaxed font-normal">
          Un servicio de mensajería impecable, rápido y seguro. Diseñado con una interfaz "Clean UI" inspirada en sistemas nativos modernos.
        </p>

        {/* Short Bullet Points of Clean Interface */}
        <div className="mt-8 space-y-3.5 text-left w-full max-w-xs self-center">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4.5 h-4.5 text-[#3390ec] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">Cifrado de Extremo a Extremo</h4>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Tus conversaciones y contenidos están completamente seguros.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4.5 h-4.5 text-[#3390ec] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">Modo Emprendedor Integrado</h4>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Herramientas financieras y catálogo de productos para tu negocio.</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4.5 h-4.5 text-[#3390ec] flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">Intereses y Tasa de Cambio</h4>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Infórmate sin salir de la app con el feed de noticias seleccionado.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Button Action */}
      <div className="space-y-4">
        <button
          onClick={onStart}
          className="w-full bg-[#3390ec] hover:bg-[#2b7bc9] active:scale-98 text-white rounded-2xl py-4 font-semibold text-sm transition-all shadow-[0_4px_12px_rgba(51,144,236,0.25)] cursor-pointer flex items-center justify-center gap-2 group"
        >
          <span>Comenzar a explorar</span>
          <ArrowRight className="w-4.5 h-4.5 group-hover:translate-x-1 transition-transform" />
        </button>
        
        <p className="text-center text-[10px] text-slate-400 dark:text-slate-500 leading-normal max-w-[250px] mx-auto">
          Al pulsar comenzar aceptas los Términos de Servicio y la Política de Privacidad de RED ON.
        </p>
      </div>

    </div>
  );
}
