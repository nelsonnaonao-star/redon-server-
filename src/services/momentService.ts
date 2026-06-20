import { supabase } from '../lib/supabase';
import type { Moment } from '../types';

export async function getMoments(): Promise<Moment[]> {
  const { data, error } = await supabase
    .from('momentos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((m: any) => ({
    id: m.id,
    name: m.name || '',
    avatar: m.avatar || '',
    avatarColor: m.avatar_color || undefined,
    time: formatTimeAgo(m.created_at),
    hasUnseen: m.has_unseen ?? true,
    image: m.image || '',
    caption: m.caption || '',
    profileId: m.user_id || '',
  }));
}

export async function addMoment(moment: Omit<Moment, 'id' | 'time'>, userId: string) {
  const { data, error } = await supabase
    .from('momentos')
    .insert({
      user_id: userId,
      name: moment.name,
      avatar: moment.avatar,
      avatar_color: moment.avatarColor,
      has_unseen: moment.hasUnseen,
      image: moment.image,
      caption: moment.caption,
    })
    .select()
    .single();

  return { data, error };
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `Hace ${minutes} min`;
  if (hours < 24) return `Hace ${hours} horas`;
  return date.toLocaleDateString();
}
