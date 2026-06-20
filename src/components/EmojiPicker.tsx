import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Clock, Smile } from 'lucide-react';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const EMOJI_CATEGORIES = [
  {
    name: 'Recientes',
    icon: '🕐',
    emojis: ['❤️', '👍', '😂', '😮', '😢', '🙏', '🔥', '✨', '🥰', '😍'],
  },
  {
    name: 'Caras',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌',
      '😍', '🥰', '😘', '😗', '😙', '😚', '🥲', '😋', '😛', '😜', '🤪', '😝',
      '🤑', '🤗', '🤭', '🫢', '🫣', '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑',
      '😶', '🫥', '😏', '😒', '🙄', '😬', '😮‍💨', '🤥', '😌', '😔', '😪', '🤤',
      '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🥴', '😵', '🤯', '🤠', '🥳', '🥸',
      '😎', '🤓', '🧐', '😕', '🫤', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺',
      '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓',
      '😩', '😫', '🥱', '😤', '😡', '🤬', '👿', '💀', '☠️', '💩', '🤡', '👹',
      '👺', '👻', '👽', '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀',
      '😿', '😾',
    ],
  },
  {
    name: 'Gestos',
    icon: '👋',
    emojis: [
      '👋', '🤚', '✋', '🖐️', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉',
      '👆', '🖕', '👇', '☝️', '🫵', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏',
      '🙌', '🫶', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦵', '🦶',
      '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄',
    ],
  },
  {
    name: 'Corazones',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💕', '💞', '💓',
      '💗', '💖', '💘', '💝', '❣️', '💟', '♥️', '🫶',
    ],
  },
  {
    name: 'Objetos',
    icon: '🎁',
    emojis: [
      '🔥', '✨', '⭐', '🌟', '💫', '🎯', '🎉', '🎊', '🎈', '🎁', '🎀', '🪄',
      '💎', '🔮', '🕯️', '💡', '🔦', '🏆', '🥇', '🥈', '🥉', '🏅', '🎵', '🎶',
      '🎤', '🎧', '📱', '💻', '⌚', '📸', '🔒', '🔓', '🔑', '🗝️', '✉️', '📨',
      '📩', '💌', '📦', '📊', '📈', '💰', '💵', '💸', '💳', '🧾', '✂️', '🔪',
      '🗡️', '⚔️', '🔫', '🛡️', '🚀', '🛸', '✈️', '🚁', '🚗', '🚕', '🚌', '🏎️',
      '🚲', '🛴', '🛵', '🏍️', '🚂', '🚢', '⛵', '🛶', '🎠', '🎡', '🎢', '🛝',
    ],
  },
  {
    name: 'Naturaleza',
    icon: '🌿',
    emojis: [
      '🌸', '🌺', '🌻', '🌹', '🌷', '🌼', '🌿', '🍀', '🌵', '🌴', '🌲', '🌳',
      '🌾', '🍁', '🍂', '🍃', '🌱', '☘️', '🍄', '🐚', '🪸', '🐠', '🐟', '🐬',
      '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦣', '🐪',
      '🐫', '🦙', '🦒', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🐐', '🦌',
      '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐈‍⬛', '🪶', '🐓', '🦃', '🦤', '🦚', '🦜',
      '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦫', '🦦', '🦥', '🐁', '🐀',
      '🐿️', '🦔', '🐾', '🐉', '🐲',
    ],
  },
  {
    name: 'Comida',
    icon: '🍕',
    emojis: [
      '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒',
      '🍑', '🥭', '🍍', '🥝', '🍅', '🫒', '🥥', '🥑', '🍆', '🥔', '🥕', '🌽',
      '🌶️', '🫑', '🥒', '🥬', '🥦', '🧄', '🧅', '🍄', '🥜', '🫘', '🌰', '🍞',
      '🥐', '🥖', '🫓', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩',
      '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮',
      '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱',
      '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧',
      '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🧂',
      '🥤', '🧃', '🧉', '☕', '🍵', '🫖', '🍶', '🍺', '🍻', '🥂', '🍷', '🫗',
      '🥃', '🍸', '🍹', '🧊',
    ],
  },
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onSelect, onClose }) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(0);

  const filtered = search.trim()
    ? EMOJI_CATEGORIES.flatMap(c => c.emojis).filter(e => e.includes(search))
    : EMOJI_CATEGORIES[category]?.emojis || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      className="absolute bottom-full mb-2 w-[320px] bg-white dark:bg-dark-surface-secondary rounded-2xl shadow-2xl border border-border dark:border-dark-border overflow-hidden z-50"
    >
      {/* Header */}
      <div className="flex items-center gap-2 p-2 border-b border-border dark:border-dark-border">
        <Search className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar emoji..."
          className="bg-transparent border-none text-xs text-text-primary dark:text-dark-text-primary outline-none flex-1 placeholder:text-text-tertiary"
        />
      </div>

      {/* Categories */}
      <div className="flex gap-0.5 px-2 py-1.5 overflow-x-auto border-b border-border/50 dark:border-dark-border/50">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={cat.name}
            onClick={() => { setCategory(i); setSearch(''); }}
            className={`shrink-0 text-sm px-2 py-1 rounded-lg transition-all cursor-pointer ${
              category === i && !search.trim()
                ? 'bg-brand/10 text-brand scale-105'
                : 'text-text-tertiary hover:bg-surface-secondary dark:hover:bg-dark-surface-secondary'
            }`}
            title={cat.name}
          >
            {cat.icon}
          </button>
        ))}
      </div>

      {/* Emoji grid */}
      <div className="h-52 overflow-y-auto p-2">
        <div className="grid grid-cols-8 gap-0.5">
          {filtered.map((emoji, i) => (
            <button
              key={`${emoji}-${i}`}
              onClick={() => { onSelect(emoji); onClose(); }}
              className="text-xl p-1 hover:bg-surface-secondary dark:hover:bg-dark-surface rounded-lg transition-all active:scale-110 cursor-pointer"
            >
              {emoji}
            </button>
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="text-center text-text-tertiary text-xs py-8">Sin resultados</p>
        )}
      </div>
    </motion.div>
  );
};
