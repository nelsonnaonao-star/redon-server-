import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
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
  Trash2,
  Sticker,
  ArrowUp,
  Play,
  Pause,
  Edit3
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { StickerPicker } from './StickerPicker';
import { ChatWallpaper } from './ChatWallpaper';
import { MediaEditor } from './MediaEditor';
import MessageBubble from './MessageBubble';

interface ChatDetailProps {
  chat: Chat;
  onBack: () => void;
  onSendMessage: (chatId: string, text: string) => void;
  onSendAudioMessage?: (chatId: string, audioBlob: Blob, duration: number) => void;
  onEditMessage?: (messageId: string, newText: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  chatStyle: ChatStyle;
  onStartCall?: (chatId: string, contactId: string, contactName: string, contactAvatar: string, callType: 'audio' | 'video') => void;
}

export default function ChatDetail({ 
  chat, 
  onBack, 
  onSendMessage, 
  onSendAudioMessage,
  onEditMessage,
  onDeleteMessage,
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
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'preview'>('idle');
  const [isLocked, setIsLocked] = useState(false);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingDurationRef = useRef(0);
  const shouldCancelRef = useRef(false);

  // Preview state
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const touchStartYRef = useRef(0);
  const lockTriggeredRef = useRef(false);
  const BAR_COUNT = 28;
  const barConfigsRef = useRef<Array<{minH: number; maxH: number; duration: number; delay: number}>>(undefined);
  if (!barConfigsRef.current) {
    barConfigsRef.current = Array.from({ length: BAR_COUNT }, () => ({
      minH: 10 + Math.random() * 22,
      maxH: 48 + Math.random() * 42,
      duration: 0.08 + Math.random() * 0.22,
      delay: Math.random() * 0.5,
    }));
  }
  const barConfigs = barConfigsRef.current;

  const startRecording = async (isTouch = false) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      triggerAlert('Tu dispositivo no soporta grabación de audio en esta versión.');
      return;
    }
    if (isTouch) {
      touchStartYRef.current = 0;
      lockTriggeredRef.current = false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermissionDenied(false);
      audioStreamRef.current = stream;
      audioChunksRef.current = [];
      recordingDurationRef.current = 0;
      shouldCancelRef.current = false;
      setRecordingDuration(0);
      setIsLocked(false);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => track.stop());
          audioStreamRef.current = null;
        }
        if (shouldCancelRef.current) {
          audioChunksRef.current = [];
          setRecordingDuration(0);
          setRecordingState('idle');
          shouldCancelRef.current = false;
          return;
        }
        // Normal finish: dataavailable fired BEFORE onstop, so chunks are populated
        const chunks = audioChunksRef.current;
        if (chunks.length === 0) {
          setRecordingState('idle');
          return;
        }
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setPreviewBlob(blob);
        setPreviewUrl(url);
        setPreviewCurrentTime(0);
        setIsPlayingPreview(false);
        setRecordingState('preview');
      };

      mediaRecorder.start();
      setRecordingState('recording');

      recordingIntervalRef.current = setInterval(() => {
        recordingDurationRef.current += 1;
        setRecordingDuration(recordingDurationRef.current);
      }, 1000);
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

  // finishRecording just triggers stop(); onstop handler creates blob + transitions to preview
  const finishRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
    shouldCancelRef.current = false;
    mediaRecorderRef.current.stop();
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      shouldCancelRef.current = true;
      mediaRecorderRef.current.stop();
    } else {
      setRecordingState('idle');
      audioChunksRef.current = [];
      setRecordingDuration(0);
    }
  };

  const handleTouchStartOnMic = (e: React.TouchEvent | React.MouseEvent) => {
    if ('touches' in e) {
      touchStartYRef.current = e.touches[0].clientY;
    }
    lockTriggeredRef.current = false;
    startRecording(true);
  };
  
  const handleTouchMoveOnMic = (e: React.TouchEvent) => {
    if (!lockTriggeredRef.current && e.touches[0].clientY < touchStartYRef.current - 60) {
      lockTriggeredRef.current = true;
      setIsLocked(true);
    }
  };
  
  // useLayoutEffect: registers listeners synchronously after DOM commit, before any
  // mouseup/touchend can fire. Catches the release even after mic button is unmounted.
  useLayoutEffect(() => {
    if (recordingState !== 'recording') return;
    const onRelease = () => {
      if (lockTriggeredRef.current) return; // locked → stop button handles it
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        finishRecording();
      }
    };
    document.addEventListener('mouseup', onRelease);
    document.addEventListener('touchend', onRelease);
    return () => {
      document.removeEventListener('mouseup', onRelease);
      document.removeEventListener('touchend', onRelease);
    };
  }, [recordingState]);

  const handleStopLockedRecording = () => {
    finishRecording();
  };

  // Preview controls
  const handleTogglePreviewPlayback = () => {
    if (!previewUrl) return;
    if (previewAudioRef.current) {
      if (previewAudioRef.current.paused) {
        previewAudioRef.current.play().catch(() => {});
        setIsPlayingPreview(true);
      } else {
        previewAudioRef.current.pause();
        setIsPlayingPreview(false);
      }
      return;
    }
    const audio = new Audio(previewUrl);
    previewAudioRef.current = audio;
    audio.addEventListener('timeupdate', () => {
      setPreviewCurrentTime(audio.currentTime);
    });
    audio.addEventListener('ended', () => {
      setIsPlayingPreview(false);
      setPreviewCurrentTime(0);
    });
    audio.play().catch(() => {});
    setIsPlayingPreview(true);
  };

  const handleCancelPreview = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewBlob(null);
    setPreviewUrl(null);
    setPreviewCurrentTime(0);
    setIsPlayingPreview(false);
    setRecordingState('idle');
  };

  const handleSendPreviewAudio = () => {
    if (previewBlob && onSendAudioMessage) {
      onSendAudioMessage(chat.id, previewBlob, recordingDurationRef.current);
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewBlob(null);
    setPreviewUrl(null);
    setPreviewCurrentTime(0);
    setIsPlayingPreview(false);
    setRecordingState('idle');
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

  // Edit message state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState('');

  // Context menu state
  const [contextMenuMsgId, setContextMenuMsgId] = useState<string | null>(null);

  // Popover states for reactions
  const [activeMessageIdForReaction, setActiveMessageIdForReaction] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const timerRef = useRef<any>(null);

  const handlePressStart = (msgId: string, isOwn: boolean) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (isOwn) {
        setContextMenuMsgId(msgId);
      } else {
        setActiveMessageIdForReaction(msgId);
      }
    }, 500); // 500ms long press detect
  };

  const handlePressEnd = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };

  const handleTouchStart = (msgId: string, isOwn: boolean) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (isOwn) {
        setContextMenuMsgId(msgId);
      } else {
        setActiveMessageIdForReaction(msgId);
      }
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

    if (editingMessageId) {
      if (onEditMessage) {
        onEditMessage(editingMessageId, query);
      }
      setEditingMessageId(null);
      setEditingMessageText('');
      setInputText('');
      return;
    }

    onSendMessage(chat.id, query);
    setInputText('');
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingMessageText('');
    setInputText('');
  };

  const handleContextMenu = (e: React.MouseEvent, msgId: string, isOwn: boolean) => {
    e.preventDefault();
    if (isOwn) {
      setContextMenuMsgId(msgId);
    }
  };

  const handleStartEditMessage = () => {
    if (!contextMenuMsgId) return;
    const msg = chat.messages.find(m => m.id === contextMenuMsgId);
    if (!msg) return;
    setInputText(msg.text);
    setEditingMessageId(msg.id);
    setEditingMessageText(msg.text);
    setContextMenuMsgId(null);
  };

  const handleDeleteForEveryone = () => {
    if (!contextMenuMsgId) return;
    if (onDeleteMessage) {
      onDeleteMessage(contextMenuMsgId);
    }
    setContextMenuMsgId(null);
  };

  const handleCloseContextMenu = () => {
    setContextMenuMsgId(null);
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
            onClick={() => onStartCall?.(chat.id, chat.profileId || '', chat.name, chat.avatar, 'audio')}
            className="p-2 hover:bg-slate-50 active:scale-95 hover:text-slate-800 rounded-full cursor-pointer transition-colors"
            title="Llamar"
          >
            <Phone className="w-4.5 h-4.5" />
          </button>
          <button 
            onClick={() => onStartCall?.(chat.id, chat.profileId || '', chat.name, chat.avatar, 'video')}
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
        className={`flex-1 overflow-y-auto px-4 py-4 space-y-3.5 transition-all duration-300 bg-fixed bg-cover bg-center bg-no-repeat ${
          chatStyle.bubbleBackground ? '' : (currentWallpaper.startsWith('custom-img:[') ? '' : currentWallpaper)
        }`}
        style={
          chatStyle.bubbleBackground 
            ? { backgroundImage: `url(${chatStyle.bubbleBackground})` }
            : currentWallpaper.startsWith('custom-img:[') 
              ? { backgroundImage: `url(${currentWallpaper.substring(currentWallpaper.indexOf('[') + 1, currentWallpaper.lastIndexOf(']'))})` } 
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
          chat.messages.map((msg, idx) => {
            const isMe = msg.sender === 'me';
            const messageReaction = reactions[msg.id];
            
            const getDateLabel = (timeStr: string): string | null => {
              const d = new Date(timeStr);
              if (isNaN(d.getTime())) return null;
              const now = new Date();
              const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              const yesterday = new Date(today);
              yesterday.setDate(yesterday.getDate() - 1);
              const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
              if (msgDate.getTime() === today.getTime()) return 'Hoy';
              if (msgDate.getTime() === yesterday.getTime()) return 'Ayer';
              return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            };

            const prevMsg = idx > 0 ? chat.messages[idx - 1] : null;
            const showDateDivider = (() => {
              if (idx === 0) return true;
              if (!prevMsg) return false;
              const currDate = new Date(msg.time);
              const prevDate = new Date(prevMsg.time);
              if (isNaN(currDate.getTime()) || isNaN(prevDate.getTime())) return false;
              return currDate.toDateString() !== prevDate.toDateString();
            })();
            const dateLabel = showDateDivider ? getDateLabel(msg.time) : null;

            return (
              <React.Fragment key={msg.id}>
              {dateLabel && (
                <div className="flex justify-center my-2">
                  <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 bg-white/80 dark:bg-slate-800/80 px-3 py-1 rounded-full shadow-sm backdrop-blur-sm">
                    {dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}
                  </span>
                </div>
              )}
              <div 
                className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} anim-fade-in relative py-1`}
                onContextMenu={(e) => handleContextMenu(e, msg.id, isMe)}
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
                  onMouseDown={() => handlePressStart(msg.id, isMe)}
                  onMouseUp={handlePressEnd}
                  onMouseLeave={handlePressEnd}
                  onTouchStart={() => handleTouchStart(msg.id, isMe)}
                  onTouchEnd={handleTouchEnd}
                  onDoubleClick={() => setActiveMessageIdForReaction(msg.id)}
                />
              </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Message Input Panel */}
      <div className="bg-white p-3 pb-5 border-t border-slate-100 flex-shrink-0 z-20 shadow-[0_-2px_12px_rgba(0,0,0,0.02)] relative">
        {showStatusAlert && (
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-xs px-4 py-2 rounded-full whitespace-nowrap shadow-lg z-50">
            {showStatusAlert}
          </div>
        )}

        {/* Edit banner */}
        {editingMessageId && (
          <div className="mb-2 px-3 py-1.5 bg-brand-light/50 dark:bg-slate-800 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Edit3 className="w-3.5 h-3.5 text-brand" />
              <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">Editando mensaje...</span>
            </div>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="p-1 hover:bg-white/50 dark:hover:bg-slate-700 rounded-full transition-all cursor-pointer"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        )}

        {/* Recording Panel — press-and-hold UX */}
        {recordingState === 'recording' ? (
          <div className="max-w-md mx-auto flex items-center gap-3 px-1" onTouchMove={handleTouchMoveOnMic}>
            <button
              type="button"
              onClick={cancelRecording}
              className="p-2 rounded-full text-red-500 hover:bg-red-50 transition-all cursor-pointer active:scale-90"
              title="Cancelar grabación"
            >
              <Trash2 className="w-5 h-5" />
            </button>

            {/* Ultra-fluid waveform visualizer */}
            <div className="flex-1 flex items-end justify-center gap-[3px] h-10">
              {barConfigs.map((cfg, i) => (
                <motion.div
                  key={i}
                  className="w-[2.5px] rounded-full"
                  style={{ background: 'linear-gradient(to top, #ff2d55, #ff453a)' }}
                  animate={{
                    height: [cfg.minH + '%', cfg.maxH + '%', cfg.minH + '%'],
                  }}
                  transition={{
                    duration: cfg.duration,
                    repeat: Infinity,
                    repeatType: 'reverse',
                    delay: cfg.delay,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </div>

            {/* Timer */}
            <span className="text-sm font-mono font-bold text-red-500 min-w-[48px] text-center">
              {String(Math.floor(recordingDuration / 60)).padStart(2, '0')}:{String(recordingDuration % 60).padStart(2, '0')}
            </span>

            {/* Lock indicator or Stop button */}
            {isLocked ? (
              <button
                type="button"
                onClick={handleStopLockedRecording}
                className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 shadow-md active:scale-90 transition-all cursor-pointer"
                title="Detener grabación"
              >
                <Square className="w-5 h-5 fill-current" />
              </button>
            ) : (
              <div className="flex flex-col items-center">
                <ArrowUp className="w-4 h-4 text-slate-400 animate-bounce" />
                <span className="text-[9px] text-slate-400 font-medium whitespace-nowrap leading-none">Desliza ↑</span>
              </div>
            )}
          </div>
        ) : recordingState === 'preview' ? (
          <div className="max-w-md mx-auto flex items-center gap-2 px-1">
            {/* Cancel/Trash */}
            <button
              type="button"
              onClick={handleCancelPreview}
              className="p-2 rounded-full text-red-500 hover:bg-red-50 transition-all cursor-pointer active:scale-90"
              title="Eliminar nota de voz"
            >
              <Trash2 className="w-5 h-5" />
            </button>

            {/* Play/Pause button */}
            <button
              type="button"
              onClick={handleTogglePreviewPlayback}
              className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-[#3390ec] text-white hover:bg-[#2b7bc9] shadow-[0_2px_6px_rgba(51,144,236,0.25)] active:scale-95 transition-all cursor-pointer"
              title={isPlayingPreview ? 'Pausar' : 'Escuchar'}
            >
              {isPlayingPreview ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
            </button>

            {/* Mini progress bar + Timer */}
            <div className="flex-1 flex flex-col gap-0.5 min-w-0">
              <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#3390ec] rounded-full transition-all duration-300"
                  style={{ width: `${recordingDuration > 0 ? (previewCurrentTime / recordingDuration) * 100 : 0}%` }}
                />
              </div>
              <span className="text-[10px] font-mono font-medium text-slate-400 text-right">
                {String(Math.floor(previewCurrentTime / 60)).padStart(2, '0')}:{String(Math.floor(previewCurrentTime % 60)).padStart(2, '0')} / {String(Math.floor(recordingDuration / 60)).padStart(2, '0')}:{String(recordingDuration % 60).padStart(2, '0')}
              </span>
            </div>

            {/* Send button */}
            <button
              type="button"
              onClick={handleSendPreviewAudio}
              className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-[#3390ec] text-white hover:bg-[#2b7bc9] shadow-[0_2px_6px_rgba(51,144,236,0.25)] active:scale-95 transition-all cursor-pointer"
              title="Enviar nota de voz"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="max-w-md mx-auto flex items-center gap-1.5 min-w-0 relative">
            
            {/* Sticker/Emoji/GIF Picker */}
            <AnimatePresence>
              {showStickerPicker && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50">
                  <StickerPicker
                    onSelectEmoji={(emoji) => { setInputText(prev => prev + emoji); setShowStickerPicker(false); }}
                    onSelectSticker={(url) => { onSendMessage(chat.id, `🖼️ [Sticker](${url})`); setShowStickerPicker(false); }}
                    onSelectGif={(url) => { onSendMessage(chat.id, `🎬 [GIF](${url})`); setShowStickerPicker(false); }}
                    onClose={() => setShowStickerPicker(false)}
                  />
                </div>
              )}
            </AnimatePresence>

            {/* Attachment Grid Popover Panel */}
            {showAttachMenu && (
              <div className="absolute bottom-14 left-1/2 -translate-x-1/2 md:left-0 md:translate-x-0 bg-white rounded-3xl shadow-2xl p-4.5 w-64 border border-slate-100 z-50 anim-scale-up">
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

            {/* Plus / Attach button — fixed size */}
            <button
              type="button"
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full transition-all cursor-pointer text-slate-400 hover:text-[#3390ec] active:scale-90"
              title="Más opciones de adjuntos"
            >
              <Plus className={`w-5 h-5 transition-transform ${showAttachMenu ? 'rotate-45' : ''}`} />
            </button>

            {/* Text Input */}
            <div className="flex-1 min-w-0 relative flex items-center bg-[#f0f2f5] rounded-2xl border border-transparent focus-within:bg-white focus-within:border-brand/20 transition-all focus-within:shadow-[0_1px_4px_rgba(43,126,251,0.05)]">
              <input
                type="text"
                placeholder="Escribe un mensaje..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 bg-transparent text-slate-800 placeholder-slate-400 text-sm px-3 py-2.5 focus:outline-none"
              />
            </div>

            {/* Smiley / Sticker button — fixed size */}
            <button
              type="button"
              onClick={() => setShowStickerPicker(!showStickerPicker)}
              className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full transition-all cursor-pointer text-slate-400 hover:text-brand active:scale-90"
              title="Emojis, stickers y GIFs"
            >
              <Smile className="w-5 h-5" />
            </button>

            {/* Send or Mic button — fixed size */}
            {inputText.trim() ? (
              <button
                type="submit"
                className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-[#3390ec] text-white hover:bg-[#2b7bc9] shadow-[0_2px_6px_rgba(51,144,236,0.25)] active:scale-95 transition-all cursor-pointer"
                title="Enviar mensaje"
              >
                <Send className="w-5 h-5" />
              </button>
            ) : micPermissionDenied ? (
              <button
                type="button"
                onClick={requestMicPermission}
                className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-amber-500 text-white hover:bg-amber-600 shadow-[0_2px_6px_rgba(245,158,11,0.25)] transition-all cursor-pointer"
                title="Reintentar permiso de micrófono"
              >
                <Mic className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="button"
                onMouseDown={(e) => handleTouchStartOnMic(e)}
                onTouchStart={(e) => handleTouchStartOnMic(e)}
                className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-[#3390ec] text-white hover:bg-[#2b7bc9] shadow-[0_2px_6px_rgba(51,144,236,0.25)] active:scale-95 transition-all cursor-pointer select-none"
                title="Mantén pulsado para grabar, desliza arriba para bloquear"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </form>
        )}
      </div>

      {/* Info/Metadata slide-over screen detailing user coordinates */}
      {showInfoPanel && (
        <div className="fixed inset-0 w-full h-full z-50 bg-white flex flex-col animate-fade-in">
          
          {/* Panel Header */}
          <div className="bg-white p-4 border-b border-slate-100 flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <h3 className="text-slate-900 font-semibold text-sm">Información de Contacto</h3>
            <button 
              onClick={() => setShowInfoPanel(false)}
              className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-50 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Panel Body */}
          <div className="flex-1 overflow-y-auto bg-[#f0f2f5] p-4 space-y-4">
            
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
          
          {/* Panel Footer */}
          <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-center gap-2">
            <button 
              onClick={() => setShowInfoPanel(false)}
              className="w-full py-2.5 bg-[#3390ec] text-white font-semibold text-xs rounded-xl hover:bg-[#2b7bc9] active:scale-95 transition-all text-center cursor-pointer"
            >
              Cerrar Panel
            </button>
          </div>

        </div>
      )}

      {/* Context Menu (message actions) */}
      {contextMenuMsgId && (
        <div className="fixed inset-0 z-70 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={handleCloseContextMenu}>
          <div
            className="bg-white dark:bg-slate-800 rounded-t-3xl w-full max-w-md p-6 pb-10 shadow-2xl animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-5" />
            <div className="flex flex-col gap-1">
              <button
                onClick={handleStartEditMessage}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-all cursor-pointer"
              >
                <Edit3 className="w-4 h-4 text-brand" />
                Editar mensaje
              </button>
              <button
                onClick={handleDeleteForEveryone}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar para todos
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
