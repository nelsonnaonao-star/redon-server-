import React, { useState, useRef } from 'react';
import { Chat } from '../types';
import { 
  MessageSquare, 
  Check, 
  CheckCheck, 
  MessageSquarePlus,
  Trash2,
  BellOff,
  Ban,
  X
} from 'lucide-react';
import ContactSelector from './ContactSelector';
import { ChatListSkeleton } from './Skeleton';
import { api } from '../services/api';

interface ChatListProps {
  chats: Chat[];
  isLoading?: boolean;
  onSelectChat: (chatId: string) => void;
  onAddChat: (newChat: Chat) => void;
  onDeleteChat?: (chatId: string) => void;
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

export default function ChatList({ chats, isLoading, onSelectChat, onAddChat, onDeleteChat }: ChatListProps) {
  const [isContactSelectorOpen, setIsContactSelectorOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ chatId: string; x: number; y: number } | null>(null);
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
        onSelectChat(chatId);
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
    onSelectChat(chatId);
  };

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5] dark:bg-slate-900 relative transition-colors duration-300">
      {/* Top spacing decoration representing the clean Telegram minimalist design */}
      <div className="h-4 flex-shrink-0" />

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
            {chats.map((chat) => (
              <div 
                key={chat.id}
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
                className="w-full flex items-center justify-between py-3 px-4 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800/60 hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-all cursor-pointer"
              >
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
                  <div className="flex items-center text-sm text-gray-500 dark:text-slate-400 truncate mt-0.5 leading-snug">
                    {chat.lastMessage}
                  </div>
                </div>

                {/* COL 3: Time + Status (fixed, never wraps) */}
                <div className="flex flex-col items-end justify-between h-10 ml-2 flex-shrink-0">
                  <span className="text-xs text-gray-400 dark:text-slate-500 whitespace-nowrap leading-none">
                    {formatChatTime(chat.time)}
                  </span>
                  {chat.unreadCount > 0 ? (
                    <span className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold mt-1 leading-none">
                      {chat.unreadCount}
                    </span>
                  ) : (
                    <span className="mt-1 leading-none">
                      <CheckCheck className="w-4 h-4 text-blue-500" />
                    </span>
                  )}
                </div>
              </div>
            ))}
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
              onClick={() => setContextMenu(null)}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <Ban className="w-4 h-4" />
              Bloquear
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
        contacts={chats}
        isOpen={isContactSelectorOpen}
        onClose={() => setIsContactSelectorOpen(false)}
        onSelectContact={(contactId) => {
          setIsContactSelectorOpen(false);
          onSelectChat(contactId);
        }}
        onAddCustomContact={handleAddNewContact}
      />
    </div>
  );
}
