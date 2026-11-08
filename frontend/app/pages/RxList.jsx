import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Alert, ConfirmDialog, Empty, Field, Info, Spinner, StateBadge, useAction, useLoad } from '../components.jsx';
import { BLOCK_REASON_LABELS, fmtDate } from '../format.js';

const FILTERS = [['', 'Alle'], ['DRAFT', 'Entwürfe'], ['ISSUED', 'Gültig'], ['REDEEMED', 'Eingelöst'], ['BLOCKED', 'Gesperrt'], ['EXPIRED', 'Abgelaufen']];

function ReasonSelect({ value, onChange, id = 'reason' }) {
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {Object.entries(BLOCK_REASON_LABELS).filter(([k]) => k !== 'SUSPICION').map(([k, label]) => <option key={k} value={k}>{label}</option>)}
      <option value="SUSPICION">Verdacht</option>
    </select>
  );
}

export default function RxList() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [state, setState] = useState('');
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [query, setQuery] = useState(params.get('q') || '');
  const [selected, setSelected] = useState(new Set());
  const [dialog, setDialog] = useState(null); // 'bulk' | 'all'
  const [reason, setReason] = useState('LOSS');
  const [msg, setMsg] = useState('');
  const { busy, error, run } = useAction();
  const list = useLoad(() => api.get(`/prescriptions?${new URLSearchParams({ ...(state ? { state } : {}), ...(query ? { q: query } : {}) })}`), [state, query]);
  const canBlock = user.role === 'PRESCRIBER';
  const rows = list.data || [];
  const blockable = rows.filter((r) => r.state === 'ISSUED');

  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = (checked) => setSelected(checked ? new Set(blockable.map((r) => r.id)) : new Set());

  const doBulk = () => run(async () => {
    const res = await api.post('/prescriptions/block-bulk', { ids: [...selected], reason });
    setMsg(`${res.blocked} von ${selected.size} Rezepten gesperrt.`);
    setSelected(new Set()); setDialog(null); list.reload();
  });
  const doAll = () => run(async () => {
    const res = await api.post('/prescriptions/block-all-open', { reason });
    setMsg(`Notfallsperre: ${res.blocked} offene Rezepte gesperrt.`);
    setDialog(null); list.reload();
  });

  return (
    <div className="stack">
      <div className="row between wrap">
        <h1>Rezepte</h1>
        <div className="row">
          {canBlock && <button className="btn btn-danger-outline" onClick={() => setDialog('all')}>Notfallsperre <Info text="Sperrt alle noch offenen Rezepte, die Sie ausgestellt haben – z. B. bei Verlust des Rezeptblocks." /></button>}
          <Link className="btn btn-primary" to="/rezepte/neu">Neues Rezept</Link>
        </div>
      </div>
      <Alert kind="ok" onClose={() => setMsg('')}>{msg}</Alert>
      <Alert>{list.error}</Alert>
      <form className="toolbar" onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); }} role="search">
        <div className="chips" role="group" aria-label="Statusfilter">
          {FILTERS.map(([v, label]) => <button type="button" key={v} className={`chip ${state === v ? 'on' : ''}`} aria-pressed={state === v} onClick={() => { setState(v); setSelected(new Set()); }}>{label}</button>)}
        </div>
        <input type="search" placeholder="Name oder Rezept-ID suchen" aria-label="Suche" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn">Suchen</button>
      </form>
      {canBlock && selected.size > 0 && (
        <div className="bulkbar" role="status">
          <span>{selected.size} ausgewählt</span>
          <button className="btn btn-danger-outline" onClick={() => setDialog('bulk')}>Ausgewählte sperren</button>
          <button className="link" onClick={() => setSelected(new Set())}>Auswahl aufheben</button>
        </div>
      )}
      {list.loading ? <Spinner /> : rows.length === 0 ? <Empty>Keine Rezepte gefunden.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr>
              {canBlock && <th className="narrow"><input type="checkbox" aria-label="Alle gültigen auswählen" checked={blockable.length > 0 && selected.size === blockable.length} onChange={(e) => toggleAll(e.target.checked)} /></th>}
              <th>Rezept-ID</th><th>Patient/in</th><th>Verordnung</th><th>Status</th><th>Ausgestellt</th><th>Gültig bis</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => nav(`/rezepte/${r.id}`)}>
                  {canBlock && <td className="narrow" onClick={(e) => e.stopPropagation()}>{r.state === 'ISSUED' && <input type="checkbox" aria-label={`Rezept ${r.serial} auswählen`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} />}</td>}
                  <td className="mono"><Link to={`/rezepte/${r.id}`} onClick={(e) => e.stopPropagation()}>{r.serial || '(Entwurf)'}</Link></td>
                  <td>{r.patientName}</td>
                  <td>{r.firstItem}{r.itemCount > 1 ? ` + ${r.itemCount - 1}` : ''}</td>
                  <td><StateBadge state={r.state} />{r.qsFlags.length > 0 && <span className="flag" title="QS-Hinweis"> ⚑</span>}</td>
                  <td>{fmtDate(r.issuedAt || r.createdAt)}</td>
                  <td>{fmtDate(r.expiresAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {dialog && (
        <ConfirmDialog
          title={dialog === 'bulk' ? `${selected.size} Rezepte sperren` : 'Notfallsperre: alle offenen Rezepte sperren'}
          confirmLabel={dialog === 'bulk' ? 'Jetzt sperren' : 'Alle sperren'} danger busy={busy}
          onConfirm={dialog === 'bulk' ? doBulk : doAll} onCancel={() => setDialog(null)}
        >
          <p>{dialog === 'bulk' ? 'Gesperrte Rezepte können von Apotheken nicht eingelöst werden.' : 'Es werden alle noch offenen Rezepte gesperrt, die Sie ausgestellt haben. Eingelöste Rezepte bleiben unverändert.'}</p>
          <Field label="Grund" htmlFor="reason"><ReasonSelect value={reason} onChange={setReason} /></Field>
          <Alert>{error}</Alert>
        </ConfirmDialog>
      )}
    </div>
  );
}

export { ReasonSelect };
