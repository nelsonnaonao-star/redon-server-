import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found in env vars. Create a .env file based on .env.example');
}

export const supabase = createClient(
  supabaseUrl || 'https://akgsylutbpgolurkcavh.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrZ3N5bHV0YnBnb2x1cmtjYXZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4NjEzMTUsImV4cCI6MjA5NjQzNzMxNX0.2HhVDU7YYHM7zpcN8Moh8QCwEwhMH5bPj6leFqxzApo'
);
