-- Migration: tambah kolom detail untuk pipeline import creator.
-- Jalankan sekali di Supabase SQL Editor (project justin vtiipxavqwafhrlhmqhf).
-- Additif: tidak mengubah data/referensi existing.

alter table public.creators
  add column if not exists revenue numeric,
  add column if not exists item_sold integer,
  add column if not exists followers integer,
  add column if not exists source_revenue_kol text
    check (source_revenue_kol in ('live', 'videos')),
  add column if not exists campaign text,
  add column if not exists type text
    check (type in ('Listing', 'Hijack')),
  add column if not exists source text;

create index if not exists creators_type_idx on public.creators (type);
create index if not exists creators_campaign_idx on public.creators (campaign);
