import { Capacitor } from '@capacitor/core';
import {
  Haptics,
  ImpactStyle,
  NotificationType,
} from '@capacitor/haptics';

async function runNativeHaptic(action: () => Promise<void>) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await action();
  } catch {
    // Haptics may be unavailable or disabled on some devices.
  }
}

export function hapticLight() {
  return runNativeHaptic(() =>
    Haptics.impact({ style: ImpactStyle.Light }),
  );
}

export function hapticSuccess() {
  return runNativeHaptic(() =>
    Haptics.notification({ type: NotificationType.Success }),
  );
}

export function hapticWarning() {
  return runNativeHaptic(() =>
    Haptics.notification({ type: NotificationType.Warning }),
  );
}

export function hapticError() {
  return runNativeHaptic(() =>
    Haptics.notification({ type: NotificationType.Error }),
  );
}
