import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Pause, Music, X, Check, Headphones } from 'lucide-react';
import { getMusicLibrary, getMusicCategories, MusicTrack } from '../services/stickerService';

interface MusicPickerProps {
  onSelect: (track: MusicTrack) => void;
  onClose: () => void;
  selectedId?: string;
}

export const MusicPicker: React.FC<MusicPickerProps> = ({ onSelect, onClose, selectedId }) => {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCat, setActiveCat] = useState('Todas');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    getMusicLibrary().then(setTracks);
    getMusicCategories().then(cats => setCategories(['Todas', ...cats]));
  }, []);

  const filtered = activeCat === 'Todas' ? tracks : tracks.filter(t => t.category === activeCat);

  const handlePlay = (track: MusicTrack) => {
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) audioRef.current.src = track.file_url;
      audioRef.current?.play().catch(() => {});
      setPlayingId(track.id);
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      className="absolute bottom-full mb-2 w-[320px] bg-white dark:bg-dark-surface-secondary rounded-2xl shadow-2xl border border-border dark:border-dark-border overflow-hidden z-50"
    >
      <div className="flex items-center justify-between p-3 border-b border-border dark:border-dark-border">
        <div className="flex items-center gap-2">
          <Music className="w-4 h-4 text-brand" />
          <span className="text-xs font-bold text-text-primary dark:text-dark-text-primary">Biblioteca Musical</span>
        </div>
        <span className="text-[10px] text-text-tertiary">{tracks.length} temas</span>
      </div>

      {/* Categories */}
      {categories.length > 1 && (
        <div className="flex gap-1 px-2 py-1.5 overflow-x-auto border-b border-border/50 dark:border-dark-border/50">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCat(cat)}
              className={`shrink-0 text-[10px] font-bold px-3 py-1 rounded-lg transition-all cursor-pointer ${
                activeCat === cat
                  ? 'bg-brand text-white'
                  : 'bg-surface-secondary dark:bg-dark-surface text-text-tertiary hover:text-text-secondary'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Tracks */}
      <div className="h-52 overflow-y-auto">
        {filtered.map(track => (
          <div
            key={track.id}
            className={`flex items-center gap-3 px-3 py-2.5 hover:bg-surface-secondary dark:hover:bg-dark-surface transition-all cursor-pointer ${
              selectedId === track.id ? 'bg-brand/5' : ''
            }`}
          >
            <button
              onClick={() => handlePlay(track)}
              className="shrink-0 w-8 h-8 bg-brand/10 hover:bg-brand/20 rounded-full flex items-center justify-center transition-all cursor-pointer"
            >
              {playingId === track.id ? (
                <Pause className="w-3.5 h-3.5 text-brand" />
              ) : (
                <Play className="w-3.5 h-3.5 text-brand ml-0.5" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-text-primary dark:text-dark-text-primary truncate">{track.title}</p>
              <p className="text-[10px] text-text-tertiary truncate">{track.artist}</p>
            </div>
            <span className="text-[10px] text-text-tertiary font-mono">{formatDuration(track.duration)}</span>
            {track.cover_url && (
              <img src={track.cover_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
            )}
            <button
              onClick={() => { onSelect(track); onClose(); }}
              className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                selectedId === track.id
                  ? 'bg-emerald-500 text-white'
                  : 'bg-surface dark:bg-dark-surface text-text-tertiary hover:text-brand hover:bg-brand/10'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-8">
            <Headphones className="w-8 h-8 text-text-tertiary mb-2" />
            <p className="text-xs text-text-tertiary">No hay música disponible</p>
            <p className="text-[10px] text-text-tertiary/60 mt-1">Sube temas a Supabase en la tabla music_library</p>
          </div>
        )}
      </div>

      <audio ref={audioRef} className="hidden" />
    </motion.div>
  );
};
