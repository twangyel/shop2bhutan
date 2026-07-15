import { useCallback, useEffect, useRef, useState, type ChangeEvent, type ElementType, type ReactNode } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Image,
  Loader2,
  Megaphone,
  Phone,
  Save,
  Settings,
  ShoppingBag,
  Wrench,
} from 'lucide-react';
import Logo from '@/components/shared/Logo';
import { useAuth } from '@/contexts/AuthContext';
import {
  BUSINESS_DAY_LABELS,
  BUSINESS_DAY_ORDER,
  DEFAULT_APP_SETTINGS,
  fetchPublicAppSettings,
  formatBusinessHoursSummary,
  saveAppSettings,
  uploadAppLogo,
  validateBusinessHoursSchedule,
} from '@/lib/appSettings';
import type {
  AcceptedPlatformKey,
  AppSettings as AppSettingsType,
  BusinessDayHours,
  BusinessDayKey,
} from '@/types';

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const loaded = await fetchPublicAppSettings();
      setSettings(loaded);
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
      const saved = await saveAppSettings(settings, user?.id);
      setSettings(saved);
      setSuccess('App settings saved successfully.');
    } catch (err) {
      console.error('Failed to save app settings:', err);
      setError(err instanceof Error ? err.message : 'Unable to save app settings.');
    } finally {
      setSaving(false);
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

      <SettingCard title="Home Announcement" icon={Megaphone}>
        <div className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-gray-900">Show Announcement</p>
            <p className="text-xs text-neutral-500">Display a small notice on the customer home page.</p>
          </div>
          <ToggleSwitch checked={settings.homeAnnouncementEnabled} onChange={(value) => updateSetting('homeAnnouncementEnabled', value)} />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Announcement Text</label>
          <textarea
            value={settings.homeAnnouncementText}
            onChange={(event) => updateSetting('homeAnnouncementText', event.target.value)}
            rows={3}
            className="mt-1.5 w-full resize-none rounded-lg border border-neutral-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
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
