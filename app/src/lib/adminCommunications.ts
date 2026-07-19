import { supabase } from '@/lib/supabase';
import type { NotificationType } from '@/types';

export type AdminDigestSettings = {
  enabled: boolean;
  hourBtt: number;
  sendOnlyWhenActions: boolean;
  quotationWarningHours: number;
  paymentWarningHours: number;
  parcelWarningHours: number;
};

export type CommunicationAudience = 'all_customers' | 'selected_customers';

export type CommunicationCustomer = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
};

export type BroadcastHistoryItem = {
  id: string;
  audience: CommunicationAudience;
  notificationType: NotificationType;
  title: string;
  message: string;
  link: string;
  imageUrl: string;
  recipientCount: number;
  notificationCount: number;
  failedCount: number;
  status: 'processing' | 'completed' | 'partial' | 'failed';
  errorMessage: string;
  createdAt: string;
};

export type SendBroadcastInput = {
  audience: CommunicationAudience;
  selectedUserIds?: string[];
  type: Extract<NotificationType, 'promotion' | 'system'>;
  title: string;
  message: string;
  link?: string;
  imageUrl?: string;
};

type SettingRow = {
  key: string;
  value: unknown;
};

type AnyRow = Record<string, unknown>;

export const DEFAULT_ADMIN_DIGEST_SETTINGS: AdminDigestSettings = {
  enabled: true,
  hourBtt: 18,
  sendOnlyWhenActions: true,
  quotationWarningHours: 12,
  paymentWarningHours: 12,
  parcelWarningHours: 12,
};

const ADMIN_DIGEST_SETTING_KEYS = {
  enabled: 'admin_digest_enabled',
  hourBtt: 'admin_digest_hour_btt',
  sendOnlyWhenActions: 'admin_digest_send_only_when_actions',
  quotationWarningHours: 'admin_digest_quotation_warning_hours',
  paymentWarningHours: 'admin_digest_payment_warning_hours',
  parcelWarningHours: 'admin_digest_parcel_warning_hours',
} as const;

const COMMUNICATIONS_BUCKET = 'app-assets';

function cleanText(value: unknown) {
  return String(value ?? '').trim();
}

function booleanValue(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  const normalized = cleanText(value).toLowerCase();
  if (['true', '1', 'yes', 'on', 'enabled'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off', 'disabled'].includes(normalized)) return false;
  return fallback;
}

export function boundedNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(numeric)));
}

export function digestHourLabel(hour: number) {
  const normalized = boundedNumber(hour, 18, 0, 23);
  const date = new Date(2026, 0, 1, normalized, 0, 0);

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export async function fetchAdminDigestSettings(): Promise<AdminDigestSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key,value')
    .in('key', Object.values(ADMIN_DIGEST_SETTING_KEYS));

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      return DEFAULT_ADMIN_DIGEST_SETTINGS;
    }
    throw error;
  }

  const rows = (data ?? []) as SettingRow[];
  const valueFor = (key: string) =>
    rows.find((row) => row.key === key)?.value;

  return {
    enabled: booleanValue(
      valueFor(ADMIN_DIGEST_SETTING_KEYS.enabled),
      DEFAULT_ADMIN_DIGEST_SETTINGS.enabled,
    ),
    hourBtt: boundedNumber(
      valueFor(ADMIN_DIGEST_SETTING_KEYS.hourBtt),
      DEFAULT_ADMIN_DIGEST_SETTINGS.hourBtt,
      0,
      23,
    ),
    sendOnlyWhenActions: booleanValue(
      valueFor(ADMIN_DIGEST_SETTING_KEYS.sendOnlyWhenActions),
      DEFAULT_ADMIN_DIGEST_SETTINGS.sendOnlyWhenActions,
    ),
    quotationWarningHours: boundedNumber(
      valueFor(ADMIN_DIGEST_SETTING_KEYS.quotationWarningHours),
      DEFAULT_ADMIN_DIGEST_SETTINGS.quotationWarningHours,
      1,
      168,
    ),
    paymentWarningHours: boundedNumber(
      valueFor(ADMIN_DIGEST_SETTING_KEYS.paymentWarningHours),
      DEFAULT_ADMIN_DIGEST_SETTINGS.paymentWarningHours,
      1,
      168,
    ),
    parcelWarningHours: boundedNumber(
      valueFor(ADMIN_DIGEST_SETTING_KEYS.parcelWarningHours),
      DEFAULT_ADMIN_DIGEST_SETTINGS.parcelWarningHours,
      1,
      168,
    ),
  };
}

