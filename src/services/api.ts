import { supabase } from '../lib/supabase';
import type { Chat, Message, UserProfile, Moment, ActiveTab, ChatStyle, BusinessListing } from '../types';

// ─── AUTH (Supabase Auth) ──────────────────────────────────────────

export async function login(identifier: string, password: string) {
  const input = identifier.toLowerCase().trim().replace(/^@/, '');
  const cleanPhone = input.replace(/[\s+()\-]/g, '');

  // Single query: search by username OR by phone
  const { data: profiles, error: searchErr } = await supabase
    .from('profiles')
    .select('id, username, phone_number, name, avatar_url, bio')
    .or(`username.eq.${input},phone_number.eq.${cleanPhone}`)
    .limit(1);

  if (searchErr) throw new Error('Error al buscar usuario');

  let profile = profiles?.[0] || null;

  // Fallback: partial phone match
  if (!profile && cleanPhone.length >= 4) {
    const { data: all } = await supabase
      .from('profiles')
      .select('id, username, phone_number, name, avatar_url, bio')
      .ilike('phone_number', `%${cleanPhone}%`)
      .limit(20);
    profile = all?.find(p => p.phone_number && p.phone_number.replace(/[\s+()\-]/g, '').includes(cleanPhone)) || null;
  }

  if (!profile) throw new Error('Usuario o teléfono no encontrado');

  const { data, error } = await supabase.auth.signInWithPassword({
    email: `${profile.username}@redon.app`,
    password,
  });

  if (error) {
    if (error.message.includes('Invalid login credentials')) throw new Error('Contraseña incorrecta');
    throw new Error(error.message);
  }

  return {
    token: data.session.access_token,
    user: {
      id: profile.id,
      name: profile.name || '',
      username: profile.username || '',
      phone: profile.phone_number || '',
      avatar: profile.avatar_url || '',
      bio: profile.bio || '',
    },
  };
}

export async function register(name: string, phone: string, username: string, password: string) {
  const cleanUsername = username.replace(/^@/, '').toLowerCase().trim();
  const cleanPhone = phone.trim();

  const existing = await supabase.from('profiles').select('id').or(`username.eq.${cleanUsername},phone_number.eq.${cleanPhone}`).maybeSingle();
  if (existing.data) throw new Error('El usuario o teléfono ya está registrado');

  const { data, error } = await supabase.auth.signUp({
    email: `${cleanUsername}@redon.app`,
    password,
  });

  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Error al crear usuario');

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: data.user.id,
    name,
    username: cleanUsername,
    phone_number: cleanPhone,
    avatar_url: '',
    bio: 'Disponible en RED ON',
  });

  if (profileError && !profileError.message.includes('duplicate key')) throw new Error(profileError.message);

  return {
    token: data.session?.access_token || '',
    user: { id: data.user.id, name, username: cleanUsername, phone: cleanPhone, avatar: '', bio: 'Disponible en RED ON' },
  };
}

export async function forgot(identifier: string) {
  const input = identifier.toLowerCase().trim().replace(/^@/, '');
  const { data: profile } = await supabase.from('profiles').select('username').eq('username', input).single();
  if (!profile) throw new Error('Usuario no encontrado');

  const { error } = await supabase.auth.resetPasswordForEmail(`${profile.username}@redon.app`);
  if (error) throw new Error(error.message);
  return { message: 'Instrucciones enviadas', username: profile.username };
}

// ─── CHATS ─────────────────────────────────────────────────────────

export async function getChats(): Promise<Chat[]> {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return [];
  const userId = user.user.id;

  // Find chats where user is a participant
  const { data: participations } = await supabase
    .from('chat_participants')
    .select('chat_id')
    .eq('profile_id', userId);

  if (!participations || participations.length === 0) return [];

  const chatIds = participations.map(p => p.chat_id);

  const { data: chats } = await supabase
    .from('chats')
    .select('*')
    .in('id', chatIds)
    .order('created_at', { ascending: false });

  if (!chats) return [];

  const chatPromises = chats.map(async (chat) => {
    const [lastMsgQuery, unreadQuery] = await Promise.all([
      supabase
        .from('messages')
        .select('text, created_at, sender_id')
        .eq('chat_id', chat.id)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('chat_id', chat.id)
        .neq('sender_id', userId)
        .eq('status', 'sent'),
    ]);

    const lastMsg = lastMsgQuery.data?.[0] || null;
    const unread = unreadQuery.count || 0;

    return {
      id: chat.id,
      name: chat.name || 'Usuario',
      avatar: chat.avatar || '',
      avatarColor: chat.avatar_color || (chat.avatar ? '' : 'bg-slate-450'),
      lastMessage: lastMsg ? lastMsg.text : (chat.last_message || 'Sin mensajes aún'),
      time: lastMsg ? lastMsg.created_at : chat.created_at,
      unreadCount: unread,
      isOnline: chat.is_online || false,
      phone: chat.phone || '',
      username: chat.username || '',
      bio: chat.bio || '',
      messages: [],
      profileId: chat.profile_id || '',
    };
  });

  const result = await Promise.all(chatPromises);
  return result;
}

