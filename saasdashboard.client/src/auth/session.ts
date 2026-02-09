type SessionUser = {
  username: string;
  role: 'Admin' | 'User';
};

type SessionData = {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
};

const STORAGE_KEY = 'saas_session';
const SESSION_EVENT = 'saas:session';

const getBaseUrl = () => {
  const envBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return envBase?.trim() ? envBase.replace(/\/$/, '') : '';
};

export const getSession = (): SessionData | null => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
};

export const setSession = (session: SessionData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(SESSION_EVENT));
};

export const clearSession = () => {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(SESSION_EVENT));
};

export const getAccessToken = () => getSession()?.accessToken ?? null;
export const getRefreshToken = () => getSession()?.refreshToken ?? null;
export const getSessionUser = () => getSession()?.user ?? null;

export const updateSessionTokens = (accessToken: string, refreshToken: string) => {
  const current = getSession();
  if (!current) return;
  setSession({ ...current, accessToken, refreshToken });
};

export const refreshSession = async (): Promise<string | null> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const response = await fetch(`${getBaseUrl()}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    clearSession();
    return null;
  }

  const data = (await response.json()) as SessionData;
  setSession(data);
  return data.accessToken;
};

export const onSessionChange = (handler: () => void) => {
  window.addEventListener(SESSION_EVENT, handler);
  return () => window.removeEventListener(SESSION_EVENT, handler);
};
