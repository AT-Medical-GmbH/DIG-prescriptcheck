import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Alert, Empty, Spinner, useAction, useLoad } from '../components.jsx';
import { fmtDateTime } from '../format.js';

export default function Notifications() {
  const list = useLoad(() => api.get('/notifications'));
  const { run, error } = useAction();
  const unread = (list.data || []).filter((n) => !n.read).length;
  return (
    <div className="stack">
      <div className="row between wrap">
        <h1>Mitteilungen</h1>
        {unread > 0 && <button className="btn" onClick={() => run(async () => { await api.post('/notifications/read-all'); list.reload(); })}>Alle als gelesen markieren</button>}
      </div>
      <Alert>{error || list.error}</Alert>
      {list.loading ? <Spinner /> : list.data.length === 0 ? <Empty>Keine Mitteilungen.</Empty> : (
        <ul className="notes">
          {list.data.map((n) => (
            <li key={n.id} className={n.read ? '' : 'unread'}>
              <time>{fmtDateTime(n.createdAt)}</time>
              <span>{n.message}</span>
              {n.serial && <Link to={`/rezepte?${new URLSearchParams({ q: n.serial })}`} className="mono small">{n.serial}</Link>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
