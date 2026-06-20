import { supabase } from '../lib/supabase';
import type { InterestNews } from '../types';

export async function getInterestNews(): Promise<InterestNews[]> {
  const { data, error } = await supabase
    .from('interest_news')
    .select('*')
    .order('time', { ascending: false });

  if (error || !data) return [];

  return data.map((n: any) => ({
    id: n.id,
    category: n.category || '',
    title: n.title || '',
    source: n.source || '',
    time: formatTimeAgo(n.time),
    likes: n.likes || 0,
    image: n.image || undefined,
  }));
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (hours < 1) return 'Hace unos min';
  if (hours < 12) return `Hace ${hours} horas`;
  if (hours < 24) return 'Ayer';
  return date.toLocaleDateString();
}
