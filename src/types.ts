export interface Message {
  id: string;
  sender: 'me' | 'them';
  senderId?: string;
  senderName?: string;
  text: string;
  time: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  audioUrl?: string;
  audioDuration?: number;
  mimeType?: string;
  imageUrl?: string;
  videoUrl?: string;
  isEdited?: boolean;
  isDeleted?: boolean;
  replyToId?: string;
  replyToText?: string;
  replyToSender?: string;
  isEphemeral?: boolean;
  ephemeralExpiresAt?: string;
  readBy?: { userId: string; name: string; readAt: string }[];
  hasBeenViewed?: boolean;
  pollId?: string;
  stickerUrl?: string;
  gifUrl?: string;
  isAnimated?: boolean;
}

export interface PollOption {
  id: string;
  encuesta_id: string;
  option_text: string;
  image_url?: string;
  created_at: string;
  voteCount?: number;
  voted?: boolean;
}

export interface Poll {
  id: string;
  title: string;
  description?: string;
  created_by: string;
  multiple_choice: boolean;
  starts_at: string;
  expires_at?: string;
  created_at: string;
  options: PollOption[];
  totalVotes: number;
}

export interface Chat {
  id: string;
  name: string;
  avatar: string;
  avatarColor?: string;
  lastMessage: string;
  lastMessageStatus?: 'sending' | 'sent' | 'delivered' | 'read';
  time: string;
  unreadCount: number;
  isOnline: boolean;
  phone: string;
  username: string;
  bio: string;
  messages: Message[];
  profileId?: string;
  isGroup?: boolean;
  participantIds?: string[];
  adminId?: string;
  isBlocked?: boolean;
}

export interface UserProfile {
  name: string;
  avatar: string;
  phone: string;
  username: string;
  bio: string;
  realEmail?: string;
  fontPreference?: string;
  chatStyle?: string;
  bubbleColor?: string;
  partnerBubbleColor?: string;
  privacyLastSeen?: 'everyone' | 'contacts' | 'nobody';
  privacyOnline?: 'everyone' | 'contacts' | 'nobody';
  privacyReadReceipts?: boolean;
}

export interface MomentAnimMeta {
  textContent?: string;
  textAnimation?: string;
  textAnimationSpeed?: number;
  textFont?: string;
  textFontSize?: number;
  textColor?: string;
  textPositionX?: number;
  textPositionY?: number;
  textBg?: string;
  activeFilter?: string;
}

export interface Moment {
  id: string;
  name: string;
  avatar: string;
  avatarColor?: string;
  time: string;
  hasUnseen: boolean;
  image: string;
  caption: string;
  profileId?: string;
  viewCount?: number;
  reactions?: { emoji: string; count: number }[];
  animMeta?: MomentAnimMeta;
}

export interface InterestNews {
  id: string;
  category: string;
  title: string;
  source: string;
  time: string;
  likes: number;
  image?: string;
}

export interface ProductItem {
  id: string;
  name: string;
  price: string;
  salesCount: number;
  image: string;
  description: string;
}

export type ActiveTab = 
  | 'auth' 
  | 'chats' 
  | 'moments' 
  | 'broadcasts' 
  | 'interests' 
  | 'emprendedor' 
  | 'profile';

export interface BroadcastChannel {
  id: string;
  name: string;
  description: string;
  avatar_url: string;
  admin_id: string;
  created_at: string;
  subscriber_count?: number;
  is_subscribed?: boolean;
  admin_name?: string;
}

export interface BroadcastMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  text: string;
  created_at: string;
}

export interface ChatStyle {
  bubbleColor: string;
  bubbleBackground: string;
  partnerBubbleColor: string;
}

export interface BusinessListing {
  id: string;
  businessName: string;
  description: string;
  imageUrls: string[];
  zone: string;
  category: string;
  contactName: string;
  contactPhone: string;
  userId?: string;
  bgMusicUrl?: string;
  bgMusicName?: string;
  layout?: 'card' | 'poster' | 'grid';
}

export interface AutoReplyConfig {
  enabled: boolean;
  message: string;
  delay: number;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  position: number;
}

export interface CallLog {
  id: string;
  chatId?: string;
  callerId: string;
  calleeId: string;
  callType: 'audio' | 'video';
  status: 'missed' | 'answered' | 'ended' | 'rejected' | 'cancelled' | 'ringing';
  startedAt: string;
  endedAt?: string;
  duration: number;
  contactName: string;
  contactAvatar: string;
  isIncoming: boolean;
}
