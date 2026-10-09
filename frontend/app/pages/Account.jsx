import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, Field, useAction } from '../components.jsx';
import { ROLE_LABELS } from '../format.js';

function ChangePassword({ forced, onDone }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', repeat: '' });
  const [ok, setOk] = useState(false);
  const { busy, error, setError, run } = useAction();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    setOk(false);
    if (form.newPassword !== form.repeat) return setError('Die neuen Passwörter stimmen nicht überein.');
    run(async () => {
      await api.post('/auth/change-password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      setForm({ currentPassword: '', newPassword: '', repeat: '' });
      setOk(true);
      await onDone();
    });
  };
  return (
    <form className="card" onSubmit={submit}>
      <h2>Passwort ändern</h2>
      {forced && <Alert kind="warn">Bitte vergeben Sie zuerst ein eigenes Passwort.</Alert>}
      <Alert>{error}</Alert>
      {ok && <Alert kind="ok">Passwort geändert.</Alert>}
      <Field label="Aktuelles Passwort" htmlFor="cp"><input id="cp" type="password" autoComplete="current-password" required value={form.currentPassword} onChange={set('currentPassword')} /></Field>
      <Field label="Neues Passwort" htmlFor="np" hint="Mindestens 12 Zeichen, Groß- und Kleinbuchstaben sowie eine Ziffer."><input id="np" type="password" autoComplete="new-password" required minLength={12} value={form.newPassword} onChange={set('newPassword')} /></Field>
      <Field label="Neues Passwort wiederholen" htmlFor="rp"><input id="rp" type="password" autoComplete="new-password" required value={form.repeat} onChange={set('repeat')} /></Field>
      <button className="btn btn-primary" disabled={busy}>Passwort ändern</button>
    </form>
  );
}

function Mfa({ enabled, required, onDone }) {
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const { busy, error, run } = useAction();
  const start = () => run(async () => setSetup(await api.post('/auth/mfa/enroll')));
  const confirm = (e) => {
    e.preventDefault();
    run(async () => {
      await api.post('/auth/mfa/confirm', { code: code.trim() });
      setSetup(null);
      setCode('');
      await onDone();
    });
  };
  return (
    <section className="card">
      <h2>Zwei-Faktor-Authentifizierung</h2>
      {enabled && <Alert kind="ok">Aktiv. Beim Anmelden wird ein Code aus Ihrer Authenticator-App verlangt.</Alert>}
      {!enabled && required && <Alert kind="warn">Für Ihr Konto ist die Zwei-Faktor-Authentifizierung verpflichtend. Bitte jetzt einrichten.</Alert>}
      <Alert>{error}</Alert>
      {!enabled && !setup && <button className="btn btn-primary" onClick={start} disabled={busy}>Einrichtung starten</button>}
      {setup && (
        <form onSubmit={confirm}>
          <ol className="steps">
            <li>Öffnen Sie eine Authenticator-App (z. B. Microsoft Authenticator, Google Authenticator, Aegis, 2FAS).</li>
            <li>Fügen Sie ein neues Konto hinzu und geben Sie diesen Schlüssel ein (Zeitbasiert, 6 Stellen):
              <div className="secret" data-testid="mfa-secret">{setup.secret}</div>
              <small className="muted">Oder öffnen Sie auf diesem Gerät: <a href={setup.otpauthUrl}>Link zur App</a></small>
            </li>
            <li>Geben Sie zur Bestätigung den angezeigten Code ein.</li>
          </ol>
          <Field label="Bestätigungscode" htmlFor="mfa-code"><input id="mfa-code" inputMode="numeric" pattern="\d{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value)} autoFocus /></Field>
          <button className="btn btn-primary" disabled={busy}>Bestätigen</button>
        </form>
      )}
    </section>
  );
}

export default function Account() {
  const { user, mfaRequired, reload } = useAuth();
  return (
    <div className="stack">
      <h1>Mein Konto</h1>
      <section className="card">
        <dl className="kv">
          <dt>Name</dt><dd>{user.name}</dd>
          <dt>E-Mail</dt><dd>{user.email}</dd>
          <dt>Rolle</dt><dd>{ROLE_LABELS[user.role]}</dd>
          {user.orgName && (<><dt>Organisation</dt><dd>{user.orgName}</dd></>)}
        </dl>
      </section>
      <div className="grid-2">
        <ChangePassword forced={user.mustChangePassword} onDone={reload} />
        <Mfa enabled={user.mfaEnabled} required={mfaRequired} onDone={reload} />
      </div>
    </div>
  );
}
