import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { Alert, ConfirmDialog, Field, Info, useAction } from '../components.jsx';
import { BLOCK_REASON_LABELS, fmtDate, fmtDateTime, parseDob } from '../format.js';

const REASONS = {
  SIGNATURE_INVALID: 'Die digitale Signatur ist ungültig – das Rezept ist vermutlich gefälscht oder verändert.',
  CODE_UNREADABLE: 'Der Code ist nicht lesbar oder kein PrescriptCheck-Code. Bitte erneut scannen oder die Rezept-ID eingeben.',
  SERIAL_INVALID: 'Die Rezept-ID ist ungültig (Tippfehler?). Bitte Eingabe prüfen.',
  UNKNOWN: 'Dieses Rezept ist in PrescriptCheck nicht bekannt.',
  CODE_MISMATCH: 'Der Code passt nicht zum gespeicherten Rezept – mögliche Fälschung.',
  INTEGRITY_FAILED: 'Die Integritätsprüfung ist fehlgeschlagen. Bitte das Rezept nicht beliefern und die Praxis kontaktieren.',
  BLOCKED: 'Das Rezept wurde gesperrt und darf nicht beliefert werden.',
  ALREADY_REDEEMED: 'Das Rezept wurde bereits eingelöst.',
  EXPIRED: 'Das Rezept ist abgelaufen.',
  TEMP_LOCKED: 'Nach mehreren Fehlversuchen beim Identitätsabgleich ist das Rezept vorübergehend gesperrt.',
  QS_FLAGGED: 'Es liegen QS-Hinweise zu diesem Rezept vor. Bitte besonders sorgfältig prüfen.',
  DUPLICATE_PRINT: 'Dieses Rezept wurde mehrfach ausgedruckt (Duplikat). Bitte Vorlage sorgfältig prüfen.',
  EXPIRES_SOON: 'Das Rezept läuft in Kürze ab.',
};
const LIGHT = { GREEN: ['✔', 'Echt und einlösbar'], YELLOW: ['!', 'Einlösbar – bitte beachten'], RED: ['✖', 'Nicht einlösbar'] };
const REPORT = { FORGERY_SUSPECTED: 'Verdacht auf Fälschung', IDENTITY_MISMATCH: 'Person passt nicht zum Rezept', ALTERED: 'Rezept wirkt verändert', OTHER: 'Sonstiges' };
const PICKUP = { PATIENT: 'Patient/in selbst', TRUSTEE: 'Vertrauensperson', THIRD: 'Andere Person' };

