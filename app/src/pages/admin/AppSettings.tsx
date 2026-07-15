import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ElementType, type ReactNode } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle,
  BellRing,
  CircleDollarSign,
  Clock,
  Image,
  Loader2,
  Megaphone,
  Phone,
  Save,
  Send,
  Settings,
  ShoppingBag,
  Wrench,
} from 'lucide-react';
import Logo from '@/components/shared/Logo';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  BUSINESS_DAY_LABELS,
  BUSINESS_DAY_ORDER,
  DEFAULT_APP_SETTINGS,
  fetchPublicAppSettings,
  formatBusinessHoursSummary,
  saveAppSettings,
  uploadAppLogo,
  validateBusinessHoursSchedule,
  validateHomeAnnouncement,
} from '@/lib/appSettings';
import type {
  AcceptedPlatformKey,
  AppSettings as AppSettingsType,
  BusinessDayHours,
  BusinessDayKey,
  HomeAnnouncementType,
} from '@/types';

type ProfitSettings = {
  includeServiceCharge: boolean;
  includeDeliveryFee: boolean;
  verifiedPaymentsOnly: boolean;
};

type ProfitSettingRow = {
  key: string;
  value: unknown;
};

const DEFAULT_PROFIT_SETTINGS: ProfitSettings = {
  includeServiceCharge: true,
  includeDeliveryFee: true,
  verifiedPaymentsOnly: true,
};

const PROFIT_SETTING_KEYS = {
  includeServiceCharge: 'profit_include_service_charge',
  includeDeliveryFee: 'profit_include_delivery_fee',
  verifiedPaymentsOnly: 'profit_verified_payments_only',
} as const;

function booleanValue(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  const normalized = String(value ?? '').trim().toLowerCase();
  if (['true', '1', 'yes', 'on', 'enabled'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off', 'disabled'].includes(normalized)) return false;
  return fallback;
}

async function fetchProfitSettings(): Promise<ProfitSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('key,value')
    .in('key', Object.values(PROFIT_SETTING_KEYS));

  if (error) {
    // Keep the existing App Settings page usable when the settings table has
    // not been installed yet. The main loader will show its normal fallback.
    if (error.code === '42P01' || error.code === 'PGRST205') {
      return DEFAULT_PROFIT_SETTINGS;
    }
    throw error;
  }

  const rows = (data ?? []) as ProfitSettingRow[];
  const getValue = (key: string, fallback: boolean) =>
    booleanValue(rows.find((row) => row.key === key)?.value, fallback);

  return {
    includeServiceCharge: getValue(
      PROFIT_SETTING_KEYS.includeServiceCharge,
      DEFAULT_PROFIT_SETTINGS.includeServiceCharge,
    ),
    includeDeliveryFee: getValue(
      PROFIT_SETTING_KEYS.includeDeliveryFee,
      DEFAULT_PROFIT_SETTINGS.includeDeliveryFee,
    ),
    verifiedPaymentsOnly: getValue(
      PROFIT_SETTING_KEYS.verifiedPaymentsOnly,
      DEFAULT_PROFIT_SETTINGS.verifiedPaymentsOnly,
    ),
  };
}

async function saveProfitSettings(
  profitSettings: ProfitSettings,
  userId?: string | null,
) {
  const updatedAt = new Date().toISOString();
  const rows = [
    {
      key: PROFIT_SETTING_KEYS.includeServiceCharge,
      value: profitSettings.includeServiceCharge,
      updated_at: updatedAt,
      updated_by: userId || null,
    },
    {
      key: PROFIT_SETTING_KEYS.includeDeliveryFee,
      value: profitSettings.includeDeliveryFee,
      updated_at: updatedAt,
      updated_by: userId || null,
    },
    {
      key: PROFIT_SETTING_KEYS.verifiedPaymentsOnly,
      value: profitSettings.verifiedPaymentsOnly,
      updated_at: updatedAt,
      updated_by: userId || null,
    },
  ];

  const { error } = await supabase
    .from('app_settings')
    .upsert(rows, { onConflict: 'key' });

  if (error) throw error;

  window.dispatchEvent(
    new CustomEvent('shop2bhutan:profit-settings-updated'),
  );
}


type AdminDigestSettings = {
  enabled: boolean;
  hourBtt: number;
  sendOnlyWhenActions: boolean;
  quotationWarningHours: number;
  paymentWarningHours: number;
  parcelWarningHours: number;
};

type AppSettingRow = {
  key: string;
  value: unknown;
};

const DEFAULT_ADMIN_DIGEST_SETTINGS: AdminDigestSettings = {
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

function boundedNumber(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(numeric)));
}

