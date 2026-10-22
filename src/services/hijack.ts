import { supabase } from '../lib/supabase';
import { normalizeEmail, normalizeTikTok } from './search';
import type { BatchRow, Creator } from '../types';

export type CatalogBrand = { name: string; aliases: string[]; products: string[] };
export type Catalog = { brands: CatalogBrand[] };
export type HijackInput = { date: string; tiktok: string; email: string };
export type HijackStats = { total: number; matchedReplies: number; unknownReplies: number; byBrand: Array<{ target: string; total: number; replies: number }>; byProduct: Array<{ target: string; total: number; replies: number }> };
export type DailyCounts = { date: string; listing: number; hijack: number };
export type MonthlyCounts = { month: string; listing: number; hijack: number };

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
  const campaignsByEmail = new Map<string, string[]>();
  (hijack.data ?? []).forEach(row => { if (row.normalized_email) campaignsByEmail.set(row.normalized_email, [...(campaignsByEmail.get(row.normalized_email) ?? []), `${row.scope}: ${row.target}`]); });
  const byEmail = new Map<string, Creator[]>();
  [...creatorRows, ...hijackRows].forEach(row => byEmail.set(row.normalizedEmail, [...(byEmail.get(row.normalizedEmail) ?? []), row]));
  const rows: BatchRow[] = emails.map(inputEmail => { const matches = byEmail.get(inputEmail) ?? []; const campaigns = [...new Set(campaignsByEmail.get(inputEmail) ?? [])]; return { input: inputEmail, status: campaigns.length ? 'Found' : 'Not Found', matches, record: matches[0], campaigns }; });
  const matchedEmails = emails.filter(email => (campaignsByEmail.get(email) ?? []).length);
  if (matchedEmails.length) { const result = await db.from('hijack_records').update({ replied_at: new Date().toISOString() }).in('normalized_email', matchedEmails); if (result.error) throw result.error; }
  return { rows, imported: emails.length, matched: matchedEmails.length, unknown: emails.length - matchedEmails.length };
}

