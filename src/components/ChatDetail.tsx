import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { Chat, Message, ChatStyle } from '../types';
import { supabase } from '../lib/supabase';
import { api } from '../services/api';
import { showToast } from '../services/toastService';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
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
  Edit3,
  MessageCircle,
  Forward,
  Share2,
  Users,
  LogOut,
  Pencil,
  BarChart3,
  PlusCircle,
  CheckSquare
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { StickerPicker } from './StickerPicker';
import { ChatWallpaper } from './ChatWallpaper';
import { BubbleColorPicker } from './BubbleColorPicker';
import { getPatternStyle } from '../data/patternPresets';
import MessageBubble from './MessageBubble';
import { compressImage } from '../services/imageCompression';
import { QRCodeSVG } from 'qrcode.react';

interface ChatDetailProps {
  chat: Chat;
  userId: string;
  chatList: Chat[];
  onBack: () => void;
  onSendMessage: (chatId: string, text: string, replyTo?: { replyToId: string; replyToText: string; replyToSender: string }, isEphemeral?: boolean, pollId?: string, stickerOptions?: { stickerUrl: string; isAnimated?: boolean } | { gifUrl: string }, mediaOptions?: { imageUrl?: string; videoUrl?: string }) => void;
  onSendAudioMessage?: (chatId: string, audioBlob: Blob, duration: number) => void;
  onEditMessage?: (messageId: string, newText: string) => void;
  onDeleteMessage?: (messageId: string) => void;
  chatStyle: ChatStyle;
  onUpdateChatStyle?: (updated: ChatStyle) => void;
  onStartCall?: (chatId: string, contactId: string, contactName: string, contactAvatar: string, callType: 'audio' | 'video') => void;
  isContactSaved?: boolean;
  savingPhone?: string | null;
  onSaveContact?: (phone: string, name: string) => void;
  onRejectContact?: (chatId: string) => void;
  onDeleteChat?: (chatId: string) => void;
  onChatUpdated?: (chat: Chat) => void;
}

