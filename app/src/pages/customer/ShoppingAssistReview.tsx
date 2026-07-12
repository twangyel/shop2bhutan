import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ImageOff,
  Loader2,
  Minus,
  Package,
  Plus,
  RotateCcw,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import {
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  addItemToRequestBag,
  detectSourcePlatformFromUrl,
  fetchProductLinkPreview,
  inferProductNameFromUrl,
  normalizeProductUrl,
} from '@/lib/customerOrders';
import {
  clearShoppingAssistCapture,
  openShoppingAssist,
  readShoppingAssistCapture,
  readWebShareTarget,
  saveShoppingAssistCapture,
} from '@/lib/shoppingAssist';
import type {
  ShoppingAssistCapture,
  ShoppingAssistStore,
} from '@/types';

type ReviewLocationState = {
  capture?: ShoppingAssistCapture;
};

function storeLabel(store: ShoppingAssistStore) {
  if (store === 'amazon') return 'Amazon';
  if (store === 'flipkart') return 'Flipkart';
  if (store === 'myntra') return 'Myntra';
  return 'Meesho';
}

function priceText(value: number) {
  if (!value || value <= 0) return 'To be verified';
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function isUsefulTitle(value: string) {
  const clean = value.trim().toLowerCase();

  if (clean.length < 5) return false;

  if (
    [
      'amazon',
      'flipkart',
      'myntra',
      'meesho',
      's2b shopping assist',
    ].includes(clean)
  ) {
    return false;
  }

  return ![
    'site maintenance',
    'under maintenance',
    'service unavailable',
    'temporarily unavailable',
    'something went wrong',
    'access denied',
    'request blocked',
    'robot check',
    'captcha',
    'page not found',
    'please try again later',
    'hey, check out this product on meesho',
    'get upto 25% off',
  ].some((phrase) => clean.includes(phrase));
}

export default function ShoppingAssistReview() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isGuest } = useAuth();

  const locationState =
    location.state as ReviewLocationState | null;

  const webShareTarget = useMemo(
    () => readWebShareTarget(location.search),
    [location.search],
  );

  const storedCapture =
    readShoppingAssistCapture();

  const initialCapture =
    locationState?.capture ??
    (webShareTarget?.url
      ? null
      : storedCapture);

  const [capture, setCapture] =
    useState<ShoppingAssistCapture | null>(
      initialCapture,
    );
  const [title, setTitle] = useState(
    initialCapture?.title ?? '',
  );
  const [price, setPrice] = useState(
    initialCapture?.displayedPrice
      ? String(initialCapture.displayedPrice)
      : '',
  );
  const [variant, setVariant] = useState(
    initialCapture?.variant ?? '',
  );
  const [quantity, setQuantity] = useState(1);
  const [imageFailed, setImageFailed] =
    useState(false);
  const [checkingFallback, setCheckingFallback] =
    useState(false);
  const [
    preparingWebShare,
    setPreparingWebShare,
  ] = useState(
    Boolean(!initialCapture && webShareTarget?.url),
  );
  const [webShareError, setWebShareError] =
    useState('');
  const [adding, setAdding] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [optionReminderOpen, setOptionReminderOpen] = useState(false);
  const variantInputRef = useRef<HTMLInputElement>(null);
  const fallbackCheckedRef = useRef(false);
  const lastPreparedUrlRef = useRef('');

  const displayedPrice = useMemo(() => {
    const numeric = Number(
      String(price).replace(/,/g, ''),
    );

    return Number.isFinite(numeric) && numeric > 0
      ? numeric
      : 0;
  }, [price]);

  useEffect(() => {
    if (!webShareTarget?.url) {
      lastPreparedUrlRef.current = '';
      return;
    }

    const sharedTarget = webShareTarget;
    const sourceUrl = normalizeProductUrl(
      sharedTarget.url,
    );

    if (
      !sourceUrl ||
      lastPreparedUrlRef.current === sourceUrl
    ) {
      return;
    }

    lastPreparedUrlRef.current = sourceUrl;
    let active = true;

    async function prepareSharedProduct() {
      setPreparingWebShare(true);
      setWebShareError('');
      setError('');
      setSuccess(false);
      setImageFailed(false);
      fallbackCheckedRef.current = false;

      clearShoppingAssistCapture();
      setCapture(null);
      setTitle('');
      setPrice('');
      setVariant('');
      setQuantity(1);

      const detectedPlatform =
        detectSourcePlatformFromUrl(sourceUrl);

      const store: ShoppingAssistStore | null =
        detectedPlatform === 'amazon' ||
        detectedPlatform === 'flipkart' ||
        detectedPlatform === 'myntra' ||
        detectedPlatform === 'meesho'
          ? detectedPlatform
          : null;

      if (!store) {
        if (active) {
          setPreparingWebShare(false);
          setWebShareError(
            'Share a product from Amazon, Flipkart, Myntra, or Meesho.',
          );
        }
        return;
      }

      try {
        const preview =
          await fetchProductLinkPreview(sourceUrl);

        if (!active) return;

        const previewTitle =
          String(preview?.title ?? '').trim();
        const sharedTitle =
          String(sharedTarget.title ?? '').trim();

        const resolvedTitle =
          isUsefulTitle(previewTitle)
            ? previewTitle
            : isUsefulTitle(sharedTitle)
              ? sharedTitle
              : inferProductNameFromUrl(
                  sourceUrl,
                  store,
                );

        const nextCapture: ShoppingAssistCapture = {
          sourceUrl,
          canonicalUrl: sourceUrl,
          store,
          title: resolvedTitle,
          image: preview?.image || '',
          displayedPrice:
            preview?.price || 0,
          currency: 'INR',
          variant: '',
          captureMethod:
            preview?.fetched
              ? 'open_graph'
              : 'page_fallback',
          confidence:
            preview?.fetched
              ? 70
              : 35,
          capturedAt:
            sharedTarget.receivedAt,
        };

        saveShoppingAssistCapture(
          nextCapture,
        );
        setCapture(nextCapture);
        setTitle(nextCapture.title);
        setPrice(
          nextCapture.displayedPrice > 0
            ? String(
                nextCapture.displayedPrice,
              )
            : '',
        );
        setVariant('');
        setImageFailed(false);

        navigate(
          '/shopping-assist/review',
          {
            replace: true,
            state: {
              capture: nextCapture,
            },
          },
        );
      } catch {
        if (active) {
          setWebShareError(
            'The product link was received, but its details could not be checked. Open Paste Link to continue.',
          );
        }
      } finally {
        if (active) {
          setPreparingWebShare(false);
        }
      }
    }

    void prepareSharedProduct();

    return () => {
      active = false;
    };
  }, [
    navigate,
    webShareTarget?.receivedAt,
    webShareTarget?.title,
    webShareTarget?.url,
  ]);

  useEffect(() => {
    if (capture) {
      saveShoppingAssistCapture(capture);
    }
  }, [capture]);

  useEffect(() => {
    setImageFailed(false);
    fallbackCheckedRef.current = false;
  }, [
    capture?.sourceUrl,
    capture?.image,
  ]);

  useEffect(() => {
    if (!capture) return;

    const currentCapture: ShoppingAssistCapture = capture;

    if (
      fallbackCheckedRef.current ||
      (
        isUsefulTitle(currentCapture.title) &&
        currentCapture.image &&
        !imageFailed &&
        currentCapture.displayedPrice > 0
      )
    ) {
      return;
    }

    fallbackCheckedRef.current = true;
    let active = true;

    async function improveCapture(
      captureSnapshot: ShoppingAssistCapture,
    ) {
      setCheckingFallback(true);

      try {
        const preview =
          await fetchProductLinkPreview(
            captureSnapshot.sourceUrl,
          );

        if (!active || !preview) return;

        const next: ShoppingAssistCapture = {
          ...captureSnapshot,
          title:
            isUsefulTitle(captureSnapshot.title)
              ? captureSnapshot.title
              : preview.title ||
                inferProductNameFromUrl(
                  captureSnapshot.sourceUrl,
                  captureSnapshot.store,
                ),
          image:
            imageFailed
              ? preview.image ||
                captureSnapshot.image ||
                ''
              : captureSnapshot.image ||
                preview.image ||
                '',
          displayedPrice:
            captureSnapshot.displayedPrice ||
            preview.price ||
            0,
          confidence: Math.max(
            captureSnapshot.confidence,
            preview.fetched ? 70 : 35,
          ),
        };

        setCapture(next);

        if (
          preview.image &&
          preview.image !==
            captureSnapshot.image
        ) {
          setImageFailed(false);
        }

        if (!isUsefulTitle(title)) {
          setTitle(next.title);
        }

        if (!price && next.displayedPrice > 0) {
          setPrice(String(next.displayedPrice));
        }
      } catch {
        // Native capture remains available.
      } finally {
        if (active) setCheckingFallback(false);
      }
    }

    void improveCapture(currentCapture);

    return () => {
      active = false;
    };
  }, [
    capture,
    imageFailed,
    price,
    title,
  ]);

  if (!capture) {
    if (preparingWebShare) {
      return (
        <div className="flex min-h-[100dvh] items-center justify-center bg-white px-5">
          <div className="w-full max-w-sm text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-orange-50 text-orange-500">
              <Loader2
                size={28}
                className="animate-spin"
              />
            </span>
            <h1 className="mt-5 text-xl font-extrabold text-slate-950">
              Preparing your product
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Shop2Bhutan is checking the shared link, product name, photo, and displayed price.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-white px-5">
        <div className="w-full max-w-sm text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-orange-50 text-orange-500">
            <Package size={28} />
          </span>
          <h1 className="mt-5 text-xl font-extrabold text-slate-950">
            {webShareError
              ? 'Shared product needs review'
              : 'No product is waiting'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {webShareError ||
              'Browse a supported store and choose a product first.'}
          </p>

          {webShareError && webShareTarget?.url && (
            <button
              type="button"
              onClick={() =>
                navigate('/paste-link', {
                  replace: true,
                  state: {
                    initialUrl:
                      webShareTarget.url,
                    sharedTitle:
                      webShareTarget.title,
                    source:
                      'pwa-share-target',
                    receivedAt:
                      webShareTarget.receivedAt,
                  },
                })
              }
              className="mt-6 h-12 w-full rounded-2xl bg-orange-500 text-sm font-extrabold text-white"
            >
              Continue with Paste Link
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              navigate(
                '/shopping-assist',
                { replace: true },
              )
            }
            className={`h-12 w-full rounded-2xl text-sm font-extrabold ${
              webShareError
                ? 'mt-3 border border-slate-200 bg-white text-slate-700'
                : 'mt-6 bg-orange-500 text-white'
            }`}
          >
            Open S2B Shopping Assist
          </button>
        </div>
      </div>
    );
  }

  const addProductToRequestBag = async () => {
    setError('');

    if (!title.trim()) {
      setError('Please confirm the product name.');
      return;
    }

    if (!user || isGuest) {
      saveShoppingAssistCapture({
        ...capture,
        title: title.trim(),
        displayedPrice,
        variant: variant.trim(),
      });

      navigate('/login', {
        state: {
          from: '/shopping-assist/review',
        },
      });
      return;
    }

    setAdding(true);

    try {
      await addItemToRequestBag({
        userId: user.id,
        item: {
          // Always save the exact URL currently open in the native
          // shopping browser. Flipkart and Myntra can expose stale or
          // homepage canonical tags during client-side navigation.
          sourceUrl:
            capture.sourceUrl ||
            capture.canonicalUrl,
          sourcePlatform: capture.store,
          productName: title.trim(),
          productImage: capture.image,
          price: displayedPrice,
          quantity,
          notes: variant.trim()
            ? `Selected option: ${variant.trim()}`
            : '',
        },
      });

      clearShoppingAssistCapture();

      window.dispatchEvent(
        new Event(
          'shop2bhutan:request-bag-updated',
        ),
      );

      setSuccess(true);
    } catch (addError) {
      setError(
        addError instanceof Error
          ? addError.message
          : 'Unable to add this product.',
      );
    } finally {
      setAdding(false);
    }
  };

  const handleAdd = () => {
    setError('');

    if (!title.trim()) {
      setError('Please confirm the product name.');
      return;
    }

    if (!variant.trim()) {
      setOptionReminderOpen(true);
      return;
    }

    void addProductToRequestBag();
  };

  const focusOptionField = () => {
    setOptionReminderOpen(false);

    window.setTimeout(() => {
      variantInputRef.current?.focus();
      variantInputRef.current?.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      });
    }, 80);
  };

  if (success) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-white px-5">
        <div className="w-full max-w-sm text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={30} strokeWidth={2.4} />
          </span>
          <h1 className="mt-5 text-xl font-extrabold text-slate-950">
            Added to Request Bag
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Continue browsing or review your products before submitting your shopping request.
          </p>

          <button
            type="button"
            onClick={() =>
              void openShoppingAssist({
                store: capture.store,
              })
            }
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-extrabold text-slate-700"
          >
            <RotateCcw size={17} />
            Continue shopping
          </button>

          <button
            type="button"
            onClick={() =>
              navigate('/request-bag', {
                replace: true,
              })
            }
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 text-sm font-extrabold text-white"
          >
            <ShoppingBag size={17} />
            View Request Bag
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-white">
      {optionReminderOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] backdrop-blur-[2px] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="option-reminder-title"
        >
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setOptionReminderOpen(false)}
            aria-label="Close option reminder"
          />

          <section className="relative z-10 w-full max-w-sm rounded-[26px] bg-white p-5 shadow-2xl">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
              <Sparkles size={21} strokeWidth={2.3} />
            </span>

            <h2
              id="option-reminder-title"
              className="mt-4 text-lg font-extrabold tracking-tight text-slate-950"
            >
              Any size, colour or option?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Some products have variations. Add the exact option so we can
              confirm the correct item. You may continue without one when the
              product has no variation.
            </p>

            <div className="mt-5 grid gap-2.5">
              <button
                type="button"
                onClick={focusOptionField}
                className="flex h-12 items-center justify-center rounded-2xl bg-orange-500 text-sm font-extrabold text-white transition active:scale-[0.98]"
              >
                Add size, colour or option
              </button>

              <button
                type="button"
                onClick={() => {
                  setOptionReminderOpen(false);
                  void addProductToRequestBag();
                }}
                className="flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700 transition active:scale-[0.98] active:bg-slate-50"
              >
                Continue without option
              </button>
            </div>
          </section>
        </div>
      )}

      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <button
            type="button"
            onClick={() => navigate('/shopping-assist')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-600"
            aria-label="Back to shopping assist"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-orange-500">
              S2B Shopping Assist
            </p>
            <h1 className="mt-0.5 text-xl font-extrabold text-slate-950">
              Review product
            </h1>
          </div>

          <span className="rounded-full bg-slate-50 px-3 py-1.5 text-[10px] font-extrabold text-slate-600">
            {storeLabel(capture.store)}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-[calc(9rem+env(safe-area-inset-bottom))] pt-4">
        <section className="overflow-hidden rounded-[26px] border border-slate-100 bg-white shadow-sm shadow-slate-100">
          <div className="relative flex min-h-[250px] items-center justify-center bg-slate-50">
            {capture.image && !imageFailed ? (
              <img
                src={capture.image}
                alt=""
                onError={() => setImageFailed(true)}
                className="max-h-[330px] w-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center text-slate-400">
                <ImageOff size={34} strokeWidth={1.8} />
                <p className="mt-2 text-xs font-bold">
                  Product image unavailable
                </p>
              </div>
            )}

            <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-extrabold text-slate-700 shadow-sm ring-1 ring-slate-100">
              {priceText(displayedPrice)}
            </span>

            {checkingFallback && (
              <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-bold text-slate-500 shadow-sm">
                <Loader2 size={12} className="animate-spin text-orange-500" />
                Checking details
              </span>
            )}
          </div>

          <div className="space-y-4 p-4">
            <div>
              <label
                htmlFor="assist-product-name"
                className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400"
              >
                Product name
              </label>
              <textarea
                id="assist-product-name"
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                rows={3}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold leading-5 text-slate-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10"
              />
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div>
                <label
                  htmlFor="assist-price"
                  className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400"
                >
                  Displayed price
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-slate-400">
                    ₹
                  </span>
                  <input
                    id="assist-price"
                    value={price}
                    readOnly
                    aria-readonly="true"
                    placeholder="To verify"
                    className="h-12 w-full cursor-default rounded-2xl border border-slate-200 bg-slate-50 pl-8 pr-3 text-sm font-extrabold text-slate-700 outline-none"
                  />
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400">
                  Quantity
                </p>
                <div className="flex h-12 items-center rounded-2xl border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity((current) =>
                        Math.max(1, current - 1),
                      )
                    }
                    className="flex h-full w-11 items-center justify-center text-slate-500"
                  >
                    <Minus size={15} />
                  </button>
                  <span className="w-8 text-center text-sm font-extrabold text-slate-900">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity((current) =>
                        Math.min(20, current + 1),
                      )
                    }
                    className="flex h-full w-11 items-center justify-center text-orange-500"
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="assist-variant"
                className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400"
              >
                Size, colour or option
              </label>
              <input
                ref={variantInputRef}
                id="assist-variant"
                value={variant}
                onChange={(event) =>
                  setVariant(event.target.value)
                }
                placeholder="Example: Black, Size M"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10"
              />
              <p className="mt-1.5 text-xs leading-5 text-slate-400">
                Optional. Add this only when the product has a size, colour,
                storage, pattern, or another variation.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-4 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600">
            <Sparkles size={17} />
          </span>
          <p className="text-[11px] leading-5 text-blue-800">
            The displayed store price is a reference. Shop2Bhutan verifies availability, selected option and final charges before you pay.
          </p>
        </section>

        {error && (
          <div className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-700">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleAdd}
          disabled={adding}
          className="mt-4 flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-orange-500 text-sm font-extrabold text-white shadow-lg shadow-orange-500/20 transition active:scale-[0.98] disabled:opacity-60"
        >
          {adding ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Adding product…
            </>
          ) : (
            <>
              <ShoppingBag size={18} />
              {!user || isGuest
                ? 'Sign in to add product'
                : 'Add to Request Bag'}
            </>
          )}
        </button>
      </main>
    </div>
  );
}
