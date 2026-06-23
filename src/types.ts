export interface Message {
  id: string;
  sender: 'me' | 'them';
  text: string;
  time: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  audioUrl?: string;
  audioDuration?: number;
  mimeType?: string;
  isEdited?: boolean;
  isDeleted?: boolean;
}

export interface Chat {
  id: string;
  name: string;
  avatar: string;
  avatarColor?: string;
  lastMessage: string;
  time: string;
  unreadCount: number;
  isOnline: boolean;
  phone: string;
  username: string;
  bio: string;
  messages: Message[];
  profileId?: string;
}

export interface UserProfile {
  name: string;
  avatar: string;
  phone: string;
  username: string;
  bio: string;
  realEmail?: string;
}

export interface MomentAnimMeta {
  textContent?: string;
  textAnimation?: string;
  textAnimationSpeed?: number;
  textFont?: string;
  textColor?: string;
  textPositionX?: number;
  textPositionY?: number;
  textBg?: boolean;
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
  | 'welcome' 
  | 'auth' 
  | 'chats' 
  | 'moments' 
  | 'interests' 
  | 'emprendedor' 
  | 'profile';

export interface ChatStyle {
  bubbleColor: string;
  bubbleBackground: string;
  partnerBubbleColor: string;
}

export interface BusinessListing {
  id: string;
  businessName: string;
  description: string;
  imageUrl: string;
  zone: string;
  category: string;
  contactName: string;
  contactPhone: string;
}


