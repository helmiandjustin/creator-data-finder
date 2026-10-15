import type { BatchRow, Creator, CreatorInput } from '../types';
import { supabase } from '../lib/supabase';

export type SearchField = 'Creator ID' | 'Email' | 'TikTok URL' | 'TikTok username' | 'Auto Detect';

export const normalizeEmail = (value: string) => value.trim().toLowerCase();
export const normalizeTikTok = (value: string) => value.trim().toLowerCase().replace(/^https?:\/\/(www\.)?tiktok\.com\//, '').replace(/^@/, '').split(/[/?#]/)[0];
export const detect = (value: string): Exclude<SearchField, 'Auto Detect'> | 'Invalid' => {
  if (/^\d{2,}$/.test(value)) return 'Creator ID';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Email';
  if (/tiktok\.com/i.test(value)) return 'TikTok URL';
  if (/^@?[a-zA-Z0-9._-]{2,}$/.test(value)) return 'TikTok username';
  return 'Invalid';
};

type DbCreator = { id: number; record_date: string | null; creator_id: string | null; tiktok_link: string | null; email: string | null; normalized_email: string | null; normalized_tiktok: string | null };
const map = (row: DbCreator): Creator => ({ itemId: String(row.id), date: row.record_date ?? '', creatorId: row.creator_id ?? '', tiktok: row.tiktok_link ?? '', email: row.email ?? '', normalizedEmail: row.normalized_email ?? normalizeEmail(row.email ?? ''), normalizedTiktok: row.normalized_tiktok ?? normalizeTikTok(row.tiktok_link ?? '') });
const client = () => { if (!supabase) throw new Error('Supabase belum dikonfigurasi. Isi .env.local lalu restart aplikasi.'); return supabase; };
export const errorText = (error: unknown) => { if (typeof error === 'object' && error !== null) { const value = error as { message?: string; code?: string; details?: string; hint?: string }; return [value.message, value.code && `Code: ${value.code}`, value.details, value.hint && `Hint: ${value.hint}`].filter(Boolean).join(' · '); } return error instanceof Error ? error.message : String(error); };

export class CloudSearch {
  async single(value: string): Promise<Creator[]> {
    const input = value.trim();
    const type = detect(input);
    if (type === 'Invalid') return [];
    const db = client();
    const column = type === 'Email' ? 'normalized_email' : type === 'Creator ID' ? 'creator_id' : 'normalized_tiktok';
    const normalized = type === 'Email' ? normalizeEmail(input) : type === 'Creator ID' ? input : normalizeTikTok(input);
    const query = type === 'Creator ID' ? db.from('creators').select('*').eq(column, normalized).limit(100) : db.from('creators').select('*').ilike(column, `${normalized}%`).limit(100);
    const { data, error } = await query;
    if (error) throw error;
    return (data as DbCreator[]).map(map);
  }

  async batch(values: string[], field: SearchField, onProgress: (done: number, found: number) => void): Promise<BatchRow[]> {
    const rows = values.map(input => ({ input, value: input.trim(), type: field === 'Auto Detect' ? detect(input.trim()) : field }));
    const valid = rows.filter(row => row.type !== 'Invalid');
    const matches = new Map<string, Creator[]>();
    const groups = new Map<string, string[]>();
    for (const row of valid) groups.set(row.type, [...(groups.get(row.type) ?? []), row.value]);
    let done = 0;
    for (const [type, all] of groups) {
      for (let i = 0; i < all.length; i += 100) {
        const chunk = [...new Set(all.slice(i, i + 100))];
        const column = type === 'Email' ? 'normalized_email' : type === 'Creator ID' ? 'creator_id' : 'normalized_tiktok';
        const normalized = type === 'Email' ? chunk.map(normalizeEmail) : type === 'Creator ID' ? chunk : chunk.map(normalizeTikTok);
        const { data, error } = await client().from('creators').select('*').in(column, normalized);
        if (error) throw error;
        for (const value of chunk) {
          const key = type === 'Email' ? normalizeEmail(value) : type === 'Creator ID' ? value : normalizeTikTok(value);
          matches.set(value, (data as DbCreator[]).filter(row => (row[column as keyof DbCreator] ?? '') === key).map(map));
        }
        done += chunk.length;
        onProgress(done, [...matches.values()].flat().length);
      }
    }
    return rows.map(row => {
      if (row.type === 'Invalid') return { input: row.input, status: 'Invalid Input', matches: [] };
      const found = matches.get(row.value) ?? [];
      if (rows.filter(other => other.value === row.value).length > 1) return { input: row.input, status: 'Duplicate Input', matches: found, record: found[0] };
      return { input: row.input, status: found.length === 0 ? 'Not Found' : found.length === 1 ? 'Found' : 'Multiple Matches', matches: found, record: found[0] };
    });
  }
}

export const toDb = (row: CreatorInput) => { const tiktok = row.tiktok.trim(); const link = tiktok && !/^https?:\/\//i.test(tiktok) ? `https://www.tiktok.com/@${tiktok.replace(/^@/, '')}` : tiktok; return { record_date: row.date || null, creator_id: row.creatorId.trim() || null, tiktok_link: link || null, email: row.email.trim() || null, normalized_email: normalizeEmail(row.email) || null, normalized_tiktok: normalizeTikTok(tiktok) || null }; };

async function removeDuplicates(rows: CreatorInput[]) {
  const candidates = rows.map(toDb);
  const seenEmails = new Set<string>();
  const seenTiktoks = new Set<string>();
  const unique = candidates.filter(row => {
    const email = row.normalized_email ?? '';
    const tiktok = row.normalized_tiktok ?? '';
    const duplicate = (email && seenEmails.has(email)) || (tiktok && seenTiktoks.has(tiktok));
    if (duplicate) return false;
    if (email) seenEmails.add(email);
    if (tiktok) seenTiktoks.add(tiktok);
    return true;
  });
  const existingEmails = new Set<string>();
  const existingTiktoks = new Set<string>();
  const db = client();
  for (let i = 0; i < unique.length; i += 500) {
    const chunk = unique.slice(i, i + 500);
    const emails = chunk.map(row => row.normalized_email).filter((value): value is string => Boolean(value));
    const tiktoks = chunk.map(row => row.normalized_tiktok).filter((value): value is string => Boolean(value));
    const [emailResult, tiktokResult] = await Promise.all([
      emails.length ? db.from('creators').select('normalized_email').in('normalized_email', emails) : Promise.resolve({ data: [], error: null }),
      tiktoks.length ? db.from('creators').select('normalized_tiktok').in('normalized_tiktok', tiktoks) : Promise.resolve({ data: [], error: null })
    ]);
    if (emailResult.error) throw emailResult.error;
    if (tiktokResult.error) throw tiktokResult.error;
    for (const row of emailResult.data ?? []) if (row.normalized_email) existingEmails.add(row.normalized_email as string);
    for (const row of tiktokResult.data ?? []) if (row.normalized_tiktok) existingTiktoks.add(row.normalized_tiktok as string);
  }
  return unique.filter(row => !existingEmails.has(row.normalized_email ?? '') && !existingTiktoks.has(row.normalized_tiktok ?? ''));
}

export async function insertCreators(rows: CreatorInput[], onProgress: (done: number) => void) {
  if (!rows.length) return 0;
  const db = client();
  const unique = await removeDuplicates(rows);
  for (let i = 0; i < unique.length; i += 500) {
    const chunk = unique.slice(i, i + 500);
    const { error } = await db.from('creators').insert(chunk);
    if (error) throw error;
    onProgress(Math.min(i + chunk.length, unique.length));
  }
  return unique.length;
}

export async function insertCreator(row: CreatorInput) { const inserted = await insertCreators([row], () => undefined); if (!inserted) throw new Error('Record duplikat: email atau username TikTok sudah ada.'); }
export async function countCreators() { const { count, error } = await client().from('creators').select('id', { count: 'exact', head: true }); if (error) throw error; return count ?? 0; }
export async function deleteCreatorsByDate(date: string) { const { data, error } = await client().from('creators').delete().eq('record_date', date).select('id'); if (error) throw error; return data?.length ?? 0; }
export async function deleteAllCreators() { const { data, error } = await client().from('creators').delete().not('id', 'is', null).select('id'); if (error) throw error; return data?.length ?? 0; }
export type RecordStats = { total: number; currentMonth: number; previousMonth: number; daily: Array<{ date: string; count: number }> };
const localIsoDate = (date: Date) => { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; };
export async function getRecordStats(): Promise<RecordStats> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const start = localIsoDate(previousMonthStart);
  const total = await countCreators();
  const { data, error } = await client().from('creators').select('record_date').gte('record_date', start);
  if (error) throw error;
  const currentStart = localIsoDate(monthStart);
  const nextMonthStart = localIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 1));
  const previousStart = localIsoDate(previousMonthStart);
  const dates = (data as Array<{ record_date: string | null }>).map(row => row.record_date).filter((date): date is string => Boolean(date));
  const currentMonth = dates.filter(date => date >= currentStart && date < nextMonthStart).length;
  const previousMonth = dates.filter(date => date >= previousStart && date < currentStart).length;
  const daily = dates.filter(date => date >= currentStart && date < nextMonthStart).reduce<Record<string, number>>((result, date) => { result[date] = (result[date] ?? 0) + 1; return result; }, {});
  return { total, currentMonth, previousMonth, daily: Object.entries(daily).sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count })) };
}
