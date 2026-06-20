import { supabase } from '../lib/supabase';
import type { ProductItem } from '../types';

export async function getProducts(): Promise<ProductItem[]> {
  const { data, error } = await supabase
    .from('product_items')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((p: any) => ({
    id: p.id,
    name: p.name || '',
    price: p.price || '',
    salesCount: p.sales_count || 0,
    image: p.image || '',
    description: p.description || '',
  }));
}
