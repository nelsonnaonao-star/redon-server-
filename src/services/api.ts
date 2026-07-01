import { supabase } from '../lib/supabase';
import type { Chat, Message, UserProfile, Moment, ActiveTab, ChatStyle, BusinessListing, FaqItem, Poll } from '../types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

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

  if (!profile) throw new Error('Usuario o teléfono no encontrado. ¿Ya tienes una cuenta? Si no, regístrate.');

  const { data, error } = await supabase.auth.signInWithPassword({
    email: `${profile.username}@redon.app`,
    password,
  });

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      throw new Error('Contraseña incorrecta. Usa "Olvidé mi contraseña" para recuperarla.');
    }
    // If account not confirmed, try to auto-confirm and retry
    if (error.message.toLowerCase().includes('confirm') || error.message.toLowerCase().includes('email not confirmed')) {
      try {
        if (SERVER_URL) {
          const confirmRes = await fetch(`${SERVER_URL}/api/auth/auto-confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: profile.id }),
          });
          if (!confirmRes.ok) console.warn('[LOGIN] Auto-confirm failed:', await confirmRes.text());
        }
      } catch (e) {
        console.warn('[LOGIN] Auto-confirm failed:', e);
      }
      // Retry sign in after auto-confirm
      const retry = await supabase.auth.signInWithPassword({
        email: `${profile.username}@redon.app`,
        password,
      });
      if (retry.error) {
        if (retry.error.message.includes('Invalid login credentials')) throw new Error('Contraseña incorrecta. Usa "Olvidé mi contraseña" para recuperarla.');
        throw new Error('Error de autenticación: ' + retry.error.message);
      }
      return {
        token: retry.data.session.access_token,
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
    // Si el error no es de credenciales ni confirmación, el auth user podría no existir
    throw new Error('Error al iniciar sesión: ' + error.message + '. Si el problema persiste, regístrate de nuevo.');
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

export async function register(name: string, phone: string, username: string, password: string, realEmail?: string) {
  const cleanUsername = username.replace(/^@/, '').toLowerCase().trim();
  const cleanPhone = phone.trim();
  const cleanEmail = realEmail?.trim().toLowerCase() || '';

  // Validar formato del usuario: solo letras, números, guiones bajos, puntos, guiones
  if (!/^[a-z0-9_.-]+$/.test(cleanUsername)) {
    throw new Error('El usuario solo puede contener letras, números, guiones bajos (_), puntos (.) y guiones (-). Sin espacios ni @.');
  }
  if (cleanUsername.length < 2) throw new Error('El usuario debe tener al menos 2 caracteres');

  const existing = await supabase.from('profiles').select('id').or(`username.eq.${cleanUsername},phone_number.eq.${cleanPhone}`).maybeSingle();
  if (existing.data) throw new Error('El usuario o teléfono ya está registrado');

  const { data, error } = await supabase.auth.signUp({
    email: `${cleanUsername}@redon.app`,
    password,
  });

  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Error al crear usuario');

  // Auto-confirm via server (bypasses Supabase email confirmation)
  try {
    if (SERVER_URL) {
      await fetch(`${SERVER_URL}/api/auth/auto-confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: data.user.id }),
      });
    }
  } catch (e) {
    console.warn('[REGISTER] Auto-confirm failed, user may need email confirmation:', e);
  }

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: data.user.id,
    name,
    username: cleanUsername,
    phone_number: cleanPhone,
    avatar_url: '',
    bio: 'Disponible en RED ON',
    ...(cleanEmail ? { real_email: cleanEmail } : {}),
  });

  if (profileError && !profileError.message.includes('duplicate key')) throw new Error(profileError.message);

  // Sign in immediately to get a real session
  let token = data.session?.access_token || '';
  if (!token) {
    try {
      const signInRes = await supabase.auth.signInWithPassword({
        email: `${cleanUsername}@redon.app`,
        password,
      });
      if (signInRes.data.session) {
        token = signInRes.data.session.access_token;
      }
    } catch (e) {
      console.warn('[REGISTER] Sign in after register failed:', e);
    }
  }

  return {
    token,
    user: { id: data.user.id, name, username: cleanUsername, phone: cleanPhone, avatar: '', bio: 'Disponible en RED ON', realEmail: cleanEmail },
  };
}

export async function forgot(identifier: string) {
  const input = identifier.toLowerCase().trim().replace(/^@/, '');
  const { data: profile } = await supabase.from('profiles').select('username, real_email').eq('username', input).single();
  if (!profile) throw new Error('Usuario no encontrado');
  if (!profile.real_email) throw new Error('Este usuario no tiene un correo electrónico registrado. Usa la recuperación por SMS.');

  const { error } = await supabase.auth.resetPasswordForEmail(profile.real_email);
  if (error) throw new Error(error.message);
  return { message: 'Instrucciones enviadas al correo registrado', username: profile.username, maskedEmail: maskEmail(profile.real_email) };
}

