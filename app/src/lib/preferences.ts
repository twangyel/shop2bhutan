import { Preferences } from '@capacitor/preferences';

function browserStorageAvailable() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export async function getStringPreference(
  key: string,
  fallback = '',
) {
  try {
    const { value } = await Preferences.get({ key });
    return value ?? fallback;
  } catch (error) {
    console.warn(`[Preferences] Read skipped for ${key}:`, error);

    if (!browserStorageAvailable()) return fallback;

    try {
      return window.localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  }
}

export async function setStringPreference(
  key: string,
  value: string,
) {
  try {
    await Preferences.set({ key, value });
    return;
  } catch (error) {
    console.warn(`[Preferences] Write skipped for ${key}:`, error);
  }

  if (!browserStorageAvailable()) return;

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in private mode.
  }
}

export async function getNumberPreference(
  key: string,
  fallback = 0,
) {
  const rawValue = await getStringPreference(key, '');
  const parsedValue = Number(rawValue);

  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

export function setNumberPreference(
  key: string,
  value: number,
) {
  return setStringPreference(key, String(value));
}

export async function getBooleanPreference(
  key: string,
  fallback = false,
) {
  const rawValue = await getStringPreference(key, '');

  if (rawValue === 'true') return true;
  if (rawValue === 'false') return false;

  return fallback;
}

export function setBooleanPreference(
  key: string,
  value: boolean,
) {
  return setStringPreference(key, String(value));
}

export async function removePreference(key: string) {
  try {
    await Preferences.remove({ key });
    return;
  } catch (error) {
    console.warn(`[Preferences] Remove skipped for ${key}:`, error);
  }

  if (!browserStorageAvailable()) return;

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Storage can be unavailable in private mode.
  }
}
