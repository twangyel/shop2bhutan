import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  Megaphone,
  ChevronDown,
  Headphones,
  Link2,
  MapPin,
  Package,
  Truck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import Logo from '@/components/shared/Logo';
import { getUnreadNotificationCount } from '@/lib/customerOrders';
import { DEFAULT_APP_SETTINGS, fetchPublicAppSettings } from '@/lib/appSettings';
import { supabase } from '@/lib/supabase';

const stores = [
  { name: 'Amazon', platform: 'amazon' },
  { name: 'Flipkart', platform: 'flipkart' },
  { name: 'Myntra', platform: 'myntra' },
  { name: 'Meesho', platform: 'meesho' },
];

const quickActions = [
  { icon: Link2, label: 'Paste Link', path: '/paste-link' },
  { icon: Package, label: 'My Orders', path: '/orders' },
  { icon: Truck, label: 'Track Order', path: '/orders' },
  { icon: Headphones, label: 'Support', path: '/support' },
];

type DzongkhagOption = {
  id: string;
  name: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeDzongkhagOptions(data: unknown): DzongkhagOption[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const id = cleanString(row.id);
      const name = cleanString(row.name);
      return id && name ? { id, name } : null;
    })
    .filter((item): item is DzongkhagOption => Boolean(item));
}

function getProfileField(profile: unknown, key: string) {
  if (!profile || typeof profile !== 'object') return null;
  return cleanString((profile as Record<string, unknown>)[key]);
}

function resolveDeliveryLabel({
  profile,
  appDzongkhag,
  dzongkhags,
}: {
  profile: unknown;
  appDzongkhag?: unknown;
  dzongkhags: DzongkhagOption[];
}) {
  const profileDzongkhag = getProfileField(profile, 'dzongkhag');
  const defaultDzongkhagId = getProfileField(profile, 'default_dzongkhag_id');
  const appDzongkhagValue = cleanString(appDzongkhag);

  const firstValue = profileDzongkhag || defaultDzongkhagId || appDzongkhagValue;

  if (!firstValue) return 'Thimphu';

  if (UUID_RE.test(firstValue)) {
    return dzongkhags.find((item) => item.id === firstValue)?.name || 'Bhutan';
  }

  return firstValue;
}

