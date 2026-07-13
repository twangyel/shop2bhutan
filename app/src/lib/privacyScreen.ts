import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PrivacyScreen } from '@capacitor/privacy-screen';

const activeProtectionOwners = new Set<symbol>();
let privacySync = Promise.resolve();

function syncPrivacyScreen() {
  privacySync = privacySync
    .catch(() => {
      // Keep later synchronization attempts working after a plugin error.
    })
    .then(async () => {
      if (!Capacitor.isNativePlatform()) return;

      const shouldProtect = activeProtectionOwners.size > 0;

      try {
        const { enabled } = await PrivacyScreen.isEnabled();

        if (shouldProtect && !enabled) {
          await PrivacyScreen.enable({
            android: {
              dimBackground: true,
              preventScreenshots: true,
              privacyModeOnActivityHidden: 'dim',
            },
            ios: {
              blurEffect: 'dark',
            },
          });
          return;
        }

        if (!shouldProtect && enabled) {
          await PrivacyScreen.disable();
        }
      } catch (error) {
        console.warn(
          '[PrivacyScreen] Protection synchronization skipped:',
          error,
        );
      }
    });

  return privacySync;
}

/**
 * Protects a sensitive native screen while it is mounted.
 * Browser and PWA builds are intentionally unchanged.
 */
export function usePrivacyScreen(active = true) {
  useEffect(() => {
    if (!active || !Capacitor.isNativePlatform()) return undefined;

    const owner = Symbol('shop2bhutan-privacy-screen');
    activeProtectionOwners.add(owner);
    void syncPrivacyScreen();

    return () => {
      activeProtectionOwners.delete(owner);
      void syncPrivacyScreen();
    };
  }, [active]);
}
