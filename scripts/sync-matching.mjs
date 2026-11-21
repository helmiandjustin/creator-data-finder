#!/usr/bin/env node
/**
 * Sinkronisasi hasil matching kantor → tabel public.match_cache (justin).
 *
 * Tahap 1 (via browser session, login workspace): jalankan Quick cooperation check
 *   pada daftar handle, lalu simpan hasilnya ke file JSON:
 *   [ { "username": "...", "status": "...", "category": "..." }, ... ]
 *
 * Tahap 2 (script ini): baca file JSON itu dan upsert ke justin.
 *   node scripts/sync-matching.mjs hasil-match.json
 *
 * Kredensial target diambil dari .env.local (VITE_*) dengan override:
 *   JUSTIN_SUPABASE_URL / JUSTIN_SUPABASE_KEY (wajib service_role / secret key
 *   agar bypass RLS, mis. JUSTIN_SUPABASE_KEY=sb_secret_...)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BATCH = 500;

function loadLocalEnv() {
  try {
    const p = path.resolve(__dirname, '../.env.local');
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  } catch { /* abaikan */ }
}
loadLocalEnv();

const file = process.argv[2];
if (!file) {
  console.error('❌ Berikan path file JSON hasil matching, mis. node scripts/sync-matching.mjs hasil-match.json');
  process.exit(1);
}

const targetUrl = process.env.JUSTIN_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const targetKey = process.env.JUSTIN_SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!targetUrl || !targetKey) {
  console.error('❌ Environment target belum lengkap (JUSTIN_SUPABASE_URL + KEY).');
  process.exit(1);
}

const target = createClient(targetUrl, targetKey);

const raw = JSON.parse(readFileSync(path.resolve(file), 'utf8'));
const rows = [];
const seen = new Set();
for (const r of raw) {
  const username = String(r.username ?? '').trim().toLowerCase().replace(/^@/, '');
  if (!username || seen.has(username)) continue;
  seen.add(username);
  // Status matching: not_found → New KOL (bersih); selainnya (recorded/contacted/
  // cooperated/duplicate) berarti sudah dipakai → akan dibuang di step 2.
  const status = (r.status === 'not_found' || r.status === 'new' || r.status === 'new_kol')
    ? 'new_kol'
    : (r.status || 'unknown');
  rows.push({ username, status, category: r.category ?? null, checked_at: new Date().toISOString() });
}

console.log(`🧹 ${rows.length} username unik akan di-upsert ke match_cache`);
let done = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH);
  const { data, error } = await target.from('match_cache').upsert(chunk, { onConflict: 'username' });
  if (error) { console.error('❌ gagal upsert:', error.message); process.exit(1); }
  done += chunk.length;
  console.log(`  ✓ ${done}/${rows.length}`);
}
console.log('✅ Selesai. match_cache ter-update.');
