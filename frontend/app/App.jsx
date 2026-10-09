import { Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth, needsSetup } from './auth.jsx';
import { Logo, Spinner } from './components.jsx';
import { ROLE_LABELS } from './format.js';
import Login from './pages/Login.jsx';
import Account from './pages/Account.jsx';
import RxList from './pages/RxList.jsx';
import RxEdit from './pages/RxEdit.jsx';
import RxDetail from './pages/RxDetail.jsx';
import Notifications from './pages/Notifications.jsx';
import Verify from './pages/Verify.jsx';
import Redemptions from './pages/Redemptions.jsx';
import Organizations from './pages/Organizations.jsx';
import Users from './pages/Users.jsx';
import Audit from './pages/Audit.jsx';
import QsCases from './pages/QsCases.jsx';

const PRACTICE_CLINICAL = ['PRESCRIBER', 'PRACTICE_STAFF'];
const PHARMACY_CLINICAL = ['PHARMACIST', 'PHARMACY_STAFF'];

const NAV = [
  { to: '/rezepte', label: 'Rezepte', roles: PRACTICE_CLINICAL },
  { to: '/rezepte/neu', label: 'Neues Rezept', roles: PRACTICE_CLINICAL },
  { to: '/mitteilungen', label: 'Mitteilungen', roles: ['PRACTICE_ADMIN', ...PRACTICE_CLINICAL] },
  { to: '/pruefen', label: 'Rezept prüfen', roles: PHARMACY_CLINICAL },
  { to: '/einloesungen', label: 'Einlösungen', roles: PHARMACY_CLINICAL },
  { to: '/organisationen', label: 'Organisationen', roles: ['PLATFORM_ADMIN'] },
  { to: '/nutzer', label: 'Nutzer', roles: ['PLATFORM_ADMIN', 'PRACTICE_ADMIN', 'PHARMACY_ADMIN'] },
  { to: '/qs', label: 'QS-Fälle', roles: ['SUPERVISOR'] },
  { to: '/audit', label: 'Audit-Protokoll', roles: ['PLATFORM_ADMIN', 'AUDITOR', 'PRACTICE_ADMIN', 'PHARMACY_ADMIN'] },
];

const link = (key, label) => {
  const href = import.meta.env[key];
  return href ? <a key={key} href={href} target="_blank" rel="noreferrer noopener">{label}</a> : <span key={key}>{label}</span>;
};

function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <span>© {year} | AT Medical GmbH | Alle Rechte vorbehalten</span>
      {link('VITE_LINK_AGB', 'AGB')}
      {link('VITE_LINK_DATENSCHUTZ', 'Datenschutz')}
      <a href="mailto:support@at-medical.de">Kontakt</a>
      <a href="mailto:support@at-medical.de">Support</a>
      {link('VITE_LINK_DOKU', 'Dokumentation')}
    </footer>
  );
}

function Shell() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.loading) return <div className="center"><Spinner /></div>;
  if (!auth.user) return <Navigate to="/anmelden" replace state={{ from: location.pathname }} />;
  const setup = needsSetup(auth);
  if (setup && location.pathname !== '/konto') return <Navigate to="/konto" replace />;
  const { user } = auth;
  const items = NAV.filter((n) => n.roles.includes(user.role));
  return (
    <div className="app">
      <header className="topbar">
        <Logo />
        {!setup && (
          <nav aria-label="Hauptnavigation">
            {items.map((n) => <NavLink key={n.to} to={n.to} end={n.to === '/rezepte'}>{n.label}</NavLink>)}
          </nav>
        )}
        <div className="spacer" />
        <NavLink to="/konto" className="who">
          <span>{user.name}</span>
          <small>{ROLE_LABELS[user.role]}{user.orgName ? ` · ${user.orgName}` : ''}</small>
        </NavLink>
        <button type="button" className="btn btn-small" onClick={auth.logout}>Abmelden</button>
      </header>
      <main className="content"><Outlet /></main>
      <Footer />
    </div>
  );
}

function Home() {
  const { user } = useAuth();
  const target = {
    PRESCRIBER: '/rezepte', PRACTICE_STAFF: '/rezepte', PRACTICE_ADMIN: '/nutzer', PHARMACIST: '/pruefen', PHARMACY_STAFF: '/pruefen',
    PHARMACY_ADMIN: '/nutzer', PLATFORM_ADMIN: '/organisationen', SUPERVISOR: '/qs', AUDITOR: '/audit',
  }[user.role] || '/konto';
  return <Navigate to={target} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/anmelden" element={<Login />} />
      <Route element={<Shell />}>
        <Route index element={<Home />} />
        <Route path="/konto" element={<Account />} />
        <Route path="/rezepte" element={<RxList />} />
        <Route path="/rezepte/neu" element={<RxEdit />} />
        <Route path="/rezepte/:id" element={<RxDetail />} />
        <Route path="/rezepte/:id/bearbeiten" element={<RxEdit />} />
        <Route path="/mitteilungen" element={<Notifications />} />
        <Route path="/pruefen" element={<Verify />} />
        <Route path="/einloesungen" element={<Redemptions />} />
        <Route path="/organisationen" element={<Organizations />} />
        <Route path="/nutzer" element={<Users />} />
        <Route path="/qs" element={<QsCases />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