export async function getMessages(chatId: string): Promise<Message[]> {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return [];
  const userId = user.user.id;

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true });

  if (!messages) return [];

  return messages.map(m => ({
    id: m.id,
    sender: m.sender_id === userId ? 'me' : 'them',
    text: m.text,
    time: m.time || m.created_at,
    status: m.status,
  }));
}

export async function markRead(chatId: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return;
  const userId = user.user.id;

  await supabase
    .from('messages')
    .update({ status: 'read' })
    .eq('chat_id', chatId)
    .neq('sender_id', userId);
}

export async function sendMessage(chatId: string, text: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) throw new Error('No autenticado');
  const userId = user.user.id;

  // Find the other participant to set receiver_id
  const { data: participants } = await supabase
    .from('chat_participants')
    .select('profile_id')
    .eq('chat_id', chatId)
    .neq('profile_id', userId)
    .limit(1);

  const receiverId = participants?.[0]?.profile_id || null;

  const { data: msg, error } = await supabase
    .from('messages')
    .insert({
      chat_id: chatId,
      sender_id: userId,
      receiver_id: receiverId,
      text,
      status: 'sent',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Fire push notification to recipient (best-effort, try both servers)
  if (receiverId) {
    const senderName = user.user.user_metadata?.name || 'RED ON';
    const pushBody = JSON.stringify({ profile_id: receiverId, title: senderName, body: text });
    const pushUrls = [
      `http://${localStorage.getItem('redon_server_ip') || 'localhost'}:3001/api/fcm/send`,
      'https://disciplined-quietude-production-7b38.up.railway.app/api/fcm/send',
    ];
    for (const url of pushUrls) {
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: pushBody }).catch(() => {});
    }
  }

  return { message: { id: msg.id, sender: 'me', text, time: msg.created_at, status: 'sent' } };
}

export async function sendDirectMessage(contactUserId: string, text: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) throw new Error('No autenticado');
  const userId = user.user.id;

  // Check for existing chat
  const { data: myParts } = await supabase
    .from('chat_participants')
    .select('chat_id')
    .eq('profile_id', userId);

  const myChatIds = (myParts || []).map(p => p.chat_id);

  let existingChatId: string | null = null;
  if (myChatIds.length > 0) {
    const { data: otherParts } = await supabase
      .from('chat_participants')
      .select('chat_id')
      .in('chat_id', myChatIds)
      .eq('profile_id', contactUserId)
      .limit(1);

    if (otherParts && otherParts.length > 0) {
      existingChatId = otherParts[0].chat_id;
    }
  }

  let chatId: string;

  if (existingChatId) {
    chatId = existingChatId;
  } else {
    chatId = crypto.randomUUID();

    // Get contact profile
    const { data: otherProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', contactUserId)
      .single();

    if (!otherProfile) throw new Error('Contacto no encontrado');

    // Create chat row with OTHER user's info (denormalized schema)
    const { error: chatErr } = await supabase.from('chats').insert({
      id: chatId,
      name: otherProfile.name || 'Usuario',
      avatar: otherProfile.avatar_url || '',
      avatar_color: otherProfile.avatar_url ? '' : 'bg-slate-450',
      phone: otherProfile.phone_number || '',
      username: otherProfile.username || '',
      bio: otherProfile.bio || '',
      profile_id: contactUserId,
      is_online: false,
      created_at: new Date().toISOString(),
    });
    if (chatErr) throw new Error(chatErr.message);

    // Add both participants
    const { error: p1Err } = await supabase.from('chat_participants').insert({
      chat_id: chatId,
      profile_id: userId,
    });
    if (p1Err) throw new Error(p1Err.message);

    const { error: p2Err } = await supabase.from('chat_participants').insert({
      chat_id: chatId,
      profile_id: contactUserId,
    });
    if (p2Err) throw new Error(p2Err.message);
  }

  // Send the first message
  const { data: msg, error: msgErr } = await supabase
    .from('messages')
    .insert({
      chat_id: chatId,
      sender_id: userId,
      receiver_id: contactUserId,
      text,
      status: 'sent',
    })
    .select()
    .single();

  if (msgErr) throw new Error(msgErr.message);

  return { message: { id: msg.id, sender: 'me', text, time: msg.created_at, status: 'sent', chatId }, chatId };
}

