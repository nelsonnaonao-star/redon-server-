import React, { useState, useRef, useCallback } from 'react';
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
import { api } from '../services/api';

interface ChatListProps {
  chats: Chat[];
  onSelectChat: (chatId: string) => void;
  onAddChat: (newChat: Chat) => void;
  onDeleteChat?: (chatId: string) => void;
}

export default function ChatList({ chats, onSelectChat, onAddChat, onDeleteChat }: ChatListProps) {
  const [isContactSelectorOpen, setIsContactSelectorOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ chatId: string; x: number; y: number } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchMoved = useRef(false);

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

    // If the contact has a RED ON user ID, create the chat on the server
    if (newContact.userId) {
      try {
        const res = await api.sendDirectMessage(newContact.userId, '¡Hola! 👋');
        chatId = res.chatId;
        // Reload chats from server to get updated list
        const serverChats = await api.getChats();
        onAddChat(serverChats.find((c: Chat) => c.id === chatId) || {
          id: chatId,
          name: newContact.name,
          avatar: "",
          avatarColor: getRandomTailwindBgColor(),
          lastMessage: 'Sin mensajes aún',
          time: 'Ahora',
          unreadCount: 0,
          isOnline: false,
          phone: newContact.phone,
          username: newContact.username,
          bio: newContact.bio,
          messages: []
        });
        setIsContactSelectorOpen(false);
        return;
      } catch {
        // Fallback: create local chat
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
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5] dark:bg-slate-900 relative transition-colors duration-300">
      {/* Top spacing decoration representing the clean Telegram minimalist design */}
      <div className="h-4 flex-shrink-0" />

      {/* Main chat list - Continuous white block bg-white */}
      <div className="flex-1 w-full bg-white dark:bg-slate-900 border-none sm:border dark:sm:border-slate-800/80 max-w-md mx-auto shadow-[0_1px_2px_rgba(0,0,0,0.02)] sm:rounded-2xl overflow-y-auto pb-24 transition-colors duration-300">
        {chats.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500 flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-305 dark:text-slate-650 mb-4 animate-fade-in">
              <MessageSquare className="w-8 h-8" />
            </div>
            <p className="text-sm font-medium">Ninguna conversación activa</p>
            <p className="text-xs text-slate-400/85 dark:text-slate-500 mt-2">Empieza tocando el botón flotante inferior para elegir un contacto.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
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
                className="flex items-center px-4 py-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-all active:bg-slate-100 dark:active:bg-slate-800 group"
              >
                {/* Avatar with dynamic online state */}
                <div className="relative flex-shrink-0">
                  {chat.avatar ? (
                    <img 
                      src={chat.avatar} 
                      alt={chat.name} 
                      className="w-12 h-12 rounded-full object-cover border border-slate-100 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                    />
                  ) : (
                    <div className={`w-12 h-12 rounded-full ${chat.avatarColor || 'bg-slate-450'} text-white font-bold text-sm tracking-wide flex items-center justify-center border border-white dark:border-slate-850 shadow-[0_1px_3px_rgba(0,0,0,0.04)]`}>
                      {getInitials(chat.name)}
                    </div>
                  )}
                  {chat.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse" title="En línea" />
                  )}
                </div>

                {/* Name, message and state */}
                <div className="ml-3.5 flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-slate-900 dark:text-slate-100 font-semibold text-sm truncate leading-tight group-hover:text-[#3390ec] transition-colors">
                      {chat.name}
                    </h3>
                    <span className="text-slate-400 dark:text-slate-500 text-xs font-normal ml-2 flex-shrink-0">
                      {chat.time}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-slate-500 dark:text-slate-400 text-xs truncate mr-2 leading-relaxed max-w-[85%]">
                      {chat.lastMessage}
                    </p>
                    
                    {/* Unread Badge or Double check ticks */}
                    {chat.unreadCount > 0 ? (
                      <span className="bg-[#3390ec] text-white text-[10px] font-bold px-1.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center shadow-sm">
                        {chat.unreadCount}
                      </span>
                    ) : (
                      <span className="text-[#3390ec] opacity-60">
                        <CheckCheck className="w-4 h-4" />
                      </span>
                    )}
                  </div>
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
