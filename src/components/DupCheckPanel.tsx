import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { errorText } from '../services/search';
import { cleanUsername, getOfficePics, isOfficeDuplicate } from '../services/useeView';

type RowStatus = 'unknown' | 'clean' | 'dup';

type DupRow = { username: string; status: RowStatus; officePics: string[] };

const copy = (text: string) => navigator.clipboard.writeText(text);
const statusLabel = (status: RowStatus) => {
  switch (status) {
    case 'clean': return 'Bersih';
    case 'dup': return 'Duplikat';
    default: return 'Belum dicek';
  }
};

export default function DupCheckPanel() {
  const [input, setInput] = useState('');
  const [rows, setRows] = useState<DupRow[]>([]);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [showAll, setShowAll] = useState(false);

  const run = async () => {
    const usernames = input.split(/\r?\n/).map(cleanUsername).filter(Boolean);
    usernames.length = [...new Set(usernames)].length;
    if (!usernames.length) return;
    setChecking(true); setError(''); setCopied('');
    try {
      const self = new Set<string>();
      for (let i = 0; i < usernames.length; i += 500) {
        const chunk = usernames.slice(i, i + 500);
        const { data } = await supabase!.from('creators').select('normalized_tiktok').in('normalized_tiktok', chunk);
        for (const r of data ?? []) if (r.normalized_tiktok) self.add(r.normalized_tiktok);
      }
      const officeMap = await getOfficePics(usernames);
      setRows(usernames.map(username => {
        const pics = officeMap[username] ?? [];
        const selfHit = self.has(username);
        const offDup = isOfficeDuplicate(pics);
        const status: RowStatus = (selfHit || offDup) ? 'dup' : 'clean';
        return { username, status, officePics: pics };
      }));
    } catch (e) { setError(errorText(e)); }
    finally { setChecking(false); }
  };

  const counts = {
    clean: rows.filter(r => r.status === 'clean').length,
    dup: rows.filter(r => r.status === 'dup').length,
  };

  const copyStatus = async (status: RowStatus) => {
    const list = rows.filter(r => r.status === status).map(r => r.username).join('\n');
    await copy(list);
    setCopied(`${statusLabel(status)}: ${rows.filter(r => r.status === status).length} username disalin`);
  };

  return (
    <section>
      <div className="card">
        <h2>Cek Duplikat</h2>
        <p>Tempel daftar username (satu per baris, boleh dengan @ atau URL). Sistem membandingkan dengan justin dan kantor (PIC resign tidak dihitung duplikat).</p>
        <textarea value={input} onChange={e => setInput(e.target.value)} placeholder={'@honeybutter_babe\nbecca_brasher\nhinamakuhelmi'} />
        <div className="batch-actions">
          <span>{input.split(/\r?\n/).map(cleanUsername).filter(Boolean).length} username</span>
          <button onClick={run} disabled={checking || !input.trim()}>{checking ? 'Memeriksa…' : 'Cek duplikat'}</button>
        </div>
        {error && <p className="error">{error}</p>}
        {copied && <p className="pipeline-notice">{copied}</p>}
      </div>

      {rows.length > 0 && (
        <div className="card">
          <div className="pipeline-summary">
            <span><b>{rows.length}</b> total</span>
            <span><b>{counts.clean}</b> bersih</span>
            <span className="p-dup"><b>{counts.dup}</b> duplikat</span>
          </div>
          <div className="grid-actions">
            <button className="secondary" onClick={() => copyStatus('clean')}>Copy bersih</button>
            <button className="secondary" onClick={() => copyStatus('dup')}>Copy duplikat</button>
            {rows.length > 5 && <button className="secondary" onClick={() => setShowAll(v => !v)}>{showAll ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${rows.length})`}</button>}
          </div>
          <div className="table-wrap"><table><thead><tr><th>Username</th><th>Status</th><th>PIC kantor</th></tr></thead><tbody>
            {(showAll ? rows : rows.slice(0, 5)).map((row, i) => (
              <tr key={i}><td>{row.username}</td><td><span className={`status p-status-${row.status}`}>{statusLabel(row.status)}</span></td><td>{row.officePics.length ? row.officePics.join(', ') : '—'}</td></tr>
            ))}
          </tbody></table></div>
        </div>
      )}
    </section>
  );
}
