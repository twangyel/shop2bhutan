import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';

function cleanPart(value: unknown) {
  return String(value ?? '').trim();
}

function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function isStandalonePwa() {
  if (typeof window === 'undefined') return false;

  return Boolean(
    window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone,
  );
}

export async function buildSupportDiagnostics() {
  const [
    deviceResult,
    languageResult,
    networkResult,
    appResult,
  ] = await Promise.allSettled([
    Device.getInfo(),
    Device.getLanguageTag(),
    Network.getStatus(),
    Capacitor.isNativePlatform()
      ? CapacitorApp.getInfo()
      : Promise.resolve(null),
  ]);

  const device =
    deviceResult.status === 'fulfilled' ? deviceResult.value : null;
  const language =
    languageResult.status === 'fulfilled'
      ? languageResult.value.value
      : '';
  const network =
    networkResult.status === 'fulfilled' ? networkResult.value : null;
  const app =
    appResult.status === 'fulfilled' ? appResult.value : null;

  const platform =
    cleanPart(device?.platform) || Capacitor.getPlatform() || 'web';
  const runtime = Capacitor.isNativePlatform()
    ? 'Native app'
    : isStandalonePwa()
      ? 'Installed PWA'
      : 'Web browser';

  const manufacturer = cleanPart(device?.manufacturer);
  const model = cleanPart(device?.model);
  const deviceLabel =
    [manufacturer, model].filter(Boolean).join(' ') || 'Unavailable';

  const operatingSystem =
    cleanPart(device?.operatingSystem) || platform;
  const osVersion = cleanPart(device?.osVersion);
  const osLabel = [
    titleCase(operatingSystem),
    osVersion,
  ]
    .filter(Boolean)
    .join(' ');

  const lines = [
    'Shop2Bhutan Support Diagnostics',
    `Generated: ${new Date().toISOString()}`,
    '',
    `Runtime: ${runtime}`,
    `Platform: ${titleCase(platform)}`,
    `Device: ${deviceLabel}`,
    `Operating system: ${osLabel || 'Unavailable'}`,
  ];

  if (
    device?.platform === 'android' &&
    typeof device.androidSDKVersion === 'number'
  ) {
    lines.push(`Android SDK: ${device.androidSDKVersion}`);
  }

  if (cleanPart(device?.webViewVersion)) {
    lines.push(`WebView: ${device?.webViewVersion}`);
  }

  if (app) {
    lines.push(`App version: ${app.version}`);
    lines.push(`Build: ${app.build}`);
  } else {
    lines.push('App version: Web/PWA deployment');
  }

  if (language) {
    lines.push(`Language: ${language}`);
  }

  if (network) {
    lines.push(
      `Network: ${
        network.connected ? 'Connected' : 'Offline'
      } (${network.connectionType})`,
    );
  }

  if (typeof window !== 'undefined') {
    lines.push(`Page: ${window.location.pathname}`);
  }

  lines.push('');
  lines.push(
    'No device ID, password, address, payment information, or account content is included.',
  );

  return lines.join('\n');
}
