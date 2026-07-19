import { supabase } from '@/lib/supabase';
import type {
  AcceptedPlatformSettings,
  AppSettings,
  BusinessDayHours,
  BusinessDayKey,
  BusinessHoursSchedule,
  HomeAnnouncementType,
} from '@/types';

export const BUSINESS_TIME_ZONE = 'Asia/Thimphu';

export const BUSINESS_DAY_ORDER: BusinessDayKey[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const BUSINESS_DAY_LABELS: Record<BusinessDayKey, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const BUSINESS_DAY_SHORT_LABELS: Record<BusinessDayKey, string> = {
  monday: 'Mon',
  tuesday: 'Tue',
  wednesday: 'Wed',
  thursday: 'Thu',
  friday: 'Fri',
  saturday: 'Sat',
  sunday: 'Sun',
};

function makeBusinessDay(
  enabled: boolean,
  open = '09:00',
  close = '18:00',
): BusinessDayHours {
  return { enabled, open, close };
}

export const DEFAULT_BUSINESS_SCHEDULE: BusinessHoursSchedule = {
  monday: makeBusinessDay(true),
  tuesday: makeBusinessDay(true),
  wednesday: makeBusinessDay(true),
  thursday: makeBusinessDay(true),
  friday: makeBusinessDay(true),
  saturday: makeBusinessDay(true),
  sunday: makeBusinessDay(false),
};

function cloneBusinessSchedule(
  schedule: BusinessHoursSchedule,
): BusinessHoursSchedule {
  return BUSINESS_DAY_ORDER.reduce((result, day) => {
    result[day] = { ...schedule[day] };
    return result;
  }, {} as BusinessHoursSchedule);
}

function validClockTime(value: unknown) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value ?? '').trim());
}

function normalizeClockTime(value: unknown, fallback: string) {
  const clean = String(value ?? '').trim();
  return validClockTime(clean) ? clean : fallback;
}

function clockMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function legacyTimeTo24(
  hoursText: string,
  minutesText: string | undefined,
  periodText: string | undefined,
) {
  let hours = Number(hoursText);
  const minutes = Number(minutesText || 0);
  const period = String(periodText || '').toLowerCase();

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return '';

  if (period === 'pm' && hours < 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return '';

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function parseLegacyBusinessHours(
  value: unknown,
): BusinessHoursSchedule | null {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const timeMatch = raw.match(
    /(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i,
  );

  if (!timeMatch) return null;

  const open = legacyTimeTo24(timeMatch[1], timeMatch[2], timeMatch[3]);
  const close = legacyTimeTo24(timeMatch[4], timeMatch[5], timeMatch[6]);

  if (!open || !close || clockMinutes(open) >= clockMinutes(close)) {
    return null;
  }

  const dayAliases: Array<[RegExp, BusinessDayKey]> = [
    [/mon(?:day)?/i, 'monday'],
    [/tue(?:sday)?/i, 'tuesday'],
    [/wed(?:nesday)?/i, 'wednesday'],
    [/thu(?:rsday)?/i, 'thursday'],
    [/fri(?:day)?/i, 'friday'],
    [/sat(?:urday)?/i, 'saturday'],
    [/sun(?:day)?/i, 'sunday'],
  ];

  const matchedDays = dayAliases
    .filter(([pattern]) => pattern.test(raw))
    .map(([, day]) => day);

  let startIndex = 0;
  let endIndex = 5;

  if (matchedDays.length >= 2) {
    startIndex = BUSINESS_DAY_ORDER.indexOf(matchedDays[0]);
    endIndex = BUSINESS_DAY_ORDER.indexOf(matchedDays[1]);
  } else if (matchedDays.length === 1) {
    startIndex = BUSINESS_DAY_ORDER.indexOf(matchedDays[0]);
    endIndex = startIndex;
  }

  if (startIndex < 0 || endIndex < 0) return null;

  const result = cloneBusinessSchedule(DEFAULT_BUSINESS_SCHEDULE);

  BUSINESS_DAY_ORDER.forEach((day) => {
    result[day] = makeBusinessDay(false, open, close);
  });

  if (startIndex <= endIndex) {
    for (let index = startIndex; index <= endIndex; index += 1) {
      result[BUSINESS_DAY_ORDER[index]] = makeBusinessDay(true, open, close);
    }
  } else {
    for (let index = startIndex; index < BUSINESS_DAY_ORDER.length; index += 1) {
      result[BUSINESS_DAY_ORDER[index]] = makeBusinessDay(true, open, close);
    }
    for (let index = 0; index <= endIndex; index += 1) {
      result[BUSINESS_DAY_ORDER[index]] = makeBusinessDay(true, open, close);
    }
  }

  return result;
}

export function normalizeBusinessSchedule(
  value: unknown,
  legacyBusinessHours?: unknown,
): BusinessHoursSchedule {
  const fallback =
    parseLegacyBusinessHours(legacyBusinessHours) ||
    DEFAULT_BUSINESS_SCHEDULE;

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return cloneBusinessSchedule(fallback);
  }

  const raw = value as Partial<
    Record<BusinessDayKey, Partial<BusinessDayHours>>
  >;

  return BUSINESS_DAY_ORDER.reduce((result, day) => {
    const fallbackDay = fallback[day];
    const candidate = raw[day];

    result[day] = {
      enabled:
        typeof candidate?.enabled === 'boolean'
          ? candidate.enabled
          : fallbackDay.enabled,
      open: normalizeClockTime(candidate?.open, fallbackDay.open),
      close: normalizeClockTime(candidate?.close, fallbackDay.close),
    };

    return result;
  }, {} as BusinessHoursSchedule);
}

export function formatBusinessClockTime(value: string) {
  if (!validClockTime(value)) return value;

  const [hoursText, minutesText] = value.split(':');
  const hours = Number(hoursText);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;

  return `${displayHours}:${minutesText} ${period}`;
}

function businessDayRangeLabel(
  start: BusinessDayKey,
  end: BusinessDayKey,
) {
  if (start === end) return BUSINESS_DAY_SHORT_LABELS[start];

  return `${BUSINESS_DAY_SHORT_LABELS[start]}–${BUSINESS_DAY_SHORT_LABELS[end]}`;
}

export function formatBusinessHoursSummary(
  value: BusinessHoursSchedule,
) {
  const schedule = normalizeBusinessSchedule(value);
  const groups: Array<{
    start: BusinessDayKey;
    end: BusinessDayKey;
    enabled: boolean;
    open: string;
    close: string;
  }> = [];

  BUSINESS_DAY_ORDER.forEach((day) => {
    const current = schedule[day];
    const previous = groups[groups.length - 1];

    if (
      previous &&
      previous.enabled === current.enabled &&
      previous.open === current.open &&
      previous.close === current.close
    ) {
      previous.end = day;
      return;
    }

    groups.push({
      start: day,
      end: day,
      enabled: current.enabled,
      open: current.open,
      close: current.close,
    });
  });

  if (groups.every((group) => !group.enabled)) {
    return 'Closed every day';
  }

  return groups
    .map((group) => {
      const days = businessDayRangeLabel(group.start, group.end);

      if (!group.enabled) return `${days} closed`;

      return `${days}: ${formatBusinessClockTime(group.open)}–${formatBusinessClockTime(group.close)}`;
    })
    .join(' · ');
}

export function validateBusinessHoursSchedule(
  value: BusinessHoursSchedule,
) {
  const schedule = normalizeBusinessSchedule(value);

  for (const day of BUSINESS_DAY_ORDER) {
    const hours = schedule[day];

    if (!hours.enabled) continue;

    if (!validClockTime(hours.open) || !validClockTime(hours.close)) {
      return `${BUSINESS_DAY_LABELS[day]} has an invalid opening or closing time.`;
    }

    if (clockMinutes(hours.open) >= clockMinutes(hours.close)) {
      return `${BUSINESS_DAY_LABELS[day]} closing time must be later than opening time.`;
    }
  }

  return '';
}

function currentBhutanDayAndMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const weekday = parts.find((part) => part.type === 'weekday')?.value.toLowerCase();
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);

  const day = BUSINESS_DAY_ORDER.find(
    (candidate) => candidate === weekday,
  ) || 'monday';

  return {
    day,
    dayIndex: BUSINESS_DAY_ORDER.indexOf(day),
    minutes: hour * 60 + minute,
  };
}

export type BusinessHoursStatus = {
  isOpen: boolean;
  headline: string;
  detail: string;
  summary: string;
};

