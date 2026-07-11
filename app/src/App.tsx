import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Navigate, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { BellRing, CheckCircle2, Download, Loader2, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { AppProvider } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  getPushPermissionState,
  isNativePushRuntime,
  registerPushDeviceForUser,
  type PushPermissionState,
} from '@/lib/pushNotifications';
import { consumePendingNativeShare } from '@/lib/nativeShareReceiver';

// Layouts
import CustomerLayout from '@/layouts/CustomerLayout';
import AdminLayout from '@/layouts/AdminLayout';

// Shared
import RequireAuth from '@/components/shared/RequireAuth';

// Customer Pages
import Login from '@/pages/customer/Login';
import Register from '@/pages/customer/Register';
import ForgotPassword from '@/pages/customer/ForgotPassword';
import ResetPassword from '@/pages/customer/ResetPassword';
import Home from '@/pages/customer/Home';
import Catalog from '@/pages/customer/Catalog';
import ProductDetail from '@/pages/customer/ProductDetail';
import PasteLink from '@/pages/customer/PasteLink';
import RequestBag from '@/pages/customer/RequestBag';
import Checkout from '@/pages/customer/Checkout';
import QuotationReview from '@/pages/customer/QuotationReview';
import PaymentUpload from '@/pages/customer/PaymentUpload';
import PaymentHistory from '@/pages/customer/PaymentHistory';
import Orders from '@/pages/customer/Orders';
import OrderDetail from '@/pages/customer/OrderDetail';
import Account from '@/pages/customer/Account';
import Profile from '@/pages/customer/Profile';
import Addresses from '@/pages/customer/Addresses';
import ChangePassword from '@/pages/customer/ChangePassword';
import Support from '@/pages/customer/Support';
import PolicyPage from '@/pages/customer/PolicyPage';
import Notifications from '@/pages/customer/Notifications';
import Parcel from '@/pages/customer/Parcel';
import ParcelBooking from '@/pages/customer/ParcelBooking';
import MyParcels from '@/pages/customer/MyParcels';
import Shop from '@/pages/customer/Shop';

// Admin Pages
import Dashboard from '@/pages/admin/Dashboard';
import OrdersPanel from '@/pages/admin/OrdersPanel';
import AdminOrderDetail from '@/pages/admin/OrderDetail';
import QuotationBuilder from '@/pages/admin/QuotationBuilder';
import PaymentsVerification from '@/pages/admin/PaymentsVerification';
import CustomersPanel from '@/pages/admin/CustomersPanel';
import ProductCMS from '@/pages/admin/ProductCMS';
import BannerCMS from '@/pages/admin/BannerCMS';
import CategoryCMS from '@/pages/admin/CategoryCMS';
import DeliveryFeeSettings from '@/pages/admin/DeliveryFeeSettings';
import ServiceChargeSettings from '@/pages/admin/ServiceChargeSettings';
import PaymentMethodSettings from '@/pages/admin/PaymentMethodSettings';
import AppSettings from '@/pages/admin/AppSettings';
import FAQCMS from '@/pages/admin/FAQCMS';
import AdminParcelTrips from '@/pages/admin/ParcelTrips';
import AdminParcelRequests from '@/pages/admin/ParcelRequests';


type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const PWA_INSTALL_DISMISSED_UNTIL_KEY = 'shop2bhutan:pwa-install-dismissed-until:v1';
const PWA_INSTALL_DISMISS_DAYS = 3;

