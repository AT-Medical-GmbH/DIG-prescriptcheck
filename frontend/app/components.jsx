import { Component, useEffect, useRef, useState } from 'react';
import { STATE_LABELS } from './format.js';

export function Logo({ size = 28 }) {
  return (
    <span className="logo" aria-label="PrescriptCheck">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="#14532d" />
        <path d="M17 33l10 10 20-23" fill="none" stroke="#4ade80" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="logo-text">Prescript<strong>Check</strong></span>
    </span>
  );
}

export function Alert({ kind = 'error', children, onClose }) {
  if (!children) return null;
  return (
    <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onClose && <button type="button" className="link" onClick={onClose} aria-label="Schließen">×</button>}
    </div>
  );
}

export function StateBadge({ state }) {
  return <span className={`badge badge-${String(state).toLowerCase()}`}>{STATE_LABELS[state] || state}</span>;
}

export function Field({ label, hint, error, children, htmlFor }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <small className="hint">{hint}</small>}
      {error && <small className="field-error">{error}</small>}
    </div>
  );
}

/** Info-Symbol mit Erklärtext (Konzept 19.1). */
export function Info({ text }) {
  return <span className="info" tabIndex={0} role="img" aria-label={text} title={text}>i</span>;
}

export function Spinner({ label = 'Lädt …' }) {
  return <div className="spinner" role="status">{label}</div>;
}

export function Empty({ children }) {
  return <p className="empty">{children}</p>;
}

/** Bestätigungsdialog (kein window.confirm: barrierearm, testbar). */
export function ConfirmDialog({ title, children, confirmLabel = 'Bestätigen', danger, onConfirm, onCancel, busy }) {
  const dialogRef = useRef(null);
  const confirmRef = useRef(null);
  const cancelRef = useRef(null);
  useEffect(() => {
    const before = document.activeElement;
    // Fokus: zuerst auf das erste Eingabefeld, sonst bei riskanten Aktionen auf „Abbrechen“, sonst auf die Bestätigung
    const field = dialogRef.current?.querySelector('input:not([type=hidden]), select, textarea');
    (field || (danger ? cancelRef.current : confirmRef.current))?.focus();
    return () => { if (before && typeof before.focus === 'function') before.focus(); };
  }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  // Als Formular: Pflichtfelder (required) werden geprüft, Enter bestätigt.
  const submit = (e) => { e.preventDefault(); if (!busy) onConfirm(); };
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <form ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-label={title} onSubmit={submit}>
        <h3>{title}</h3>
        <div className="modal-body">{children}</div>
        <div className="row end">
          <button type="button" ref={cancelRef} className="btn" onClick={onCancel} disabled={busy}>Abbrechen</button>
          <button type="submit" ref={confirmRef} className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} disabled={busy}>{busy ? 'Bitte warten …' : confirmLabel}</button>
        </div>
      </form>
    </div>
  );
}

/** Fängt Darstellungsfehler ab, damit nie ein leerer Bildschirm bleibt. */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="card login" role="alert">
        <h1>Etwas ist schiefgelaufen</h1>
        <p>Die Anzeige konnte nicht aufgebaut werden. Ihre Daten sind nicht verloren gegangen.</p>
        <p><button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Seite neu laden</button></p>
      </main>
    );
  }
}

/** Kleiner Hook für asynchrone Aktionen mit Lade-/Fehlerzustand. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      return await fn();
    } catch (e) {
      setError(e.message || 'Unerwarteter Fehler.');
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

export function useLoad(fn, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    fn().then((data) => alive && setState({ loading: false, data, error: '' })).catch((e) => alive && setState({ loading: false, data: null, error: e.message }));
    return () => { alive = false; };
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}
