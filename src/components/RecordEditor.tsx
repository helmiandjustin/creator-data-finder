import { useState } from 'react';
import { updateSavedRecord, type EditableRecord } from '../services/search';

export default function RecordEditor({ record, onClose, onSaved }: { record: EditableRecord; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(record.date);
  const [username, setUsername] = useState(record.username);
  const [email, setEmail] = useState(record.email);
  const [campaign, setCampaign] = useState(record.campaign ?? '');
  const [revenue, setRevenue] = useState(record.revenue ?? '');
  const [itemSold, setItemSold] = useState(record.itemSold ?? '');
  const [followers, setFollowers] = useState(record.followers ?? '');
  const [sourceRevenueKol, setSourceRevenueKol] = useState(record.sourceRevenueKol ?? '');
  const [type, setType] = useState(record.type ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!username.trim() && !email.trim()) { setError('Isi username atau email dulu.'); return; }
    setBusy(true); setError('');
    try {
      await updateSavedRecord({
        source: record.source,
        id: record.id,
        date,
        username,
        email,
        campaign,
        revenue,
        itemSold,
        followers,
        sourceRevenueKol,
        type: (type as EditableRecord['type']),
      });
      onSaved();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="record-modal-overlay" onClick={onClose}>
      <div className="record-modal" onClick={e => e.stopPropagation()}>
        <div className="record-modal-head">
          <b>Edit record</b>
          <span>{record.source === 'hijack_records' ? 'Hijack' : record.type === 'Hijack' ? 'Hijack' : 'Listing'} · id {record.id}</span>
          <button className="secondary" onClick={onClose}>✕</button>
        </div>
        <div className="record-form">
          <label>Tanggal<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
          <label>Username<input value={username} onChange={e => setUsername(e.target.value)} placeholder="@username" /></label>
          <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email" /></label>
          <label>Campaign<input value={campaign} onChange={e => setCampaign(e.target.value)} /></label>
          <label>Revenue<input type="number" step="0.01" value={revenue} onChange={e => setRevenue(e.target.value)} /></label>
          <label>Item sold<input type="number" step="1" value={itemSold} onChange={e => setItemSold(e.target.value)} /></label>
          <label>Followers<input type="number" step="1" value={followers} onChange={e => setFollowers(e.target.value)} /></label>
          <label>Source revenue<select value={sourceRevenueKol} onChange={e => setSourceRevenueKol(e.target.value)}><option value="">—</option><option value="live">live</option><option value="videos">videos</option></select></label>
          <label>Type<select value={type} onChange={e => setType(e.target.value as '' | 'Listing' | 'Hijack')}><option value="">—</option><option value="Listing">Listing</option><option value="Hijack">Hijack</option></select></label>
        </div>
        {record.source === 'hijack_records' && <p className="record-hint">Record Hijack hanya menyimpan tanggal, username, email, dan campaign.</p>}
        {error && <p className="error">{error}</p>}
        <div className="grid-actions">
          <button onClick={save} disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
          <button className="secondary" onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>
  );
}
