import { useState } from 'react';

const USERNAME_RE = /@([a-zA-Z0-9._-]+)/;
const cleanLine = (line: string): string | null => {
  const m = line.match(USERNAME_RE);
  return m ? m[1] : null;
};

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

export default function UsernameCleanerPanel() {
  const [raw, setRaw] = useState('');
  const [names, setNames] = useState<string[]>([]);
  const [dedup, setDedup] = useState(false);
  const [skipped, setSkipped] = useState(0);
  const [copied, setCopied] = useState('');

  const run = () => {
    const lines = raw.split(/\r?\n/).filter(l => l.trim());
    const found: string[] = [];
    let skip = 0;
    for (const line of lines) {
      const u = cleanLine(line);
      if (u) found.push(u); else skip++;
    }
    setSkipped(skip);
    setNames(dedup ? [...new Set(found)] : found);
    setCopied('');
  };

  const visible = dedup ? [...new Set(names)] : names;

  return (
    <section>
      <div className="card">
        <div className="pipeline-head">
          <div><h2>Username Cleaner</h2><p>Tempel teks kotor (hasil scraping / copy dari TikTok) → keluar daftar username bersih, satu per baris. Ambil <b>@ pertama</b> di tiap baris.</p></div>
        </div>
        <textarea value={raw} onChange={e => setRaw(e.target.value)} placeholder={'Tempel di sini…\n\nContoh:\n@iambeshada Snippet\nQuestions? Ask in Chat 🫶 @genxbeautyfinds Snippet\nBlack Friday big sale @sunwoo_classy_us Snippet'} />
        <div className="grid-actions">
          <button onClick={run}>Ekstrak username</button>
          <button className="secondary" onClick={() => { setDedup(v => !v); setCopied(''); if (names.length) setNames(dedup ? names : [...new Set(names)]); }}>{dedup ? 'Duplikat digabung' : 'Hapus duplikat'}</button>
          <button className="secondary" onClick={() => { setRaw(''); setNames([]); setSkipped(0); setCopied(''); }}>Bersihkan</button>
        </div>
      </div>

      {names.length > 0 && (
        <div className="card">
          <div className="activity-head">
            <div><b>Hasil</b><small>{visible.length} username{dedup && names.length !== visible.length ? ` (dari ${names.length} ditemukan)` : ''} · {skipped} baris tanpa @ dilewati</small></div>
            <div className="activity-controls">
              <button className="secondary" onClick={async () => { const ok = await copyText(visible.join('\n')); setCopied(ok ? '✔ Tersalin' : 'Gagal menyalin'); }}>Copy hasil</button>
            </div>
          </div>
          {copied && <span className="activity-copy-status">{copied}</span>}
          <div className="table-wrap"><table><thead><tr><th>#</th><th>Username</th></tr></thead><tbody>
            {visible.map((u, i) => (
              <tr key={u + i}><td>{i + 1}</td><td className="p-username">{u}</td></tr>
            ))}
          </tbody></table></div>
        </div>
      )}
    </section>
  );
}
