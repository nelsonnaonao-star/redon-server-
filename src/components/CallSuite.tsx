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
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  const turnUrl = import.meta.env.VITE_TURN_URL || '';
  const turnUser = import.meta.env.VITE_TURN_USERNAME || '';
  const turnCred = import.meta.env.VITE_TURN_CREDENTIAL || '';
  if (turnUrl) {
    servers.push({ urls: turnUrl, username: turnUser, credential: turnCred });
  }

  return { iceServers: servers };
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
  onAcceptCall,
  onRejectCall,
}) => {
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

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callChannelRef = useRef<any>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iceCandidatesQueue = useRef<any[]>([]);
  const offerRetryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingOfferRef = useRef<any>(null);

  const callChannelId = `call:${chatId}`;

  const cleanup = useCallback(() => {
    stopAllSounds();
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    if (offerRetryRef.current) clearInterval(offerRetryRef.current);
    if (callChannelRef.current) {
      supabase.removeChannel(callChannelRef.current);
      callChannelRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    setLocalStream(null);
    if (remoteStream) remoteStream.getTracks().forEach(t => t.stop());
    setRemoteStream(null);
  }, [localStream, remoteStream]);

  const handleHangup = useCallback(() => {
    if (callChannelRef.current) {
      supabase.channel(callChannelId)
        .send({ type: 'broadcast', event: 'end-call', payload: { userId } })
        .catch(() => {});
    }
    cleanup();
    onClose();
  }, [cleanup, onClose, userId, callChannelId]);

  const sendReaction = (emoji: string) => {
    if (callChannelRef.current) {
      callChannelRef.current.send({
        type: 'broadcast',
        event: 'reaction',
        payload: { emoji, userId }
      });
    }
    // Also show locally
    const id = `reaction-${reactionIdRef.current++}`;
    setReactions(prev => [...prev, { id, emoji, x: 15 + Math.random() * 70 }]);
    setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 2500);
  };

  const handleAnswer = useCallback(async () => {
    try {
      stopAllSounds();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: !isCamOff });
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = new RTCPeerConnection(getIceConfig());
      pcRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        setRemoteStream(remoteStream);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          supabase.channel(callChannelId)
            .send({ type: 'broadcast', event: 'ice-candidate', payload: { candidate: event.candidate, userId } })
            .catch(() => {});
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected') {
          setCallStatus('active');
        } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
          handleHangup();
        }
      };

      if (pendingOfferRef.current) {
        await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      supabase.channel(callChannelId)
        .send({ type: 'broadcast', event: 'answer', payload: { sdp: pc.localDescription, userId } })
        .catch(() => {});

      for (const c of iceCandidatesQueue.current) {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      }
      iceCandidatesQueue.current = [];

      setCallStatus('active');
      onAcceptCall?.();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar');
      handleHangup();
    }
  }, [isCamOff, handleHangup, callChannelId, userId, onAcceptCall]);

  useEffect(() => {
    if (!isOpen || direction !== 'outgoing') return;

    let cancelled = false;

    const startOutgoing = async () => {
      try {
        playSound('ringtone.mp3', true);

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: !isCamOff });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const pc = new RTCPeerConnection(getIceConfig());
        pcRef.current = pc;

        stream.getTracks().forEach(track => pc.addTrack(track, stream));

        pc.ontrack = (event) => {
          const [remoteStream] = event.streams;
          setRemoteStream(remoteStream);
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            supabase.channel(callChannelId)
              .send({ type: 'broadcast', event: 'ice-candidate', payload: { candidate: event.candidate, userId } })
              .catch(() => {});
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === 'connected') {
            stopAllSounds();
            setCallStatus('active');
          } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
            handleHangup();
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
        });

        channel.on('broadcast', { event: 'answer' }, (payload: any) => {
          if (payload.payload.userId !== contactId) return;
          pc.setRemoteDescription(new RTCSessionDescription(payload.payload.sdp)).catch(() => {});
          for (const c of iceCandidatesQueue.current) {
            pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
          }
          iceCandidatesQueue.current = [];
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

        channel.on('broadcast', { event: 'reaction' }, (payload: any) => {
          const id = `reaction-${reactionIdRef.current++}`;
          setReactions(prev => [...prev, { id, emoji: payload.payload.emoji, x: 15 + Math.random() * 70 }]);
          setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 2500);
        });

        channel.subscribe();

        offerRetryRef.current = setInterval(() => {
          channel.send({ type: 'broadcast', event: 'offer', payload: { sdp: pc.localDescription, userId } });
        }, 2000);
      } catch (err: any) {
        if (!cancelled) {
          setErrorMsg(err.message || 'Error al iniciar llamada');
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

    channel.on('broadcast', { event: 'offer' }, (payload: any) => {
      if (payload.payload.userId !== contactId) return;
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
              <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
              {isRinging ? 'Llamada entrante' : isConnecting ? 'Llamando...' : isActive ? 'En llamada' : 'Desconectado'}
            </span>
          </div>

          {/* Video area */}
          <div className="flex-1 relative bg-slate-950">
            {remoteStream ? (
              <>
                <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
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
              <div className="absolute inset-0 flex items-center justify-center">
                <img src={contactAvatar} alt={contactName} className={`w-24 h-24 rounded-full border-2 border-white/20 object-cover ${isRinging ? 'animate-pulse' : ''}`} />
              </div>
            )}

            {localStream && isActive && (
              <div
                className="absolute top-16 right-4 w-28 h-40 bg-slate-950 border border-white/10 rounded-2xl overflow-hidden shadow-xl z-10"
                style={getLocalContainerStyle()}
              >
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={getLocalVideoStyle()} />
              </div>
            )}

            {errorMsg && <div className="absolute bottom-20 left-0 right-0 text-center text-rose-400 text-xs font-medium px-4">{errorMsg}</div>}

            {/* Connecting dots */}
            {isConnecting && (
              <div className="absolute bottom-24 left-0 right-0 flex justify-center gap-1.5">
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
                  <span className="p-4 bg-emerald-500 hover:bg-emerald-600 active:scale-95 transition-all text-white rounded-full shadow-lg shadow-emerald-500/20">
                    <Phone className="w-5 h-5" />
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Responder</span>
                </button>
              </div>
            ) : isConnecting ? (
              <div className="flex flex-col items-center gap-4">
                <p className="text-xs text-slate-400">{contactName}</p>
                <button onClick={handleHangup} className="flex flex-col items-center gap-1.5">
                  <span className="p-4 bg-rose-500 hover:bg-rose-600 active:scale-95 transition-all text-white rounded-full shadow-lg shadow-rose-500/20">
                    <PhoneOff className="w-5 h-5" />
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Colgar</span>
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
                  {/* Camera */}
                  <button onClick={() => { setIsCamOff(!isCamOff); localStream?.getVideoTracks().forEach(t => t.enabled = isCamOff); }} className={`p-3 rounded-full border transition-all ${isCamOff ? 'bg-rose-500/15 border-rose-500/20 text-rose-500' : 'bg-slate-800 border-slate-700 text-white'}`}>
                    {isCamOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                  </button>
                  {/* Background */}
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