export function getBusinessHoursStatus(
  value: BusinessHoursSchedule,
  date = new Date(),
): BusinessHoursStatus {
  const schedule = normalizeBusinessSchedule(value);
  const current = currentBhutanDayAndMinutes(date);
  const today = schedule[current.day];
  const summary = formatBusinessHoursSummary(schedule);

  if (
    today.enabled &&
    current.minutes >= clockMinutes(today.open) &&
    current.minutes < clockMinutes(today.close)
  ) {
    return {
      isOpen: true,
      headline: 'Open now',
      detail: `Closes at ${formatBusinessClockTime(today.close)}`,
      summary,
    };
  }

  for (let offset = 0; offset <= 7; offset += 1) {
    const dayIndex = (current.dayIndex + offset) % BUSINESS_DAY_ORDER.length;
    const day = BUSINESS_DAY_ORDER[dayIndex];
    const hours = schedule[day];

    if (!hours.enabled) continue;
    if (offset === 0 && current.minutes >= clockMinutes(hours.open)) continue;

    const prefix =
      offset === 0
        ? 'Opens at'
        : offset === 1
          ? 'Opens tomorrow at'
          : `Opens ${BUSINESS_DAY_SHORT_LABELS[day]} at`;

    return {
      isOpen: false,
      headline: 'Closed now',
      detail: `${prefix} ${formatBusinessClockTime(hours.open)}`,
      summary,
    };
  }

  return {
    isOpen: false,
    headline: 'Closed now',
    detail: 'No opening hours scheduled',
    summary,
  };
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  appName: 'Shop2Bhutan',
  supportEmail: 'support@shop2bhutan.com',
  supportPhone: '+975 17123456',
  whatsappNumber: '+975 17123456',
  businessHours: formatBusinessHoursSummary(DEFAULT_BUSINESS_SCHEDULE),
  businessSchedule: cloneBusinessSchedule(DEFAULT_BUSINESS_SCHEDULE),
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
  homeAnnouncementType: 'announcement',
  homeAnnouncementTitle: 'Shop2Bhutan update',
  homeAnnouncementText: 'Orders accepted from all 20 dzongkhags. Delivery currently available in Thimphu, Paro, and Phuntsholing/Chhukha.',
  homeAnnouncementCtaLabel: '',
  homeAnnouncementLink: '',
  homeAnnouncementStartAt: '',
  homeAnnouncementEndAt: '',
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


const HOME_ANNOUNCEMENT_SETTING_KEYS = new Set([
  'home_announcement_enabled',
  'home_announcement_type',
  'home_announcement_title',
  'home_announcement_text',
  'home_announcement_cta_label',
  'home_announcement_link',
  'home_announcement_start_at',
  'home_announcement_end_at',
]);

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


function normalizeAnnouncementType(
  value: unknown,
  fallback: HomeAnnouncementType,
): HomeAnnouncementType {
  const normalized = cleanText(value).toLowerCase();
  if (
    normalized === 'announcement' ||
    normalized === 'promotion' ||
    normalized === 'warning' ||
    normalized === 'advertisement'
  ) {
    return normalized;
  }
  return fallback;
}

function parseSettingDate(value: unknown) {
  const text = cleanText(value);
  if (!text) return null;

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

export type HomeAnnouncementStatus = {
  isVisible: boolean;
  state:
    | 'disabled'
    | 'hidden_for_maintenance'
    | 'scheduled'
    | 'active'
    | 'expired'
    | 'invalid';
};

export function getHomeAnnouncementStatus(
  settings: Pick<
    AppSettings,
    | 'homeAnnouncementEnabled'
    | 'homeAnnouncementTitle'
    | 'homeAnnouncementText'
    | 'homeAnnouncementStartAt'
    | 'homeAnnouncementEndAt'
    | 'maintenanceEnabled'
  >,
  date = new Date(),
): HomeAnnouncementStatus {
  if (!settings.homeAnnouncementEnabled) {
    return { isVisible: false, state: 'disabled' };
  }

  if (settings.maintenanceEnabled) {
    return { isVisible: false, state: 'hidden_for_maintenance' };
  }

  if (!cleanText(settings.homeAnnouncementTitle) || !cleanText(settings.homeAnnouncementText)) {
    return { isVisible: false, state: 'invalid' };
  }

  const startText = cleanText(settings.homeAnnouncementStartAt);
  const endText = cleanText(settings.homeAnnouncementEndAt);
  const start = parseSettingDate(startText);
  const end = parseSettingDate(endText);

  if ((startText && !start) || (endText && !end)) {
    return { isVisible: false, state: 'invalid' };
  }

  if (start && date.getTime() < start.getTime()) {
    return { isVisible: false, state: 'scheduled' };
  }

  if (end && date.getTime() >= end.getTime()) {
    return { isVisible: false, state: 'expired' };
  }

  return { isVisible: true, state: 'active' };
}

export function validateHomeAnnouncement(settings: AppSettings) {
  if (!settings.homeAnnouncementEnabled) return '';

  if (!cleanText(settings.homeAnnouncementTitle)) {
    return 'Announcement title is required when the card is enabled.';
  }

  if (!cleanText(settings.homeAnnouncementText)) {
    return 'Announcement message is required when the card is enabled.';
  }

  const startText = cleanText(settings.homeAnnouncementStartAt);
  const endText = cleanText(settings.homeAnnouncementEndAt);
  const start = parseSettingDate(startText);
  const end = parseSettingDate(endText);

  if (startText && !start) return 'Announcement start date and time is invalid.';
  if (endText && !end) return 'Announcement end date and time is invalid.';
  if (start && end && end.getTime() <= start.getTime()) {
    return 'Announcement end date and time must be later than the start date and time.';
  }

  const ctaLabel = cleanText(settings.homeAnnouncementCtaLabel);
  const link = cleanText(settings.homeAnnouncementLink);

  if ((ctaLabel && !link) || (!ctaLabel && link)) {
    return 'Add both a button label and destination, or leave both blank.';
  }

  if (link && !link.startsWith('/') && !/^https:\/\//i.test(link)) {
    return 'Announcement destination must be an internal path beginning with / or a secure https:// link.';
  }

  return '';
}

function normalizeAppSettings(rows: SettingsRow[]): AppSettings {
  const base = DEFAULT_APP_SETTINGS;
  const legacyBusinessHours = cleanText(
    getRowValue(rows, 'business_hours', base.businessHours),
    base.businessHours,
  );
  const businessSchedule = normalizeBusinessSchedule(
    getRowValue(rows, 'business_hours_schedule', null),
    legacyBusinessHours,
  );

  return {
    appName: cleanText(getRowValue(rows, 'app_name', base.appName), base.appName),
    supportEmail: cleanText(getRowValue(rows, 'support_email', base.supportEmail), base.supportEmail),
    supportPhone: cleanText(getRowValue(rows, 'support_phone', base.supportPhone), base.supportPhone),
    whatsappNumber: cleanText(getRowValue(rows, 'whatsapp_number', base.whatsappNumber), base.whatsappNumber),
    businessHours: formatBusinessHoursSummary(businessSchedule),
    businessSchedule,
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
    homeAnnouncementType: normalizeAnnouncementType(
      getRowValue(rows, 'home_announcement_type', base.homeAnnouncementType),
      base.homeAnnouncementType,
    ),
    homeAnnouncementTitle: cleanText(
      getRowValue(rows, 'home_announcement_title', base.homeAnnouncementTitle),
      base.homeAnnouncementTitle,
    ),
    homeAnnouncementText: cleanText(getRowValue(rows, 'home_announcement_text', base.homeAnnouncementText), base.homeAnnouncementText),
    homeAnnouncementCtaLabel: cleanText(
      getRowValue(rows, 'home_announcement_cta_label', base.homeAnnouncementCtaLabel),
    ),
    homeAnnouncementLink: cleanText(
      getRowValue(rows, 'home_announcement_link', base.homeAnnouncementLink),
    ),
    homeAnnouncementStartAt: cleanText(
      getRowValue(rows, 'home_announcement_start_at', base.homeAnnouncementStartAt),
    ),
    homeAnnouncementEndAt: cleanText(
      getRowValue(rows, 'home_announcement_end_at', base.homeAnnouncementEndAt),
    ),
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
  const businessSchedule = normalizeBusinessSchedule(
    settings.businessSchedule,
    settings.businessHours,
  );
  const businessHours = formatBusinessHoursSummary(businessSchedule);

  const entries: Array<[string, unknown]> = [
    ['app_name', cleanText(settings.appName, DEFAULT_APP_SETTINGS.appName)],
    ['support_email', cleanText(settings.supportEmail, DEFAULT_APP_SETTINGS.supportEmail)],
    ['support_phone', cleanText(settings.supportPhone, DEFAULT_APP_SETTINGS.supportPhone)],
    ['whatsapp_number', cleanText(settings.whatsappNumber, DEFAULT_APP_SETTINGS.whatsappNumber)],
    ['business_hours', businessHours],
    ['business_hours_schedule', businessSchedule],
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
    ['home_announcement_type', normalizeAnnouncementType(settings.homeAnnouncementType, DEFAULT_APP_SETTINGS.homeAnnouncementType)],
    ['home_announcement_title', cleanText(settings.homeAnnouncementTitle, DEFAULT_APP_SETTINGS.homeAnnouncementTitle)],
    ['home_announcement_text', cleanText(settings.homeAnnouncementText, DEFAULT_APP_SETTINGS.homeAnnouncementText)],
    ['home_announcement_cta_label', cleanText(settings.homeAnnouncementCtaLabel)],
    ['home_announcement_link', cleanText(settings.homeAnnouncementLink)],
    ['home_announcement_start_at', cleanText(settings.homeAnnouncementStartAt)],
    ['home_announcement_end_at', cleanText(settings.homeAnnouncementEndAt)],
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


export const CUSTOMER_MAINTENANCE_ERROR =
  'Shop2Bhutan is currently under maintenance. Please try again later.';

export const NEW_SHOPPING_REQUESTS_PAUSED_ERROR =
  'New shopping requests are temporarily paused. You can still view existing orders and payments.';

export async function assertCustomerAppAvailable(): Promise<AppSettings> {
  const settings = await fetchPublicAppSettings();

  if (settings.maintenanceEnabled) {
    const detail = cleanText(settings.maintenanceMessage);
    throw new Error(detail || CUSTOMER_MAINTENANCE_ERROR);
  }

  return settings;
}

export async function assertNewShoppingRequestsAllowed(): Promise<AppSettings> {
  const settings = await assertCustomerAppAvailable();

  if (!settings.orderAcceptanceEnabled) {
    throw new Error(NEW_SHOPPING_REQUESTS_PAUSED_ERROR);
  }

  return settings;
}



export async function saveCoreAppSettings(
  settings: AppSettings,
  userId?: string | null,
): Promise<AppSettings> {
  const businessHoursError = validateBusinessHoursSchedule(
    settings.businessSchedule,
  );

  if (businessHoursError) {
    throw new Error(businessHoursError);
  }

  const rows = toRows(settings, userId).filter(
    (row) => !HOME_ANNOUNCEMENT_SETTING_KEYS.has(row.key),
  );

  const { error } = await supabase
    .from(SETTINGS_TABLE)
    .upsert(rows, { onConflict: 'key' });

  if (error) {
    if (isMissingSettingsTableError(error)) {
      throw new Error('App settings table is missing. Please run the Step 05 App Settings SQL first.');
    }
    throw error;
  }

  window.dispatchEvent(new CustomEvent('shop2bhutan:app-settings-updated'));
  return fetchPublicAppSettings();
}

export async function saveHomeAnnouncementSettings(
  settings: AppSettings,
  userId?: string | null,
): Promise<AppSettings> {
  const announcementError = validateHomeAnnouncement(settings);
  if (announcementError) {
    throw new Error(announcementError);
  }

  const rows = toRows(settings, userId).filter((row) =>
    HOME_ANNOUNCEMENT_SETTING_KEYS.has(row.key),
  );

  const { error } = await supabase
    .from(SETTINGS_TABLE)
    .upsert(rows, { onConflict: 'key' });

  if (error) {
    if (isMissingSettingsTableError(error)) {
      throw new Error('App settings table is missing. Please run the Step 05 App Settings SQL first.');
    }
    throw error;
  }

  window.dispatchEvent(new CustomEvent('shop2bhutan:app-settings-updated'));
  return fetchPublicAppSettings();
}

export async function saveAppSettings(settings: AppSettings, userId?: string | null): Promise<AppSettings> {
  const businessHoursError = validateBusinessHoursSchedule(
    settings.businessSchedule,
  );

  if (businessHoursError) {
    throw new Error(businessHoursError);
  }

  const announcementError = validateHomeAnnouncement(settings);
  if (announcementError) {
    throw new Error(announcementError);
  }

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