// ─── CONTACTS ──────────────────────────────────────────────────────

export async function getContacts(): Promise<Chat[]> {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return [];
  const userId = user.user.id;

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (!contacts) return [];

  const result: Chat[] = [];

  for (const c of contacts) {
    const { data: p } = await supabase.from('profiles').select('*').eq('id', c.contact_user_id).single();
    result.push({
      id: c.contact_user_id,
      name: c.name || p?.name || '',
      avatar: p?.avatar_url || c.avatar || '',
      avatarColor: p?.avatar_url ? '' : 'bg-slate-450',
      lastMessage: 'Sin mensajes aún',
      time: '',
      unreadCount: 0,
      isOnline: false,
      phone: p?.phone_number || '',
      username: p?.username || '',
      bio: p?.bio || c.bio || '',
      messages: [],
    });
  }

  return result;
}

export async function addContact(phone: string, name: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) throw new Error('No autenticado');
  const userId = user.user.id;

  const cleanPhone = phone.replace(/[\s+]/g, '');
  const { data: profiles } = await supabase.from('profiles').select('*');

  const contactProfile = profiles?.find(p => p.phone_number?.replace(/[\s+]/g, '').includes(cleanPhone));

  if (!contactProfile) throw new Error('No se encontró ningún usuario RED ON con ese número');
  if (contactProfile.id === userId) throw new Error('No puedes agregarte a ti mismo');

  const { data: exists } = await supabase
    .from('contacts')
    .select('id')
    .eq('user_id', userId)
    .eq('contact_user_id', contactProfile.id)
    .maybeSingle();

  if (exists) throw new Error('Este contacto ya existe en tu lista');

  await supabase.from('contacts').insert({
    user_id: userId,
    contact_user_id: contactProfile.id,
    name,
    type: 'human',
  });

  return {
    contact: {
      id: contactProfile.id,
      name,
      username: contactProfile.username,
      phone: contactProfile.phone_number,
      avatar: contactProfile.avatar_url || '',
      online: false,
      bio: contactProfile.bio || '',
    },
  };
}

export async function searchUsers(q: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return [];
  const userId = user.user.id;
  const query = q.toLowerCase().replace(/^@/, '').trim();
  if (query.length < 2) return [];

  // Try DB-level filter for phone numbers
  const cleanQuery = query.replace(/[\s+]/g, '');
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .neq('id', userId)
    .or(`username.ilike.%${query}%,name.ilike.%${query}%,phone_number.ilike.%${cleanQuery}%`)
    .limit(10);

  return (profiles || []).map(p => ({
    id: p.id, name: p.name, username: p.username, phone: p.phone_number,
    avatar: p.avatar_url || '', bio: p.bio || '',
  }));
}

// ─── MOMENTS ──────────────────────────────────────────────────────

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

