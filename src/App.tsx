import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { Chat, Message, UserProfile, ActiveTab, Moment, ChatStyle, BusinessListing, AutoReplyConfig } from './types';
import { supabase } from './lib/supabase';
import { api } from './services/api';
import { connectSocket, disconnectSocket, setMessageHandler, setNewChatHandler, setStatusUpdateHandler } from './services/socket';
import { playSound } from './services/soundPlayer';
import { setupCapacitorPush, sendFcmPush } from './services/pushCapacitor';
import { loadNotifPrefs } from './services/notifPrefs';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { App as CapacitorApp } from '@capacitor/app';

const AuthView = React.lazy(() => import('./components/AuthView'));
const ChatList = React.lazy(() => import('./components/ChatList'));
const ChatDetail = React.lazy(() => import('./components/ChatDetail'));
const MomentsView = React.lazy(() => import('./components/MomentsView'));
const InterestsView = React.lazy(() => import('./components/InterestsView'));
const EmprendedorView = React.lazy(() => import('./components/EmprendedorView'));
const ProfileView = React.lazy(() => import('./components/ProfileView'));

import { MessageSquare, User, Sparkles, DollarSign, TrendingUp, LogOut } from 'lucide-react';
import { CallSuite } from './components/CallSuite';
import Toast from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';

import { showToast } from './services/toastService';
import { addToQueue, getQueue, removeFromQueue, isOnline } from './services/offlineQueue';
import LockScreen from './components/LockScreen';
import { isPinEnabled } from './services/lockService';

type IncomingCall = {
  chatId: string;
  contactId: string;
  contactName: string;
  contactAvatar: string;
};

