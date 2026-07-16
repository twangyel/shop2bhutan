import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Navigate, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import {
  BellRing,
  CheckCircle2,
  Download,
  Loader2,
  MessageCircle,
  Phone,
  RefreshCw,
  ShieldCheck,
  Wifi,
  WifiOff,
  Wrench,
  X,
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Network, type ConnectionStatus } from '@capacitor/network';
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
import { consumePendingShoppingAssistCapture } from '@/lib/shoppingAssist';
import {
  getNumberPreference,
  setNumberPreference,
} from '@/lib/preferences';
import { applyShopSystemBars } from '@/lib/systemBars';
import {
  DEFAULT_APP_SETTINGS,
  fetchPublicAppSettings,
} from '@/lib/appSettings';
import Logo from '@/components/shared/Logo';
import type { AppSettings as AppSettingsType } from '@/types';

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
import ShoppingAssist from '@/pages/customer/ShoppingAssist';
import ShoppingAssistReview from '@/pages/customer/ShoppingAssistReview';
import DownloadApp from '@/pages/customer/DownloadApp';

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
import BusinessFinance from '@/pages/admin/BusinessFinance';


type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type NetworkBannerState = 'online' | 'offline' | 'restoring' | 'restored';

function GlobalNetworkStatus() {
  const { refreshContext } = useAuth();
  const [state, setState] = useState<NetworkBannerState>(() =>
    typeof navigator !== 'undefined' && navigator.onLine === false
      ? 'offline'
      : 'online',
  );
  const wasOfflineRef = useRef(
    typeof navigator !== 'undefined' && navigator.onLine === false,
  );
  const reconnectingRef = useRef(false);
  const lastReconnectAtRef = useRef(0);
  const hideTimerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    let active = true;
    let removeNetworkListener: (() => Promise<void>) | undefined;

    const clearHideTimer = () => {
      if (hideTimerRef.current !== undefined) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = undefined;
      }
    };

    const notifyDataRefresh = () => {
      window.dispatchEvent(new Event('shop2bhutan:network-restored'));
      window.dispatchEvent(new Event('shop2bhutan:request-bag-updated'));
      window.dispatchEvent(new Event('shop2bhutan:parcels-updated'));
      window.dispatchEvent(new Event('shop2bhutan:parcel-trips-updated'));
    };

    const recoverAfterReconnect = async () => {
      const now = Date.now();

      if (
        reconnectingRef.current ||
        now - lastReconnectAtRef.current < 1500
      ) {
        return;
      }

      reconnectingRef.current = true;
      lastReconnectAtRef.current = now;
      clearHideTimer();
      setState('restoring');

      try {
        await refreshContext();
        notifyDataRefresh();
        void setNumberPreference(
          'shop2bhutan:last-successful-refresh-at:v1',
          Date.now(),
        );

        if (!active) return;

        setState('restored');
        hideTimerRef.current = window.setTimeout(() => {
          if (active) setState('online');
        }, 2200);
      } catch (error) {
        console.warn(
          '[Network] Reconnected, but app refresh was deferred:',
          error,
        );

        if (active) setState('online');
      } finally {
        reconnectingRef.current = false;
      }
    };

    const applyStatus = (status: ConnectionStatus) => {
      if (!active) return;

      if (!status.connected) {
        clearHideTimer();
        wasOfflineRef.current = true;
        setState('offline');
        return;
      }

      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        void recoverAfterReconnect();
        return;
      }

      setState((current) =>
        current === 'offline' ? 'online' : current,
      );
    };

    const handleBrowserOnline = () => {
      applyStatus({ connected: true, connectionType: 'unknown' });
    };

    const handleBrowserOffline = () => {
      applyStatus({ connected: false, connectionType: 'none' });
    };

    void Network.getStatus()
      .then(applyStatus)
      .catch((error) => {
        console.warn('[Network] Initial status check skipped:', error);
        applyStatus({
          connected: navigator.onLine,
          connectionType: navigator.onLine ? 'unknown' : 'none',
        });
      });

    void Network.addListener('networkStatusChange', applyStatus)
      .then((listener) => {
        if (!active) {
          void listener.remove();
          return;
        }

        removeNetworkListener = () => listener.remove();
      })
      .catch((error) => {
        console.warn('[Network] Native listener skipped:', error);
      });

    // Keep browser events as a lightweight fallback for PWA environments.
    window.addEventListener('online', handleBrowserOnline);
    window.addEventListener('offline', handleBrowserOffline);

    return () => {
      active = false;
      clearHideTimer();
      window.removeEventListener('online', handleBrowserOnline);
      window.removeEventListener('offline', handleBrowserOffline);
      void removeNetworkListener?.();
    };
  }, [refreshContext]);

  if (state === 'online') return null;

  const offline = state === 'offline';
  const restoring = state === 'restoring';

  return (
    <div className="pointer-events-none fixed left-0 right-0 top-[calc(var(--s2b-safe-area-top,env(safe-area-inset-top,0px))+0.65rem)] z-[160] px-3 sm:px-4">
      <div
        role="status"
        aria-live="polite"
        className={`pointer-events-auto mx-auto flex max-w-md items-start gap-3 rounded-2xl border bg-white px-4 py-3 shadow-2xl shadow-slate-900/15 ${
          offline
            ? 'border-rose-100'
            : 'border-emerald-100'
        }`}
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            offline
              ? 'bg-rose-50 text-rose-600'
              : 'bg-emerald-50 text-emerald-600'
          }`}
        >
          {offline ? (
            <WifiOff size={19} strokeWidth={2.4} />
          ) : restoring ? (
            <Loader2 size={19} className="animate-spin" strokeWidth={2.4} />
          ) : (
            <Wifi size={19} strokeWidth={2.4} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-slate-950">
            {offline
              ? "You're offline"
              : restoring
                ? 'Internet restored'
                : 'Back online'}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">
            {offline
              ? 'Some information may be unavailable. Shop2Bhutan will refresh automatically when your connection returns.'
              : restoring
                ? 'Refreshing your account and latest information…'
                : 'Your Shop2Bhutan information has been refreshed.'}
          </p>
        </div>
      </div>
    </div>
  );
}

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

async function isInstallDismissed() {
  const dismissedUntil = await getNumberPreference(
    PWA_INSTALL_DISMISSED_UNTIL_KEY,
    0,
  );

  return dismissedUntil > Date.now();
}

async function dismissInstallBanner() {
  const dismissedUntil =
    Date.now() +
    PWA_INSTALL_DISMISS_DAYS * 24 * 60 * 60 * 1000;

  await setNumberPreference(
    PWA_INSTALL_DISMISSED_UNTIL_KEY,
    dismissedUntil,
  );
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
  const shouldHideForRoute =
    location.pathname.startsWith('/admin') ||
    location.pathname === '/download';

  useEffect(() => {
    let active = true;
    let showTimer: number | undefined;

    const scheduleBanner = async () => {
      if (isPwaStandalone() || isNativeAppRuntime()) {
        if (active) setVisible(false);
        return;
      }

      const dismissed = await isInstallDismissed();

      if (!active || dismissed) {
        if (active) setVisible(false);
        return;
      }

      showTimer = window.setTimeout(() => {
        // iOS Safari never gives beforeinstallprompt. Show manual install help.
        // For other mobile browsers, show a lightweight custom banner. If the
        // browser has the install prompt ready, the Install button opens it.
        if (active && isMobileBrowser()) setVisible(true);
      }, 900);
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const promptEvent = event as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);

      void isInstallDismissed().then((dismissed) => {
        if (
          active &&
          !dismissed &&
          !isPwaStandalone() &&
          !isNativeAppRuntime()
        ) {
          setVisible(true);
        }
      });
    };

    const handleInstalled = () => {
      setInstalled(true);
      setVisible(false);
      void dismissInstallBanner();
    };

    void scheduleBanner();

    window.addEventListener(
      'beforeinstallprompt',
      handleBeforeInstallPrompt,
    );
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      active = false;

      if (showTimer !== undefined) {
        window.clearTimeout(showTimer);
      }

      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt,
      );
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (iosSafari || !deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;

      if (choice.outcome === 'accepted') {
        await dismissInstallBanner();
        setVisible(false);
      }
    } finally {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    void dismissInstallBanner();
    setVisible(false);
  };

  if (installed || shouldHideForRoute || !visible || isPwaStandalone() || isNativeAppRuntime()) {
    return null;
  }

  return (
    <div className="fixed left-0 right-0 top-[calc(var(--s2b-safe-area-top,env(safe-area-inset-top,0px))+0.75rem)] z-[95] px-4">
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

async function getWebPushDismissedUntil() {
  return getNumberPreference(WEB_PUSH_DISMISS_KEY, 0);
}

async function dismissWebPushBanner() {
  const until =
    Date.now() +
    WEB_PUSH_DISMISS_DAYS * 24 * 60 * 60 * 1000;

  await setNumberPreference(WEB_PUSH_DISMISS_KEY, until);
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
  const [dismissalChecked, setDismissalChecked] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  const hiddenRoute =
    location.pathname.startsWith('/admin') ||
    location.pathname === '/login' ||
    location.pathname === '/register' ||
    location.pathname === '/forgot-password' ||
    location.pathname === '/reset-password' ||
    location.pathname === '/download';

  useEffect(() => {
    let active = true;

    void getWebPushDismissedUntil()
      .then((dismissedUntil) => {
        if (!active) return;

        setDismissed(dismissedUntil > Date.now());
        setDismissalChecked(true);
      })
      .catch((preferenceError) => {
        console.warn(
          '[WebPushPermissionBanner] Dismissal preference skipped:',
          preferenceError,
        );

        if (active) {
          setDismissed(false);
          setDismissalChecked(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

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
        return;
      }

      // Keep the banner hidden until the browser's real permission state has
      // been resolved. This prevents a one-frame flash on PWA launch/reload.
      setChecking(true);
      setError('');

      try {
        const state = await getPushPermissionState();

        if (!active) return;

        console.info('[WebPushPermissionBanner] Permission state:', state, {
          secureContext: window.isSecureContext,
          standalone: isStandaloneWebApp(),
          notificationApi: 'Notification' in window,
          serviceWorkerApi: 'serviceWorker' in navigator,
        });

        setPermissionState(state);
        setEnabled(false);
      } catch (permissionError) {
        console.warn(
          '[WebPushPermissionBanner] Permission check skipped:',
          permissionError,
        );

        if (active) {
          setPermissionState('unsupported');
        }
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    }

    if (
      loading ||
      isGuest ||
      !user?.id ||
      hiddenRoute ||
      isNativePushRuntime()
    ) {
      // Authentication and route transitions are temporary states. Keep the
      // banner fully hidden instead of showing the default permission state.
      setChecking(true);
    } else {
      void checkPermission();
    }

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
    void dismissWebPushBanner();
    setDismissed(true);
    setPermissionState('unsupported');
  };

  if (
    !dismissalChecked ||
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
    'fixed left-0 right-0 top-[calc(var(--s2b-safe-area-top,env(safe-area-inset-top,0px))+0.75rem)] z-[110] px-3 sm:px-4';

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
              You’ll receive final price, payment, order, and parcel updates.
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
              Enable notifications for final price, payment, order, and parcel updates—even when the PWA is closed.
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


function NativeShoppingAssistBridge() {
  const navigate = useNavigate();
  const checkingRef = useRef(false);
  const activeRef = useRef(true);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    activeRef.current = true;
    let removeResume: (() => Promise<void>) | undefined;
    let removeStateChange: (() => Promise<void>) | undefined;

    const openPendingCapture = async () => {
      if (checkingRef.current) return;

      checkingRef.current = true;

      try {
        const capture =
          await consumePendingShoppingAssistCapture();

        if (!activeRef.current || !capture) return;

        navigate('/shopping-assist/review', {
          state: { capture },
        });
      } finally {
        checkingRef.current = false;
      }
    };

    void openPendingCapture();

    void CapacitorApp.addListener('resume', () => {
      void openPendingCapture();
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
        if (isActive) void openPendingCapture();
      },
    ).then((listener) => {
      if (!activeRef.current) {
        void listener.remove();
        return;
      }

      removeStateChange = () => listener.remove();
    });

    const handleVisibilityChange = () => {
      if (!document.hidden) void openPendingCapture();
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

function SystemBarsBridge() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let active = true;
    let removeResume: (() => Promise<void>) | undefined;
    let removeStateChange: (() => Promise<void>) | undefined;

    const applyBars = () => {
      if (active) void applyShopSystemBars();
    };

    applyBars();

    void CapacitorApp.addListener('resume', applyBars).then(
      (listener) => {
        if (!active) {
          void listener.remove();
          return;
        }

        removeResume = () => listener.remove();
      },
    );

    void CapacitorApp.addListener(
      'appStateChange',
      ({ isActive }) => {
        if (isActive) applyBars();
      },
    ).then((listener) => {
      if (!active) {
        void listener.remove();
        return;
      }

      removeStateChange = () => listener.remove();
    });

    return () => {
      active = false;
      void removeResume?.();
      void removeStateChange?.();
    };
  }, []);

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


const CUSTOMER_MAINTENANCE_REFRESH_MS = 15_000;

function maintenancePhoneHref(value: string) {
  const clean = value.replace(/[^+\d]/g, '');
  return clean ? `tel:${clean}` : '';
}

function maintenanceWhatsappHref(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : '';
}

function CustomerMaintenanceScreen({
  settings,
  refreshing,
  error,
  isAdmin,
  onRetry,
}: {
  settings: AppSettingsType;
  refreshing: boolean;
  error: string;
  isAdmin: boolean;
  onRetry: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const phoneHref = maintenancePhoneHref(settings.supportPhone);
  const whatsappHref = maintenanceWhatsappHref(settings.whatsappNumber);

  return (
    <div className="fixed inset-0 z-[140] overflow-y-auto bg-white">
      <div className="mx-auto flex min-h-full w-full max-w-lg flex-col px-5 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] pt-[calc(1.25rem+var(--s2b-safe-area-top,env(safe-area-inset-top,0px)))]">
        <div className="flex items-center justify-center">
          {settings.logoUrl ? (
            <img
              src={settings.logoUrl}
              alt={settings.appName || 'Shop2Bhutan'}
              className="h-12 max-w-[210px] object-contain"
            />
          ) : (
            <Logo size="lg" />
          )}
        </div>

        <div className="flex flex-1 items-center py-8">
          <section className="w-full rounded-[30px] border border-orange-100 bg-white p-6 text-center shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-orange-50 text-orange-600">
              <Wrench size={30} strokeWidth={2.1} />
            </div>

            <p className="mt-5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-orange-600">
              Scheduled maintenance
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-[-0.03em] text-neutral-950">
              We&apos;ll be back shortly
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-neutral-600">
              {settings.maintenanceMessage ||
                'Shop2Bhutan is temporarily unavailable while we complete maintenance.'}
            </p>

            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-left">
              <div className="flex items-start gap-3">
                <ShieldCheck
                  size={19}
                  className="mt-0.5 shrink-0 text-blue-600"
                  strokeWidth={2.2}
                />
                <div>
                  <p className="text-sm font-extrabold text-neutral-900">
                    Your account information is safe
                  </p>
                  <p className="mt-1 text-xs leading-5 text-neutral-600">
                    Please retry after a moment. The app will also reopen
                    automatically when maintenance is switched off.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void onRetry()}
              disabled={refreshing}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 text-sm font-extrabold text-white transition active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
            >
              {refreshing ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <RefreshCw size={17} strokeWidth={2.3} />
              )}
              {refreshing ? 'Checking availability...' : 'Try again'}
            </button>

            <div className="mt-3 grid grid-cols-2 gap-3">
              {phoneHref ? (
                <a
                  href={phoneHref}
                  className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white text-sm font-bold text-neutral-700 transition active:scale-[0.99]"
                >
                  <Phone size={16} strokeWidth={2.2} />
                  Call support
                </a>
              ) : (
                <span className="flex h-11 cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-neutral-100 bg-neutral-50 text-sm font-bold text-neutral-300">
                  <Phone size={16} />
                  Call support
                </span>
              )}

              {whatsappHref ? (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 text-sm font-bold text-emerald-700 transition active:scale-[0.99]"
                >
                  <MessageCircle size={16} strokeWidth={2.2} />
                  WhatsApp
                </a>
              ) : (
                <span className="flex h-11 cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-neutral-100 bg-neutral-50 text-sm font-bold text-neutral-300">
                  <MessageCircle size={16} />
                  WhatsApp
                </span>
              )}
            </div>

            {isAdmin && (
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="mt-3 h-11 w-full rounded-2xl bg-neutral-950 px-4 text-sm font-extrabold text-white transition active:scale-[0.99]"
              >
                Open Admin Panel
              </button>
            )}

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold leading-5 text-red-600"
              >
                {error}
              </p>
            )}
          </section>
        </div>

        <p className="text-center text-[11px] leading-5 text-neutral-400">
          Normal announcements and customer actions remain hidden until
          maintenance is disabled.
        </p>
      </div>
    </div>
  );
}

function CustomerMaintenanceGate({ children }: { children: ReactNode }) {
  const { context } = useAuth();
  const [settings, setSettings] = useState<AppSettingsType>(
    DEFAULT_APP_SETTINGS,
  );
  const [checking, setChecking] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const mountedRef = useRef(true);

  const loadSettings = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError('');

    try {
      const loaded = await fetchPublicAppSettings();
      if (mountedRef.current) setSettings(loaded);
    } catch (loadError) {
      console.warn('[Maintenance] Availability check skipped:', loadError);

      if (mountedRef.current && manual) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to check availability. Please try again.',
        );
      }
    } finally {
      if (mountedRef.current) {
        setChecking(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadSettings(false);

    const refresh = () => {
      void loadSettings(false);
    };

    const handleVisibility = () => {
      if (!document.hidden) refresh();
    };

    window.addEventListener(
      'shop2bhutan:app-settings-updated',
      refresh,
    );
    window.addEventListener('shop2bhutan:network-restored', refresh);
    document.addEventListener('visibilitychange', handleVisibility);

    const interval = window.setInterval(() => {
      if (!document.hidden) refresh();
    }, CUSTOMER_MAINTENANCE_REFRESH_MS);

    const channel = supabase
      .channel('customer-maintenance-settings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
        },
        (payload) => {
          const nextKey = String(
            (payload.new as { key?: string } | null)?.key ??
              (payload.old as { key?: string } | null)?.key ??
              '',
          );

          if (
            !nextKey ||
            nextKey === 'maintenance_enabled' ||
            nextKey === 'maintenance_message' ||
            nextKey === 'support_phone' ||
            nextKey === 'whatsapp_number' ||
            nextKey === 'logo_url' ||
            nextKey === 'app_name'
          ) {
            refresh();
          }
        },
      )
      .subscribe();

    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
      window.removeEventListener(
        'shop2bhutan:app-settings-updated',
        refresh,
      );
      window.removeEventListener('shop2bhutan:network-restored', refresh);
      document.removeEventListener('visibilitychange', handleVisibility);
      void supabase.removeChannel(channel);
    };
  }, [loadSettings]);

  if (checking) {
    return (
      <div className="fixed inset-0 z-[140] flex items-center justify-center bg-white px-6">
        <div className="text-center">
          <Loader2
            size={28}
            className="mx-auto animate-spin text-orange-500"
          />
          <p className="mt-3 text-sm font-bold text-neutral-800">
            Checking Shop2Bhutan availability
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            This will only take a moment.
          </p>
        </div>
      </div>
    );
  }

  if (!settings.maintenanceEnabled) {
    return <>{children}</>;
  }

  return (
    <CustomerMaintenanceScreen
      settings={settings}
      refreshing={refreshing}
      error={error}
      isAdmin={Boolean(context?.is_admin || context?.is_super_admin)}
      onRetry={() => loadSettings(true)}
    />
  );
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
      <SystemBarsBridge />
      <NativeGoogleOAuthBridge />
      <NativeShareBridge />
      <NativeShoppingAssistBridge />
      <PushNotificationBridge />
      <RouteScrollToTop />
      <GlobalNetworkStatus />
      <PwaInstallBanner />
      <WebPushPermissionBanner />
      <Routes>
        {/* Auth Routes - No Layout */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Public download/install page - No customer layout */}
        <Route path="/download" element={<DownloadApp />} />

        {/* Customer Routes */}
        <Route
          element={
            <CustomerMaintenanceGate>
              <PasswordChangeGate>
                <GoogleProfileCompletionGate>
                  <CustomerLayout />
                </GoogleProfileCompletionGate>
              </PasswordChangeGate>
            </CustomerMaintenanceGate>
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
          <Route path="/shopping-assist" element={<ShoppingAssist />} />
          <Route path="/shopping-assist/review" element={<ShoppingAssistReview />} />

          {/* Customer-only routes/actions */}
          <Route
            path="/request-bag"
            element={
              <RequireAuth title="Sign in to view Request Bag" message="Save product links, screenshots, and quantities in your Request Bag before submitting a shopping request.">
                <RequestBag />
              </RequireAuth>
            }
          />
          <Route
            path="/cart"
            element={
              <RequireAuth title="Sign in to view Request Bag" message="Your old cart is now the Request Bag for shopping requests.">
                <RequestBag />
              </RequireAuth>
            }
          />
          <Route
            path="/checkout"
            element={
              <RequireAuth
                title="Sign in to checkout"
                message="Please sign in before submitting your request so we can save your final price, payment, and tracking history."
              >
                <Checkout />
              </RequireAuth>
            }
          />
          <Route
            path="/quotation/:orderId"
            element={
              <RequireAuth title="Sign in to review final price" message="Your confirmed final price is private and linked to your Shop2Bhutan account.">
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
              <RequireAuth title="Sign in to view orders" message="Your shopping requests, final prices, payments, and tracking updates are available after sign in.">
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
          <Route path="business" element={<BusinessFinance />} />
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