export async function matchHijackInputs(input: string) {
  const inputs = [...new Set(input.split(/\r?\n|,|;/).map(value => value.trim()).filter(Boolean))];
  if (!inputs.length) return { rows: [] as BatchRow[], imported: 0, matched: 0, unknown: 0 };
  const emails = inputs.filter(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)).map(normalizeEmail);
  const tiktoks = inputs.filter(value => !emails.includes(normalizeEmail(value))).map(normalizeTikTok).filter(Boolean);
  const db = client();
  const [emailResult, tiktokResult, masterEmailResult, masterTiktokResult] = await Promise.all([
    emails.length ? db.from('hijack_records').select('*').in('normalized_email', emails) : Promise.resolve({ data: [], error: null }),
    tiktoks.length ? db.from('hijack_records').select('*').in('normalized_tiktok', tiktoks) : Promise.resolve({ data: [], error: null }),
    emails.length ? db.from('creators').select('*').in('normalized_email', emails) : Promise.resolve({ data: [], error: null }),
    tiktoks.length ? db.from('creators').select('*').in('normalized_tiktok', tiktoks) : Promise.resolve({ data: [], error: null })
  ]);
  if (emailResult.error) throw emailResult.error;
  if (tiktokResult.error) throw tiktokResult.error;
  if (masterEmailResult.error) throw masterEmailResult.error;
  if (masterTiktokResult.error) throw masterTiktokResult.error;
  const masterRecords = [...(masterEmailResult.data ?? []), ...(masterTiktokResult.data ?? [])];
  const masterEmails = [...new Set(masterRecords.map(row => row.normalized_email).filter(Boolean))];
  const bridgedResult = masterEmails.length ? await db.from('hijack_records').select('*').in('normalized_email', masterEmails) : { data: [], error: null };
  if (bridgedResult.error) throw bridgedResult.error;
  const records = [...(emailResult.data ?? []), ...(tiktokResult.data ?? []), ...(bridgedResult.data ?? [])];
  const byInput = new Map<string, Creator[]>();
  records.forEach(row => {
    const record = { itemId: `hijack-${row.id}`, date: row.record_date ?? '', creatorId: '', tiktok: row.tiktok_link ?? '', email: row.email ?? '', normalizedEmail: row.normalized_email ?? '', normalizedTiktok: row.normalized_tiktok ?? '', campaigns: [`${row.scope}: ${row.target}`] } as Creator;
    const keys = [record.normalizedEmail, record.normalizedTiktok].filter(Boolean);
    keys.forEach(key => byInput.set(key, [...(byInput.get(key) ?? []), record]));
  });
  const masterByKey = new Map<string, Creator>();
  masterRecords.forEach(row => {
    const record = { itemId: String(row.id), date: row.record_date ?? '', creatorId: row.creator_id ?? '', tiktok: row.tiktok_link ?? '', email: row.email ?? '', normalizedEmail: row.normalized_email ?? '', normalizedTiktok: row.normalized_tiktok ?? '' } as Creator;
    [record.normalizedEmail, record.normalizedTiktok].filter(Boolean).forEach(key => masterByKey.set(key, record));
  });
  masterRecords.forEach(row => {
    const master = masterByKey.get(row.normalized_email ?? '') ?? masterByKey.get(row.normalized_tiktok ?? '');
    if (!master) return;
    const linked = records.filter(record => record.normalized_email === master.normalizedEmail).map(record => ({ itemId: `hijack-${record.id}`, date: record.record_date ?? '', creatorId: master.creatorId, tiktok: record.tiktok_link || master.tiktok, email: record.email || master.email, normalizedEmail: record.normalized_email || master.normalizedEmail, normalizedTiktok: record.normalized_tiktok || master.normalizedTiktok, campaigns: [`${record.scope}: ${record.target}`] } as Creator));
    const keys = [master.normalizedEmail, master.normalizedTiktok].filter(Boolean) as string[];
    keys.forEach(key => byInput.set(key, [...(byInput.get(key) ?? []), ...linked]));
  });
  const rows = inputs.map(inputValue => {
    const key = emails.includes(normalizeEmail(inputValue)) ? normalizeEmail(inputValue) : normalizeTikTok(inputValue);
    const matches = [...new Map((byInput.get(key) ?? []).map(row => [row.itemId, row])).values()].map(row => {
      const master = masterByKey.get(row.normalizedEmail) ?? masterByKey.get(row.normalizedTiktok);
      return master ? { ...master, ...row, date: row.date || master.date, tiktok: row.tiktok || master.tiktok, email: row.email || master.email, campaigns: row.campaigns } : row;
    });
    return { input: inputValue, status: matches.length === 0 ? 'Not Found' : matches.length === 1 ? 'Found' : 'Multiple Matches', matches, record: matches[0], campaigns: [...new Set(matches.flatMap(row => row.campaigns ?? []))] } as BatchRow;
  });
  const matchedEmails = emails.filter(email => (byInput.get(email) ?? []).length);
  if (matchedEmails.length) {
    const result = await db.from('hijack_records').update({ replied_at: new Date().toISOString() }).in('normalized_email', matchedEmails);
    if (result.error) throw result.error;
  }
  return { rows, imported: inputs.length, matched: rows.filter(row => row.status !== 'Not Found').length, unknown: rows.filter(row => row.status === 'Not Found').length };
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

export async function getMonthlyCounts(month: string): Promise<MonthlyCounts> {
  const db = client();
  const [year, monthNumber] = month.split('-').map(Number);
  if (!year || !monthNumber) return { month, listing: 0, hijack: 0 };
  const start = `${month}-01`;
  const next = monthNumber === 12 ? `${year + 1}-01-01` : `${year}-${String(monthNumber + 1).padStart(2, '0')}-01`;
  const [listing, hijack] = await Promise.all([
    db.from('creators').select('id', { count: 'exact', head: true }).gte('record_date', start).lt('record_date', next),
    db.from('hijack_records').select('id', { count: 'exact', head: true }).gte('record_date', start).lt('record_date', next)
  ]);
  if (listing.error) throw listing.error;
  if (hijack.error) throw hijack.error;
  return { month, listing: listing.count ?? 0, hijack: hijack.count ?? 0 };
}
