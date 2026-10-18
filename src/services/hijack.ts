import { supabase } from '../lib/supabase';
import { normalizeEmail, normalizeTikTok } from './search';
import type { BatchRow, Creator } from '../types';

export type CatalogBrand = { name: string; aliases: string[]; products: string[] };
export type Catalog = { brands: CatalogBrand[] };
export type HijackInput = { date: string; tiktok: string; email: string };
export type HijackStats = { total: number; matchedReplies: number; unknownReplies: number; byBrand: Array<{ target: string; total: number; replies: number }>; byProduct: Array<{ target: string; total: number; replies: number }> };
export type DailyCounts = { date: string; listing: number; hijack: number };

const client = () => { if (!supabase) throw new Error('Supabase belum dikonfigurasi.'); return supabase; };
const cleanDate = (value: string) => { const match = value.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/); return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : value.trim() || null; };

export async function loadCatalog(): Promise<Catalog> {
  if (supabase) {
    const db = supabase;
    const brands = await db.from('brand_catalog').select('id,name,aliases').eq('active', true).order('name');
    if (!brands.error && brands.data?.length) {
      const ids = brands.data.map(row => row.id);
      const products = await db.from('brand_catalog_products').select('brand_id,name').eq('active', true).in('brand_id', ids).order('name');
      if (!products.error) return { brands: brands.data.map(row => ({ name: row.name, aliases: Array.isArray(row.aliases) ? row.aliases : [], products: (products.data ?? []).filter(product => product.brand_id === row.id).map(product => product.name) })) };
    }
  }
  const response = await fetch('./brand-catalog.json');
  if (!response.ok) throw new Error('Catalog brand/product tidak dapat dimuat.');
  return response.json() as Promise<Catalog>;
}

export async function syncCatalog() {
  const db = client();
  const source = await fetch('./brand-catalog.json').then(response => response.json() as Promise<Catalog>);
  const existing = await db.from('brand_catalog').select('id').limit(1);
  if (existing.error || existing.data?.length) return;
  const brands = source.brands.map(brand => ({ name: brand.name, normalized_name: brand.name.trim().toLowerCase(), aliases: brand.aliases ?? [] }));
  for (let i = 0; i < brands.length; i += 100) { const result = await db.from('brand_catalog').insert(brands.slice(i, i + 100)); if (result.error) throw result.error; }
  const saved = await db.from('brand_catalog').select('id,name');
  if (saved.error) throw saved.error;
  const ids = new Map((saved.data ?? []).map(row => [row.name, row.id]));
  const products = source.brands.flatMap(brand => brand.products.map(name => ({ brand_id: ids.get(brand.name), name, normalized_name: name.trim().toLowerCase() }))).filter(row => row.brand_id);
  for (let i = 0; i < products.length; i += 250) { const result = await db.from('brand_catalog_products').insert(products.slice(i, i + 250)); if (result.error) throw result.error; }
}

export async function insertHijackRecords(rows: HijackInput[], scope: string, target: string) {
  const db = client();
  const unique = new Map<string, Record<string, string | null>>();
  rows.filter(row => row.date || row.tiktok || row.email).forEach(row => {
    const normalizedEmail = normalizeEmail(row.email);
    const normalizedTiktok = normalizeTikTok(row.tiktok);
    const key = `${cleanDate(row.date) ?? ''}|${normalizedEmail}|${normalizedTiktok}`;
    if (!unique.has(key)) unique.set(key, { record_date: cleanDate(row.date), tiktok_link: row.tiktok.trim() || null, email: row.email.trim() || null, normalized_email: normalizedEmail || null, normalized_tiktok: normalizedTiktok || null, scope, target });
  });
  const values = [...unique.values()];
  if (!values.length) return 0;
  const { error } = await db.from('hijack_records').insert(values);
  if (error) throw error;
  return values.length;
}

export async function importHijackReplies(input: string) {
  const emails = [...new Set(input.split(/\r?\n|,|;/).map(value => normalizeEmail(value)).filter(Boolean))];
  if (!emails.length) return { imported: 0, matched: 0, unknown: 0 };
  const db = client();
  const { data, error } = await db.from('hijack_records').select('id,normalized_email').in('normalized_email', emails);
  if (error) throw error;
  const matchedEmails = new Set((data ?? []).map(row => row.normalized_email).filter(Boolean));
  if (matchedEmails.size) {
    const { error: updateError } = await db.from('hijack_records').update({ replied_at: new Date().toISOString() }).in('normalized_email', [...matchedEmails]);
    if (updateError) throw updateError;
  }
  return { imported: emails.length, matched: matchedEmails.size, unknown: emails.filter(email => !matchedEmails.has(email)).length };
}

export async function matchReplyEmails(input: string) {
  const emails = [...new Set(input.split(/\r?\n|,|;/).map(value => normalizeEmail(value)).filter(Boolean))];
  if (!emails.length) return { rows: [] as BatchRow[], imported: 0, matched: 0, unknown: 0 };
  const db = client();
  const [creators, hijack] = await Promise.all([
    db.from('creators').select('*').in('normalized_email', emails),
    db.from('hijack_records').select('*').in('normalized_email', emails)
  ]);
  if (creators.error) throw creators.error;
  if (hijack.error) throw hijack.error;
  const creatorRows = (creators.data ?? []).map(row => ({ itemId: String(row.id), date: row.record_date ?? '', creatorId: row.creator_id ?? '', tiktok: row.tiktok_link ?? '', email: row.email ?? '', normalizedEmail: row.normalized_email ?? '', normalizedTiktok: row.normalized_tiktok ?? '' } as Creator));
  const hijackRows = (hijack.data ?? []).map(row => ({ itemId: `hijack-${row.id}`, date: row.record_date ?? '', creatorId: '', tiktok: row.tiktok_link ?? '', email: row.email ?? '', normalizedEmail: row.normalized_email ?? '', normalizedTiktok: row.normalized_tiktok ?? '' } as Creator));
  const byEmail = new Map<string, Creator[]>();
  [...creatorRows, ...hijackRows].forEach(row => byEmail.set(row.normalizedEmail, [...(byEmail.get(row.normalizedEmail) ?? []), row]));
  const rows: BatchRow[] = emails.map(inputEmail => { const matches = byEmail.get(inputEmail) ?? []; return { input: inputEmail, status: matches.length ? 'Found' : 'Not Found', matches, record: matches[0] }; });
  const matchedEmails = emails.filter(email => (byEmail.get(email) ?? []).length);
  if (matchedEmails.length) { const result = await db.from('hijack_records').update({ replied_at: new Date().toISOString() }).in('normalized_email', matchedEmails); if (result.error) throw result.error; }
  return { rows, imported: emails.length, matched: matchedEmails.length, unknown: emails.length - matchedEmails.length };
}

export async function getHijackStats(): Promise<HijackStats> {
  const { data, error } = await client().rpc('get_hijack_stats');
  if (error) throw error;
  return data as HijackStats;
}

export async function getDailyCounts(date: string): Promise<DailyCounts> {
  const db = client();
  const [listing, hijack] = await Promise.all([
    db.from('creators').select('id', { count: 'exact', head: true }).eq('record_date', date),
    db.from('hijack_records').select('id', { count: 'exact', head: true }).eq('record_date', date)
  ]);
  if (listing.error) throw listing.error;
  if (hijack.error) throw hijack.error;
  return { date, listing: listing.count ?? 0, hijack: hijack.count ?? 0 };
}
