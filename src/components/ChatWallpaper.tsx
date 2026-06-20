import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Image, Check, X, Upload, Paintbrush } from 'lucide-react';

interface ChatWallpaperProps {
  isOpen: boolean;
  onClose: () => void;
  currentWallpaper: string;
  onSelectWallpaper: (wallpaperClass: string) => void;
}

const PRESET_WALLPAPERS = [
  { id: 'default', name: 'Original Light', class: 'bg-[#f4f6f8]', preview: 'bg-[#f4f6f8]' },
  { id: 'gradient-blue', name: 'Pacífico Sol', class: 'bg-gradient-to-br from-blue-50 via-indigo-50 to-slate-100', preview: 'bg-gradient-to-br from-blue-100 to-indigo-100' },
  { id: 'gradient-emerald', name: 'Bosque Místico', class: 'bg-gradient-to-br from-emerald-50 via-teal-50 to-stone-100', preview: 'bg-gradient-to-br from-emerald-100 to-teal-100' },
  { id: 'gradient-sunset', name: 'Atardecer Naranja', class: 'bg-gradient-to-br from-amber-50 via-rose-50 to-zinc-100', preview: 'bg-gradient-to-br from-amber-100 to-rose-100' },
  { id: 'gradient-cosmic', name: 'Sombra Estelar', class: 'bg-gradient-to-br from-slate-900 via-purple-950 to-zinc-900', textInverse: true, preview: 'bg-gradient-to-br from-slate-800 to-purple-900' },
  { id: 'solid-dark', name: 'Carbono Elegante', class: 'bg-slate-900', textInverse: true, preview: 'bg-slate-800' }
];

export const ChatWallpaper: React.FC<ChatWallpaperProps> = ({
  isOpen,
  onClose,
  currentWallpaper,
  onSelectWallpaper
}) => {
  const [customFile, setCustomFile] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setCustomFile(base64String);
        // Treat as inline CSS background-image style pattern wrapped in special identifier
        onSelectWallpaper(`custom-img:[${base64String}]`);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
          id="wallpaper-panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Paintbrush className="w-5 h-5 text-[#0084ff]" />
              <h3 className="font-semibold text-slate-800 text-base">Fondo de Chat</h3>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Preset Grid */}
          <div className="p-5 overflow-y-auto space-y-5 flex-1">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Predefinidos Pro</p>
              <div className="grid grid-cols-2 gap-3">
                {PRESET_WALLPAPERS.map((preset) => {
                  const isSelected = currentWallpaper === preset.class;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => onSelectWallpaper(preset.class)}
                      className={`h-24 rounded-2xl relative overflow-hidden transition-all duration-200 border-2 ${
                        isSelected ? 'border-[#0084ff] scale-[1.02] shadow-md' : 'border-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <div className={`w-full h-full ${preset.preview}`} />
                      <div className="absolute inset-0 bg-black/10 flex flex-col justify-end p-2">
                        <span className="text-[11px] font-medium text-white truncate max-w-full drop-shadow-sm">
                          {preset.name}
                        </span>
                      </div>
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-[#0084ff] text-white p-0.5 rounded-full">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom section */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Fondo Personalizado</p>
              <label 
                className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-slate-200 hover:border-[#0084ff] hover:bg-blue-50/20 cursor-pointer transition-all duration-200"
                id="custom-wallpaper-upload"
              >
                <div className="flex flex-col items-center gap-1">
                  {customFile ? (
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200">
                      <img src={customFile} alt="Custom Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
                        <Check className="w-5 h-5 text-white filter drop-shadow-md" />
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-6 h-6 text-slate-400" />
                      <span className="text-sm font-medium text-slate-700">Sube tu Imagen</span>
                      <span className="text-xs text-slate-400">JPG, PNG o GIF (Max 5MB)</span>
                    </>
                  )}
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleFileUpload} 
                />
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cerrar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
