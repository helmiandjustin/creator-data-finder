import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { errorText, savePipelineRows } from '../services/search';
import { cleanUsername, getOfficePics, isOfficeDuplicate, parseNumber, parseScrape } from '../services/useeView';
import { IMPORT_TYPES, REVENUE_SOURCES, type ImportType } from '../config/constants';
import type { CreatorInput } from '../types';
import type { Catalog } from '../services/hijack';

type RowStatus = 'unknown' | 'clean' | 'dup';

type PRow = {
  username: string;
  email: string;
  revenue: string;
  itemSold: string;
  followers: string;
  sourceKol: '' | 'live' | 'videos';
  campaign: string;
  type: ImportType;
  status: RowStatus;
  officePics: string[];
};

const STEPS = ['Tempel & Parse', 'Cek Duplikat', 'Detail & Mode', 'Email', 'Review & Simpan'];
const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch { return false; }
  }
};
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const isValidEmail = (value: string) => Boolean(value && value.trim() && !/^not found$/i.test(value.trim()));
const rowComplete = (row: PRow) => isValidEmail(row.email) && Boolean(row.revenue) && Boolean(row.itemSold);

export default function PipelinePanel({ catalog }: { catalog?: Catalog | null }) {
  const [step, setStep] = useState(0);
  const [pasteText, setPasteText] = useState('');
  const [rows, setRows] = useState<PRow[]>([]);
  const [recordDate, setRecordDate] = useState(todayIso());
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showCleanOnly, setShowCleanOnly] = useState(false);
  const [emailText, setEmailText] = useState('');
  const [include, setInclude] = useState<Record<number, boolean>>({});
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [kolFill, setKolFill] = useState('');
  const [campFill, setCampFill] = useState('Expert Search Kalodata');
  const [showAll, setShowAll] = useState(false);
  const [droppedCount, setDroppedCount] = useState(0);

  useEffect(() => { if (rows.length) setInclude(rows.reduce<Record<number, boolean>>((acc, row, i) => { acc[i] = row.status === 'clean'; return acc; }, {})); }, [rows]);
  useEffect(() => { setNotice(''); setShowAll(false); }, [step]);

  const campaignOptions = (catalog?.brands ?? []).flatMap(brand => [brand.name, ...brand.products.map(product => `${brand.name} · ${product}`)]);

  const parse = () => {
    setError('');
    try {
      const parsed = parseScrape(pasteText);
      setRows(parsed.map(p => ({ username: p.username, email: '', revenue: p.revenue, itemSold: p.itemSold, followers: p.followers, sourceKol: '', campaign: 'Expert Search Kalodata', type: 'Listing', status: 'unknown', officePics: [] })));
      setChecked(false);
      setDroppedCount(0);
      setNotice(`${parsed.length} baris di-parse. Tekan "Jalankan cek duplikat" untuk lanjut.`);
      setStep(1);
    } catch (e) { setError(errorText(e)); }
  };

  const runCheck = async () => {
    setChecking(true); setError('');
    try {
      const usernames = rows.map(r => r.username);
      const emails = rows.map(r => r.email).filter(Boolean);
      const selfUsernames = new Set<string>();
      const selfEmails = new Set<string>();
      for (let i = 0; i < usernames.length; i += 500) {
        const chunk = usernames.slice(i, i + 500);
        const { data } = await supabase!.from('creators').select('normalized_tiktok,normalized_email').in('normalized_tiktok', chunk);
        for (const r of data ?? []) { if (r.normalized_tiktok) selfUsernames.add(r.normalized_tiktok); if (r.normalized_email) selfEmails.add(r.normalized_email); }
      }
      for (let i = 0; i < emails.length; i += 500) {
        const chunk = emails.slice(i, i + 500);
        const { data } = await supabase!.from('creators').select('normalized_email').in('normalized_email', chunk);
        for (const r of data ?? []) if (r.normalized_email) selfEmails.add(r.normalized_email);
      }
      const officeMap = await getOfficePics(usernames);
      let dropped = 0;
      const kept = rows.flatMap(row => {
        const pics = officeMap[row.username] ?? [];
        const selfHit = selfUsernames.has(row.username) || (row.email && selfEmails.has(row.email));
        const offDup = isOfficeDuplicate(pics);
        // Semua duplikat (justin maupun kantor/PIC aktif) dibuang otomatis.
        if (selfHit || offDup) { dropped += 1; return []; }
        return [{ ...row, status: 'clean' as RowStatus, officePics: pics }];
      });
      setRows(kept);
      setDroppedCount(dropped);
      setChecked(true);
      setNotice('');
    } catch (e) { setError(errorText(e)); } finally { setChecking(false); }
  };

  const updateRow = (index: number, patch: Partial<PRow>) => setRows(rows => rows.map((row, i) => i === index ? { ...row, ...patch } : row));

  const applyKol = () => { if (kolFill) setRows(rows.map(row => ({ ...row, sourceKol: kolFill as PRow['sourceKol'] }))); };
  const applyCamp = () => { if (campFill.trim()) setRows(rows.map(row => ({ ...row, campaign: campFill.trim() }))); };

  const exportUsernames = async () => {
    const list = rows.map(row => row.username);
    const ok = await copyText(list.join('\n'));
    setNotice(ok ? `${list.length} username disalin ke clipboard.` : 'Gagal menyalin ke clipboard.');
  };

  const applyEmails = () => {
    const map = new Map<string, string>();
    for (const line of emailText.split(/\r?\n/)) {
      const m = line.match(/([^\t\s]+)[\t ]+(.+)/);
      if (!m) continue;
      const val = m[2].trim();
      // Anggap "not found"/kosong sebagai TIDAK punya email → di-skip.
      if (!val || /^not found$/i.test(val)) continue;
      map.set(cleanUsername(m[1]), val);
    }
    setRows(rows.map(row => ({ ...row, email: map.get(row.username) ?? row.email })));
    setNotice('Email di-join per username. Cek kolom email di tabel.');
  };

  const completeRows = rows.filter((row, i) => include[i] === true && rowComplete(row));
  const checkedIncomplete = rows.filter((row, i) => include[i] === true && !rowComplete(row));
  const missingEmail = rows.filter(row => row.status === 'clean' && !isValidEmail(row.email)).length;

  const save = async () => {
    setBusy(true); setError('');
    try {
      const toSave: CreatorInput[] = completeRows.map(row => ({
        date: recordDate,
        creatorId: '',
        tiktok: `@${row.username}`,
        email: row.email,
        revenue: parseNumber(row.revenue),
        itemSold: parseNumber(row.itemSold),
        followers: parseNumber(row.followers),
        sourceRevenueKol: row.sourceKol || null,
        campaign: row.campaign || null,
        type: row.type,
        source: 'pipeline',
      }));
      if (!toSave.length) { setError('Tidak ada baris lengkap untuk disimpan (semua butuh email + revenue + item sold).'); setBusy(false); return; }
      const result = await savePipelineRows(toSave, done => setProgress({ done, total: toSave.length }));
      setNotice(`${result.inserted} baru disimpan · ${result.updated} diperbarui.`);
      setRows([]); setPasteText(''); setEmailText(''); setStep(0); setProgress({ done: 0, total: 0 });
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };

  const visibleRows = showCleanOnly ? rows.filter(r => r.status === 'clean') : rows;
  const previewRows = (list: PRow[]) => (showAll ? list : list.slice(0, 5));
  const showMoreFooter = (list: PRow[]) => list.length > 5 ? (
    <div className="results-footer"><button className="link" onClick={() => setShowAll(v => !v)}>{showAll ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${list.length} baris)`}</button></div>
  ) : null;

  return (
    <section>
      <div className="card">
        <div className="pipeline-head">
          <div><h2>Import Pipeline</h2><p>Scraping → bersihkan → cek duplikat → email → simpan ke justin.</p></div>
          <div className="pipeline-stepper">
            {STEPS.map((label, i) => (
              <div key={label} className={`p-step ${i === step ? 'active' : i < step ? 'done' : ''}`} onClick={() => i < step && setStep(i)}>
                <span className="p-dot">{i < step ? '✓' : i + 1}</span><span className="p-label">{label}</span>
              </div>
            ))}
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        {notice && <p className="pipeline-notice">{notice}</p>}
        {progress.total > 0 && <p className="progress">Menyimpan {progress.done} / {progress.total}</p>}
      </div>

      {step === 0 && (
        <div className="card">
          <h2>1 · Tempel data hasil scraping</h2>
          <p>Tempel hasil export (Kalodata/Fastmoss) — format apa pun (CSV/TSV/teks). Sistem auto-detect kolom dan membersihkan @ username.</p>
          <textarea value={pasteText} onChange={e => setPasteText(e.target.value)} placeholder={'@honeybutter_babe\tHaley\tRp24.98m\t37\t9.98k\n@nextuser\t...'} />
          <div className="batch-actions"><span>{pasteText.split(/\r?\n/).filter(Boolean).length} baris</span><button onClick={parse} disabled={!pasteText.trim()}>Parse</button></div>
        </div>
      )}

      {step === 1 && (
        <div className="card">
          <h2>2 · Cek Duplikat</h2>
          <p>Memeriksa terhadap database justin (sendiri) dan kantor (usee-dashboard). Duplikat (justin/kantor PIC aktif) otomatis dibuang; PIC resign (Ichwan/Safaa/Endah/Shafira) tidak dihitung sebagai duplikat.</p>
          {!checked ? (
            <div className="pipeline-check-cta">
              <p className="muted" style={{ textAlign: 'left', padding: 0 }}>Jalankan untuk membuang baris duplikat sebelum lanjut.</p>
              <button onClick={runCheck} disabled={checking}>{checking ? 'Memeriksa…' : 'Jalankan cek duplikat'}</button>
            </div>
          ) : (
            <>
              <div className="pipeline-summary">
                <span><b>{rows.length}</b> total bersih</span>
              </div>
              {droppedCount > 0 && <p className="pipeline-notice">🗑️ {droppedCount} duplikat dibuang otomatis (justin/kantor). Sisa semuanya bersih.</p>}
              <div className="grid-actions">
                <button className="secondary" onClick={() => setShowCleanOnly(v => !v)}>{showCleanOnly ? 'Tampilkan semua' : 'Tampilkan hanya bersih'}</button>
                <button className="secondary" onClick={() => setStep(0)}>« Kembali</button>
                <button onClick={() => setStep(2)}>Lanjut ke Detail »</button>
              </div>
              <div className="table-wrap"><table><thead><tr><th>Username</th><th>Status</th><th>PIC kantor</th></tr></thead><tbody>
                {previewRows(visibleRows).map((row, i) => (
                  <tr key={i}><td>{row.username}</td><td><span className={`status p-status-${row.status}`}>{statusLabel(row.status)}</span></td><td>{row.officePics.length ? row.officePics.join(', ') : '—'}</td></tr>
                ))}
              </tbody></table></div>
              {showMoreFooter(visibleRows)}
            </>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h2>3 · Detail & Mode</h2>
          <div className="pipeline-toolbar">
            <label>Tanggal record<input type="date" value={recordDate} onChange={e => setRecordDate(e.target.value)} /></label>
            <span className="p-hint">Gunakan "Apply ke semua" untuk mengisi kolom sekaligus.</span>
          </div>
          <div className="pipeline-fill">
            <label>Source Revenue<select value={kolFill} onChange={e => setKolFill(e.target.value)}><option value="">—</option>{REVENUE_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}</select><button className="secondary" onClick={applyKol}>Apply ke semua</button></label>
            <label>Campaign<input value={campFill} onChange={e => setCampFill(e.target.value)} placeholder="contoh: campaign name" /><button className="secondary" onClick={applyCamp}>Apply ke semua</button></label>
          </div>
          <div className="table-wrap"><table className="pipeline-grid"><thead><tr><th>Username</th><th>Revenue</th><th>Item sold</th><th>Followers</th><th>Source Revenue</th><th>Campaign</th><th>Mode</th></tr></thead><tbody>
            {previewRows(rows).map((row, i) => (
              <tr key={i}>
                <td className="p-username">{row.username}</td>
                <td><input value={row.revenue} onChange={e => updateRow(i, { revenue: e.target.value })} placeholder="0" /></td>
                <td><input value={row.itemSold} onChange={e => updateRow(i, { itemSold: e.target.value })} placeholder="0" /></td>
                <td><input value={row.followers} onChange={e => updateRow(i, { followers: e.target.value })} placeholder="0" /></td>
                <td><select value={row.sourceKol} onChange={e => updateRow(i, { sourceKol: e.target.value as PRow['sourceKol'] })}><option value="">—</option>{REVENUE_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}</select></td>
                <td><input list="pipeline-campaign-list" value={row.campaign} onChange={e => updateRow(i, { campaign: e.target.value })} placeholder="expert search / bebas" /></td>
                <td><div className="mode-switch p-mode"><button className={row.type === 'Listing' ? '' : 'secondary'} onClick={() => updateRow(i, { type: 'Listing' })}>Listing</button><button className={row.type === 'Hijack' ? '' : 'secondary'} onClick={() => updateRow(i, { type: 'Hijack' })}>Hijack</button></div></td>
              </tr>
            ))}
          </tbody></table></div>
          {showMoreFooter(rows)}
          <datalist id="pipeline-campaign-list">{campaignOptions.map(option => <option key={option} value={option} />)}</datalist>
          <div className="grid-actions">
            <button className="secondary" onClick={() => setStep(1)}>« Kembali</button>
            <button onClick={() => setStep(3)}>Lanjut ke Email »</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h2>4 · Cari Email</h2>
          <div className="pipeline-email">
            <div className="panel">
              <h3>Cari email (provider manual)</h3>
              <p>Salin daftar username (semua baris dari Detail & Mode), tempel ke tool cari email kamu.</p>
              <button className="secondary" onClick={exportUsernames}>Copy semua username</button>
            </div>
            <div className="panel">
              <h3>Paste hasil email</h3>
              <p>Format: <code>username&lt;Tab&gt;email</code> (satu per baris). Sistem join otomatis per username.</p>
              <textarea value={emailText} onChange={e => setEmailText(e.target.value)} placeholder={'cynsfavesandfinds\tcynsfavesandfinds@gmail.com\nthisisexampleofnotfound\tnot found'} />
              <button onClick={applyEmails}>Gabungkan email</button>
            </div>
          </div>
          <div className="pipeline-summary"><span><b>{rows.filter(r => r.email).length}</b> punya email</span><span><b>{missingEmail}</b> belum (akan ditandai)</span></div>
          <div className="grid-actions">
            <button className="secondary" onClick={() => setStep(2)}>« Kembali</button>
            <button onClick={() => setStep(4)}>Lanjut ke Review »</button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="card">
          <h2>5 · Review & Simpan</h2>
          <p>Baris dengan <b>email kosong / "not found"</b> atau revenue/item sold kosong <b>otomatis dilewati</b> (tidak tersimpan). Centang baris yang ingin disimpan. Duplikat sudah dibuang otomatis di tahap sebelumnya.</p>
          <div className="pipeline-summary">
            <span><b>{rows.length}</b> total</span>
            <span><b>{completeRows.length}</b> siap disimpan</span>
            {checkedIncomplete.length > 0 && <span className="p-warn"><b>{checkedIncomplete.length}</b> kurang lengkap (dilewati)</span>}
          </div>
          <div className="table-wrap"><table className="pipeline-grid"><thead><tr><th>✔</th><th>Username</th><th>Email</th><th>Revenue</th><th>Item sold</th><th>Followers</th><th>KOL</th><th>Campaign</th><th>Mode</th></tr></thead><tbody>
            {previewRows(rows).map((row, i) => {
              const complete = rowComplete(row);
              return (
                <tr key={i} className={complete ? '' : 'p-incomplete'}>
                  <td><input type="checkbox" checked={include[i] === true} onChange={e => setInclude(inc => ({ ...inc, [i]: e.target.checked }))} /></td>
                  <td className="p-username">{row.username}</td>
                  <td>{row.email || <em className="p-missing">kosong</em>}</td>
                  <td>{row.revenue || '—'}</td>
                  <td>{row.itemSold || '—'}</td>
                  <td>{row.followers || '—'}</td>
                  <td>{row.sourceKol || '—'}</td>
                  <td>{row.campaign || '—'}</td>
                  <td>{row.type}</td>
                </tr>
              );
            })}
          </tbody></table></div>
          {showMoreFooter(rows)}
          <div className="grid-actions">
            <button className="secondary" onClick={() => setStep(3)}>« Kembali</button>
            <button onClick={save} disabled={busy}>{busy ? 'Menyimpan…' : `Simpan ${completeRows.length} baris`}</button>
          </div>
        </div>
      )}
    </section>
  );
}

function statusLabel(status: RowStatus): string {
  switch (status) {
    case 'clean': return 'Bersih';
    case 'dup': return 'Duplikat';
    default: return 'Belum dicek';
  }
}
