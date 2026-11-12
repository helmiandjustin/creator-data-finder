-- Migration: percepat query dashboard / activity log.
-- Penyebab lambat: tabel `creators` tidak punya index di `record_date`,
-- padahal Activity Log & hitungan harian/bulanan menyaring per tanggal
-- (tiap query jadi full-table-scan).
--
-- Jalankan SEKALI di Supabase SQL Editor (project justin vtiipxavqwafhrlhmqhf).
-- Additif: tidak merubah data, hanya menambah index.

create index if not exists creators_record_date_idx on public.creators (record_date);
create index if not exists creators_record_date_type_idx on public.creators (record_date, type);
