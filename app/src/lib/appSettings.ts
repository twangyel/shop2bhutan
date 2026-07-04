import { supabase } from '@/lib/supabase';
import type { AppSettings, AcceptedPlatformSettings } from '@/types';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  appName: 'Shop2Bhutan',
  supportEmail: 'support@shop2bhutan.com',
  supportPhone: '+975 17123456',
  whatsappNumber: '+975 17123456',
  businessHours: 'Mon-Sat, 9 AM - 6 PM',
  orderAcceptanceEnabled: true,
  maintenanceEnabled: false,
  maintenanceMessage: 'We are undergoing maintenance. Please check back soon.',
  quotationValidityHours: 48,
  autoCancelUnquotedDays: 7,
  maxItemsPerOrder: 50,
  currencySymbol: 'Nu.',
  decimalPlaces: 0,
  partialPaymentEnabled: true,
  minimumAdvancePaymentPercent: 50,
  homeAnnouncementEnabled: false,
  homeAnnouncementText: 'Orders accepted from all 20 dzongkhags. Delivery currently available in Thimphu, Paro, and Phuntsholing/Chhukha.',
  logoUrl: '/brand/logo-full-transparent.png',
  logoMarkUrl: '/brand/logo-mark-bag-transparent.png',
  acceptedPlatforms: {
    amazon: true,
    flipkart: true,
    myntra: true,
    meesho: true,
  },
};

type SettingsRow = {
  key: string;
  value: unknown;
};

type AnyError = { message?: string; code?: string };

const SETTINGS_TABLE = 'app_settings';
const APP_ASSETS_BUCKET = 'app-assets';

