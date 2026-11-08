import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { Alert, Field, Logo, useAction } from '../components.jsx';

export default function Login() {
  const auth = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needTotp, setNeedTotp] = useState(false);
  const { busy, error, setError, run } = useAction();

  if (!auth.loading && auth.user) {
    // Zur zuletzt geöffneten Seite nur zurückkehren, wenn dieselbe Person nach Sitzungsablauf wieder anmeldet
    const resume = auth.expiredUserId === auth.user.id ? location.state?.from : null;
    return <Navigate to={resume || '/'} replace />;
  }

  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      try {
        await auth.login(email.trim(), password, needTotp ? totp.trim() : undefined);
      } catch (err) {
        if (err.code === 'MFA_REQUIRED') { setNeedTotp(true); setError(''); return; }
        throw err;
      }
    });
  };

  return (
    <div className="center">
      <form className="card login" onSubmit={submit} aria-label="Anmeldung">
        <div className="login-logo"><Logo size={40} /></div>
        <h1>Anmelden</h1>
        <Alert>{error}</Alert>
        <Field label="E-Mail" htmlFor="email">
          <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </Field>
        <Field label="Passwort" htmlFor="password">
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {needTotp && (
          <Field label="Code aus der Authenticator-App" htmlFor="totp" hint="6-stelliger Code">
            <input id="totp" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required value={totp} onChange={(e) => setTotp(e.target.value)} autoFocus />
          </Field>
        )}
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Bitte warten …' : 'Anmelden'}</button>
        <p className="muted small">Der Zugang ist ausschließlich für verifizierte Praxen und Apotheken bestimmt.</p>
      </form>
    </div>
  );
}
