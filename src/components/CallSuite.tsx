import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabase';
import { 
  Phone, Video, PhoneOff, Mic, MicOff, VideoOff, 
  Volume2, VolumeX, Heart, SmilePlus, Palette,
  X
} from 'lucide-react';
import { playSound, stopAllSounds } from '../services/soundPlayer';

function getIceConfig(): RTCConfiguration {
  return getStaticIceConfig();
}

function getStaticIceConfig(): RTCConfiguration {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  const turnUrl = import.meta.env.VITE_TURN_URL || '';
  const turnUser = import.meta.env.VITE_TURN_USERNAME || '';
  const turnCred = import.meta.env.VITE_TURN_CREDENTIAL || '';
  if (turnUrl && turnUser && turnCred) {
    servers.push({ urls: turnUrl, username: turnUser, credential: turnCred });
  }

  return { iceServers: servers };
}

async function fetchIceConfig(): Promise<RTCConfiguration> {
  const serverUrl = import.meta.env.VITE_SERVER_URL;
  if (serverUrl) {
    try {
      const res = await fetch(`${serverUrl}/api/turn/credentials`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.iceServers && data.iceServers.length > 0) {
          return { iceServers: data.iceServers };
        }
      }
    } catch {}
  }
  return getStaticIceConfig();
}

interface CallSuiteProps {
  isOpen: boolean;
  contactName: string;
  contactAvatar?: string;
  isGroup: boolean;
  onClose: () => void;
  userId: string;
  contactId: string;
  chatId: string;
  direction: 'outgoing' | 'incoming';
  callType: 'audio' | 'video';
  onAcceptCall?: () => void;
  onRejectCall?: () => void;
}

const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '🔥', '👏', '🎉', '😍', '💀', '🤣'];
const BACKGROUND_OPTIONS = [
  { id: 'none', name: 'Ninguno', icon: '✕' },
  { id: 'blur-soft', name: 'Desenfoque suave', icon: '🌫' },
  { id: 'blur-strong', name: 'Desenfoque fuerte', icon: '🌁' },
  { id: 'gradient', name: 'Gradiente estudio', icon: '🎨' },
  { id: 'warm', name: 'Tono cálido', icon: '🌅' },
  { id: 'cool', name: 'Tono frío', icon: '❄' },
];

