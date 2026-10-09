import { useEffect, useRef, useState } from 'react';
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
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <h3>{title}</h3>
        <div className="modal-body">{children}</div>
        <div className="row end">
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>Abbrechen</button>
          <button type="button" ref={ref} className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={busy}>{busy ? 'Bitte warten …' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
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
