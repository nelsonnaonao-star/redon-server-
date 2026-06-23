import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Chat, Message, UserProfile, ActiveTab, Moment, ChatStyle, BusinessListing } from './types';
import { supabase } from './lib/supabase';
import { api } from './services/api';
import { connectSocket, disconnectSocket, setMessageHandler, setNewChatHandler, setStatusUpdateHandler } from './services/socket';
import { playSound } from './services/soundPlayer';
import { setupCapacitorPush, sendFcmPush } from './services/pushCapacitor';

import WelcomeView from './components/WelcomeView';
import AuthView from './components/AuthView';
import ChatList from './components/ChatList';
import ChatDetail from './components/ChatDetail';
import MomentsView from './components/MomentsView';
import InterestsView from './components/InterestsView';
import EmprendedorView from './components/EmprendedorView';
import ProfileView from './components/ProfileView';

import { MessageSquare, User, Sparkles, DollarSign, TrendingUp, LogOut } from 'lucide-react';
import { CallSuite } from './components/CallSuite';
import Toast from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import Skeleton from './components/Skeleton';
import { motion, AnimatePresence } from 'motion/react';
import { showToast } from './services/toastService';

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
  const [activeTab, setActiveTab] = useState<ActiveTab>('welcome');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [callState, setCallState] = useState<{
    isOpen: boolean;
    contactName: string;
    contactAvatar: string;
    chatId: string;
    contactId: string;
    direction: 'outgoing' | 'incoming';
    callType: 'audio' | 'video';
  } | null>(null);

  const callChanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const [chatStyle, setChatStyle] = useState<ChatStyle>(() => {
    const savedColor = localStorage.getItem('chat_bubble_color');
    const savedBG = localStorage.getItem('chat_bubble_background');
    const savedPartner = localStorage.getItem('chat_bubble_partner_color');
    return {
      bubbleColor: savedColor || 'blue',
      bubbleBackground: savedBG || '',
      partnerBubbleColor: savedPartner || 'bg-slate-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100',
    };
  });

  const handleUpdateChatStyle = (newStyle: ChatStyle) => {
    setChatStyle(newStyle);
    localStorage.setItem('chat_bubble_color', newStyle.bubbleColor);
    localStorage.setItem('chat_bubble_background', newStyle.bubbleBackground);
    localStorage.setItem('chat_bubble_partner_color', newStyle.partnerBubbleColor);
  };

  const [isLoading, setIsLoading] = useState(true);

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

  // Restore session on mount + listen for auth changes
  useEffect(() => {
    setIsLoading(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUserId(session.user.id);
        loadUserData(session.user.id);
      }
      setIsLoading(false);
    }).catch(() => setIsLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setUserId(session.user.id);
        loadUserData(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setUserId('');
        setProfile({ name: '', avatar: '', phone: '', username: '', bio: '' });
        setChats([]);
        setMoments([]);
        setActiveTab('auth');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  function loadUserData(userId: string) {
    api.getProfile().then(p => {
      setProfile(p);
      setActiveTab('chats');
    }).catch(() => {
      supabase.auth.signOut();
      setActiveTab('auth');
    });
    api.getChats().then(serverChats => {
      const savedRaw = localStorage.getItem('saved_chats');
      let savedChats: Chat[] = [];
      if (savedRaw) try { savedChats = JSON.parse(savedRaw) as Chat[]; } catch {}
      const serverIds = new Set(serverChats.map(c => c.id));
      const merged = [...serverChats, ...savedChats.filter(c => !serverIds.has(c.id))];
      saveChats(merged);
      setChats(merged);
    }).catch(() => showToast('Error de conexión al cargar chats'));
    api.getMoments().then(setMoments).catch(() => showToast('Error de conexión al cargar momentos'));
    setupCapacitorPush(userId).catch(() => {});
  }

  // Realtime subscription via Supabase
  useEffect(() => {
    if (!userId) return;
    connectSocket(userId);

    setMessageHandler((data) => {
      const { chatId, sender, text, time, id, audioUrl, audioDuration, mimeType } = data;
      setChats(prev => prev.map(c => {
        if (c.id !== chatId) return c;
        const msg = {
          id, sender: sender as 'me' | 'them', text,
          time: time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          status: 'sent' as const,
          ...(audioUrl ? { audioUrl, audioDuration: audioDuration || 0, mimeType: mimeType || 'audio/webm' } : {}),
        };
        if (c.messages.some(m => m.id === msg.id)) return c;

        // Play notification sound if not on this chat
        if (activeChatId !== chatId) {
          playSound('notificacion.mp3');
        }

        return {
          ...c,
          lastMessage: text,
          time: msg.time,
          unreadCount: c.unreadCount + (activeChatId === chatId ? 0 : 1),
          messages: [...c.messages, msg]
        };
      }));
    });

    setStatusUpdateHandler((data) => {
      const { messageId, status, chatId } = data;
      setChats(prev => prev.map(c => {
        if (c.id !== chatId) return c;
        return {
          ...c,
          messages: c.messages.map(m =>
            m.id === messageId ? { ...m, status: status as 'delivered' | 'read' } : m
          )
        };
      }));
    });

    setNewChatHandler((data) => {
      const { message, chatId } = data;
      setChats(prev => {
        if (prev.some(c => c.id === chatId)) return prev;
        const newChat: Chat = {
          id: chatId,
          name: 'Nuevo mensaje',
          avatar: '',
          avatarColor: 'bg-[#3390ec]',
          lastMessage: message.text,
          time: message.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          unreadCount: 1,
          isOnline: false,
          phone: '',
          username: '',
          bio: '',
          messages: [{
            id: message.id,
            sender: 'them',
            text: message.text,
            time: message.time,
            status: 'sent',
            ...(message.audioUrl ? { audioUrl: message.audioUrl, audioDuration: message.audioDuration || 0, mimeType: message.mimeType || 'audio/webm' } : {}),
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

    // Setup call notification channel
    const callNotifyChannel = supabase.channel(`calls:${userId}`);
    callNotifyChannel.on('broadcast', { event: 'incoming-call' }, (payload: any) => {
      setCallState({
        isOpen: true,
        contactName: payload.payload.callerName,
        contactAvatar: payload.payload.callerAvatar || '',
        chatId: payload.payload.chatId,
        contactId: payload.payload.callerId,
        direction: 'incoming',
        callType: payload.payload.callType || 'audio',
      });
    });
    callNotifyChannel.subscribe();

    // Listen for incoming calls from push notifications
    const handleIncomingCallFromPush = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const d = typeof detail === 'string' ? JSON.parse(detail) : detail;
      const chatId = d?.chatId || d?.roomId || '';
      if (chatId && d?.callerId) {
        setCallState({
          isOpen: true,
          contactName: d.callerName || 'Llamada entrante',
          contactAvatar: d.callerAvatar || '',
          chatId: chatId,
          contactId: d.callerId,
          direction: 'incoming',
          callType: d.callType || 'audio',
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
  }, [userId, activeChatId]);

  const handleStartCall = useCallback(async (chatId: string, contactId: string, contactName: string, contactAvatar: string, callType: 'audio' | 'video') => {
    if (!userId) return;
    if (!contactId) { console.warn('handleStartCall: missing contactId'); return; }
    // Subscribe to channel first, then send broadcast
    const chan = supabase.channel(`calls:${contactId}`);
    callChanRef.current = chan;
    chan.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        chan.send({
          type: 'broadcast',
          event: 'incoming-call',
          payload: { chatId, callerId: userId, callerName: profile.name || contactName, callerAvatar: profile.avatar || contactAvatar, callType },
        }).then(() => {
          // Cleanup after sending — no longer needed
          supabase.removeChannel(chan);
          if (callChanRef.current === chan) callChanRef.current = null;
        });
      }
    });
    // Send FCM push to wake the callee if minimized
    sendFcmPush(
      contactId,
      profile.name || 'RED ON',
      'Llamada entrante...',
      { type: 'call', chatId, callerId: userId, callerName: profile.name || contactName, callerAvatar: profile.avatar || contactAvatar, callType },
    );
    // Open own call UI
    setCallState({ isOpen: true, contactName, contactAvatar, chatId, contactId, direction: 'outgoing', callType });
  }, [userId, profile]);

  const handleEndCall = useCallback(() => {
    if (callChanRef.current) {
      supabase.removeChannel(callChanRef.current);
      callChanRef.current = null;
    }
    setCallState(null);
  }, []);

  const saveChats = (allChats: Chat[]) => {
    try { localStorage.setItem('saved_chats', JSON.stringify(allChats)); } catch {}
  };

  const activeChat = chats.find(c => c.id === activeChatId);
  const totalUnread = chats.reduce((acc, c) => acc + c.unreadCount, 0);
  const unseenMomentsCount = moments.filter(m => m.hasUnseen).length;

  const handleSendMessage = useCallback(async (chatId: string, text: string) => {
    const msgId = String(Date.now());
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMessage = { id: msgId, sender: 'me' as const, text, time, status: 'sent' as const };

    setChats(prev => prev.map(c => {
      if (c.id !== chatId) return c;
      return { ...c, lastMessage: text, time, messages: [...c.messages, newMessage] };
    }));

    try {
      await api.sendMessage(chatId, text);
    } catch {
      showToast('Error al enviar mensaje. Reintenta.');
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

    setChats(prev => prev.map(c => {
      if (c.id !== chatId) return c;
      return { ...c, lastMessage: text, time, messages: [...c.messages, newMessage] };
    }));

    try {
      await api.sendMessage(chatId, text, { audioUrl, audioDuration: duration, mimeType });
    } catch {
      showToast('Error al enviar nota de voz');
    }
  }, [userId]);

  // Load messages when opening a chat
  const handleSelectChat = useCallback(async (chatId: string) => {
    setActiveChatId(chatId);
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, unreadCount: 0 } : c));
    try {
      const freshMessages = await api.getMessages(chatId);
      setChats(prev => prev.map(c => {
        if (c.id !== chatId) return c;
        const merged = freshMessages.map((fm: any) => {
          const existing = c.messages.find(m => m.id === fm.id);
          return existing ? { ...fm, status: existing.status } : fm;
        });
        return { ...c, messages: merged };
      }));
      api.markRead(chatId).catch(() => {});
    } catch {
      showToast('Error al cargar mensajes');
    }
  }, []);

  const handleEditMessage = useCallback(async (messageId: string, newText: string) => {
    if (!activeChatId) return;
    setChats(prev => prev.map(c => {
      if (c.id !== activeChatId) return c;
      return { ...c, messages: c.messages.map(m => m.id === messageId ? { ...m, text: newText, isEdited: true } : m) };
    }));
    try {
      await api.editMessage(messageId, newText);
    } catch {
      showToast('Error al editar mensaje');
    }
  }, [activeChatId]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (!activeChatId) return;
    setChats(prev => prev.map(c => {
      if (c.id !== activeChatId) return c;
      return { ...c, messages: c.messages.map(m => m.id === messageId ? { ...m, isDeleted: true } : m) };
    }));
    try {
      await api.deleteMessage(messageId);
    } catch {
      showToast('Error al eliminar mensaje');
    }
  }, [activeChatId]);

  const handleUpdateProfile = async (updated: UserProfile) => {
    setProfile(updated);
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

  const handleAddMoment = async (newMoment: Moment) => {
    setMoments(prev => [newMoment, ...prev]);
    try {
      await api.addMoment({
        name: newMoment.name,
        avatar: newMoment.avatar,
        avatarColor: newMoment.avatarColor,
        hasUnseen: false,
        image: newMoment.image,
        caption: newMoment.caption,
        animMeta: newMoment.animMeta,
      });
      const updated = await api.getMoments();
      setMoments(updated);
    } catch (err) {
      console.error('[Momento] Error al publicar:', err);
      showToast('Error al publicar momento');
    }
  };

  const handleStartBusinessChat = (biz: BusinessListing) => {
    const newChat: Chat = {
      id: String(Date.now()),
      name: biz.businessName,
      avatar: biz.imageUrl,
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
    setActiveTab('welcome');
  };

  const isInApp = activeTab !== 'welcome' && activeTab !== 'auth';

  return (
    <div className="h-screen w-screen bg-bg-warm dark:bg-dark-bg text-text-primary dark:text-dark-text-primary font-sans flex flex-col overflow-hidden transition-colors duration-300 max-w-md mx-auto shadow-xl relative">
      <Toast />

      {activeTab === 'welcome' && (
        <WelcomeView onStart={() => setActiveTab('auth')} />
      )}
      {activeTab === 'auth' && (
        <AuthView onLoginSuccess={handleAuthSuccess} />
      )}
      {isInApp && (
        <div className="flex-1 flex flex-col min-h-0">
          {!activeChatId && (
            <header className="glass border-b border-border/80 dark:border-dark-border/60 px-5 py-3.5 flex items-center justify-between flex-shrink-0 z-10 transition-all duration-300">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-brand animate-pulse shadow-[0_0_6px_rgba(43,126,251,0.5)]" />
                <AnimatePresence mode="wait">
                  <motion.span
                    key={activeTab}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className="font-display text-text-primary dark:text-dark-text-primary font-bold text-base tracking-tight select-none block"
                  >
                    {activeTab === 'chats' && 'Chats'}
                    {activeTab === 'moments' && 'Momentos'}
                    {activeTab === 'interests' && 'Indicadores'}
                    {activeTab === 'emprendedor' && 'Modo Emprendedor'}
                    {activeTab === 'profile' && 'Mi Perfil'}
                  </motion.span>
                </AnimatePresence>
              </div>
              <div className="flex items-center gap-2">
                {activeTab === 'chats' && (
                  <span className="bg-brand-light text-brand text-[10px] font-bold px-2.5 py-1 rounded-full select-none tracking-wide">
                    {chats.length} chats
                  </span>
                )}
                {activeTab === 'moments' && (
                  <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded-full select-none tracking-wide">
                    {unseenMomentsCount} nuevos
                  </span>
                )}
                {activeTab === 'emprendedor' && (
                  <span className="bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 text-[10px] font-bold px-2.5 py-1 rounded-full select-none flex items-center gap-1 tracking-wide">
                    <Sparkles className="w-2.5 h-2.5" /> PRO
                  </span>
                )}
                {activeTab === 'profile' && (
                  <button onClick={handleResetAppFlow}
                    className="text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-semibold flex items-center gap-1.5 py-1.5 px-3 hover:bg-rose-50/50 dark:hover:bg-rose-950/25 rounded-xl transition-all cursor-pointer active:scale-95"
                    title="Cerrar sesión"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Salir</span>
                  </button>
                )}
              </div>
            </header>
          )}
          <div className="flex-1 overflow-hidden relative bg-bg-warm dark:bg-dark-bg">
            <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.12 }}
              className="absolute inset-0"
            >
            {activeTab === 'chats' && (
              <ErrorBoundary name="ChatDetail">
              {activeChatId && activeChat ? (
                <ChatDetail
                  chat={activeChat}
                  onBack={() => setActiveChatId(null)}
                  onSendMessage={handleSendMessage}
                  onSendAudioMessage={handleSendAudioMessage}
                  onEditMessage={handleEditMessage}
                  onDeleteMessage={handleDeleteMessage}
                  chatStyle={chatStyle}
                  onStartCall={handleStartCall}
                />
              ) : (
                <ChatList
                  chats={chats}
                  isLoading={isLoading}
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
              api.getMessages(newChat.id).then(msgs => {
                setChats(prev => {
                  const updated = prev.map(c => c.id === newChat.id ? { ...c, messages: msgs as any } : c);
                  saveChats(updated);
                  return updated;
                });
              }).catch(() => showToast('Error al cargar mensajes'));
            }
          }}
                  onDeleteChat={(id) => setChats(prev => prev.filter(c => c.id !== id))}
                />
              )}
              </ErrorBoundary>
            )}
            {activeTab === 'moments' && (
              <ErrorBoundary name="Momentos">
                <MomentsView profile={profile} moments={moments} onAddMoment={handleAddMoment} userId={userId} isLoading={isLoading} />
              </ErrorBoundary>
            )}
            {activeTab === 'interests' && (
              <ErrorBoundary name="Indicadores">
                <InterestsView />
              </ErrorBoundary>
            )}
            {activeTab === 'emprendedor' && (
              <ErrorBoundary name="Emprendedor">
                <EmprendedorView onStartBusinessChat={handleStartBusinessChat} />
              </ErrorBoundary>
            )}
            {activeTab === 'profile' && (
              <ErrorBoundary name="Perfil">
                <ProfileView
                  profile={profile}
                  onUpdateProfile={handleUpdateProfile}
                  isDarkMode={isDarkMode}
                  onToggleDarkMode={toggleTheme}
                  chatStyle={chatStyle}
                  onUpdateChatStyle={handleUpdateChatStyle}
                />
              </ErrorBoundary>
            )}
            </motion.div>
            </AnimatePresence>
          </div>
          {!activeChatId && (
            <nav className="h-16 bg-surface dark:bg-dark-surface border-t border-border/80 dark:border-dark-border/60 w-full flex justify-between items-center px-1 z-20 select-none pb-1 flex-shrink-0 backdrop-blur-sm transition-colors duration-300">
              {[{
                key: 'chats',
                label: 'Chats',
                icon: MessageSquare,
                badge: totalUnread > 0 ? totalUnread : null,
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
                  ${activeTab === key ? 'text-gray-900 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}>
                <div className="relative">
                  <Icon className={`w-5 h-5 stroke-current transition-transform duration-200 ${activeTab === key ? 'scale-110' : 'group-hover:scale-105'}`} />
                  {badge != null && (
                    <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[8px] font-bold min-w-[16px] h-[16px] rounded-full flex items-center justify-center border-[2.5px] border-surface dark:border-dark-surface shadow-sm">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                  {dot && (
                    <span className="absolute -top-1 -right-1.5 w-2 h-2 bg-brand rounded-full border-[2px] border-surface dark:border-dark-surface shadow-sm" />
                  )}
                </div>
                <span className={`text-[10px] mt-1.5 whitespace-nowrap overflow-hidden text-ellipsis max-w-full transition-colors duration-200 ${activeTab === key ? 'font-bold' : 'font-medium'}`}>{label}</span>
                {activeTab === key && (
                  <span className="absolute bottom-0 w-5 h-[3px] bg-gray-900 rounded-full shadow-[0_0_6px_rgba(0,0,0,0.15)]" />
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
            onAcceptCall={() => {}}
            onRejectCall={() => setCallState(null)}
          />
        )}
      </ErrorBoundary>
    </div>
  );
}
