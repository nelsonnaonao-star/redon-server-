import React from 'react';
import { Message, ChatStyle } from '../types';
import { Check, CheckCheck } from 'lucide-react';

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
  // Application in real time: applies chatStyle.bubbleColor as a dynamic class when isMe is true.
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
          ? `text-white p-3 rounded-2xl rounded-tr-none self-end max-w-[80%] mb-2 shadow-sm relative transition-all duration-105 active:scale-[0.985] cursor-pointer select-none flex flex-col ${bubbleColorClass}`
          : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-3 rounded-2xl rounded-tl-none self-start max-w-[80%] mb-2 shadow-sm border border-slate-200/50 dark:border-slate-700/60 relative transition-transform duration-105 active:scale-[0.985] cursor-pointer select-none flex flex-col"
      }
      style={
        isMe
          ? {
              background: 'var(--bubble-color)',
            }
          : {}
      }
    >
      <p className="text-sm leading-relaxed break-words whitespace-pre-wrap font-normal">
        {msg.text}
      </p>

      {/* Message Metadata on the Balloon bottom */}
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

      {/* Reaction badge at the bottom-right corner of the balloon */}
      {messageReaction && (
        <div className="absolute -bottom-2.5 -right-1.5 bg-white dark:bg-slate-700 border border-slate-200/50 dark:border-slate-600 text-slate-900 dark:text-white rounded-full px-1.5 py-0.5 text-xs shadow-sm flex items-center justify-center select-none z-10 transition-all duration-300 scale-100 animate-bounce">
          {messageReaction}
        </div>
      )}
    </div>
  );
}
