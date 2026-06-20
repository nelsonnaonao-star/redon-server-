import { supabase } from './supabase';
import { getChats, sendMessage } from '../services/chatService';
import { getMoments, addMoment } from '../services/momentService';
import { getInterestNews } from '../services/interestNewsService';
import { getProducts } from '../services/productService';
import { getProfile, updateProfile } from '../services/profileService';
import type { Chat, UserProfile, Moment, InterestNews, ProductItem } from '../types';

const CURRENT_PROFILE_ID = 'a0aad7b6-872c-4b9f-a675-b4e739750bad';

function emptyProfile(): UserProfile {
  return { name: '', avatar: '', phone: '', username: '', bio: '' };
}

export async function loadProfile(): Promise<UserProfile> {
  const profile = await getProfile(CURRENT_PROFILE_ID);
  return profile || emptyProfile();
}

export async function loadChats(): Promise<Chat[]> {
  try {
    const chats = await getChats(CURRENT_PROFILE_ID);
    if (chats.length > 0) return chats;
  } catch {}
  return [];
}

export async function loadMoments(): Promise<Moment[]> {
  try {
    const moments = await getMoments();
    if (moments.length > 0) return moments;
  } catch {}
  return [];
}

export async function loadInterestNews(): Promise<InterestNews[]> {
  try {
    const news = await getInterestNews();
    if (news.length > 0) return news;
  } catch {}
  return [];
}

export async function loadProducts(): Promise<ProductItem[]> {
  try {
    const products = await getProducts();
    if (products.length > 0) return products;
  } catch {}
  return [];
}

export async function saveMessage(chatId: string, text: string) {
  try {
    const { data } = await sendMessage(chatId, CURRENT_PROFILE_ID, text);
    return data;
  } catch {}
  return null;
}

export async function saveProfile(profile: Partial<UserProfile>) {
  try {
    await updateProfile(CURRENT_PROFILE_ID, profile);
  } catch {}
}

export async function saveMoment(moment: Omit<Moment, 'id' | 'time'>) {
  try {
    await addMoment(moment, CURRENT_PROFILE_ID);
  } catch {}
}
