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

function formatDisplayTime(dateStr: string): string {
  if (!dateStr) return '';
  if (!dateStr.includes('T') && !dateStr.includes('-')) return dateStr;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleTimeString('es-ES', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

function AudioPlayer({ msg, isMe }: { msg: Message; isMe: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
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
      audio.playbackRate = playbackRate;
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

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(next);
    if (audioRef.current) {
      audioRef.current.playbackRate = next;
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
    <div className="flex items-center gap-1.5 w-full max-w-[280px] select-none">
      <button
        onClick={togglePlay}
        className={`w-6 h-6 min-w-[24px] rounded-full flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
          isMe ? 'bg-white/25 hover:bg-white/35 text-white' : 'bg-[#3390ec] hover:bg-[#2b7bc9] text-white'
        }`}
      >
        {isPlaying ? <Pause className="w-2.5 h-2.5 fill-current" /> : <Play className="w-2.5 h-2.5 fill-current ml-0.5" />}
      </button>

      <div className={`flex-1 h-[3px] rounded-full ${isMe ? 'bg-white/20' : 'bg-slate-200'} overflow-hidden`}>
        <div
          className={`h-full rounded-full transition-all duration-300 ${isMe ? 'bg-white/70' : 'bg-[#3390ec]'}`}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
      </div>

      <span className={`text-[10px] font-mono font-medium w-7 text-right flex-shrink-0 ${isMe ? 'text-white/75' : 'text-slate-500'}`}>
        {formatTime(displayCurrent)}
      </span>

      <button
        onClick={cycleSpeed}
        className={`text-[8px] font-bold px-1 py-0.5 rounded-full flex-shrink-0 transition-all cursor-pointer select-none ${
          isMe
            ? playbackRate !== 1 ? 'bg-white/25 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'
            : playbackRate !== 1 ? 'bg-[#3390ec] text-white' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
        }`}
        title="Velocidad de reproducción"
      >
        {playbackRate}x
      </button>

      <div className="flex items-center gap-0.5 flex-shrink-0">
        {msg.isEdited && (
          <span className={`text-[7px] leading-none font-medium ${isMe ? 'text-white/50' : 'text-slate-400'}`}>
            (editado)
          </span>
        )}
        <span className={`text-[8px] leading-none font-medium ${isMe ? 'text-white/60' : 'text-slate-400'}`}>
          {formatDisplayTime(msg.time)}
        </span>
        {isMe && (
          <span className={`leading-none ${msg.status === 'read' ? 'text-[#53bdeb]' : 'text-white/70'}`}>
            {msg.status === 'delivered' || msg.status === 'read' ? (
              <CheckCheck className="w-2.5 h-2.5" />
            ) : (
              <Check className="w-2.5 h-2.5" />
            )}
          </span>
        )}
      </div>
    </div>
  );
}

function isOnlyEmojis(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 10) return false;
  return [...t].every(ch => /\p{Emoji}/u.test(ch));
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
  const onlyEmojis = !msg.audioUrl && isOnlyEmojis(msg.text);

  if (msg.isDeleted) {
    return (
      <div
        className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} mb-2`}
      >
        <div
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onDoubleClick={onDoubleClick}
          className={`p-3 rounded-2xl w-fit max-w-[75%] shadow-sm relative transition-all duration-105 active:scale-[0.985] cursor-pointer select-none ${
            isMe
              ? 'text-white bg-red-600/80 rounded-tr-none'
              : 'bg-slate-100 rounded-tl-none border border-slate-200/50'
          }`}
        >
          <p className="text-sm leading-relaxed italic text-slate-400 dark:text-slate-500 font-normal select-none">
            🚫 Este mensaje fue eliminado
          </p>
        </div>
      </div>
    );
  }

  if (onlyEmojis) {
    return (
      <div
        className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} mb-2`}
      >
        <div
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onDoubleClick={onDoubleClick}
          className="relative select-none flex flex-col"
        >
          <span className="text-5xl leading-none">{msg.text.trim()}</span>
          <div className="flex items-center gap-1 mt-0.5 self-end">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 select-none font-medium">
              {formatDisplayTime(msg.time)}
            </span>
            {isMe && (
              <span className={msg.status === 'read' ? 'text-[#53bdeb]' : 'text-slate-400 dark:text-slate-500'}>
                {msg.status === 'delivered' || msg.status === 'read' ? (
                  <CheckCheck className="w-3.5 h-3.5" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
              </span>
            )}
          </div>
          {messageReaction && (
            <div className="absolute -bottom-3 -right-2 bg-white dark:bg-slate-700 border border-slate-200/50 dark:border-slate-600 text-slate-900 dark:text-white rounded-full px-1.5 py-0.5 text-xs shadow-sm flex items-center justify-center select-none z-10">
              {messageReaction}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (msg.audioUrl) {
    return (
      <div
        className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} mb-2 anim-fade-in`}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onDoubleClick={onDoubleClick}
          className={`${
            isMe
              ? `text-white py-1.5 px-3 rounded-2xl rounded-tr-none shadow-sm ${chatStyle.bubbleColor}`
              : `${chatStyle.partnerBubbleColor || 'bg-slate-100 dark:bg-slate-800'} py-1.5 px-3 rounded-2xl rounded-tl-none shadow-sm border border-slate-200/50 dark:border-slate-700/60`
          } w-fit max-w-[75%] relative transition-all duration-105 active:scale-[0.985] cursor-pointer select-none`}
          style={isMe ? { background: 'var(--bubble-color)' } : {}}
        >
          <AudioPlayer msg={msg} isMe={isMe} />
          {messageReaction && (
            <div className="absolute -bottom-2.5 -right-1.5 bg-white dark:bg-slate-700 border border-slate-200/50 dark:border-slate-600 text-slate-900 dark:text-white rounded-full px-1.5 py-0.5 text-xs shadow-sm flex items-center justify-center select-none z-10">
              {messageReaction}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Plain text message
  return (
    <div className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} mb-2 anim-fade-in`}>
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
            ? 'bg-blue-600 text-white py-1 px-3.5 rounded-[16px] rounded-br-[2px] text-[15px] shadow-sm max-w-[75%] w-fit ml-auto relative transition-all duration-105 active:scale-[0.985] cursor-pointer select-none leading-snug'
            : 'bg-white text-gray-800 py-1 px-3.5 rounded-[16px] rounded-bl-[2px] text-[15px] shadow-sm max-w-[75%] w-fit mr-auto relative transition-transform duration-105 active:scale-[0.985] cursor-pointer select-none leading-snug border border-slate-200/50'
        }
      >
        <p className="break-words whitespace-pre-wrap">
          {msg.text}
        </p>
        <div className={`flex items-center gap-1 mt-0.5 ${isMe ? 'justify-end' : 'justify-end'}`}>
          {msg.isEdited && (
            <span className={`text-[9px] font-medium leading-none ${isMe ? 'text-white/60' : 'text-slate-400'}`}>
              (editado)
            </span>
          )}
          <span className={`text-[10px] select-none font-medium leading-none ${isMe ? 'text-white/70' : 'text-slate-400'}`}>
            {formatDisplayTime(msg.time)}
          </span>
          {isMe && (
            <span className={`leading-none ${msg.status === 'read' ? 'text-[#53bdeb]' : 'text-white/80'}`}>
              {msg.status === 'delivered' || msg.status === 'read' ? (
                <CheckCheck className="w-3 h-3" />
              ) : (
                <Check className="w-3 h-3" />
              )}
            </span>
          )}
        </div>
        {messageReaction && (
          <div className="absolute -bottom-2.5 -right-1.5 bg-white dark:bg-slate-700 border border-slate-200/50 dark:border-slate-600 text-slate-900 dark:text-white rounded-full px-1.5 py-0.5 text-xs shadow-sm flex items-center justify-center select-none z-10">
            {messageReaction}
          </div>
        )}
      </div>
    </div>
  );
}
