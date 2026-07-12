import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { Capacitor } from '@capacitor/core';
import {
  ArrowRight,
  ClipboardPaste,
  ExternalLink,
  Link2,
  Loader2,
  ShieldCheck,
  Share2,
  ShoppingBag,
  Sparkles,
  X,
} from 'lucide-react';
import {
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  openShoppingAssist,
  SHOPPING_ASSIST_STORES,
} from '@/lib/shoppingAssist';
import type { ShoppingAssistStore } from '@/types';

type ShoppingAssistLocationState = {
  preferredStore?: ShoppingAssistStore;
};

type ShoppingAssistStoreDefinition =
  (typeof SHOPPING_ASSIST_STORES)[number];

const WEB_GUIDED_STORE_KEY =
  'shop2bhutan:web-guided-shopping-store:v1';

function extractClipboardUrl(value: string) {
  const match = String(value || '').match(
    /https?:\/\/[^\s<>"']+/i,
  );

  if (!match?.[0]) return '';

  const candidate = match[0].replace(
    /[),.;!?]+$/g,
    '',
  );

  try {
    const parsed = new URL(candidate);

    if (
      parsed.protocol !== 'https:' &&
      parsed.protocol !== 'http:'
    ) {
      return '';
    }

    return parsed.toString();
  } catch {
    return '';
  }
}

