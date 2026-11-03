#!/usr/bin/env node
/**
 * Migrasi data dari usee-view → justin (database pusat).
 *
 * Cara pakai (dari akar project):
 *   npm run migrate:useeview
 *
 * Kredensial diambil dari .env.local (VITE_*) dengan override opsional:
 *   USEEVIEW_SUPABASE_URL / USEEVIEW_SUPABASE_KEY  (sumber, default pakai publishable)
 *   JUSTIN_SUPABASE_URL     / JUSTIN_SUPABASE_KEY      (target,  default pakai publishable)
 *
 * Catatan keamanan: jika RLS di justin hanya mengizinkan role `authenticated`,
 * publishable/anon key tidak bisa insert. Jalankan dengan service_role key
 * (JUSTIN_SUPABASE_KEY=sb_secret_...) agar bypass RLS, atau pastikan policy insert ada.
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
  } catch {
    /* abaikan jika .env.local tidak ada */
  }
}
loadLocalEnv();

const sourceUrl = process.env.USEEVIEW_SUPABASE_URL || process.env.VITE_USEEVIEW_SUPABASE_URL;
const sourceKey = process.env.USEEVIEW_SUPABASE_KEY || process.env.VITE_USEEVIEW_SUPABASE_ANON_KEY;
const targetUrl = process.env.JUSTIN_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const targetKey = process.env.JUSTIN_SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!sourceUrl || !sourceKey || !targetUrl || !targetKey) {
  console.error('❌ Environment belum lengkap.');
  console.error('   Sumber (usee-view): USEEVIEW_SUPABASE_URL + KEY (default dari .env.local).');
  console.error('   Target (justin):     JUSTIN_SUPABASE_URL + KEY (default dari .env.local).');
  process.exit(1);
}

const source = createClient(sourceUrl, sourceKey);
const target = createClient(targetUrl, targetKey);

async function fetchAll(client, table, select = '*') {
  const rows = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await client.from(table).select(select).order('id', { ascending: true }).range(offset, offset + BATCH - 1);
    if (error) throw new Error(`gagal baca ${table}: ${error.message}`);
    if (!data || !data.length) break;
    rows.push(...data);
    if (data.length < BATCH) break;
    offset += BATCH;
  }
  return rows;
}

async function insertBatches(client, table, rows) {
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error } = await client.from(table).insert(chunk);
    if (error) throw new Error(`gagal insert ${table}: ${error.message}`);
    inserted += chunk.length;
    console.log(`   ✔ ${table}: +${chunk.length} (${inserted}/${rows.length})`);
  }
  return inserted;
}

// ── Migrasi `creators` ─────────────────────────────────────────────────
async function migrateCreators() {
  console.log('\n── Migrasi: creators ──');
  const rows = await fetchAll(source, 'creators');
  console.log(`   Sumber usee-view: ${rows.length} baris`);

  const existingKeys = new Set();
  const existing = await fetchAll(target, 'creators', 'id,normalized_email,normalized_tiktok');
  for (const r of existing) {
    if (r.normalized_email) existingKeys.add(`e:${r.normalized_email}`);
    if (r.normalized_tiktok) existingKeys.add(`t:${r.normalized_tiktok}`);
  }

  const fresh = [];
  for (const r of rows) {
    const normEmail = r.normalized_email || (r.email || '').trim().toLowerCase();
    const normTik = r.normalized_tiktok || (r.tiktok_link || '').trim().toLowerCase().replace(/^https?:\/\/(www\.)?tiktok\.com\//, '').split(/[/?#]/)[0];
    const hit = (normEmail && existingKeys.has(`e:${normEmail}`)) || (normTik && existingKeys.has(`t:${normTik}`));
    if (hit) continue;
    fresh.push({
      record_date: r.record_date || null,
      creator_id: r.creator_id || null,
      tiktok_link: r.tiktok_link || null,
      email: r.email || null,
      normalized_email: normEmail || null,
      normalized_tiktok: normTik || null,
    });
    if (normEmail) existingKeys.add(`e:${normEmail}`);
    if (normTik) existingKeys.add(`t:${normTik}`);
  }

  console.log(`   Baru (belum ada di justin): ${fresh.length}`);
  if (fresh.length) return insertBatches(target, 'creators', fresh);
  return 0;
}

// ── Migrasi `hijack_records` ────────────────────────────────────────────
async function migrateHijack() {
  console.log('\n── Migrasi: hijack_records ──');
  const rows = await fetchAll(source, 'hijack_records');
  console.log(`   Sumber usee-view: ${rows.length} baris`);

  const existingKeys = new Set();
  const existing = await fetchAll(target, 'hijack_records', 'id,record_date,normalized_email,normalized_tiktok,scope,target');
  for (const r of existing) {
    existingKeys.add([r.record_date, r.normalized_email, r.normalized_tiktok, r.scope, r.target].join('|'));
  }

  const fresh = [];
  for (const r of rows) {
    const key = [r.record_date, r.normalized_email, r.normalized_tiktok, r.scope, r.target].join('|');
    if (existingKeys.has(key)) continue;
    fresh.push({
      record_date: r.record_date || null,
      scope: r.scope,
      target: r.target,
      tiktok_link: r.tiktok_link || null,
      email: r.email || null,
      normalized_email: r.normalized_email || null,
      normalized_tiktok: r.normalized_tiktok || null,
      replied_at: r.replied_at || null,
    });
    existingKeys.add(key);
  }

  console.log(`   Baru (belum ada di justin): ${fresh.length}`);
  if (fresh.length) return insertBatches(target, 'hijack_records', fresh);
  return 0;
}

(async () => {
  console.log('Sumber usee-view :', sourceUrl);
  console.log('Target justin     :', targetUrl);
  try {
    const creators = await migrateCreators();
    const hijack = await migrateHijack();
    console.log('\n✅ Selesai. Total dimigrasi ke justin:');
    console.log(`   creators: ${creators}`);
    console.log(`   hijack_records: ${hijack}`);
  } catch (err) {
    console.error('\n❌ Migrasi gagal:', err.message);
    process.exit(1);
  }
})();
