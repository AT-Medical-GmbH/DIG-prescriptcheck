import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, ConfirmDialog, Empty, Field, Spinner, useAction, useLoad } from '../components.jsx';
import { fmtDateTime } from '../format.js';

const PICKUP = { PATIENT: 'Patient/in selbst', TRUSTEE: 'Vertrauensperson', THIRD: 'Andere Person' };

export default function Redemptions() {
  const { user } = useAuth();
  const list = useLoad(() => api.get('/redemptions?limit=50'));
  const [target, setTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');
  const { busy, error, setError, run } = useAction();
  const canCancel = user.role === 'PHARMACIST';

  const cancel = () => run(async () => {
    await api.post(`/redemptions/${target}/cancel`, { reason });
    setMsg(`Die Einlösung von ${target} wurde storniert.`);
    setTarget(null); setReason(''); list.reload();
  });

  return (
    <div className="stack">
      <h1>Letzte Einlösungen</h1>
      <p className="muted">Zum Schutz der Patientendaten werden hier keine Patienteninformationen angezeigt. Eine Einlösung kann nur in den ersten 15 Minuten storniert werden.</p>
      <Alert kind="ok" onClose={() => setMsg('')}>{msg}</Alert>
      <Alert>{list.error}</Alert>
      {list.loading ? <Spinner /> : list.data.length === 0 ? <Empty>Noch keine Einlösungen.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Rezept-ID</th><th>Eingelöst am</th><th>Abholung durch</th><th /></tr></thead>
            <tbody>
              {list.data.map((r) => (
                <tr key={r.serial}>
                  <td className="mono">{r.serial}</td><td>{fmtDateTime(r.redeemedAt)}</td><td>{PICKUP[r.pickedUpBy] || r.pickedUpBy}</td>
                  <td>{canCancel && r.cancellable && <button className="btn btn-small btn-danger-outline" onClick={() => { setError(''); setTarget(r.serial); }}>Stornieren …</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {target && (
        <ConfirmDialog title="Einlösung stornieren?" confirmLabel="Stornieren" danger busy={busy} onCancel={() => setTarget(null)} onConfirm={cancel}>
          <p>Rezept <span className="mono">{target}</span> wird wieder einlösbar. Die Praxis wird informiert.</p>
          <Field label="Begründung (Pflicht)" htmlFor="why"><input id="why" required maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></Field>
          <Alert>{error}</Alert>
        </ConfirmDialog>
      )}
    </div>
  );
}
