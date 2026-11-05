import { RESIGNED_PICS, USEE_DASHBOARD_URL } from '../config/constants';

/**
 * Service untuk membaca data kantor via Edge Function `usee-dashboard`.
 * Read-only: hanya memanggil API yang sudah ada (overview / entries / raw / query).
 */

async function api(params: string): Promise<any> {
  const response = await fetch(`${USEE_DASHBOARD_URL}?__api=${params}`);
  const json = await response.json();
  if (!response.ok || json?.error) {
    throw new Error(typeof json?.error === 'object' ? json?.error?.type : (json?.error ?? 'Gagal memanggil API kantor.'));
  }
  return json;
}

/** Normalisasi username TikTok (buang @, awalan URL, path). */
export function cleanUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/^https?:\/\/(www\.)?tiktok\.com\//, '').replace(/^@/, '').split(/[/?#]/)[0];
}

/** Ubah teks angka (Rp24.98m, 9.98k, "1.234") menjadi number (null bila tidak valid). */
export function parseNumber(raw: string): number | null {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[^\d.,kKmMbB]/g, '');
  if (!cleaned) return null;
  let mult = 1;
  let digits = cleaned;
  if (/[kK]$/.test(cleaned)) { mult = 1e3; digits = cleaned.slice(0, -1); }
  else if (/[mM]$/.test(cleaned)) { mult = 1e6; digits = cleaned.slice(0, -1); }
  else if (/[bB]$/.test(cleaned)) { mult = 1e9; digits = cleaned.slice(0, -1); }
  const value = Number.parseFloat(digits.replace(/,/g, ''));
  if (Number.isNaN(value)) return null;
  // Pertahankan desimal (mis. "$741.24" -> 741.24, bukan dibulatkan jadi 741).
  return Number((value * mult).toFixed(2));
}

export type ParsedScrapeRow = { username: string; revenue: string; itemSold: string; followers: string };

const HEADER_WORDS = ['username', 'revenue', 'item', 'sold', 'followers', 'creator', 'name'];

/** Parse tempelan hasil scrape (CSV/TSV/teks) menjadi baris terstruktur. */
export function parseScrape(text: string): ParsedScrapeRow[] {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const rows: ParsedScrapeRow[] = [];
  let headerMap: Record<number, 'username' | 'revenue' | 'itemSold' | 'followers'> | null = null;

  for (const line of lines) {
    const cells = line.split(/\t|;|\s{2,}/).map(cell => cell.trim()).filter((cell, idx, arr) => cell !== '' || (arr.length === 1 && cell === ''));
    if (cells.length < 2) continue;

    // Deteksi header
    if (!headerMap) {
      const lower = line.toLowerCase();
      if (HEADER_WORDS.some(word => lower.includes(word))) {
        const map: Record<number, 'username' | 'revenue' | 'itemSold' | 'followers'> = {};
        cells.forEach((cell, idx) => {
          const c = cell.toLowerCase();
          if (c.includes('username') || c.includes('creator') || c.includes('name') || c.includes('handle')) map[idx] = 'username';
          else if (c.includes('revenue') || c.includes('gmv')) map[idx] = 'revenue';
          else if (c.includes('item') && c.includes('sold')) map[idx] = 'itemSold';
          else if (c.includes('follower')) map[idx] = 'followers';
        });
        if (map[0] === 'username') { headerMap = map; continue; }
      }
    }

    if (headerMap) {
      const row: ParsedScrapeRow = { username: '', revenue: '', itemSold: '', followers: '' };
      cells.forEach((cell, idx) => {
        const field = headerMap![idx];
        if (field) row[field] = cell;
      });
      row.username = cleanUsername(row.username);
      if (row.username) rows.push(row);
      continue;
    }

    // Fallback: tebak kolom.
    // Utamakan handle eksplisit (@...) di mana pun posisinya; jangan sampai
    // display name (sering berisi emoji/spasi/karakter khusus) terambil sebagai username.
    let username = '';
    let usedIndex = -1;
    const extractHandle = (cell: string): string | null => {
      const m = cell.match(/@[a-zA-Z0-9._-]+/);
      return m ? cleanUsername(m[0]) : null;
    };
    // 1) Cari sel yang mengandung @ (handle). Menangani display-name-first & sel campur-emosi.
    for (let i = 0; i < cells.length; i++) {
      const h = extractHandle(cells[i]);
      if (h) { username = h; usedIndex = i; break; }
    }
    // 2) Tanpa @, pakai token alfanumerik polos pertama yang bukan angka (handle tanpa @).
    if (!username) {
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (/^[a-zA-Z0-9._-]{2,}$/.test(cell) && !parseNumber(cell)) {
          username = cleanUsername(cell);
          usedIndex = i;
          break;
        }
      }
    }
    if (!username) continue;
    const rest = cells.filter((_, i) => i !== usedIndex);
    const numbers = rest.map(parseNumber).filter((n): n is number => n !== null);
    rows.push({
      username,
      revenue: numbers[0] != null ? String(numbers[0]) : '',
      itemSold: numbers[1] != null ? String(numbers[1]) : '',
      followers: numbers[2] != null ? String(numbers[2]) : '',
    });
  }
  // Hapus duplikat username dalam batch
  const seen = new Set<string>();
  return rows.filter(row => { if (seen.has(row.username)) return false; seen.add(row.username); return true; });
}

/**
 * Ambil pemetaan username → daftar PIC dari kantor.
 * Cukup data PIC saja: grep `data::jsonb->>'pic'` pada es_data_entries.
 */
export async function getOfficePics(usernames: string[]): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};
  const CHUNK = 80;
  for (let i = 0; i < usernames.length; i += CHUNK) {
    const part = usernames.slice(i, i + CHUNK);
    const list = part.map(u => `'${u.replace(/'/g, "''")}'`).join(',');
    const sql = `SELECT id, data::jsonb->>'pic' AS pic FROM usee_workspace.es_data_entries WHERE id IN (${list}) LIMIT ${CHUNK * 10}`;
    const rows = await api(`query&sql=${encodeURIComponent(sql)}`);
    for (const row of rows ?? []) {
      if (!row?.id) continue;
      (result[row.id] ??= []);
      if (row.pic) result[row.id].push(String(row.pic));
    }
  }
  return result;
}

/** True = harus di-exclude karena ada PIC aktif (belum resign) yang memegang. */
export function isOfficeDuplicate(pics: string[]): boolean {
  return (pics ?? []).some(pic => !RESIGNED_PICS.includes(pic));
}

/** Panggil overview (untuk debug / info). */
export async function getOfficeOverview() {
  return api('overview');
}
