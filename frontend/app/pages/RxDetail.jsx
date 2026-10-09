import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, ConfirmDialog, Field, Spinner, StateBadge, useAction, useLoad } from '../components.jsx';
import { BLOCK_REASON_LABELS, fmtDate, fmtDateTime } from '../format.js';
import { ReasonSelect } from './RxList.jsx';

export default function RxDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const rx = useLoad(() => api.get(`/prescriptions/${id}`), [id]);
  const [dialog, setDialog] = useState(null); // 'block' | 'unblock' | 'discard' | 'issue'
  const [reason, setReason] = useState('LOSS');
  const [text, setText] = useState('');
  const { busy, error, setError, run } = useAction();
  const d = rx.data;
  const prescriber = user.role === 'PRESCRIBER';
  const close = () => { setDialog(null); setError(''); setText(''); };

  const act = (fn) => run(async () => { await fn(); close(); rx.reload(); });
  const pdf = () => run(async () => { await api.openPdf(`/prescriptions/${id}/pdf`); rx.reload(); });

  if (rx.loading) return <Spinner />;
  if (rx.error) return <div className="stack"><Alert>{rx.error}</Alert><Link to="/rezepte">Zurück zur Liste</Link></div>;

  return (
    <div className="stack">
      <div className="row between wrap">
        <h1>{d.serial ? <span className="mono">{d.serial}</span> : 'Entwurf'} <StateBadge state={d.state} /></h1>
        <Link to="/rezepte">← Alle Rezepte</Link>
      </div>
      {location.state?.justIssued && <Alert kind="ok">Das Rezept wurde ausgestellt. Sie können es jetzt drucken.</Alert>}
      <Alert>{error}</Alert>
      {d.state === 'BLOCKED' && <Alert kind="warn">Gesperrt ({BLOCK_REASON_LABELS[d.blockReason] || d.blockReason}){d.blockedBy === 'QS' ? ' durch die Qualitätssicherung nach einer Verdachtsmeldung' : ''}. Das Rezept kann nicht eingelöst werden.</Alert>}
      {d.state === 'REDEEMED' && <Alert kind="info">Eingelöst am {fmtDateTime(d.redeemedAt)}{d.redeemedByPharmacy ? ` in: ${d.redeemedByPharmacy}` : ''}.</Alert>}
      {d.qsFlags.length > 0 && d.state === 'ISSUED' && <Alert kind="warn">Zu diesem Rezept liegen QS-Hinweise vor ({d.qsFlags.map((f) => f.type).join(', ')}).</Alert>}

      <section className="card">
        <dl className="kv">
          <dt>Patient/in</dt><dd>{d.patient.name}</dd>
          <dt>Geburtsdatum</dt><dd>{fmtDate(Date.parse(`${d.patient.dob}T12:00:00Z`))}</dd>
          <dt>Verordnende Person</dt><dd>{d.prescriberName || '–'}</dd>
          <dt>Ausgestellt</dt><dd>{fmtDateTime(d.issuedAt)}</dd>
          <dt>Gültig bis</dt><dd>{fmtDate(d.expiresAt)}</dd>
          <dt>Ausdrucke</dt><dd>{d.printCount}</dd>
        </dl>
      </section>
      <section className="card">
        <h2>Verordnung</h2>
        <ol className="items">
          {d.items.map((it, i) => (
            <li key={i}><strong>{it.medication}</strong>
              <div className="muted">{[it.form, it.strength, `Menge: ${it.quantity}`].filter(Boolean).join(' · ')}</div>
              {it.dosage && <div className="muted">Dosierung: {it.dosage}</div>}
            </li>
          ))}
        </ol>
        {d.note && <p><span className="muted">Hinweis: </span>{d.note}</p>}
      </section>

      <div className="row wrap">
        {d.state === 'DRAFT' && <Link className="btn" to={`/rezepte/${d.id}/bearbeiten`}>Bearbeiten</Link>}
        {d.state === 'DRAFT' && prescriber && <button className="btn btn-primary" onClick={() => setDialog('issue')}>Ausstellen …</button>}
        {d.state === 'DRAFT' && <button className="btn btn-danger-outline" onClick={() => setDialog('discard')}>Verwerfen …</button>}
        {d.state === 'ISSUED' && <button className="btn btn-primary" onClick={pdf} disabled={busy}>{d.printCount ? 'Duplikat drucken (PDF)' : 'Drucken (PDF)'}</button>}
        {d.state === 'ISSUED' && prescriber && <button className="btn btn-danger-outline" onClick={() => setDialog('block')}>Sperren …</button>}
        {d.state === 'BLOCKED' && d.blockedBy === 'PRESCRIBER' && prescriber && <button className="btn" onClick={() => setDialog('unblock')}>Sperre aufheben …</button>}
      </div>

      {dialog === 'issue' && (
        <ConfirmDialog title="Rezept jetzt ausstellen?" confirmLabel="Verbindlich ausstellen" busy={busy} onCancel={close} onConfirm={() => act(async () => { await api.post(`/prescriptions/${id}/issue`); })}>
          <p>Nach dem Ausstellen ist das Rezept unveränderlich.</p><Alert>{error}</Alert>
        </ConfirmDialog>
      )}
      {dialog === 'discard' && (
        <ConfirmDialog title="Entwurf verwerfen?" confirmLabel="Verwerfen" danger busy={busy} onCancel={close} onConfirm={() => run(async () => { await api.post(`/prescriptions/${id}/discard`); nav('/rezepte'); })}>
          <p>Der Entwurf wird verworfen und kann nicht mehr ausgestellt werden.</p><Alert>{error}</Alert>
        </ConfirmDialog>
      )}
      {dialog === 'block' && (
        <ConfirmDialog title="Rezept sperren?" confirmLabel="Jetzt sperren" danger busy={busy} onCancel={close} onConfirm={() => act(async () => { await api.post(`/prescriptions/${id}/block`, { reason }); })}>
          <p>Ein gesperrtes Rezept kann in keiner Apotheke eingelöst werden. Sie können die Sperre später wieder aufheben.</p>
          <Field label="Grund" htmlFor="reason"><ReasonSelect value={reason} onChange={setReason} /></Field><Alert>{error}</Alert>
        </ConfirmDialog>
      )}
      {dialog === 'unblock' && (
        <ConfirmDialog title="Sperre aufheben?" confirmLabel="Sperre aufheben" busy={busy} onCancel={close} onConfirm={() => act(async () => { await api.post(`/prescriptions/${id}/unblock`, { reason: text }); })}>
          <Field label="Begründung (Pflicht)" htmlFor="why"><input id="why" value={text} onChange={(e) => setText(e.target.value)} required maxLength={300} autoFocus /></Field><Alert>{error}</Alert>
        </ConfirmDialog>
      )}
    </div>
  );
}