export default function ShoppingAssist() {
  const navigate = useNavigate();
  const location = useLocation();
  const [openingStore, setOpeningStore] =
    useState<ShoppingAssistStore | null>(null);
  const [guidedStore, setGuidedStore] =
    useState<ShoppingAssistStoreDefinition | null>(
      null,
    );
  const [showResumeStep, setShowResumeStep] =
    useState(false);
  const [
    checkingClipboard,
    setCheckingClipboard,
  ] = useState(false);
  const [clipboardError, setClipboardError] =
    useState('');
  const [error, setError] = useState('');
  const autoOpenedRef = useRef(false);
  const isNativeRuntime =
    Capacitor.isNativePlatform();

  const locationState =
    location.state as ShoppingAssistLocationState | null;

  const openStore = async (
    store: ShoppingAssistStore,
  ) => {
    if (openingStore) return;

    const storeDefinition =
      SHOPPING_ASSIST_STORES.find(
        (item) => item.key === store,
      );

    if (!storeDefinition) return;

    setError('');
    setClipboardError('');

    if (!isNativeRuntime) {
      setGuidedStore(storeDefinition);
      setShowResumeStep(false);
      return;
    }

    setOpeningStore(store);

    try {
      const opened = await openShoppingAssist({
        store,
      });

      if (!opened) {
        setError(
          'S2B Shopping Assist could not open this store. You can still paste or share the product link.',
        );
      }
    } finally {
      setOpeningStore(null);
    }
  };

  const rememberGuidedStore = (
    store: ShoppingAssistStoreDefinition,
  ) => {
    try {
      window.sessionStorage.setItem(
        WEB_GUIDED_STORE_KEY,
        store.key,
      );
    } catch {
      // The guide still works without session storage.
    }
  };

  const clearGuidedStore = () => {
    try {
      window.sessionStorage.removeItem(
        WEB_GUIDED_STORE_KEY,
      );
    } catch {
      // Ignore storage failures.
    }
  };

  const openGuidedStore = () => {
    if (!guidedStore) return;

    rememberGuidedStore(guidedStore);
    setShowResumeStep(true);
    setClipboardError('');

    const opened = window.open(
      guidedStore.url,
      '_blank',
      'noopener,noreferrer',
    );

    if (!opened) {
      window.location.assign(
        guidedStore.url,
      );
    }
  };

  const useCopiedProduct = async () => {
    if (checkingClipboard) return;

    setCheckingClipboard(true);
    setClipboardError('');

    try {
      if (!navigator.clipboard?.readText) {
        throw new Error('Clipboard unavailable');
      }

      const clipboardText =
        await navigator.clipboard.readText();
      const productUrl =
        extractClipboardUrl(clipboardText);

      if (!productUrl) {
        setClipboardError(
          'No product link was found. Open the product, copy its full link, then try again.',
        );
        return;
      }

      clearGuidedStore();
      setGuidedStore(null);
      setShowResumeStep(false);

      navigate(
        `/shopping-assist/review?url=${encodeURIComponent(
          productUrl,
        )}`,
      );
    } catch {
      setClipboardError(
        'Clipboard access was blocked. Use Paste manually and press Paste inside the product-link field.',
      );
    } finally {
      setCheckingClipboard(false);
    }
  };

  const continueWithManualPaste = () => {
    clearGuidedStore();

    navigate('/paste-link', {
      state: {
        source: 'guided-web-shopping',
        sourcePlatform:
          guidedStore?.key,
      },
    });
  };

  useEffect(() => {
    if (isNativeRuntime) return undefined;

    const restorePendingGuide = () => {
      if (
        document.visibilityState === 'hidden'
      ) {
        return;
      }

      let pendingStore:
        | ShoppingAssistStore
        | null = null;

      try {
        pendingStore =
          window.sessionStorage.getItem(
            WEB_GUIDED_STORE_KEY,
          ) as ShoppingAssistStore | null;
      } catch {
        pendingStore = null;
      }

      if (!pendingStore) return;

      const storeDefinition =
        SHOPPING_ASSIST_STORES.find(
          (item) =>
            item.key === pendingStore,
        );

      if (!storeDefinition) return;

      setGuidedStore(storeDefinition);
      setShowResumeStep(true);
      setClipboardError('');
    };

    restorePendingGuide();

    window.addEventListener(
      'focus',
      restorePendingGuide,
    );
    document.addEventListener(
      'visibilitychange',
      restorePendingGuide,
    );

    return () => {
      window.removeEventListener(
        'focus',
        restorePendingGuide,
      );
      document.removeEventListener(
        'visibilitychange',
        restorePendingGuide,
      );
    };
  }, [isNativeRuntime]);

  useEffect(() => {
    const preferredStore =
      locationState?.preferredStore;

    if (
      !preferredStore ||
      autoOpenedRef.current
    ) {
      return;
    }

    autoOpenedRef.current = true;

    // preferredStore is a one-time launch instruction. Clear it before
    // opening the native Activity so an app resume/remount cannot open
    // the same store again on top of the product review page.
    navigate(location.pathname, {
      replace: true,
      state: null,
    });

    void openStore(preferredStore);
  }, [
    location.pathname,
    locationState?.preferredStore,
    navigate,
  ]);

  return (
    <div className="min-h-[100dvh] bg-white">
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto max-w-lg px-4 pb-4 pt-[calc(env(safe-area-inset-top)+0.9rem)]">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-orange-500">
            Shop2Bhutan
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950">
            S2B Shopping Assist
          </h1>
          <p className="mt-1.5 max-w-md text-[13px] leading-5 text-slate-500">
            Browse supported Indian stores, open a product and add it to your Request Bag.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-4">
        <section className="overflow-hidden rounded-[26px] border border-orange-100 bg-orange-50/60 p-5">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-orange-600 shadow-sm ring-1 ring-orange-100">
              <Sparkles size={22} strokeWidth={2.3} />
            </span>

            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-extrabold text-slate-950">
                Find it there. Request it here.
              </h2>
              <p className="mt-1.5 text-xs leading-5 text-slate-600">
                Product name, photo and displayed price are checked from the page you are viewing. You review everything before saving.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              ['1', 'Browse'],
              ['2', 'Review'],
              ['3', 'Request'],
            ].map(([step, label]) => (
              <div
                key={step}
                className="rounded-2xl bg-white px-2 py-3 text-center ring-1 ring-orange-100"
              >
                <span className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-[11px] font-extrabold text-white">
                  {step}
                </span>
                <p className="mt-1.5 text-[10px] font-extrabold text-slate-700">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-orange-500">
                Supported stores
              </p>
              <h2 className="mt-1 text-lg font-extrabold text-slate-950">
                Choose where to browse
              </h2>
            </div>

            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-extrabold text-blue-600">
              {isNativeRuntime
                ? 'Secure browser'
                : 'Guided web flow'}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            {SHOPPING_ASSIST_STORES.map((store) => {
              const opening = openingStore === store.key;

              return (
                <button
                  key={store.key}
                  type="button"
                  onClick={() => void openStore(store.key)}
                  disabled={Boolean(openingStore)}
                  className="group flex min-h-[108px] items-center gap-3 rounded-[22px] border border-slate-100 bg-white p-4 text-left shadow-sm shadow-slate-100 transition active:scale-[0.98] disabled:opacity-60"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-50 p-2.5 ring-1 ring-slate-100">
                    <img
                      src={store.logo}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold text-slate-900">
                      {store.name}
                    </span>
                    <span className="mt-1 block text-[10px] font-semibold text-slate-400">
                      {isNativeRuntime
                        ? 'Browse products'
                        : 'Open guided shopping'}
                    </span>
                  </span>

                  {opening ? (
                    <Loader2
                      size={18}
                      className="shrink-0 animate-spin text-orange-500"
                    />
                  ) : (
                    <ArrowRight
                      size={17}
                      className="shrink-0 text-slate-300 transition group-active:translate-x-0.5"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {error && (
          <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-800">
            {error}
          </div>
        )}

        <section className="mt-6 rounded-[24px] border border-slate-100 bg-slate-50/70 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-600 ring-1 ring-slate-100">
              <ShieldCheck size={19} strokeWidth={2.3} />
            </span>
            <div>
              <p className="text-sm font-extrabold text-slate-900">
                You stay in control
              </p>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">
                Shop2Bhutan does not handle your shopping-site password or checkout. The detected price is verified again during quotation.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => navigate('/paste-link')}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 transition active:scale-[0.98]"
          >
            <Link2 size={16} />
            Paste a link
          </button>

          <button
            type="button"
            onClick={() => navigate('/request-bag')}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 text-xs font-extrabold text-white transition active:scale-[0.98]"
          >
            <ShoppingBag size={16} />
            View Request Bag
          </button>
        </div>

        <p className="mt-5 text-center text-[10px] leading-4 text-slate-400">
          Shop2Bhutan is an independent shopping-assistance service and is not affiliated with the supported stores.
        </p>
      </main>

      {!isNativeRuntime && guidedStore && (
        <div className="fixed inset-0 z-[140] flex items-end justify-center">
          <button
            type="button"
            aria-label="Close guided shopping"
            onClick={() => {
              setGuidedStore(null);
              setClipboardError('');
            }}
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
          />

          <section className="relative z-10 w-full max-w-lg rounded-t-[30px] bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4 shadow-2xl">
            <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-slate-200" />

            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-50 p-2.5 ring-1 ring-slate-100">
                <img
                  src={guidedStore.logo}
                  alt=""
                  className="h-full w-full object-contain"
                />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-orange-500">
                  Guided Shopping Assist
                </p>
                <h2 className="mt-1 text-lg font-extrabold text-slate-950">
                  {showResumeStep
                    ? 'Ready to review your product?'
                    : `Shop on ${guidedStore.name}`}
                </h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {showResumeStep
                    ? 'After copying the product link, return here and use it to prepare the same review screen.'
                    : 'Follow these three steps for an experience close to the Android app.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setGuidedStore(null);
                  setClipboardError('');
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-500"
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                ['1', 'Open store'],
                ['2', 'Copy link'],
                ['3', 'Review'],
              ].map(([step, label]) => (
                <div
                  key={step}
                  className="rounded-2xl border border-slate-100 bg-slate-50 px-2 py-3 text-center"
                >
                  <span className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-[11px] font-extrabold text-white">
                    {step}
                  </span>
                  <p className="mt-1.5 text-[10px] font-extrabold text-slate-700">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-3.5">
              <div className="flex items-start gap-2.5">
                <Share2
                  size={17}
                  className="mt-0.5 shrink-0 text-blue-600"
                />
                <p className="text-[11px] leading-5 text-blue-800">
                  Open a product, choose Copy link from the store’s Share menu, then return to Shop2Bhutan.
                </p>
              </div>
            </div>

            {clipboardError && (
              <div className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-700">
                {clipboardError}
              </div>
            )}

            {showResumeStep ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    void useCopiedProduct()
                  }
                  disabled={checkingClipboard}
                  className="mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 text-sm font-extrabold text-white transition active:scale-[0.98] disabled:opacity-60"
                >
                  {checkingClipboard ? (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <ClipboardPaste size={17} />
                  )}
                  {checkingClipboard
                    ? 'Checking copied link…'
                    : 'Use copied product'}
                </button>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={openGuidedStore}
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700"
                  >
                    <ExternalLink size={15} />
                    Open store again
                  </button>

                  <button
                    type="button"
                    onClick={
                      continueWithManualPaste
                    }
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 text-xs font-extrabold text-white"
                  >
                    <Link2 size={15} />
                    Paste manually
                  </button>
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={openGuidedStore}
                  className="mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 text-sm font-extrabold text-white transition active:scale-[0.98]"
                >
                  <ExternalLink size={17} />
                  Open {guidedStore.name}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowResumeStep(true);
                    rememberGuidedStore(
                      guidedStore,
                    );
                  }}
                  className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700"
                >
                  <ClipboardPaste size={16} />
                  I already copied the link
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
