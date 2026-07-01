import React, { useState, useEffect } from 'react';
import { Phone, Video, PhoneOff, PhoneMissed, PhoneIncoming, ArrowLeft, Clock } from 'lucide-react';
import { CallLog } from '../types';
import { api } from '../services/api';

interface CallHistoryViewProps {
  userId: string;
  onBack: () => void;
}

function formatDuration(seconds: number): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatCallTime(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 0) return `Hoy ${time}`;
  if (diffDays === 1) return `Ayer ${time}`;
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'long', timeStyle: 'short' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', timeStyle: 'short' });
}

function statusIcon(status: string, isIncoming: boolean) {
  switch (status) {
    case 'missed':
      return { icon: PhoneMissed, color: 'text-rose-500', label: 'Perdida' };
    case 'rejected':
      return { icon: PhoneOff, color: 'text-rose-400', label: 'Rechazada' };
    case 'cancelled':
      return { icon: PhoneOff, color: 'text-amber-400', label: 'Cancelada' };
    case 'answered':
    case 'ended':
      return { icon: isIncoming ? PhoneIncoming : Phone, color: 'text-emerald-500', label: isIncoming ? 'Recibida' : 'Hecha' };
    default:
      return { icon: Phone, color: 'text-slate-400', label: status };
  }
}

export default function CallHistoryView({ userId, onBack }: CallHistoryViewProps) {
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'missed' | 'received' | 'made'>('all');

  useEffect(() => {
    if (!userId) return;
    api.getCallHistory(userId).then(data => {
      setCalls(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [userId]);

  const filtered = calls.filter(c => {
    if (filter === 'missed') return c.status === 'missed';
    if (filter === 'received') return c.isIncoming && c.status !== 'missed';
    if (filter === 'made') return !c.isIncoming;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 py-1">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all cursor-pointer">
          <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        </button>
        <h3 className="text-slate-900 dark:text-white font-bold text-base">Historial de llamadas</h3>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      ) : calls.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
            <Phone className="w-7 h-7" />
          </div>
          <p className="text-sm font-semibold">Sin llamadas</p>
          <p className="text-xs mt-1">Las llamadas aparecerán aquí</p>
        </div>
      ) : (
        <>
          <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {(['all', 'missed', 'received', 'made'] as const).map(f => {
              const labels = { all: 'Todas', missed: 'Perdidas', received: 'Recibidas', made: 'Hechas' };
              return (
                <button key={f} onClick={() => setFilter(f)}
                  className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    filter === f
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}>
                  {labels[f]}
                </button>
              );
            })}
          </div>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-400 dark:text-slate-500">
              <p className="text-xs">No hay llamadas en este filtro</p>
            </div>
          ) : (
          <div className="space-y-1">
            {filtered.map(call => {
            const { icon: StatusIcon, color, label } = statusIcon(call.status, call.isIncoming);
            return (
              <div key={call.id} className="flex items-center gap-3 py-3 px-1 hover:bg-slate-50/80 dark:hover:bg-slate-700/30 rounded-xl transition-all">
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex-shrink-0">
                  {call.contactAvatar ? (
                    <img src={call.contactAvatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm font-bold text-slate-500 dark:text-slate-400">
                      {call.contactName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 dark:text-slate-200 truncate">{call.contactName}</span>
                    {call.callType === 'video' ? <Video className="w-3 h-3 text-slate-400" /> : <Phone className="w-3 h-3 text-slate-400" />}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <StatusIcon className={`w-3.5 h-3.5 ${color}`} />
                    <span className={`text-[11px] font-medium ${color}`}>{label}</span>
                    {call.duration > 0 && (
                      <span className="text-[11px] text-slate-400 flex items-center gap-1 ml-1">
                        <Clock className="w-3 h-3" /> {formatDuration(call.duration)}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">{formatCallTime(call.startedAt)}</span>
              </div>
            );
          })}
          </div>
          )}
        </>
      )}
    </div>
  );
}