async function fetchAdminDigestSettings(): Promise<AdminDigestSettings> {
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

  const rows = (data ?? []) as AppSettingRow[];
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

async function saveAdminDigestSettings(
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

function digestHourLabel(hour: number) {
  const normalized = boundedNumber(hour, 18, 0, 23);
  const date = new Date(2026, 0, 1, normalized, 0, 0);

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

const platformOptions: Array<{ key: AcceptedPlatformKey; label: string }> = [
  { key: 'amazon', label: 'Amazon' },
  { key: 'flipkart', label: 'Flipkart' },
  { key: 'myntra', label: 'Myntra' },
  { key: 'meesho', label: 'Meesho' },
];


const announcementTypeOptions: Array<{
  value: HomeAnnouncementType;
  label: string;
  description: string;
  cardClass: string;
  iconClass: string;
  badgeClass: string;
}> = [
  {
    value: 'announcement',
    label: 'Announcement',
    description: 'General service news or customer information.',
    cardClass: 'border-blue-100 bg-blue-50',
    iconClass: 'bg-white text-blue-600 ring-blue-100',
    badgeClass: 'bg-blue-100 text-blue-700',
  },
  {
    value: 'promotion',
    label: 'Promotion',
    description: 'Offers, discounts, launches, or campaigns.',
    cardClass: 'border-orange-100 bg-orange-50',
    iconClass: 'bg-white text-orange-600 ring-orange-100',
    badgeClass: 'bg-orange-100 text-orange-700',
  },
  {
    value: 'warning',
    label: 'Warning',
    description: 'Delays, service limitations, or urgent notices.',
    cardClass: 'border-amber-200 bg-amber-50',
    iconClass: 'bg-white text-amber-700 ring-amber-100',
    badgeClass: 'bg-amber-100 text-amber-800',
  },
  {
    value: 'advertisement',
    label: 'Advertisement',
    description: 'A promotional or sponsored partner card.',
    cardClass: 'border-violet-100 bg-violet-50',
    iconClass: 'bg-white text-violet-600 ring-violet-100',
    badgeClass: 'bg-violet-100 text-violet-700',
  },
];

function toDateTimeLocal(value: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDateTimeLocal(value: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function numberValue(value: string, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-amber-500' : 'bg-neutral-300'}`}
      aria-pressed={checked}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function SettingCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: ElementType;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-card">
      <div className="flex items-center gap-2 border-b border-neutral-100 px-5 py-4">
        <Icon size={18} className="text-neutral-500" />
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}

export default function AppSettings() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<AppSettingsType>(DEFAULT_APP_SETTINGS);
  const [profitSettings, setProfitSettings] = useState<ProfitSettings>(DEFAULT_PROFIT_SETTINGS);
  const [adminDigestSettings, setAdminDigestSettings] = useState<AdminDigestSettings>(DEFAULT_ADMIN_DIGEST_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [testingDigest, setTestingDigest] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [loaded, loadedProfitSettings, loadedAdminDigestSettings] = await Promise.all([
        fetchPublicAppSettings(),
        fetchProfitSettings(),
        fetchAdminDigestSettings(),
      ]);
      setSettings(loaded);
      setProfitSettings(loadedProfitSettings);
      setAdminDigestSettings(loadedAdminDigestSettings);
    } catch (err) {
      console.error('Failed to load app settings:', err);
      setError(err instanceof Error ? err.message : 'Unable to load app settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const updateSetting = <K extends keyof AppSettingsType>(key: K, value: AppSettingsType[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setSuccess('');
    setError('');
  };

  const updateProfitSetting = <K extends keyof ProfitSettings>(
    key: K,
    value: ProfitSettings[K],
  ) => {
    setProfitSettings((current) => ({ ...current, [key]: value }));
    setSuccess('');
    setError('');
  };

  const updateAdminDigestSetting = <K extends keyof AdminDigestSettings>(
    key: K,
    value: AdminDigestSettings[K],
  ) => {
    setAdminDigestSettings((current) => ({ ...current, [key]: value }));
    setSuccess('');
    setError('');
  };

  const updatePlatform = (key: AcceptedPlatformKey, value: boolean) => {
    setSettings((current) => ({
      ...current,
      acceptedPlatforms: {
        ...current.acceptedPlatforms,
        [key]: value,
      },
    }));
    setSuccess('');
    setError('');
  };

  const updateBusinessDay = (
    day: BusinessDayKey,
    patch: Partial<BusinessDayHours>,
  ) => {
    setSettings((current) => {
      const businessSchedule = {
        ...current.businessSchedule,
        [day]: {
          ...current.businessSchedule[day],
          ...patch,
        },
      };

      return {
        ...current,
        businessSchedule,
        businessHours: formatBusinessHoursSummary(businessSchedule),
      };
    });

    setSuccess('');
    setError('');
  };

  const applyMondayToWorkingWeek = () => {
    setSettings((current) => {
      const monday = current.businessSchedule.monday;
      const businessSchedule = {
        ...current.businessSchedule,
        tuesday: { ...monday },
        wednesday: { ...monday },
        thursday: { ...monday },
        friday: { ...monday },
        saturday: { ...monday },
      };

      return {
        ...current,
        businessSchedule,
        businessHours: formatBusinessHoursSummary(businessSchedule),
      };
    });

    setSuccess('');
    setError('');
  };

  const closeSunday = () => {
    updateBusinessDay('sunday', { enabled: false });
  };

  const handleSave = async () => {
    const businessHoursError = validateBusinessHoursSchedule(
      settings.businessSchedule,
    );

    if (businessHoursError) {
      setSuccess('');
      setError(businessHoursError);
      return;
    }

    const announcementError = validateHomeAnnouncement(settings);
    if (announcementError) {
      setSuccess('');
      setError(announcementError);
      return;
    }

    setSaving(true);
    setSuccess('');
    setError('');

    try {
      const [saved] = await Promise.all([
        saveAppSettings(settings, user?.id),
        saveProfitSettings(profitSettings, user?.id),
        saveAdminDigestSettings(adminDigestSettings, user?.id),
      ]);
      setSettings(saved);
      setSuccess('App settings, profit rules, and admin brief settings saved successfully.');
    } catch (err) {
      console.error('Failed to save app settings:', err);
      setError(err instanceof Error ? err.message : 'Unable to save app settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestDigest = async () => {
    if (testingDigest) return;

    setTestingDigest(true);
    setSuccess('');
    setError('');

    try {
      await saveAdminDigestSettings(adminDigestSettings, user?.id);

      const { data, error: invokeError } = await supabase.functions.invoke(
        'admin-digest',
        {
          body: {
            force: true,
            source: 'admin_settings',
          },
        },
      );

      if (invokeError) throw invokeError;

      const sent = Number((data as { sent?: number } | null)?.sent ?? 0);
      const reason = String(
        (data as { reason?: string } | null)?.reason ?? '',
      ).trim();

      if (sent > 0) {
        setSuccess(
          `Test admin brief created for ${sent} admin account${sent === 1 ? '' : 's'}.`,
        );
      } else {
        setSuccess(
          reason || 'The test completed, but no active admin notification target was found.',
        );
      }
    } catch (err) {
      console.error('Failed to send admin brief test:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to send the test admin brief.',
      );
    } finally {
      setTestingDigest(false);
    }
  };

  const handleLogoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    setSuccess('');
    setError('');

    try {
      const logoUrl = await uploadAppLogo(file);
      updateSetting('logoUrl', logoUrl);
      setSuccess('Logo uploaded. Click Save All Settings to apply it.');
    } catch (err) {
      console.error('Failed to upload logo:', err);
      setError(err instanceof Error ? err.message : 'Unable to upload logo.');
    } finally {
      setUploadingLogo(false);
      event.target.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-xl bg-white">
        <div className="text-center">
          <Loader2 size={26} className="mx-auto animate-spin text-amber-500" />
          <p className="mt-2 text-sm text-neutral-500">Loading app settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">App Settings</h2>
          <p className="text-sm text-neutral-500">Control global Shop2Bhutan behavior from one place.</p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || uploadingLogo}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save All Settings
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle size={17} className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <SettingCard title="App Logo" icon={Image}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-50 p-2">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Shop2Bhutan logo" className="max-h-full max-w-full object-contain" />
            ) : (
              <Logo size="lg" showText={false} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingLogo}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-neutral-100 px-4 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-200 disabled:opacity-60"
            >
              {uploadingLogo ? <Loader2 size={15} className="animate-spin" /> : <Image size={15} />}
              {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleLogoChange}
              className="hidden"
            />
            <p className="mt-1 text-xs text-neutral-400">Recommended: transparent PNG or SVG, less than 2MB.</p>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Logo URL</label>
          <input
            type="text"
            value={settings.logoUrl}
            onChange={(event) => updateSetting('logoUrl', event.target.value)}
            placeholder="/brand/logo-full-transparent.png"
            className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>
      </SettingCard>

      <SettingCard title="General" icon={Settings}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-gray-700">App Name</label>
            <input
              type="text"
              value={settings.appName}
              onChange={(event) => updateSetting('appName', event.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Contact Email</label>
            <input
              type="email"
              value={settings.supportEmail}
              onChange={(event) => updateSetting('supportEmail', event.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Contact Phone</label>
            <input
              type="tel"
              value={settings.supportPhone}
              onChange={(event) => updateSetting('supportPhone', event.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">WhatsApp Number</label>
            <input
              type="tel"
              value={settings.whatsappNumber}
              onChange={(event) => updateSetting('whatsappNumber', event.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
          <div className="md:col-span-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Business Hours
                </label>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Configure each day. Customer-facing text and open/closed
                  status are generated automatically in Bhutan Time.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={applyMondayToWorkingWeek}
                  className="h-8 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50"
                >
                  Apply Monday to Tue–Sat
                </button>
                <button
                  type="button"
                  onClick={closeSunday}
                  className="h-8 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50"
                >
                  Close Sunday
                </button>
              </div>
            </div>

            <div className="mt-3 overflow-hidden rounded-xl border border-neutral-200">
              {BUSINESS_DAY_ORDER.map((day, index) => {
                const hours = settings.businessSchedule[day];

                return (
                  <div
                    key={day}
                    className={`grid gap-3 px-3 py-3 sm:grid-cols-[130px_92px_1fr_1fr] sm:items-center ${
                      index < BUSINESS_DAY_ORDER.length - 1
                        ? 'border-b border-neutral-100'
                        : ''
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-900">
                      {BUSINESS_DAY_LABELS[day]}
                    </p>

                    <div className="flex items-center justify-between gap-2 sm:justify-start">
                      <ToggleSwitch
                        checked={hours.enabled}
                        onChange={(enabled) =>
                          updateBusinessDay(day, { enabled })
                        }
                      />
                      <span
                        className={`text-xs font-semibold ${
                          hours.enabled
                            ? 'text-emerald-600'
                            : 'text-neutral-400'
                        }`}
                      >
                        {hours.enabled ? 'Open' : 'Closed'}
                      </span>
                    </div>

                    <label>
                      <span className="text-[11px] font-medium text-neutral-400">
                        Opens
                      </span>
                      <input
                        type="time"
                        value={hours.open}
                        disabled={!hours.enabled}
                        onChange={(event) =>
                          updateBusinessDay(day, {
                            open: event.target.value,
                          })
                        }
                        className="mt-1 h-9 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500/20 disabled:bg-neutral-50 disabled:text-neutral-300"
                      />
                    </label>

                    <label>
                      <span className="text-[11px] font-medium text-neutral-400">
                        Closes
                      </span>
                      <input
                        type="time"
                        value={hours.close}
                        disabled={!hours.enabled}
                        onChange={(event) =>
                          updateBusinessDay(day, {
                            close: event.target.value,
                          })
                        }
                        className="mt-1 h-9 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500/20 disabled:bg-neutral-50 disabled:text-neutral-300"
                      />
                    </label>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5">
              <p className="text-xs font-semibold text-blue-700">
                Customer preview
              </p>
              <p className="mt-1 text-sm font-bold text-gray-900">
                {settings.businessHours}
              </p>
            </div>
          </div>
        </div>
      </SettingCard>

      <SettingCard title="Order Settings" icon={Clock}>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Quotation Validity (hours)</label>
            <input
              type="number"
              min="1"
              value={settings.quotationValidityHours}
              onChange={(event) => updateSetting('quotationValidityHours', numberValue(event.target.value, 48))}
              className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Auto-cancel Unquoted (days)</label>
            <input
              type="number"
              min="1"
              value={settings.autoCancelUnquotedDays}
              onChange={(event) => updateSetting('autoCancelUnquotedDays', numberValue(event.target.value, 7))}
              className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Max Items Per Order</label>
            <input
              type="number"
              min="1"
              value={settings.maxItemsPerOrder}
              onChange={(event) => updateSetting('maxItemsPerOrder', numberValue(event.target.value, 50))}
              className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Accept New Orders</p>
              <p className="text-xs text-neutral-500">Turn off during holidays or overload.</p>
            </div>
            <ToggleSwitch checked={settings.orderAcceptanceEnabled} onChange={(value) => updateSetting('orderAcceptanceEnabled', value)} />
          </div>
          <div className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Partial Payment</p>
              <p className="text-xs text-neutral-500">Allow advance payment before full payment.</p>
            </div>
            <ToggleSwitch checked={settings.partialPaymentEnabled} onChange={(value) => updateSetting('partialPaymentEnabled', value)} />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Minimum Advance Payment (%)</label>
          <input
            type="number"
            min="1"
            max="100"
            value={settings.minimumAdvancePaymentPercent}
            onChange={(event) => updateSetting('minimumAdvancePaymentPercent', numberValue(event.target.value, 50))}
            className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
          <p className="mt-1 text-xs text-neutral-500">Example: 50 means customer must pay at least 50% first.</p>
        </div>
      </SettingCard>

      <SettingCard title="Profit Calculation" icon={CircleDollarSign}>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Current formula
          </p>
          <p className="mt-1 text-sm font-bold text-gray-900">
            Estimated Gross Profit = enabled quotation charges
          </p>
          <p className="mt-1 text-xs leading-5 text-neutral-600">
            Product value is never counted as profit. The dashboard uses the
            service and delivery amounts saved with each quotation, so later fee
            changes do not alter old orders.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
            <div className="pr-4">
              <p className="text-sm font-semibold text-gray-900">
                Include Service Charge
              </p>
              <p className="text-xs text-neutral-500">
                Add the saved service charge to gross profit.
              </p>
            </div>
            <ToggleSwitch
              checked={profitSettings.includeServiceCharge}
              onChange={(value) =>
                updateProfitSetting('includeServiceCharge', value)
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
            <div className="pr-4">
              <p className="text-sm font-semibold text-gray-900">
                Include Delivery Charge
              </p>
              <p className="text-xs text-neutral-500">
                Add the saved delivery or pickup fee to gross profit.
              </p>
            </div>
            <ToggleSwitch
              checked={profitSettings.includeDeliveryFee}
              onChange={(value) =>
                updateProfitSetting('includeDeliveryFee', value)
              }
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
          <div className="pr-4">
            <p className="text-sm font-semibold text-gray-900">
              Verified Payments Only
            </p>
            <p className="text-xs leading-5 text-neutral-500">
              Recommended. Profit is counted only after at least one payment for
              the order has been verified.
            </p>
          </div>
          <ToggleSwitch
            checked={profitSettings.verifiedPaymentsOnly}
            onChange={(value) =>
              updateProfitSetting('verifiedPaymentsOnly', value)
            }
          />
        </div>

        {!profitSettings.includeServiceCharge &&
          !profitSettings.includeDeliveryFee && (
            <div className="flex items-start gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
              <span>
                Both profit sources are disabled, so the dashboard profit will
                show Nu. 0.
              </span>
            </div>
          )}
      </SettingCard>

      <SettingCard title="Shopping Platforms" icon={ShoppingBag}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {platformOptions.map((platform) => (
            <div key={platform.key} className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
              <span className="text-sm font-semibold text-gray-900">{platform.label}</span>
              <ToggleSwitch checked={settings.acceptedPlatforms[platform.key]} onChange={(value) => updatePlatform(platform.key, value)} />
            </div>
          ))}
        </div>
      </SettingCard>

      <SettingCard title="Currency" icon={Settings}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-gray-700">Currency Symbol</label>
            <input
              type="text"
              value={settings.currencySymbol}
              onChange={(event) => updateSetting('currencySymbol', event.target.value)}
              className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Decimal Places</label>
            <input
              type="number"
              min="0"
              max="2"
              value={settings.decimalPlaces}
              onChange={(event) => updateSetting('decimalPlaces', numberValue(event.target.value, 0))}
              className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
        </div>
      </SettingCard>

      <SettingCard title="Announcements & Promotions" icon={Megaphone}>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Show Customer Card</p>
            <p className="text-xs leading-5 text-neutral-500">
              Use one dynamic home card for announcements, offers, warnings, or advertisements.
            </p>
          </div>
          <ToggleSwitch
            checked={settings.homeAnnouncementEnabled}
            onChange={(value) => updateSetting('homeAnnouncementEnabled', value)}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-gray-700">Card Type</label>
            <select
              value={settings.homeAnnouncementType}
              onChange={(event) =>
                updateSetting(
                  'homeAnnouncementType',
                  event.target.value as HomeAnnouncementType,
                )
              }
              className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              {announcementTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-neutral-500">
              {announcementTypeOptions.find((option) => option.value === settings.homeAnnouncementType)?.description}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Card Title</label>
            <input
              type="text"
              value={settings.homeAnnouncementTitle}
              onChange={(event) =>
                updateSetting('homeAnnouncementTitle', event.target.value)
              }
              placeholder="50% off service charges"
              className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Message</label>
          <textarea
            value={settings.homeAnnouncementText}
            onChange={(event) => updateSetting('homeAnnouncementText', event.target.value)}
            rows={3}
            placeholder="Add clear details, eligibility, or validity information."
            className="mt-1.5 w-full resize-none rounded-lg border border-neutral-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-gray-700">Button Label <span className="font-normal text-neutral-400">(optional)</span></label>
            <input
              type="text"
              value={settings.homeAnnouncementCtaLabel}
              onChange={(event) =>
                updateSetting('homeAnnouncementCtaLabel', event.target.value)
              }
              placeholder="Shop now"
              className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Button Destination <span className="font-normal text-neutral-400">(optional)</span></label>
            <input
              type="text"
              value={settings.homeAnnouncementLink}
              onChange={(event) =>
                updateSetting('homeAnnouncementLink', event.target.value)
              }
              placeholder="/shop or https://example.com"
              className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
            <p className="mt-1 text-xs text-neutral-500">
              Internal destinations begin with /. External destinations must use https://.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-gray-700">Starts At <span className="font-normal text-neutral-400">(optional)</span></label>
            <input
              type="datetime-local"
              value={toDateTimeLocal(settings.homeAnnouncementStartAt)}
              onChange={(event) =>
                updateSetting(
                  'homeAnnouncementStartAt',
                  fromDateTimeLocal(event.target.value),
                )
              }
              className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Ends At <span className="font-normal text-neutral-400">(optional)</span></label>
            <input
              type="datetime-local"
              value={toDateTimeLocal(settings.homeAnnouncementEndAt)}
              onChange={(event) =>
                updateSetting(
                  'homeAnnouncementEndAt',
                  fromDateTimeLocal(event.target.value),
                )
              }
              className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
        </div>
        <p className="text-xs leading-5 text-neutral-500">
          Leave both dates blank to keep the card active until you turn it off. Scheduled and expired cards hide automatically.
        </p>

        {(() => {
          const preview =
            announcementTypeOptions.find(
              (option) => option.value === settings.homeAnnouncementType,
            ) || announcementTypeOptions[0];

          return (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Customer Preview</p>
              <div className={`rounded-2xl border p-4 ${preview.cardClass}`}>
                <div className="flex items-start gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${preview.iconClass}`}>
                    <Megaphone size={18} strokeWidth={2.2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${preview.badgeClass}`}>
                        {preview.label}
                      </span>
                      {settings.homeAnnouncementType === 'advertisement' && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Sponsored</span>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-bold text-neutral-950">
                      {settings.homeAnnouncementTitle || 'Card title'}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-neutral-600">
                      {settings.homeAnnouncementText || 'Card message will appear here.'}
                    </p>
                    {settings.homeAnnouncementCtaLabel && settings.homeAnnouncementLink && (
                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-neutral-900">
                        {settings.homeAnnouncementCtaLabel}
                        <ArrowUpRight size={13} />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </SettingCard>

      <SettingCard title="Admin Brief & Reminders" icon={BellRing}>
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Built for your 9–5 schedule
          </p>
          <p className="mt-1 text-sm font-bold text-gray-900">
            Receive one concise Shop2Bhutan action summary in Bhutan Time.
          </p>
          <p className="mt-1 text-xs leading-5 text-neutral-600">
            The brief checks quotations, pending payment proofs, delayed orders,
            and parcel requests. Opening the notification takes you directly to
            the Admin Action Centre.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
            <div className="pr-4">
              <p className="text-sm font-semibold text-gray-900">
                Daily Admin Brief
              </p>
              <p className="text-xs text-neutral-500">
                Create one in-app and push notification each day.
              </p>
            </div>
            <ToggleSwitch
              checked={adminDigestSettings.enabled}
              onChange={(value) =>
                updateAdminDigestSetting('enabled', value)
              }
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
            <div className="pr-4">
              <p className="text-sm font-semibold text-gray-900">
                Only When Action Is Needed
              </p>
              <p className="text-xs text-neutral-500">
                Skip quiet days when there is nothing pending.
              </p>
            </div>
            <ToggleSwitch
              checked={adminDigestSettings.sendOnlyWhenActions}
              onChange={(value) =>
                updateAdminDigestSetting('sendOnlyWhenActions', value)
              }
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-gray-700">
              Brief Delivery Time
            </label>
            <select
              value={adminDigestSettings.hourBtt}
              onChange={(event) =>
                updateAdminDigestSetting(
                  'hourBtt',
                  boundedNumber(event.target.value, 18, 0, 23),
                )
              }
              className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>
                  {digestHourLabel(hour)} BTT
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-neutral-500">
              Recommended: 6:00 PM BTT, after your office hours.
            </p>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Current schedule
            </p>
            <p className="mt-1 text-sm font-bold text-gray-900">
              {adminDigestSettings.enabled
                ? `${digestHourLabel(adminDigestSettings.hourBtt)} BTT daily`
                : 'Daily brief disabled'}
            </p>
            <p className="mt-1 text-xs leading-5 text-neutral-600">
              Supabase checks hourly, but sends only once on the configured
              Bhutan date and hour.
            </p>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-900">
            Reminder thresholds
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            These decide when pending work is highlighted as overdue in the
            daily brief.
          </p>

          <div className="mt-3 grid gap-4 md:grid-cols-3">
            <label>
              <span className="text-xs font-medium text-neutral-600">
                Quotation waiting
              </span>
              <div className="relative mt-1.5">
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={adminDigestSettings.quotationWarningHours}
                  onChange={(event) =>
                    updateAdminDigestSetting(
                      'quotationWarningHours',
                      boundedNumber(event.target.value, 12, 1, 168),
                    )
                  }
                  className="h-10 w-full rounded-lg border border-neutral-200 px-3 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">
                  hours
                </span>
              </div>
            </label>

            <label>
              <span className="text-xs font-medium text-neutral-600">
                Payment proof waiting
              </span>
              <div className="relative mt-1.5">
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={adminDigestSettings.paymentWarningHours}
                  onChange={(event) =>
                    updateAdminDigestSetting(
                      'paymentWarningHours',
                      boundedNumber(event.target.value, 12, 1, 168),
                    )
                  }
                  className="h-10 w-full rounded-lg border border-neutral-200 px-3 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">
                  hours
                </span>
              </div>
            </label>

            <label>
              <span className="text-xs font-medium text-neutral-600">
                Parcel request waiting
              </span>
              <div className="relative mt-1.5">
                <input
                  type="number"
                  min="1"
                  max="168"
                  value={adminDigestSettings.parcelWarningHours}
                  onChange={(event) =>
                    updateAdminDigestSetting(
                      'parcelWarningHours',
                      boundedNumber(event.target.value, 12, 1, 168),
                    )
                  }
                  className="h-10 w-full rounded-lg border border-neutral-200 px-3 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">
                  hours
                </span>
              </div>
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Test the complete flow
            </p>
            <p className="text-xs leading-5 text-neutral-500">
              Saves these brief settings, runs the Edge Function, creates an
              admin notification, and uses your existing push webhook.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSendTestDigest}
            disabled={testingDigest || saving}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {testingDigest ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            {testingDigest ? 'Sending...' : 'Send Test Brief'}
          </button>
        </div>
      </SettingCard>

      <SettingCard title="Maintenance Mode" icon={Wrench}>
        <div className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Enable Maintenance</p>
            <p className="text-xs text-neutral-500">Use only when the app should temporarily stop accepting users.</p>
          </div>
          <ToggleSwitch checked={settings.maintenanceEnabled} onChange={(value) => updateSetting('maintenanceEnabled', value)} />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Maintenance Message</label>
          <textarea
            value={settings.maintenanceMessage}
            onChange={(event) => updateSetting('maintenanceMessage', event.target.value)}
            rows={3}
            className="mt-1.5 w-full resize-none rounded-lg border border-neutral-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>
      </SettingCard>

      <SettingCard title="Contact Preview" icon={Phone}>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-700">Phone</p>
            <p className="mt-1 text-sm font-bold text-gray-900">{settings.supportPhone}</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-3">
            <p className="text-xs font-medium text-emerald-700">WhatsApp</p>
            <p className="mt-1 text-sm font-bold text-gray-900">{settings.whatsappNumber}</p>
          </div>
          <div className="rounded-xl bg-blue-50 p-3">
            <p className="text-xs font-medium text-blue-700">Hours</p>
            <p className="mt-1 text-sm font-bold text-gray-900">{settings.businessHours}</p>
          </div>
        </div>
      </SettingCard>

      <div className="flex justify-end pb-6">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || uploadingLogo}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-amber-500 px-6 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save All Settings
        </button>
      </div>
    </div>
  );
}
