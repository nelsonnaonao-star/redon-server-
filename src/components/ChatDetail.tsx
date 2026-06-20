import React, { useState, useRef, useEffect } from 'react';
import { Chat, Message, ChatStyle } from '../types';
import { 
  ArrowLeft, 
  Send, 
  Phone, 
  Video, 
  MoreVertical, 
  Check, 
  CheckCheck,
  User,
  Info,
  Calendar,
  Shield,
  Smile,
  Paperclip,
  Clock,
  X,
  Image,
  FileText,
  Music,
  MapPin,
  Plus,
  Camera,
  Mic,
  Square,
  Sticker
} from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { StickerPicker } from './StickerPicker';
import { ChatWallpaper } from './ChatWallpaper';
import { MediaEditor } from './MediaEditor';
import MessageBubble from './MessageBubble';

interface ChatDetailProps {
  chat: Chat;
  onBack: () => void;
  onSendMessage: (chatId: string, text: string) => void;
  chatStyle: ChatStyle;
  onStartCall?: (chatId: string, contactId: string, contactName: string, contactAvatar: string) => void;
}

export default function ChatDetail({ 
  chat, 
  onBack, 
  onSendMessage, 
  chatStyle,
  onStartCall
}: ChatDetailProps) {
  const [inputText, setInputText] = useState('');
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Dynamic customization states
  const [currentWallpaper, setCurrentWallpaper] = useState<string>('bg-[#f0f2f5]');
  const [isWallpaperOpen, setIsWallpaperOpen] = useState(false);
  const [selectedFileForEdit, setSelectedFileForEdit] = useState<File | null>(null);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Popover state for attachments
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // File input ref for real file uploads
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sticker/Emoji/GIF picker
  const [showStickerPicker, setShowStickerPicker] = useState(false);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      triggerAlert('Tu dispositivo no soporta grabación de audio en esta versión.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermissionDenied(false);
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        onSendMessage(chat.id, '🎤 [Nota de voz]');
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      const errName = (err as Error).name || '';
      const errMsg = (err as Error).message || '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError' || errMsg.includes('permission') || errMsg.includes('Permission')) {
        setMicPermissionDenied(true);
        triggerAlert('Permiso de micrófono denegado. Ve a Ajustes > Aplicaciones > RED ON > Permisos y activa el micrófono.');
      } else {
        triggerAlert('Error al acceder al micrófono. Asegúrate de haber concedido el permiso en Ajustes del teléfono.');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const requestMicPermission = async () => {
    setMicPermissionDenied(false);
    await startRecording();
  };

  const [showStatusAlert, setShowStatusAlert] = useState<string | null>(null);
  const triggerAlert = (message: string) => {
    setShowStatusAlert(message);
    setTimeout(() => setShowStatusAlert(null), 4000);
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFileForEdit(file);
    }
  };

  // Popover states for reactions
  const [activeMessageIdForReaction, setActiveMessageIdForReaction] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const timerRef = useRef<any>(null);

  const handlePressStart = (msgId: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setActiveMessageIdForReaction(msgId);
    }, 500); // 500ms long press detect
  };

  const handlePressEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };

  const handleTouchStart = (msgId: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setActiveMessageIdForReaction(msgId);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };

  // Auto scroll to bottom when messages list change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const query = inputText.trim();
    onSendMessage(chat.id, query);
    setInputText('');
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
    <div className="flex flex-col h-full bg-[#f0f2f5] relative font-sans">
      
      {/* Header of Chat */}
      <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.03)] z-10 flex-shrink-0">
        <div className="flex items-center min-w-0">
          {/* Back Arrow button */}
          <button 
            onClick={onBack}
            className="mr-2.5 p-1.5 hover:bg-slate-100 active:scale-95 text-slate-700 hover:text-slate-900 rounded-full transition-all cursor-pointer"
            title="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Contact Details Trigger */}
          <div 
            onClick={() => setShowInfoPanel(true)}
            className="flex items-center gap-3 cursor-pointer group min-w-0"
          >
            <div className="relative flex-shrink-0">
              {chat.avatar ? (
                <img 
                  src={chat.avatar} 
                  alt={chat.name} 
                  className="w-10 h-10 rounded-full object-cover border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                />
              ) : (
                <div className={`w-10 h-10 rounded-full ${chat.avatarColor || 'bg-slate-400'} text-white font-bold text-xs flex items-center justify-center border border-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]`}>
                  {getInitials(chat.name)}
                </div>
              )}
              {chat.isOnline && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
              )}
            </div>

            <div className="min-w-0">
              <h4 className="text-slate-900 font-semibold text-sm leading-tight group-hover:text-[#3390ec] transition-colors truncate">
                {chat.name}
              </h4>
              <p className="text-slate-500 text-xs font-normal">
                {chat.isOnline ? (
                  <span className="text-[#3390ec] font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    en línea
                  </span>
                ) : (
                  'últ. vez hace poco'
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Header Right Action icons */}
        <div className="flex items-center gap-1.5 text-slate-500 relative">
          <button 
            onClick={() => onStartCall?.(chat.id, chat.profileId || '', chat.name, chat.avatar)}
            className="p-2 hover:bg-slate-50 active:scale-95 hover:text-slate-800 rounded-full cursor-pointer transition-colors"
            title="Llamar"
          >
            <Phone className="w-4.5 h-4.5" />
          </button>
          <button 
            onClick={() => onStartCall?.(chat.id, chat.profileId || '', chat.name, chat.avatar)}
            className="p-2 hover:bg-slate-50 active:scale-95 hover:text-slate-800 rounded-full cursor-pointer transition-colors"
            title="Videollamada"
          >
            <Video className="w-4.5 h-4.5" />
          </button>
          <button 
            onClick={() => setShowInfoPanel(!showInfoPanel)}
            className={`p-2 active:scale-95 rounded-full cursor-pointer transition-all ${showInfoPanel ? 'bg-[#3390ec]/10 text-[#3390ec]' : 'hover:bg-slate-50 hover:text-slate-800'}`}
            title="Ver información"
          >
            <Info className="w-4.5 h-4.5" />
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className={`p-2 active:scale-95 rounded-full cursor-pointer transition-all ${showMoreMenu ? 'bg-slate-100 text-slate-800' : 'hover:bg-slate-50 hover:text-slate-800'}`}
              title="Más opciones de chat"
            >
              <MoreVertical className="w-4.5 h-4.5" />
            </button>
            {showMoreMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-xl py-1.5 z-50">
                <button
                  type="button"
                  onClick={() => {
                    setIsWallpaperOpen(true);
                    setShowMoreMenu(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-750 text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  <span className="text-sm">🎨</span>
                  <span>Cambiar fondo de chat</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Viewport for messages */}
      <div 
        className={`flex-1 overflow-y-auto px-4 py-4 space-y-3.5 transition-all duration-300 ${
          chatStyle.bubbleBackground ? '' : (currentWallpaper.startsWith('custom-img:[') ? '' : currentWallpaper)
        }`}
        style={
          chatStyle.bubbleBackground 
            ? { 
                backgroundImage: `url(${chatStyle.bubbleBackground})`, 
                backgroundSize: 'cover', 
                backgroundPosition: 'center',
                backgroundAttachment: 'local'
              }
            : currentWallpaper.startsWith('custom-img:[') 
              ? { 
                  backgroundImage: `url(${currentWallpaper.substring(currentWallpaper.indexOf('[') + 1, currentWallpaper.lastIndexOf(']'))})`, 
                  backgroundSize: 'cover', 
                  backgroundPosition: 'center',
                  backgroundAttachment: 'local'
                } 
              : {}
        }
      >
        
        {/* Helper informational header for RED ON Bot */}
        {chat.id === "4" && (
          <div className="max-w-xs mx-auto text-center py-2.5 px-3 bg-white/70 dark:bg-slate-800/80 border border-slate-200/45 dark:border-slate-700/50 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.02)] mb-4">
            <p className="text-[11px] text-slate-500/90 dark:text-slate-300 leading-normal">
              💬 Prueba a enviarle un mensaje al bot inteligente como: <strong className="text-[#3390ec]">"hola"</strong>, <strong className="text-[#3390ec]">"diseño"</strong>, o <strong className="text-[#3390ec]">"creador"</strong> para respuestas dinámicas.
            </p>
          </div>
        )}

        {/* Actual conversational balloons with long press and click fallbacks for reactions */}
        {chat.messages.length === 0 ? (
          <div className="text-center text-slate-400 text-xs py-8">
            No hay mensajes anteriores coincidiendo. Envía uno.
          </div>
        ) : (
          chat.messages.map((msg) => {
            const isMe = msg.sender === 'me';
            const messageReaction = reactions[msg.id];
            
            return (
              <div 
                key={msg.id}
                className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} anim-fade-in relative py-1`}
              >
                {/* Floating reaction picker bar */}
                {activeMessageIdForReaction === msg.id && (
                  <div className="absolute -top-10 z-40 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full shadow-lg px-3 py-1.5 flex gap-3 anim-scale-up select-none max-w-max left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0">
                    {['👍', '❤️', '😂', '😮', '🔥'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReactions(prev => ({ ...prev, [msg.id]: emoji }));
                          setActiveMessageIdForReaction(null);
                        }}
                        className="hover:scale-130 hover:rotate-6 transition-transform cursor-pointer text-lg active:scale-90"
                      >
                        {emoji}
                      </button>
                    ))}
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMessageIdForReaction(null);
                      }}
                      className="text-slate-350 hover:text-slate-500 hover:scale-110 ml-0.5"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <MessageBubble
                  msg={msg}
                  isMe={isMe}
                  chatStyle={chatStyle}
                  messageReaction={messageReaction}
                  onMouseDown={() => handlePressStart(msg.id)}
                  onMouseUp={handlePressEnd}
                  onMouseLeave={handlePressEnd}
                  onTouchStart={() => handleTouchStart(msg.id)}
                  onTouchEnd={handleTouchEnd}
                  onDoubleClick={() => setActiveMessageIdForReaction(msg.id)}
                />
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Message Input Panel with customized Intelligent Attachment Menu */}
      <div className="bg-white p-3 border-t border-slate-100 flex-shrink-0 z-20 shadow-[0_-2px_12px_rgba(0,0,0,0.02)] relative">
        {showStatusAlert && (
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-xs px-4 py-2 rounded-full whitespace-nowrap shadow-lg z-50">
            {showStatusAlert}
          </div>
        )}
        <form onSubmit={handleSend} className="max-w-md mx-auto flex items-center gap-2 relative">
          
          {/* Attachment Grid Popover Panel (Style Telegram Clean) */}
          {showAttachMenu && (
            <div className="absolute bottom-14 left-0 bg-white rounded-3xl shadow-2xl p-4.5 w-64 border border-slate-100 z-50 anim-scale-up">
              <div className="flex items-center justify-between mb-3 border-b border-slate-50 pb-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">Compartir información</span>
                <button 
                  type="button"
                  onClick={() => setShowAttachMenu(false)}
                  className="text-slate-400 hover:text-slate-600 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="grid grid-cols-3 gap-y-4 gap-x-1 select-none">
                {/* 1. Galería */}
                <button 
                  type="button"
                  onClick={() => {
                    const selectEl = document.createElement('input');
                    selectEl.type = 'file';
                    selectEl.accept = 'image/*,video/*';
                    selectEl.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) setSelectedFileForEdit(file);
                    };
                    selectEl.click();
                    setShowAttachMenu(false);
                  }}
                  className="flex flex-col items-center gap-1 group focus:outline-none"
                >
                  <div className="w-11 h-11 bg-[#3390ec] text-white rounded-full flex items-center justify-center transition-transform active:scale-90 group-hover:scale-105 shadow-md shadow-blue-100">
                    <Image className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 mt-0.5">Galería</span>
                </button>

                {/* 2. Documento */}
                <button 
                  type="button"
                  onClick={() => {
                    alert("Documentos y archivos locales abiertos (Simulado)");
                    setShowAttachMenu(false);
                  }}
                  className="flex flex-col items-center gap-1 group focus:outline-none"
                >
                  <div className="w-11 h-11 bg-orange-500 text-white rounded-full flex items-center justify-center transition-transform active:scale-90 group-hover:scale-105 shadow-md shadow-orange-100">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 mt-0.5">Documento</span>
                </button>

                {/* 3. Música */}
                <button 
                  type="button"
                  onClick={() => {
                    alert("Librería de pistas de audio abierta (Simulado)");
                    setShowAttachMenu(false);
                  }}
                  className="flex flex-col items-center gap-1 group focus:outline-none"
                >
                  <div className="w-11 h-11 bg-purple-500 text-white rounded-full flex items-center justify-center transition-transform active:scale-90 group-hover:scale-105 shadow-md shadow-purple-100">
                    <Music className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 mt-0.5">Música</span>
                </button>

                {/* 4. Cámara */}
                <button 
                  type="button"
                  onClick={() => {
                    setSelectedFileForEdit(new File([""], "camara_mock.jpg", { type: "image/jpeg" }));
                    setShowAttachMenu(false);
                  }}
                  className="flex flex-col items-center gap-1 group focus:outline-none"
                >
                  <div className="w-11 h-11 bg-red-500 text-white rounded-full flex items-center justify-center transition-transform active:scale-90 group-hover:scale-105 shadow-md shadow-red-100">
                    <Camera className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 mt-0.5">Cámara</span>
                </button>

                {/* 5. Video */}
                <button 
                  type="button"
                  onClick={() => {
                    setSelectedFileForEdit(new File([""], "clip_sunset.mp4", { type: "video/mp4" }));
                    setShowAttachMenu(false);
                  }}
                  className="flex flex-col items-center gap-1 group focus:outline-none"
                >
                  <div className="w-11 h-11 bg-pink-500 text-white rounded-full flex items-center justify-center transition-transform active:scale-90 group-hover:scale-105 shadow-md shadow-pink-100">
                    <Video className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 mt-0.5">Video</span>
                </button>

                {/* 6. Ubicación */}
                <button 
                  type="button"
                  onClick={() => {
                    alert("GPS y coordenadas compartidas con éxito (Simulado)");
                    setShowAttachMenu(false);
                  }}
                  className="flex flex-col items-center gap-1 group focus:outline-none"
                >
                  <div className="w-11 h-11 bg-emerald-500 text-white rounded-full flex items-center justify-center transition-transform active:scale-90 group-hover:scale-105 shadow-md shadow-emerald-100">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 mt-0.5">Ubicación</span>
                </button>
              </div>
            </div>
          )}

          {/* Hidden file selector input connected to the paperclip and system */}
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileSelected} 
            accept="image/*,video/*" 
          />

          {/* Plus icon to open details popover */}
          <button 
            type="button" 
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            className={`p-1 bg-slate-100 text-slate-500 hover:text-[#3390ec] rounded-full transition-all cursor-pointer ${
              showAttachMenu ? 'rotate-45 text-[#3390ec]' : ''
            }`}
            title="Más opciones de adjuntos"
          >
            <Plus className="w-4.5 h-4.5" />
          </button>

          {/* Paperclip attach trigger directly opens the native selector to route to our smart MediaEditor */}
          <button 
            type="button" 
            onClick={() => {
              fileInputRef.current?.click();
            }}
            className="p-2.5 rounded-full transition-all cursor-pointer text-slate-400 hover:text-slate-600 hover:bg-slate-50 relative"
            title="Adjuntar y editar archivo"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Text Input area */}
          <div className="flex-1 relative flex items-center select-none">
            <input 
              type="text" 
              placeholder={isRecording ? 'Grabando...' : 'Escribe un mensaje...'}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isRecording}
              className="w-full bg-[#f0f2f5] text-slate-800 placeholder-slate-400 text-sm pl-4 pr-10 py-2.5 rounded-2xl border border-transparent focus:outline-none focus:bg-white focus:border-brand/20 transition-all focus:shadow-[0_1px_4px_rgba(43,126,251,0.05)] disabled:opacity-50"
            />
            {!isRecording && (
              <div className="absolute right-3">
                <button 
                  type="button" 
                  onClick={() => setShowStickerPicker(!showStickerPicker)}
                  className="text-slate-400 hover:text-brand cursor-pointer relative"
                  title="Emojis, stickers y GIFs"
                >
                  <Smile className="w-5 h-5" />
                </button>
                <AnimatePresence>
                  {showStickerPicker && (
                    <StickerPicker
                      onSelectEmoji={(emoji) => { setInputText(prev => prev + emoji); setShowStickerPicker(false); }}
                      onSelectSticker={(url) => { onSendMessage(chat.id, `🖼️ [Sticker](${url})`); setShowStickerPicker(false); }}
                      onSelectGif={(url) => { onSendMessage(chat.id, `🎬 [GIF](${url})`); setShowStickerPicker(false); }}
                      onClose={() => setShowStickerPicker(false)}
                    />
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Voice note button or Send */}
          {inputText.trim() ? (
            <button 
              type="submit"
              className="p-2.5 text-white rounded-full transition-all focus:outline-none cursor-pointer flex items-center justify-center bg-[#3390ec] hover:bg-[#2b7bc9] shadow-[0_2px_6px_rgba(51,144,236,0.25)] active:scale-95"
              title="Enviar mensaje"
            >
              <Send className="w-4.5 h-4.5" />
            </button>
          ) : micPermissionDenied ? (
            <button 
              type="button"
              onClick={requestMicPermission}
              className="p-2.5 rounded-full bg-amber-500 text-white hover:bg-amber-600 shadow-[0_2px_6px_rgba(245,158,11,0.25)] transition-all cursor-pointer flex items-center justify-center"
              title="Reintentar permiso de micrófono"
            >
              <Mic className="w-4.5 h-4.5" />
            </button>
          ) : (
            <button 
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`p-2.5 rounded-full transition-all cursor-pointer flex items-center justify-center ${
                isRecording 
                  ? 'bg-red-500 text-white shadow-[0_2px_6px_rgba(239,68,68,0.25)] animate-pulse' 
                  : 'bg-[#3390ec] text-white hover:bg-[#2b7bc9] shadow-[0_2px_6px_rgba(51,144,236,0.25)]'
              }`}
              title={isRecording ? 'Detener grabación' : 'Nota de voz'}
            >
              {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4.5 h-4.5" />}
            </button>
          )}
        </form>
      </div>

      {/* Info/Metadata slide-over screen detailing user coordinates */}
      {showInfoPanel && (
        <div className="absolute inset-0 bg-slate-900/35 backdrop-blur-xs z-30 flex justify-end transition-all anim-fade-in">
          <div className="w-[85%] max-w-sm bg-[#f0f2f5] h-full flex flex-col shadow-2xl anim-slide-left relative">
            
            {/* Panel Header */}
            <div className="bg-white p-4 border-b border-slate-100 flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              <h3 className="text-slate-900 font-semibold text-sm">Información de Contacto</h3>
              <button 
                onClick={() => setShowInfoPanel(false)}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-50 rounded-full cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Panel Body */}
            <div className="p-4 flex-1 overflow-y-auto space-y-4">
              
              {/* Profile card */}
              <div className="bg-white p-5 rounded-2xl text-center shadow-[0_1px_2.5px_rgba(0,0,0,0.04)] ring-1 ring-slate-100/50">
                <div className="relative inline-block mx-auto">
                  {chat.avatar ? (
                    <img 
                      src={chat.avatar} 
                      alt={chat.name} 
                      className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-sm"
                    />
                  ) : (
                    <div className={`w-20 h-20 rounded-full ${chat.avatarColor || 'bg-slate-400'} text-white font-bold text-xl flex items-center justify-center border-2 border-white shadow-sm`}>
                      {getInitials(chat.name)}
                    </div>
                  )}
                  {chat.isOnline && (
                    <span className="absolute bottom-0.5 right-0.5 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" />
                  )}
                </div>

                <h4 className="text-slate-900 font-bold mt-3 text-base leading-tight">{chat.name}</h4>
                <p className="text-slate-400 text-xs mt-0.5">{chat.username}</p>
                <span className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  chat.isOnline ? 'bg-emerald-550/10 text-emerald-600 bg-emerald-50' : 'bg-slate-100 text-slate-500'
                }`}>
                  {chat.isOnline ? 'En línea ahora' : 'De viaje'}
                </span>
              </div>

              {/* Details sections */}
              <div className="bg-white rounded-3xl p-5 shadow-[0_1px_2.5px_rgba(0,0,0,0.04)] space-y-4">
                
                {/* Phone */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-50/80 text-[#3390ec] flex-shrink-0 flex items-center justify-center">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-slate-450 text-[10px] uppercase tracking-wider font-bold block">Teléfono móvil</span>
                    <span className="text-slate-800 text-xs font-semibold mt-0.5 block">{chat.phone}</span>
                  </div>
                </div>

                {/* About bio */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-50/80 text-emerald-600 flex-shrink-0 flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-slate-450 text-[10px] uppercase tracking-wider font-bold block">Biografía</span>
                    <span className="text-slate-700 text-xs font-medium leading-relaxed mt-0.5 block">{chat.bio}</span>
                  </div>
                </div>

                {/* Secure communications */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-50/80 text-indigo-600 flex-shrink-0 flex items-center justify-center">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-slate-450 text-[10px] uppercase tracking-wider font-bold block">Seguridad</span>
                    <span className="text-emerald-650 text-xs font-semibold text-emerald-600 mt-0.5 block">Cifrado de extremo a extremo</span>
                  </div>
                </div>
              </div>

              {/* Notification toggle alert box */}
              <div className="bg-white rounded-2xl p-4 shadow-[0_1px_2.5px_rgba(0,0,0,0.04)] flex items-center justify-between">
                <div>
                  <h5 className="text-slate-800 text-xs font-bold leading-tight">Silenciar notificaciones</h5>
                  <p className="text-slate-400 text-[10px] mt-0.5">Desactiva el sonido para este contacto</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#3390ec]" />
                </label>
              </div>
            </div>
            
            <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-center gap-2">
              <button 
                onClick={() => setShowInfoPanel(false)}
                className="w-full py-2.5 bg-[#3390ec] text-white font-semibold text-xs rounded-xl hover:bg-[#2b7bc9] active:scale-95 transition-all text-center cursor-pointer"
              >
                Cerrar Panel
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 1. Editor de Fondo de Chat */}
      <ChatWallpaper 
        isOpen={isWallpaperOpen}
        onClose={() => setIsWallpaperOpen(false)}
        onSelectWallpaper={(wallpaperClass) => {
          setCurrentWallpaper(wallpaperClass);
          setIsWallpaperOpen(false);
        }}
        currentWallpaper={currentWallpaper}
      />

      {/* 3. Editor de Multimedia */}
      <MediaEditor 
        isOpen={selectedFileForEdit !== null}
        file={selectedFileForEdit}
        onClose={() => setSelectedFileForEdit(null)}
        onSave={(editedFile, caption) => {
          setSelectedFileForEdit(null);
          if (caption) {
            onSendMessage(chat.id, caption);
          } else {
            onSendMessage(chat.id, `📷 [Archivo Multimedia Compartido: ${editedFile.name}]`);
          }
        }}
      />

    </div>
  );
}
