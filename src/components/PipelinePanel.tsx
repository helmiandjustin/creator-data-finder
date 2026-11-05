import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { errorText, savePipelineRows } from '../services/search';
import { cleanUsername, getOfficePics, isOfficeDuplicate, parseNumber } from '../services/useeView';
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
const FIELD_ORDER_STEP0 = ['username', 'revenue', 'itemSold', 'followers'];
const FIELD_ORDER_STEP3 = ['username', 'revenue', 'itemSold', 'followers', 'sourceKol', 'campaign', 'type'];
const FIELD_ORDER_EMAIL = ['username', 'email'];
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
const cleanEmail = (value: string): string => {
  const s = (value || '').trim();
  if (!s || /^not found$/i.test(s)) return '';
  // Ekstrak pola alamat email valid dari teks yang mungkin mengandung junk di depan/belakang.
  const m = s.match(/[A-Z0-9][A-Z0-9._%+-]*@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0] : s;
};
const rowComplete = (row: PRow) => isValidEmail(row.email) && Boolean(row.revenue) && Boolean(row.itemSold);

export default function PipelinePanel({ catalog }: { catalog?: Catalog | null }) {
  const [step, setStep] = useState(0);
  const [rows, setRows] = useState<PRow[]>([]);
  const [recordDate, setRecordDate] = useState(todayIso());
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showCleanOnly, setShowCleanOnly] = useState(false);
  const [include, setInclude] = useState<Record<number, boolean>>({});
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [kolFill, setKolFill] = useState('');
  const [campFill, setCampFill] = useState('Expert Search Kalodata');
  const [modeFill, setModeFill] = useState<'' | ImportType>('');
  const [showAll, setShowAll] = useState(false);
  const [droppedCount, setDroppedCount] = useState(0);

  useEffect(() => { if (rows.length) setInclude(rows.reduce<Record<number, boolean>>((acc, row, i) => { acc[i] = row.status === 'clean'; return acc; }, {})); }, [rows]);
  useEffect(() => { setNotice(''); setShowAll(false); }, [step]);

  const campaignOptions = (catalog?.brands ?? []).flatMap(brand => [brand.name, ...brand.products.map(product => `${brand.name} · ${product}`)]);

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

  const emptyRow = (): PRow => ({ username: '', email: '', revenue: '', itemSold: '', followers: '', sourceKol: '' as PRow['sourceKol'], campaign: '', type: 'Listing' as ImportType, status: 'unknown' as RowStatus, officePics: [] as string[] });

  const updateRow = (index: number, patch: Partial<PRow>) => setRows(prev => {
    const next = [...prev];
    while (next.length <= index) next.push(emptyRow());
    next[index] = { ...next[index], ...patch };
    return next;
  });

  const applyKol = () => { if (kolFill) setRows(rows.map(row => ({ ...row, sourceKol: kolFill as PRow['sourceKol'] }))); };
  const applyCamp = () => { if (campFill.trim()) setRows(rows.map(row => ({ ...row, campaign: campFill.trim() }))); };
  const applyModeAll = (mode: ImportType) => { setRows(rows.map(row => ({ ...row, type: mode }))); };

  const clearAll = () => {
    if (!rows.length) return;
    if (!window.confirm('Kosongkan semua baris? Data yang belum disimpan akan hilang.')) return;
    setRows([]); setInclude({}); setChecked(false); setDroppedCount(0);
  };

  const handleGridPaste = (e: React.ClipboardEvent<HTMLInputElement>, colKey: string, fieldOrder: string[], startIndex: number) => {
    const text = e.clipboardData.getData('text');
    if (!text.trim()) return;
    e.preventDefault();
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (!lines.length) return;
    const startCol = fieldOrder.indexOf(colKey);
    if (startCol < 0) return;
    setRows(prev => {
      const next = [...prev];
      let filled = 0;
      for (let r = 0; r < lines.length; r++) {
        const destRow = startIndex + r;
        while (next.length <= destRow) next.push(emptyRow());
        let cells = lines[r].split(/[\t;]|\s{2,}/).map(c => c.trim());
        // Lewati kolom angka di depan (mis. ID/rank dari Excel) saat menempel ke kolom username,
        // supaya kolom tidak pernah bergeser meski kolom ID ikut tersalin.
        if (fieldOrder[startCol] === 'username') {
          let ci = 0;
          while (ci < cells.length && /^\d+(?:[.,]\d+)?$/.test(cells[ci])) ci++;
          if (ci > 0) cells = cells.slice(ci);
        }
        for (let c = 0; c < cells.length; c++) {
          const raw = cells[c];
          if (!raw) continue;
          const field = fieldOrder[startCol + c];
          if (!field) continue;
          const row = { ...next[destRow] };
          switch (field) {
            case 'username': row.username = cleanUsername(raw); break;
            case 'email': { const em = cleanEmail(raw); if (em) row.email = em; break; }
            case 'revenue': row.revenue = raw; break;
            case 'itemSold': row.itemSold = raw; break;
            case 'followers': row.followers = raw; break;
            case 'campaign': row.campaign = raw; break;
            case 'sourceKol': if ((REVENUE_SOURCES as readonly string[]).includes(raw)) row.sourceKol = raw as PRow['sourceKol']; break;
            case 'type': { const t = raw.toLowerCase() === 'hijack' ? 'Hijack' : raw.toLowerCase() === 'listing' ? 'Listing' : null; if (t) row.type = t as ImportType; break; }
          }
          next[destRow] = row;
          filled++;
        }
      }
      setNotice(`${filled} sel terisi mulai baris ${startIndex + 1}.`);
      return next;
    });
  };

  const exportUsernames = async () => {
    const list = rows.map(row => row.username);
    const ok = await copyText(list.join('\n'));
    setNotice(ok ? `${list.length} username disalin ke clipboard.` : 'Gagal menyalin ke clipboard.');
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
        itemSold: Math.round(parseNumber(row.itemSold) ?? 0),
        followers: Math.round(parseNumber(row.followers) ?? 0),
        sourceRevenueKol: row.sourceKol || null,
        campaign: row.campaign || null,
        type: row.type,
        source: 'pipeline',
      }));
      if (!toSave.length) { setError('Tidak ada baris lengkap untuk disimpan (semua butuh email + revenue + item sold).'); setBusy(false); return; }
      const result = await savePipelineRows(toSave, done => setProgress({ done, total: toSave.length }));
      setNotice(`${result.inserted} baru disimpan · ${result.updated} diperbarui.`);
      setRows([]); setStep(0); setProgress({ done: 0, total: 0 });
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
          <h2>1 · Tempel & Parse</h2>
          <p>Klik sel di grid, lalu Ctrl+V dari Excel — nilai otomatis terisi ke bawah (fill down). Untuk menambah baris baru, klik sel di baris terbawah (baris "+") lalu Ctrl+V.</p>
          <div className="table-wrap"><table className="pipeline-grid"><thead><tr><th>Username</th><th>Revenue</th><th>Item sold</th><th>Followers</th></tr></thead><tbody>
            {Array.from({ length: Math.max(Math.min(rows.length, showAll ? rows.length : 5), 1) }).map((_, i) => {
              const row = rows[i] ?? emptyRow();
              return (
                <tr key={i}>
                  <td className="p-username"><input value={row.username} onChange={e => updateRow(i, { username: e.target.value })} onPaste={e => handleGridPaste(e, 'username', FIELD_ORDER_STEP0, i)} placeholder="@username" /></td>
                  <td><input value={row.revenue} onChange={e => updateRow(i, { revenue: e.target.value })} onPaste={e => handleGridPaste(e, 'revenue', FIELD_ORDER_STEP0, i)} placeholder="0" /></td>
                  <td><input value={row.itemSold} onChange={e => updateRow(i, { itemSold: e.target.value })} onPaste={e => handleGridPaste(e, 'itemSold', FIELD_ORDER_STEP0, i)} placeholder="0" /></td>
                  <td><input value={row.followers} onChange={e => updateRow(i, { followers: e.target.value })} onPaste={e => handleGridPaste(e, 'followers', FIELD_ORDER_STEP0, i)} placeholder="0" /></td>
                </tr>
              );
            })}
            {rows.length > 0 && (
              <tr className="p-append-row">
                <td><input onPaste={e => handleGridPaste(e, 'username', FIELD_ORDER_STEP0, rows.length)} placeholder="@username +" /></td>
                <td><input onPaste={e => handleGridPaste(e, 'revenue', FIELD_ORDER_STEP0, rows.length)} placeholder="0 +" /></td>
                <td><input onPaste={e => handleGridPaste(e, 'itemSold', FIELD_ORDER_STEP0, rows.length)} placeholder="0 +" /></td>
                <td><input onPaste={e => handleGridPaste(e, 'followers', FIELD_ORDER_STEP0, rows.length)} placeholder="0 +" /></td>
              </tr>
            )}
          </tbody></table></div>
          <div className="grid-actions">
            {rows.length > 5 && (
              <button className="secondary" onClick={() => setShowAll(v => !v)}>{showAll ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${rows.length})`}</button>
            )}
            {rows.length > 0 && <button className="secondary" onClick={clearAll}>Clear (kosongkan semua)</button>}
            <button className="secondary" disabled={!rows.length} onClick={() => { setChecked(false); setDroppedCount(0); setStep(1); }}>Lanjut ke Cek Duplikat »</button>
          </div>
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
            <label>Mode<select value={modeFill} onChange={e => setModeFill(e.target.value as ImportType)}><option value="">—</option><option value="Listing">Listing</option><option value="Hijack">Hijack</option></select><button className="secondary" onClick={() => { if (modeFill) applyModeAll(modeFill); }}>Apply ke semua</button></label>
          </div>
          <div className="table-wrap"><table className="pipeline-grid"><thead><tr><th>Username</th><th>Revenue</th><th>Item sold</th><th>Followers</th><th>Source Revenue</th><th>Campaign</th><th>Mode</th></tr></thead><tbody>
            {Array.from({ length: Math.max(Math.min(rows.length, showAll ? rows.length : 5), 1) }).map((_, i) => {
              const row = rows[i] ?? emptyRow();
              return (
                <tr key={i}>
                  <td className="p-username"><input value={row.username} onChange={e => updateRow(i, { username: e.target.value })} onPaste={e => handleGridPaste(e, 'username', FIELD_ORDER_STEP3, i)} placeholder="@username" /></td>
                  <td><input value={row.revenue} onChange={e => updateRow(i, { revenue: e.target.value })} onPaste={e => handleGridPaste(e, 'revenue', FIELD_ORDER_STEP3, i)} placeholder="0" /></td>
                  <td><input value={row.itemSold} onChange={e => updateRow(i, { itemSold: e.target.value })} onPaste={e => handleGridPaste(e, 'itemSold', FIELD_ORDER_STEP3, i)} placeholder="0" /></td>
                  <td><input value={row.followers} onChange={e => updateRow(i, { followers: e.target.value })} onPaste={e => handleGridPaste(e, 'followers', FIELD_ORDER_STEP3, i)} placeholder="0" /></td>
                  <td><select value={row.sourceKol} onChange={e => updateRow(i, { sourceKol: e.target.value as PRow['sourceKol'] })}><option value="">—</option>{REVENUE_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}</select></td>
                  <td><input list="pipeline-campaign-list" value={row.campaign} onChange={e => updateRow(i, { campaign: e.target.value })} onPaste={e => handleGridPaste(e, 'campaign', FIELD_ORDER_STEP3, i)} placeholder="expert search / bebas" /></td>
                  <td><div className="mode-switch p-mode"><button className={row.type === 'Listing' ? '' : 'secondary'} onClick={() => updateRow(i, { type: 'Listing' })}>Listing</button><button className={row.type === 'Hijack' ? '' : 'secondary'} onClick={() => updateRow(i, { type: 'Hijack' })}>Hijack</button></div></td>
                </tr>
              );
            })}
            {rows.length > 0 && (
              <tr className="p-append-row">
                <td><input onPaste={e => handleGridPaste(e, 'username', FIELD_ORDER_STEP3, rows.length)} placeholder="@username +" /></td>
                <td><input onPaste={e => handleGridPaste(e, 'revenue', FIELD_ORDER_STEP3, rows.length)} placeholder="0 +" /></td>
                <td><input onPaste={e => handleGridPaste(e, 'itemSold', FIELD_ORDER_STEP3, rows.length)} placeholder="0 +" /></td>
                <td><input onPaste={e => handleGridPaste(e, 'followers', FIELD_ORDER_STEP3, rows.length)} placeholder="0 +" /></td>
                <td><input onPaste={e => handleGridPaste(e, 'sourceKol', FIELD_ORDER_STEP3, rows.length)} placeholder="live/videos +" /></td>
                <td><input onPaste={e => handleGridPaste(e, 'campaign', FIELD_ORDER_STEP3, rows.length)} placeholder="campaign +" /></td>
                <td><input onPaste={e => handleGridPaste(e, 'type', FIELD_ORDER_STEP3, rows.length)} placeholder="Listing/Hijack +" /></td>
              </tr>
            )}
          </tbody></table></div>
          <datalist id="pipeline-campaign-list">{campaignOptions.map(option => <option key={option} value={option} />)}</datalist>
          <div className="grid-actions">
            {rows.length > 5 && (
              <button className="secondary" onClick={() => setShowAll(v => !v)}>{showAll ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${rows.length})`}</button>
            )}
            {rows.length > 0 && <button className="secondary" onClick={clearAll}>Clear (kosongkan semua)</button>}
            <button className="secondary" onClick={() => setStep(1)}>« Kembali</button>
            <button onClick={() => setStep(3)}>Lanjut ke Email »</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card">
          <h2>4 · Cari Email</h2>
          <p>Salin hasil dari tool cari email kamu (kolom username + email), lalu tempel langsung ke grid di bawah — nilai otomatis mengisi baris (fill down), sama seperti Tempel & Parse. Hanya baris yang kamu tempel yang terisi, jadi jumlahnya pasti exact.</p>
          <div className="grid-actions">
            <button className="secondary" onClick={exportUsernames}>Copy semua username</button>
          </div>
          <div className="table-wrap"><table className="pipeline-grid"><thead><tr><th>Username</th><th>Email</th></tr></thead><tbody>
            {Array.from({ length: Math.max(Math.min(rows.length, showAll ? rows.length : 5), 1) }).map((_, i) => {
              const row = rows[i] ?? emptyRow();
              return (
                <tr key={i}>
                  <td className="p-username"><input value={row.username} onChange={e => updateRow(i, { username: e.target.value })} onPaste={e => handleGridPaste(e, 'username', FIELD_ORDER_EMAIL, i)} placeholder="@username" /></td>
                  <td><input value={row.email} onChange={e => updateRow(i, { email: e.target.value })} onPaste={e => handleGridPaste(e, 'email', FIELD_ORDER_EMAIL, i)} placeholder="email" /></td>
                </tr>
              );
            })}
            {rows.length > 0 && (
              <tr className="p-append-row">
                <td><input onPaste={e => handleGridPaste(e, 'username', FIELD_ORDER_EMAIL, rows.length)} placeholder="@username +" /></td>
                <td><input onPaste={e => handleGridPaste(e, 'email', FIELD_ORDER_EMAIL, rows.length)} placeholder="email +" /></td>
              </tr>
            )}
          </tbody></table></div>
          <div className="pipeline-summary"><span><b>{rows.filter(r => r.email).length}</b> punya email</span><span><b>{missingEmail}</b> belum (akan ditandai)</span></div>
          <div className="grid-actions">
            {rows.length > 5 && (
              <button className="secondary" onClick={() => setShowAll(v => !v)}>{showAll ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${rows.length})`}</button>
            )}
            {rows.length > 0 && <button className="secondary" onClick={clearAll}>Clear (kosongkan semua)</button>}
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