function maskEmail(email: string) {
  const [name, domain] = email.split('@');
  if (!domain) return email;
  return name[0] + '***' + name.slice(-1) + '@' + domain;
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
    .eq('profile_id', userId)
    .eq('hidden', false);

  if (!participations || participations.length === 0) return [];

  const chatIds = participations.map(p => p.chat_id);

  const { data: chats } = await supabase
    .from('chats')
    .select('*')
    .in('id', chatIds)
    .order('created_at', { ascending: false });

  if (!chats) return [];

  // Build map of chat_id → other participant's profile_id
  const { data: allParticipants } = await supabase
    .from('chat_participants')
    .select('chat_id, profile_id')
    .in('chat_id', chatIds);

  const otherProfileMap: Record<string, string> = {};
  if (allParticipants) {
    for (const p of allParticipants) {
      if (p.chat_id && p.profile_id !== userId) {
        otherProfileMap[p.chat_id] = p.profile_id;
      }
    }
  }

  // Batch-fetch avatar_url and name for all other participants
  const otherIds = [...new Set(Object.values(otherProfileMap).filter(Boolean))];
  let avatarMap: Record<string, string> = {};
  let nameMap: Record<string, string> = {};
  if (otherIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, avatar_url, name')
      .in('id', otherIds);
    if (profiles) {
      for (const p of profiles) {
        avatarMap[p.id] = p.avatar_url || '';
        nameMap[p.id] = p.name || 'Usuario';
      }
    }
  }

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

    // Resolve avatar and name: prefer the other participant's data over denormalized chat columns
    const otherId = otherProfileMap[chat.id];
    const avatarUrl = chat.avatar || (otherId ? avatarMap[otherId] : '') || '';

    return {
      id: chat.id,
      name: otherId && nameMap[otherId] ? nameMap[otherId] : (chat.name || chat.phone || 'Usuario'),
      avatar: avatarUrl,
      avatarColor: avatarUrl ? '' : (chat.avatar_color || ''),
      lastMessage: lastMsg ? lastMsg.text : (chat.last_message || 'Sin mensajes aún'),
      time: lastMsg ? lastMsg.created_at : chat.created_at,
      unreadCount: unread,
      isOnline: chat.is_online || false,
      phone: chat.phone || '',
      username: chat.username || '',
      bio: chat.bio || '',
      messages: [],
      profileId: chat.profile_id || '',
      isGroup: chat.is_group || false,
      adminId: chat.admin_id || undefined,
      participantIds: [], // populated by caller if needed
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

  const senderIds = [...new Set(messages.map(m => m.sender_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name')
    .in('id', senderIds);
  const nameMap: Record<string, string> = {};
  for (const p of (profiles || [])) {
    nameMap[p.id] = p.name || 'Usuario';
  }

  return messages.map(m => ({
    id: m.id,
    sender: m.sender_id === userId ? 'me' : 'them',
    senderId: m.sender_id,
    senderName: nameMap[m.sender_id] || undefined,
    text: m.text,
    time: m.time || m.created_at,
    status: m.status,
    isEdited: m.is_edited || false,
    isDeleted: m.is_deleted || false,
    isEphemeral: m.is_ephemeral || false,
    ephemeralExpiresAt: m.ephemeral_expires_at || undefined,
    readBy: m.read_by || undefined,
    ...(m.audio_url ? { audioUrl: m.audio_url, audioDuration: m.audio_duration || 0, mimeType: m.mime_type || 'audio/webm' } : {}),
    ...(m.reply_to_id ? { replyToId: m.reply_to_id, replyToText: m.reply_to_text || '', replyToSender: m.reply_to_sender || '' } : {}),
    pollId: m.poll_id || undefined,
    ...(m.sticker_url ? { stickerUrl: m.sticker_url, isAnimated: m.is_animated || false } : {}),
    ...(m.gif_url ? { gifUrl: m.gif_url } : {}),
    ...(m.image_url ? { imageUrl: m.image_url } : {}),
    ...(m.video_url ? { videoUrl: m.video_url } : {}),
  }));
}

export async function markDelivered(chatId: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return;
  const userId = user.user.id;

  await supabase
    .from('messages')
    .update({ status: 'delivered' })
    .eq('chat_id', chatId)
    .eq('receiver_id', userId)
    .eq('status', 'sent');
}

export async function markAllDelivered() {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return;
  await supabase
    .from('messages')
    .update({ status: 'delivered' })
    .eq('receiver_id', user.user.id)
    .eq('status', 'sent');
}

export async function markRead(chatId: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return;
  const userId = user.user.id;

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, name, phone_number')
    .eq('id', userId)
    .single();

  const readerName = profile?.name || profile?.username || profile?.phone_number || 'Usuario';

  try {
    await supabase.rpc('mark_chat_read', {
      p_chat_id: chatId,
      p_user_id: userId,
      p_reader_name: readerName,
    });
  } catch {
    await supabase
      .from('messages')
      .update({ status: 'read', read_at: new Date().toISOString() })
      .eq('chat_id', chatId)
      .neq('sender_id', userId);
  }
}

export async function sendMessage(
  chatId: string,
  text: string,
  audioOptions?: { audioUrl: string; audioDuration: number; mimeType: string },
  replyTo?: { replyToId: string; replyToText: string; replyToSender: string },
  isEphemeral?: boolean,
  pollId?: string,
  stickerOptions?: { stickerUrl: string; isAnimated?: boolean } | { gifUrl: string },
  mediaOptions?: { imageUrl?: string; videoUrl?: string }
) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) throw new Error('No autenticado');
  const userId = user.user.id;

  const { data: participants } = await supabase
    .from('chat_participants')
    .select('profile_id')
    .eq('chat_id', chatId)
    .neq('profile_id', userId)
    .limit(1);

  const receiverId = participants?.[0]?.profile_id || null;

  // Block check: if receiver has blocked sender, reject
  if (receiverId) {
    const { data: blockCheck } = await supabase
      .from('blocks')
      .select('id')
      .eq('blocker_id', receiverId)
      .eq('blocked_id', userId)
      .maybeSingle();
    if (blockCheck) {
      throw new Error('No puedes enviar mensajes a este usuario');
    }
  }

  const expiresAt = isEphemeral
    ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 day TTL
    : null;

  const { data: msg, error } = await supabase
    .from('messages')
    .insert({
      chat_id: chatId,
      sender_id: userId,
      receiver_id: receiverId,
      text,
      status: 'sent',
      is_ephemeral: isEphemeral || false,
      ephemeral_expires_at: expiresAt,
      ...(audioOptions ? {
        audio_url: audioOptions.audioUrl,
        audio_duration: audioOptions.audioDuration,
        mime_type: audioOptions.mimeType,
      } : {}),
      ...(replyTo ? {
        reply_to_id: replyTo.replyToId,
        reply_to_text: replyTo.replyToText,
        reply_to_sender: replyTo.replyToSender,
      } : {}),
      poll_id: pollId || null,
      ...(stickerOptions && 'stickerUrl' in stickerOptions ? {
        sticker_url: stickerOptions.stickerUrl,
        is_animated: stickerOptions.isAnimated || false,
      } : {}),
      ...(stickerOptions && 'gifUrl' in stickerOptions ? {
        gif_url: stickerOptions.gifUrl,
      } : {}),
      ...(mediaOptions?.imageUrl ? { image_url: mediaOptions.imageUrl } : {}),
      ...(mediaOptions?.videoUrl ? { video_url: mediaOptions.videoUrl } : {}),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  return {
    message: {
      id: msg.id, sender: 'me', text, time: msg.created_at, status: 'sent',
      isEphemeral: isEphemeral || false,
      ...(audioOptions ? { audioUrl: audioOptions.audioUrl, audioDuration: audioOptions.audioDuration, mimeType: audioOptions.mimeType } : {}),
      ...(replyTo ? { replyToId: replyTo.replyToId, replyToText: replyTo.replyToText, replyToSender: replyTo.replyToSender } : {}),
      pollId: pollId || undefined,
      ...(stickerOptions && 'stickerUrl' in stickerOptions ? { stickerUrl: stickerOptions.stickerUrl, isAnimated: stickerOptions.isAnimated } : {}),
      ...(stickerOptions && 'gifUrl' in stickerOptions ? { gifUrl: stickerOptions.gifUrl } : {}),
      ...(mediaOptions?.imageUrl ? { imageUrl: mediaOptions.imageUrl } : {}),
      ...(mediaOptions?.videoUrl ? { videoUrl: mediaOptions.videoUrl } : {}),
    },
  };
}

export async function createChat(contactUserId: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) throw new Error('No autenticado');
  const userId = user.user.id;

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

  if (existingChatId) return { chatId: existingChatId, created: false };

  const chatId = crypto.randomUUID();

  const { data: otherProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', contactUserId)
    .single();

  if (!otherProfile) throw new Error('Contacto no encontrado');

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

  return { chatId, created: true };
}

export async function createGroupChat(name: string, participantIds: string[]): Promise<{ chatId: string }> {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) throw new Error('No autenticado');
  const userId = user.user.id;

  const chatId = crypto.randomUUID();

  const { error: chatErr } = await supabase.from('chats').insert({
    id: chatId,
    name,
    is_group: true,
    admin_id: userId,
    avatar: '',
    avatar_color: 'bg-emerald-500',
    created_at: new Date().toISOString(),
  });
  if (chatErr) throw new Error(chatErr.message);

  const allIds = [...new Set([userId, ...participantIds])];
  const { error: pErr } = await supabase.from('chat_participants').insert(
    allIds.map(pid => ({ chat_id: chatId, profile_id: pid }))
  );
  if (pErr) throw new Error(pErr.message);

  return { chatId };
}

export async function removeGroupMember(chatId: string, memberId: string): Promise<void> {
  const { error } = await supabase
    .from('chat_participants')
    .delete()
    .eq('chat_id', chatId)
    .eq('profile_id', memberId);
  if (error) throw new Error(error.message);
}

export async function leaveGroup(chatId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const { error } = await supabase
    .from('chat_participants')
    .delete()
    .eq('chat_id', chatId)
    .eq('profile_id', user.id);
  if (error) throw new Error(error.message);
}

export async function deleteGroup(chatId: string): Promise<void> {
  const { error } = await supabase
    .from('chats')
    .delete()
    .eq('id', chatId);
  if (error) throw new Error(error.message);
}

export async function updateGroupName(chatId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('chats')
    .update({ name })
    .eq('id', chatId);
  if (error) throw new Error(error.message);
}

export async function getGroupMembers(chatId: string): Promise<{ id: string; name: string; avatar: string }[]> {
  const { data: participants } = await supabase
    .from('chat_participants')
    .select('profile_id')
    .eq('chat_id', chatId);
  if (!participants) return [];
  const ids = participants.map(p => p.profile_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, avatar_url')
    .in('id', ids);
  return (profiles || []).map(p => ({ id: p.id, name: p.name || 'Usuario', avatar: p.avatar_url || '' }));
}

export async function createGroupInvite(chatId: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const { error } = await supabase
    .from('group_invites')
    .insert({ chat_id: chatId, code, created_by: user.id });
  if (error) throw new Error(error.message);
  return code;
}

export async function getGroupInviteInfo(code: string): Promise<{ chatId: string; chatName: string; memberCount: number } | null> {
  const { data: invite } = await supabase
    .from('group_invites')
    .select('chat_id')
    .eq('code', code)
    .maybeSingle();
  if (!invite) return null;
  const { data: chat } = await supabase
    .from('chats')
    .select('name')
    .eq('id', invite.chat_id)
    .single();
  if (!chat) return null;
  const { count } = await supabase
    .from('chat_participants')
    .select('id', { count: 'exact', head: true })
    .eq('chat_id', invite.chat_id);
  return { chatId: invite.chat_id, chatName: chat?.name || 'Grupo', memberCount: count || 0 };
}

export async function joinGroupByInvite(code: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const { data: invite } = await supabase
    .from('group_invites')
    .select('chat_id')
    .eq('code', code)
    .maybeSingle();
  if (!invite) throw new Error('Código inválido o expirado');
  // Check if already a member
  const { data: existingMember } = await supabase
    .from('chat_participants')
    .select('id')
    .eq('chat_id', invite.chat_id)
    .eq('profile_id', user.id)
    .maybeSingle();
  if (existingMember) throw new Error('Ya eres miembro de este grupo');
  // Add member
  const { error } = await supabase
    .from('chat_participants')
    .insert({ chat_id: invite.chat_id, profile_id: user.id });
  if (error) throw new Error(error.message);
  return invite.chat_id;
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

  // Check if sender is blocked by the receiver
  const { data: blockCheck } = await supabase
    .from('blocks')
    .select('id')
    .eq('blocker_id', contactUserId)
    .eq('blocked_id', userId)
    .maybeSingle();
  if (blockCheck) {
    throw new Error('No puedes enviar mensajes a este usuario');
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

  const cleanPhone = phone.replace(/\D/g, '');
  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .not('phone_number', 'is', null)
    .limit(500);

  const contactProfile = profiles?.find(p => {
    const stored = p.phone_number?.replace(/\D/g, '');
    return stored === cleanPhone;
  });

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

export async function deleteContact(profileId: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) throw new Error('No autenticado');
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('user_id', user.user.id)
    .eq('contact_user_id', profileId);
  if (error) throw new Error(error.message);
}

export async function searchUsers(q: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return [];
  const userId = user.user.id;
  const query = q.toLowerCase().replace(/^@/, '').trim();
  if (query.length < 2) return [];

  // Try DB-level filter
  const digits = query.replace(/\D/g, '');
  // Strip all non-digits and search with ilike to match any format (with/without country code, spaces, leading 0)
  const { data: exactPhone } = digits.length >= 7 ? await supabase
    .from('profiles')
    .select('id')
    .ilike('phone_number', `%${digits}%`)
    .neq('id', userId)
    .limit(1) : { data: null };

  if (exactPhone && exactPhone.length > 0) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', exactPhone[0].id)
      .single();
    if (profile) return [{
      id: profile.id, name: profile.name, username: profile.username,
      phone: profile.phone_number, avatar: profile.avatar_url || '', bio: profile.bio || '',
    }];
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('*')
    .neq('id', userId)
    .or(`username.ilike.%${query}%,name.ilike.%${query}%`)
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
  let viewMap: Record<string, number> = {};
  if (ids.length > 0) {
    try {
      const { data: viewsData } = await supabase
        .from('momento_views')
        .select('momento_id, user_id')
        .in('momento_id', ids);
      if (viewsData) {
        for (const v of viewsData) {
          viewMap[v.momento_id] = (viewMap[v.momento_id] || 0) + 1;
        }
      }
    } catch {}
  }

  return data.map((m: any) => ({
    id: m.id,
    name: m.name || '',
    avatar: m.avatar || '',
    avatarColor: m.avatar_color || undefined,
    profileId: m.user_id || '',
    time: formatTimeAgo(m.created_at),
    hasUnseen: m.has_unseen ?? true,
    image: m.image || '',
    caption: m.caption || '',
    viewCount: viewMap[m.id] || 0,
    reactions: m.reactions || [],
    animMeta: m.anim_meta || undefined,
  }));
}

export async function addMoment(moment: {
  name: string;
  avatar: string;
  avatarColor?: string;
  hasUnseen: boolean;
  image: string;
  caption: string;
  animMeta?: import('../types').MomentAnimMeta;
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
      anim_meta: moment.animMeta || {},
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteMoment(momentoId: string) {
  if (!isValidUUID(momentoId)) return;
  const { error } = await supabase.from('momentos').delete().eq('id', momentoId);
  if (error) throw new Error(error.message);
}

export async function viewMoment(momentoId: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return;

  // Skip if momentoId is not a valid UUID (e.g. local optimistic ID) — prevents FK violation 400
  if (!isValidUUID(momentoId)) return;

  // Only insert view if not already viewed
  const { data: existing } = await supabase
    .from('momento_views')
    .select('id')
    .eq('momento_id', momentoId)
    .eq('user_id', user.user.id)
    .maybeSingle();

  if (!existing) {
    await supabase.from('momento_views').insert({
      momento_id: momentoId,
      user_id: user.user.id,
    });
  }

  // Only mark has_unseen=false if the viewer owns the momento
  if (user.user.id) {
    const { data: momento } = await supabase
      .from('momentos')
      .select('user_id')
      .eq('id', momentoId)
      .maybeSingle();
    if (momento && momento.user_id === user.user.id) {
      await supabase.from('momentos').update({ has_unseen: false }).eq('id', momentoId);
    }
  }
}

export async function getMomentViews(momentoId: string): Promise<number> {
  if (!isValidUUID(momentoId)) return 0;
  const { data } = await supabase
    .from('momento_views')
    .select('id', { count: 'exact', head: true })
    .eq('momento_id', momentoId);

  return data?.length || 0;
}

export async function getMomentViewers(momentoId: string): Promise<{ id: string; name: string; avatar: string; viewedAt: string }[]> {
  if (!isValidUUID(momentoId)) return [];
  const { data } = await supabase
    .from('momento_views')
    .select('user_id, created_at')
    .eq('momento_id', momentoId)
    .order('created_at', { ascending: false });
  if (!data) return [];
  const profiles = await Promise.all(data.map(async (v: any) => {
    const { data: p } = await supabase.from('profiles').select('id, name, avatar_url').eq('id', v.user_id).single();
    return p ? { id: p.id, name: p.name || 'Usuario', avatar: p.avatar_url || '', viewedAt: v.created_at } : null;
  }));
  return profiles.filter(Boolean) as { id: string; name: string; avatar: string; viewedAt: string }[];
}

export async function reactToMoment(momentoId: string, emoji: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return;
  if (!isValidUUID(momentoId)) return;

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
  if (!isValidUUID(momentoId)) return { myReaction: null, summary: [] };

  try {
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
  } catch {
    return { myReaction: null, summary: [] };
  }
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
    fontPreference: p?.font_preference || 'clasico',
    chatStyle: p?.chat_style || '',
    bubbleColor: p?.bubble_color || '',
    partnerBubbleColor: p?.partner_bubble_color || '',
    privacyLastSeen: p?.privacy_last_seen || 'everyone',
    privacyOnline: p?.privacy_online || 'everyone',
    privacyReadReceipts: p?.privacy_read_receipts !== false,
  };
}

export async function updateProfile(data: Partial<UserProfile>) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return;

  const payload: Record<string, any> = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.avatar !== undefined) payload.avatar_url = data.avatar;
  if (data.phone !== undefined) payload.phone_number = data.phone;
  if (data.username !== undefined) payload.username = data.username;
  if (data.bio !== undefined) payload.bio = data.bio;
  if (data.fontPreference !== undefined) payload.font_preference = data.fontPreference;
  if (data.chatStyle !== undefined) payload.chat_style = data.chatStyle;
  if (data.bubbleColor !== undefined) payload.bubble_color = data.bubbleColor;
  if (data.partnerBubbleColor !== undefined) payload.partner_bubble_color = data.partnerBubbleColor;
  if (data.privacyLastSeen !== undefined) payload.privacy_last_seen = data.privacyLastSeen;
  if (data.privacyOnline !== undefined) payload.privacy_online = data.privacyOnline;
  if (data.privacyReadReceipts !== undefined) payload.privacy_read_receipts = data.privacyReadReceipts;

  await supabase.from('profiles').update(payload).eq('id', user.user.id);
}

// ─── AUTO-REPLY ─────────────────────────────────────────────────────

export async function getAutoReplyConfig(): Promise<import('../types').AutoReplyConfig> {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return { enabled: false, message: '', delay: 0 };
  const { data } = await supabase.from('profiles').select('auto_reply_config').eq('id', user.user.id).maybeSingle();
  if (data?.auto_reply_config) {
    const cfg = data.auto_reply_config as any;
    return { enabled: !!cfg.enabled, message: cfg.message || '', delay: cfg.delay || 0 };
  }
  return { enabled: false, message: '', delay: 0 };
}

export async function updateAutoReplyConfig(config: import('../types').AutoReplyConfig): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return;
  await supabase.from('profiles').update({ auto_reply_config: config }).eq('id', user.user.id);
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
    imageUrls: b.image_urls || [],
    zone: b.zone,
    category: b.category,
    contactName: b.contact_name,
    contactPhone: b.phone_contact || '',
  }));
}

