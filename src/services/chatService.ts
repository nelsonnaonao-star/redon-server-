import { supabase } from '../lib/supabase';
import type { Chat, Message } from '../types';

export async function getChats(profileId: string): Promise<Chat[]> {
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .or(`profile_id.eq.${profileId},is_group.eq.true`);

  if (error || !data) return [];

  return Promise.all(data.map(async (chat) => {
    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chat.id)
      .order('created_at', { ascending: true });

    return formatChat(chat, msgs || [], profileId);
  }));
}

export async function getChatById(chatId: string, profileId: string): Promise<Chat | null> {
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('id', chatId)
    .single();

  if (error || !data) return null;

  const { data: msgs } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true });

  return formatChat(data, msgs || [], profileId);
}

export async function sendMessage(chatId: string, profileId: string, text: string) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('messages')
    .insert({
      chat_id: chatId,
      sender_id: profileId,
      text,
      status: 'sent',
      created_at: now,
    })
    .select()
    .single();

  if (!error) {
    await supabase
      .from('chats')
      .update({ last_message: text, time: now, updated_at: now })
      .eq('id', chatId);
  }

  return { data, error };
}

function formatChat(chat: any, messages: any[], profileId: string): Chat {
  const formattedMessages: Message[] = messages.map((m: any) => ({
    id: m.id,
    sender: m.sender_id === profileId ? 'me' : 'them',
    text: m.text || '',
    time: formatTime(m.created_at),
    status: m.status || 'sent',
  }));

  return {
    id: chat.id,
    name: chat.name || '',
    avatar: chat.avatar || '',
    avatarColor: chat.avatar_color || undefined,
    lastMessage: chat.last_message || '',
    time: chat.time ? formatTime(chat.time) : '',
    unreadCount: chat.unread_count || 0,
    isOnline: chat.is_online || false,
    phone: chat.phone || '',
    username: chat.username || '',
    bio: chat.bio || '',
    messages: formattedMessages,
  };
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (hours < 1) return `${Math.floor(diff / (1000 * 60))} min`;
  if (hours < 12) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (hours < 24) return 'Ayer';
  return date.toLocaleDateString();
}
