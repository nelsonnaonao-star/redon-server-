import React, { useState, useEffect, useCallback } from 'react';
import { Chat, UserProfile, ActiveTab, Moment, ChatStyle, BusinessListing } from './types';
import { supabase } from './lib/supabase';
import { api } from './services/api';
import { connectSocket, disconnectSocket, setMessageHandler, setNewChatHandler, setStatusUpdateHandler } from './services/socket';
import { playSound } from './services/soundPlayer';
import { setupCapacitorPush } from './services/pushCapacitor';

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
  } | null>(null);

  const [chatStyle, setChatStyle] = useState<ChatStyle>(() => {
    const savedColor = localStorage.getItem('chat_bubble_color');
    const savedBG = localStorage.getItem('chat_bubble_background');
    return { bubbleColor: savedColor || 'blue', bubbleBackground: savedBG || '' };
  });

  const handleUpdateChatStyle = (newStyle: ChatStyle) => {
    setChatStyle(newStyle);
    localStorage.setItem('chat_bubble_color', newStyle.bubbleColor);
    localStorage.setItem('chat_bubble_background', newStyle.bubbleBackground);
  };

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

  // Restore session on mount (Supabase maneja el token automáticamente)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUserId(session.user.id);
        api.getProfile().then(p => {
          setProfile(p);
          setActiveTab('chats');
        }).catch(() => {
          supabase.auth.signOut();
          setActiveTab('auth');
        });
        api.getChats().then(setChats).catch(() => {});
        api.getMoments().then(setMoments).catch(() => {});
        setupCapacitorPush(session.user.id).catch(() => {});
      }
    });
  }, []);

  // Realtime subscription via Supabase
  useEffect(() => {
    if (!userId) return;
    connectSocket(userId);

    setMessageHandler((data) => {
      const { chatId, sender, text, time, id } = data;
      setChats(prev => prev.map(c => {
        if (c.id !== chatId) return c;
        const msg = { id, sender, text, time: time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), status: 'sent' as const };
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
            status: 'sent'
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
            viewCount: 0,
            reactions: [],
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
      });
    });
    callNotifyChannel.subscribe();

    // Listen for incoming calls from push notifications
    const handleIncomingCallFromPush = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.chatId && detail?.callerId) {
        setCallState({
          isOpen: true,
          contactName: detail.callerName || 'Llamada entrante',
          contactAvatar: '',
          chatId: detail.chatId,
          contactId: detail.callerId,
          direction: 'incoming',
        });
      }
    };
    window.addEventListener('incoming-call', handleIncomingCallFromPush);

    return () => {
      window.removeEventListener('incoming-call', handleIncomingCallFromPush);
      disconnectSocket();
      supabase.removeChannel(momentChannel);
      supabase.removeChannel(callNotifyChannel);
    };
  }, [userId, activeChatId]);

  const handleStartCall = useCallback(async (chatId: string, contactId: string, contactName: string, contactAvatar: string) => {
    if (!userId) return;
    // Subscribe to channel first, then send broadcast
    const chan = supabase.channel(`calls:${contactId}`);
    chan.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        chan.send({
          type: 'broadcast',
          event: 'incoming-call',
          payload: { chatId, callerId: userId, callerName: profile.name || contactName, callerAvatar: profile.avatar || contactAvatar },
        });
      }
    });
    // Send FCM push to wake the callee if minimized
    const pushPayload = JSON.stringify({
      profile_id: contactId,
      title: profile.name || 'RED ON',
      body: 'Llamada entrante...',
      data: { type: 'call', chatId, callerId: userId, callerName: profile.name || contactName },
    });
    for (const url of [
      `http://${localStorage.getItem('redon_server_ip') || 'localhost'}:3001/api/fcm/send`,
      'https://disciplined-quietude-production-7b38.up.railway.app/api/fcm/send',
    ]) {
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: pushPayload }).catch(() => {});
    }
    // Open own call UI
    setCallState({ isOpen: true, contactName, contactAvatar, chatId, contactId, direction: 'outgoing' });
  }, [userId, profile]);

  const handleEndCall = useCallback(() => {
    setCallState(null);
  }, []);

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
      // Silently fail — message is already shown optimistically
    }
  }, []);

  const handleSendAudioMessage = useCallback(async (chatId: string, audioBlob: Blob, duration: number) => {
    const msgId = String(Date.now());
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const audioUrl = URL.createObjectURL(audioBlob);
    const text = '🎤 Nota de voz';

    const newMessage: Message = {
      id: msgId, sender: 'me' as const, text, time, status: 'sent' as const,
      audioUrl, audioDuration: duration, mimeType: audioBlob.type || 'audio/webm',
    };

    setChats(prev => prev.map(c => {
      if (c.id !== chatId) return c;
      return { ...c, lastMessage: text, time, messages: [...c.messages, newMessage] };
    }));

    try {
      await api.sendMessage(chatId, text);
    } catch {}
  }, []);

  // Load messages when opening a chat
  const handleSelectChat = useCallback(async (chatId: string) => {
    setActiveChatId(chatId);
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, unreadCount: 0 } : c));
    try {
      const freshMessages = await api.getMessages(chatId);
      setChats(prev => prev.map(c => {
        if (c.id !== chatId) return c;
        // Merge: keep existing status for messages we already know about
        const merged = freshMessages.map((fm: any) => {
          const existing = c.messages.find(m => m.id === fm.id);
          return existing ? { ...fm, status: existing.status } : fm;
        });
        return { ...c, messages: merged };
      }));
      api.markRead(chatId).catch(() => {});
    } catch {}
  }, []);

  const handleUpdateProfile = async (updated: UserProfile) => {
    setProfile(updated);
    localStorage.setItem('redon_profile', JSON.stringify(updated));
    try {
      await api.updateProfile(updated);
    } catch {}
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
      });
      const updated = await api.getMoments();
      setMoments(updated);
    } catch {}
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
    api.getChats().then(setChats).catch(() => {});
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
    <div className="h-screen w-screen bg-bg-warm dark:bg-dark-bg text-text-primary dark:text-dark-text-primary font-sans flex flex-col overflow-hidden transition-colors duration-300">
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
                <h2 className="font-display text-text-primary dark:text-dark-text-primary font-bold text-base tracking-tight select-none">
                  {activeTab === 'chats' && 'Chats'}
                  {activeTab === 'moments' && 'Momentos'}
                  {activeTab === 'interests' && 'Indicadores'}
                  {activeTab === 'emprendedor' && 'Modo Emprendedor'}
                  {activeTab === 'profile' && 'Mi Perfil'}
                </h2>
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
            {activeTab === 'chats' && (
              activeChatId && activeChat ? (
                <ChatDetail
                  chat={activeChat}
                  onBack={() => setActiveChatId(null)}
                  onSendMessage={handleSendMessage}
                  onSendAudioMessage={handleSendAudioMessage}
                  chatStyle={chatStyle}
                  onStartCall={handleStartCall}
                />
              ) : (
                <ChatList
                  chats={chats}
                  onSelectChat={(id) => handleSelectChat(id)}
                  onAddChat={(newChat) => {
                    setChats(prev => [newChat, ...prev]);
                    setActiveChatId(newChat.id);
                    if (newChat.id) {
                      api.getMessages(newChat.id).then(msgs => {
                        setChats(prev => prev.map(c => c.id === newChat.id ? { ...c, messages: msgs as any } : c));
                      }).catch(() => {});
                    }
                  }}
                  onDeleteChat={(id) => setChats(prev => prev.filter(c => c.id !== id))}
                />
              )
            )}
            {activeTab === 'moments' && (
              <MomentsView profile={profile} moments={moments} onAddMoment={handleAddMoment} />
            )}
            {activeTab === 'interests' && <InterestsView />}
            {activeTab === 'emprendedor' && (
              <EmprendedorView onStartBusinessChat={handleStartBusinessChat} />
            )}
            {activeTab === 'profile' && (
              <ProfileView
                profile={profile}
                onUpdateProfile={handleUpdateProfile}
                isDarkMode={isDarkMode}
                onToggleDarkMode={toggleTheme}
                chatStyle={chatStyle}
                onUpdateChatStyle={handleUpdateChatStyle}
              />
            )}
          </div>
          {!activeChatId && (
            <nav className="h-16 bg-surface dark:bg-dark-surface border-t border-border/80 dark:border-dark-border/60 flex items-center justify-around px-2 z-20 select-none pb-1 flex-shrink-0 backdrop-blur-sm transition-colors duration-300">
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
                label: 'Negocio',
                icon: TrendingUp,
              }, {
                key: 'profile',
                label: 'Perfil',
                icon: User,
              }].map(({ key, label, icon: Icon, badge, dot }) => (
              <button key={key} onClick={() => setActiveTab(key as ActiveTab)}
                className={`group flex-1 flex flex-col items-center justify-center py-1.5 relative transition-all duration-200 cursor-pointer select-none
                  ${activeTab === key ? 'text-brand' : 'text-text-tertiary dark:text-dark-text-tertiary hover:text-text-secondary dark:hover:text-dark-text-secondary'}`}>
                <div className="relative">
                  <Icon className={`w-5 h-5 transition-transform duration-200 ${activeTab === key ? 'scale-110' : 'group-hover:scale-105'}`} />
                  {badge != null && (
                    <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[8px] font-bold min-w-[16px] h-[16px] rounded-full flex items-center justify-center border-[2.5px] border-surface dark:border-dark-surface shadow-sm">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                  {dot && (
                    <span className="absolute -top-1 -right-1.5 w-2 h-2 bg-brand rounded-full border-[2px] border-surface dark:border-dark-surface shadow-sm" />
                  )}
                </div>
                <span className={`text-[9px] font-bold mt-1.5 tracking-wider uppercase transition-colors duration-200`}>{label}</span>
                {activeTab === key && (
                  <span className="absolute bottom-0 w-5 h-[3px] bg-brand rounded-full shadow-[0_0_6px_rgba(43,126,251,0.4)]" />
                )}
              </button>
              ))}
            </nav>
          )}
        </div>
      )}

      {/* Call UI */}
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
          onAcceptCall={() => {}}
          onRejectCall={() => setCallState(null)}
        />
      )}
    </div>
  );
}
