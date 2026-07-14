import {
  useCallback,
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
const WEB_GUIDED_STORE_TTL_MS =
  30 * 60 * 1000;

type StoredGuidedStore = {
  store: ShoppingAssistStore;
  savedAt: number;
};

function isShoppingAssistStore(
  value: unknown,
): value is ShoppingAssistStore {
  return (
    typeof value === 'string' &&
    SHOPPING_ASSIST_STORES.some(
      (store) => store.key === value,
    )
  );
}

function clearGuidedStoreFromSession() {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(
      WEB_GUIDED_STORE_KEY,
    );
  } catch {
    // Ignore storage failures.
  }
}

function rememberGuidedStoreInSession(
  store: ShoppingAssistStoreDefinition,
) {
  if (typeof window === 'undefined') return;

  const storedGuide: StoredGuidedStore = {
    store: store.key,
    savedAt: Date.now(),
  };

  try {
    window.sessionStorage.setItem(
      WEB_GUIDED_STORE_KEY,
      JSON.stringify(storedGuide),
    );
  } catch {
    // The guide still works without session storage.
  }
}

function readGuidedStoreFromSession():
  | ShoppingAssistStore
  | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(
      WEB_GUIDED_STORE_KEY,
    );

    if (!raw) return null;

    try {
      const parsed = JSON.parse(
        raw,
      ) as Partial<StoredGuidedStore>;

      const expired =
        typeof parsed.savedAt !== 'number' ||
        Date.now() - parsed.savedAt >
          WEB_GUIDED_STORE_TTL_MS;

      if (
        !isShoppingAssistStore(parsed.store) ||
        expired
      ) {
        clearGuidedStoreFromSession();
        return null;
      }

      return parsed.store;
    } catch {
      // Support the earlier plain-string session value once,
      // then migrate it to the timestamped format.
      if (isShoppingAssistStore(raw)) {
        const storeDefinition =
          SHOPPING_ASSIST_STORES.find(
            (store) => store.key === raw,
          );

        if (storeDefinition) {
          rememberGuidedStoreInSession(
            storeDefinition,
          );
        }

        return raw;
      }

      clearGuidedStoreFromSession();
      return null;
    }
  } catch {
    return null;
  }
}

