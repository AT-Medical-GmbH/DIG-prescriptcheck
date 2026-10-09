import { useState } from 'react';
import { api } from '../api.js';
import { Alert, Empty, Field, Spinner, useAction, useLoad } from '../components.jsx';
import { fmtDate } from '../format.js';

export default function Organizations() {
  const list = useLoad(() => api.get('/admin/organizations'));
  const [form, setForm] = useState({ type: 'PRACTICE', name: '', street: '', zip: '', city: '', phone: '' });
  const [msg, setMsg] = useState('');
  const { busy, error, run } = useAction();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const create = (e) => {
    e.preventDefault();
    run(async () => {
      const address = Object.fromEntries(['street', 'zip', 'city', 'phone'].map((k) => [k, form[k].trim()]).filter(([, v]) => v));
      const org = await api.post('/admin/organizations', { type: form.type, name: form.name.trim(), address });
      setMsg(`Organisation „${org.name}“ angelegt. Als Nächstes unter „Nutzer“ die Administration der Organisation anlegen.`);
      setForm({ ...form, name: '', street: '', zip: '', city: '', phone: '' });
      list.reload();
    });
  };
  const toggle = (o) => run(async () => { await api.patch(`/admin/organizations/${o.id}`, { status: o.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }); list.reload(); });

  return (
    <div className="stack">
      <h1>Organisationen</h1>
      <Alert kind="ok" onClose={() => setMsg('')}>{msg}</Alert>
      <Alert>{error || list.error}</Alert>
      <form className="card" onSubmit={create}>
        <h2>Organisation anlegen</h2>
        <p className="muted small">Nur nach erfolgreicher Prüfung der Berechtigung (Approbation bzw. Betriebserlaubnis) anlegen.</p>
        <div className="grid-2">
          <Field label="Typ" htmlFor="otype"><select id="otype" value={form.type} onChange={set('type')}><option value="PRACTICE">Praxis</option><option value="PHARMACY">Apotheke</option></select></Field>
          <Field label="Name" htmlFor="oname"><input id="oname" required maxLength={160} value={form.name} onChange={set('name')} /></Field>
          <Field label="Straße" htmlFor="ost"><input id="ost" maxLength={120} value={form.street} onChange={set('street')} /></Field>
          <Field label="PLZ" htmlFor="ozip"><input id="ozip" maxLength={10} value={form.zip} onChange={set('zip')} /></Field>
          <Field label="Ort" htmlFor="ocity"><input id="ocity" maxLength={80} value={form.city} onChange={set('city')} /></Field>
          <Field label="Telefon" htmlFor="ophone"><input id="ophone" maxLength={40} value={form.phone} onChange={set('phone')} /></Field>
        </div>
        <button className="btn btn-primary" disabled={busy}>Anlegen</button>
      </form>
      {list.loading ? <Spinner /> : list.data.length === 0 ? <Empty>Noch keine Organisationen.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Typ</th><th>Ort</th><th>Status</th><th>Angelegt</th><th /></tr></thead>
            <tbody>
              {list.data.map((o) => (
                <tr key={o.id}>
                  <td>{o.name}</td><td>{o.type === 'PRACTICE' ? 'Praxis' : 'Apotheke'}</td><td>{o.address.city || '–'}</td>
                  <td><span className={`badge ${o.status === 'ACTIVE' ? 'badge-issued' : 'badge-blocked'}`}>{o.status === 'ACTIVE' ? 'Aktiv' : 'Gesperrt'}</span></td>
                  <td>{fmtDate(o.createdAt)}</td>
                  <td><button className="btn btn-small" onClick={() => toggle(o)} disabled={busy}>{o.status === 'ACTIVE' ? 'Sperren' : 'Aktivieren'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
