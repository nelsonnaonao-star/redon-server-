import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Megaphone, Plus, ArrowLeft, Send, UserPlus, UserMinus, Users, MessageSquare } from 'lucide-react';
import { api } from '../services/api';
import type { BroadcastChannel, BroadcastMessage } from '../types';

interface BroadcastViewProps {
  userId: string;
}

const BroadcastView: React.FC<BroadcastViewProps> = ({ userId }) => {
  const [channels, setChannels] = useState<BroadcastChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<BroadcastChannel | null>(null);
  const [messages, setMessages] = useState<BroadcastMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadChannels = useCallback(async () => {
    const ch = await api.getBroadcastChannels(userId);
    setChannels(ch);
  }, [userId]);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openChannel = async (ch: BroadcastChannel) => {
    setSelectedChannel(ch);
    const msgs = await api.getBroadcastMessages(ch.id);
    setMessages(msgs);
  };

  const handleSend = async () => {
    if (!inputText.trim() || !selectedChannel) return;
    const ok = await api.sendBroadcastMessage(selectedChannel.id, inputText.trim());
    if (ok) {
      setInputText('');
      const msgs = await api.getBroadcastMessages(selectedChannel.id);
      setMessages(msgs);
    }
  };

  const handleSubscribe = async (ch: BroadcastChannel) => {
    const ok = await api.subscribeToChannel(ch.id);
    if (ok) loadChannels();
  };

  const handleUnsubscribe = async (ch: BroadcastChannel) => {
    const ok = await api.unsubscribeFromChannel(ch.id);
    if (ok) {
      loadChannels();
      if (selectedChannel?.id === ch.id) setSelectedChannel(null);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const id = await api.createBroadcastChannel(newName.trim(), newDesc.trim());
    if (id) {
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      loadChannels();
    }
  };

  const subscribed = channels.filter(c => c.is_subscribed);
  const discover = channels.filter(c => !c.is_subscribed && c.admin_id !== userId);

  const isAdmin = selectedChannel?.admin_id === userId;

  if (selectedChannel) {
    return (
      <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <button onClick={() => setSelectedChannel(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors cursor-pointer">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-[15px] leading-tight truncate text-gray-900 dark:text-white">{selectedChannel.name}</h2>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{selectedChannel.subscriber_count || 0} suscriptores · por {selectedChannel.admin_name}</p>
          </div>
          {!isAdmin && (
            <button onClick={() => selectedChannel.is_subscribed ? handleUnsubscribe(selectedChannel) : handleSubscribe(selectedChannel)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                selectedChannel.is_subscribed
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300'
                  : 'bg-brand text-white hover:bg-brand/90'
              }`}>
              {selectedChannel.is_subscribed ? <UserMinus className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
              {selectedChannel.is_subscribed ? 'Suscrito' : 'Suscribirse'}
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
              <MessageSquare className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm font-medium">No hay mensajes aún</p>
              <p className="text-xs mt-1">Los mensajes del administrador aparecerán aquí</p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className="bg-white dark:bg-gray-800 rounded-2xl px-4 py-3 shadow-sm border border-gray-100 dark:border-gray-700 max-w-[85%]">
              <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 block">
                {new Date(msg.created_at).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        {isAdmin && (
          <div className="px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Escribe un mensaje a tus suscriptores..."
                className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/40 transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
              <button onClick={handleSend} disabled={!inputText.trim()}
                className="p-2.5 bg-brand text-white rounded-full hover:bg-brand/90 disabled:opacity-40 transition-colors cursor-pointer">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-brand" />
          <h2 className="font-semibold text-[15px] text-gray-900 dark:text-white">Canales</h2>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white rounded-full text-xs font-medium hover:bg-brand/90 transition-colors cursor-pointer">
          <Plus className="w-3.5 h-3.5" />
          Crear
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Mis Canales</h3>
          {subscribed.length === 0 ? (
            <div className="text-center py-8 text-gray-400 dark:text-gray-500">
              <Megaphone className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No estás suscrito a ningún canal</p>
              <p className="text-xs mt-1">Descubre canales públicos abajo</p>
            </div>
          ) : (
            <div className="space-y-2">
              {subscribed.map(ch => (
                <button key={ch.id} onClick={() => openChannel(ch)}
                  className="w-full flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer text-left">
                  <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                    <Megaphone className="w-5 h-5 text-brand" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{ch.name}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{ch.subscriber_count || 0} suscriptores</p>
                  </div>
                  {ch.admin_id === userId && (
                    <span className="text-[10px] font-medium text-brand bg-brand/10 px-2 py-0.5 rounded-full">Admin</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {discover.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Descubrir</h3>
            <div className="space-y-2">
              {discover.map(ch => (
                <div key={ch.id} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                    <Megaphone className="w-5 h-5 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{ch.name}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{ch.subscriber_count || 0} suscriptores · por {ch.admin_name}</p>
                  </div>
                  <button onClick={() => handleSubscribe(ch)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-brand text-white rounded-full text-xs font-medium hover:bg-brand/90 transition-colors cursor-pointer whitespace-nowrap">
                    <UserPlus className="w-3 h-3" />
                    Seguir
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center"
            onClick={() => setShowCreate(false)}>
            <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-6 shadow-xl">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Crear Canal</h3>
              <input value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="Nombre del canal"
                className="w-full bg-gray-100 dark:bg-gray-700 rounded-xl px-4 py-3 text-sm mb-3 outline-none focus:ring-2 focus:ring-brand/40 text-gray-900 dark:text-white placeholder-gray-400" />
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)}
                placeholder="Descripción (opcional)"
                rows={3}
                className="w-full bg-gray-100 dark:bg-gray-700 rounded-xl px-4 py-3 text-sm mb-4 outline-none focus:ring-2 focus:ring-brand/40 resize-none text-gray-900 dark:text-white placeholder-gray-400" />
              <div className="flex gap-2">
                <button onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-pointer">
                  Cancelar
                </button>
                <button onClick={handleCreate} disabled={!newName.trim()}
                  className="flex-1 py-2.5 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand/90 disabled:opacity-40 transition-colors cursor-pointer">
                  Crear
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BroadcastView;
