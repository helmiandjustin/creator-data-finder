-- Migration: tabel cache hasil sinkronisasi matching kantor (62.709 historical + status).
-- Dipakai pipeline step 2 (Cek Duplikat) untuk mengecek apakah username sudah ada di
-- riwayat kantor (contacted / cooperated / duplicate) → dibuang; yang New KOL dibiarkan.
-- Jalankan sekali di Supabase SQL Editor (project justin vtiipxavqwafhrlhmqhf).
-- Additif: tidak mengubah data/referensi existing.

create table if not exists public.match_cache (
  username text primary key,
  status text,
  category text,
  checked_at timestamptz not null default now()
);

create index if not exists match_cache_status_idx on public.match_cache (status);

alter table public.match_cache enable row level security;

-- Aplikasi (anon + authenticated) cukup membaca.
drop policy if exists "anon can read match cache" on public.match_cache;
create policy "anon can read match cache" on public.match_cache
  for select to anon using (true);

drop policy if exists "authenticated can read match cache" on public.match_cache;
create policy "authenticated can read match cache" on public.match_cache
  for select to authenticated using (true);

-- Tulis via service role / script sync (menembus RLS). Antisipasi jika kelak
-- perlu tulis via authenticated.
drop policy if exists "authenticated can insert match cache" on public.match_cache;
create policy "authenticated can insert match cache" on public.match_cache
  for insert to authenticated with check (true);
