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

  const typeLabel = record.source === 'hijack_records' ? 'Hijack' : record.type === 'Hijack' ? 'Hijack' : record.type === 'Listing' ? 'Listing' : '—';

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
          <div className="record-modal-title">
            <b>Edit record</b>
            <span className={`record-type-badge ${typeLabel === 'Hijack' ? 'hijack' : ''}`}>{typeLabel}</span>
          </div>
          <button className="record-close" onClick={onClose} aria-label="Tutup">✕</button>
        </div>

        <div className="record-section">
          <div className="record-section-label">Identitas</div>
          <div className="record-form">
            <label className="field-full">Username<input value={username} onChange={e => setUsername(e.target.value)} placeholder="@username" /></label>
            <label className="field-full">Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email" /></label>
            <label>Tanggal<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
          </div>
        </div>

        <div className="record-section">
          <div className="record-section-label">Detail</div>
          <div className="record-form">
            <label className="field-full">Campaign<input value={campaign} onChange={e => setCampaign(e.target.value)} placeholder="contoh: Overall brand: medicube" /></label>
            <label>Revenue<input type="number" step="0.01" min="0" value={revenue} onChange={e => setRevenue(e.target.value)} placeholder="0.00" /></label>
            <label>Item sold<input type="number" step="1" min="0" value={itemSold} onChange={e => setItemSold(e.target.value)} placeholder="0" /></label>
            <label>Followers<input type="number" step="1" min="0" value={followers} onChange={e => setFollowers(e.target.value)} placeholder="0" /></label>
            <label>Source revenue
              <div className="record-toggle">
                <button type="button" className={sourceRevenueKol === 'live' ? 'active' : ''} onClick={() => setSourceRevenueKol('live')}>live</button>
                <button type="button" className={sourceRevenueKol === 'videos' ? 'active' : ''} onClick={() => setSourceRevenueKol('videos')}>videos</button>
                <button type="button" className={!sourceRevenueKol ? 'active' : ''} onClick={() => setSourceRevenueKol('')}>—</button>
              </div>
            </label>
            <label>Type
              <div className="record-toggle">
                <button type="button" className={type === 'Listing' ? 'active' : ''} onClick={() => setType('Listing')}>Listing</button>
                <button type="button" className={type === 'Hijack' ? 'active' : ''} onClick={() => setType('Hijack')}>Hijack</button>
                <button type="button" className={!type ? 'active' : ''} onClick={() => setType('')}>—</button>
              </div>
            </label>
          </div>
        </div>

        {record.source === 'hijack_records' && <p className="record-hint">Record hijack hanya menyimpan tanggal, username, email, dan campaign.</p>}
        {error && <p className="record-error">{error}</p>}

        <div className="record-actions">
          <button className="secondary" onClick={onClose}>Batal</button>
          <button className="record-save" onClick={save} disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan perubahan'}</button>
        </div>
      </div>
    </div>
  );
}
