import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, ConfirmDialog, Empty, Field, Spinner, useAction, useLoad } from '../components.jsx';
import { ROLE_LABELS, fmtDateTime } from '../format.js';

const PRACTICE_ROLES = ['PRACTICE_ADMIN', 'PRESCRIBER', 'PRACTICE_STAFF'];
const PHARMACY_ROLES = ['PHARMACY_ADMIN', 'PHARMACIST', 'PHARMACY_STAFF'];
const PLATFORM_ROLES = ['SUPERVISOR', 'AUDITOR', 'PLATFORM_ADMIN'];

export default function Users() {
  const { user } = useAuth();
  const platform = user.role === 'PLATFORM_ADMIN';
  const orgs = useLoad(() => (platform ? api.get('/admin/organizations') : Promise.resolve([])));
  const users = useLoad(() => api.get(platform ? '/admin/users' : '/org/users'));
  const [form, setForm] = useState({ orgId: '', name: '', email: '', role: platform ? 'PRACTICE_ADMIN' : (user.orgType === 'PRACTICE' ? 'PRESCRIBER' : 'PHARMACIST') });
  const [created, setCreated] = useState(null);
  const [reset, setReset] = useState(null); // { user, resetMfa }
  const { busy, error, setError, run } = useAction();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const orgList = orgs.data || [];
  const selectedOrg = orgList.find((o) => o.id === form.orgId);
  const roles = platform
    ? [...(selectedOrg ? (selectedOrg.type === 'PRACTICE' ? PRACTICE_ROLES : PHARMACY_ROLES) : []), ...PLATFORM_ROLES]
    : (user.orgType === 'PRACTICE' ? PRACTICE_ROLES : PHARMACY_ROLES);
  const isPlatformRole = PLATFORM_ROLES.includes(form.role);

  const create = (e) => {
    e.preventDefault();
    run(async () => {
      const body = { name: form.name.trim(), email: form.email.trim(), role: form.role, ...(platform && !isPlatformRole ? { orgId: form.orgId } : {}) };
      setCreated(await api.post(platform ? '/admin/users' : '/org/users', body));
      setForm({ ...form, name: '', email: '' });
      users.reload();
    });
  };
  const doReset = () => run(async () => {
    const res = await api.post(`/users/${reset.user.id}/reset-credentials`, { resetMfa: reset.resetMfa });
    setCreated({ user: reset.user, initialPassword: res.initialPassword, reset: true, mfaReset: res.mfaReset });
    setReset(null); users.reload();
  });
  const toggle = (u) => run(async () => { await api.patch(`/users/${u.id}/status`, { status: u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' }); users.reload(); });
  const orgName = (id) => orgList.find((o) => o.id === id)?.name || '';

  return (
    <div className="stack">
      <h1>Nutzer</h1>
      {created && (
        <Alert kind="ok" onClose={() => setCreated(null)}>
          {created.reset ? `Zugang von ${created.user.email} zurückgesetzt${created.mfaReset ? ' (inkl. Zwei-Faktor-Authentifizierung)' : ''}.` : `Nutzer ${created.user.email} angelegt.`}
          {created.initialPassword && <> Initialpasswort (wird nur jetzt angezeigt): <strong className="mono" data-testid="initial-password">{created.initialPassword}</strong>. Bitte sicher übermitteln (nicht per E-Mail) – die Person muss es bei der nächsten Anmeldung ändern.</>}
        </Alert>
      )}
      <Alert>{error || users.error}</Alert>
      <form className="card" onSubmit={create}>
        <h2>Nutzer anlegen</h2>
        <div className="grid-2">
          {platform && (
            <Field label="Organisation" htmlFor="uorg">
              <select id="uorg" value={form.orgId} onChange={(e) => { const o = orgList.find((x) => x.id === e.target.value); setForm({ ...form, orgId: e.target.value, role: o ? (o.type === 'PRACTICE' ? 'PRACTICE_ADMIN' : 'PHARMACY_ADMIN') : form.role }); }}>
                <option value="">(keine – Plattformrolle)</option>
                {orgList.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Rolle" htmlFor="urole"><select id="urole" value={form.role} onChange={set('role')}>{roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></Field>
          <Field label="Name" htmlFor="uname"><input id="uname" required maxLength={120} value={form.name} onChange={set('name')} /></Field>
          <Field label="E-Mail" htmlFor="uemail"><input id="uemail" type="email" required value={form.email} onChange={set('email')} /></Field>
        </div>
        <button className="btn btn-primary" disabled={busy || (platform && !isPlatformRole && !form.orgId)}>Anlegen</button>
      </form>
      {users.loading ? <Spinner /> : users.data.length === 0 ? <Empty>Keine Nutzer.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>E-Mail</th><th>Rolle</th>{platform && <th>Organisation</th>}<th>2FA</th><th>Letzte Anmeldung</th><th>Status</th><th /></tr></thead>
            <tbody>
              {users.data.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td><td>{u.email}</td><td>{ROLE_LABELS[u.role]}</td>{platform && <td>{orgName(u.orgId) || '–'}</td>}
                  <td>{u.mfaEnabled ? 'aktiv' : 'nein'}</td><td>{fmtDateTime(u.lastLoginAt)}</td>
                  <td><span className={`badge ${u.status === 'ACTIVE' ? 'badge-issued' : 'badge-blocked'}`}>{u.status === 'ACTIVE' ? 'Aktiv' : 'Deaktiviert'}</span></td>
                  <td className="row">{u.id !== user.id && (<>
                    <button className="btn btn-small" onClick={() => toggle(u)} disabled={busy}>{u.status === 'ACTIVE' ? 'Deaktivieren' : 'Aktivieren'}</button>
                    {(platform ? u.orgId : true) && <button className="btn btn-small" onClick={() => { setError(''); setReset({ user: u, resetMfa: false }); }}>Zugang zurücksetzen …</button>}
                  </>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {reset && (
        <ConfirmDialog title="Zugang zurücksetzen?" confirmLabel="Zurücksetzen" danger busy={busy} onCancel={() => setReset(null)} onConfirm={doReset}>
          <p>Für <strong>{reset.user.name}</strong> ({reset.user.email}) wird ein neues Einmalpasswort erzeugt. Alle Sitzungen werden beendet; Kontosperren werden aufgehoben.</p>
          <label className="check"><input type="checkbox" checked={reset.resetMfa} onChange={(e) => setReset({ ...reset, resetMfa: e.target.checked })} /> Zwei-Faktor-Authentifizierung ebenfalls zurücksetzen (z. B. bei verlorenem Gerät)</label>
          <p className="muted small">Bitte vorher die Identität der Person zuverlässig prüfen (z. B. Rückruf unter bekannter Nummer). Der Vorgang wird protokolliert.</p>
          <Alert>{error}</Alert>
        </ConfirmDialog>
      )}
    </div>
  );
}