function isPwaStandalone() {
  if (typeof window === 'undefined') return false;

  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isNativeAppRuntime() {
  if (typeof window === 'undefined') return false;

  const win = window as Window & {
    Capacitor?: { isNativePlatform?: () => boolean };
  };

  return Boolean(win.Capacitor?.isNativePlatform?.());
}

function isInstallDismissed() {
  if (typeof window === 'undefined') return true;

  try {
    const dismissedUntil = Number(
      window.localStorage.getItem(PWA_INSTALL_DISMISSED_UNTIL_KEY) || 0,
    );

    return dismissedUntil > Date.now();
  } catch {
    return true;
  }
}

function dismissInstallBanner() {
  if (typeof window === 'undefined') return;

  try {
    const dismissedUntil = Date.now() + PWA_INSTALL_DISMISS_DAYS * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(
      PWA_INSTALL_DISMISSED_UNTIL_KEY,
      String(dismissedUntil),
    );
  } catch {
    // Ignore storage failures.
  }
}

function isIosSafari() {
  if (typeof window === 'undefined') return false;

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(userAgent);
  const isSafari = /safari/.test(userAgent) && !/crios|fxios|edgios|chrome/.test(userAgent);

  return isIos && isSafari;
}

function isMobileBrowser() {
  if (typeof window === 'undefined') return false;

  return /android|iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function PwaInstallBanner() {
  const location = useLocation();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);
  const iosSafari = isIosSafari();
  const shouldHideForRoute = location.pathname.startsWith('/admin');

  useEffect(() => {
    if (isPwaStandalone() || isNativeAppRuntime() || isInstallDismissed()) {
      setVisible(false);
      return undefined;
    }

    const showTimer = window.setTimeout(() => {
      // iOS Safari never gives beforeinstallprompt. Show manual install help.
      // For other mobile browsers, show a lightweight custom banner. If the
      // browser has the install prompt ready, the Install button opens it.
      if (isMobileBrowser()) setVisible(true);
    }, 900);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setVisible(false);
      dismissInstallBanner();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.clearTimeout(showTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (iosSafari || !deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;

      if (choice.outcome === 'accepted') {
        dismissInstallBanner();
        setVisible(false);
      }
    } finally {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    dismissInstallBanner();
    setVisible(false);
  };

  if (installed || shouldHideForRoute || !visible || isPwaStandalone() || isNativeAppRuntime()) {
    return null;
  }

  return (
    <div className="fixed left-0 right-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[95] px-4">
      <div className="mx-auto max-w-lg overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-2xl shadow-slate-900/15 ring-1 ring-white/70">
        <div className="flex items-start gap-3 p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 ring-1 ring-orange-100">
            <Download size={21} strokeWidth={2.4} />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-slate-950">
              Install Shop2Bhutan app
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {iosSafari
                ? 'For app-like access on iPhone, tap Share and choose Add to Home Screen.'
                : 'Get faster access from your home screen with a native app-like experience.'}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {iosSafari ? (
                <span className="inline-flex h-9 items-center rounded-2xl bg-slate-950 px-4 text-xs font-extrabold text-white">
                  Share → Add to Home Screen
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleInstall}
                  disabled={!deferredPrompt}
                  className="h-9 rounded-2xl bg-orange-500 px-4 text-xs font-extrabold text-white transition active:scale-[0.98] disabled:bg-orange-200 disabled:text-white"
                >
                  {deferredPrompt ? 'Install App' : 'Use browser Install'}
                </button>
              )}

              <button
                type="button"
                onClick={handleDismiss}
                className="h-9 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 transition active:scale-[0.98]"
              >
                Later
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 active:bg-slate-100"
            aria-label="Dismiss install banner"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}


const WEB_PUSH_DISMISS_KEY = 'shop2bhutan:web-push-dismissed-until:v2';
const WEB_PUSH_DISMISS_DAYS = 3;

function getWebPushDismissedUntil() {
  if (typeof window === 'undefined') return 0;

  try {
    return Number(window.localStorage.getItem(WEB_PUSH_DISMISS_KEY) || 0);
  } catch {
    return 0;
  }
}

function dismissWebPushBanner() {
  if (typeof window === 'undefined') return;

  try {
    const until =
      Date.now() + WEB_PUSH_DISMISS_DAYS * 24 * 60 * 60 * 1000;
    window.localStorage.setItem(WEB_PUSH_DISMISS_KEY, String(until));
  } catch {
    // Ignore storage failures.
  }
}

function isIosDeviceForWebPush() {
  if (typeof window === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandaloneWebApp() {
  if (typeof window === 'undefined') return false;

  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function WebPushPermissionBanner() {
  const location = useLocation();
  const { loading, user, isGuest } = useAuth();
  const [permissionState, setPermissionState] =
    useState<PushPermissionState>('unsupported');
  const [checking, setChecking] = useState(true);
  const [enabling, setEnabling] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState('');

  const hiddenRoute =
    location.pathname.startsWith('/admin') ||
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/forgot-password' ||
    location.pathname === '/reset-password';

  useEffect(() => {
    let active = true;

    async function checkPermission() {
      if (
        loading ||
        isGuest ||
        !user?.id ||
        hiddenRoute ||
        isNativePushRuntime()
      ) {
        if (active) setChecking(false);
        return;
      }

      const state = await getPushPermissionState();

      if (active) {
        console.info('[WebPushPermissionBanner] Permission state:', state, {
          secureContext: window.isSecureContext,
          standalone: isStandaloneWebApp(),
          notificationApi: 'Notification' in window,
          serviceWorkerApi: 'serviceWorker' in navigator,
        });

        setPermissionState(state);
        setEnabled(false);
        setChecking(false);
      }
    }

    void checkPermission();

    return () => {
      active = false;
    };
  }, [hiddenRoute, isGuest, loading, user?.id]);

  const handleEnable = async () => {
    if (!user?.id || enabling) return;

    setEnabling(true);
    setError('');

    try {
      const registered = await registerPushDeviceForUser(user.id, {
        requestPermission: true,
      });

      const nextState = await getPushPermissionState();
      setPermissionState(nextState);

      if (registered && nextState === 'granted') {
        setEnabled(true);
        window.setTimeout(() => {
          setEnabled(false);
          setPermissionState('granted');
        }, 2200);
        return;
      }

      if (nextState === 'denied') {
        setError(
          'Notifications are blocked. Enable them from this app or browser’s notification settings.',
        );
      } else {
        setError(
          'Notifications could not be enabled. Please check your connection and try again.',
        );
      }
    } catch (enableError) {
      console.warn('[WebPushPermissionBanner] Enable skipped:', enableError);
      setError('Unable to enable notifications right now. Please try again.');
    } finally {
      setEnabling(false);
    }
  };

  const handleDismiss = () => {
    dismissWebPushBanner();
    setPermissionState('unsupported');
  };

  const dismissed = getWebPushDismissedUntil() > Date.now();

  if (
    checking ||
    loading ||
    isGuest ||
    !user?.id ||
    hiddenRoute ||
    isNativePushRuntime() ||
    dismissed ||
    (permissionState === 'granted' && !enabled)
  ) {
    return null;
  }

  const topBannerClass =
    'fixed left-0 right-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[110] px-3 sm:px-4';

  if (permissionState === 'unconfigured') {
    return (
      <div className={topBannerClass}>
        <div className="mx-auto max-w-md rounded-3xl border border-amber-100 bg-white p-4 shadow-2xl shadow-slate-900/15">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <BellRing size={21} strokeWidth={2.3} />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-slate-950">
                Web notifications need deployment setup
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Add the Firebase VITE variables to this deployed environment,
                rebuild the app, and reload it.
              </p>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 active:bg-slate-100"
              aria-label="Dismiss notification setup message"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (permissionState === 'unsupported') {
    const iosNeedsHomeScreen =
      isIosDeviceForWebPush() && !isStandaloneWebApp();
    const insecurePage =
      typeof window !== 'undefined' && !window.isSecureContext;

    return (
      <div className={topBannerClass}>
        <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-900/15">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <BellRing size={21} strokeWidth={2.3} />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-slate-950">
                Notifications unavailable here
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {iosNeedsHomeScreen
                  ? 'On iPhone or iPad, add Shop2Bhutan to the Home Screen and open the installed app before enabling notifications.'
                  : insecurePage
                    ? 'Open Shop2Bhutan through its secure HTTPS address to enable browser notifications.'
                    : 'Use the latest Chrome, Edge, or a supported installed PWA, then reload Shop2Bhutan.'}
              </p>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 active:bg-slate-100"
              aria-label="Dismiss notification compatibility message"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (permissionState === 'denied') {
    return (
      <div className={topBannerClass}>
        <div className="mx-auto max-w-md rounded-3xl border border-red-100 bg-white p-4 shadow-2xl shadow-slate-900/15">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <BellRing size={21} strokeWidth={2.3} />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-slate-950">
                Notifications are blocked
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Open this site’s browser settings, change Notifications to Allow,
                then reload Shop2Bhutan.
              </p>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-3 h-9 rounded-2xl bg-slate-950 px-4 text-xs font-extrabold text-white transition active:scale-[0.98]"
              >
                Reload after allowing
              </button>
            </div>

            <button
              type="button"
              onClick={handleDismiss}
              className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 active:bg-slate-100"
              aria-label="Dismiss notification warning"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (enabled) {
    return (
      <div className={topBannerClass}>
        <div className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-emerald-100 bg-white p-4 shadow-2xl shadow-slate-900/15">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={20} strokeWidth={2.4} />
          </span>
          <div>
            <p className="text-sm font-extrabold text-slate-950">
              Notifications enabled
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              You’ll receive quotation, payment, order, and parcel updates.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={topBannerClass}>
      <div className="mx-auto max-w-md overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-2xl shadow-slate-900/15">
        <div className="flex items-start gap-3 p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <BellRing size={21} strokeWidth={2.3} />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-slate-950">
              Stay updated
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Enable notifications for quotations, payments, orders, and parcel updates—even when the PWA is closed.
            </p>

            {error && (
              <p className="mt-2 text-xs font-semibold leading-5 text-red-600">
                {error}
              </p>
            )}

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleEnable}
                disabled={enabling}
                className="flex h-9 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-xs font-extrabold text-white transition active:scale-[0.98] disabled:opacity-60"
              >
                {enabling && <Loader2 size={14} className="animate-spin" />}
                {enabling ? 'Enabling...' : 'Enable Notifications'}
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                className="h-9 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 transition active:scale-[0.98]"
              >
                Later
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 active:bg-slate-100"
            aria-label="Dismiss notification banner"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}


function mustChangePassword(profile: unknown) {
  const row = (profile ?? {}) as {
    must_change_password?: boolean | null;
    mustChangePassword?: boolean | null;
  };

  return Boolean(row.must_change_password ?? row.mustChangePassword ?? false);
}


function isGoogleAuthUser(user: unknown) {
  const row = (user ?? {}) as {
    app_metadata?: { provider?: string | null; providers?: string[] | null };
    identities?: Array<{ provider?: string | null }> | null;
  };

  return Boolean(
    row.app_metadata?.provider === 'google' ||
      row.app_metadata?.providers?.includes('google') ||
      row.identities?.some((identity) => identity.provider === 'google'),
  );
}

function hasCompletedGoogleProfile(profile: unknown) {
  const row = (profile ?? {}) as {
    phone?: string | null;
    default_dzongkhag_id?: string | null;
    dzongkhag?: string | null;
  };

  const digits = String(row.phone ?? '').replace(/\D/g, '');
  const phone8 = digits.startsWith('975') ? digits.slice(3) : digits;
  const hasPhone = /^(17|77)\d{6}$/.test(phone8);
  const hasDzongkhag = Boolean(
    String(row.default_dzongkhag_id ?? row.dzongkhag ?? '').trim(),
  );

  return hasPhone && hasDzongkhag;
}

function GoogleProfileCompletionGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { loading, user, context, isGuest } = useAuth();

  const isAdmin = Boolean(context?.is_admin || context?.is_super_admin);
  const requiresGoogleProfile =
    !loading &&
    !isGuest &&
    !isAdmin &&
    Boolean(user?.id) &&
    isGoogleAuthUser(user) &&
    !hasCompletedGoogleProfile(context?.profile);

  if (requiresGoogleProfile && location.pathname !== '/profile') {
    const returnTo = `${location.pathname}${location.search}`;

    return (
      <Navigate
        to={`/profile?setup=google&returnTo=${encodeURIComponent(returnTo)}`}
        replace
        state={{ forcedGoogleProfile: true, returnTo }}
      />
    );
  }

  return <>{children}</>;
}

const NATIVE_AUTH_SCHEME = 'com.shop2bhutan.app:';

function navigateToNativeGoogleCallback(
  errorMessage?: string,
  returnTo?: string | null,
) {
  const callbackUrl = new URL('/login', window.location.origin);
  callbackUrl.searchParams.set('oauth', 'google');

  if (returnTo?.startsWith('/') && !returnTo.startsWith('//')) {
    callbackUrl.searchParams.set('returnTo', returnTo);
  }

  if (errorMessage) {
    callbackUrl.searchParams.set('error_description', errorMessage);
  }

  window.history.replaceState(
    {},
    '',
    `${callbackUrl.pathname}${callbackUrl.search}`,
  );
  window.dispatchEvent(new PopStateEvent('popstate'));
}

async function handleNativeAuthUrl(url: string) {
  if (!url.startsWith(NATIVE_AUTH_SCHEME)) return false;

  const parsedUrl = new URL(url);
  if (parsedUrl.hostname !== 'login') return false;

  const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
  const queryParams = parsedUrl.searchParams;
  const returnTo = queryParams.get('returnTo');

  const oauthError =
    queryParams.get('error_description') ??
    queryParams.get('error') ??
    hashParams.get('error_description') ??
    hashParams.get('error');

  try {
    await Browser.close();
  } catch {
    // The browser may already be closed.
  }

  if (oauthError) {
    navigateToNativeGoogleCallback(oauthError, returnTo);
    return true;
  }

  const code = queryParams.get('code');
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
    } else {
      throw new Error('Google did not return a valid Shop2Bhutan session.');
    }

    navigateToNativeGoogleCallback(undefined, returnTo);
  } catch (error) {
    console.error('[Shop2Bhutan] Native Google OAuth failed:', error);
    navigateToNativeGoogleCallback(
      error instanceof Error
        ? error.message
        : 'Google sign-in could not be completed.',
      returnTo,
    );
  }

  return true;
}

function NativeGoogleOAuthBridge() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let active = true;
    let removeListener: (() => Promise<void>) | undefined;

    void CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      if (active) void handleNativeAuthUrl(url);
    }).then((listener) => {
      if (!active) {
        void listener.remove();
        return;
      }

      removeListener = () => listener.remove();
    });

    void CapacitorApp.getLaunchUrl().then((launch) => {
      if (active && launch?.url) {
        void handleNativeAuthUrl(launch.url);
      }
    });

    return () => {
      active = false;
      void removeListener?.();
    };
  }, []);

  return null;
}


function NativeShareBridge() {
  const navigate = useNavigate();
  const checkingRef = useRef(false);
  const activeRef = useRef(true);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    activeRef.current = true;
    let removeResume: (() => Promise<void>) | undefined;
    let removeStateChange: (() => Promise<void>) | undefined;

    const openPendingShare = async () => {
      if (checkingRef.current) return;

      checkingRef.current = true;

      try {
        const sharedProduct =
          await consumePendingNativeShare();

        if (!activeRef.current || !sharedProduct) return;

        navigate('/paste-link', {
          state: {
            initialUrl: sharedProduct.url,
            sharedTitle: sharedProduct.title,
            source: 'android-share',
            receivedAt: sharedProduct.receivedAt,
          },
        });
      } finally {
        checkingRef.current = false;
      }
    };

    // Cold start: consume the share saved by MainActivity.
    void openPendingShare();

    // Warm start: Android resumes Shop2Bhutan after the share sheet.
    void CapacitorApp.addListener('resume', () => {
      void openPendingShare();
    }).then((listener) => {
      if (!activeRef.current) {
        void listener.remove();
        return;
      }

      removeResume = () => listener.remove();
    });

    void CapacitorApp.addListener(
      'appStateChange',
      ({ isActive }) => {
        if (isActive) void openPendingShare();
      },
    ).then((listener) => {
      if (!activeRef.current) {
        void listener.remove();
        return;
      }

      removeStateChange = () => listener.remove();
    });

    const handleVisibilityChange = () => {
      if (!document.hidden) void openPendingShare();
    };

    document.addEventListener(
      'visibilitychange',
      handleVisibilityChange,
    );

    return () => {
      activeRef.current = false;
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityChange,
      );
      void removeResume?.();
      void removeStateChange?.();
    };
  }, [navigate]);

  return null;
}

function PushNotificationBridge() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loading, user, isGuest } = useAuth();

  useEffect(() => {
    if (loading || isGuest || !user?.id) return;

    void registerPushDeviceForUser(user.id);
  }, [loading, isGuest, user?.id]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;

    const handleServiceWorkerMessage = (
      event: MessageEvent<{ type?: string; link?: string }>,
    ) => {
      if (event.data?.type !== 'SHOP2BHUTAN_PUSH_OPEN') return;

      const link = String(event.data.link || '');

      if (link.startsWith('/') && !link.startsWith('//')) {
        window.dispatchEvent(
          new CustomEvent('shop2bhutan:push-notification-opened', {
            detail: { link },
          }),
        );
      }
    };

    navigator.serviceWorker.addEventListener(
      'message',
      handleServiceWorkerMessage,
    );

    return () => {
      navigator.serviceWorker.removeEventListener(
        'message',
        handleServiceWorkerMessage,
      );
    };
  }, []);

  useEffect(() => {
    const handlePushNotificationOpened = (event: Event) => {
      const link = String(
        (event as CustomEvent<{ link?: string }>).detail?.link ?? '',
      );

      const currentPath = `${location.pathname}${location.search}`;

      if (
        link.startsWith('/') &&
        !link.startsWith('//') &&
        link !== currentPath
      ) {
        navigate(link, { replace: location.pathname === '/' });
      }
    };

    window.addEventListener(
      'shop2bhutan:push-notification-opened',
      handlePushNotificationOpened,
    );

    return () => {
      window.removeEventListener(
        'shop2bhutan:push-notification-opened',
        handlePushNotificationOpened,
      );
    };
  }, [location.pathname, location.search, navigate]);

  return null;
}

