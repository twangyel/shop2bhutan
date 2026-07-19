import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  BellRing,
  Check,
  History,
  ImagePlus,
  Loader2,
  Megaphone,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppToast } from '@/components/shared/AppToast';
import {
  DEFAULT_APP_SETTINGS,
  fetchPublicAppSettings,
  saveHomeAnnouncementSettings,
  validateHomeAnnouncement,
} from '@/lib/appSettings';
import {
  DEFAULT_ADMIN_DIGEST_SETTINGS,
  boundedNumber,
  digestHourLabel,
  fetchAdminDigestSettings,
  fetchBroadcastHistory,
  fetchCommunicationCustomers,
  saveAdminDigestSettings,
  sendNotificationBroadcast,
  sendTestAdminDigest,
  uploadCommunicationImage,
  type AdminDigestSettings,
  type BroadcastHistoryItem,
  type CommunicationAudience,
  type CommunicationCustomer,
} from '@/lib/adminCommunications';
import type {
  AppSettings,
  HomeAnnouncementType,
  NotificationType,
} from '@/types';

type TabKey = 'send' | 'announcement' | 'brief' | 'history';
type BroadcastType = Extract<NotificationType, 'promotion' | 'system'>;


function readableErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;

  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '').trim();
    if (message) return message;
  }

  return fallback;
}

const tabs: Array<{
  key: TabKey;
  label: string;
  icon: typeof Send;
  description: string;
}> = [
  {
    key: 'send',
    label: 'Send Notification',
    icon: Send,
    description: 'Send an in-app and push update to customers.',
  },
  {
    key: 'announcement',
    label: 'Announcements',
    icon: Megaphone,
    description: 'Manage the dynamic customer home card.',
  },
  {
    key: 'brief',
    label: 'Admin Brief',
    icon: BellRing,
    description: 'Configure your internal daily action reminder.',
  },
  {
    key: 'history',
    label: 'History',
    icon: History,
    description: 'Review broadcasts sent from this module.',
  },
];