function extractClipboardUrl(value: string) {
  const match = value.match(
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

  const closeGuidedShopping =
    useCallback(() => {
      clearGuidedStoreFromSession();
      setGuidedStore(null);
      setShowResumeStep(false);
      setCheckingClipboard(false);
      setClipboardError('');
    }, []);

  const openStore = useCallback(
    async (store: ShoppingAssistStore) => {
      if (openingStore) return;

      const storeDefinition =
        SHOPPING_ASSIST_STORES.find(
          (item) => item.key === store,
        );

      if (!storeDefinition) return;

      setError('');
      setClipboardError('');

      if (!isNativeRuntime) {
        // A newly selected store must always replace any
        // stale guided-shopping session.
        clearGuidedStoreFromSession();
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
      } catch (openError) {
        console.warn(
          '[ShoppingAssist] Unable to open native store:',
          openError,
        );
        setError(
          'S2B Shopping Assist could not open this store. You can still paste or share the product link.',
        );
      } finally {
        setOpeningStore(null);
      }
    },
    [isNativeRuntime, openingStore],
  );

  const openGuidedStore = useCallback(() => {
    if (!guidedStore) return;

    setClipboardError('');

    const opened = window.open(
      guidedStore.url,
      '_blank',
    );

    if (!opened) {
      setClipboardError(
        'Your browser blocked the store tab. Allow pop-ups for Shop2Bhutan or use Paste manually.',
      );
      return;
    }

    try {
      opened.opener = null;
    } catch {
      // Some browsers do not expose the opened window.
    }

    rememberGuidedStoreInSession(
      guidedStore,
    );
    setShowResumeStep(true);
  }, [guidedStore]);

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

      clearGuidedStoreFromSession();
      setGuidedStore(null);
      setShowResumeStep(false);
      setClipboardError('');

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
    const sourcePlatform =
      guidedStore?.key;

    closeGuidedShopping();

    navigate('/paste-link', {
      state: {
        source: 'guided-web-shopping',
        sourcePlatform,
      },
    });
  };

  useEffect(() => {
    const preferredStore =
      locationState?.preferredStore;

    if (
      isNativeRuntime ||
      preferredStore
    ) {
      return undefined;
    }

    const restorePendingGuide = () => {
      if (
        document.visibilityState === 'hidden'
      ) {
        return;
      }

      const pendingStore =
        readGuidedStoreFromSession();

      if (!pendingStore) return;

      const storeDefinition =
        SHOPPING_ASSIST_STORES.find(
          (item) =>
            item.key === pendingStore,
        );

      if (!storeDefinition) {
        clearGuidedStoreFromSession();
        return;
      }

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
  }, [
    isNativeRuntime,
    locationState?.preferredStore,
  ]);

  useEffect(() => {
    const preferredStore =
      locationState?.preferredStore;

    if (!preferredStore) {
      autoOpenedRef.current = false;
      return;
    }

    if (autoOpenedRef.current) return;

    autoOpenedRef.current = true;

    // A direct launch instruction must win over any restored
    // web-guided session.
    clearGuidedStoreFromSession();
    setGuidedStore(null);
    setShowResumeStep(false);
    setClipboardError('');

    // Clear the one-time instruction before opening the native
    // Activity so resume/remount cannot reopen the same store.
    navigate(location.pathname, {
      replace: true,
      state: null,
    });

    void openStore(preferredStore);
  }, [
    location.pathname,
    locationState?.preferredStore,
    navigate,
    openStore,
  ]);

  useEffect(() => {
    if (
      isNativeRuntime ||
      !guidedStore
    ) {
      return undefined;
    }

    const previousOverflow =
      document.body.style.overflow;

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === 'Escape') {
        closeGuidedShopping();
      }
    };

    document.body.style.overflow =
      'hidden';
    window.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;
      window.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [
    closeGuidedShopping,
    guidedStore,
    isNativeRuntime,
  ]);

  return (
    <div className="min-h-[100dvh] bg-white">
      <header className="bg-white">
        <div className="mx-auto max-w-lg px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.8rem)]">
          <h1 className="text-[26px] font-extrabold tracking-tight text-slate-950">
            Shopping Assist
          </h1>
          <p className="mt-1 text-[13px] leading-5 text-slate-500">
            Choose a store, open a product and review it before saving.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-3">
        {/* Steps — centered, compact */}
        <section className="flex items-center justify-center gap-2 rounded-2xl bg-slate-50 px-3 py-3">
          {[
            ['1', 'Browse'],
            ['2', 'Review'],
            ['3', 'Request'],
          ].map(([step, label], index) => {
            const isCurrent = index === 0;

            return (
              <div key={step} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${
                      isCurrent
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    {step}
                  </span>
                  <span
                    className={`text-[11px] font-extrabold ${
                      isCurrent
                        ? 'text-slate-700'
                        : 'text-slate-400'
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {index < 2 && (
                  <span className="h-px w-3 shrink-0 bg-slate-300" />
                )}
              </div>
            );
          })}
        </section>

        <section className="mt-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-extrabold text-slate-950">
                Choose a store
              </h2>
              <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                {isNativeRuntime
                  ? 'Products open inside the S2B browser.'
                  : 'We will guide you through copying the product link.'}
              </p>
            </div>

            <span className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[9px] font-extrabold text-slate-500">
              {isNativeRuntime
                ? 'In-app'
                : 'Web guide'}
            </span>
          </div>

          {/* Store cards — individual cards instead of divided list */}
          <div
            className="mt-3 flex flex-col gap-2"
            aria-busy={Boolean(openingStore)}
          >
            {SHOPPING_ASSIST_STORES.map((store) => {
              const opening =
                openingStore === store.key;

              return (
                <button
                  key={store.key}
                  type="button"
                  onClick={() =>
                    void openStore(store.key)
                  }
                  disabled={Boolean(openingStore)}
                  className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm transition active:scale-[0.99] disabled:opacity-60"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-100 bg-white p-2.5">
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
                    <span className="mt-0.5 block text-[10px] text-slate-400">
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
                      className="shrink-0 text-slate-300"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="mt-4 rounded-2xl border border-red-200 bg-white px-4 py-3 text-xs font-semibold leading-5 text-red-600"
          >
            {error}
          </div>
        )}

        {/* Paste link — card style */}
        <section className="mt-5">
          <button
            type="button"
            onClick={() => navigate('/paste-link')}
            className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm transition active:scale-[0.99]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-orange-100 bg-white text-orange-500">
              <Link2 size={18} />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold text-slate-900">
                Already have a product link?
              </span>
              <span className="mt-0.5 block text-[10px] text-slate-400">
                Paste the link or upload a screenshot
              </span>
            </span>

            <ArrowRight
              size={16}
              className="shrink-0 text-slate-300"
            />
          </button>
        </section>

        {/* Trust badge — compact card */}
        <section className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
            <ShieldCheck size={17} strokeWidth={2.2} />
          </span>

          <div>
            <p className="text-xs font-extrabold text-slate-800">
              You stay in control
            </p>
            <p className="mt-1 text-[10px] leading-[17px] text-slate-500">
              Shop2Bhutan never handles your store password or checkout. Price and availability are confirmed during quotation.
            </p>
          </div>
        </section>
      </main>

      {!isNativeRuntime && guidedStore && (
        <div className="fixed inset-0 z-[140] flex items-end justify-center">
          <button
            type="button"
            aria-label="Close guided shopping"
            onClick={closeGuidedShopping}
            className="absolute inset-0 bg-slate-950/45"
          />

          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="guided-shopping-title"
            className="relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-[28px] bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-3 shadow-2xl"
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200" />

            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-100 bg-white p-2.5">
                <img
                  src={guidedStore.logo}
                  alt=""
                  className="h-full w-full object-contain"
                />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-orange-500">
                  Guided shopping
                </p>
                <h2
                  id="guided-shopping-title"
                  className="mt-0.5 text-[17px] font-extrabold text-slate-950"
                >
                  {showResumeStep
                    ? 'Use your copied product'
                    : `Shop on ${guidedStore.name}`}
                </h2>
                <p className="mt-1 text-[11px] leading-[18px] text-slate-500">
                  {showResumeStep
                    ? 'Return after copying the product link, then continue below.'
                    : 'Open a product, copy its link and return to Shop2Bhutan.'}
                </p>
              </div>

              <button
                type="button"
                onClick={closeGuidedShopping}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-100 bg-white text-slate-500"
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </div>

            {/* Modal steps — centered */}
            <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-slate-50 px-3 py-3">
              {[
                ['1', 'Open'],
                ['2', 'Copy'],
                ['3', 'Review'],
              ].map(([step, label], index) => {
                const currentStep =
                  showResumeStep ? 2 : 0;
                const isCompleted =
                  index < currentStep;
                const isCurrent =
                  index === currentStep;

                return (
                  <div key={step} className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${
                          isCompleted
                            ? 'bg-orange-500 text-white'
                            : isCurrent
                              ? 'bg-orange-50 text-orange-600 ring-1 ring-orange-200'
                              : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {step}
                      </span>
                      <span
                        className={`text-[10px] font-extrabold ${
                          isCompleted || isCurrent
                            ? 'text-slate-700'
                            : 'text-slate-400'
                        }`}
                      >
                        {label}
                      </span>
                    </div>
                    {index < 2 && (
                      <span
                        className={`h-px w-3 shrink-0 ${
                          index < currentStep
                            ? 'bg-orange-300'
                            : 'bg-slate-300'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-start gap-2.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-3">
              <Share2
                size={16}
                className="mt-0.5 shrink-0 text-blue-600"
              />
              <p className="text-[10px] leading-[17px] text-slate-600">
                Open a product and use the store's Share menu to copy its link.
              </p>
            </div>

            {clipboardError && (
              <div
                role="alert"
                aria-live="polite"
                className="mt-3 rounded-2xl border border-red-200 bg-white px-4 py-3 text-xs font-semibold leading-5 text-red-600"
              >
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
                    Open again
                  </button>

                  <button
                    type="button"
                    onClick={continueWithManualPaste}
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700"
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
                    rememberGuidedStoreInSession(
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