export const CallSuite: React.FC<CallSuiteProps> = ({
  isOpen,
  contactName,
  contactAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&q=80',
  isGroup,
  onClose,
  userId,
  contactId,
  chatId,
  direction,
  callType,
  onAcceptCall,
  onRejectCall,
}) => {
  const isVideoCall = callType === 'video';
  const [callStatus, setCallStatus] = useState<'connecting' | 'ringing' | 'active' | 'disconnected'>(
    direction === 'outgoing' ? 'connecting' : 'ringing'
  );
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Live reactions
  const [reactions, setReactions] = useState<{id: string; emoji: string; x: number}[]>([]);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const reactionIdRef = useRef(0);

  // Professional backgrounds
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [backgroundMode, setBackgroundMode] = useState('none');
  const [isReconnecting, setIsReconnecting] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callChannelRef = useRef<any>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iceCandidatesQueue = useRef<any[]>([]);
  const offerRetryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingOfferRef = useRef<any>(null);
  const offerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRestartingIceRef = useRef(false);
  const maxReconnectAttempts = 3;

  const callChannelId = `call:${chatId}`;

  const resetReconnectState = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    isRestartingIceRef.current = false;
    setIsReconnecting(false);
  }, []);

  const cleanup = useCallback(() => {
    stopAllSounds();
    resetReconnectState();
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    if (offerRetryRef.current) clearInterval(offerRetryRef.current);
    if (offerTimeoutRef.current) clearTimeout(offerTimeoutRef.current);
    if (callChannelRef.current) {
      supabase.removeChannel(callChannelRef.current);
      callChannelRef.current = null;
    }
    if (pcRef.current) {
      const pc = pcRef.current;
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.oniceconnectionstatechange = null;
      pc.onsignalingstatechange = null;
      pc.onnegotiationneeded = null;
      pc.getSenders().forEach(s => { try { pc.removeTrack(s); } catch {} });
      pc.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => { t.stop(); t.enabled = false; });
      localStreamRef.current = null;
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach(t => { t.stop(); t.enabled = false; });
      remoteStreamRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    pendingOfferRef.current = null;
    iceCandidatesQueue.current = [];
    reactionIdRef.current = 0;
    setCallStatus('disconnected');
    setIsMuted(false);
    setIsCamOff(false);
    setIsSpeakerOn(true);
    setCallDuration(0);
    setLocalStream(null);
    setRemoteStream(null);
    setErrorMsg('');
    setReactions([]);
    setShowReactionPicker(false);
    setShowBgPicker(false);
    setBackgroundMode('none');
  }, []);

  const sendToCallChannel = useCallback((event: string, payload: any) => {
    if (callChannelRef.current) {
      callChannelRef.current.send({ type: 'broadcast', event, payload }).catch((e: any) => console.warn('sendToCallChannel', event, e));
    }
  }, []);

  const handleHangup = useCallback(() => {
    sendToCallChannel('end-call', { userId });
    cleanup();
    onClose();
  }, [cleanup, onClose, sendToCallChannel, userId]);

  const attemptIceRestart = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || pc.signalingState === 'closed' || isRestartingIceRef.current) return;
    isRestartingIceRef.current = true;

    reconnectAttemptsRef.current++;
    if (reconnectAttemptsRef.current > maxReconnectAttempts) {
      handleHangup();
      return;
    }

    setIsReconnecting(true);
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      sendToCallChannel('offer', { sdp: pc.localDescription, userId, iceRestart: true });
    } catch (err) {
      console.warn('ICE restart failed:', err);
      handleHangup();
    }
  }, [sendToCallChannel, userId, handleHangup]);

  const sendReaction = (emoji: string) => {
    try {
      if (callChannelRef.current) {
        callChannelRef.current.send({
          type: 'broadcast',
          event: 'reaction',
          payload: { emoji, userId }
        });
      }
    } catch (e) {
      console.warn('sendReaction error:', e);
    }
    const id = `reaction-${reactionIdRef.current++}`;
    setReactions(prev => [...prev, { id, emoji, x: 15 + Math.random() * 70 }]);
    setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 2500);
  };

  const getMediaStream = useCallback(async (opts: { audio: boolean; video: boolean }): Promise<MediaStream | null> => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg('El navegador no soporta llamadas');
      return null;
    }
    for (const constraints of [
      opts,
      { audio: opts.audio, video: false },
    ] satisfies MediaStreamConstraints[]) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        return stream;
      } catch {
        continue;
      }
    }
    setErrorMsg('No se encontró micrófono. Conecta uno e intenta de nuevo.');
    return null;
  }, [setErrorMsg]);

  const handleAnswer = useCallback(async () => {
    try {
      stopAllSounds();
      const stream = await getMediaStream({ audio: true, video: !isCamOff });
      if (!stream) { cleanup(); onClose(); return; }
      setLocalStream(stream);
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      let pc: RTCPeerConnection;
      try {
        const iceConfig = await fetchIceConfig();
        pc = new RTCPeerConnection(iceConfig);
      } catch (err: any) {
        setErrorMsg(err.message || 'Error al conectar');
        setCallStatus('disconnected');
        stopAllSounds();
        return;
      }
      pcRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        setRemoteStream(stream);
        remoteStreamRef.current = stream;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendToCallChannel('ice-candidate', { candidate: event.candidate, userId });
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected') {
          resetReconnectState();
          setCallStatus('active');
        } else if (pc.iceConnectionState === 'disconnected') {
          if (!reconnectTimerRef.current) {
            setIsReconnecting(true);
            reconnectTimerRef.current = setTimeout(() => {
              attemptIceRestart();
            }, 8000);
          }
        } else if (pc.iceConnectionState === 'failed') {
          attemptIceRestart();
        }
      };

      // Wait for remote offer if not yet received
      if (pendingOfferRef.current) {
        await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
      } else if (pc.signalingState !== 'have-remote-offer') {
        await new Promise<void>((resolve, reject) => {
          const check = setInterval(() => {
            if (pendingOfferRef.current) {
              clearInterval(check);
              resolve();
            }
          }, 50);
          setTimeout(() => {
            clearInterval(check);
            reject(new Error('Tiempo de espera agotado esperando oferta remota'));
          }, 10000);
        });
        await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
      }

      if (pc.signalingState !== 'have-remote-offer') {
        throw new Error('Estado de señalización inválido: ' + pc.signalingState);
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      sendToCallChannel('answer', { sdp: pc.localDescription, userId });

      for (const c of iceCandidatesQueue.current) {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      }
      iceCandidatesQueue.current = [];

      setCallStatus('active');
      onAcceptCall?.();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar');
      setCallStatus('disconnected');
      stopAllSounds();
    }
  }, [isCamOff, cleanup, sendToCallChannel, userId, onAcceptCall, getMediaStream, resetReconnectState, attemptIceRestart]);

  useEffect(() => {
    if (!isOpen || direction !== 'outgoing') return;

    let cancelled = false;

    const startOutgoing = async () => {
      setCallStatus('connecting');
      try {
      const stream = await getMediaStream({ audio: true, video: isVideoCall && !isCamOff });
        if (cancelled) { if (stream) stream.getTracks().forEach(t => t.stop()); return; }
        if (!stream) return;
        setLocalStream(stream);
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        let pc: RTCPeerConnection;
        try {
          const iceConfig = await fetchIceConfig();
          pc = new RTCPeerConnection(iceConfig);
        } catch (err: any) {
          setErrorMsg(err.message || 'Error al conectar');
          setCallStatus('disconnected');
          stopAllSounds();
          return;
        }
        pcRef.current = pc;

        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
          const [stream] = event.streams;
          setRemoteStream(stream);
          remoteStreamRef.current = stream;
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream;
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            sendToCallChannel('ice-candidate', { candidate: event.candidate, userId });
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === 'connected') {
            stopAllSounds();
            resetReconnectState();
            setCallStatus('active');
          } else if (pc.iceConnectionState === 'disconnected') {
            if (!reconnectTimerRef.current) {
              setIsReconnecting(true);
              reconnectTimerRef.current = setTimeout(() => {
                attemptIceRestart();
              }, 8000);
            }
          } else if (pc.iceConnectionState === 'failed') {
            attemptIceRestart();
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const channel = supabase.channel(callChannelId);
        callChannelRef.current = channel;

        channel.on('broadcast', { event: 'join' }, (payload: any) => {
          if (payload.payload.userId !== contactId) return;
          channel.send({ type: 'broadcast', event: 'offer', payload: { sdp: pc.localDescription, userId } });
          if (offerRetryRef.current) clearInterval(offerRetryRef.current);
          if (offerTimeoutRef.current) clearTimeout(offerTimeoutRef.current);
        });

        channel.on('broadcast', { event: 'answer' }, async (payload: any) => {
          if (payload.payload.userId !== contactId) return;
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.payload.sdp));
            for (const c of iceCandidatesQueue.current) {
              await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
            }
            iceCandidatesQueue.current = [];
          } catch (err) {
            console.warn('Failed to set remote description:', err);
          }
        });

        channel.on('broadcast', { event: 'ice-candidate' }, (payload: any) => {
          if (payload.payload.userId !== contactId) return;
          if (pc.remoteDescription) {
            pc.addIceCandidate(new RTCIceCandidate(payload.payload.candidate)).catch(() => {});
          } else {
            iceCandidatesQueue.current.push(payload.payload.candidate);
          }
        });

        channel.on('broadcast', { event: 'end-call' }, () => {
          handleHangup();
        });

        channel.on('broadcast', { event: 'offer' }, async (payload: any) => {
          if (payload.payload.userId !== contactId) return;
          const existingPc = pcRef.current;
          if (existingPc && existingPc.remoteDescription && payload.payload.iceRestart) {
            try {
              await existingPc.setRemoteDescription(new RTCSessionDescription(payload.payload.sdp));
              const answer = await existingPc.createAnswer();
              await existingPc.setLocalDescription(answer);
              sendToCallChannel('answer', { sdp: existingPc.localDescription, userId });
              resetReconnectState();
            } catch (err) {
              console.warn('Failed to handle re-offer:', err);
            }
          }
        });

        channel.on('broadcast', { event: 'reaction' }, (payload: any) => {
          const id = `reaction-${reactionIdRef.current++}`;
          setReactions(prev => [...prev, { id, emoji: payload.payload.emoji, x: 15 + Math.random() * 70 }]);
          setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 2500);
        });

        channel.subscribe();

        offerRetryRef.current = setInterval(() => {
          channel.send({ type: 'broadcast', event: 'offer', payload: { sdp: pc.localDescription, userId } });
        }, 2000);

        offerTimeoutRef.current = setTimeout(() => {
          if (!cancelled) {
            setErrorMsg('El usuario no respondió');
            stopAllSounds();
            cleanup();
            onClose();
          }
        }, 30000);
      } catch (err: any) {
        if (!cancelled) {
          setErrorMsg(err.message || 'Error al iniciar llamada');
          setCallStatus('disconnected');
          stopAllSounds();
        }
      }
    };

    startOutgoing();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [isOpen, direction]);

  useEffect(() => {
    if (!isOpen || direction !== 'incoming') return;

    playSound('ringtone.mp3', true);

    const channel = supabase.channel(callChannelId);
    callChannelRef.current = channel;

    channel.on('broadcast', { event: 'offer' }, async (payload: any) => {
      if (payload.payload.userId !== contactId) return;
      const existingPc = pcRef.current;
      if (existingPc && existingPc.remoteDescription && payload.payload.iceRestart) {
        try {
          await existingPc.setRemoteDescription(new RTCSessionDescription(payload.payload.sdp));
          const answer = await existingPc.createAnswer();
          await existingPc.setLocalDescription(answer);
          sendToCallChannel('answer', { sdp: existingPc.localDescription, userId });
          resetReconnectState();
        } catch (err) {
          console.warn('Failed to handle re-offer:', err);
        }
        return;
      }
      pendingOfferRef.current = payload.payload.sdp;
    });

    channel.on('broadcast', { event: 'ice-candidate' }, (payload: any) => {
      if (payload.payload.userId !== contactId) return;
      if (pcRef.current?.remoteDescription) {
        pcRef.current.addIceCandidate(new RTCIceCandidate(payload.payload.candidate)).catch(() => {});
      } else {
        iceCandidatesQueue.current.push(payload.payload.candidate);
      }
    });

    channel.on('broadcast', { event: 'end-call' }, () => {
      cleanup();
      onClose();
    });

    channel.on('broadcast', { event: 'reaction' }, (payload: any) => {
      const id = `reaction-${reactionIdRef.current++}`;
      setReactions(prev => [...prev, { id, emoji: payload.payload.emoji, x: 15 + Math.random() * 70 }]);
      setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 2500);
    });

    channel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        channel.send({ type: 'broadcast', event: 'join', payload: { userId } });
      }
    });

    return () => {
      cleanup();
    };
  }, [isOpen, direction]);

  useEffect(() => {
    if (callStatus !== 'active') return;
    durationTimerRef.current = setInterval(() => setCallDuration(prev => prev + 1), 1000);
    return () => { if (durationTimerRef.current) clearInterval(durationTimerRef.current); };
  }, [callStatus]);

  useEffect(() => { localStream?.getAudioTracks().forEach(t => (t.enabled = !isMuted)); }, [isMuted, localStream]);
  useEffect(() => { localStream?.getVideoTracks().forEach(t => (t.enabled = !isCamOff)); }, [isCamOff, localStream]);

  // Force-play both video elements every time their streams change or
  // when the call becomes active (fixes race where stream is set before
  // the <video> element mounts because isActive was false).
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream, callStatus]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, callStatus]);

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getLocalVideoStyle = () => {
    if (backgroundMode === 'blur-soft') return { filter: 'blur(4px) brightness(0.9)' };
    if (backgroundMode === 'blur-strong') return { filter: 'blur(12px) brightness(0.7)' };
    if (backgroundMode === 'warm') return { filter: 'sepia(0.4) saturate(1.2) brightness(1.05)' };
    if (backgroundMode === 'cool') return { filter: 'hue-rotate(180deg) saturate(0.8) brightness(0.9)' };
    return {};
  };

  const getLocalContainerStyle = () => {
    if (backgroundMode === 'gradient') {
      return {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      };
    }
    return {};
  };

  if (!isOpen) return null;

  const isRinging = callStatus === 'ringing';
  const isConnecting = callStatus === 'connecting';
  const isActive = callStatus === 'active';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-xl p-4 select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="relative bg-slate-900 border border-slate-800 text-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl h-[80vh] flex flex-col justify-between"
        >
          {/* Header status */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
            <span className="flex items-center gap-1.5 bg-slate-950/45 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wider text-[#0084ff] backdrop-blur-md">
              <span className={`w-2 h-2 rounded-full ${isReconnecting ? 'bg-amber-400' : isActive ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
              {isReconnecting ? 'Reconectando...' : isRinging ? (isVideoCall ? 'Videollamada entrante' : 'Llamada entrante') : isConnecting ? 'Llamando...' : isActive ? (isVideoCall ? 'En videollamada' : 'En llamada') : 'Desconectado'}
            </span>
          </div>

          {/* Video area */}
          <div className="flex-1 relative bg-slate-950">
            {remoteStream && isVideoCall ? (
              <>
                <video ref={remoteVideoRef} autoPlay playsInline controls={false} className="absolute inset-0 w-full h-full object-cover" />
                {/* Floating reactions overlay */}
                {reactions.map(r => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 1, y: 0, scale: 0.5, rotateZ: -15 }}
                    animate={{ opacity: 0, y: -120, scale: 1.6, rotateZ: 15 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 2.2, ease: 'easeOut' }}
                    className="absolute bottom-16 text-4xl pointer-events-none z-30 drop-shadow-2xl"
                    style={{ left: `${r.x}%` }}
                  >
                    {r.emoji}
                  </motion.div>
                ))}
              </>
            ) : (
              <>
                {/* Hidden remote media for audio calls — no gray play button */}
                {remoteStream && !isVideoCall && (
                  <div style={{ width: 0, height: 0, overflow: 'hidden', position: 'absolute' }}>
                    <video ref={remoteVideoRef} autoPlay playsInline controls={false} />
                  </div>
                )}
                {/* Avatar center */}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  {contactAvatar ? (
                    <div className={`${isRinging || isConnecting ? 'animate-pulse' : ''} rounded-full border-2 border-white/20 overflow-hidden`}>
                      <img src={contactAvatar} alt={contactName} className="w-28 h-28 object-cover" />
                    </div>
                  ) : (
                    <div className="w-28 h-28 rounded-full border-2 border-white/20 bg-slate-700 flex items-center justify-center text-4xl font-bold text-white/60">
                      {contactName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {isActive && !isVideoCall && (
                    <p className="text-xs text-slate-400 font-medium">{contactName}</p>
                  )}
                </div>
                {/* Reactions on audio calls too */}
                {reactions.map(r => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 1, y: 0, scale: 0.5, rotateZ: -15 }}
                    animate={{ opacity: 0, y: -120, scale: 1.6, rotateZ: 15 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 2.2, ease: 'easeOut' }}
                    className="absolute bottom-16 text-4xl pointer-events-none z-30 drop-shadow-2xl"
                    style={{ left: `${r.x}%` }}
                  >
                    {r.emoji}
                  </motion.div>
                ))}
              </>
            )}

            {localStream && isActive && isVideoCall && (
              <div
                className="absolute top-16 right-4 w-28 h-40 bg-slate-950 border border-white/10 rounded-2xl overflow-hidden shadow-xl z-10"
                style={getLocalContainerStyle()}
              >
                <video ref={localVideoRef} autoPlay playsInline muted controls={false} className="w-full h-full object-cover" style={getLocalVideoStyle()} />
              </div>
            )}

            {errorMsg && (
              <div className="absolute bottom-4 left-0 right-0 text-center text-rose-400 text-xs font-medium px-4 z-40">
                {errorMsg}
              </div>
            )}

            {/* Connecting dots */}
            {isConnecting && (
              <div className="absolute bottom-20 left-0 right-0 flex justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#0084ff] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#0084ff] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#0084ff] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="bg-slate-950/70 border-t border-white/5 p-8 flex flex-col items-center space-y-6 backdrop-blur-md z-40">
            {isRinging ? (
              <div className="flex items-center gap-6">
                <button onClick={() => { cleanup(); onRejectCall?.(); onClose(); }} className="flex flex-col items-center gap-1.5">
                  <span className="p-4 bg-rose-500 hover:bg-rose-600 active:scale-95 transition-all text-white rounded-full shadow-lg shadow-rose-500/20">
                    <PhoneOff className="w-5 h-5" />
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Rechazar</span>
                </button>
                <button onClick={handleAnswer} className="flex flex-col items-center gap-1.5">
                  <span className={`p-4 active:scale-95 transition-all text-white rounded-full shadow-lg ${isVideoCall ? 'bg-[#0084ff] hover:bg-[#0073e6] shadow-[#0084ff]/20' : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'}`}>
                    {isVideoCall ? <Video className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">{isVideoCall ? 'Video' : 'Responder'}</span>
                </button>
              </div>
            ) : isConnecting ? (
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs font-semibold tracking-wide text-white/70">{contactName}</p>
                <p className="text-[11px] text-[#0084ff]/80 font-medium tracking-widest">
                  Llamando<span className="animate-pulse" style={{ animationDelay: '0ms' }}>.</span>
                  <span className="animate-pulse" style={{ animationDelay: '200ms' }}>.</span>
                  <span className="animate-pulse" style={{ animationDelay: '400ms' }}>.</span>
                </p>
                <button onClick={handleHangup} className="flex flex-col items-center gap-1.5 mt-2">
                  <span className="p-4 bg-rose-500 hover:bg-rose-600 active:scale-95 transition-all text-white rounded-full shadow-lg shadow-rose-500/30 ring-2 ring-rose-500/30">
                    <PhoneOff className="w-5 h-5" />
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Cancelar</span>
                </button>
              </div>
            ) : isActive ? (
              <div className="flex flex-col items-center gap-4 w-full">
                <p className="text-xs text-slate-400 font-medium">{contactName} • {formatDuration(callDuration)}</p>
                <div className="flex items-center gap-3">
                  {/* Speaker */}
                  <button onClick={() => setIsSpeakerOn(!isSpeakerOn)} className={`p-3 rounded-full border transition-all ${isSpeakerOn ? 'bg-slate-800 border-slate-700 text-white' : 'bg-transparent border-white/10 text-slate-400'}`}>
                    {isSpeakerOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>
                  {/* Mute */}
                  <button onClick={() => setIsMuted(!isMuted)} className={`p-3 rounded-full border transition-all ${isMuted ? 'bg-rose-500/15 border-rose-500/20 text-rose-500' : 'bg-slate-800 border-slate-700 text-white'}`}>
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                  {/* Camera — only for video calls */}
                  {isVideoCall && (
                  <button onClick={() => { setIsCamOff(!isCamOff); localStream?.getVideoTracks().forEach(t => t.enabled = isCamOff); }} className={`p-3 rounded-full border transition-all ${isCamOff ? 'bg-rose-500/15 border-rose-500/20 text-rose-500' : 'bg-slate-800 border-slate-700 text-white'}`}>
                    {isCamOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                  </button>
                  )}
                  {/* Background — only for video calls */}
                  {isVideoCall && (
                  <div className="relative">
                    <button onClick={() => { setShowBgPicker(!showBgPicker); setShowReactionPicker(false); }} className={`p-3 rounded-full border transition-all ${backgroundMode !== 'none' ? 'bg-violet-500/15 border-violet-500/20 text-violet-400' : 'bg-slate-800 border-slate-700 text-white'}`}>
                      <Palette className="w-4 h-4" />
                    </button>
                    {showBgPicker && (
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 rounded-xl p-2 shadow-xl flex gap-1.5 z-50">
                        {BACKGROUND_OPTIONS.map(opt => (
                          <button key={opt.id} onClick={() => { setBackgroundMode(opt.id); setShowBgPicker(false); }} className={`text-[18px] w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/10 ${backgroundMode === opt.id ? 'bg-violet-500/30 ring-1 ring-violet-400' : ''}`} title={opt.name}>
                            {opt.icon}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  )}
                  {/* Reactions */}
                  <div className="relative">
                    <button onClick={() => { setShowReactionPicker(!showReactionPicker); setShowBgPicker(false); }} className="p-3 rounded-full border bg-slate-800 border-slate-700 text-white transition-all hover:bg-slate-700">
                      <SmilePlus className="w-4 h-4" />
                    </button>
                    {showReactionPicker && (
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 rounded-xl p-2 shadow-xl flex gap-1 z-50">
                        {REACTION_EMOJIS.map(emoji => (
                          <button key={emoji} onClick={() => { sendReaction(emoji); setShowReactionPicker(false); }} className="text-xl w-8 h-8 rounded-lg hover:bg-white/10 transition-all flex items-center justify-center hover:scale-125">
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Hangup */}
                  <button onClick={handleHangup} className="p-4 bg-rose-500 hover:bg-rose-600 hover:scale-105 active:scale-95 transition-all text-white rounded-full shadow-lg shadow-rose-500/20">
                    <PhoneOff className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs text-slate-400">Llamada finalizada</p>
                <button onClick={() => { cleanup(); onClose(); }} className="text-xs text-[#0084ff] underline cursor-pointer">Cerrar</button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
