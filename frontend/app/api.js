// Schlanker API-Client: Access-Token im Speicher, Refresh-Token nur für die Dauer der Browser-Sitzung.
// Bei 401 wird einmal automatisch erneuert (Refresh-Rotation im Backend).

const BASE = '/api/v1';
const REFRESH_KEY = 'pc.refresh';

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let accessToken = null;
let refreshPromise = null;
let onSessionLost = () => {};

const store = {
  get: () => { try { return sessionStorage.getItem(REFRESH_KEY); } catch { return null; } },
  set: (v) => { try { v ? sessionStorage.setItem(REFRESH_KEY, v) : sessionStorage.removeItem(REFRESH_KEY); } catch { /* privater Modus */ } },
};

export const setSessionLostHandler = (fn) => { onSessionLost = fn; };
export const hasStoredSession = () => !!store.get();

export function setTokens(tokens) {
  accessToken = tokens ? tokens.accessToken : null;
  store.set(tokens ? tokens.refreshToken : null);
}

async function refresh() {
  const token = store.get();
  if (!token) throw new ApiError(401, 'NO_SESSION', 'Nicht angemeldet.');
  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: token }) })
      .then(async (res) => {
        if (!res.ok) throw new ApiError(res.status, 'INVALID_REFRESH', 'Sitzung abgelaufen.');
        setTokens(await res.json());
      })
      .finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export async function restoreSession() {
  await refresh();
}

async function send(method, path, body, retry = true) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && retry && !path.startsWith('/auth/login') && !path.startsWith('/auth/refresh') && store.get()) {
    try {
      await refresh();
    } catch {
      setTokens(null);
      onSessionLost();
      throw new ApiError(401, 'SESSION_EXPIRED', 'Sitzung abgelaufen. Bitte erneut anmelden.');
    }
    return send(method, path, body, false);
  }
  return res;
}

/** Verständliche Meldung, wenn die Antwort kein API-Fehlerobjekt ist (z. B. Proxy-Fehlerseite, Netzausfall). */
function statusMessage(status) {
  if (status === 429) return 'Zu viele Anfragen. Bitte einen Moment warten.';
  if (status === 502 || status === 503 || status === 504) return 'Der Dienst ist vorübergehend nicht erreichbar. Bitte später erneut versuchen.';
  if (status === 413) return 'Die Anfrage ist zu groß.';
  if (status >= 500) return 'Auf dem Server ist ein Fehler aufgetreten. Bitte später erneut versuchen.';
  return 'Unerwarteter Fehler.';
}

async function json(method, path, body) {
  let res;
  try {
    res = await send(method, path, body);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, 'NETWORK', 'Keine Verbindung zum Server. Bitte Netzwerk prüfen und erneut versuchen.');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const e = data && data.error;
    throw new ApiError(res.status, e ? e.code : 'ERROR', e ? e.message : statusMessage(res.status), e && e.details);
  }
  return data;
}

export const api = {
  get: (p) => json('GET', p),
  post: (p, b = {}) => json('POST', p, b),
  put: (p, b) => json('PUT', p, b),
  patch: (p, b) => json('PATCH', p, b),
  /** PDF mit Authentifizierung laden und in neuem Tab öffnen. */
  async openPdf(path) {
    const win = window.open('', '_blank'); // synchron öffnen, damit Popup-Blocker nicht greifen
    try {
      const res = await send('GET', path);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new ApiError(res.status, data?.error?.code, data?.error?.message || statusMessage(res.status));
      }
      const blob = await res.blob();
      if (!(res.headers.get('content-type') || '').startsWith('application/pdf')) throw new ApiError(res.status, 'NOT_PDF', 'Das PDF konnte nicht erzeugt werden.');
      const url = URL.createObjectURL(blob);
      if (win) win.location.href = url;
      else window.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
    } catch (e) {
      if (win) win.close();
      throw e;
    }
  },
};
