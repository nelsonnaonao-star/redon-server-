import { supabase } from '../lib/supabase';

export interface StickerPack {
  id: string;
  name: string;
  icon: string;
  stickers: Sticker[];
}

export interface Sticker {
  id: string;
  image_url: string;
  emoji?: string;
}

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  duration: number;
  file_url: string;
  cover_url: string;
  category: string;
}

const TENOR_API_KEY = 'AIzaSyBXPRrE0sU5KUm7_qSJTOgFUSf12h2xh1g';
const TENOR_BASE = 'https://tenor.googleapis.com/v2';

// ─── Stickers ───────────────────────────────────────────────────────

const BUILTIN_STICKERS: StickerPack[] = [
  {
    id: 'reactions',
    name: 'Reacciones',
    icon: '👍',
    stickers: [
      { id: 's-like', image_url: '', emoji: '👍' },
      { id: 's-love', image_url: '', emoji: '❤️' },
      { id: 's-haha', image_url: '', emoji: '😂' },
      { id: 's-wow', image_url: '', emoji: '😮' },
      { id: 's-sad', image_url: '', emoji: '😢' },
      { id: 's-angry', image_url: '', emoji: '😡' },
      { id: 's-clap', image_url: '', emoji: '👏' },
      { id: 's-fire', image_url: '', emoji: '🔥' },
      { id: 's-100', image_url: '', emoji: '💯' },
      { id: 's-party', image_url: '', emoji: '🎉' },
      { id: 's-joy', image_url: '', emoji: '🥹' },
      { id: 's-cool', image_url: '', emoji: '😎' },
    ],
  },
  {
    id: 'greetings',
    name: 'Saludos',
    icon: '👋',
    stickers: [
      { id: 'g-hi', image_url: '', emoji: '👋' },
      { id: 'g-hey', image_url: '', emoji: '✋' },
      { id: 'g-welcome', image_url: '', emoji: '🤗' },
      { id: 'g-good-morning', image_url: '', emoji: '🌅' },
      { id: 'g-good-night', image_url: '', emoji: '🌙' },
      { id: 'g-hug', image_url: '', emoji: '🤗' },
    ],
  },
  {
    id: 'animals',
    name: 'Animales',
    icon: '🐱',
    stickers: [
      { id: 'a-cat', image_url: '', emoji: '🐱' },
      { id: 'a-dog', image_url: '', emoji: '🐶' },
      { id: 'a-panda', image_url: '', emoji: '🐼' },
      { id: 'a-fox', image_url: '', emoji: '🦊' },
      { id: 'a-rabbit', image_url: '', emoji: '🐰' },
      { id: 'a-unicorn', image_url: '', emoji: '🦄' },
      { id: 'a-lion', image_url: '', emoji: '🦁' },
      { id: 'a-tiger', image_url: '', emoji: '🐯' },
    ],
  },
  {
    id: 'food',
    name: 'Comida',
    icon: '🍕',
    stickers: [
      { id: 'f-pizza', image_url: '', emoji: '🍕' },
      { id: 'f-burger', image_url: '', emoji: '🍔' },
      { id: 'f-taco', image_url: '', emoji: '🌮' },
      { id: 'f-sushi', image_url: '', emoji: '🍣' },
      { id: 'f-cake', image_url: '', emoji: '🎂' },
      { id: 'f-coffee', image_url: '', emoji: '☕' },
      { id: 'f-beer', image_url: '', emoji: '🍺' },
      { id: 'f-fruit', image_url: '', emoji: '🍎' },
    ],
  },
  {
    id: 'hearts',
    name: 'Corazones',
    icon: '💖',
    stickers: [
      { id: 'h-red', image_url: '', emoji: '❤️' },
      { id: 'h-blue', image_url: '', emoji: '💙' },
      { id: 'h-green', image_url: '', emoji: '💚' },
      { id: 'h-purple', image_url: '', emoji: '💜' },
      { id: 'h-sparkle', image_url: '', emoji: '✨' },
      { id: 'h-kiss', image_url: '', emoji: '💋' },
      { id: 'h-couple', image_url: '', emoji: '💑' },
      { id: 'h-broken', image_url: '', emoji: '💔' },
    ],
  },
];

export async function getStickerPacks(): Promise<StickerPack[]> {
  // Return built-in emoji stickers + try to fetch custom from Supabase
  const { data, error } = await supabase
    .from('sticker_packs')
    .select('*')
    .order('created_at', { ascending: true });
  if (!error && data && data.length > 0) {
    for (const pack of data) {
      const { data: stickers } = await supabase
        .from('stickers')
        .select('*')
        .eq('pack_id', pack.id);
      if (stickers) {
        BUILTIN_STICKERS.push({
          id: pack.id,
          name: pack.name,
          icon: pack.icon || '📦',
          stickers: stickers.map((s: any) => ({
            id: s.id,
            image_url: s.image_url,
            emoji: s.emoji,
          })),
        });
      }
    }
  }
  return BUILTIN_STICKERS;
}

// ─── GIFs (Tenor) ──────────────────────────────────────────────────

export async function searchGifs(query: string): Promise<string[]> {
  if (!query.trim()) return [];
  try {
    const res = await fetch(
      `${TENOR_BASE}/search?q=${encodeURIComponent(query)}&key=${TENOR_API_KEY}&limit=20&media_filter=tinygif`
    );
    const json = await res.json();
    return (json.results || []).map((r: any) => r.media_formats?.tinygif?.url).filter(Boolean);
  } catch {
    return [];
  }
}

export async function trendingGifs(): Promise<string[]> {
  try {
    const res = await fetch(
      `${TENOR_BASE}/featured?key=${TENOR_API_KEY}&limit=20&media_filter=tinygif`
    );
    const json = await res.json();
    return (json.results || []).map((r: any) => r.media_formats?.tinygif?.url).filter(Boolean);
  } catch {
    return [];
  }
}

// ─── Music Library ─────────────────────────────────────────────────

export async function getMusicLibrary(): Promise<MusicTrack[]> {
  try {
    const { data } = await supabase
      .from('music_library')
      .select('*')
      .order('created_at', { ascending: true });
    return (data || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      duration: t.duration || 0,
      file_url: t.file_url,
      cover_url: t.cover_url || '',
      category: t.category || 'General',
    }));
  } catch {
    return [];
  }
}

export async function getMusicCategories(): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('music_library')
      .select('category');
    const cats = new Set((data || []).map((t: any) => t.category));
    return Array.from(cats).filter(Boolean) as string[];
  } catch {
    return [];
  }
}
