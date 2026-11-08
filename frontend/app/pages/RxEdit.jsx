import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, ConfirmDialog, Field, Info, Spinner, useAction } from '../components.jsx';
import { fmtDate, parseDob } from '../format.js';

const emptyItem = () => ({ medication: '', form: '', strength: '', quantity: '', dosage: '' });
const isoToDe = (iso) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : '');

export default function RxEdit() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(!!id);
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [items, setItems] = useState([emptyItem()]);
  const [note, setNote] = useState('');
  const [validityDays, setValidityDays] = useState('');
  const [confirm, setConfirm] = useState(false);
  const { busy, error, setError, run } = useAction();
  const canIssue = user.role === 'PRESCRIBER';

  useEffect(() => {
    if (!id) return;
    api.get(`/prescriptions/${id}`).then((rx) => {
      if (rx.state !== 'DRAFT') return nav(`/rezepte/${id}`, { replace: true });
      setName(rx.patient.name); setDob(isoToDe(rx.patient.dob));
      setItems(rx.items.map((i) => ({ ...emptyItem(), ...i }))); setNote(rx.note || ''); setValidityDays(rx.validityDays || '');
      setLoading(false);
    }).catch((e) => { setError(e.message); setLoading(false); });
  }, [id, nav, setError]);

  const setItem = (i, k, v) => setItems(items.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => String(v).trim() !== ''));

  const build = () => {
    const iso = parseDob(dob);
    if (!iso) throw new Error('Geburtsdatum bitte als TT.MM.JJJJ eingeben.');
    return { patient: { name: name.trim(), dob: iso }, items: items.map(clean), note: note.trim() || undefined, validityDays: validityDays ? Number(validityDays) : undefined };
  };
  const save = async () => {
    const body = build();
    return id ? api.put(`/prescriptions/${id}`, body) : api.post('/prescriptions', body);
  };

  const onSave = (e) => { e.preventDefault(); run(async () => { const rx = await save(); nav(`/rezepte/${rx.id}`); }); };
  const onIssue = () => run(async () => {
    const rx = await save();
    const issued = await api.post(`/prescriptions/${rx.id}/issue`);
    nav(`/rezepte/${issued.id}`, { state: { justIssued: true } });
  });
  const askIssue = () => { setError(''); try { build(); setConfirm(true); } catch (e) { setError(e.message); } };

  if (loading) return <Spinner />;
  return (
    <form className="stack" onSubmit={onSave}>
      <h1>{id ? 'Entwurf bearbeiten' : 'Neues Rezept'}</h1>
      <Alert>{error}</Alert>
      <section className="card">
        <h2>Patient/in</h2>
        <div className="grid-2">
          <Field label="Name" htmlFor="pname"><input id="pname" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} autoFocus autoComplete="off" /></Field>
          <Field label="Geburtsdatum" htmlFor="pdob" hint="TT.MM.JJJJ – wird in der Apotheke zum Abgleich abgefragt."><input id="pdob" required placeholder="TT.MM.JJJJ" inputMode="numeric" value={dob} onChange={(e) => setDob(e.target.value)} autoComplete="off" /></Field>
        </div>
      </section>
      <section className="card">
        <h2>Verordnung</h2>
        {items.map((it, i) => (
          <fieldset key={i} className="item">
            <legend>Position {i + 1}</legend>
            <div className="grid-2">
              <Field label="Arzneimittel" htmlFor={`m${i}`}><input id={`m${i}`} required maxLength={200} value={it.medication} onChange={(e) => setItem(i, 'medication', e.target.value)} /></Field>
              <Field label="Menge / Packungsgröße" htmlFor={`q${i}`}><input id={`q${i}`} required maxLength={60} value={it.quantity} onChange={(e) => setItem(i, 'quantity', e.target.value)} /></Field>
              <Field label="Darreichungsform" htmlFor={`f${i}`}><input id={`f${i}`} maxLength={80} value={it.form} onChange={(e) => setItem(i, 'form', e.target.value)} /></Field>
              <Field label="Stärke" htmlFor={`s${i}`}><input id={`s${i}`} maxLength={80} value={it.strength} onChange={(e) => setItem(i, 'strength', e.target.value)} /></Field>
            </div>
            <Field label="Dosierung / Gebrauchsanweisung" htmlFor={`d${i}`}><input id={`d${i}`} maxLength={300} value={it.dosage} onChange={(e) => setItem(i, 'dosage', e.target.value)} /></Field>
            {items.length > 1 && <button type="button" className="link" onClick={() => setItems(items.filter((_, idx) => idx !== i))}>Position entfernen</button>}
          </fieldset>
        ))}
        {items.length < 10 && <button type="button" className="btn" onClick={() => setItems([...items, emptyItem()])}>+ Position hinzufügen</button>}
      </section>
      <section className="card">
        <h2>Weitere Angaben</h2>
        <Field label="Hinweis (optional)" htmlFor="note"><textarea id="note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <Field label={<>Gültigkeit in Tagen (optional) <Info text="Ohne Angabe gilt die Standard-Gültigkeit der Plattform." /></>} htmlFor="vd">
          <input id="vd" type="number" min={1} max={90} value={validityDays} onChange={(e) => setValidityDays(e.target.value)} />
        </Field>
      </section>
      <div className="row">
        <button className="btn" disabled={busy}>Als Entwurf speichern</button>
        {canIssue && <button type="button" className="btn btn-primary" onClick={askIssue} disabled={busy}>Speichern und ausstellen …</button>}
        <button type="button" className="link" onClick={() => nav(-1)}>Abbrechen</button>
      </div>
      {confirm && (
        <ConfirmDialog title="Rezept jetzt ausstellen?" confirmLabel="Verbindlich ausstellen" busy={busy} onConfirm={onIssue} onCancel={() => setConfirm(false)}>
          <p>Nach dem Ausstellen ist das Rezept <strong>unveränderlich</strong> und erhält eine Rezept-ID mit digitaler Signatur. Korrekturen sind nur durch Sperren und Neuausstellen möglich.</p>
          <dl className="kv">
            <dt>Patient/in</dt><dd>{name}</dd>
            <dt>Geburtsdatum</dt><dd>{dob}</dd>
            <dt>Positionen</dt><dd>{items.map((i) => i.medication).join(', ')}</dd>
            <dt>Gültig bis</dt><dd>{fmtDate(Date.now() + (Number(validityDays) || 28) * 86400000)}{validityDays ? '' : ' (Standard, ca.)'}</dd>
          </dl>
          <Alert>{error}</Alert>
        </ConfirmDialog>
      )}
    </form>
  );
}
