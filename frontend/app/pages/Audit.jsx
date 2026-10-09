import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, Empty, Field, Spinner, useAction, useLoad } from '../components.jsx';
import { fmtDateTime } from '../format.js';

export default function Audit() {
  const { user } = useAuth();
  const cross = ['PLATFORM_ADMIN', 'AUDITOR'].includes(user.role);
  const orgs = useLoad(() => (cross && user.role === 'PLATFORM_ADMIN' ? api.get('/admin/organizations') : Promise.resolve([])));
  const [chain, setChain] = useState('platform');
  const [verify, setVerify] = useState(null);
  const q = cross ? `?chain=${encodeURIComponent(chain)}&limit=100` : '?limit=100';
  const log = useLoad(() => api.get(`/audit${q}`), [chain]);
  const { busy, error, run } = useAction();

  const check = () => run(async () => setVerify(await api.get(`/audit/verify${cross ? `?chain=${encodeURIComponent(chain)}` : ''}`)));

  return (
    <div className="stack">
      <h1>Audit-Protokoll</h1>
      <p className="muted">Manipulationsgeschützte Protokollkette. Jeder Eintrag ist kryptografisch mit dem vorherigen verbunden; Änderungen oder Löschungen sind nachweisbar. Es werden keine Gesundheitsdaten protokolliert.</p>
      <Alert>{error || log.error}</Alert>
      <div className="toolbar">
        {cross && (
          <Field label="Kette" htmlFor="chain">
            <select id="chain" value={chain} onChange={(e) => { setChain(e.target.value); setVerify(null); }}>
              <option value="platform">Plattform</option>
              {(orgs.data || []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </Field>
        )}
        <button className="btn" onClick={check} disabled={busy}>Integrität prüfen</button>
      </div>
      {verify && (verify.ok
        ? <Alert kind="ok">Kette intakt – {verify.count} Einträge geprüft.</Alert>
        : <Alert>Kette beschädigt ab Eintrag {verify.brokenAt} ({verify.reason}).</Alert>)}
      {log.loading ? <Spinner /> : log.data.entries.length === 0 ? <Empty>Keine Einträge.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Zeitpunkt</th><th>Aktion</th><th>Ergebnis</th><th>Rolle</th><th>Rezept-ID</th><th>IP</th></tr></thead>
            <tbody>
              {log.data.entries.map((e) => (
                <tr key={e.seq}>
                  <td>{e.seq}</td><td>{fmtDateTime(e.ts)}</td><td className="mono">{e.action}</td>
                  <td><span className={`badge ${e.result === 'OK' ? 'badge-issued' : 'badge-blocked'}`}>{e.result}</span></td>
                  <td>{e.actor?.role || '–'}</td><td className="mono">{e.object?.serial || '–'}</td><td className="mono small">{e.ip || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
