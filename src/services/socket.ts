import { supabase } from '../lib/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type MessageHandler = (data: { chatId: string; sender: string; text: string; time: string; id: string }) => void;
type NewChatHandler = (data: { message: { id: string; sender: string; text: string; time: string }; chatId: string }) => void;
type StatusUpdateHandler = (data: { messageId: string; status: string; chatId: string }) => void;

let messageHandler: MessageHandler | null = null;
let newChatHandler: NewChatHandler | null = null;
let statusUpdateHandler: StatusUpdateHandler | null = null;
let channel: any = null;
let userId: string = '';

export function connectSocket(uid: string) {
  if (channel) return channel;
  userId = uid;

  channel = supabase
    .channel('messages-realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      (payload: RealtimePostgresChangesPayload<any>) => {
        const msg = payload.new;
        if (msg.sender_id === userId) return;

        // Mark as delivered when received
        supabase
          .from('messages')
          .update({ status: 'delivered' })
          .eq('id', msg.id)
          .then(() => {});

        if (messageHandler) {
          messageHandler({
            chatId: msg.chat_id,
            sender: 'them',
            text: msg.text,
            time: msg.created_at,
            id: msg.id,
          });
        }

        if (newChatHandler) {
          newChatHandler({
            message: { id: msg.id, sender: 'them', text: msg.text, time: msg.created_at },
            chatId: msg.chat_id,
          });
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages' },
      (payload: RealtimePostgresChangesPayload<any>) => {
        const msg = payload.new;
        if (msg.sender_id !== userId) return; // Only sender cares about status updates

        if (statusUpdateHandler) {
          statusUpdateHandler({
            messageId: msg.id,
            status: msg.status,
            chatId: msg.chat_id,
          });
        }
      }
    )
    .subscribe();

  return channel;
}

export function getSocket() {
  return channel;
}

export function setMessageHandler(handler: MessageHandler) {
  messageHandler = handler;
}

export function setNewChatHandler(handler: NewChatHandler) {
  newChatHandler = handler;
}

export function setStatusUpdateHandler(handler: StatusUpdateHandler) {
  statusUpdateHandler = handler;
}

export function disconnectSocket() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  messageHandler = null;
  newChatHandler = null;
  statusUpdateHandler = null;
  userId = '';
}
