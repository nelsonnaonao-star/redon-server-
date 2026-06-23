import React from 'react';
import { ChatStyle } from '../types';
import { Palette, Play, Sparkles, Check, Trash2, Wallpaper } from 'lucide-react';

interface ChatCustomizerProps {
  chatStyle: ChatStyle;
  onChangeStyle: (updated: ChatStyle) => void;
}

// 5 pre-defined colors + neon gradient — each preset defines a coordinated pair
const PRESETS = [
  { id: 'blue', name: 'Azul Eléctrico', colorClass: 'bg-[#3390ec]', textClass: 'text-white', partnerClass: 'bg-slate-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100' },
  { id: 'green', name: 'Verde Menta', colorClass: 'bg-[#10b981]', textClass: 'text-white', partnerClass: 'bg-emerald-50 dark:bg-emerald-950/40 text-gray-900 dark:text-gray-100' },
  { id: 'purple', name: 'Púrpura Neón', colorClass: 'bg-[#a855f7]', textClass: 'text-white', partnerClass: 'bg-purple-50 dark:bg-purple-950/40 text-gray-900 dark:text-gray-100' },
  { id: 'gray', name: 'Gris Acero', colorClass: 'bg-[#64748b]', textClass: 'text-white', partnerClass: 'bg-slate-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100' },
  { id: 'orange', name: 'Naranja Atardecer', colorClass: 'bg-[#f97316]', textClass: 'text-white', partnerClass: 'bg-orange-50 dark:bg-orange-950/40 text-gray-900 dark:text-gray-100' },
  { id: 'gradient-neon', name: 'Gradiente Neón', colorClass: 'bg-gradient-to-r from-rose-500 via-purple-500 to-cyan-500', textClass: 'text-white', partnerClass: 'bg-slate-50 dark:bg-slate-900 text-gray-900 dark:text-gray-100' },
];

// 3 High Quality Wallpapers
const WALLPAPERS = [
  { 
    id: 'abstracto', 
    name: 'Abstracto', 
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=150&auto=format&fit=crop'
  },
  { 
    id: 'espacio', 
    name: 'Espacio', 
    url: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=600&auto=format&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?q=80&w=150&auto=format&fit=crop'
  },
  { 
    id: 'minimalista', 
    name: 'Minimalista', 
    url: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=600&auto=format&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=150&auto=format&fit=crop'
  }
];

export default function ChatCustomizer({ chatStyle, onChangeStyle }: ChatCustomizerProps) {
  
  const handleSelectColor = (colorId: string) => {
    const preset = PRESETS.find(p => p.id === colorId);
    const updated = {
      ...chatStyle,
      bubbleColor: colorId,
      partnerBubbleColor: preset?.partnerClass || 'bg-slate-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100',
    };
    onChangeStyle(updated);
  };

  const handleSelectBG = (bgUrl: string) => {
    const updated = { ...chatStyle, bubbleBackground: bgUrl };
    onChangeStyle(updated);
  };

  const handleClearBG = () => {
    const updated = { ...chatStyle, bubbleBackground: '' };
    onChangeStyle(updated);
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-4.5 border border-slate-100 dark:border-slate-800 my-4 select-none">
      <div className="flex items-center gap-2 mb-3">
        <Palette className="w-4.5 h-4.5 text-[#3390ec]" />
        <h3 className="text-slate-800 dark:text-slate-200 font-bold text-sm tracking-tight">Motivo de Personalización</h3>
      </div>

      {/* Grid with 5 customizable colors + 1 gradient */}
      <div className="mb-5">
        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide block mb-2.5">Colores de Burbujas</span>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((p) => {
            const isSelected = chatStyle.bubbleColor === p.id;
            return (
              <button
                key={p.id}
                onClick={() => handleSelectColor(p.id)}
                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all text-center cursor-pointer active:scale-95 ${
                  isSelected 
                    ? 'border-[#3390ec] bg-white dark:bg-slate-800 shadow-sm' 
                    : 'border-slate-150 dark:border-slate-800 bg-white/50 dark:bg-slate-900 hover:bg-white dark:hover:bg-slate-800'
                }`}
              >
                <div className={`w-6 h-6 rounded-full ${p.colorClass} flex items-center justify-center relative shadow-xs`}>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
                  )}
                </div>
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate w-full">{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Fondos de Alta Calidad Section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide flex items-center gap-1">
            <Wallpaper className="w-3.5 h-3.5" /> Fondos de Alta Calidad
          </span>
          {chatStyle.bubbleBackground && (
            <button
              onClick={handleClearBG}
              className="text-[10px] text-rose-500 hover:text-rose-600 font-bold flex items-center gap-1 cursor-pointer transition-colors"
              title="Restablecer fondo por defecto"
            >
              <Trash2 className="w-3 h-3" /> Limpiar
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {WALLPAPERS.map((wall) => {
            const isSelected = chatStyle.bubbleBackground === wall.url;
            return (
              <button
                key={wall.id}
                onClick={() => handleSelectBG(wall.url)}
                className={`relative h-20 rounded-xl overflow-hidden border transition-all cursor-pointer group active:scale-95 flex flex-col justify-end p-1.5 ${
                  isSelected
                    ? 'border-[#3390ec] ring-2 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:brightness-105'
                }`}
              >
                {/* Wallpaper picture */}
                <img 
                  src={wall.thumbnail} 
                  alt={wall.name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 select-none pointer-events-none"
                  referrerPolicy="no-referrer"
                />
                
                {/* Subtle dim mask */}
                <div className="absolute inset-0 bg-black/25 group-hover:bg-black/15 transition-colors" />

                {/* Overlaid Selected Icon */}
                {isSelected && (
                  <div className="absolute top-1 right-1 bg-white dark:bg-slate-800 text-[#3390ec] p-0.5 rounded-full shadow-xs">
                    <Check className="w-2.5 h-2.5" />
                  </div>
                )}

                <span className="relative z-10 text-[9px] font-bold text-white tracking-wide text-left bg-black/40 backdrop-blur-xs px-1.5 py-0.5 rounded-md truncate max-w-full">
                  {wall.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Simple Live Demo Indicator */}
      <div className="mt-3.5 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 font-bold rounded-md animate-pulse">✓ Tiempo Real</span>
        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Los cambios se aplican en todas las salas de chat.</span>
      </div>
    </div>
  );
}