function RouteScrollToTop() {
  const { pathname, search } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname, search]);

  return null;
}

function PasswordChangeGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { loading, context, isGuest } = useAuth();

  const forced =
    !loading &&
    !isGuest &&
    Boolean(context?.user_id) &&
    mustChangePassword(context?.profile);

  if (forced && location.pathname !== '/change-password') {
    return (
      <Navigate
        to="/change-password"
        replace
        state={{ forced: true, returnTo: location.pathname }}
      />
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AppProvider>
      <NativeGoogleOAuthBridge />
      <NativeShareBridge />
      <PushNotificationBridge />
      <RouteScrollToTop />
      <PwaInstallBanner />
      <WebPushPermissionBanner />
      <Routes>
        {/* Auth Routes - No Layout */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Customer Routes */}
        <Route
          element={
            <PasswordChangeGate>
              <GoogleProfileCompletionGate>
                <CustomerLayout />
              </GoogleProfileCompletionGate>
            </PasswordChangeGate>
          }
        >
          {/* Public browsing routes */}
          <Route path="/" element={<Home />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/paste-link" element={<PasteLink />} />
          <Route path="/account" element={<Account />} />
          <Route path="/support" element={<Support />} />
          <Route path="/terms" element={<PolicyPage slug="terms" />} />
          <Route path="/privacy" element={<PolicyPage slug="privacy" />} />
          <Route path="/return-policy" element={<PolicyPage slug="returns" />} />
          <Route path="/parcel" element={<Parcel />} />
          <Route path="/shop" element={<Shop />} />

          {/* Customer-only routes/actions */}
          <Route
            path="/request-bag"
            element={
              <RequireAuth title="Sign in to view Request Bag" message="Save product links, screenshots, and quantities in your Request Bag before requesting a quotation.">
                <RequestBag />
              </RequireAuth>
            }
          />
          <Route
            path="/cart"
            element={
              <RequireAuth title="Sign in to view Request Bag" message="Your old cart is now Request Bag for quotation requests.">
                <RequestBag />
              </RequireAuth>
            }
          />
          <Route
            path="/checkout"
            element={
              <RequireAuth
                title="Sign in to checkout"
                message="Please sign in before placing an order so we can save your quotation, payment, and tracking history."
              >
                <Checkout />
              </RequireAuth>
            }
          />
          <Route
            path="/quotation/:orderId"
            element={
              <RequireAuth title="Sign in to view quotation" message="Your quotation is linked to your Shop2Bhutan account.">
                <QuotationReview />
              </RequireAuth>
            }
          />
          <Route
            path="/payment/:orderId"
            element={
              <RequireAuth title="Sign in to upload payment" message="Payment screenshots are kept private and linked to your account.">
                <PaymentUpload />
              </RequireAuth>
            }
          />
          <Route
            path="/orders"
            element={
              <RequireAuth title="Sign in to view orders" message="Your order history, quotations, and tracking updates are available after sign in.">
                <Orders />
              </RequireAuth>
            }
          />
          <Route
            path="/order/:id"
            element={
              <RequireAuth title="Sign in to view order" message="Order details are private and linked to your account.">
                <OrderDetail />
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth title="Sign in to edit profile" message="Manage your name, phone, email, dzongkhag, and profile picture after sign in.">
                <Profile />
              </RequireAuth>
            }
          />
          <Route
            path="/addresses"
            element={
              <RequireAuth title="Sign in to manage addresses" message="Saved addresses are private and linked to your Shop2Bhutan account.">
                <Addresses />
              </RequireAuth>
            }
          />
          <Route
            path="/change-password"
            element={
              <RequireAuth title="Sign in to change password" message="For security, password changes require an active signed-in session.">
                <ChangePassword />
              </RequireAuth>
            }
          />
          <Route
            path="/notifications"
            element={
              <RequireAuth title="Sign in to view notifications" message="Account notifications are linked to your order and payment activity.">
                <Notifications />
              </RequireAuth>
            }
          />
          <Route
            path="/payment-history"
            element={
              <RequireAuth title="Sign in to view payment history" message="Your payment records are private and linked to your Shop2Bhutan account.">
                <PaymentHistory />
              </RequireAuth>
            }
          />
          <Route path="/parcel-booking/:tripId" element={<ParcelBooking />} />
          <Route path="/my-parcels" element={<MyParcels />} />
        </Route>

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<OrdersPanel />} />
          <Route path="orders/:id" element={<AdminOrderDetail />} />
          <Route path="quotation/:id" element={<QuotationBuilder />} />
          <Route path="parcels" element={<AdminParcelTrips />} />
          <Route path="parcel-requests" element={<AdminParcelRequests />} />
          <Route path="payments" element={<PaymentsVerification />} />
          <Route path="customers" element={<CustomersPanel />} />
          <Route path="products" element={<ProductCMS />} />
          <Route path="banners" element={<BannerCMS />} />
          <Route path="categories" element={<CategoryCMS />} />
          <Route path="delivery-fees" element={<DeliveryFeeSettings />} />
          <Route path="service-charges" element={<ServiceChargeSettings />} />
          <Route path="payment-methods" element={<PaymentMethodSettings />} />
          <Route path="settings" element={<AppSettings />} />
          <Route path="faq" element={<FAQCMS />} />
        </Route>
      </Routes>
    </AppProvider>
  );
}
