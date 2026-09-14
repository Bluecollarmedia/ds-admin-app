import * as SecureStore from 'expo-secure-store';

// The admin session token, kept in the device keychain (never in plain storage).
const KEY = 'ds_admin_token';
// The separate security-passcode token, for protected areas (Settings, etc.).
const SETTINGS_KEY = 'ds_settings_token';

export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, token);
}

export async function getSettingsToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(SETTINGS_KEY);
  } catch {
    return null;
  }
}

export async function setSettingsToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SETTINGS_KEY, token);
}

export async function clearToken(): Promise<void> {
  for (const k of [KEY, SETTINGS_KEY]) {
    try {
      await SecureStore.deleteItemAsync(k);
    } catch {
      // ignore
    }
  }
}