export default function ChatDetail({ 
  chat, 
  userId,
  chatList,
  onBack, 
  onSendMessage, 
  onSendAudioMessage,
  onEditMessage,
  onDeleteMessage,
  chatStyle,
  onUpdateChatStyle,
  onStartCall,
  isContactSaved,
  savingPhone,
  onSaveContact,
  onRejectContact,
  onDeleteChat,
  onChatUpdated
}: ChatDetailProps) {
  const [inputText, setInputText] = useState('');
  const [isEphemeralMode, setIsEphemeralMode] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [groupMembers, setGroupMembers] = useState<{ id: string; name: string; avatar: string }[]>([]);
  const [isEditingGroupName, setIsEditingGroupName] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Dynamic customization states
  const [isWallpaperOpen, setIsWallpaperOpen] = useState(false);
  const [isBubbleColorOpen, setIsBubbleColorOpen] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [currentWallpaper, setCurrentWallpaper] = useState('');
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollTitle, setPollTitle] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollMultipleChoice, setPollMultipleChoice] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [showInviteQR, setShowInviteQR] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [partnerRecording, setPartnerRecording] = useState(false);
  const [isSendingVideo, setIsSendingVideo] = useState(false);
  const presenceChanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── BUBBLE COLOR PERSISTENCE ───
  // chatStyle prop is the source of truth, synced from App.tsx
  // MessageBubble uses chatStyle.partnerBubbleColor directly

  // ─── GROUP MEMBERS FETCH ───
  useEffect(() => {
    if (showInfoPanel && chat.isGroup) {
      api.getGroupMembers(chat.id).then(setGroupMembers);
      setGroupNameInput(chat.name);
    }
  }, [showInfoPanel, chat.isGroup, chat.id]);

  // ─── LOCAL MESSAGES STATE ───
  const [localMessages, setLocalMessages] = useState<Message[]>(chat.messages);
  const prevChatIdRef = useRef(chat.id);
  const deletedIdsRef = useRef<Set<string>>(new Set());

  // Reset localMessages only when chat ID changes
  useEffect(() => {
    if (prevChatIdRef.current !== chat.id) {
      setLocalMessages(chat.messages);
      prevChatIdRef.current = chat.id;
      deletedIdsRef.current = new Set();
    }
  }, [chat.id]);

  // Sync NEW messages from chat.messages into localMessages (skip deleted + dedup own messages by content)
  useEffect(() => {
    setLocalMessages(prev => {
      const existingIds = new Set(prev.map(m => m.id));
      const existingKeys = new Set(prev.map(m => `${m.text}|${m.sender}|${m.time}`));
      const toAdd = chat.messages.filter(m => {
        if (existingIds.has(m.id)) return false;
        if (deletedIdsRef.current.has(m.id)) return false;
        if (existingKeys.has(`${m.text}|${m.sender}|${m.time}`)) return false;
        return true;
      });
      if (toAdd.length === 0) return prev;
      return [...prev, ...toAdd];
    });
  }, [chat.messages]);

  // ─── REALTIME SUBSCRIPTION (INSERT/DELETE) ───
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`chat-detail-${chat.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chat.id}` },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const msg = payload.new;
          if (msg.sender_id === userId) return;
          setLocalMessages(prev => {
            if (prev.find(m => m.id === msg.id)) return prev;
            return [...prev, {
              id: msg.id,
              sender: 'them' as const,
              text: msg.text || '',
              time: msg.created_at || new Date().toISOString(),
              status: 'delivered' as const,
              isDeleted: false,
              audioUrl: msg.audio_url || undefined,
              audioDuration: msg.audio_duration || undefined,
              mimeType: msg.mime_type || undefined,
              imageUrl: msg.image_url || undefined,
              videoUrl: msg.video_url || undefined,
              stickerUrl: msg.sticker_url || undefined,
              gifUrl: msg.gif_url || undefined,
              isAnimated: msg.is_animated || undefined,
            }];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chat.id}` },
        (payload: RealtimePostgresChangesPayload<any>) => {
          const oldMsg = payload.old as { id?: string } | undefined;
          if (!oldMsg?.id) return;
          deletedIdsRef.current.add(oldMsg.id);
          setLocalMessages(prev => prev.filter(m => m.id !== oldMsg.id));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, chat.id]);

  // ─── MARK DELIVERED + READ ON MOUNT ───
  useEffect(() => {
    if (!chat?.id || !userId) return;
    api.markDelivered(chat.id).catch(() => {});
    api.markRead(chat.id).catch(() => {});
  }, [chat?.id, userId]);

  // ─── MARK DELIVERED + READ WHEN INCOMING MESSAGE APPEARS ───
  useEffect(() => {
    const lastMsg = localMessages[localMessages.length - 1];
    if (lastMsg && lastMsg.sender === 'them') {
      api.markDelivered(chat.id).catch(() => {});
      api.markRead(chat.id).catch(() => {});
    }
  }, [localMessages.length]);

  // ─── TYPING + RECORDING PRESENCE (Realtime Broadcast) ───
  useEffect(() => {
    if (!chat?.id || !userId) return;
    const chan = supabase.channel(`presence-${chat.id}`, {
      config: { broadcast: { self: true } },
    });
    chan.on('broadcast', { event: 'typing' }, (payload) => {
      if (payload.payload.userId !== userId) {
        setPartnerTyping(payload.payload.isTyping);
      }
    });
    chan.on('broadcast', { event: 'recording' }, (payload) => {
      if (payload.payload.userId !== userId) {
        setPartnerRecording(payload.payload.isRecording);
      }
    });
    chan.subscribe();
    presenceChanRef.current = chan;
    return () => {
      supabase.removeChannel(chan);
      presenceChanRef.current = null;
      setPartnerTyping(false);
      setPartnerRecording(false);
    };
  }, [chat?.id, userId]);

  // ─── DELETE MESSAGE ───
  const handleDeleteMessage = useCallback(async (messageId: string) => {
    deletedIdsRef.current.add(messageId);
    setLocalMessages(prev => prev.filter(m => m.id !== messageId));
    onDeleteMessage?.(messageId);
  }, [onDeleteMessage]);

  // ─── BULK SELECTION ───
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());

  const toggleSelectMessage = useCallback((msgId: string) => {
    setSelectedMessageIds(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  }, []);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedMessageIds);
    if (ids.length === 0) return;
    ids.forEach(id => {
      deletedIdsRef.current.add(id);
    });
    setLocalMessages(prev => prev.filter(m => !selectedMessageIds.has(m.id)));
    ids.forEach(id => onDeleteMessage?.(id));
    setIsSelecting(false);
    setSelectedMessageIds(new Set());
  }, [selectedMessageIds, onDeleteMessage]);

  const cancelSelection = useCallback(() => {
    setIsSelecting(false);
    setSelectedMessageIds(new Set());
  }, []);

  const enterSelectionMode = useCallback(() => {
    setContextMenuMsgId(null);
    setIsSelecting(true);
  }, []);

  // Sync currentWallpaper from persisted chatStyle on mount/change
  useEffect(() => {
    if (chatStyle.bubbleBackground && chatStyle.bubbleBackground !== currentWallpaper) {
      setCurrentWallpaper(chatStyle.bubbleBackground);
    }
  }, [chatStyle.bubbleBackground]);

  // ─── COLOR LOGIC REMOVED — bubbles use hardcoded defaults ───

  // Popover state for attachments
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // File input ref for real file uploads
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sticker/Emoji/GIF picker
  const [showStickerPicker, setShowStickerPicker] = useState(false);

  // Voice recording
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'preview'>('idle');
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

  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      triggerAlert('Tu dispositivo no soporta grabación de audio en esta versión.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermissionDenied(false);
      audioStreamRef.current = stream;
      audioChunksRef.current = [];
      recordingDurationRef.current = 0;
      shouldCancelRef.current = false;
      setRecordingDuration(0);

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
      if (presenceChanRef.current) {
        presenceChanRef.current.send({
          type: 'broadcast',
          event: 'recording',
          payload: { userId, isRecording: true },
        });
      }

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
    if (presenceChanRef.current) {
      presenceChanRef.current.send({
        type: 'broadcast',
        event: 'recording',
        payload: { userId, isRecording: false },
      });
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      shouldCancelRef.current = true;
      mediaRecorderRef.current.stop();
    } else {
      setRecordingState('idle');
      audioChunksRef.current = [];
      setRecordingDuration(0);
      shouldCancelRef.current = false;
    }
    if (presenceChanRef.current) {
      presenceChanRef.current.send({
        type: 'broadcast',
        event: 'recording',
        payload: { userId, isRecording: false },
      });
    }
  };

  const handleTouchStartOnMic = () => {
    startRecording();
  };

  // useLayoutEffect: registers listeners synchronously after DOM commit, before any
  // mouseup/touchend can fire. Catches the release even after mic button is unmounted.
  useLayoutEffect(() => {
    if (recordingState !== 'recording') return;
    const onRelease = () => {
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

  const handleSendMedia = async (file: File) => {
    const isVideo = file.type.startsWith('video/');

    if (isVideo) {
      setIsSendingVideo(true);
      const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';
      try {
        const formData = new FormData();
        formData.append('video', file);
        const res = await fetch(`${serverUrl}/api/media/compress-video`, {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        onSendMessage(chat.id, '', undefined, undefined, undefined, undefined, { videoUrl: data.url });
      } catch {
        // Fallback: upload raw video directly to Supabase
        try {
          const ext = file.name.split('.').pop() || 'mp4';
          const fileName = `video-${userId}-${Date.now()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from('chat-images')
            .upload(fileName, file, { contentType: file.type, upsert: false });
          if (uploadError) throw uploadError;
          const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(fileName);
          onSendMessage(chat.id, '', undefined, undefined, undefined, undefined, { videoUrl: urlData.publicUrl });
        } catch {
          onSendMessage(chat.id, `🎥 [Error al enviar video]`);
        }
      } finally {
        setIsSendingVideo(false);
      }
      return;
    }

    // Image path (unchanged)
    const compressed = await compressImage(file).catch(() => file);
    const fileName = `image-${userId}-${Date.now()}.jpg`;
    let publicUrl: string;
    try {
      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(fileName, compressed, { contentType: compressed.type, upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('chat-images').getPublicUrl(fileName);
      publicUrl = urlData.publicUrl;
    } catch {
      try {
        const { error: uploadError2 } = await supabase.storage
          .from('voice-notes')
          .upload(fileName, compressed, { contentType: compressed.type, upsert: false });
        if (uploadError2) throw uploadError2;
        const { data: urlData2 } = supabase.storage.from('voice-notes').getPublicUrl(fileName);
        publicUrl = urlData2.publicUrl;
      } catch {
        onSendMessage(chat.id, `📷 [Error al subir archivo]`);
        return;
      }
    }
    onSendMessage(chat.id, '', undefined, undefined, undefined, undefined, { imageUrl: publicUrl });
  };

  const handleSendLocation = async () => {
    let latitude: number, longitude: number;
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      latitude = pos.coords.latitude;
      longitude = pos.coords.longitude;
    } catch {
      if (!navigator.geolocation) {
        onSendMessage(chat.id, '📍 Ubicación no disponible (GPS no soportado)');
        return;
      }
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
        });
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } catch {
        onSendMessage(chat.id, '📍 Ubicación no disponible (permiso denegado o error de GPS)');
        return;
      }
    }
    const mapsUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
    const text = `📍 [Ubicación compartida](maps:${latitude},${longitude})\n${mapsUrl}`;
    onSendMessage(chat.id, text);
  };

  const handleCreatePoll = async () => {
    if (!pollTitle.trim() || pollOptions.filter(o => o.trim()).length < 2) {
      showToast('Añade un título y al menos 2 opciones', 'error');
      return;
    }
    let pollId: string | undefined;
    try {
      const filteredOptions = pollOptions.filter(o => o.trim());
      pollId = await api.createPoll(pollTitle.trim(), filteredOptions, pollMultipleChoice);
    } catch (err) {
      console.error('[handleCreatePoll] createPoll error:', err);
      showToast('Error al crear encuesta: ' + (err instanceof Error ? err.message : 'desconocido'), 'error');
      return;
    }
    try {
      const text = `📊 ${pollTitle.trim()}`;
      onSendMessage(chat.id, text, undefined, undefined, pollId);
      setShowPollCreator(false);
      setPollTitle('');
      setPollOptions(['', '']);
      setPollMultipleChoice(false);
    } catch (err) {
      console.error('[handleCreatePoll] sendMessage error:', err);
      showToast('Encuesta creada pero no se pudo enviar el mensaje', 'error');
    }
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleSendMedia(file);
    }
  };

  // Edit message state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState('');

  // Context menu state
  const [contextMenuMsgId, setContextMenuMsgId] = useState<string | null>(null);
  const [showForwardPicker, setShowForwardPicker] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<Message | null>(null);
  const [forwardContacts, setForwardContacts] = useState<Chat[]>([]);
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);

  // Popover states for reactions
  const [activeMessageIdForReaction, setActiveMessageIdForReaction] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const timerRef = useRef<any>(null);

  const handlePressStart = (msgId: string, isOwn: boolean) => {
    if (isSelecting) {
      toggleSelectMessage(msgId);
      return;
    }
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
    if (isSelecting) {
      toggleSelectMessage(msgId);
      return;
    }
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
  }, [localMessages]);

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

    const replyData = replyTarget ? {
      replyToId: replyTarget.id,
      replyToText: replyTarget.text,
      replyToSender: replyTarget.sender === 'me' ? 'Tú' : chat.name,
    } : undefined;
    onSendMessage(chat.id, query, replyData, isEphemeralMode);
    setReplyTarget(null);
    setInputText('');
    setIsEphemeralMode(false);
  };

  const toggleEphemeralMode = () => {
    setIsEphemeralMode(prev => !prev);
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
    handleDeleteMessage(contextMenuMsgId);
    setContextMenuMsgId(null);
  };

  const handleReplyToMessage = () => {
    if (!contextMenuMsgId) return;
    const msg = chat.messages.find(m => m.id === contextMenuMsgId);
    if (msg) setReplyTarget(msg);
    setContextMenuMsgId(null);
  };

  // Load contacts when forward picker opens
  useEffect(() => {
    if (showForwardPicker) {
      api.getContacts().then(contacts => setForwardContacts(contacts)).catch(() => {});
    }
  }, [showForwardPicker]);

  const handleOpenForward = () => {
    if (!contextMenuMsgId) return;
    const msg = chat.messages.find(m => m.id === contextMenuMsgId);
    if (msg) { setForwardMsg(msg); setShowForwardPicker(true); }
    setContextMenuMsgId(null);
  };

  const handleForwardToChat = async (targetChatId: string) => {
    if (!forwardMsg) return;
    const prefix = '📨 Reenviado\n';
    const text = forwardMsg.text ? prefix + forwardMsg.text : prefix;
    const stickerOptions = forwardMsg.stickerUrl ? { stickerUrl: forwardMsg.stickerUrl, isAnimated: forwardMsg.isAnimated } as const
      : forwardMsg.gifUrl ? { gifUrl: forwardMsg.gifUrl } as const
      : undefined;
    const mediaOptions = forwardMsg.imageUrl || forwardMsg.videoUrl
      ? { imageUrl: forwardMsg.imageUrl, videoUrl: forwardMsg.videoUrl }
      : undefined;
    const audioOptions = forwardMsg.audioUrl
      ? { audioUrl: forwardMsg.audioUrl, audioDuration: forwardMsg.audioDuration || 0, mimeType: forwardMsg.mimeType || 'audio/webm' }
      : undefined;

    try {
      if (stickerOptions && 'stickerUrl' in stickerOptions) {
        await api.sendMessage(targetChatId, text, undefined, undefined, undefined, undefined, { stickerUrl: stickerOptions.stickerUrl, isAnimated: stickerOptions.isAnimated });
      } else if (stickerOptions && 'gifUrl' in stickerOptions) {
        await api.sendMessage(targetChatId, text, undefined, undefined, undefined, undefined, { gifUrl: stickerOptions.gifUrl });
      } else if (mediaOptions) {
        await api.sendMessage(targetChatId, text, undefined, undefined, undefined, undefined, undefined, mediaOptions);
      } else if (audioOptions) {
        await api.sendMessage(targetChatId, text, audioOptions);
      } else {
        await api.sendMessage(targetChatId, text);
      }
    } catch {}
    setShowForwardPicker(false);
    setForwardMsg(null);
  };

  const handleForwardToContact = async (contactId: string) => {
    if (!forwardMsg) return;
    // Find existing chat for this contact
    const existingChat = chatList.find(c =>
      c.profileId === contactId || c.participantIds?.includes(contactId)
    );
    if (existingChat) {
      await handleForwardToChat(existingChat.id);
      return;
    }
    // Create new chat and forward
    try {
      const result = await api.createChat(contactId);
      if (result?.chatId) {
        await handleForwardToChat(result.chatId);
      }
    } catch {
      showToast('Error al crear el chat');
    }
  };

  const handleDownloadMedia = async () => {
    if (!contextMenuMsgId) return;
    const msg = chat.messages.find(m => m.id === contextMenuMsgId);
    setContextMenuMsgId(null);
    const mediaUrl = msg?.imageUrl || msg?.videoUrl || msg?.stickerUrl || msg?.gifUrl || msg?.audioUrl;
    if (!mediaUrl) return;
    try {
      const resp = await fetch(mediaUrl);
      const blob = await resp.blob();
      const ext = mediaUrl.split('.').pop()?.split('?')[0] || 'file';
      const fileName = `${msg?.imageUrl ? 'imagen' : msg?.videoUrl ? 'video' : msg?.stickerUrl ? 'sticker' : msg?.gifUrl ? 'gif' : 'audio'}-${Date.now()}.${ext}`;
      if (navigator.share && navigator.canShare?.({ files: [new File([blob], fileName, { type: blob.type })] })) {
        await navigator.share({ files: [new File([blob], fileName, { type: blob.type })], title: 'RED ON' });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {}
  };

  const handleCloseContextMenu = () => {
    setContextMenuMsgId(null);
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await api.removeGroupMember(chat.id, memberId);
      setGroupMembers(prev => prev.filter(m => m.id !== memberId));
      showToast('Miembro eliminado del grupo');
    } catch {
      showToast('Error al eliminar miembro', 'error');
    }
  };

  const handleLeaveGroup = async () => {
    try {
      await api.leaveGroup(chat.id);
      if (onDeleteChat) onDeleteChat(chat.id);
      showToast('Has salido del grupo');
    } catch {
      showToast('Error al salir del grupo', 'error');
    }
  };

  const handleDeleteGroup = async () => {
    try {
      await api.deleteGroup(chat.id);
      if (onDeleteChat) onDeleteChat(chat.id);
      showToast('Grupo eliminado');
    } catch {
      showToast('Error al eliminar grupo', 'error');
    }
  };

  const handleSaveGroupName = async () => {
    if (!groupNameInput.trim() || groupNameInput.trim() === chat.name) {
      setIsEditingGroupName(false);
      return;
    }
    try {
      await api.updateGroupName(chat.id, groupNameInput.trim());
      if (onChatUpdated) onChatUpdated({ ...chat, name: groupNameInput.trim() });
      setIsEditingGroupName(false);
      showToast('Nombre del grupo actualizado');
    } catch {
      showToast('Error al actualizar nombre', 'error');
    }
  };

  const handleGenerateInvite = async () => {
    try {
      const code = await api.createGroupInvite(chat.id);
      setInviteCode(code);
      setShowInviteQR(true);
    } catch {
      showToast('Error al generar enlace', 'error');
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  // Background computed for outer container (header backdrop-blur reads from it)
  const containerBgClass = chatStyle.bubbleBackground
    ? (chatStyle.bubbleBackground.startsWith('custom-img:[') || chatStyle.bubbleBackground.startsWith('pattern:') || chatStyle.bubbleBackground.startsWith('http') || chatStyle.bubbleBackground.startsWith('data:')
      ? 'bg-fixed bg-cover bg-center bg-no-repeat transition-all duration-300'
      : chatStyle.bubbleBackground)
    : 'bg-[#f0f2f5] transition-all duration-300';
  const containerBgStyle = (() => {
    const bg = chatStyle.bubbleBackground;
    if (!bg) return {};
    if (bg.startsWith('custom-img:[')) {
      const url = bg.substring(bg.indexOf('[') + 1, bg.lastIndexOf(']'));
      return { backgroundImage: `url(${url})` };
    }
    if (bg.startsWith('pattern:')) {
      const patternId = bg.replace('pattern:', '');
      return getPatternStyle(patternId) || {};
    }
    if (bg.startsWith('http') || bg.startsWith('data:')) {
      return { backgroundImage: `url(${bg})` };
    }
    return {};
  })();

  return (
    <div className={`flex flex-col h-full relative font-sans ${containerBgClass}`} style={containerBgStyle}>
      
      {/* Header of Chat — compact glassmorphism */}
      <div className="bg-white/70 backdrop-blur-md px-3 py-2 flex items-center justify-between border-b border-white/20 shadow-sm z-10 flex-shrink-0">
        <div className="flex items-center min-w-0 gap-2">
          {/* Back Arrow button */}
          <button 
            onClick={onBack}
            className="p-1.5 hover:bg-slate-100 active:scale-95 text-slate-700 hover:text-slate-900 rounded-full transition-all cursor-pointer"
            title="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Contact Details Trigger */}
          <div 
            onClick={() => setShowInfoPanel(true)}
            className="flex items-center gap-2.5 cursor-pointer group min-w-0"
          >
            <div className="relative flex-shrink-0">
              {chat.avatar ? (
                <img 
                  src={chat.avatar} 
                  alt={chat.name} 
                  className="w-11 h-11 rounded-full object-cover border border-slate-100 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                />
              ) : (
                <div className={`w-11 h-11 rounded-full ${chat.avatarColor || 'bg-slate-400'} text-white font-bold text-sm flex items-center justify-center border border-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]`}>
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
              <p className="text-slate-500 text-[11px] font-normal">
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

        {/* Header Right Action icons — 24px */}
        <div className="flex items-center gap-0.5 text-slate-500 relative">
          <button 
            onClick={() => onStartCall?.(chat.id, chat.profileId || '', chat.name, chat.avatar, 'audio')}
            className="p-2 hover:bg-slate-50 active:scale-95 hover:text-slate-800 rounded-full cursor-pointer transition-colors"
            title="Llamar"
          >
            <Phone className="w-6 h-6" />
          </button>
          <button 
            onClick={() => onStartCall?.(chat.id, chat.profileId || '', chat.name, chat.avatar, 'video')}
            className="p-2 hover:bg-slate-50 active:scale-95 hover:text-slate-800 rounded-full cursor-pointer transition-colors"
            title="Videollamada"
          >
            <Video className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setShowInfoPanel(!showInfoPanel)}
            className={`p-2 active:scale-95 rounded-full cursor-pointer transition-all ${showInfoPanel ? 'bg-[#3390ec]/10 text-[#3390ec]' : 'hover:bg-slate-50 hover:text-slate-800'}`}
            title="Ver información"
          >
            <Info className="w-5 h-5" />
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className={`p-2 active:scale-95 rounded-full cursor-pointer transition-all ${showMoreMenu ? 'bg-slate-100 text-slate-800' : 'hover:bg-slate-50 hover:text-slate-800'}`}
              title="Más opciones de chat"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {showMoreMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-xl py-1.5 z-50">
                <button
                  type="button"
                  onClick={() => {
                    setIsBubbleColorOpen(true);
                    setShowMoreMenu(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-750 text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  <span className="text-sm">💬</span>
                  <span>Colores de burbujas</span>
                </button>
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
                <div className="h-px bg-slate-100 mx-3 my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setIsSelecting(true);
                    setShowMoreMenu(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>Seleccionar mensajes</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Viewport for messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 pb-24 relative">
        
        {/* Contact Save Banner at top */}
        {!isContactSaved && !chat.isBlocked && chat.phone && (
          <div className="-mx-4 -mt-4 mb-3 px-4 py-3 bg-amber-100 dark:bg-amber-900/40 border-b-2 border-amber-300 dark:border-amber-700 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="text-xs text-amber-800 dark:text-amber-200 font-semibold truncate">Contacto no guardado</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => onSaveContact?.(chat.phone, chat.name)}
                  disabled={savingPhone === chat.phone}
                  className="text-sm font-semibold text-white bg-[#3390ec] hover:bg-[#2a7ad4] active:scale-95 px-4 py-2 rounded-xl transition-all disabled:opacity-50 shadow-sm"
                >
                  {savingPhone === chat.phone ? 'Guardando...' : 'Guardar contacto'}
                </button>
                <button
                  onClick={() => { onRejectContact?.(chat.id); onBack?.(); }}
                  className="text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-700/60 hover:bg-white dark:hover:bg-slate-700 active:scale-95 px-4 py-2 rounded-xl transition-all border border-slate-200/50 dark:border-slate-600/50"
                >
                  Rechazar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Helper informational header for RED ON Bot */}
        {chat.id === "4" && (
          <div className="max-w-xs mx-auto text-center py-2.5 px-3 bg-white/70 dark:bg-slate-800/80 border border-slate-200/45 dark:border-slate-700/50 rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.02)] mb-4">
            <p className="text-[11px] text-slate-500/90 dark:text-slate-300 leading-normal">
              💬 Prueba a enviarle un mensaje al bot inteligente como: <strong className="text-[#3390ec]">"hola"</strong>, <strong className="text-[#3390ec]">"diseño"</strong>, o <strong className="text-[#3390ec]">"creador"</strong> para respuestas dinámicas.
            </p>
          </div>
        )}

        {/* Actual conversational balloons with long press and click fallbacks for reactions */}
        {localMessages.length === 0 ? (
          <div className="text-center text-slate-400 text-xs py-8">
            No hay mensajes anteriores coincidiendo. Envía uno.
          </div>
        ) : (
          localMessages.map((msg, idx) => {
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

            const prevMsg = idx > 0 ? localMessages[idx - 1] : null;
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
                className={`flex w-full items-start anim-fade-in relative py-1 ${isSelecting ? '' : (isMe ? 'justify-end' : 'justify-start')}`}
                onContextMenu={(e) => handleContextMenu(e, msg.id, isMe)}
              >
                {/* Selection checkbox — always on the left */}
                {isSelecting && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleSelectMessage(msg.id); }}
                    className={`flex-shrink-0 mt-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all cursor-pointer ${
                      selectedMessageIds.has(msg.id)
                        ? 'bg-[#3390ec] border-[#3390ec] text-white'
                        : 'border-slate-300 dark:border-slate-500 bg-white/80 dark:bg-slate-700/80'
                    }`}
                  >
                    {selectedMessageIds.has(msg.id) && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                )}
                {/* Message wrapper — handles its own alignment */}
                <div className={`flex ${isSelecting ? 'flex-1' : ''} ${isMe ? 'justify-end' : 'justify-start'}`}>

                {/* Floating reaction picker bar */}
                {activeMessageIdForReaction === msg.id && (
                  <div className="absolute -top-10 z-40 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-full shadow-lg px-3 py-1.5 flex gap-3 anim-scale-up select-none max-w-max left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0">
                    {['👍', '❤️', '😂', '😮', '🔥'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await api.addReaction(msg.id, emoji).catch(() => {});
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
                    userId={userId}
                    chatStyle={chatStyle}
                    isGroup={chat.isGroup}
                    messageReaction={messageReaction}
                    onMouseDown={() => handlePressStart(msg.id, isMe)}
                    onMouseUp={handlePressEnd}
                    onMouseLeave={handlePressEnd}
                    onTouchStart={() => handleTouchStart(msg.id, isMe)}
                    onTouchEnd={handleTouchEnd}
                    onDoubleClick={() => setActiveMessageIdForReaction(msg.id)}
                  />
                </div>
              </div>
              </React.Fragment>
            );
          })
        )}
        {/* Typing / Recording indicator */}
        {(partnerTyping || partnerRecording) && (
          <div className="flex justify-start px-4 py-1">
            <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-[2px] px-3.5 py-2 shadow-sm border border-slate-200/50 dark:border-slate-700/60">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-[11px] text-slate-500 italic">
                  {partnerRecording ? 'Grabando audio...' : 'Escribiendo...'}
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Selection toolbar — replaces input when selecting messages */}
      {isSelecting ? (
        <div className="absolute bottom-0 left-0 right-0 z-30 p-3 pointer-events-none">
          <div className="pointer-events-auto max-w-md mx-auto bg-white/95 backdrop-blur-xl rounded-3xl shadow-lg border border-white/20 px-4 py-3 flex items-center justify-between">
            <button
              onClick={cancelSelection}
              className="text-sm font-semibold text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <span className="text-xs text-slate-400 font-medium">
              {selectedMessageIds.size} seleccionado{selectedMessageIds.size !== 1 ? 's' : ''}
            </span>
            <button
              onClick={handleBulkDelete}
              className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-xl transition-all cursor-pointer ${
                selectedMessageIds.size === 0
                  ? 'text-red-300 cursor-not-allowed'
                  : 'text-red-500 hover:bg-red-50 active:scale-95'
              }`}
              disabled={selectedMessageIds.size === 0}
            >
              <Trash2 className="w-4 h-4" />
              Eliminar
            </button>
          </div>
        </div>
      ) : (
        /* Bottom Message Input Panel - Floating */
      <div className="absolute bottom-0 left-0 right-0 z-30 p-3 pointer-events-none">
        <div className="pointer-events-auto max-w-md mx-auto bg-white/95 backdrop-blur-xl rounded-3xl shadow-lg border border-white/20">
          {showStatusAlert && (
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-xs px-4 py-2 rounded-full whitespace-nowrap shadow-lg z-50">
              {showStatusAlert}
            </div>
          )}

          {/* Reply banner */}
          {replyTarget && (
            <div className="mb-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-between border-l-3 border-brand">
              <div className="flex items-center gap-1.5 min-w-0">
                <MessageCircle className="w-3.5 h-3.5 text-brand flex-shrink-0" />
                <div className="min-w-0">
                  <span className="text-[10px] font-semibold text-brand block leading-tight">
                    {replyTarget.sender === 'me' ? 'Respondiendo a ti mismo' : `Respondiendo a ${chat.name}`}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate block max-w-[200px] leading-tight">
                    {replyTarget.text}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReplyTarget(null)}
                className="p-1 hover:bg-white/50 dark:hover:bg-slate-700 rounded-full transition-all cursor-pointer flex-shrink-0"
              >
                <X className="w-3.5 h-3.5 text-slate-400" />
              </button>
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
            <div className="max-w-md mx-auto flex items-center gap-3 px-2 py-2 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-100 dark:border-slate-700/50 shadow-sm">
              {/* Cancel */}
              <button
                type="button"
                onClick={cancelRecording}
                className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer active:scale-90"
                title="Cancelar grabación"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* Sound wave rings around mic */}
              <div className="relative flex items-center justify-center w-10 h-10 shrink-0">
                <Mic className="w-5 h-5 text-[#3390ec] relative z-10" />
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute inset-0 rounded-full border-2 border-[#3390ec]/40"
                    initial={{ scale: 0.8, opacity: 0.6 }}
                    animate={{ scale: [0.8, 1.5 + i * 0.3], opacity: [0.6, 0] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.5,
                      ease: 'easeOut',
                    }}
                  />
                ))}
              </div>

              {/* Timer */}
              <span className="text-sm font-mono font-semibold text-slate-700 dark:text-slate-300 min-w-[44px] text-center tabular-nums">
                {String(Math.floor(recordingDuration / 60)).padStart(2, '0')}:{String(recordingDuration % 60).padStart(2, '0')}
              </span>


            </div>
          ) : recordingState === 'preview' ? (
            <div className="max-w-md mx-auto flex items-center gap-2 px-2 py-2 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 backdrop-blur-sm border border-slate-100 dark:border-slate-700/50 shadow-sm">
              {/* Cancel/Trash */}
              <button
                type="button"
                onClick={handleCancelPreview}
                className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all cursor-pointer active:scale-90"
                title="Eliminar nota de voz"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* Play/Pause button */}
              <button
                type="button"
                onClick={handleTogglePreviewPlayback}
                className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-gradient-to-br from-[#3390ec] to-[#7c3aed] text-white hover:opacity-90 shadow-md active:scale-95 transition-all cursor-pointer"
                title={isPlayingPreview ? 'Pausar' : 'Escuchar'}
              >
                {isPlayingPreview ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>

              {/* Waveform progress bar + Timer */}
              <div className="flex-1 flex flex-col gap-1 min-w-0">
                <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[#3390ec] to-[#7c3aed] rounded-full"
                    style={{ width: `${recordingDuration > 0 ? (previewCurrentTime / recordingDuration) * 100 : 0}%` }}
                    layout
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-medium text-slate-400 dark:text-slate-500 tabular-nums">
                    {String(Math.floor(previewCurrentTime / 60)).padStart(2, '0')}:{String(Math.floor(previewCurrentTime % 60)).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] font-mono font-medium text-slate-400 dark:text-slate-500 tabular-nums">
                    {String(Math.floor(recordingDuration / 60)).padStart(2, '0')}:{String(recordingDuration % 60).padStart(2, '0')}
                  </span>
                </div>
              </div>

              {/* Send button */}
              <button
                type="button"
                onClick={handleSendPreviewAudio}
                className="w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-gradient-to-br from-[#3390ec] to-[#7c3aed] text-white hover:opacity-90 shadow-md active:scale-95 transition-all cursor-pointer"
                title="Enviar nota de voz"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <form onSubmit={handleSend} className="flex items-center min-w-0 relative gap-0.5 px-2 py-1">
              
              {/* Sticker/Emoji/GIF Picker */}
              <AnimatePresence>
                {showStickerPicker && (
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50">
                    <StickerPicker
                      onSelectEmoji={(emoji) => { setInputText(prev => prev + emoji); setShowStickerPicker(false); }}
                      onSelectSticker={(url, isAnimated) => { onSendMessage(chat.id, '🖼️ Sticker', undefined, undefined, undefined, isAnimated ? { stickerUrl: url, isAnimated: true } : { stickerUrl: url }); setShowStickerPicker(false); }}
                      onSelectGif={(url) => { onSendMessage(chat.id, '🎬 GIF', undefined, undefined, undefined, { gifUrl: url }); setShowStickerPicker(false); }}
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
                          if (file) handleSendMedia(file);
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
                        const selectEl = document.createElement('input');
                        selectEl.type = 'file';
                        selectEl.accept = 'image/*';
                        selectEl.capture = 'environment';
                        selectEl.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) handleSendMedia(file);
                        };
                        selectEl.click();
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
                        const selectEl = document.createElement('input');
                        selectEl.type = 'file';
                        selectEl.accept = 'video/*';
                        selectEl.capture = 'environment';
                        selectEl.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) handleSendMedia(file);
                        };
                        selectEl.click();
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
                        handleSendLocation();
                        setShowAttachMenu(false);
                      }}
                      className="flex flex-col items-center gap-1 group focus:outline-none"
                    >
                      <div className="w-11 h-11 bg-emerald-500 text-white rounded-full flex items-center justify-center transition-transform active:scale-90 group-hover:scale-105 shadow-md shadow-emerald-100">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-600 mt-0.5">Ubicación</span>
                    </button>

                    {/* 7. Encuesta */}
                    <button 
                      type="button"
                      onClick={() => {
                        setShowAttachMenu(false);
                        setShowPollCreator(true);
                      }}
                      className="flex flex-col items-center gap-1 group focus:outline-none"
                    >
                      <div className="w-11 h-11 bg-amber-500 text-white rounded-full flex items-center justify-center transition-transform active:scale-90 group-hover:scale-105 shadow-md shadow-amber-100">
                        <BarChart3 className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold text-slate-600 mt-0.5">Encuesta</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Unified row: Plus · Input · Smiley — seamless, no container bg */}
              <div className="flex-1 flex items-center min-w-0 gap-0.5 rounded-full">
                {/* Plus / Attach button */}
                <button
                  type="button"
                  onClick={() => setShowAttachMenu(!showAttachMenu)}
                  className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full transition-all cursor-pointer text-slate-400 hover:text-[#3390ec] active:scale-90"
                  title="Más opciones de adjuntos"
                >
                  <Plus className={`w-5 h-5 transition-transform ${showAttachMenu ? 'rotate-45' : ''}`} />
                </button>

                {/* Text Input — no separate bg/border, fused into card */}
                <input
                  type="text"
                  placeholder="Escribe un mensaje..."
                  value={inputText}
                  onChange={(e) => {
                    const val = e.target.value;
                    setInputText(val);
                    if (presenceChanRef.current) {
                      presenceChanRef.current.send({
                        type: 'broadcast',
                        event: 'typing',
                        payload: { userId, isTyping: val.length > 0 },
                      });
                    }
                    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
                    if (val.length > 0) {
                      typingTimerRef.current = setTimeout(() => {
                        if (presenceChanRef.current) {
                          presenceChanRef.current.send({
                            type: 'broadcast',
                            event: 'typing',
                            payload: { userId, isTyping: false },
                          });
                        }
                      }, 1500);
                    }
                  }}
                  className="flex-1 bg-transparent text-slate-800 placeholder-slate-400 text-sm px-1 py-2.5 focus:outline-none min-w-0"
                />

                {/* Smiley / Sticker button */}
                <button
                  type="button"
                  onClick={() => setShowStickerPicker(!showStickerPicker)}
                  className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full transition-all cursor-pointer text-slate-400 hover:text-brand active:scale-90"
                  title="Emojis, stickers y GIFs"
                >
                  <Smile className="w-5 h-5" />
                </button>
              </div>

              {/* Sending video indicator */}
              {isSendingVideo ? (
                <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-[#3390ec] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
              <>
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
                  onMouseDown={() => handleTouchStartOnMic()}
                  onTouchStart={() => handleTouchStartOnMic()}
                  className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-[#3390ec] text-white hover:bg-[#2b7bc9] shadow-[0_2px_6px_rgba(51,144,236,0.25)] active:scale-95 transition-all cursor-pointer select-none"
                  title="Mantén pulsado para grabar, desliza arriba para bloquear"
                >
                  <Mic className="w-5 h-5" />
                </button>
              )}
              </>
            )}
            </form>
          )}
        </div>
      </div>
      )}

      {/* Info/Metadata slide-over screen detailing user coordinates */}
      {showInfoPanel && chat.isGroup && (
        <div className="fixed inset-0 w-full h-full z-50 bg-white flex flex-col animate-fade-in">
          {/* Panel Header */}
          <div className="bg-white p-4 border-b border-slate-100 flex items-center justify-between shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <h3 className="text-slate-900 font-semibold text-sm">Info. del Grupo</h3>
            <button 
              onClick={() => setShowInfoPanel(false)}
              className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-50 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Panel Body */}
          <div className="flex-1 overflow-y-auto bg-[#f0f2f5] p-4 space-y-4">
            
            {/* Group card */}
            <div className="bg-white p-5 rounded-2xl text-center shadow-[0_1px_2.5px_rgba(0,0,0,0.04)] ring-1 ring-slate-100/50">
              <div className="relative inline-block mx-auto">
                {chat.avatar ? (
                  <img 
                    src={chat.avatar} 
                    alt={chat.name} 
                    className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-sm"
                  />
                ) : (
                  <div className={`w-20 h-20 rounded-full ${chat.avatarColor || 'bg-emerald-500'} text-white font-bold text-xl flex items-center justify-center border-2 border-white shadow-sm`}>
                    {getInitials(chat.name)}
                  </div>
                )}
              </div>

              {isEditingGroupName ? (
                <div className="mt-3 flex items-center justify-center gap-2">
                  <input
                    type="text"
                    value={groupNameInput}
                    onChange={e => setGroupNameInput(e.target.value)}
                    className="text-center text-slate-900 font-bold text-base border-b-2 border-[#3390ec] outline-none bg-transparent w-48"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveGroupName(); }}
                  />
                  <button onClick={handleSaveGroupName} className="p-1 text-[#3390ec] cursor-pointer">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setIsEditingGroupName(false)} className="p-1 text-slate-400 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="mt-3 flex items-center justify-center gap-2">
                  <h4 className="text-slate-900 font-bold text-base leading-tight">{chat.name}</h4>
                  {chat.adminId === userId && (
                    <button onClick={() => setIsEditingGroupName(true)} className="p-1 text-[#3390ec] hover:bg-blue-50 rounded-full cursor-pointer">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
              <p className="text-slate-400 text-xs mt-0.5">{chat.bio}</p>
              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-600">
                {groupMembers.length} miembros
              </span>
            </div>

            {/* Members list */}
            <div className="bg-white rounded-3xl p-5 shadow-[0_1px_2.5px_rgba(0,0,0,0.04)]">
              <h5 className="text-slate-450 text-[10px] uppercase tracking-wider font-bold mb-3">Miembros</h5>
              <div className="space-y-3">
                {groupMembers.map(member => {
                  const isAdmin = member.id === chat.adminId;
                  const isMe = member.id === userId;
                  const canRemove = chat.adminId === userId && !isMe;
                  return (
                    <div key={member.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {member.avatar ? (
                          <img src={member.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-slate-300 text-white font-bold text-sm flex items-center justify-center">
                            {getInitials(member.name)}
                          </div>
                        )}
                        <div>
                          <span className="text-slate-800 text-sm font-semibold block leading-tight">
                            {member.name} {isMe && <span className="text-slate-400 font-normal text-[10px]">(tú)</span>}
                          </span>
                          {isAdmin && <span className="text-[10px] text-[#3390ec] font-semibold">Admin</span>}
                        </div>
                      </div>
                      {canRemove && (
                        <button
                          onClick={() => handleRemoveMember(member.id)}
                          className="p-2 text-red-400 hover:bg-red-50 rounded-full cursor-pointer active:scale-90"
                          title="Eliminar del grupo"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Invite link */}
            <div className="bg-white rounded-2xl p-4 shadow-[0_1px_2.5px_rgba(0,0,0,0.04)]">
              <button
                onClick={handleGenerateInvite}
                className="w-full py-3 flex items-center justify-center gap-2 text-[#3390ec] font-semibold text-sm rounded-xl hover:bg-blue-50 active:scale-95 transition-all cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                Compartir enlace de invitación
              </button>
            </div>

            {/* Leave / Delete group */}
            <div className="bg-white rounded-2xl p-4 shadow-[0_1px_2.5px_rgba(0,0,0,0.04)] space-y-3">
              {chat.adminId === userId ? (
                <button
                  onClick={handleDeleteGroup}
                  className="w-full py-3 flex items-center justify-center gap-2 text-red-500 font-semibold text-sm rounded-xl hover:bg-red-50 active:scale-95 transition-all cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar grupo
                </button>
              ) : (
                <button
                  onClick={handleLeaveGroup}
                  className="w-full py-3 flex items-center justify-center gap-2 text-red-500 font-semibold text-sm rounded-xl hover:bg-red-50 active:scale-95 transition-all cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Salir del grupo
                </button>
              )}
            </div>
          </div>
          
          {/* Panel Footer */}
          <div className="p-4 bg-white border-t border-slate-100">
            <button 
              onClick={() => setShowInfoPanel(false)}
              className="w-full py-2.5 bg-[#3390ec] text-white font-semibold text-xs rounded-xl hover:bg-[#2b7bc9] active:scale-95 transition-all text-center cursor-pointer"
            >
              Cerrar Panel
            </button>
          </div>

        </div>
      )}

      {showInfoPanel && !chat.isGroup && (
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

            {/* Delete conversation */}
            <div className="bg-white rounded-2xl p-2 shadow-[0_1px_2.5px_rgba(0,0,0,0.04)]">
              <button
                onClick={() => { if (onDeleteChat) onDeleteChat(chat.id); setShowInfoPanel(false); }}
                className="w-full py-3 flex items-center justify-center gap-2 text-red-500 font-semibold text-sm rounded-xl hover:bg-red-50 active:scale-95 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar conversación
              </button>
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
                onClick={handleReplyToMessage}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 text-brand" />
                Responder
              </button>
              <button
                onClick={handleStartEditMessage}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-all cursor-pointer"
              >
                <Edit3 className="w-4 h-4 text-brand" />
                Editar mensaje
              </button>
              <button
                onClick={enterSelectionMode}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-all cursor-pointer"
              >
                <CheckSquare className="w-4 h-4 text-brand" />
                Seleccionar mensajes
              </button>
              <button
                onClick={handleDeleteForEveryone}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar para todos
              </button>
              <button
                onClick={handleOpenForward}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-all cursor-pointer"
              >
                <Forward className="w-4 h-4 text-brand" />
                Reenviar
              </button>
              <button
                onClick={handleDownloadMedia}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl transition-all cursor-pointer"
              >
                <Share2 className="w-4 h-4 text-brand" />
                Compartir
              </button>
            </div>
          </div>
        </div>
      )}

      {showForwardPicker && (
        <div className="fixed inset-0 z-70 flex flex-col bg-white dark:bg-slate-900 animate-slide-up">
          <div className="flex items-center justify-between px-4 pt-12 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <button onClick={() => { setShowForwardPicker(false); setForwardMsg(null); }} className="p-1.5 -ml-1 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h3 className="text-slate-900 dark:text-white font-bold text-base">Reenviar mensaje</h3>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {(() => {
              // Merge contacts + existing chats, deduplicate by profileId
              const existingChatIds = new Set(chatList.filter(c => c.id !== chat.id).map(c => c.profileId));
              const contactsWithoutChat = forwardContacts.filter(ct => !existingChatIds.has(ct.id));
              const merged = [
                ...chatList.filter(c => c.id !== chat.id).map(c => ({ ...c, _isChat: true as const, _contactId: c.profileId || '' })),
                ...contactsWithoutChat.map(c => ({ ...c, _isChat: false as const, _contactId: c.id })),
              ];
              return merged.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Forward className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-xs font-medium">No hay contactos ni chats</p>
                  <p className="text-[10px] mt-1">Agrega contactos para reenviar mensajes</p>
                </div>
              ) : (
                <div className="max-w-md mx-auto space-y-1">
                  {merged.map(item => (
                    <div key={item.id} onClick={() => item._isChat ? handleForwardToChat(item.id) : handleForwardToContact(item._contactId)}
                      className="flex items-center gap-3.5 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-2xl cursor-pointer transition-colors">
                      <div className="w-11 h-11 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300 flex-shrink-0">
                        {item.avatar ? <img src={item.avatar} alt={item.name} className="w-full h-full rounded-full object-cover" /> : item.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{item.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{item._isChat ? item.lastMessage || 'Chat existente' : 'Contacto guardado'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Poll Creator */}
      {showPollCreator && (
        <div className="fixed inset-0 z-70 flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowPollCreator(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-t-3xl w-full max-w-md p-6 pb-10 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-900 dark:text-white font-bold text-base">Crear Encuesta</h3>
              <button onClick={() => setShowPollCreator(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <input
              type="text"
              value={pollTitle}
              onChange={e => setPollTitle(e.target.value)}
              placeholder="Título de la encuesta"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white mb-3 focus:outline-none focus:ring-2 focus:ring-[#3390ec]/30"
            />

            <div className="space-y-2 mb-3">
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt}
                    onChange={e => {
                      const next = [...pollOptions];
                      next[i] = e.target.value;
                      setPollOptions(next);
                    }}
                    placeholder={`Opción ${i + 1}`}
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#3390ec]/30"
                  />
                  {pollOptions.length > 2 && (
                    <button onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-500 p-1 cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => setPollOptions([...pollOptions, ''])}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#3390ec] mb-4 cursor-pointer hover:underline"
            >
              <PlusCircle className="w-4 h-4" />
              Añadir opción
            </button>

            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={pollMultipleChoice}
                onChange={e => setPollMultipleChoice(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs text-slate-600 dark:text-slate-300">Respuesta múltiple</span>
            </label>

            <button
              onClick={handleCreatePoll}
              className="w-full py-2.5 bg-[#3390ec] text-white font-semibold text-sm rounded-xl hover:bg-[#2b7bc9] active:scale-95 transition-all cursor-pointer"
            >
              Enviar encuesta
            </button>
          </div>
        </div>
      )}

      {/* Invite QR */}
      {showInviteQR && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowInviteQR(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-2xl max-w-xs w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-900 dark:text-white font-bold text-sm">Invitar al grupo</h3>
              <button onClick={() => setShowInviteQR(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex justify-center mb-3">
              <QRCodeSVG value={`redon://group/${inviteCode}`} size={180} level="M" />
            </div>
            <p className="text-center text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Código: <span className="text-[#3390ec]">{inviteCode}</span></p>
            <p className="text-center text-[10px] text-slate-400 mb-4">Comparte este código o QR para invitar personas al grupo</p>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(inviteCode);
                showToast('Código copiado al portapapeles');
              }}
              className="w-full py-2.5 bg-[#3390ec] text-white font-semibold text-xs rounded-xl hover:bg-[#2b7bc9] active:scale-95 transition-all cursor-pointer"
            >
              Copiar código
            </button>
          </div>
        </div>
      )}

      {/* 1. Editor de Fondo de Chat */}
      <ChatWallpaper 
        isOpen={isWallpaperOpen}
        onClose={() => setIsWallpaperOpen(false)}
        onSelectWallpaper={(wallpaperClass) => {
          setCurrentWallpaper(wallpaperClass);
          if (onUpdateChatStyle) {
            onUpdateChatStyle({ ...chatStyle, bubbleBackground: wallpaperClass });
          }
          setIsWallpaperOpen(false);
        }}
        currentWallpaper={currentWallpaper}
      />

      {/* 2. Editor de Color de Burbujas */}
      <BubbleColorPicker
        isOpen={isBubbleColorOpen}
        onClose={() => setIsBubbleColorOpen(false)}
        chatStyle={chatStyle}
        onChangeStyle={(updated) => {
          if (onUpdateChatStyle) {
            onUpdateChatStyle(updated);
          }
          setIsBubbleColorOpen(false);
        }}
      />

    </div>
  );
}
