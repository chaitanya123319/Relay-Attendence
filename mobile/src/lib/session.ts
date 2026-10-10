import * as SecureStore from 'expo-secure-store';

const KEY_ACCESS = 'relay.accessToken';
const KEY_REFRESH = 'relay.refreshToken';
const KEY_DEVICE = 'relay.deviceId';

export interface StoredTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

export async function loadTokens(): Promise<StoredTokens> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(KEY_ACCESS),
    SecureStore.getItemAsync(KEY_REFRESH),
  ]);
  return { accessToken, refreshToken };
}

export async function persistTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(KEY_ACCESS, accessToken),
    SecureStore.setItemAsync(KEY_REFRESH, refreshToken),
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_ACCESS),
    SecureStore.deleteItemAsync(KEY_REFRESH),
  ]);
}

/** Stable per-install device id — generated once, persisted forever. */
export async function getDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY_DEVICE);
  if (existing) return existing;
  const id = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await SecureStore.setItemAsync(KEY_DEVICE, id);
  return id;
}