export async function createBusiness(data: {
  businessName: string; description: string; imageUrls?: string[];
  zone: string; category?: string; contactName: string; contactPhone?: string;
}) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) throw new Error('No autenticado');

  const { data: biz, error } = await supabase.from('businesses').insert({
    user_id: user.user.id,
    name: data.businessName,
    description: data.description,
    image_urls: data.imageUrls || [],
    zone: data.zone,
    category: data.category || 'General',
    phone_contact: data.contactPhone || '',
  }).select().single();

  if (error) throw new Error(error.message);
  return biz;
}

// ─── Business Stats ────────────────────────────────────────────────────

export interface BusinessStats {
  id: string;
  businessName: string;
  views: number;
  chatClicks: number;
}

export interface BusinessStatsSummary {
  totalViews: number;
  totalChatClicks: number;
  perBusiness: BusinessStats[];
}

export async function getMyBusinessStats(timeFilter?: 'today' | 'week' | 'month' | 'all'): Promise<BusinessStatsSummary> {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) throw new Error('No autenticado');

  // Determine date cut-off based on timeFilter
  let since: string | null = null;
  const now = new Date();
  if (timeFilter === 'today') {
    since = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  } else if (timeFilter === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    since = d.toISOString();
  } else if (timeFilter === 'month') {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    since = d.toISOString();
  }

  // Fetch user's businesses
  const { data: businesses, error: bizError } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('user_id', user.user.id);
  if (bizError) throw new Error(bizError.message);
  if (!businesses || businesses.length === 0) {
    return { totalViews: 0, totalChatClicks: 0, perBusiness: [] };
  }

  const bizIds = businesses.map(b => b.id);

  // Build queries with optional time filter
  let viewsQuery = supabase.from('business_views').select('business_id', { count: 'exact', head: true }).in('business_id', bizIds);
  let clicksQuery = supabase.from('business_chat_clicks').select('business_id', { count: 'exact', head: true }).in('business_id', bizIds);

  if (since) {
    viewsQuery = viewsQuery.gte('viewed_at', since);
    clicksQuery = clicksQuery.gte('clicked_at', since);
  }

  const [viewsResult, clicksResult] = await Promise.all([viewsQuery, clicksQuery]);

  // Per-business counts
  const perBusiness: BusinessStats[] = [];
  for (const biz of businesses) {
    let bizViewsQuery = supabase.from('business_views').select('id', { count: 'exact', head: true }).eq('business_id', biz.id);
    let bizClicksQuery = supabase.from('business_chat_clicks').select('id', { count: 'exact', head: true }).eq('business_id', biz.id);
    if (since) {
      bizViewsQuery = bizViewsQuery.gte('viewed_at', since);
      bizClicksQuery = bizClicksQuery.gte('clicked_at', since);
    }
    const [vRes, cRes] = await Promise.all([bizViewsQuery, bizClicksQuery]);
    perBusiness.push({
      id: biz.id,
      businessName: biz.name,
      views: vRes.count ?? 0,
      chatClicks: cRes.count ?? 0,
    });
  }

  return {
    totalViews: viewsResult.count ?? 0,
    totalChatClicks: clicksResult.count ?? 0,
    perBusiness,
  };
}