const announcementTypeOptions: Array<{
  value: HomeAnnouncementType;
  label: string;
  description: string;
  cardClass: string;
  badgeClass: string;
}> = [
  {
    value: 'announcement',
    label: 'Announcement',
    description: 'General service news or customer information.',
    cardClass: 'border-blue-100 bg-blue-50',
    badgeClass: 'bg-blue-100 text-blue-700',
  },
  {
    value: 'promotion',
    label: 'Promotion',
    description: 'Offers, discounts, launches, or campaigns.',
    cardClass: 'border-orange-100 bg-orange-50',
    badgeClass: 'bg-orange-100 text-orange-700',
  },
  {
    value: 'warning',
    label: 'Warning',
    description: 'Delays, limitations, or urgent notices.',
    cardClass: 'border-amber-200 bg-amber-50',
    badgeClass: 'bg-amber-100 text-amber-800',
  },
  {
    value: 'advertisement',
    label: 'Advertisement',
    description: 'A promotional or sponsored partner card.',
    cardClass: 'border-violet-100 bg-violet-50',
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

function formatBttDateTime(value: string) {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';

  return `${new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Thimphu',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)} BTT`;
}

function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-50 ${
        checked ? 'bg-orange-500' : 'bg-neutral-300'
      }`}
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

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <h3 className="text-sm font-extrabold text-neutral-950">{title}</h3>
        {description && (
          <p className="mt-1 text-xs leading-5 text-neutral-500">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

export default function Communications() {
  const { user } = useAuth();
  const { showToast } = useAppToast();
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<TabKey>('send');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [digestSettings, setDigestSettings] = useState<AdminDigestSettings>(
    DEFAULT_ADMIN_DIGEST_SETTINGS,
  );
  const [customers, setCustomers] = useState<CommunicationCustomer[]>([]);
  const [history, setHistory] = useState<BroadcastHistoryItem[]>([]);

  const [audience, setAudience] =
    useState<CommunicationAudience>('all_customers');
  const [broadcastType, setBroadcastType] =
    useState<BroadcastType>('promotion');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);

  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [savingDigest, setSavingDigest] = useState(false);
  const [testingDigest, setTestingDigest] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const [loadedSettings, loadedDigest, loadedCustomers, loadedHistory] =
        await Promise.all([
          fetchPublicAppSettings(),
          fetchAdminDigestSettings(),
          fetchCommunicationCustomers(),
          fetchBroadcastHistory(),
        ]);

      setSettings(loadedSettings);
      setDigestSettings(loadedDigest);
      setCustomers(loadedCustomers);
      setHistory(loadedHistory);
    } catch (error) {
      console.error('[Communications] Failed to load:', error);
      showToast({
        type: 'error',
        title: 'Unable to load communications',
        message: readableErrorMessage(
          error,
          'Please check the database migration and try again.',
        ),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!confirmSend || typeof document === 'undefined') return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [confirmSend]);

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return customers;

    return customers.filter((customer) =>
      [customer.fullName, customer.phone, customer.email]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [customerSearch, customers]);

  const selectedCustomers = useMemo(() => {
    const selected = new Set(selectedCustomerIds);
    return customers.filter((customer) => selected.has(customer.id));
  }, [customers, selectedCustomerIds]);

  const recipientLabel =
    audience === 'all_customers'
      ? `${customers.length} active customer${customers.length === 1 ? '' : 's'}`
      : `${selectedCustomerIds.length} selected customer${selectedCustomerIds.length === 1 ? '' : 's'}`;

  const validateBroadcast = () => {
    const cleanTitle = title.trim();
    const cleanMessage = message.trim();
    const cleanLink = link.trim();

    if (!cleanTitle) return 'Notification title is required.';
    if (cleanTitle.length > 100) return 'Notification title must be 100 characters or fewer.';
    if (!cleanMessage) return 'Notification message is required.';
    if (cleanMessage.length > 500) return 'Notification message must be 500 characters or fewer.';
    if (
      audience === 'selected_customers' &&
      selectedCustomerIds.length === 0
    ) {
      return 'Select at least one customer.';
    }
    if (
      cleanLink &&
      !cleanLink.startsWith('/') &&
      !/^https:\/\//i.test(cleanLink)
    ) {
      return 'Action destination must start with / or https://.';
    }
    if (!customers.length) return 'No active customer accounts were found.';
    return '';
  };

  const requestSendConfirmation = () => {
    const validationError = validateBroadcast();
    if (validationError) {
      showToast({
        type: 'error',
        title: 'Check notification details',
        message: validationError,
      });
      return;
    }
    setConfirmSend(true);
  };

  const handleSend = async () => {
    if (sending) return;
    const validationError = validateBroadcast();
    if (validationError) {
      setConfirmSend(false);
      showToast({
        type: 'error',
        title: 'Check notification details',
        message: validationError,
      });
      return;
    }

    setSending(true);

    try {
      const result = await sendNotificationBroadcast({
        audience,
        selectedUserIds:
          audience === 'selected_customers' ? selectedCustomerIds : [],
        type: broadcastType,
        title: title.trim(),
        message: message.trim(),
        link: link.trim(),
        imageUrl,
      });

      setConfirmSend(false);
      setTitle('');
      setMessage('');
      setLink('');
      setImageUrl('');
      setSelectedCustomerIds([]);
      setAudience('all_customers');
      setBroadcastType('promotion');

      showToast({
        type: result.failed > 0 ? 'error' : 'success',
        title: result.failed > 0 ? 'Broadcast partly completed' : 'Notification sent',
        message: `${result.notificationsCreated} customer notification${result.notificationsCreated === 1 ? '' : 's'} created${result.failed > 0 ? `; ${result.failed} failed.` : '.'}`,
      });

      const updatedHistory = await fetchBroadcastHistory();
      setHistory(updatedHistory);
    } catch (error) {
      console.error('[Communications] Broadcast failed:', error);
      showToast({
        type: 'error',
        title: 'Unable to send notification',
        message:
          error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const uploadedUrl = await uploadCommunicationImage(file);
      setImageUrl(uploadedUrl);
      showToast({
        type: 'success',
        title: 'Image uploaded',
        message: 'The image will be included in this notification.',
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Image upload failed',
        message:
          error instanceof Error ? error.message : 'Please try another image.',
      });
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  };

  const updateAnnouncement = <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
  ) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const handleSaveAnnouncement = async () => {
    const validationError = validateHomeAnnouncement(settings);
    if (validationError) {
      showToast({
        type: 'error',
        title: 'Check announcement',
        message: validationError,
      });
      return;
    }

    setSavingAnnouncement(true);
    try {
      const saved = await saveHomeAnnouncementSettings(settings, user?.id);
      setSettings(saved);
      showToast({
        type: 'success',
        title: 'Announcement updated',
        message: 'The customer home card settings were saved.',
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Unable to save announcement',
        message:
          error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setSavingAnnouncement(false);
    }
  };

  const updateDigest = <K extends keyof AdminDigestSettings>(
    key: K,
    value: AdminDigestSettings[K],
  ) => {
    setDigestSettings((current) => ({ ...current, [key]: value }));
  };

  const handleSaveDigest = async () => {
    setSavingDigest(true);
    try {
      await saveAdminDigestSettings(digestSettings, user?.id);
      showToast({
        type: 'success',
        title: 'Admin brief updated',
        message: 'Your daily brief schedule and reminder thresholds were saved.',
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Unable to save admin brief',
        message:
          error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setSavingDigest(false);
    }
  };

  const handleTestDigest = async () => {
    if (testingDigest) return;
    setTestingDigest(true);

    try {
      await saveAdminDigestSettings(digestSettings, user?.id);
      const result = await sendTestAdminDigest();
      showToast({
        type: 'success',
        title: 'Admin brief test complete',
        message:
          result.sent > 0
            ? `Test brief created for ${result.sent} admin account${result.sent === 1 ? '' : 's'}.`
            : result.reason || 'No active admin target was found.',
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Admin brief test failed',
        message:
          error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setTestingDigest(false);
    }
  };

  const toggleCustomer = (customerId: string) => {
    setSelectedCustomerIds((current) =>
      current.includes(customerId)
        ? current.filter((id) => id !== customerId)
        : [...current, customerId],
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-2xl bg-white">
        <div className="text-center">
          <Loader2 size={28} className="mx-auto animate-spin text-orange-500" />
          <p className="mt-3 text-sm font-semibold text-neutral-500">
            Loading communications…
          </p>
        </div>
      </div>
    );
  }

  const announcementPreview =
    announcementTypeOptions.find(
      (option) => option.value === settings.homeAnnouncementType,
    ) || announcementTypeOptions[0];

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
              <Megaphone size={20} />
            </span>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-neutral-950">
                Notifications &amp; Promotions
              </h2>
              <p className="text-sm text-neutral-500">
                Send customer updates and manage communication settings.
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void loadData(true)}
          disabled={refreshing}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-bold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-neutral-200 bg-white p-2 lg:grid-cols-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex min-h-20 items-start gap-3 rounded-xl p-3 text-left transition ${
                active
                  ? 'bg-neutral-950 text-white shadow-lg shadow-neutral-950/10'
                  : 'text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              <Icon size={18} className="mt-0.5 shrink-0" />
              <span className="min-w-0">
                <span className="block text-xs font-extrabold sm:text-sm">
                  {tab.label}
                </span>
                <span
                  className={`mt-1 hidden text-[11px] leading-4 sm:block ${
                    active ? 'text-white/65' : 'text-neutral-400'
                  }`}
                >
                  {tab.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {activeTab === 'send' && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <div className="space-y-5">
            <Section
              title="Notification details"
              description="Every recipient receives an in-app notification. Push is delivered automatically to active devices."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-bold text-neutral-700">
                    Notification type
                  </label>
                  <select
                    value={broadcastType}
                    onChange={(event) =>
                      setBroadcastType(event.target.value as BroadcastType)
                    }
                    className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                  >
                    <option value="promotion">Promotion</option>
                    <option value="system">Announcement / service update</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-bold text-neutral-700">
                    Audience
                  </label>
                  <select
                    value={audience}
                    onChange={(event) =>
                      setAudience(event.target.value as CommunicationAudience)
                    }
                    className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                  >
                    <option value="all_customers">All active customers</option>
                    <option value="selected_customers">Selected customers</option>
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-bold text-neutral-700">
                    Title
                  </label>
                  <span className="text-[11px] font-semibold text-neutral-400">
                    {title.length}/100
                  </span>
                </div>
                <input
                  value={title}
                  maxLength={100}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Weekend shopping promotion"
                  className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-bold text-neutral-700">
                    Message
                  </label>
                  <span className="text-[11px] font-semibold text-neutral-400">
                    {message.length}/500
                  </span>
                </div>
                <textarea
                  value={message}
                  maxLength={500}
                  rows={4}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Add a concise message with the important details."
                  className="mt-1.5 w-full resize-none rounded-xl border border-neutral-200 p-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div className="mt-4">
                <label className="text-sm font-bold text-neutral-700">
                  Action destination{' '}
                  <span className="font-medium text-neutral-400">(optional)</span>
                </label>
                <input
                  value={link}
                  onChange={(event) => setLink(event.target.value)}
                  placeholder="/shop, /parcel, or https://…"
                  className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                />
                <p className="mt-1.5 text-xs text-neutral-400">
                  Internal destinations start with /. External destinations must use https://.
                </p>
              </div>
            </Section>

            <Section
              title="Promotion image"
              description="Optional. Recommended for promotions and major announcements. JPG, PNG or WEBP up to 4 MB."
            >
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleImageUpload}
              />

              {imageUrl ? (
                <div className="overflow-hidden rounded-2xl border border-neutral-200">
                  <div className="relative aspect-[16/9] bg-neutral-100">
                    <img
                      src={imageUrl}
                      alt="Notification preview"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-neutral-700 shadow-lg"
                      aria-label="Remove image"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="flex min-h-32 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-5 text-center transition hover:border-orange-300 hover:bg-orange-50/40 disabled:opacity-60"
                >
                  {uploadingImage ? (
                    <Loader2 size={24} className="animate-spin text-orange-500" />
                  ) : (
                    <ImagePlus size={25} className="text-neutral-400" />
                  )}
                  <span className="mt-2 text-sm font-extrabold text-neutral-800">
                    {uploadingImage ? 'Uploading image…' : 'Upload promotion image'}
                  </span>
                  <span className="mt-1 text-xs text-neutral-400">
                    A 16:9 image works best across the app and Android push.
                  </span>
                </button>
              )}
            </Section>

            {audience === 'selected_customers' && (
              <Section
                title="Select customers"
                description={`${selectedCustomerIds.length} customer${selectedCustomerIds.length === 1 ? '' : 's'} selected.`}
              >
                <div className="relative">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-3.5 text-neutral-400"
                  />
                  <input
                    value={customerSearch}
                    onChange={(event) => setCustomerSearch(event.target.value)}
                    placeholder="Search name, phone or email"
                    className="h-11 w-full rounded-xl border border-neutral-200 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>

                {selectedCustomers.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedCustomers.slice(0, 12).map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => toggleCustomer(customer.id)}
                        className="inline-flex items-center gap-1 rounded-full bg-neutral-950 px-3 py-1.5 text-[11px] font-bold text-white"
                      >
                        {customer.fullName}
                        <X size={12} />
                      </button>
                    ))}
                    {selectedCustomers.length > 12 && (
                      <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-[11px] font-bold text-neutral-500">
                        +{selectedCustomers.length - 12} more
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-3 max-h-80 divide-y divide-neutral-100 overflow-y-auto rounded-xl border border-neutral-200">
                  {filteredCustomers.length === 0 ? (
                    <p className="p-5 text-center text-sm text-neutral-400">
                      No matching customers.
                    </p>
                  ) : (
                    filteredCustomers.map((customer) => {
                      const selected = selectedCustomerIds.includes(customer.id);
                      return (
                        <button
                          key={customer.id}
                          type="button"
                          onClick={() => toggleCustomer(customer.id)}
                          className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-neutral-50"
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                              selected
                                ? 'border-orange-500 bg-orange-500 text-white'
                                : 'border-neutral-300 bg-white'
                            }`}
                          >
                            {selected && <Check size={13} strokeWidth={3} />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-neutral-900">
                              {customer.fullName}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-neutral-400">
                              {[customer.phone, customer.email]
                                .filter(Boolean)
                                .join(' • ') || 'No contact details'}
                            </span>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </Section>
            )}
          </div>

          <div className="space-y-5 xl:sticky xl:top-5 xl:self-start">
            <Section title="Customer preview">
              <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt="Promotion"
                    className="aspect-[16/9] w-full object-cover"
                  />
                )}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        broadcastType === 'promotion'
                          ? 'bg-orange-50 text-orange-600'
                          : 'bg-blue-50 text-blue-600'
                      }`}
                    >
                      {broadcastType === 'promotion' ? (
                        <Megaphone size={18} />
                      ) : (
                        <BellRing size={18} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-400">
                        {broadcastType === 'promotion' ? 'Promotion' : 'Update'}
                      </span>
                      <p className="mt-1 text-sm font-extrabold text-neutral-950">
                        {title.trim() || 'Notification title'}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-neutral-500">
                        {message.trim() || 'Your notification message will appear here.'}
                      </p>
                      {link.trim() && (
                        <span className="mt-3 inline-flex rounded-lg bg-neutral-950 px-3 py-2 text-[11px] font-extrabold text-white">
                          Open update
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            <Section title="Delivery summary">
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-neutral-50 px-3 py-3">
                  <span className="flex items-center gap-2 text-xs font-bold text-neutral-500">
                    <Users size={15} /> Audience
                  </span>
                  <span className="text-right text-xs font-extrabold text-neutral-900">
                    {recipientLabel}
                  </span>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3">
                  <p className="text-xs font-extrabold text-emerald-800">
                    In-app delivery guaranteed
                  </p>
                  <p className="mt-1 text-[11px] leading-5 text-emerald-700/80">
                    Push is also attempted for each active Android or PWA device token.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={requestSendConfirmation}
                  disabled={sending || uploadingImage}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 text-sm font-extrabold text-white shadow-lg shadow-orange-500/15 transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sending ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                  {sending ? 'Sending…' : 'Review & Send'}
                </button>
              </div>
            </Section>
          </div>
        </div>
      )}

      {activeTab === 'announcement' && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="space-y-5">
            <Section
              title="Customer home card"
              description="This is the existing dynamic card shown on the customer home page."
            >
              <div className="flex items-center justify-between gap-4 rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-neutral-900">
                    Show customer card
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Scheduled and expired cards hide automatically.
                  </p>
                </div>
                <ToggleSwitch
                  checked={settings.homeAnnouncementEnabled}
                  onChange={(value) =>
                    updateAnnouncement('homeAnnouncementEnabled', value)
                  }
                />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-bold text-neutral-700">
                    Card type
                  </label>
                  <select
                    value={settings.homeAnnouncementType}
                    onChange={(event) =>
                      updateAnnouncement(
                        'homeAnnouncementType',
                        event.target.value as HomeAnnouncementType,
                      )
                    }
                    className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                  >
                    {announcementTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-neutral-400">
                    {announcementPreview.description}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-bold text-neutral-700">
                    Card title
                  </label>
                  <input
                    value={settings.homeAnnouncementTitle}
                    onChange={(event) =>
                      updateAnnouncement(
                        'homeAnnouncementTitle',
                        event.target.value,
                      )
                    }
                    className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="text-sm font-bold text-neutral-700">
                  Message
                </label>
                <textarea
                  value={settings.homeAnnouncementText}
                  onChange={(event) =>
                    updateAnnouncement(
                      'homeAnnouncementText',
                      event.target.value,
                    )
                  }
                  rows={4}
                  className="mt-1.5 w-full resize-none rounded-xl border border-neutral-200 p-3 text-sm leading-6 outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-bold text-neutral-700">
                    Button label{' '}
                    <span className="font-medium text-neutral-400">(optional)</span>
                  </label>
                  <input
                    value={settings.homeAnnouncementCtaLabel}
                    onChange={(event) =>
                      updateAnnouncement(
                        'homeAnnouncementCtaLabel',
                        event.target.value,
                      )
                    }
                    placeholder="Shop now"
                    className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-neutral-700">
                    Button destination{' '}
                    <span className="font-medium text-neutral-400">(optional)</span>
                  </label>
                  <input
                    value={settings.homeAnnouncementLink}
                    onChange={(event) =>
                      updateAnnouncement(
                        'homeAnnouncementLink',
                        event.target.value,
                      )
                    }
                    placeholder="/shop"
                    className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-bold text-neutral-700">
                    Starts at{' '}
                    <span className="font-medium text-neutral-400">(optional)</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={toDateTimeLocal(settings.homeAnnouncementStartAt)}
                    onChange={(event) =>
                      updateAnnouncement(
                        'homeAnnouncementStartAt',
                        fromDateTimeLocal(event.target.value),
                      )
                    }
                    className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-neutral-700">
                    Ends at{' '}
                    <span className="font-medium text-neutral-400">(optional)</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={toDateTimeLocal(settings.homeAnnouncementEndAt)}
                    onChange={(event) =>
                      updateAnnouncement(
                        'homeAnnouncementEndAt',
                        fromDateTimeLocal(event.target.value),
                      )
                    }
                    className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveAnnouncement}
                disabled={savingAnnouncement}
                className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 text-sm font-extrabold text-white transition hover:bg-orange-600 disabled:opacity-60"
              >
                {savingAnnouncement ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Settings2 size={17} />
                )}
                Save announcement
              </button>
            </Section>
          </div>

          <div className="xl:sticky xl:top-5 xl:self-start">
            <Section title="Customer preview">
              <div
                className={`rounded-2xl border p-4 ${announcementPreview.cardClass}`}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-neutral-700 ring-1 ring-black/5">
                    <Megaphone size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${announcementPreview.badgeClass}`}
                      >
                        {announcementPreview.label}
                      </span>
                      {settings.homeAnnouncementType === 'advertisement' && (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">
                          Sponsored
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-extrabold text-neutral-950">
                      {settings.homeAnnouncementTitle || 'Card title'}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-neutral-600">
                      {settings.homeAnnouncementText ||
                        'Card message will appear here.'}
                    </p>
                    {settings.homeAnnouncementCtaLabel &&
                      settings.homeAnnouncementLink && (
                        <span className="mt-3 inline-flex text-xs font-extrabold text-neutral-900">
                          {settings.homeAnnouncementCtaLabel}
                        </span>
                      )}
                  </div>
                </div>
              </div>
            </Section>
          </div>
        </div>
      )}

      {activeTab === 'brief' && (
        <div className="space-y-5">
          <Section
            title="Daily Admin Brief"
            description="One concise in-app and push summary for admin accounts in Bhutan Time."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                <div className="pr-4">
                  <p className="text-sm font-bold text-neutral-900">
                    Enable daily brief
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Creates one summary each configured day.
                  </p>
                </div>
                <ToggleSwitch
                  checked={digestSettings.enabled}
                  onChange={(value) => updateDigest('enabled', value)}
                />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                <div className="pr-4">
                  <p className="text-sm font-bold text-neutral-900">
                    Only when action is needed
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Skip quiet days without pending work.
                  </p>
                </div>
                <ToggleSwitch
                  checked={digestSettings.sendOnlyWhenActions}
                  onChange={(value) =>
                    updateDigest('sendOnlyWhenActions', value)
                  }
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-bold text-neutral-700">
                  Brief delivery time
                </label>
                <select
                  value={digestSettings.hourBtt}
                  onChange={(event) =>
                    updateDigest(
                      'hourBtt',
                      boundedNumber(event.target.value, 18, 0, 23),
                    )
                  }
                  className="mt-1.5 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  {Array.from({ length: 24 }, (_, hour) => (
                    <option key={hour} value={hour}>
                      {digestHourLabel(hour)} BTT
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                <p className="text-xs font-extrabold uppercase tracking-wide text-emerald-700">
                  Current schedule
                </p>
                <p className="mt-1 text-sm font-extrabold text-neutral-900">
                  {digestSettings.enabled
                    ? `${digestHourLabel(digestSettings.hourBtt)} BTT daily`
                    : 'Daily brief disabled'}
                </p>
                <p className="mt-1 text-xs leading-5 text-neutral-600">
                  The scheduled function checks hourly and sends only at the configured Bhutan hour.
                </p>
              </div>
            </div>
          </Section>

          <Section
            title="Reminder thresholds"
            description="Pending work older than these limits is highlighted as overdue."
          >
            <div className="grid gap-4 md:grid-cols-3">
              {([
                ['quotationWarningHours', 'Quotation warning'],
                ['paymentWarningHours', 'Payment warning'],
                ['parcelWarningHours', 'Parcel warning'],
              ] as const).map(([key, label]) => (
                <label key={key}>
                  <span className="text-xs font-bold text-neutral-600">
                    {label}
                  </span>
                  <div className="mt-1.5 flex h-11 items-center rounded-xl border border-neutral-200 bg-white px-3">
                    <input
                      type="number"
                      min={1}
                      max={168}
                      value={digestSettings[key]}
                      onChange={(event) =>
                        updateDigest(
                          key,
                          boundedNumber(event.target.value, 12, 1, 168),
                        )
                      }
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    />
                    <span className="text-xs font-bold text-neutral-400">
                      hours
                    </span>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleSaveDigest}
                disabled={savingDigest || testingDigest}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 text-sm font-extrabold text-white disabled:opacity-60"
              >
                {savingDigest ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Settings2 size={17} />
                )}
                Save admin brief
              </button>
              <button
                type="button"
                onClick={handleTestDigest}
                disabled={testingDigest || savingDigest}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 text-sm font-extrabold text-white disabled:opacity-60"
              >
                {testingDigest ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Send size={17} />
                )}
                Send test brief
              </button>
            </div>
          </Section>
        </div>
      )}

      {activeTab === 'history' && (
        <Section
          title="Broadcast history"
          description="History records successful in-app notification creation. Push delivery continues through your existing insert trigger."
        >
          {history.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl bg-neutral-50 px-6 text-center">
              <History size={28} className="text-neutral-300" />
              <p className="mt-3 text-sm font-extrabold text-neutral-700">
                No broadcasts yet
              </p>
              <p className="mt-1 max-w-sm text-xs leading-5 text-neutral-400">
                Notifications sent from the new composer will appear here after the database migration is installed.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-neutral-200">
              <div className="hidden grid-cols-[minmax(0,1fr)_150px_120px_145px] gap-4 border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-neutral-400 md:grid">
                <span>Broadcast</span>
                <span>Audience</span>
                <span>Delivery</span>
                <span>Sent</span>
              </div>
              <div className="divide-y divide-neutral-100">
                {history.map((item) => (
                  <article
                    key={item.id}
                    className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_150px_120px_145px] md:items-center md:gap-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-start gap-3">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="h-12 w-16 shrink-0 rounded-lg object-cover"
                          />
                        ) : (
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500">
                            {item.notificationType === 'promotion' ? (
                              <Megaphone size={18} />
                            ) : (
                              <BellRing size={18} />
                            )}
                          </span>
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-extrabold text-neutral-950">
                              {item.title}
                            </p>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                                item.status === 'completed'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : item.status === 'partial'
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-red-50 text-red-700'
                              }`}
                            >
                              {item.status}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500">
                            {item.message}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-neutral-500">
                      <span className="md:hidden">Audience: </span>
                      <span className="font-bold text-neutral-700">
                        {item.audience === 'all_customers'
                          ? 'All customers'
                          : 'Selected'}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-500">
                      <span className="font-extrabold text-neutral-900">
                        {item.notificationCount}/{item.recipientCount}
                      </span>{' '}
                      created
                      {item.failedCount > 0 && (
                        <span className="block text-red-600">
                          {item.failedCount} failed
                        </span>
                      )}
                    </div>
                    <div className="text-xs leading-5 text-neutral-500">
                      {formatBttDateTime(item.createdAt)}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {confirmSend &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[2000] flex items-end justify-center bg-neutral-950/45 p-3 backdrop-blur-[2px] sm:items-center sm:p-5"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !sending) {
                setConfirmSend(false);
              }
            }}
          >
            <div className="w-full max-w-lg overflow-hidden rounded-[26px] bg-white shadow-2xl">
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt=""
                  className="aspect-[16/7] w-full object-cover"
                />
              )}
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                    <Send size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-extrabold text-neutral-950">
                      Send this notification?
                    </p>
                    <p className="mt-1 text-sm leading-6 text-neutral-500">
                      This will create a permanent in-app notification for {recipientLabel}. Push will be attempted automatically.
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-neutral-50 p-4">
                  <p className="text-sm font-extrabold text-neutral-900">
                    {title.trim()}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-neutral-500">
                    {message.trim()}
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmSend(false)}
                    disabled={sending}
                    className="h-11 rounded-xl border border-neutral-200 bg-white text-sm font-extrabold text-neutral-700 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSend()}
                    disabled={sending}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-orange-500 text-sm font-extrabold text-white disabled:opacity-60"
                  >
                    {sending ? (
                      <Loader2 size={17} className="animate-spin" />
                    ) : (
                      <Send size={17} />
                    )}
                    {sending ? 'Sending…' : 'Send now'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