export default function Home() {
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading, context: authContext } = useAuth();
  const { user: appUser } = useApp();
  const [unreadCount, setUnreadCount] = useState(0);
  const [appSettings, setAppSettings] = useState(DEFAULT_APP_SETTINGS);
  const [dzongkhags, setDzongkhags] = useState<DzongkhagOption[]>([]);

  const refreshUnreadCount = useCallback(async () => {
    if (!authUser || authLoading) {
      setUnreadCount(0);
      return;
    }

    try {
      const count = await getUnreadNotificationCount(authUser.id);
      setUnreadCount(count);
    } catch (error) {
      console.warn('[Home] Notification count skipped:', error);
      setUnreadCount(0);
    }
  }, [authLoading, authUser]);

  useEffect(() => {
    void refreshUnreadCount();
  }, [refreshUnreadCount]);

  useEffect(() => {
    const handler = () => {
      void refreshUnreadCount();
    };

    window.addEventListener('shop2bhutan:notifications-updated', handler);
    window.addEventListener('focus', handler);

    return () => {
      window.removeEventListener('shop2bhutan:notifications-updated', handler);
      window.removeEventListener('focus', handler);
    };
  }, [refreshUnreadCount]);

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      try {
        const loaded = await fetchPublicAppSettings();
        if (active) setAppSettings(loaded);
      } catch (error) {
        console.warn('[Home] App settings skipped:', error);
      }
    }

    void loadSettings();

    const handleSettingsUpdated = () => {
      void loadSettings();
    };

    window.addEventListener('shop2bhutan:app-settings-updated', handleSettingsUpdated);

    return () => {
      active = false;
      window.removeEventListener('shop2bhutan:app-settings-updated', handleSettingsUpdated);
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadDzongkhags() {
      try {
        const { data, error } = await supabase.rpc('get_dzongkhag_options');
        if (!active) return;

        if (error) {
          console.warn('[Home] Dzongkhag options skipped:', error.message);
          return;
        }

        setDzongkhags(normalizeDzongkhagOptions(data));
      } catch (error) {
        console.warn('[Home] Dzongkhag options skipped:', error);
      }
    }

    void loadDzongkhags();

    return () => {
      active = false;
    };
  }, []);

  const visibleStores = stores.filter(
    (store) => appSettings.acceptedPlatforms[store.platform as keyof typeof appSettings.acceptedPlatforms],
  );

  const deliveryLabel = useMemo(
    () =>
      resolveDeliveryLabel({
        profile: authContext?.profile,
        appDzongkhag: appUser?.dzongkhag,
        dzongkhags,
      }),
    [appUser?.dzongkhag, authContext?.profile, dzongkhags],
  );

  return (
    <div className="min-h-screen bg-white">
      {/* ========== HEADER ========== */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="mx-auto max-w-3xl px-4 pb-3 pt-3">
          <div className="flex items-center justify-between">
            <Logo size="sm" />
            <button
              type="button"
              onClick={() => navigate('/notifications')}
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100 active:bg-gray-200"
              aria-label="Notifications"
            >
              <Bell size={18} strokeWidth={1.8} />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigate('/account')}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-gray-50 border border-gray-100 px-3 py-1.5 text-left text-xs font-medium text-gray-600 transition-colors active:bg-gray-100"
          >
            <MapPin size={13} className="text-orange-500" />
            <span>Delivering to {deliveryLabel}</span>
            <ChevronDown size={12} className="ml-0.5 text-gray-400" />
          </button>
        </div>
      </header>

      {/* ========== MAIN ========== */}
      <main className="mx-auto max-w-3xl px-4 pb-10 pt-4">
        {appSettings.homeAnnouncementEnabled && appSettings.homeAnnouncementText && (
          <section className="mb-4 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-blue-800">
            <Megaphone size={18} className="mt-0.5 shrink-0" />
            <p className="text-sm font-medium leading-5">{appSettings.homeAnnouncementText}</p>
          </section>
        )}

        {/* ----- Visual Banner ----- */}
        <section
          className="relative overflow-hidden rounded-3xl"
          style={{
            backgroundImage: `
              linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.55) 100%),
              url('/home-banner-bg.jpg')
            `,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Fallback bg color if image fails */}
          <div className="absolute inset-0 bg-gray-800 -z-10" />

          <div className="relative z-10 p-6">
            {/* Store pills */}
            <div className="flex flex-wrap gap-2">
              {visibleStores.map((store) => (
                <button
                  key={store.name}
                  type="button"
                  onClick={() => navigate('/paste-link', { state: { sourcePlatform: store.platform } })}
                  className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/30"
                >
                  {store.name}
                </button>
              ))}
            </div>

            {/* Label */}
            <p className="mt-5 text-xs font-bold uppercase tracking-widest text-amber-400">
              {appSettings.appName}
            </p>

            {/* Headline */}
            <h2 className="mt-2 text-[1.6rem] font-extrabold text-white leading-tight sm:text-3xl">
              Shop from India,<br />
              <span className="text-amber-400">Delivered to Bhutan</span>
            </h2>

            {/* Subtext */}
            <p className="mt-3 max-w-[280px] text-sm leading-relaxed text-white/80">
              We shop from Amazon, Flipkart, Myntra, and Meesho. Large appliances excluded. We order and deliver to Thimphu, Paro and Chhukha.
            </p>
          </div>
        </section>

        {/* ----- Request Quotation CTA ----- */}
        <button
          type="button"
          onClick={() => navigate('/paste-link')}
          className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 text-base font-bold text-white transition-colors hover:bg-orange-600 active:scale-[0.98]"
        >
          <span>Request Quotation</span>
          <ArrowRight size={18} strokeWidth={2.5} />
        </button>

        {/* ----- Quick Actions ----- */}
        <section className="mt-5 bg-white border border-gray-100 rounded-2xl p-3">
          <div className="grid grid-cols-4 gap-1">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => navigate(action.path)}
                  className="group flex flex-col items-center justify-center gap-2 rounded-xl px-1.5 py-3 text-center transition-colors hover:bg-gray-50 active:bg-gray-100"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
                    <Icon size={20} strokeWidth={2} />
                  </span>
                  <span className="text-[11px] font-semibold text-gray-700">{action.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ----- Footer Note ----- */}
        <p className="mt-6 px-2 text-center text-[0.65rem] leading-relaxed text-gray-400">
          Orders accepted from all 20 dzongkhags. Delivery currently available in Thimphu, Paro, and Phuntsholing/Chhukha.
        </p>
      </main>
    </div>
  );
}