export async function trackBusinessView(businessId: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return;
  await supabase.from('business_views').insert({
    business_id: businessId,
    viewer_id: user.user.id,
  });
}

export async function trackBusinessChatClick(businessId: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return;
  await supabase.from('business_chat_clicks').insert({
    business_id: businessId,
    user_id: user.user.id,
  });
}

// ─── SMS Password Recovery ───────────────────────────────────────────

const SERVER_URL: string | null = import.meta.env.VITE_SERVER_URL || null;

export async function sendResetCode(phone: string) {
  if (!SERVER_URL) throw new Error('VITE_SERVER_URL no está configurado');
  const res = await fetch(`${SERVER_URL}/api/auth/send-reset-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al enviar código');
  return data;
}

export async function verifyResetCode(phone: string, code: string) {
  if (!SERVER_URL) throw new Error('VITE_SERVER_URL no está configurado');
  const res = await fetch(`${SERVER_URL}/api/auth/verify-reset-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Código inválido');
  return data;
}

export async function updatePassword(phone: string, code: string, newPassword: string) {
  if (!SERVER_URL) throw new Error('VITE_SERVER_URL no está configurado');
  const res = await fetch(`${SERVER_URL}/api/auth/update-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, code, newPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al actualizar contraseña');
  return data;
}

// ─── MESSAGE EDIT / DELETE ────────────────────────────────────────

export async function editMessage(messageId: string, text: string) {
  const { data, error } = await supabase
    .from('messages')
    .update({ text, is_edited: true })
    .eq('id', messageId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { message: data };
}

export async function deleteMessage(messageId: string) {
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId);

  if (error) throw new Error(error.message);
}

// ─── REDON ID ─────────────────────────────────────────────────────

function shortHash(s: string, len: number = 4): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  let n = Math.abs(hash);
  for (let i = 0; i < len; i++) {
    result = chars[n % chars.length] + result;
    n = Math.floor(n / chars.length);
  }
  return result;
}

export async function getRedonId(): Promise<string> {
  const cached = localStorage.getItem('redon_id');
  if (cached) return cached;

  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return '@usuario#0000';

  const username = user.user.user_metadata?.username || 'usuario';
  const suffix = shortHash(user.user.id, 4);
  const redonId = `@${username}#${suffix}`;
  localStorage.setItem('redon_id', redonId);
  return redonId;
}

// ─── FAQ ITEMS ─────────────────────────────────────────────

export async function getFaqItems(): Promise<FaqItem[]> {
  const { data, error } = await supabase
    .from('faq_items')
    .select('id, question, answer, position')
    .order('position', { ascending: true });

  if (error) throw error;
  return (data || []).map(item => ({
    id: item.id,
    question: item.question,
    answer: item.answer,
    position: item.position ?? 0,
  }));
}

export async function addFaqItem(question: string, answer: string): Promise<FaqItem> {
  const { data, error } = await supabase
    .from('faq_items')
    .insert({ question, answer })
    .select('id, question, answer, position')
    .single();

  if (error) throw error;
  return {
    id: data.id,
    question: data.question,
    answer: data.answer,
    position: data.position ?? 0,
  };
}

export async function updateFaqItem(id: string, question: string, answer: string): Promise<void> {
  const { error } = await supabase
    .from('faq_items')
    .update({ question, answer })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteFaqItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('faq_items')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function reorderFaqItems(items: { id: string; position: number }[]): Promise<void> {
  for (const item of items) {
    const { error } = await supabase
      .from('faq_items')
      .update({ position: item.position })
      .eq('id', item.id);
    if (error) throw error;
  }
}

export async function deleteChat(chatId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('chat_participants')
    .update({ hidden: true })
    .eq('chat_id', chatId)
    .eq('profile_id', user.id);
}

export async function getCallHistory(userId: string): Promise<import('../types').CallLog[]> {
  try {
    const { data } = await supabase
      .from('calls')
      .select('*')
      .or(`caller_id.eq.${userId},callee_id.eq.${userId}`)
      .order('started_at', { ascending: false })
      .limit(100);
    if (!data) return [];
    const profileIds = new Set<string>();
    data.forEach(r => { profileIds.add(r.caller_id); profileIds.add(r.callee_id); });
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, avatar_url, username')
      .in('id', [...profileIds]);
    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    return data.map((row: any) => {
      const isIncoming = row.callee_id === userId;
      const contactId = isIncoming ? row.caller_id : row.callee_id;
      const profile = profileMap.get(contactId);
      return {
        id: row.id,
        chatId: row.chat_id || '',
        callerId: row.caller_id,
        calleeId: row.callee_id,
        callType: row.call_type || 'audio',
        status: row.status || 'missed',
        startedAt: row.started_at || '',
        endedAt: row.ended_at || undefined,
        duration: row.duration || 0,
        contactName: profile?.name || profile?.username || 'Desconocido',
        contactAvatar: profile?.avatar_url || '',
        isIncoming,
      };
    });
  } catch {
    return [];
  }
}

export async function getMissedCallCount(userId: string): Promise<number> {
  try {
    const { count } = await supabase
      .from('calls')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'missed')
      .or(`callee_id.eq.${userId},caller_id.eq.${userId}`);
    return count || 0;
  } catch {
    return 0;
  }
}

export async function insertCall(chatId: string, callerId: string, calleeId: string, callType: 'audio' | 'video', status: string = 'ringing'): Promise<string | null> {
  const { data, error } = await supabase
    .from('calls')
    .insert({ chat_id: chatId, caller_id: callerId, callee_id: calleeId, call_type: callType, status })
    .select('id')
    .single();
  if (error) {
    console.error('[insertCall] FALLÓ:', { message: error.message, code: error.code, details: error.details, hint: error.hint });
    return null;
  }
  return data?.id || null;
}

export async function updateCall(callId: string, updates: { status?: string; duration?: number; ended_at?: string }): Promise<void> {
  const { error } = await supabase
    .from('calls')
    .update(updates)
    .eq('id', callId);
  if (error) console.warn('updateCall error:', error.message);
}

// ─── REACTIONS ────────────────────────────────────────────────────

export async function addReaction(messageId: string, emoji: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return;
  await supabase
    .from('message_reactions')
    .upsert({ message_id: messageId, profile_id: user.user.id, emoji }, { onConflict: 'message_id,profile_id' });
}

export async function removeReaction(messageId: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return;
  await supabase
    .from('message_reactions')
    .delete()
    .eq('message_id', messageId)
    .eq('profile_id', user.user.id);
}

export async function getReactions(messageId: string): Promise<{ emoji: string; profileId: string }[]> {
  const { data } = await supabase
    .from('message_reactions')
    .select('emoji, profile_id')
    .eq('message_id', messageId);
  return (data || []).map(r => ({ emoji: r.emoji, profileId: r.profile_id }));
}

// ─── BLOCKS ──────────────────────────────────────────────────────

export async function blockUser(blockedProfileId: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return;
  const { error } = await supabase
    .from('blocks')
    .insert({ blocker_id: user.user.id, blocked_id: blockedProfileId });
  if (error && !error.message?.includes('duplicate') && !error.message?.includes('unique')) {
    console.warn('blockUser error:', error.message);
  }
}

export async function unblockUser(blockedProfileId: string) {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return;
  await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', user.user.id)
    .eq('blocked_id', blockedProfileId);
}

export async function getBlockedUserIds(): Promise<string[]> {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return [];
  const { data } = await supabase
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', user.user.id);
  return (data || []).map(r => r.blocked_id);
}

// ─── AVATAR UPLOAD ───────────────────────────────────────────────

export async function uploadAvatar(file: File): Promise<string> {
  const { compressImage } = await import('./imageCompression');
  const compressed = await compressImage(file, { maxWidth: 512, quality: 0.6 });
  const ext = compressed.name.split('.').pop() || 'jpg';
  const fileName = `avatar-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(fileName, compressed, { contentType: compressed.type, upsert: false });
  if (uploadError) throw new Error(uploadError.message);
  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
  return publicUrl;
}

// ─── POLLS (ENCUESTAS) ────────────────────────────────────────────

export async function createPoll(
  title: string,
  options: string[],
  multipleChoice?: boolean
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  const { data: poll, error: pollErr } = await supabase
    .from('encuestas')
    .insert({ title, created_by: user.id, multiple_choice: multipleChoice || false })
    .select()
    .single();
  if (pollErr) throw new Error(pollErr.message);
  const optionRows = options.map(opt => ({
    encuesta_id: poll.id,
    option_text: opt,
  }));
  const { error: optErr } = await supabase.from('poll_options').insert(optionRows);
  if (optErr) throw new Error(optErr.message);
  return poll.id;
}

export async function votePoll(encuestaId: string, optionId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');
  // First check if user already voted
  const { data: existingVote } = await supabase
    .from('poll_votes')
    .select('id, option_id')
    .eq('user_id', user.id)
    .eq('encuesta_id', encuestaId)
    .maybeSingle();
  if (existingVote) {
    // If same option, remove vote (toggle)
    if (existingVote.option_id === optionId) {
      await supabase.from('poll_votes').delete().eq('id', existingVote.id);
      return;
    }
    // Check if multiple choice
    const { data: poll } = await supabase
      .from('encuestas')
      .select('multiple_choice')
      .eq('id', encuestaId)
      .single();
    if (!poll?.multiple_choice) {
      // Remove old vote, add new
      await supabase.from('poll_votes').delete().eq('user_id', user.id).eq('encuesta_id', encuestaId);
    }
  }
  await supabase.from('poll_votes').insert({
    option_id: optionId,
    user_id: user.id,
    encuesta_id: encuestaId,
  });
}

export async function getPoll(encuestaId: string, userId: string): Promise<Poll> {
  const { data: poll } = await supabase
    .from('encuestas')
    .select('*')
    .eq('id', encuestaId)
    .single();
  if (!poll) throw new Error('Encuesta no encontrada');
  const { data: options } = await supabase
    .from('poll_options')
    .select('*')
    .eq('encuesta_id', encuestaId);
  // Get vote counts
  const { data: votes } = await supabase
    .from('poll_votes')
    .select('option_id, user_id')
    .eq('encuesta_id', encuestaId);
  const voteMap = new Map<string, number>();
  const userVotes = new Set<string>();
  (votes || []).forEach(v => {
    voteMap.set(v.option_id, (voteMap.get(v.option_id) || 0) + 1);
    if (v.user_id === userId) userVotes.add(v.option_id);
  });
  const totalVotes = (votes || []).length;
  return {
    id: poll.id,
    title: poll.title,
    description: poll.description || '',
    created_by: poll.created_by,
    multiple_choice: poll.multiple_choice || false,
    starts_at: poll.starts_at,
    expires_at: poll.expires_at,
    created_at: poll.created_at,
    totalVotes,
    options: (options || []).map(o => ({
      id: o.id,
      encuesta_id: o.encuesta_id,
      option_text: o.option_text,
      image_url: o.image_url || '',
      created_at: o.created_at,
      voteCount: voteMap.get(o.id) || 0,
      voted: userVotes.has(o.id),
    })),
  };
}

export async function getMyVotes(encuestaId: string): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from('poll_votes')
    .select('option_id')
    .eq('user_id', user.id)
    .eq('encuesta_id', encuestaId);
  return (data || []).map(v => v.option_id);
}

// ─── BACKUP / RESTORE ────────────────────────────────────────────

const BACKUP_BUCKET = 'backups';

export async function createBackup(chats: Chat[]): Promise<boolean> {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return false;
  const backupData = JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    userId: user.user.id,
    chats,
  });
  const blob = new Blob([backupData], { type: 'application/json' });
  const file = new File([blob], 'backup.json', { type: 'application/json' });
  const filePath = `${user.user.id}/backup.json`;
  const { error } = await supabase.storage.from(BACKUP_BUCKET).upload(filePath, file, { upsert: true });
  if (error) {
    console.warn('createBackup error:', error.message);
    return false;
  }
  return true;
}

export async function restoreBackup(): Promise<Chat[] | null> {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return null;
  const filePath = `${user.user.id}/backup.json`;
  const { data, error } = await supabase.storage.from(BACKUP_BUCKET).download(filePath);
  if (error || !data) {
    console.warn('restoreBackup error:', error?.message);
    return null;
  }
  try {
    const text = await data.text();
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.chats)) {
      return parsed.chats as Chat[];
    }
    return null;
  } catch {
    return null;
  }
}

export async function getBackupInfo(): Promise<{ exportedAt: string; chatCount: number } | null> {
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return null;
  const filePath = `${user.user.id}/backup.json`;
  const { data, error } = await supabase.storage.from(BACKUP_BUCKET).download(filePath);
  if (error || !data) return null;
  try {
    const text = await data.text();
    const parsed = JSON.parse(text);
    if (parsed && parsed.exportedAt) {
      return { exportedAt: parsed.exportedAt, chatCount: parsed.chats?.length || 0 };
    }
    return null;
  } catch {
    return null;
  }
}

export interface FlyerTemplate {
  id: number;
  name: string;
  category: string;
  image_url: string;
  thumbnail_url: string | null;
  is_active: boolean;
  created_at: string;
}

export async function getFlyerTemplates(category?: string): Promise<FlyerTemplate[]> {
  let query = supabase.from('flyer_templates').select('*').eq('is_active', true);
  if (category) query = query.eq('category', category);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function uploadFlyerTemplate(file: File, name: string, category: string): Promise<FlyerTemplate | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const ext = file.name.split('.').pop() || 'png';
  const fileName = `templates/${user.id}_${Date.now()}.${ext}`;
  const { data: uploadData, error: uploadError } = await supabase.storage.from('flyer-templates').upload(fileName, file, { upsert: false });
  if (uploadError || !uploadData) throw uploadError || new Error('Upload failed');
  const { data: { publicUrl } } = supabase.storage.from('flyer-templates').getPublicUrl(uploadData.path);
  const thumbName = `templates/thumbs_${user.id}_${Date.now()}.${ext}`;
  const { data: thumbData, error: thumbError } = await supabase.storage.from('flyer-templates').upload(thumbName, file, { upsert: false });
  const thumbnailUrl = thumbError ? null : supabase.storage.from('flyer-templates').getPublicUrl(thumbData!.path).data.publicUrl;
  const { data, error } = await supabase.from('flyer_templates').insert({
    name, category, image_url: publicUrl, thumbnail_url: thumbnailUrl,
  }).select().single();
  if (error) throw error;
  return data;
}

// ─── API object for backward compatibility ─────────────────────────

export const api = {
  login,
  register,
  forgot,
  getChats,
  getMessages,
  markDelivered,
  markAllDelivered,
  markRead,
  sendMessage,
  createChat,
  createGroupChat,
  removeGroupMember,
  leaveGroup,
  deleteGroup,
  updateGroupName,
  getGroupMembers,
  sendDirectMessage,
  getContacts,
  addContact,
  deleteContact,
  searchUsers,
  getMoments,
  addMoment,
  viewMoment,
  deleteMoment,
  getMomentViews,
  getMomentViewers,
  reactToMoment,
  getMomentReactions,
  getProfile,
  updateProfile,
  getBusinesses,
  createBusiness,
  sendResetCode,
  verifyResetCode,
  updatePassword,
  editMessage,
  deleteMessage,
  deleteChat,
  getCallHistory,
  getMissedCallCount,
  getAutoReplyConfig,
  updateAutoReplyConfig,
  insertCall,
  updateCall,
  getRedonId,
  getFaqItems,
  addFaqItem,
  updateFaqItem,
  deleteFaqItem,
  reorderFaqItems,
  addReaction,
  removeReaction,
  getReactions,
  blockUser,
  unblockUser,
  getBlockedUserIds,
  createPoll,
  votePoll,
  getPoll,
  getMyVotes,
  createGroupInvite,
  getGroupInviteInfo,
  joinGroupByInvite,
  createBackup,
  restoreBackup,
  getBackupInfo,
  getFlyerTemplates,
  uploadFlyerTemplate,
  uploadAvatar,
};