export default function App() {
  const [profile, setProfile] = useState<UserProfile>({ name: '', avatar: '', phone: '', username: '', bio: '' });
  const [chats, setChats] = useState<Chat[]>([]);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('chats');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showLockScreen, setShowLockScreen] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [savedPhones, setSavedPhones] = useState<Set<string>>(new Set());
  const [savingPhone, setSavingPhone] = useState<string | null>(null);
  const [blockedProfileIds, setBlockedProfileIds] = useState<Set<string>>(new Set());
  const blockedProfileIdsRef = useRef(blockedProfileIds);
  blockedProfileIdsRef.current = blockedProfileIds;
  const chatsRef = useRef(chats);
  chatsRef.current = chats;
  const activeChatIdRef = useRef(activeChatId);
  activeChatIdRef.current = activeChatId;
  const deletedMsgIdsRef = useRef<Set<string>>(new Set(
    (() => { try { return JSON.parse(localStorage.getItem('deleted_msg_ids') || '[]'); } catch { return []; } })()
  ));
  const [callState, setCallState] = useState<{
    isOpen: boolean;
    contactName: string;
    contactAvatar: string;
    chatId: string;
    contactId: string;
    direction: 'outgoing' | 'incoming';
    callType: 'audio' | 'video';
    callId?: string | null;
  } | null>(null);
  const callStateRef = useRef(callState);
  callStateRef.current = callState;

  const callNotifyChanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const callSignalChanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ─── Auto-reply ───
  const autoReplyConfigRef = useRef<AutoReplyConfig>({ enabled: false, message: '', delay: 0 });
  const autoRepliedChatsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    api.getAutoReplyConfig().then(cfg => { autoReplyConfigRef.current = cfg; }).catch(() => {});
  }, [userId]);

  // ─── Swipe between tabs ───
  const tabOrder: ActiveTab[] = ['chats', 'moments', 'interests', 'emprendedor', 'profile'];
  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (activeChatId) return;
    if (!tabOrder.includes(activeTab as typeof tabOrder[number])) return;
    const deltaX = e.changedTouches[0].clientX - swipeStartX.current;
    const deltaY = e.changedTouches[0].clientY - swipeStartY.current;
    if (Math.abs(deltaX) < Math.abs(deltaY) * 1.5) return;
    const threshold = 60;
    const idx = tabOrder.indexOf(activeTab as typeof tabOrder[number]);
    if (deltaX > threshold && idx > 0) setActiveTab(tabOrder[idx - 1]);
    else if (deltaX < -threshold && idx < tabOrder.length - 1) setActiveTab(tabOrder[idx + 1]);
  }, [activeChatId, activeTab]);

  const [fontPreference, setFontPreference] = useState<string>(() => {
    return localStorage.getItem('redon_font_preference') || 'clasico';
  });

  const [chatStyle, setChatStyle] = useState<ChatStyle>(() => {
    let savedColor = localStorage.getItem('chat_bubble_color');
    let savedBG = localStorage.getItem('chat_bubble_background');
    const savedPartner = localStorage.getItem('chat_bubble_partner_color');
    if (!savedBG) {
      const legacyWallpaper = localStorage.getItem('chat_wallpaper_class');
      if (legacyWallpaper && legacyWallpaper !== 'bg-[#f0f2f5]') {
        savedBG = legacyWallpaper;
        localStorage.setItem('chat_bubble_background', legacyWallpaper);
      }
    }
    return {
      bubbleColor: savedColor || 'blue',
      bubbleBackground: savedBG || '',
      partnerBubbleColor: savedPartner || 'slate',
    };
  });

  const handleUpdateChatStyle = (newStyle: ChatStyle) => {
    setChatStyle(newStyle);
    localStorage.setItem('chat_bubble_color', newStyle.bubbleColor);
    localStorage.setItem('chat_bubble_background', newStyle.bubbleBackground);
    localStorage.setItem('chat_bubble_partner_color', newStyle.partnerBubbleColor);
    api.updateProfile({
      chatStyle: JSON.stringify(newStyle),
      bubbleColor: newStyle.bubbleColor,
      partnerBubbleColor: newStyle.partnerBubbleColor,
    }).catch(() => {});
  };

  const loadSavedPhones = useCallback(() => {
    api.getContacts().then(contacts => {
      const phones = new Set<string>();
      contacts.forEach(c => { if (c.phone) phones.add(c.phone.replace(/\D/g, '')); });
      // Also restore rejected phones from localStorage (persist after refresh)
      try {
        const rejected = JSON.parse(localStorage.getItem('rejected_phones') || '[]') as string[];
        rejected.forEach(p => phones.add(p));
      } catch {}
      setSavedPhones(phones);
    }).catch(() => {});
  }, []);

  const handleSaveContact = useCallback(async (phone: string, name: string) => {
    setSavingPhone(phone);
    try {
      await api.addContact(phone, name);
      setSavedPhones(prev => new Set(prev).add(phone.replace(/\D/g, '')));
      showToast('Contacto guardado con éxito', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al guardar contacto', 'error');
    }
    setSavingPhone(null);
  }, []);

  const handleRejectContact = useCallback((chatId: string) => {
    setChats(prev => {
      const chat = prev.find(c => c.id === chatId);
      if (chat?.phone) {
        const cleanPhone = chat.phone.replace(/\D/g, '');
        setSavedPhones(p => new Set(p).add(cleanPhone));
        try {
          const rejected = JSON.parse(localStorage.getItem('rejected_phones') || '[]') as string[];
          if (!rejected.includes(cleanPhone)) {
            rejected.push(cleanPhone);
            localStorage.setItem('rejected_phones', JSON.stringify(rejected));
          }
        } catch {}
      }
      return prev;
    });
  }, []);

  const handleDeleteChat = useCallback((chatId: string) => {
    setActiveChatId(null);
    setChats(prev => prev.filter(c => c.id !== chatId));
  }, []);

  const handleDeleteContact = useCallback(async (chatId: string) => {
    const chat = chatsRef.current.find(c => c.id === chatId);
    if (!chat) return;
    setChats(prev => prev.filter(c => c.id !== chatId));
    if (chat.phone) {
      setSavedPhones(prev => {
        const next = new Set(prev);
        next.delete(chat.phone.replace(/\D/g, ''));
        return next;
      });
    }
    if (chat.profileId) {
      try {
        await api.deleteContact(chat.profileId);
        showToast('Contacto eliminado', 'success');
      } catch {
        showToast('Error al eliminar contacto', 'error');
      }
    }
  }, []);

  const handleChatUpdated = useCallback((updatedChat: Chat) => {
    setChats(prev => prev.map(c => c.id === updatedChat.id ? { ...c, ...updatedChat } : c));
  }, []);

  const [authInit, setAuthInit] = useState<'pending' | 'ready'>('pending');

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark';
  });

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    document.documentElement.classList.toggle('dark', newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  // Sync fontPreference state from profile when it loads
  useEffect(() => {
    if (profile?.fontPreference) {
      setFontPreference(profile.fontPreference);
      localStorage.setItem('redon_font_preference', profile.fontPreference);
    }
  }, [profile?.fontPreference]);

  // Hide native splash immediately at webview start
  useEffect(() => {
    if (Capacitor.isNativePlatform()) SplashScreen.hide();
  }, []);

  // Restore session on mount + listen for auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthInit('ready');
      if (session) {
        setUserId(session.user.id);
        loadSavedPhones();
        loadUserData(session.user.id);
      }
    }).catch(() => {
      setAuthInit('ready');
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setUserId(session.user.id);
        loadUserData(session.user.id);
        loadSavedPhones();
      } else if (event === 'SIGNED_OUT') {
        setUserId('');
        setProfile({ name: '', avatar: '', phone: '', username: '', bio: '' });
        setChats([]);
        setMoments([]);
        setActiveTab('auth');
      } else if (event === 'INITIAL_SESSION' && session) {
        setUserId(session.user.id);
        loadUserData(session.user.id);
        loadSavedPhones();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadUserData(userId: string) {
    await Promise.all([
      api.getProfile().then(p => {
        setProfile(p);
        if (p.chatStyle) {
          try {
            const parsed = JSON.parse(p.chatStyle) as ChatStyle;
            setChatStyle(parsed);
            localStorage.setItem('chat_bubble_color', parsed.bubbleColor);
            localStorage.setItem('chat_bubble_background', parsed.bubbleBackground);
            localStorage.setItem('chat_bubble_partner_color', parsed.partnerBubbleColor);
          } catch {}
        } else if (p.bubbleColor || p.partnerBubbleColor) {
          setChatStyle(prev => ({
            ...prev,
            bubbleColor: p.bubbleColor || prev.bubbleColor,
            partnerBubbleColor: p.partnerBubbleColor || prev.partnerBubbleColor,
          }));
          if (p.bubbleColor) localStorage.setItem('chat_bubble_color', p.bubbleColor);
          if (p.partnerBubbleColor) localStorage.setItem('chat_bubble_partner_color', p.partnerBubbleColor);
        }
        setActiveTab(prev => prev === 'auth' ? 'chats' : prev);
      }).catch(() => {
        setActiveTab(prev => prev === 'auth' ? 'chats' : prev);
      }),
      api.getChats().then(serverChats => {
        const savedRaw = localStorage.getItem('saved_chats');
        let savedChats: Chat[] = [];
        if (savedRaw) try { savedChats = JSON.parse(savedRaw) as Chat[]; } catch {}
        const serverIds = new Set(serverChats.map(c => c.id));
        const merged = serverChats.map(sc => {
          const saved = savedChats.find(c => c.id === sc.id);
          if (saved && saved.messages && saved.messages.length > 0) {
            return { ...sc, messages: saved.messages.filter(m => !deletedMsgIdsRef.current.has(m.id)) };
          }
          return sc;
        });
        for (const sc of savedChats) {
          if (!serverIds.has(sc.id)) {
            merged.push(sc);
          }
        }
        saveChats(merged);
        setChats(merged);
        api.markAllDelivered().catch(() => {});
      }).catch(() => showToast('Error de conexión al cargar chats')),
      api.getMoments().then(setMoments).catch(() => showToast('Error de conexión al cargar momentos')),
      api.getBlockedUserIds().then(ids => setBlockedProfileIds(new Set(ids))).catch(() => {}),
      setupCapacitorPush(userId).catch(() => {}),
    ]);
  }

  // Realtime subscription via Supabase
  useEffect(() => {
    if (!userId) return;
    connectSocket(userId);

    setMessageHandler((data) => {
      const { chatId, sender, text, time, id, audioUrl, audioDuration, mimeType, replyToId, replyToText, replyToSender, contactId, pollId, imageUrl, videoUrl, stickerUrl, gifUrl, isAnimated } = data;
      // Filter out messages from blocked users
      if (contactId && blockedProfileIdsRef.current.has(contactId)) return;
      const prefs = loadNotifPrefs();
      const displayText = stickerUrl ? '🖼️ Sticker' : gifUrl ? '🎬 GIF' : imageUrl ? '📷 Imagen' : videoUrl ? '🎬 Video' : (prefs.preview ? text : 'Nuevo mensaje');
      setChats(prev => prev.map(c => {
        if (c.id !== chatId) return c;
        const replyFields = replyToId ? { replyToId, replyToText, replyToSender } : {};
        const pollFields = pollId ? { pollId } : {};
        const msg = {
          id, sender: sender as 'me' | 'them', text,
          time: time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'sent' as const,
          ...(audioUrl ? { audioUrl, audioDuration: audioDuration || 0, mimeType: mimeType || 'audio/webm' } : {}),
          ...(imageUrl ? { imageUrl } : {}),
          ...(videoUrl ? { videoUrl } : {}),
          ...(stickerUrl ? { stickerUrl, isAnimated: isAnimated || false } : {}),
          ...(gifUrl ? { gifUrl } : {}),
          ...replyFields,
          ...pollFields,
        };
        if (c.messages.some(m => m.id === msg.id)) return c;

        // Play notification sound if not on this chat
        if (activeChatIdRef.current !== chatId) {
          if (prefs.sound) playSound('notificacion.mp3');
          if (prefs.vibration) navigator.vibrate?.(200);
        }

        return {
          ...c,
          lastMessage: displayText,
          time: msg.time,
          unreadCount: c.unreadCount + (activeChatIdRef.current === chatId ? 0 : 1),
          messages: [...c.messages, msg]
        };
      }));
      // Auto-reply: send configured message when someone writes to us
      if (sender === 'them' && autoReplyConfigRef.current.enabled && autoReplyConfigRef.current.message.trim()) {
        if (!autoRepliedChatsRef.current.has(chatId)) {
          autoRepliedChatsRef.current.add(chatId);
          const delay = (autoReplyConfigRef.current.delay || 0) * 1000;
          setTimeout(() => {
            const replyText = autoReplyConfigRef.current.message;
            api.sendMessage(chatId, replyText, undefined).then((msg: any) => {
              if (msg?.message?.id) {
                setChats(prev => prev.map(c => {
                  if (c.id !== chatId) return c;
                  const replyMsg: Message = {
                    id: msg.message.id, sender: 'me', text: replyText,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),                     status: 'sent' as const,
                  };
                  return { ...c, messages: [...c.messages, replyMsg], lastMessage: replyText };
                }));
              }
            }).catch(() => {});
          }, delay);
        }
      }
    });

    setStatusUpdateHandler((data) => {
      const { messageId, status, chatId } = data;
      setChats(prev => prev.map(c => {
        if (c.id !== chatId) return c;
        const msgs = c.messages.map(m =>
          m.id === messageId ? { ...m, status: status as 'delivered' | 'read' } : m
        );
        const lastMsg = msgs[msgs.length - 1];
        const lastMsgSender = lastMsg?.sender;
        return {
          ...c,
          messages: msgs,
          lastMessageStatus: lastMsg && lastMsg.id === messageId
            ? (status as 'delivered' | 'read')
            : c.lastMessageStatus,
        };
      }));
    });

    setNewChatHandler(async (data) => {
      const { message, chatId } = data;
      if (message.contactId && blockedProfileIdsRef.current.has(message.contactId)) return;

      // Verify current user is a participant in this chat before creating it
      const { data: participant } = await supabase
        .from('chat_participants')
        .select('id')
        .eq('chat_id', chatId)
        .eq('profile_id', userId)
        .maybeSingle();
      if (!participant) return;

      // Look up sender profile for phone and avatar (unknown contact display)
      let senderPhone = '';
      let senderAvatar = '';
      if (message.contactId) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('phone_number, avatar_url')
            .eq('id', message.contactId)
            .single();
          if (profile) {
            senderPhone = profile.phone_number || '';
            senderAvatar = profile.avatar_url || '';
          }
        } catch {}
      }

      const prefs = loadNotifPrefs();
      const displayText = message.stickerUrl ? '🖼️ Sticker' : message.gifUrl ? '🎬 GIF' : message.imageUrl ? '📷 Imagen' : message.videoUrl ? '🎬 Video' : (prefs.preview ? message.text : 'Nuevo mensaje');
      setChats(prev => {
        if (prev.some(c => c.id === chatId)) return prev;
        const newChat: Chat = {
          id: chatId,
          name: senderPhone || 'Nuevo mensaje',
          avatar: senderAvatar,
          avatarColor: senderAvatar ? '' : 'bg-[#3390ec]',
          lastMessage: displayText,
          time: message.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          unreadCount: 1,
          isOnline: false,
          phone: senderPhone,
          username: '',
          bio: '',
          messages: [{
            id: message.id,
            sender: 'them',
            text: message.text,
            time: message.time,
            status: 'sent',
            ...(message.audioUrl ? { audioUrl: message.audioUrl, audioDuration: message.audioDuration || 0, mimeType: message.mimeType || 'audio/webm' } : {}),
            ...(message.imageUrl ? { imageUrl: message.imageUrl } : {}),
            ...(message.videoUrl ? { videoUrl: message.videoUrl } : {}),
            ...(message.stickerUrl ? { stickerUrl: message.stickerUrl, isAnimated: message.isAnimated || false } : {}),
            ...(message.gifUrl ? { gifUrl: message.gifUrl } : {}),
          }]
        };
        return [newChat, ...prev];
      });
    });

    // Realtime subscription for momentos
    const momentChannel = supabase
      .channel('moments-realtime')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'momentos' },
        (payload: any) => {
          const m = payload.new;
          if (m.user_id === userId) return;
          const newMoment: Moment = {
            id: m.id,
            name: m.name || '',
            avatar: m.avatar || '',
            avatarColor: m.avatar_color || undefined,
            time: 'Ahora',
            hasUnseen: true,
            image: m.image || '',
            caption: m.caption || '',
            profileId: m.user_id || '',
            viewCount: 0,
            reactions: [],
            animMeta: m.anim_meta || undefined,
          };
          setMoments(prev => [newMoment, ...prev]);
        }
      )
      .subscribe();

    // Listen for incoming calls via Supabase Postgres Changes on calls table
    // (more reliable than Realtime Broadcast — doesn't depend on httpSend server version)
    const callNotifyChannel = supabase
      .channel('calls-realtime')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'calls', filter: `callee_id=eq.${userId}` },
        async (payload: any) => {
          const row = payload.new;
          if (!row || row.caller_id === userId) return;
          const existingState = callStateRef.current;
          if (existingState?.isOpen) return;
          // Look up caller profile for name/avatar
          let contactName = 'Llamada entrante';
          let contactAvatar = '';
          try {
            const { data: callerProfile } = await supabase
              .from('profiles')
              .select('name, avatar_url')
              .eq('id', row.caller_id)
              .single();
            if (callerProfile) {
              if (callerProfile.name) contactName = callerProfile.name;
              if (callerProfile.avatar_url) contactAvatar = callerProfile.avatar_url;
            }
          } catch {}
          setCallState({
            isOpen: true,
            contactName,
            contactAvatar,
            chatId: row.chat_id,
            contactId: row.caller_id,
            direction: 'incoming' as const,
            callType: row.call_type || 'audio',
            callId: row.id,
          });
        }
      )
      .subscribe();
    callNotifyChanRef.current = callNotifyChannel;

    // Listen for incoming calls from push notifications (FCM when app is background/killed)
    const handleIncomingCallFromPush = async (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const d = typeof detail === 'string' ? JSON.parse(detail) : detail;
      const chatId = d?.chatId || d?.roomId || '';
      if (chatId && d?.callerId) {
        // Don't insert a duplicate call — the caller already did via handleStartCall
        setCallState({
          isOpen: true,
          contactName: d.callerName || 'Llamada entrante',
          contactAvatar: d.callerAvatar || '',
          chatId: chatId,
          contactId: d.callerId,
          direction: 'incoming',
          callType: d.callType || 'audio',
          callId: d.callId || null,
        });
      }
    };
    window.addEventListener('incoming-call', handleIncomingCallFromPush);

    // Handle notification tap → open the chat
    const handleOpenChat = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.chatId && detail?.contactId) {
        setActiveChatId(detail.chatId);
        setActiveTab('chats');
      }
    };
    window.addEventListener('open-chat', handleOpenChat);

    return () => {
      window.removeEventListener('incoming-call', handleIncomingCallFromPush);
      window.removeEventListener('open-chat', handleOpenChat);
      disconnectSocket();
      supabase.removeChannel(momentChannel);
      supabase.removeChannel(callNotifyChannel);
    };
  }, [userId]);

  // ─── PROFILE REAL-TIME UPDATE ───
  useEffect(() => {
    if (!userId) return;
    const profileChan = supabase
      .channel('profiles-realtime')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload: any) => {
          const profileId = payload.new.id;
          const newAvatar = payload.new.avatar_url || payload.new.avatar;
          const newName = payload.new.name || payload.new.username;
          if (!newAvatar && !newName) return;
          setChats(prev => prev.map(c => {
            const contactProfileId = c.profileId;
            if (!contactProfileId || contactProfileId !== profileId) return c;
            return {
              ...c,
              avatar: newAvatar || c.avatar,
              name: newName || c.name,
            };
          }));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(profileChan); };
  }, [userId]);

  // ─── URL PARAMS HANDLER (from notification tap) ───
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    if (action === 'accept-call') {
      const chatId = params.get('chatId');
      const callerId = params.get('callerId');
      const callType = params.get('callType') || 'audio';
      if (chatId && callerId && userId) {
        window.dispatchEvent(new CustomEvent('incoming-call', {
          detail: { chatId, callerId, callerName: 'Llamada entrante', callType },
        }));
        setActiveTab('chats');
        window.history.replaceState({}, '', '/');
      }
      return;
    }
    const chatId = params.get('chatId');
    const contactId = params.get('contactId');
    if (chatId && contactId && userId) {
      setActiveChatId(chatId);
      setActiveTab('chats');
      window.history.replaceState({}, '', '/');
    }
  }, [userId]);

  const handleStartCall = useCallback(async (chatId: string, contactId: string, contactName: string, contactAvatar: string, callType: 'audio' | 'video') => {
    if (!userId) return;
    let calleeId = contactId;
    // Fallback: look up the other participant from chat_participants if profileId not set
    if (!calleeId) {
      try {
        const { data: participants } = await supabase
          .from('chat_participants')
          .select('profile_id')
          .eq('chat_id', chatId)
          .neq('profile_id', userId)
          .limit(1);
        if (participants && participants.length > 0) {
          calleeId = participants[0].profile_id;
        }
      } catch {}
    }
    if (!calleeId) { showToast('No se puede iniciar llamada: contacto no disponible', 'error'); return; }
    // Insert call record — this triggers Postgres Changes subscription on callee's side
    const callId = await api.insertCall(chatId, userId, calleeId, callType, 'ringing');
    if (!callId) { showToast('Error al iniciar llamada', 'error'); return; }
    // Send FCM push as backup (in case app is killed / Postgres change is delayed)
    sendFcmPush(
      calleeId,
      profile.name || 'RED ON',
      'Llamada entrante...',
      { type: 'call', chatId, callerId: userId, callerName: profile.name || contactName, callType, callId },
    );
    // Open own call UI
    setCallState({ isOpen: true, contactName, contactAvatar, chatId, contactId: calleeId, direction: 'outgoing', callType, callId });
  }, [userId, profile]);

  const handleEndCall = useCallback(() => {
    if (callSignalChanRef.current) {
      supabase.removeChannel(callSignalChanRef.current);
      callSignalChanRef.current = null;
    }
    setCallState(null);
  }, []);

  const saveChats = (allChats: Chat[]) => {
    try {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => localStorage.setItem('saved_chats', JSON.stringify(allChats)), { timeout: 2000 });
      } else {
        setTimeout(() => localStorage.setItem('saved_chats', JSON.stringify(allChats)), 0);
      }
    } catch {}
  };

  const activeChat = chats.find(c => c.id === activeChatId);
  const totalUnread = chats.reduce((acc, c) => acc + c.unreadCount, 0);
  const notifPrefs = loadNotifPrefs();
  const unseenMomentsCount = moments.filter(m => m.hasUnseen).length;

  const handleSendMessage = useCallback(async (chatId: string, text: string, replyTo?: { replyToId: string; replyToText: string; replyToSender: string }, isEphemeral?: boolean, pollId?: string, stickerOptions?: { stickerUrl: string; isAnimated?: boolean } | { gifUrl: string }, mediaOptions?: { imageUrl?: string; videoUrl?: string }) => {
    const msgId = String(Date.now());
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isOffline = !isOnline();
    const newMessage: Message = { id: msgId, sender: 'me' as const, text, time, status: isOffline ? 'sending' : 'sent', isEphemeral, pollId, ...(stickerOptions && 'stickerUrl' in stickerOptions ? { stickerUrl: stickerOptions.stickerUrl, isAnimated: stickerOptions.isAnimated } : {}), ...(stickerOptions && 'gifUrl' in stickerOptions ? { gifUrl: stickerOptions.gifUrl } : {}), ...(mediaOptions?.imageUrl ? { imageUrl: mediaOptions.imageUrl } : {}), ...(mediaOptions?.videoUrl ? { videoUrl: mediaOptions.videoUrl } : {}) };
    if (replyTo) {
      newMessage.replyToId = replyTo.replyToId;
      newMessage.replyToText = replyTo.replyToText;
      newMessage.replyToSender = replyTo.replyToSender;
    }

    setChats(prev => {
      const updated = prev.map(c => {
        if (c.id !== chatId) return c;
        return { ...c, lastMessage: text || (stickerOptions && 'stickerUrl' in stickerOptions ? '🖼️ Sticker' : stickerOptions && 'gifUrl' in stickerOptions ? '🎬 GIF' : mediaOptions?.imageUrl ? '📷 Imagen' : mediaOptions?.videoUrl ? '🎬 Video' : ''), time, lastMessageStatus: (isOffline ? 'sending' : 'sent') as 'sending' | 'sent', messages: [...c.messages, newMessage] };
      });
      saveChats(updated);
      return updated;
    });

    if (isOffline) {
      addToQueue({ id: msgId, chatId, text, replyTo, isEphemeral, pollId, stickerOptions, mediaOptions });
      return;
    }

    try {
      const result = await api.sendMessage(chatId, text, undefined, replyTo, isEphemeral, pollId, stickerOptions, mediaOptions);
        if (result?.message?.id) {
          setChats(prev => {
            const updated = prev.map(c => {
              if (c.id !== chatId) return c;
              return { ...c, messages: c.messages.map(m => m.id === msgId ? { ...m, id: (result.message as any).id, isEphemeral: (result.message as any).isEphemeral } : m) };
            });
          saveChats(updated);
          return updated;
        });
      }
    } catch (err) {
      console.error('[sendMessage] Error al enviar mensaje:', err);
      if (err instanceof Error && (err.message.includes('violates row-level security') || err.message.includes('column') || err.message.includes('does not exist'))) {
        showToast('Error de configuración: notifica al administrador', 'error');
      } else {
        addToQueue({ id: msgId, chatId, text, replyTo, isEphemeral, pollId, stickerOptions, mediaOptions });
        showToast('Mensaje encolado. Se reenviará al recuperar conexión.');
      }
    }
  }, []);

  const handleSendAudioMessage = useCallback(async (chatId: string, audioBlob: Blob, duration: number) => {
    const msgId = String(Date.now());
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const text = '🎤 Nota de voz';
    const mimeType = audioBlob.type || 'audio/webm';

    // Upload audio to Supabase Storage so the recipient can download it
    let audioUrl: string;
    try {
      const fileName = `voice-${userId}-${Date.now()}.webm`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('voice-notes')
        .upload(fileName, audioBlob, { contentType: mimeType, upsert: false });
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage.from('voice-notes').getPublicUrl(fileName);
      audioUrl = publicUrlData.publicUrl;
    } catch {
      // Fallback: use local blob URL (sender can still play it)
      audioUrl = URL.createObjectURL(audioBlob);
    }

    const newMessage: Message = {
      id: msgId, sender: 'me' as const, text, time, status: 'sent' as const,
      audioUrl, audioDuration: duration, mimeType,
    };

    setChats(prev => {
      const updated = prev.map(c => {
        if (c.id !== chatId) return c;
        return { ...c, lastMessage: text, time, lastMessageStatus: 'sent' as const, messages: [...c.messages, newMessage] };
      });
      saveChats(updated);
      return updated;
    });

    try {
      const result = await api.sendMessage(chatId, text, { audioUrl, audioDuration: duration, mimeType });
      if (result?.message?.id) {
        setChats(prev => {
          const updated = prev.map(c => {
            if (c.id !== chatId) return c;
            return { ...c, messages: c.messages.map(m => m.id === msgId ? { ...m, id: result.message.id } : m) };
          });
          saveChats(updated);
          return updated;
        });
      }
    } catch (err) {
      console.error('[sendAudioMessage] Error:', err);
      if (err instanceof Error && (err.message.includes('violates row-level security') || err.message.includes('column') || err.message.includes('does not exist'))) {
        showToast('Error de configuración: notifica al administrador', 'error');
      } else {
        addToQueue({ id: msgId, chatId, text, audioOptions: audioUrl ? { audioUrl, audioDuration: duration, mimeType } : undefined });
        showToast('Nota de voz encolada. Se reenviará al recuperar conexión.');
      }
    }
  }, [userId]);

  // ─── RETRY PENDING MESSAGES (OFFLINE QUEUE) ───
  const retryPendingMessages = useCallback(async () => {
    const queue = getQueue();
    if (queue.length === 0) return;
    for (const msg of queue) {
      try {
        const result = await api.sendMessage(msg.chatId, msg.text, msg.audioOptions, msg.replyTo, msg.isEphemeral, msg.pollId, msg.stickerOptions, msg.mediaOptions);
        if (result?.message?.id) {
          setChats(prev => {
            const updated = prev.map(c => {
              if (c.id !== msg.chatId) return c;
              return { ...c, messages: c.messages.map(m => m.id === msg.id ? { ...m, id: (result.message as any).id, status: 'sent' as const } : m) };
            });
            saveChats(updated);
            return updated;
          });
          removeFromQueue(msg.id);
        }
      } catch (err) {
        console.error('[retryPendingMessages] Error al reenviar mensaje:', err);
      }
    }
  }, []);

  // Track online/offline status + retry queue on reconnect
  useEffect(() => {
    if (!userId) return;
    retryPendingMessages();
    const handleOnline = () => {
      setIsOffline(false);
      retryPendingMessages();
    };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [userId, retryPendingMessages]);

  // App lock: show lock screen when app resumes (visibility change / focus)
  useEffect(() => {
    if (!userId || !isPinEnabled()) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isPinEnabled()) {
        setShowLockScreen(true);
      }
    };
    const handleFocus = () => {
      if (isPinEnabled()) setShowLockScreen(true);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [userId]);

  // Cleanup expired ephemeral messages on mount
  useEffect(() => {
    if (!userId) return;
    const now = new Date().toISOString();
    supabase
      .from('messages')
      .update({ is_deleted: true, text: '' })
      .eq('is_ephemeral', true)
      .lt('ephemeral_expires_at', now)
      .then(({ error }) => {
        if (error) console.warn('[EPHEMERAL] cleanup error:', error.message);
      });
    setChats(prev => {
      const updated = prev.map(c => ({
        ...c,
        messages: c.messages.map(m =>
          m.isEphemeral && m.ephemeralExpiresAt && new Date(m.ephemeralExpiresAt) < new Date()
            ? { ...m, isDeleted: true, text: '', hasBeenViewed: true }
            : m
        ),
      }));
      saveChats(updated);
      return updated;
    });
  }, [userId]);

  // Android hardware back button — navigate within app instead of exiting
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handler = CapacitorApp.addListener('backButton', () => {
      if (activeChatId) {
        setActiveChatId(null);
      } else {
        const tabOrder: ActiveTab[] = ['chats', 'moments', 'interests', 'emprendedor', 'profile'];
        const idx = tabOrder.indexOf(activeTab as any);
        if (idx > 0) {
          setActiveTab(tabOrder[idx - 1]);
        } else {
          CapacitorApp.exitApp();
        }
      }
    });
    return () => { handler.then(h => h.remove()); };
  }, [activeChatId, activeTab]);

  // Load messages when opening a chat
  const handleSelectChat = useCallback(async (chatId: string) => {
    setActiveChatId(chatId);
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, unreadCount: 0 } : c));
    try {
      const freshMessages = await api.getMessages(chatId);
      setChats(prev => {
        const updated = prev.map(c => {
          if (c.id !== chatId) return c;
          const matchedServerIds = new Set<string>();
          const merged = c.messages.map(local => {
            let match = freshMessages.find((fm: any) => fm.id === local.id);
            if (!match) {
              match = freshMessages.find((fm: any) => fm.text === local.text && fm.sender === local.sender && !matchedServerIds.has(fm.id));
            }
            if (match) {
              matchedServerIds.add(match.id);
              return { ...match, id: match.id, isDeleted: local.isDeleted, isEdited: local.isEdited, status: local.status };
            }
            return local;
          });
          for (const fm of freshMessages) {
            if (!matchedServerIds.has(fm.id) && !deletedMsgIdsRef.current.has(fm.id)) {
              merged.push(fm);
            }
          }
          return { ...c, messages: merged };
        });
        saveChats(updated);
        return updated;
      });
      api.markDelivered(chatId).catch(() => {});
      api.markRead(chatId).catch(() => {});
    } catch {
      showToast('Error al cargar mensajes');
    }
  }, []);

  const handleEditMessage = useCallback(async (messageId: string, newText: string) => {
    if (!activeChatId) return;
    setChats(prev => {
      const updated = prev.map(c => {
        if (c.id !== activeChatId) return c;
        return { ...c, messages: c.messages.map(m => m.id === messageId ? { ...m, text: newText, isEdited: true } : m) };
      });
      saveChats(updated);
      return updated;
    });
    try {
      await api.editMessage(messageId, newText);
    } catch {
      showToast('Error al editar mensaje');
    }
  }, [activeChatId]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (!activeChatId) return;
    deletedMsgIdsRef.current.add(messageId);
    try { localStorage.setItem('deleted_msg_ids', JSON.stringify([...deletedMsgIdsRef.current])); } catch {}
    setChats(prev => {
      const updated = prev.map(c => {
        if (c.id !== activeChatId) return c;
        return { ...c, messages: c.messages.filter(m => m.id !== messageId) };
      });
      saveChats(updated);
      return updated;
    });
    try {
      await api.deleteMessage(messageId);
    } catch {
      showToast('Error al eliminar mensaje');
    }
  }, [activeChatId]);

  const handleUpdateProfile = async (updated: UserProfile) => {
    setProfile(updated);
    if (updated.fontPreference) {
      setFontPreference(updated.fontPreference);
      localStorage.setItem('redon_font_preference', updated.fontPreference);
    }
    localStorage.setItem('redon_profile', JSON.stringify(updated));
    try {
      await api.updateProfile(updated);
    } catch {
      showToast('Error al actualizar perfil');
    }
  };

  const handleAddChat = (newChat: Chat) => {
    setChats(prev => [newChat, ...prev]);
  };

  const handleAddMoment = (newMoment: Moment) => {
    setMoments(prev => {
      if (prev.some(m => m.id === newMoment.id)) return prev;
      return [newMoment, ...prev];
    });
  };

  const handleDeleteMoment = (momentId: string) => {
    setMoments(prev => prev.filter(m => m.id !== momentId));
  };

  const handleStartBusinessChat = (biz: BusinessListing) => {
    const newChat: Chat = {
      id: String(Date.now()),
      name: biz.businessName,
      avatar: biz.imageUrls?.[0] || '',
      avatarColor: '',
      lastMessage: 'Sin mensajes aún',
      time: 'Ahora',
      unreadCount: 0,
      isOnline: false,
      phone: biz.contactPhone || '',
      username: '',
      bio: biz.description,
      messages: []
    };
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setActiveTab('chats');
  };

  const handleOpenBusinessChat = useCallback(async (chatId: string, name: string, avatar: string, phone: string, bio: string) => {
    const existing = chats.find(c => c.id === chatId);
    if (!existing) {
      const chat: Chat = {
        id: chatId,
        name,
        avatar,
        avatarColor: '',
        lastMessage: '',
        time: '',
        unreadCount: 0,
        isOnline: false,
        phone,
        username: '',
        bio,
        messages: [],
      };
      setChats(prev => [chat, ...prev]);
    }
    setActiveChatId(chatId);
    setActiveTab('chats');
  }, [chats]);

  const handleLoginSuccess = async (name: string, phone: string, username: string) => {
    setActiveTab('chats');
  };

  // Called from AuthView after Supabase Auth login
  const handleAuthSuccess = (_token: string, user: any) => {
    setUserId(user.id);
    setProfile({ name: user.name, avatar: user.avatar || '', phone: user.phone, username: user.username, bio: user.bio || '' });
    api.getChats().then(setChats).catch(() => showToast('Error al cargar tus chats'));
    setActiveTab('chats');
  };

  const handleResetAppFlow = async () => {
    await supabase.auth.signOut();
    setUserId('');
    setProfile({ name: '', avatar: '', phone: '', username: '', bio: '' });
    setChats([]);
    setActiveChatId(null);
    disconnectSocket();
  };

  const isInApp = !!userId;

  return (
    <div className={`h-screen w-screen bg-bg-warm dark:bg-dark-bg text-text-primary dark:text-dark-text-primary font-sans flex flex-col overflow-hidden transition-colors duration-300 max-w-md mx-auto shadow-xl relative font-${fontPreference}`}>
      <Toast />

      {authInit === 'pending' ? null : !userId ? (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center bg-bg-warm dark:bg-dark-bg"><div className="w-8 h-8 border-3 border-[#3390ec] border-t-transparent rounded-full animate-spin" /></div>}>
          <AuthView onLoginSuccess={handleAuthSuccess} />
        </Suspense>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {isOffline && (
            <div className="bg-amber-500/90 backdrop-blur-md text-white text-[11px] font-semibold text-center py-1.5 px-4 flex items-center justify-center gap-2 z-50">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              Sin conexión — Los mensajes se enviarán cuando recuperes internet
            </div>
          )}
          <div className="flex-1 overflow-hidden relative bg-bg-warm dark:bg-dark-bg" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-3 border-[#3390ec] border-t-transparent rounded-full animate-spin" /></div>}>
              <div className={`absolute inset-0 ${activeTab === 'chats' ? '' : 'hidden'}`}>
                <ErrorBoundary name="ChatDetail">
                {activeChatId && activeChat ? (
                  <ChatDetail
                    chat={activeChat}
                    userId={userId}
                    chatList={chats}
                    onBack={() => setActiveChatId(null)}
                    onSendMessage={handleSendMessage}
                    onSendAudioMessage={handleSendAudioMessage}
                    onEditMessage={handleEditMessage}
                    onDeleteMessage={handleDeleteMessage}
                    chatStyle={chatStyle}
                    onUpdateChatStyle={handleUpdateChatStyle}
                    onStartCall={handleStartCall}
                    isContactSaved={savedPhones.has(activeChat.phone?.replace(/\D/g, ''))}
                    savingPhone={savingPhone}
                    onSaveContact={handleSaveContact}
                    onRejectContact={handleRejectContact}
                    onDeleteChat={handleDeleteChat}
                    onChatUpdated={handleChatUpdated}
                  />
                ) : (
                <ChatList
                    chats={chats}
                    onSelectChat={(id) => handleSelectChat(id)}
                    onAddChat={(newChat) => {
              setChats(prev => {
                const exists = prev.findIndex(c => c.id === newChat.id);
                let updated: Chat[];
                if (exists >= 0) {
                  updated = [...prev];
                  updated[exists] = { ...updated[exists], ...newChat, messages: updated[exists].messages };
                } else {
                  updated = [newChat, ...prev];
                }
                saveChats(updated);
                return updated;
              });
              if (newChat.id) {
                api.getMessages(newChat.id).then(serverMsgs => {
                  setChats(prev => {
                    const updated = prev.map(c => {
                      if (c.id !== newChat.id) return c;
                      const matchedIds = new Set<string>();
                      const merged = c.messages.map(local => {
                        let match = serverMsgs.find((fm: any) => fm.id === local.id);
                        if (!match) match = serverMsgs.find((fm: any) => fm.text === local.text && fm.sender === local.sender && !matchedIds.has(fm.id));
                        if (match) { matchedIds.add(match.id); return { ...match, id: match.id, isDeleted: local.isDeleted, isEdited: local.isEdited, status: local.status }; }
                        return local;
                      });
                      for (const fm of serverMsgs) { if (!matchedIds.has(fm.id) && !deletedMsgIdsRef.current.has(fm.id)) merged.push(fm); }
                      return { ...c, messages: merged };
                    });
                    saveChats(updated);
                    return updated;
                  });
                }).catch(() => showToast('Error al cargar mensajes'));
              }
            }}
                    onDeleteChat={(id) => {
                      setChats(prev => prev.filter(c => c.id !== id));
                      api.deleteChat(id).catch(() => showToast('Error al eliminar conversación'));
                    }}
                    onDeleteContact={handleDeleteContact}
                    onContactSaved={(phone) => {
                      setSavedPhones(prev => new Set(prev).add(phone));
                    }}
                    chatStyle={chatStyle}
                    blockedChatIds={
                      new Set(chats.filter(c => blockedProfileIds.has(c.profileId)).map(c => c.id))
                    }
                    onToggleBlock={(chatId) => {
                      const chat = chats.find(c => c.id === chatId);
                      if (!chat) return;
                      const pid = chat.profileId;
                      if (blockedProfileIds.has(pid)) {
                        api.unblockUser(pid).then(() => {
                          setBlockedProfileIds(prev => { const n = new Set(prev); n.delete(pid); return n; });
                        }).catch(() => showToast('Error al desbloquear'));
                      } else {
                        api.blockUser(pid).then(() => {
                          setBlockedProfileIds(prev => new Set(prev).add(pid));
                        }).catch(() => showToast('Error al bloquear'));
                      }
                    }}
                  />
                )}
                </ErrorBoundary>
              </div>
              <div className={`absolute inset-0 ${activeTab === 'moments' ? '' : 'hidden'}`}>
                <ErrorBoundary name="MomentsView">
                  <MomentsView profile={profile} moments={moments} onAddMoment={handleAddMoment} onDeleteMoment={handleDeleteMoment} userId={userId} />
                </ErrorBoundary>
              </div>
              <div className={`absolute inset-0 ${activeTab === 'interests' ? '' : 'hidden'}`}>
                <ErrorBoundary name="Indicadores">
                  <InterestsView />
                </ErrorBoundary>
              </div>
              <div className={`absolute inset-0 ${activeTab === 'emprendedor' ? '' : 'hidden'}`}>
                <ErrorBoundary name="Emprendedor">
                  <EmprendedorView onStartBusinessChat={handleStartBusinessChat} onOpenChat={handleOpenBusinessChat} />
                </ErrorBoundary>
              </div>
              <div className={`absolute inset-0 ${activeTab === 'profile' ? '' : 'hidden'}`}>
                <ErrorBoundary name="Perfil">
                  <ProfileView
                    profile={profile}
                    onUpdateProfile={handleUpdateProfile}
                    isDarkMode={isDarkMode}
                    onToggleDarkMode={toggleTheme}
                    chats={chats}
                    userId={userId}
                  />
                </ErrorBoundary>
              </div>
            </Suspense>
          </div>
          {!activeChatId && (
            <nav className="h-16 bg-surface dark:bg-dark-surface border-t border-border/80 dark:border-dark-border/60 w-full flex justify-between items-center px-1 z-20 select-none pb-1 flex-shrink-0 backdrop-blur-sm transition-colors duration-300">
              {[{
                key: 'chats',
                label: 'Chats',
                icon: MessageSquare,
                badge: notifPrefs.badge && totalUnread > 0 ? totalUnread : null,
              }, {
                key: 'moments',
                label: 'Momentos',
                icon: Sparkles,
                dot: unseenMomentsCount > 0,
              }, {
                key: 'interests',
                label: 'Indicadores',
                icon: DollarSign,
              }, {
                key: 'emprendedor',
                label: 'Modo Emprendedor',
                icon: TrendingUp,
              }, {
                key: 'profile',
                label: 'Perfil',
                icon: User,
              }].map(({ key, label, icon: Icon, badge, dot }) => (
                <button key={key} onClick={() => setActiveTab(key as ActiveTab)}
                className={`group flex-1 min-w-0 flex flex-col items-center justify-center py-1.5 relative transition-all duration-200 cursor-pointer select-none
                  ${activeTab === key ? 'text-brand font-semibold' : 'text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100'}`}>
                <div className="relative">
                  <Icon className={`w-6 h-6 stroke-current transition-transform duration-200 ${activeTab === key ? 'scale-110 text-brand' : 'group-hover:scale-105'}`} />
                  {badge != null && (
                    <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[8px] font-bold min-w-[16px] h-[16px] rounded-full flex items-center justify-center border-[2.5px] border-surface dark:border-dark-surface shadow-sm">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                  {dot && (
                    <span className="absolute -top-1 -right-1.5 w-2 h-2 bg-brand rounded-full border-[2px] border-surface dark:border-dark-surface shadow-sm" />
                  )}
                </div>
                <span className={`text-[10px] mt-1.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-full transition-colors duration-200 ${activeTab === key ? 'font-bold text-brand' : 'font-medium text-gray-700 dark:text-gray-300'}`}>{label}</span>
                {activeTab === key && (
                  <span className="absolute bottom-0 w-5 h-[3px] bg-brand rounded-full shadow-[0_0_6px_rgba(0,0,0,0.15)]" />
                )}
              </button>
              ))}
            </nav>
          )}
        </div>
      )}

      {/* Call UI */}
      <ErrorBoundary name="Llamada">
        {callState && (
          <CallSuite
            isOpen={callState.isOpen}
            contactName={callState.contactName}
            contactAvatar={callState.contactAvatar}
            isGroup={false}
            onClose={handleEndCall}
            userId={userId}
            contactId={callState.contactId}
            chatId={callState.chatId}
            direction={callState.direction}
            callType={callState.callType}
            callId={callState.callId}
            onAcceptCall={() => {}}
            onRejectCall={() => setCallState(null)}
          />
        )}
      </ErrorBoundary>

      {/* App Lock Screen */}
      {showLockScreen && (
        <LockScreen
          onUnlock={() => setShowLockScreen(false)}
        />
      )}
    </div>
  );
}