export async function saveAdminDigestSettings(
  digestSettings: AdminDigestSettings,
  userId?: string | null,
) {
  const updatedAt = new Date().toISOString();
  const rows = [
    {
      key: ADMIN_DIGEST_SETTING_KEYS.enabled,
      value: digestSettings.enabled,
      updated_at: updatedAt,
      updated_by: userId || null,
    },
    {
      key: ADMIN_DIGEST_SETTING_KEYS.hourBtt,
      value: boundedNumber(digestSettings.hourBtt, 18, 0, 23),
      updated_at: updatedAt,
      updated_by: userId || null,
    },
    {
      key: ADMIN_DIGEST_SETTING_KEYS.sendOnlyWhenActions,
      value: digestSettings.sendOnlyWhenActions,
      updated_at: updatedAt,
      updated_by: userId || null,
    },
    {
      key: ADMIN_DIGEST_SETTING_KEYS.quotationWarningHours,
      value: boundedNumber(digestSettings.quotationWarningHours, 12, 1, 168),
      updated_at: updatedAt,
      updated_by: userId || null,
    },
    {
      key: ADMIN_DIGEST_SETTING_KEYS.paymentWarningHours,
      value: boundedNumber(digestSettings.paymentWarningHours, 12, 1, 168),
      updated_at: updatedAt,
      updated_by: userId || null,
    },
    {
      key: ADMIN_DIGEST_SETTING_KEYS.parcelWarningHours,
      value: boundedNumber(digestSettings.parcelWarningHours, 12, 1, 168),
      updated_at: updatedAt,
      updated_by: userId || null,
    },
  ];

  const { error } = await supabase
    .from('app_settings')
    .upsert(rows, { onConflict: 'key' });

  if (error) throw error;
}

export async function sendTestAdminDigest() {
  const { data, error } = await supabase.functions.invoke('admin-digest', {
    body: {
      force: true,
      source: 'admin_communications',
    },
  });

  if (error) throw error;

  return {
    sent: Number((data as { sent?: number } | null)?.sent ?? 0),
    reason: cleanText((data as { reason?: string } | null)?.reason),
  };
}

export async function fetchCommunicationCustomers(): Promise<CommunicationCustomer[]> {
  // user_roles has two foreign keys back to profiles (user_id and created_by).
  // Querying it as an embedded relation is therefore ambiguous in PostgREST.
  // Load customer IDs first, then fetch the matching active profiles.
  const { data: roleRows, error: roleError } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'customer')
    .limit(1000);

  if (roleError) throw roleError;

  const customerIds = Array.from(
    new Set(
      ((roleRows ?? []) as AnyRow[])
        .map((row) => cleanText(row.user_id))
        .filter(Boolean),
    ),
  );

  if (customerIds.length === 0) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id,full_name,phone,email')
    .in('id', customerIds)
    .eq('is_active', true)
    .eq('account_status', 'active')
    .order('full_name', { ascending: true })
    .limit(1000);

  if (error) throw error;

  return ((data ?? []) as AnyRow[]).map((row) => ({
    id: cleanText(row.id),
    fullName: cleanText(row.full_name) || 'Customer',
    phone: cleanText(row.phone),
    email: cleanText(row.email),
  }));
}

export async function uploadCommunicationImage(file: File): Promise<string> {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Please upload a PNG, JPG, or WEBP image.');
  }

  if (file.size > 4 * 1024 * 1024) {
    throw new Error('Promotion image must be less than 4 MB.');
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const safeName = file.name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'promotion';
  const path = `communications/${Date.now()}-${safeName}.${extension}`;

  const { error } = await supabase.storage
    .from(COMMUNICATIONS_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from(COMMUNICATIONS_BUCKET)
    .getPublicUrl(path);

  const publicUrl = cleanText(data.publicUrl);
  if (!publicUrl) throw new Error('Image uploaded, but its public URL is unavailable.');
  return publicUrl;
}

export async function sendNotificationBroadcast(input: SendBroadcastInput) {
  const { data, error } = await supabase.functions.invoke('notification-broadcast', {
    body: {
      audience: input.audience,
      selected_user_ids: input.selectedUserIds ?? [],
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link || '',
      image_url: input.imageUrl || '',
    },
  });

  if (error) throw error;

  const result = (data ?? {}) as {
    ok?: boolean;
    broadcast_id?: string;
    recipients?: number;
    notifications_created?: number;
    failed?: number;
    error?: string;
  };

  if (result.error) throw new Error(result.error);

  return {
    broadcastId: cleanText(result.broadcast_id),
    recipients: Number(result.recipients ?? 0),
    notificationsCreated: Number(result.notifications_created ?? 0),
    failed: Number(result.failed ?? 0),
  };
}

export async function fetchBroadcastHistory(): Promise<BroadcastHistoryItem[]> {
  const { data, error } = await supabase
    .from('notification_broadcasts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') return [];
    throw error;
  }

  return ((data ?? []) as AnyRow[]).map((row) => ({
    id: cleanText(row.id),
    audience: (cleanText(row.audience) || 'all_customers') as CommunicationAudience,
    notificationType: (cleanText(row.notification_type) || 'system') as NotificationType,
    title: cleanText(row.title),
    message: cleanText(row.message),
    link: cleanText(row.link),
    imageUrl: cleanText(row.image_url),
    recipientCount: Number(row.recipient_count ?? 0),
    notificationCount: Number(row.notification_count ?? 0),
    failedCount: Number(row.failed_count ?? 0),
    status: (cleanText(row.status) || 'completed') as BroadcastHistoryItem['status'],
    errorMessage: cleanText(row.error_message),
    createdAt: cleanText(row.created_at),
  }));
}
