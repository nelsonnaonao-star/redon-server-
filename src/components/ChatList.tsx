import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Chat, ChatStyle } from '../types';
import { 
  MessageSquare, 
  Check, 
  CheckCheck, 
  MessageSquarePlus,
  Trash2,
  BellOff,
  Ban,
  X,
  Lock,
  Menu,
  Search,
  MoreVertical,
} from 'lucide-react';
import ContactSelector from './ContactSelector';
import { ChatListSkeleton } from './Skeleton';
import { api } from '../services/api';
import { supabase } from '../lib/supabase';
import { showToast } from '../services/toastService';
import jsQR from 'jsqr';

interface ChatListProps {
  chats: Chat[];
  isLoading?: boolean;
  onSelectChat: (chatId: string) => void;
  onAddChat: (newChat: Chat) => void;
  onDeleteChat?: (chatId: string) => void;
  onDeleteContact?: (chatId: string) => void;
  blockedChatIds?: Set<string>;
  onToggleBlock?: (chatId: string) => void;
  chatStyle?: ChatStyle;
  onContactSaved?: (phone: string) => void;
  userId?: string;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function AvatarDisplay({ avatarUrl, name, isOnline }: { avatarUrl: string | null; name: string; isOnline: boolean; }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = avatarUrl && !imgFailed;
  return (
    <div className="w-12 h-12 rounded-2xl flex-shrink-0 relative overflow-hidden bg-amber-100 dark:bg-slate-700 flex items-center justify-center font-semibold text-amber-800 dark:text-slate-200 text-sm shadow-sm">
      {showImg ? (
        <img
          src={avatarUrl!}
          alt={name}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover rounded-2xl"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span className="leading-none">{getInitials(name)}</span>
      )}
      {isOnline && (
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
      )}
    </div>
  );
}

const ChatList = React.memo(function ChatList({ chats, isLoading, onSelectChat, onAddChat, onDeleteChat, onDeleteContact, blockedChatIds, onToggleBlock, chatStyle, onContactSaved, userId }: ChatListProps) {
  const [isContactSelectorOpen, setIsContactSelectorOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ chatId: string; x: number; y: number } | null>(null);
  const [actionMenu, setActionMenu] = useState<{ chatId: string } | null>(null);
  const [headerColor, setHeaderColor] = useState('#3390ec');
  const [textColor, setTextColor] = useState('text-white');
  const [searchQuery, setSearchQuery] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const filteredChats = useMemo(() => chats.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q)
      || c.lastMessage.toLowerCase().includes(q)
      || c.phone.toLowerCase().includes(q);
  }), [chats, searchQuery]);
  // Calculate header color based on chatStyle
  useEffect(() => {
    const color = chatStyle?.bubbleBackground || '#3390ec';
    setHeaderColor(color.startsWith('bg-') ? '#3390ec' : color);
  }, [chatStyle?.bubbleBackground]);
  const handleQrResult = useCallback(async (decodedText: string) => {
    const raw = decodedText.trim();
    if (!raw) {
      showToast('Código QR inválido', 'error');
      return;
    }

    // Extract userId or group code from unified format, with backward compatibility
    let userId: string | null = null;
    let groupCode: string | null = null;

    if (raw.startsWith('redon://user/')) {
      userId = raw.slice('redon://user/'.length).split('?')[0];
    } else if (raw.startsWith('redon://group/')) {
      groupCode = raw.slice('redon://group/'.length).split('?')[0];
    } else if (/^[0-9a-fA-F-]{36}$/.test(raw)) {
      userId = raw.toLowerCase();
    } else if (raw.length >= 4 && raw.length <= 8) {
      groupCode = raw.toUpperCase();
    } else {
      showToast('Código QR no reconocido', 'error');
      return;
    }

    if (groupCode) {
      try {
        const chatId = await api.joinGroupByInvite(groupCode);
        if (chatId) {
          const { data: chat } = await supabase.from('chats').select('*').eq('id', chatId).single();
          if (chat) {
            onAddChat({
              id: chat.id,
              name: chat.name || 'Grupo',
              avatar: chat.avatar || '',
              avatarColor: chat.avatar_color || 'bg-emerald-500',
              lastMessage: 'Te has unido al grupo',
              time: 'Ahora',
              unreadCount: 0,
              isOnline: false,
              phone: '',
              username: '',
              bio: '',
              messages: [],
              isGroup: true,
              adminId: chat.admin_id || undefined,
            });
            onSelectChat(chat.id);
          }
        }
        showToast('Te has unido al grupo');
      } catch (e: any) {
        showToast(e?.message || 'Error al unirse al grupo', 'error');
      }
      return;
    }

    if (!userId) return;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id,name,avatar,phone')
        .eq('id', userId)
        .single();
      if (!profile) { showToast('Usuario no encontrado', 'error'); return; }
      const res = await api.createChat(userId);
      if (res.created === false) {
        showToast(`${profile.name} ya es tu contacto`, 'info');
        onSelectChat(res.chatId);
        return;
      }
      const serverChats = await api.getChats();
      onAddChat(serverChats.find((c: Chat) => c.id === res.chatId) || {
        id: res.chatId,
        name: profile.name || 'Usuario',
        avatar: profile.avatar || '',
        avatarColor: 'bg-[#3390ec]',
        lastMessage: '',
        time: 'Ahora',
        unreadCount: 0,
        isOnline: false,
        phone: profile.phone || '',
        username: '',
        bio: '',
        messages: []
      });
      showToast(`Contacto agregado: ${profile.name}`);
    } catch {
      showToast('Error al agregar contacto', 'error');
    }
  }, [onAddChat, onSelectChat]);

  // QR scanner: live camera preview with auto-detection (professional approach)
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanLoopRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!showScanner) return;
    let cancelled = false;

    async function initCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try { await videoRef.current.play(); } catch (e) {
            console.warn('[QR] autoplay blocked:', e);
          }
        }
        scanLoopRef.current = requestAnimationFrame(scanFrame);
      } catch (err: any) {
        const msg = err?.name === 'NotAllowedError' ? 'Permiso de cámara denegado' : 'Error al abrir la cámara';
        console.warn('[QR] camera error:', err?.name || err);
        showToast(msg, 'error');
        if (!cancelled) setShowScanner(false);
      }
    }

    initCamera();

    return () => {
      cancelled = true;
      cancelAnimationFrame(scanLoopRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [showScanner]);

  function scanFrame() {
    try {
      const video = videoRef.current;
      if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
        scanLoopRef.current = requestAnimationFrame(scanFrame);
        return;
      }
      if (!scanCanvasRef.current) {
        scanCanvasRef.current = document.createElement('canvas');
      }
      const canvas = scanCanvasRef.current;
      const scale = 0.5;
      canvas.width = video.videoWidth * scale;
      canvas.height = video.videoHeight * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) { scanLoopRef.current = requestAnimationFrame(scanFrame); return; }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
      if (code) {
        stopScanner();
        handleQrResult(code.data);
        return;
      }
      scanLoopRef.current = requestAnimationFrame(scanFrame);
    } catch (e) {
      console.warn('[QR] scanFrame error:', e);
      scanLoopRef.current = requestAnimationFrame(scanFrame);
    }
  }

  function startScanner() {
    setIsContactSelectorOpen(false);
    setShowScanner(true);
  }

  function stopScanner() {
    setShowScanner(false);
  }
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchMoved = useRef(false);

  // Formatea ISO string → "7:42 p. m." (hoy) o "17/6/26" (días anteriores)
  const formatChatTime = (t: string): string => {
    if (!t) return '';
    const d = new Date(t);
    if (isNaN(d.getTime())) return t;
    const now = new Date();
    const isToday = d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    if (isToday) {
      return d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
    }
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const handleAddNewContact = async (newContact: { name: string; username: string; phone: string; bio: string; userId?: string }) => {
    const getRandomTailwindBgColor = () => {
      const bgColors = [
        'bg-red-500',
        'bg-emerald-500',
        'bg-indigo-500',
        'bg-purple-500',
        'bg-amber-500',
        'bg-pink-500',
        'bg-[#3390ec]',
        'bg-teal-500'
      ];
      return bgColors[Math.floor(Math.random() * bgColors.length)];
    };

    let chatId = String(Date.now());

    // If the contact has a RED ON user ID, create the chat silently on the server
    if (newContact.userId) {
      try {
        const res = await api.createChat(newContact.userId);
        chatId = res.chatId;
        const serverChats = await api.getChats();
        onAddChat(serverChats.find((c: Chat) => c.id === chatId) || {
          id: chatId,
          name: newContact.name,
          avatar: "",
          avatarColor: getRandomTailwindBgColor(),
          lastMessage: '',
          time: 'Ahora',
          unreadCount: 0,
          isOnline: false,
          phone: newContact.phone,
          username: newContact.username,
          bio: newContact.bio,
          messages: []
        });
        setIsContactSelectorOpen(false);
        onContactSaved?.(newContact.phone.replace(/\D/g, ''));
        showToast('Contacto guardado exitosamente');
        return;
      } catch (e) {
        console.warn('createChat fallback:', e);
      }
    }

    const newChat: Chat = {
      id: chatId,
      name: newContact.name,
      avatar: "",
      avatarColor: getRandomTailwindBgColor(),
      lastMessage: "Sin mensajes aún",
      time: "Ahora",
      unreadCount: 0,
      isOnline: false,
      phone: newContact.phone,
      username: newContact.username,
      bio: newContact.bio,
      messages: []
    };

    onAddChat(newChat);
    setIsContactSelectorOpen(false);
    onContactSaved?.(newContact.phone.replace(/\D/g, ''));
    showToast('Contacto guardado exitosamente');
  };

  const handleCreateGroup = async (groupName: string, participantIds: string[]) => {
    try {
      const { chatId } = await api.createGroupChat(groupName, participantIds);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', participantIds);
      const names = (profiles || []).map(p => p.name).filter(Boolean).join(', ');
      const avatarUrl = (profiles || []).find(p => p.avatar_url)?.avatar_url || '';
      onAddChat({
        id: chatId,
        name: groupName,
        avatar: avatarUrl,
        avatarColor: 'bg-emerald-500',
        lastMessage: 'Grupo creado',
        time: 'Ahora',
        unreadCount: 0,
        isOnline: false,
        phone: '',
        username: '',
        bio: `Grupo: ${names}`,
        messages: [],
        isGroup: true,
        participantIds: [userId, ...participantIds],
        adminId: userId,
      });
      setIsContactSelectorOpen(false);
      showToast(`Grupo "${groupName}" creado`);
    } catch {
      showToast('Error al crear el grupo', 'error');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5] dark:bg-slate-900 relative transition-colors duration-300">
      
      {/* Header - Corporate WeChat Work Style - Adaptive Color */}
      <div 
        className={`text-white px-4 pt-8 transition-colors duration-300`}
        style={{ backgroundColor: headerColor }}
      >
        {/* Top Row - Title */}
        <div className="flex justify-center items-center pb-2">
          <h1 className="text-lg font-normal tracking-wide">
            Mensajes
          </h1>
        </div>

        {/* Bottom Row - Search */}
        <div className="pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70" />
            <input
              type="text"
              placeholder="Buscar"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-9 bg-white rounded-md text-gray-800 text-sm px-10 outline-none placeholder:text-gray-400"
            />
          </div>
        </div>
      </div>

      {/* Main chat list - Continuous white block bg-white */}
      <div className="flex-1 w-full bg-white dark:bg-slate-900 border-none sm:border dark:sm:border-slate-800/80 max-w-md mx-auto shadow-[0_1px_2px_rgba(0,0,0,0.02)] sm:rounded-2xl overflow-y-auto pb-24 transition-colors duration-300">
        {isLoading ? (
          <ChatListSkeleton />
        ) : chats.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8" />
            </div>
            <p className="text-sm font-medium">Ninguna conversación activa</p>
            <p className="text-xs text-slate-400/85 dark:text-slate-500 mt-2">Empieza tocando el botón flotante inferior para elegir un contacto.</p>
          </div>
        ) : (
          <div>
              {filteredChats.length === 0 && searchQuery.trim() ? (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm">
                  Sin resultados para "{searchQuery}"
                </div>
              ) : null}
              {filteredChats.map((chat) => {
                const isBlocked = blockedChatIds?.has(chat.id);
                return (
              <React.Fragment key={chat.id}>
              <div 
                onClick={() => { if (!contextMenu) onSelectChat(chat.id); }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ chatId: chat.id, x: e.clientX, y: e.clientY });
                }}
                onTouchStart={() => {
                  touchMoved.current = false;
                  longPressTimer.current = setTimeout(() => {
                    setContextMenu({ chatId: chat.id, x: 0, y: 200 });
                  }, 600);
                }}
                onTouchMove={() => { touchMoved.current = true; if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                onTouchEnd={() => {
                  if (longPressTimer.current) clearTimeout(longPressTimer.current);
                  if (!touchMoved.current && !contextMenu) onSelectChat(chat.id);
                }}
                className={`w-full flex items-center justify-between py-3 px-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800/60 hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-all cursor-pointer relative ${isBlocked ? 'opacity-60' : ''}`}
              >
                {isBlocked && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-400 rounded-r" />
                )}
                {/* COL 1: Avatar (fixed width) */}
                <AvatarDisplay
                  avatarUrl={chat.avatar || null}
                  name={chat.name}
                  isOnline={chat.isOnline}
                />

                {/* COL 2: Name + Message (flex-1, truncates safely) */}
                <div className="flex-1 min-w-0 ml-3 flex flex-col justify-center">
                  <div className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate leading-tight">
                    {chat.name}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-slate-400 truncate mt-0.5 leading-snug">
                    {chat.lastMessage}
                    {chat.lastMessageStatus && chat.lastMessageStatus !== 'sending' && (
                      <span className="flex-shrink-0">
                        {chat.lastMessageStatus === 'sent' ? (
                          <Check className="w-3 h-3 text-gray-400 dark:text-slate-500" />
                        ) : (
                          <CheckCheck className={`w-3 h-3 ${chat.lastMessageStatus === 'read' ? 'text-green-500' : 'text-gray-400 dark:text-slate-500'}`} />
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* COL 3: Time + Status (fixed, never wraps) */}
                <div className="flex flex-col items-end justify-between h-10 ml-2 flex-shrink-0">
                  <span className="text-xs text-blue-500 whitespace-nowrap leading-none font-medium">
                    {formatChatTime(chat.time)}
                  </span>
                  {isBlocked ? (
                    <span className="mt-1 leading-none" title="Bloqueado">
                      <Lock className="w-4 h-4 text-red-400" />
                    </span>
                  ) : chat.unreadCount > 0 ? (
                    <span className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold mt-1 leading-none">
                      {chat.unreadCount}
                    </span>
                  ) : (
                    <span className="mt-1 leading-none">
                      <CheckCheck className="w-4 h-4 text-blue-500" />
                    </span>
                  )}
                </div>

                {/* COL 4: 3-dots menu */}
                <div className="relative flex-shrink-0 ml-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setActionMenu(prev => prev?.chatId === chat.id ? null : { chatId: chat.id }); }}
                    className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
                  >
                    <MoreVertical className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                  </button>
                  {actionMenu?.chatId === chat.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setActionMenu(null)} />
                      <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 py-1 min-w-[180px] overflow-hidden">
                        <button
                          onClick={() => { onDeleteContact?.(chat.id); setActionMenu(null); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Eliminar contacto
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
              </React.Fragment>
            );
          })}
          </div>
        )}
      </div>

      {/* Context Menu Overlay */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div 
            className="fixed z-50 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 py-1 min-w-[200px] overflow-hidden"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="px-4 py-2 text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-100 dark:border-slate-700">
              {chats.find(c => c.id === contextMenu.chatId)?.name}
            </div>
            <button
              onClick={() => { onDeleteChat?.(contextMenu.chatId); setContextMenu(null); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar conversación
            </button>
            <button
              onClick={() => setContextMenu(null)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <BellOff className="w-4 h-4" />
              Silenciar
            </button>
            <button
              onClick={() => { onToggleBlock?.(contextMenu.chatId); setContextMenu(null); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <Ban className={`w-4 h-4 ${blockedChatIds?.has(contextMenu.chatId) ? 'text-red-500' : ''}`} />
              {blockedChatIds?.has(contextMenu.chatId) ? 'Desbloquear' : 'Bloquear'}
            </button>
          </div>
        </>
      )}

      {/* Floating Action Button (FAB) - Circular blue button for selecting contacts */}
      <button 
        id="btn-fab-new-message"
        onClick={() => setIsContactSelectorOpen(true)}
        className="absolute bottom-20 right-6 bg-[#3390ec] text-white p-4.5 rounded-full shadow-[0_6px_16px_rgba(51,144,236,0.28)] hover:bg-[#2b7bc9] active:scale-95 transition-all text-center z-50 focus:outline-none cursor-pointer flex items-center justify-center group"
        title="Nuevo Chat/Selector de Contactos"
      >
        <MessageSquarePlus className="w-6 h-6 group-hover:scale-110 transition-transform duration-200" />
      </button>

      {/* Dynamic Slide-Up Contact Selector */}
      <ContactSelector
        isOpen={isContactSelectorOpen}
        onClose={() => setIsContactSelectorOpen(false)}
        onSelectContact={(contactId) => {
          setIsContactSelectorOpen(false);
          onSelectChat(contactId);
        }}
        onAddCustomContact={handleAddNewContact}
        onCreateGroup={handleCreateGroup}
        userId={userId}
        onScanQr={startScanner}
      />

      {/* QR Scanner Overlay — live camera with auto-detection */}
      {showScanner && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black animate-fade-in">
          <div className="flex items-center justify-between px-4 pt-12 pb-3 absolute top-0 left-0 right-0 z-10">
            <h3 className="text-white text-sm font-semibold">Escanear código QR</h3>
            <button onClick={stopScanner}
              className="p-2 rounded-full hover:bg-white/20 transition-colors cursor-pointer bg-black/30"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          <div className="flex-1 relative overflow-hidden">
            <video ref={videoRef} playsInline muted className="absolute inset-0 w-full h-full object-cover" />
            {/* Scanner frame guide */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-64 h-64 border-2 border-white/60 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
            </div>
          </div>
          <div className="absolute bottom-12 left-0 right-0 flex justify-center">
            <p className="text-white/60 text-[11px] font-medium bg-black/40 px-4 py-2 rounded-full backdrop-blur-sm">
              Apunta al código QR para escanear automáticamente
            </p>
          </div>
        </div>
      )}
    </div>
  );
});

export default ChatList;