export default function Verify() {
  const [step, setStep] = useState('scan'); // scan | result | identity | content | done
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [dob, setDob] = useState('');
  const [ident, setIdent] = useState(null);
  const [matches, setMatches] = useState(false);
  const [pickedUpBy, setPickedUpBy] = useState('PATIENT');
  const [done, setDone] = useState(null);
  const [report, setReport] = useState(null);
  const [cancel, setCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [info, setInfo] = useState('');
  const { busy, error, setError, run } = useAction();
  const inputRef = useRef(null);

  useEffect(() => { if (step === 'scan') inputRef.current?.focus(); }, [step]);

  const reset = () => { setStep('scan'); setInput(''); setResult(null); setDob(''); setIdent(null); setMatches(false); setPickedUpBy('PATIENT'); setDone(null); setError(''); setReport(null); };

  const check = (e) => {
    e.preventDefault();
    const v = input.trim();
    if (!v) return;
    run(async () => {
      const body = v.startsWith('PC1:') ? { code: v } : { serial: v };
      setResult(await api.post('/verifications', body));
      setStep('result');
    });
  };

  const identify = (e) => {
    e.preventDefault();
    const iso = parseDob(dob);
    if (!iso) return setError('Bitte das Geburtsdatum als TT.MM.JJJJ eingeben.');
    run(async () => {
      try {
        setIdent(await api.post(`/verifications/${result.verificationId}/identity-check`, { dob: iso }));
        setDob('');
        setStep('content');
      } catch (err) {
        if (err.code === 'TEMP_LOCKED') { setResult({ ...result, result: 'RED', reasons: ['TEMP_LOCKED'], verificationId: undefined }); setDob(''); setError(''); return; }
        throw err;
      }
    });
  };

  const redeem = () => run(async () => {
    setDone(await api.post('/redemptions', { token: ident.redemptionToken, pickedUpBy }));
    setIdent(null);
    setStep('done');
  });

  const sendReport = (e) => {
    e.preventDefault();
    run(async () => {
      await api.post('/qs/reports', { verificationId: result.verificationId, category: report.category, note: report.note || undefined });
      setReport(null);
      setInfo('Meldung gesendet. Das Rezept wurde gesperrt. Bitte nicht beliefern.');
      reset();
    });
  };

  const doCancel = () => run(async () => {
    await api.post(`/redemptions/${done.serial}/cancel`, { reason: cancelReason });
    setCancel(false);
    setInfo(`Die Einlösung von ${done.serial} wurde storniert.`);
    reset();
  });

  const light = result && LIGHT[result.result];
  const red = result?.result === 'RED';

  return (
    <div className="stack narrow-page">
      <h1>Rezept prüfen und einlösen</h1>
      <Alert kind="ok" onClose={() => setInfo('')}>{info}</Alert>
      <Alert>{error}</Alert>

      {step === 'scan' && (
        <form className="card" onSubmit={check}>
          <Field label={<>Rezeptcode scannen oder Rezept-ID eingeben <Info text="Ein Barcode-Scanner trägt den Code direkt in dieses Feld ein. Alternativ die Rezept-ID (z. B. PC-26-XXXX-XXXX-X) von Hand eingeben." /></>} htmlFor="scan">
            <input id="scan" ref={inputRef} className="big mono" value={input} onChange={(e) => setInput(e.target.value)} autoComplete="off" spellCheck={false} placeholder="PC-26-XXXX-XXXX-X" />
          </Field>
          <button className="btn btn-primary btn-big" disabled={busy || !input.trim()}>{busy ? 'Prüfe …' : 'Prüfen'}</button>
          <p className="muted small">PrescriptCheck bestätigt Echtheit und Status des Rezepts. Die pharmazeutische Prüfung durch die Apotheke bleibt unberührt.</p>
        </form>
      )}

      {result && step !== 'scan' && step !== 'done' && (
        <section className={`light light-${result.result.toLowerCase()}`} aria-live="polite" data-testid="traffic-light">
          <div className="light-icon" aria-hidden="true">{light[0]}</div>
          <div>
            <h2>{light[1]}</h2>
            <ul>
              {result.reasons.map((r) => <li key={r}>{REASONS[r] || r}{r === 'BLOCKED' && result.blockReason ? ` (${BLOCK_REASON_LABELS[result.blockReason] || result.blockReason})` : ''}{r === 'ALREADY_REDEEMED' && result.redeemedAt ? ` Eingelöst am ${fmtDateTime(result.redeemedAt)}.` : ''}</li>)}
              {!red && result.reasons.length === 0 && <li>Signatur gültig, Rezept ausgestellt und nicht gesperrt.</li>}
            </ul>
            {!red && (
              <p className="muted">Rezept {result.serial} · {result.practiceName}{result.prescriberName ? ` · ${result.prescriberName}` : ''} · gültig bis {fmtDate(result.expiresAt)}</p>
            )}
          </div>
        </section>
      )}

      {step === 'result' && red && <div className="row"><button className="btn btn-primary" onClick={reset}>Nächstes Rezept</button></div>}

      {step === 'result' && !red && (
        <>
          <form className="card" onSubmit={identify}>
            <h2>Identität abgleichen</h2>
            <p className="muted">Bitten Sie die Person um das Geburtsdatum der Patientin/des Patienten. Rezeptinhalte werden erst nach erfolgreichem Abgleich angezeigt.</p>
            <Field label="Geburtsdatum" htmlFor="dob" hint="TT.MM.JJJJ"><input id="dob" className="big" inputMode="numeric" autoComplete="off" placeholder="TT.MM.JJJJ" value={dob} onChange={(e) => setDob(e.target.value)} autoFocus /></Field>
            <div className="row">
              <button className="btn btn-primary btn-big" disabled={busy || !dob.trim()}>Abgleichen</button>
              <button type="button" className="btn" onClick={reset}>Abbrechen</button>
              <button type="button" className="link danger-text" onClick={() => setReport({ category: 'FORGERY_SUSPECTED', note: '' })}>Verdacht melden …</button>
            </div>
          </form>
        </>
      )}

      {step === 'content' && ident && (
        <section className="card" data-testid="content">
          <h2>Rezeptinhalt</h2>
          <dl className="kv">
            <dt>Patient/in</dt><dd><strong>{ident.content.patientName}</strong></dd>
            <dt>Praxis</dt><dd>{ident.content.practiceName}{ident.content.prescriberName ? `, ${ident.content.prescriberName}` : ''}</dd>
            <dt>Ausgestellt / gültig bis</dt><dd>{fmtDate(ident.content.issuedAt)} / {fmtDate(ident.content.expiresAt)}</dd>
          </dl>
          <ol className="items">
            {ident.content.items.map((it, i) => (
              <li key={i}><strong>{it.medication}</strong><div className="muted">{[it.form, it.strength, `Menge: ${it.quantity}`].filter(Boolean).join(' · ')}</div>{it.dosage && <div className="muted">Dosierung: {it.dosage}</div>}</li>
            ))}
          </ol>
          {ident.content.note && <p><span className="muted">Hinweis: </span>{ident.content.note}</p>}
          <hr />
          <label className="check"><input type="checkbox" checked={matches} onChange={(e) => setMatches(e.target.checked)} /> Der Inhalt stimmt mit der vorgelegten Verordnung überein.</label>
          <Field label="Abholung durch" htmlFor="pickup"><select id="pickup" value={pickedUpBy} onChange={(e) => setPickedUpBy(e.target.value)}>{Object.entries(PICKUP).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <div className="row">
            <button className="btn btn-primary btn-big" onClick={redeem} disabled={busy || !matches}>{busy ? 'Löse ein …' : 'Rezept einlösen'}</button>
            <button className="btn" onClick={reset} disabled={busy}>Abbrechen</button>
            <button type="button" className="link danger-text" onClick={() => setReport({ category: 'ALTERED', note: '' })}>Verdacht melden …</button>
          </div>
          <p className="muted small">Der Einlösevorgang ist bis {fmtDateTime(ident.tokenExpiresAt)} freigegeben.</p>
        </section>
      )}

      {step === 'done' && done && (
        <section className="light light-green" data-testid="done">
          <div className="light-icon" aria-hidden="true">✔</div>
          <div>
            <h2>Eingelöst</h2>
            <p>Rezept <span className="mono">{done.serial}</span> wurde am {fmtDateTime(done.redeemedAt)} eingelöst. Die Praxis wird informiert.</p>
            <div className="row">
              <button className="btn btn-primary btn-big" onClick={reset}>Nächstes Rezept</button>
              <button className="link" onClick={() => setCancel(true)}>Einlösung stornieren (bis {fmtDateTime(done.cancelUntil)}) …</button>
            </div>
          </div>
        </section>
      )}

      {report && (
        <ConfirmDialog title="Verdacht melden" confirmLabel="Melden und Rezept sperren" danger busy={busy} onCancel={() => setReport(null)} onConfirm={sendReport}>
          <p>Das Rezept wird sofort gesperrt. Die Praxis und die Qualitätssicherung werden informiert. Die vorlegende Person erfährt davon nichts.</p>
          <Field label="Grund" htmlFor="rcat"><select id="rcat" value={report.category} onChange={(e) => setReport({ ...report, category: e.target.value })}>{Object.entries(REPORT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Anmerkung (optional)" htmlFor="rnote"><input id="rnote" maxLength={500} value={report.note} onChange={(e) => setReport({ ...report, note: e.target.value })} /></Field>
          <p className="muted small">Bei akuter Gefahr rufen Sie bitte den Notruf 110.</p>
        </ConfirmDialog>
      )}
      {cancel && (
        <ConfirmDialog title="Einlösung stornieren?" confirmLabel="Stornieren" danger busy={busy} onCancel={() => setCancel(false)} onConfirm={doCancel}>
          <p>Das Rezept wird wieder einlösbar. Die Praxis wird informiert.</p>
          <Field label="Begründung (Pflicht)" htmlFor="cr"><input id="cr" required maxLength={300} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} autoFocus /></Field>
        </ConfirmDialog>
      )}
    </div>
  );
}