export async function getMoments(): Promise<Moment[]> {
  const { data } = await supabase
    .from('momentos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (!data) return [];

  const ids = data.map(m => m.id);
  const { data: viewsData } = await supabase
    .from('momento_views')
    .select('momento_id, user_id')
    .in('momento_id', ids);

  const viewMap: Record<string, number> = {};
  if (viewsData) {
    for (const v of viewsData) {
      viewMap[v.momento_id] = (viewMap[v.momento_id] || 0) + 1;
    }
  }

  return data.map((m: any) => ({
    id: m.id,
    name: m.name || '',
    avatar: m.avatar || '',
    avatarColor: m.avatar_color || undefined,
    time: formatTimeAgo(m.created_at),
    hasUnseen: m.has_unseen ?? true,
    image: m.image || '',
    caption: m.caption || '',
    viewCount: viewMap[m.id] || 0,
    reactions: m.reactions || [],
  }));
}

export async function addMoment(moment: {
  name: string;
  avatar: string;
  avatarColor?: string;
  hasUnseen: boolean;
  image: string;
  caption: string;
}) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) throw new Error('No autenticado');

  const { data, error } = await supabase
    .from('momentos')
    .insert({
      user_id: user.user.id,
      type: 'image',
      content: moment.caption || moment.image,
      name: moment.name,
      avatar: moment.avatar,
      avatar_color: moment.avatarColor,
      has_unseen: moment.hasUnseen,
      image: moment.image,
      caption: moment.caption,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteMoment(momentoId: string) {
  const { error } = await supabase.from('momentos').delete().eq('id', momentoId);
  if (error) throw new Error(error.message);
}

export async function viewMoment(momentoId: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return;

  await supabase.from('momento_views').insert({
    momento_id: momentoId,
    user_id: user.user.id,
  });

  await supabase.from('momentos').update({ has_unseen: false }).eq('id', momentoId);
}

export async function getMomentViews(momentoId: string): Promise<number> {
  const { data } = await supabase
    .from('momento_views')
    .select('id', { count: 'exact', head: true })
    .eq('momento_id', momentoId);

  return data?.length || 0;
}

export async function reactToMoment(momentoId: string, emoji: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return;

  // Check if already reacted
  const { data: existing } = await supabase
    .from('momento_reactions')
    .select('id, emoji')
    .eq('momento_id', momentoId)
    .eq('user_id', user.user.id)
    .maybeSingle();

  if (existing) {
    if (existing.emoji === emoji) {
      // Toggle off
      await supabase.from('momento_reactions').delete().eq('id', existing.id);
      return { action: 'removed' };
    }
    // Change emoji
    await supabase.from('momento_reactions').update({ emoji }).eq('id', existing.id);
    return { action: 'changed', emoji };
  }

  await supabase.from('momento_reactions').insert({
    momento_id: momentoId,
    user_id: user.user.id,
    emoji,
  });

  return { action: 'added', emoji };
}

export async function getMomentReactions(momentoId: string) {
  const { data: user } = await supabase.auth.getUser();
  const userId = user?.user?.id;

  const { data } = await supabase
    .from('momento_reactions')
    .select('user_id, emoji, created_at')
    .eq('momento_id', momentoId);

  if (!data) return { myReaction: null, summary: [] };

  const myReaction = userId ? data.find(r => r.user_id === userId)?.emoji || null : null;

  const counts: Record<string, number> = {};
  for (const r of data) {
    counts[r.emoji] = (counts[r.emoji] || 0) + 1;
  }

  return {
    myReaction,
    summary: Object.entries(counts).map(([emoji, count]) => ({ emoji, count })),
  };
}

// ─── PROFILE ───────────────────────────────────────────────────────

export async function getProfile(): Promise<UserProfile> {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return { name: '', avatar: '', phone: '', username: '', bio: '' };

  const { data: p } = await supabase.from('profiles').select('*').eq('id', user.user.id).single();

  return {
    name: p?.name || '',
    avatar: p?.avatar_url || '',
    phone: p?.phone_number || '',
    username: p?.username || '',
    bio: p?.bio || '',
  };
}

export async function updateProfile(data: Partial<UserProfile>) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return;

  await supabase.from('profiles').update({
    name: data.name,
    avatar_url: data.avatar,
    phone_number: data.phone,
    username: data.username,
    bio: data.bio,
  }).eq('id', user.user.id);
}

// ─── BUSINESSES ────────────────────────────────────────────────────

export async function getBusinesses(zone?: string) {
  let query = supabase.from('businesses').select('*').order('created_at', { ascending: false });
  if (zone) query = query.eq('zone', zone);

  const { data } = await query;
  return (data || []).map(b => ({
    id: b.id,
    businessName: b.name,
    description: b.description,
    imageUrl: b.logo_url || '',
    zone: b.zone,
    category: b.category,
    contactName: b.contact_name,
    contactPhone: b.phone_contact || '',
  }));
}

export async function createBusiness(data: {
  businessName: string; description: string; imageUrl?: string;
  zone: string; category?: string; contactName: string; contactPhone?: string;
}) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) throw new Error('No autenticado');

  const { data: biz, error } = await supabase.from('businesses').insert({
    user_id: user.user.id,
    name: data.businessName,
    description: data.description,
    logo_url: data.imageUrl || '',
    zone: data.zone,
    category: data.category || 'General',
    phone_contact: data.contactPhone || '',
  }).select().single();

  if (error) throw new Error(error.message);
  return biz;
}

// ─── SERVER IP (ya no necesario pero mantenemos compatibilidad) ────

export function setServerIp(_ip: string) {
  localStorage.removeItem('redon_server_ip');
}

// ─── API object for backward compatibility ─────────────────────────

export const api = {
  login,
  register,
  forgot,
  getChats,
  getMessages,
  markRead,
  sendMessage,
  sendDirectMessage,
  getContacts,
  addContact,
  searchUsers,
  getMoments,
  addMoment,
  viewMoment,
  deleteMoment,
  getMomentViews,
  reactToMoment,
  getMomentReactions,
  getProfile,
  updateProfile,
  getBusinesses,
  createBusiness,
  setServerIp,
};
