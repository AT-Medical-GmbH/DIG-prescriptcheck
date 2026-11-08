import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, setTokens, restoreSession, hasStoredSession, setSessionLostHandler } from './api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, mfaRequired: false, expiredUserId: null });
  const current = useRef(state);
  current.current = state;

  const loadMe = useCallback(async () => {
    const me = await api.get('/auth/me');
    setState((s) => ({ loading: false, user: me.user, mfaRequired: me.mfaRequired, expiredUserId: s.expiredUserId }));
    return me.user;
  }, []);

  useEffect(() => {
    // Sitzung abgelaufen: Nutzer merken, damit nur dieselbe Person nach dem Login zur letzten Seite zurückkehrt
    setSessionLostHandler(() => setState({ loading: false, user: null, mfaRequired: false, expiredUserId: current.current.user ? current.current.user.id : null }));
    (async () => {
      if (!hasStoredSession()) return setState({ loading: false, user: null, mfaRequired: false, expiredUserId: null });
      try {
        await restoreSession();
        await loadMe();
      } catch {
        setTokens(null);
        setState({ loading: false, user: null, mfaRequired: false, expiredUserId: null });
      }
    })();
  }, [loadMe]);

  const login = useCallback(async (email, password, totp) => {
    const res = await api.post('/auth/login', { email, password, ...(totp ? { totp } : {}) });
    setTokens(res);
    return loadMe();
  }, [loadMe]);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch { /* Sitzung ggf. schon beendet */ }
    setTokens(null);
    setState({ loading: false, user: null, mfaRequired: false, expiredUserId: null }); // bewusste Abmeldung: keine Rückkehr zur alten Seite
  }, []);

  const value = useMemo(() => ({ ...state, login, logout, reload: loadMe }), [state, login, logout, loadMe]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Konto muss eingerichtet werden (Passwortwechsel / MFA), bevor Fachfunktionen nutzbar sind. */
export const needsSetup = (state) => !!state.user && (state.user.mustChangePassword || (state.mfaRequired && !state.user.mfaEnabled));
