import { createClient } from '@supabase/supabase-js';

// justin = database pusat (dipakai app creator-data-finder)
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase = url && key ? createClient(url, key) : null;
export const cloudConfigured = Boolean(supabase);

// usee-view = sumber data (untuk migrasi / sinkronisasi ke justin)
const useeViewUrl = import.meta.env.VITE_USEEVIEW_SUPABASE_URL as string | undefined;
const useeViewKey = import.meta.env.VITE_USEEVIEW_SUPABASE_ANON_KEY as string | undefined;

export const useeViewSupabase = useeViewUrl && useeViewKey ? createClient(useeViewUrl, useeViewKey) : null;
export const useeViewConfigured = Boolean(useeViewSupabase);
