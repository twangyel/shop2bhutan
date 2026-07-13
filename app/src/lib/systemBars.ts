import {
  Capacitor,
  SystemBars,
  SystemBarsStyle,
} from '@capacitor/core';

export async function applyShopSystemBars() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await SystemBars.show();
    await SystemBars.setStyle({
      style: SystemBarsStyle.Light,
    });
  } catch (error) {
    console.warn('[SystemBars] Native styling skipped:', error);
  }
}
