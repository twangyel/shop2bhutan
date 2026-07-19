import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ElementType, type ReactNode } from 'react';
import {
  AlertCircle,
  ChevronDown,
  Bot,
  CircleDollarSign,
  Clock,
  Image,
  Loader2,
  Phone,
  Save,
  Sparkles,
  Settings,
  ShoppingBag,
  Wrench,
} from 'lucide-react';
import Logo from '@/components/shared/Logo';
import { useAppToast } from '@/components/shared/AppToast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  BUSINESS_DAY_LABELS,
  BUSINESS_DAY_ORDER,
  DEFAULT_APP_SETTINGS,
  fetchPublicAppSettings,
  formatBusinessHoursSummary,
  saveCoreAppSettings,
  uploadAppLogo,
  validateBusinessHoursSchedule,
} from '@/lib/appSettings';
import {
  DEFAULT_ADMIN_AI_SETTINGS,
  fetchAdminAiSettings,
  fetchAdminAiUsage,
  saveAdminAiSettings,
  testAdminAiAssistant,
  type AdminAiSettings,
  type AdminAiTone,
  type AdminAiUsage,
} from '@/lib/adminAiAssistant';
import type {
  AcceptedPlatformKey,
  AppSettings as AppSettingsType,
  BusinessDayHours,
  BusinessDayKey,
} from '@/types';

type ProfitSettings = {
  includeServiceCharge: boolean;
  includeDeliveryFee: boolean;
  verifiedPaymentsOnly: boolean;
  monthlyTarget: number;
};

type ProfitSettingRow = {
  key: string;
  value: unknown;
};

const DEFAULT_PROFIT_SETTINGS: ProfitSettings = {
  includeServiceCharge: true,
  includeDeliveryFee: true,
  verifiedPaymentsOnly: true,
  monthlyTarget: 10000,
};

const PROFIT_SETTING_KEYS = {
  includeServiceCharge: 'profit_include_service_charge',
  includeDeliveryFee: 'profit_include_delivery_fee',
  verifiedPaymentsOnly: 'profit_verified_payments_only',
  monthlyTarget: 'profit_monthly_target',
} as const;

