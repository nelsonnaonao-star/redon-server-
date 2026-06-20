import React, { useRef, useState, useEffect } from 'react';
import { Message, ChatStyle } from '../types';
import { Check, CheckCheck, Play, Pause } from 'lucide-react';

interface MessageBubbleProps {
  msg: Message;
  isMe: boolean;
  chatStyle: ChatStyle;
  messageReaction?: string;
  onMouseDown: () => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
  onTouchStart: () => void;
  onTouchEnd: () => void;
  onDoubleClick: () => void;
}

function AudioPlayer({ msg, isMe }: { msg: Message; isMe: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const duration = msg.audioDuration || 0;

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current && msg.audioUrl) {
      const audio = new Audio(msg.audioUrl);
      audioRef.current = audio;
      audio.addEventListener('timeupdate', () => {
        setCurrentTime(audio.currentTime);
      });
      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        setCurrentTime(0);
      });
      audio.play().catch(() => {});
      setIsPlaying(true);
    } else if (audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const displayCurrent = isPlaying || currentTime > 0 ? currentTime : duration;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={togglePlay}
        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
          isMe ? 'bg-white/25 hover:bg-white/35 text-white' : 'bg-[#3390ec] hover:bg-[#2b7bc9] text-white'
        }`}
      >
        {isPlaying ? <Pause className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current ml-0.5" />}
      </button>

      <div className={`flex-1 h-1 rounded-full ${isMe ? 'bg-white/25' : 'bg-slate-200'} overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all duration-300 ${isMe ? 'bg-white/80' : 'bg-[#3390ec]'}`}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      <span className={`text-[10px] font-mono font-medium min-w-[28px] text-right ${isMe ? 'text-white/70' : 'text-slate-400'}`}>
        {formatTime(displayCurrent)}
      </span>
    </div>
  );
}

export default function MessageBubble({
  msg,
  isMe,
  chatStyle,
  messageReaction,
  onMouseDown,
  onMouseUp,
  onMouseLeave,
  onTouchStart,
  onTouchEnd,
  onDoubleClick,
}: MessageBubbleProps) {
  const bubbleColorClass = isMe ? chatStyle.bubbleColor : '';

  return (
      <div
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onDoubleClick={onDoubleClick}
        title="Mantén pulsado o haz doble clic para reaccionar"
        className={
          isMe
            ? `text-white ${msg.audioUrl ? 'py-1.5 px-2.5' : 'p-3'} rounded-2xl rounded-tr-none self-end max-w-[80%] mb-2 shadow-sm relative transition-all duration-105 active:scale-[0.985] cursor-pointer select-none flex flex-col gap-0.5 ${bubbleColorClass}`
            : `bg-slate-100 dark:bg-slate-800 ${msg.audioUrl ? 'py-1.5 px-2.5' : 'p-3'} rounded-2xl rounded-tl-none self-start max-w-[80%] mb-2 shadow-sm border border-slate-200/50 dark:border-slate-700/60 relative transition-transform duration-105 active:scale-[0.985] cursor-pointer select-none flex flex-col gap-0.5`
        }
        style={
          isMe
            ? { background: 'var(--bubble-color)' }
            : {}
        }
      >
        {msg.audioUrl ? (
          <>
            <AudioPlayer msg={msg} isMe={isMe} />
            <span className={`text-[9px] font-normal ${isMe ? 'text-white/60' : 'text-slate-400'}`}>Mensaje de voz</span>
          </>
        ) : (
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap font-normal">
            {msg.text}
          </p>
        )}

      {/* Message Metadata */}
      <div className="flex items-center justify-end gap-1 mt-1 flex-shrink-0 self-end">
        <span
          className={`text-[10px] select-none font-medium ${
            isMe ? 'text-white/85' : 'text-slate-400 dark:text-slate-400'
          }`}
        >
          {msg.time}
        </span>
        {isMe && (
          <span className="text-white/90">
            {msg.status === 'read' || msg.status === 'delivered' ? (
              <CheckCheck className="w-3.5 h-3.5" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
          </span>
        )}
      </div>

      {/* Reaction badge */}
      {messageReaction && (
        <div className="absolute -bottom-2.5 -right-1.5 bg-white dark:bg-slate-700 border border-slate-200/50 dark:border-slate-600 text-slate-900 dark:text-white rounded-full px-1.5 py-0.5 text-xs shadow-sm flex items-center justify-center select-none z-10 transition-all duration-300 scale-100 animate-bounce">
          {messageReaction}
        </div>
      )}
    </div>
  );
}
