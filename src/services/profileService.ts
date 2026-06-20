import { supabase } from '../lib/supabase';
import type { UserProfile } from '../types';

export async function getProfile(id: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;

  return {
    name: data.name || '',
    avatar: data.avatar_url || data.avatar || '',
    phone: data.phone_number || '',
    username: data.username || '',
    bio: data.bio || '',
  };
}

export async function updateProfile(id: string, profile: Partial<UserProfile>) {
  const { error } = await supabase
    .from('profiles')
    .update({
      name: profile.name,
      avatar_url: profile.avatar,
      phone_number: profile.phone,
      username: profile.username,
      bio: profile.bio,
    })
    .eq('id', id);

  return { error };
}