function cleanText(value: unknown, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function numeric(value: unknown, fallback: number) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function integer(value: unknown, fallback: number) {
  return Math.max(0, Math.round(numeric(value, fallback)));
}

function bool(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const text = String(value ?? '').trim().toLowerCase();
  if (['true', '1', 'yes', 'on', 'enabled'].includes(text)) return true;
  if (['false', '0', 'no', 'off', 'disabled'].includes(text)) return false;
  return fallback;
}

function clampPercent(value: unknown, fallback: number) {
  const num = Math.round(numeric(value, fallback));
  return Math.min(100, Math.max(1, num));
}

function getRowValue(rows: SettingsRow[], key: string, fallback: unknown) {
  const row = rows.find((item) => item.key === key);
  return row?.value ?? fallback;
}

function normalizePlatforms(value: unknown): AcceptedPlatformSettings {
  const fallback = DEFAULT_APP_SETTINGS.acceptedPlatforms;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const raw = value as Record<string, unknown>;
  return {
    amazon: bool(raw.amazon, fallback.amazon),
    flipkart: bool(raw.flipkart, fallback.flipkart),
    myntra: bool(raw.myntra, fallback.myntra),
    meesho: bool(raw.meesho, fallback.meesho),
  };
}

function normalizeAppSettings(rows: SettingsRow[]): AppSettings {
  const base = DEFAULT_APP_SETTINGS;

  return {
    appName: cleanText(getRowValue(rows, 'app_name', base.appName), base.appName),
    supportEmail: cleanText(getRowValue(rows, 'support_email', base.supportEmail), base.supportEmail),
    supportPhone: cleanText(getRowValue(rows, 'support_phone', base.supportPhone), base.supportPhone),
    whatsappNumber: cleanText(getRowValue(rows, 'whatsapp_number', base.whatsappNumber), base.whatsappNumber),
    businessHours: cleanText(getRowValue(rows, 'business_hours', base.businessHours), base.businessHours),
    orderAcceptanceEnabled: bool(getRowValue(rows, 'order_acceptance_enabled', base.orderAcceptanceEnabled), base.orderAcceptanceEnabled),
    maintenanceEnabled: bool(getRowValue(rows, 'maintenance_enabled', base.maintenanceEnabled), base.maintenanceEnabled),
    maintenanceMessage: cleanText(getRowValue(rows, 'maintenance_message', base.maintenanceMessage), base.maintenanceMessage),
    quotationValidityHours: integer(getRowValue(rows, 'quotation_validity_hours', base.quotationValidityHours), base.quotationValidityHours),
    autoCancelUnquotedDays: integer(getRowValue(rows, 'auto_cancel_unquoted_days', base.autoCancelUnquotedDays), base.autoCancelUnquotedDays),
    maxItemsPerOrder: integer(getRowValue(rows, 'max_items_per_order', base.maxItemsPerOrder), base.maxItemsPerOrder),
    currencySymbol: cleanText(getRowValue(rows, 'currency_symbol', base.currencySymbol), base.currencySymbol),
    decimalPlaces: integer(getRowValue(rows, 'decimal_places', base.decimalPlaces), base.decimalPlaces),
    partialPaymentEnabled: bool(getRowValue(rows, 'partial_payment_enabled', base.partialPaymentEnabled), base.partialPaymentEnabled),
    minimumAdvancePaymentPercent: clampPercent(
      getRowValue(rows, 'minimum_advance_payment_percent', base.minimumAdvancePaymentPercent),
      base.minimumAdvancePaymentPercent
    ),
    homeAnnouncementEnabled: bool(getRowValue(rows, 'home_announcement_enabled', base.homeAnnouncementEnabled), base.homeAnnouncementEnabled),
    homeAnnouncementText: cleanText(getRowValue(rows, 'home_announcement_text', base.homeAnnouncementText), base.homeAnnouncementText),
    logoUrl: cleanText(getRowValue(rows, 'logo_url', base.logoUrl), base.logoUrl),
    logoMarkUrl: cleanText(getRowValue(rows, 'logo_mark_url', base.logoMarkUrl), base.logoMarkUrl),
    acceptedPlatforms: normalizePlatforms(getRowValue(rows, 'accepted_platforms', base.acceptedPlatforms)),
  };
}

function isMissingSettingsTableError(error: unknown) {
  const message = cleanText((error as AnyError)?.message).toLowerCase();
  return (
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('could not find') ||
    message.includes('relation') ||
    message.includes('column')
  );
}

function toRows(settings: AppSettings, userId?: string | null) {
  const updatedAt = new Date().toISOString();

  const entries: Array<[string, unknown]> = [
    ['app_name', cleanText(settings.appName, DEFAULT_APP_SETTINGS.appName)],
    ['support_email', cleanText(settings.supportEmail, DEFAULT_APP_SETTINGS.supportEmail)],
    ['support_phone', cleanText(settings.supportPhone, DEFAULT_APP_SETTINGS.supportPhone)],
    ['whatsapp_number', cleanText(settings.whatsappNumber, DEFAULT_APP_SETTINGS.whatsappNumber)],
    ['business_hours', cleanText(settings.businessHours, DEFAULT_APP_SETTINGS.businessHours)],
    ['order_acceptance_enabled', Boolean(settings.orderAcceptanceEnabled)],
    ['maintenance_enabled', Boolean(settings.maintenanceEnabled)],
    ['maintenance_message', cleanText(settings.maintenanceMessage, DEFAULT_APP_SETTINGS.maintenanceMessage)],
    ['quotation_validity_hours', integer(settings.quotationValidityHours, DEFAULT_APP_SETTINGS.quotationValidityHours)],
    ['auto_cancel_unquoted_days', integer(settings.autoCancelUnquotedDays, DEFAULT_APP_SETTINGS.autoCancelUnquotedDays)],
    ['max_items_per_order', integer(settings.maxItemsPerOrder, DEFAULT_APP_SETTINGS.maxItemsPerOrder)],
    ['currency_symbol', cleanText(settings.currencySymbol, DEFAULT_APP_SETTINGS.currencySymbol)],
    ['decimal_places', integer(settings.decimalPlaces, DEFAULT_APP_SETTINGS.decimalPlaces)],
    ['partial_payment_enabled', Boolean(settings.partialPaymentEnabled)],
    ['minimum_advance_payment_percent', clampPercent(settings.minimumAdvancePaymentPercent, DEFAULT_APP_SETTINGS.minimumAdvancePaymentPercent)],
    ['home_announcement_enabled', Boolean(settings.homeAnnouncementEnabled)],
    ['home_announcement_text', cleanText(settings.homeAnnouncementText, DEFAULT_APP_SETTINGS.homeAnnouncementText)],
    ['logo_url', cleanText(settings.logoUrl, DEFAULT_APP_SETTINGS.logoUrl)],
    ['logo_mark_url', cleanText(settings.logoMarkUrl, DEFAULT_APP_SETTINGS.logoMarkUrl)],
    ['accepted_platforms', settings.acceptedPlatforms],
  ];

  return entries.map(([key, value]) => ({
    key,
    value,
    updated_at: updatedAt,
    updated_by: userId || null,
  }));
}

export async function fetchPublicAppSettings(): Promise<AppSettings> {
  const { data, error } = await supabase.from(SETTINGS_TABLE).select('key,value');

  if (error) {
    if (isMissingSettingsTableError(error)) return DEFAULT_APP_SETTINGS;
    throw error;
  }

  return normalizeAppSettings((data ?? []) as SettingsRow[]);
}

export async function saveAppSettings(settings: AppSettings, userId?: string | null): Promise<AppSettings> {
  const { error } = await supabase.from(SETTINGS_TABLE).upsert(toRows(settings, userId), { onConflict: 'key' });

  if (error) {
    if (isMissingSettingsTableError(error)) {
      throw new Error('App settings table is missing. Please run the Step 05 App Settings SQL first.');
    }
    throw error;
  }

  window.dispatchEvent(new CustomEvent('shop2bhutan:app-settings-updated'));
  return fetchPublicAppSettings();
}

export async function uploadAppLogo(file: File): Promise<string> {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Please upload a PNG, JPG, WEBP, or SVG logo.');
  }

  if (file.size > 2 * 1024 * 1024) {
    throw new Error('Logo file must be less than 2MB.');
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || (file.type === 'image/svg+xml' ? 'svg' : 'png');
  const safeName = file.name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'shop2bhutan-logo';
  const path = `logos/${safeName}-${Date.now()}.${extension}`;

  const { error } = await supabase.storage.from(APP_ASSETS_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: file.type,
  });

  if (error) {
    throw new Error(error.message || 'Unable to upload logo. Please check app-assets storage policies.');
  }

  const { data } = supabase.storage.from(APP_ASSETS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
