import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, TrendingUp, X, Image, Sticker as StickerIcon } from 'lucide-react';
import { getStickerPacks, searchGifs, trendingGifs, StickerPack } from '../services/stickerService';

interface StickerPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onSelectSticker: (url: string) => void;
  onSelectGif: (url: string) => void;
  onClose: () => void;
}

type Tab = 'emoji' | 'sticker' | 'gif';

export const StickerPicker: React.FC<StickerPickerProps> = ({
  onSelectEmoji, onSelectSticker, onSelectGif, onClose
}) => {
  const [tab, setTab] = useState<Tab>('emoji');
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [activePack, setActivePack] = useState<string>('reactions');
  const [gifQuery, setGifQuery] = useState('');
  const [gifs, setGifs] = useState<string[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const gifTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => { getStickerPacks().then(setPacks); }, []);

  useEffect(() => {
    if (tab !== 'gif') return;
    setGifLoading(true);
    if (gifQuery.trim()) {
      searchGifs(gifQuery).then(setGifs).finally(() => setGifLoading(false));
    } else {
      trendingGifs().then(setGifs).finally(() => setGifLoading(false));
    }
  }, [tab]);

  const handleGifSearch = (q: string) => {
    setGifQuery(q);
    if (gifTimer.current) clearTimeout(gifTimer.current);
    gifTimer.current = setTimeout(() => {
      setGifLoading(true);
      if (q.trim()) {
        searchGifs(q).then(setGifs).finally(() => setGifLoading(false));
      } else {
        trendingGifs().then(setGifs).finally(() => setGifLoading(false));
      }
    }, 400);
  };

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const activeStickers = packs.find(p => p.id === activePack)?.stickers || [];

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      className="w-[320px] max-w-[90vw] bg-white dark:bg-dark-surface-secondary rounded-2xl shadow-2xl border border-border dark:border-dark-border overflow-hidden"
    >
      {/* Tabs */}
      <div className="flex border-b border-border dark:border-dark-border relative">
        {([
          { id: 'emoji' as Tab, label: 'Emojis', icon: '😀' },
          { id: 'sticker' as Tab, label: 'Stickers', icon: '🎨' },
          { id: 'gif' as Tab, label: 'GIFs', icon: 'GIF' },
        ]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-[11px] font-bold transition-all cursor-pointer ${
              tab === t.id
                ? 'text-brand border-b-2 border-brand'
                : 'text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
        <button
          onClick={onClose}
          className="absolute top-1 right-1 w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-secondary dark:hover:bg-dark-surface transition-all cursor-pointer text-text-tertiary hover:text-text-primary"
          title="Cerrar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Emoji tab */}
      {tab === 'emoji' && (
        <EmojiGridView onSelect={onSelectEmoji} />
      )}

      {/* Sticker tab */}
      {tab === 'sticker' && (
        <div>
          {/* Pack selector */}
          <div className="flex gap-1 px-2 py-1.5 overflow-x-auto border-b border-border/50 dark:border-dark-border/50">
            {packs.map(p => (
              <button
                key={p.id}
                onClick={() => setActivePack(p.id)}
                className={`shrink-0 text-sm px-2 py-1 rounded-lg transition-all cursor-pointer ${
                  activePack === p.id
                    ? 'bg-brand/10 text-brand'
                    : 'text-text-tertiary hover:bg-surface-secondary dark:hover:bg-dark-surface'
                }`}
                title={p.name}
              >
                {p.icon}
              </button>
            ))}
          </div>
          {/* Sticker grid */}
          <div className="h-52 overflow-y-auto p-2">
            <div className="grid grid-cols-4 gap-1.5">
              {activeStickers.map(s => (
                <button
                  key={s.id}
                  onClick={() => {
                    if (s.image_url) onSelectSticker(s.image_url);
                    else if (s.emoji) onSelectEmoji(s.emoji);
                    onClose();
                  }}
                  className="aspect-square bg-surface-secondary dark:bg-dark-surface rounded-xl flex items-center justify-center text-3xl hover:bg-brand/10 hover:scale-105 transition-all active:scale-95 cursor-pointer"
                >
                  {s.image_url ? (
                    <img src={s.image_url} alt={s.id} className="w-12 h-12 object-contain" />
                  ) : (
                    s.emoji
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* GIF tab */}
      {tab === 'gif' && (
        <div>
          <div className="flex items-center gap-2 p-2 border-b border-border dark:border-dark-border">
            <Search className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
            <input
              type="text"
              value={gifQuery}
              onChange={e => handleGifSearch(e.target.value)}
              placeholder="Buscar GIFs..."
              className="bg-transparent border-none text-xs text-text-primary dark:text-dark-text-primary outline-none flex-1 placeholder:text-text-tertiary"
            />
          </div>
          <div className="h-52 overflow-y-auto p-1.5">
            {gifLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {gifs.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => { onSelectGif(url); onClose(); }}
                    className="rounded-lg overflow-hidden hover:ring-2 ring-brand transition-all active:scale-95 cursor-pointer"
                  >
                    <img src={url} alt={`GIF ${i}`} className="w-full h-28 object-cover" />
                  </button>
                ))}
              </div>
            )}
            {!gifLoading && gifs.length === 0 && (
              <p className="text-center text-text-tertiary text-xs py-8">Sin resultados</p>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
};

// Simple emoji grid used inside sticker picker
const EmojiGridView: React.FC<{ onSelect: (emoji: string) => void }> = ({ onSelect }) => {
  const quickEmojis = [
    '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🥰', '😍', '🤩',
    '😘', '😗', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫',
    '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥',
    '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🥴', '😵',
    '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '😟', '🙁', '😮', '😯',
    '😲', '😳', '🥺', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫',
    '😤', '😡', '🤬', '👋', '✋', '✌️', '🤞', '👍', '👎', '✊', '👊', '🤛',
    '🤜', '👏', '🙌', '🤲', '🤝', '🙏', '💪', '❤️', '🧡', '💛', '💚', '💙',
    '💜', '🖤', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '✨', '⭐', '🌟',
    '🔥', '💯', '🎉', '🎊', '🎈', '🎁', '💎', '💰', '🚀', '👑', '🏆', '🥇',
  ];

  return (
    <div className="h-52 overflow-y-auto p-2">
      <div className="grid grid-cols-8 gap-0.5">
        {quickEmojis.map((emoji, i) => (
          <button
            key={i}
            onClick={() => onSelect(emoji)}
            className="text-xl p-1 hover:bg-surface-secondary dark:hover:bg-dark-surface rounded-lg transition-all active:scale-110 cursor-pointer"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};
