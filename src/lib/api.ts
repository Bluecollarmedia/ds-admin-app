import { ADMIN_API_BASE_URL } from './config';
import { getToken, setToken, getSettingsToken, setSettingsToken, clearToken } from './session';

// All privileged operations go through the deployed admin API (which holds the
// Supabase service-role key + R2 secrets server-side). The native app just holds
// a session token and sends it as a header — never any real secret.

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const [token, settingsToken] = await Promise.all([getToken(), getSettingsToken()]);
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('x-admin-token', token);
  if (settingsToken) headers.set('x-settings-token', settingsToken);
  return fetch(`${ADMIN_API_BASE_URL}${path}`, { ...init, headers });
}

// Unlock the protected areas (Settings, etc.) with the security passcode.
export async function unlockSettings(passcode: string): Promise<void> {
  const token = await getToken();
  const res = await fetch(`${ADMIN_API_BASE_URL}/api/admin/settings/unlock`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-admin-token': token } : {}),
    },
    body: JSON.stringify({ passcode }),
  });
  const data = (await res.json().catch(() => null)) as { token?: string; error?: string } | null;
  if (!res.ok) throw new ApiError(data?.error ?? 'Incorrect passcode.', res.status);
  if (data?.token) await setSettingsToken(data.token);
}

export async function adminJson<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await adminFetch(path, init);
  const data = (await res.json().catch(() => null)) as T & { error?: string };
  if (!res.ok) throw new ApiError(data?.error ?? `Request failed (${res.status})`, res.status);
  return data;
}

export async function login(username: string, password: string): Promise<void> {
  const res = await fetch(`${ADMIN_API_BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = (await res.json().catch(() => null)) as { token?: string; error?: string } | null;
  if (!res.ok || !data?.token) {
    throw new ApiError(data?.error ?? 'Incorrect username or password.', res.status);
  }
  await setToken(data.token);
}

export async function logout(): Promise<void> {
  await clearToken();
}