function booleanValue(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  const normalized = String(value ?? '').trim().toLowerCase();
  if (['true', '1', 'yes', 'on', 'enabled'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off', 'disabled'].includes(normalized)) return false;
  return fallback;
}

function numericSettingValue(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
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
    monthlyTarget: numericSettingValue(
      rows.find(
        (row) => row.key === PROFIT_SETTING_KEYS.monthlyTarget,
      )?.value,
      DEFAULT_PROFIT_SETTINGS.monthlyTarget,
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
    {
      key: PROFIT_SETTING_KEYS.monthlyTarget,
      value: Math.max(0, Number(profitSettings.monthlyTarget) || 0),
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

const platformOptions: Array<{ key: AcceptedPlatformKey; label: string }> = [
  { key: 'amazon', label: 'Amazon' },
  { key: 'flipkart', label: 'Flipkart' },
  { key: 'myntra', label: 'Myntra' },
  { key: 'meesho', label: 'Meesho' },
];


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

function settingSectionStorageKey(title: string) {
  return `shop2bhutan:admin-settings-section:${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}`;
}

function initialSettingCardOpen(title: string) {
  if (typeof window === 'undefined') return true;

  try {
    const saved = window.localStorage.getItem(settingSectionStorageKey(title));
    if (saved === 'open') return true;
    if (saved === 'closed') return false;
  } catch {
    // Local storage is optional. Fall back to the responsive default.
  }

  // Keep the full desktop settings view familiar, while starting sections
  // collapsed on phones so admins do not need to scroll through every form.
  return window.matchMedia('(min-width: 768px)').matches;
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
  const [open, setOpen] = useState(() => initialSettingCardOpen(title));
  const contentId = `settings-section-${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}`;

  useEffect(() => {
    try {
      window.localStorage.setItem(
        settingSectionStorageKey(title),
        open ? 'open' : 'closed',
      );
    } catch {
      // Keep collapse/expand working even when storage is unavailable.
    }
  }, [open, title]);

  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-card">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={contentId}
        className={`flex w-full items-center gap-3 px-4 py-4 text-left transition-colors sm:px-5 ${
          open ? 'border-b border-neutral-100 bg-white' : 'hover:bg-neutral-50'
        }`}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-50 text-neutral-500">
          <Icon size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-gray-900">{title}</span>
          <span className="mt-0.5 block text-[11px] font-medium text-neutral-400 md:hidden">
            {open ? 'Tap to collapse' : 'Tap to open'}
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-neutral-400 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div id={contentId} className="space-y-4 p-4 sm:p-5">
          {children}
        </div>
      )}
    </section>
  );
}


function adminToastTitle(message: string, type: 'success' | 'error') {
  const normalized = message.toLowerCase();

  if (type === 'error') {
    if (normalized.includes('business hour')) return 'Check business hours';
    if (normalized.includes('announcement')) return 'Check announcement';
    if (normalized.includes('ai')) return 'AI assistant unavailable';
    if (normalized.includes('brief')) return 'Admin brief failed';
    if (normalized.includes('logo')) return 'Logo upload failed';
    return 'Unable to complete action';
  }

  if (normalized.includes('logo uploaded')) return 'Logo uploaded';
  if (normalized.includes('ai connection')) return 'AI connection confirmed';
  if (normalized.includes('admin brief') || normalized.includes('test completed')) {
    return 'Admin brief complete';
  }

  return 'Settings updated';
}

export default function AppSettings() {
  const { user } = useAuth();
  const { showToast } = useAppToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<AppSettingsType>(DEFAULT_APP_SETTINGS);
  const [profitSettings, setProfitSettings] = useState<ProfitSettings>(DEFAULT_PROFIT_SETTINGS);
  const [adminAiSettings, setAdminAiSettings] = useState<AdminAiSettings>(DEFAULT_ADMIN_AI_SETTINGS);
  const [adminAiUsage, setAdminAiUsage] = useState<AdminAiUsage | null>(null);
  const [adminAiUsageError, setAdminAiUsageError] = useState('');
  const [loadingAiUsage, setLoadingAiUsage] = useState(false);
  const [testingAdminAi, setTestingAdminAi] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!success) return;

    showToast({
      type: 'success',
      title: adminToastTitle(success, 'success'),
      message: success,
    });
  }, [showToast, success]);

  useEffect(() => {
    if (!error) return;

    showToast({
      type: 'error',
      title: adminToastTitle(error, 'error'),
      message: error,
    });
  }, [error, showToast]);


  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [
        loaded,
        loadedProfitSettings,
        loadedAdminAiSettings,
      ] = await Promise.all([
        fetchPublicAppSettings(),
        fetchProfitSettings(),
        fetchAdminAiSettings(),
      ]);
      setSettings(loaded);
      setProfitSettings(loadedProfitSettings);
      setAdminAiSettings(loadedAdminAiSettings);

      try {
        const usage = await fetchAdminAiUsage();
        setAdminAiUsage(usage);
        setAdminAiUsageError('');
      } catch (usageError) {
        console.warn('[AppSettings] AI usage unavailable:', usageError);
        setAdminAiUsage(null);
        setAdminAiUsageError(
          usageError instanceof Error
            ? usageError.message
            : 'AI usage is unavailable until the Edge Function is deployed.',
        );
      }
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

  const updateAdminAiSetting = <K extends keyof AdminAiSettings>(
    key: K,
    value: AdminAiSettings[K],
  ) => {
    setAdminAiSettings((current) => ({ ...current, [key]: value }));
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

    setSaving(true);
    setSuccess('');
    setError('');

    try {
      const [saved] = await Promise.all([
        saveCoreAppSettings(settings, user?.id),
        saveProfitSettings(profitSettings, user?.id),
        saveAdminAiSettings(adminAiSettings, user?.id),
      ]);
      setSettings(saved);
      setSuccess('Your Shop2Bhutan settings were saved successfully.');
    } catch (err) {
      console.error('Failed to save app settings:', err);
      setError(err instanceof Error ? err.message : 'Unable to save app settings.');
    } finally {
      setSaving(false);
    }
  };

  const refreshAdminAiUsage = async () => {
    if (loadingAiUsage) return;

    setLoadingAiUsage(true);
    setAdminAiUsageError('');

    try {
      const usage = await fetchAdminAiUsage();
      setAdminAiUsage(usage);
    } catch (usageError) {
      setAdminAiUsageError(
        usageError instanceof Error
          ? usageError.message
          : 'Unable to load AI usage.',
      );
    } finally {
      setLoadingAiUsage(false);
    }
  };

  const handleTestAdminAi = async () => {
    if (testingAdminAi) return;

    setTestingAdminAi(true);
    setSuccess('');
    setError('');

    try {
      await saveAdminAiSettings(adminAiSettings, user?.id);
      const result = await testAdminAiAssistant();

      if (!result.customerMessage) {
        throw new Error('The AI test returned an empty response.');
      }

      if (result.usage) setAdminAiUsage(result.usage);
      setAdminAiUsageError('');
      setSuccess('AI connection is working. A safe sample customer message was generated successfully.');
    } catch (testError) {
      console.error('Failed to test admin AI assistant:', testError);
      setError(
        testError instanceof Error
          ? testError.message
          : 'Unable to test the AI assistant.',
      );
    } finally {
      setTestingAdminAi(false);
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
          <p className="text-sm text-neutral-500">Control core Shop2Bhutan behavior. Customer communications are managed from Notifications & Promotions.</p>
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

        <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3">
          <label className="text-sm font-semibold text-gray-900">
            Monthly Net Profit Target (Nu.)
          </label>
          <input
            type="number"
            min="0"
            step="500"
            value={profitSettings.monthlyTarget}
            onChange={(event) =>
              updateProfitSetting(
                'monthlyTarget',
                Math.max(0, numberValue(event.target.value, 10000)),
              )
            }
            className="mt-2 h-10 w-full rounded-lg border border-violet-200 bg-white px-3 text-sm font-bold text-neutral-900 outline-none focus:ring-2 focus:ring-violet-500/15"
          />
          <p className="mt-1 text-xs leading-5 text-neutral-500">
            Used by the Profit & Trip Tracker to show monthly target progress.
          </p>
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

      <SettingCard title="AI Admin Assistant" icon={Bot}>
        <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
            Optional real AI polishing
          </p>
          <p className="mt-1 text-sm font-bold text-gray-900">
            Improve customer replies, summaries, risk explanations, and quotation notes.
          </p>
          <p className="mt-1 text-xs leading-5 text-neutral-600">
            AI runs only after an admin presses an AI button. Rule-based checks remain available when AI is disabled or unavailable.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
            <div className="pr-4">
              <p className="text-sm font-semibold text-gray-900">Enable AI Assistant</p>
              <p className="text-xs leading-5 text-neutral-500">
                Allows admin-only, button-triggered AI drafting.
              </p>
            </div>
            <ToggleSwitch
              checked={adminAiSettings.enabled}
              onChange={(value) => updateAdminAiSetting('enabled', value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
            <div className="pr-4">
              <p className="text-sm font-semibold text-gray-900">Include Customer First Name</p>
              <p className="text-xs leading-5 text-neutral-500">
                Sends only the first name to the AI for a natural greeting.
              </p>
            </div>
            <ToggleSwitch
              checked={adminAiSettings.includeCustomerName}
              onChange={(value) =>
                updateAdminAiSetting('includeCustomerName', value)
              }
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-sm font-medium text-gray-700">Writing Tone</label>
            <select
              value={adminAiSettings.tone}
              onChange={(event) =>
                updateAdminAiSetting('tone', event.target.value as AdminAiTone)
              }
              className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            >
              <option value="professional_friendly">Professional &amp; friendly</option>
              <option value="concise">Concise</option>
              <option value="warm">Warm &amp; reassuring</option>
              <option value="formal">Formal</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Daily Request Limit</label>
            <input
              type="number"
              min="1"
              max="100"
              value={adminAiSettings.dailyLimit}
              onChange={(event) =>
                updateAdminAiSetting(
                  'dailyLimit',
                  boundedNumber(event.target.value, 20, 1, 100),
                )
              }
              className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
            <p className="mt-1 text-xs text-neutral-500">Controls cost and accidental overuse.</p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Maximum Output Characters</label>
            <input
              type="number"
              min="200"
              max="2000"
              step="100"
              value={adminAiSettings.maxOutputChars}
              onChange={(event) =>
                updateAdminAiSetting(
                  'maxOutputChars',
                  boundedNumber(event.target.value, 800, 200, 2000),
                )
              }
              className="mt-1.5 h-10 w-full rounded-lg border border-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
            <p className="mt-1 text-xs text-neutral-500">Recommended: 800 characters.</p>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-100 bg-neutral-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">AI Usage</p>
              <p className="text-xs leading-5 text-neutral-500">
                Request counts are tracked per admin in Bhutan Time. Token totals are informational.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refreshAdminAiUsage()}
              disabled={loadingAiUsage}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-60"
            >
              {loadingAiUsage ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              Refresh Usage
            </button>
          </div>

          {adminAiUsage ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-white px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Today</p>
                <p className="mt-1 text-lg font-bold text-gray-900">
                  {adminAiUsage.todayCount} / {adminAiUsage.dailyLimit}
                </p>
              </div>
              <div className="rounded-lg bg-white px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">This month</p>
                <p className="mt-1 text-lg font-bold text-gray-900">{adminAiUsage.monthCount}</p>
              </div>
              <div className="rounded-lg bg-white px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Input tokens</p>
                <p className="mt-1 text-lg font-bold text-gray-900">{adminAiUsage.inputTokens.toLocaleString()}</p>
              </div>
              <div className="rounded-lg bg-white px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Model</p>
                <p className="mt-1 truncate text-sm font-bold text-gray-900">{adminAiUsage.model || 'Configured in Edge Function'}</p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs leading-5 text-neutral-500">
              {adminAiUsageError || 'Deploy the AI Edge Function and usage SQL to display usage.'}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">Test the AI connection</p>
            <p className="text-xs leading-5 text-neutral-500">
              Saves these settings and generates one safe sample message. This uses one request from the daily limit.
            </p>
          </div>
          <button
            type="button"
            onClick={handleTestAdminAi}
            disabled={testingAdminAi || saving || !adminAiSettings.enabled}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {testingAdminAi ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} />
            )}
            {testingAdminAi ? 'Testing...' : 'Test AI Assistant'}
          </button>
        </div>

        <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
          AI never verifies payments, changes order status, calculates quotation totals, sends final prices, cancels orders, issues refunds, or contacts customers without your explicit action.
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
