import { useState } from 'react';
import { api } from '../api.js';
import { Alert, ConfirmDialog, Empty, Field, Spinner, StateBadge, useAction, useLoad } from '../components.jsx';
import { fmtDateTime } from '../format.js';

export default function QsCases() {
  const list = useLoad(() => api.get('/qs/flagged'));
  const [target, setTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const { busy, error, setError, run } = useAction();

  const unblock = () => run(async () => {
    await api.post(`/qs/prescriptions/${target}/unblock`, { reason });
    setMsg(`Sperre von ${target} aufgehoben.`);
    setTarget(null); setReason(''); list.reload();
  });

  return (
    <div className="stack">
      <h1>QS-Fälle</h1>
      <p className="muted">Gemeldete und auffällige Rezepte. Aus Datenschutzgründen sind Patienten- und Verordnungsdaten für die QS nicht sichtbar – Klärungen erfolgen mit der ausstellenden Praxis.</p>
      <Alert kind="ok" onClose={() => setMsg('')}>{msg}</Alert>
      <Alert>{list.error}</Alert>
      {list.loading ? <Spinner /> : list.data.length === 0 ? <Empty>Keine offenen Fälle.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Rezept-ID</th><th>Praxis</th><th>Status</th><th>Hinweise</th><th>Gesperrt am</th><th /></tr></thead>
            <tbody>
              {list.data.map((c) => (
                <tr key={c.serial}>
                  <td className="mono">{c.serial}</td><td>{c.practiceName}</td><td><StateBadge state={c.state} /></td>
                  <td>{c.flags.map((f) => f.category || f.type).join(', ') || '–'}</td><td>{fmtDateTime(c.blockedAt)}</td>
                  <td>{c.state === 'BLOCKED' && c.blockedBy === 'QS' && <button className="btn btn-small" onClick={() => { setError(''); setTarget(c.serial); }}>Sperre aufheben …</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {target && (
        <ConfirmDialog title="QS-Sperre aufheben?" confirmLabel="Sperre aufheben" busy={busy} onCancel={() => setTarget(null)} onConfirm={unblock}>
          <p>Rezept <span className="mono">{target}</span> wird wieder einlösbar. Nur nach Rücksprache mit der Praxis.</p>
          <Field label="Begründung (Pflicht)" htmlFor="why"><input id="why" required maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></Field>
          <Alert>{error}</Alert>
        </ConfirmDialog>
      )}
    </div>
  );
}
