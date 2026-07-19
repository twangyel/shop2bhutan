import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Minus,
  Package,
  Plus,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  X,
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
import {
  consumeRestoredCameraFile,
  isCameraCancellation,
  isNativeCameraRuntime,
  NATIVE_CAMERA_RESTORED_EVENT,
  pickNativeImageFile,
} from '@/lib/camera';
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
  if (!value || value <= 0) return 'Price pending';
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function storeLogo(store: ShoppingAssistStore) {
  return `/store-logos/${store}.png`;
}

function fallbackProductName(store: ShoppingAssistStore) {
  return `${storeLabel(store)} product`;
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
      'product from amazon',
      'product from flipkart',
      'product from myntra',
      'product from meesho',
      'amazon product',
      'flipkart product',
      'myntra product',
      'meesho product',
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
  const [screenshotFile, setScreenshotFile] =
    useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] =
    useState('');
  const [openingScreenshot, setOpeningScreenshot] =
    useState(false);
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
  const screenshotInputRef = useRef<HTMLInputElement>(null);
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

  const applyScreenshotFile = useCallback((file: File | null) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a product screenshot.');
      return;
    }

    setError('');
    setScreenshotFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setScreenshotPreview(String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  }, []);

  const handleScreenshotChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    applyScreenshotFile(event.target.files?.[0] ?? null);
    event.target.value = '';
  };

  const openScreenshotPicker = async () => {
    if (!isNativeCameraRuntime()) {
      screenshotInputRef.current?.click();
      return;
    }

    setOpeningScreenshot(true);
    setError('');

    try {
      const file = await pickNativeImageFile({
        purpose: 'product-screenshot',
        fileNamePrefix: 'shopping-assist-product',
        quality: 86,
        width: 1800,
        height: 1800,
      });

      if (file) applyScreenshotFile(file);
    } catch (cameraError) {
      if (!isCameraCancellation(cameraError)) {
        setError(
          cameraError instanceof Error
            ? cameraError.message
            : 'Unable to open the camera or gallery.',
        );
      }
    } finally {
      setOpeningScreenshot(false);
    }
  };

  const clearScreenshot = () => {
    setScreenshotFile(null);
    setScreenshotPreview('');

    if (screenshotInputRef.current) {
      screenshotInputRef.current.value = '';
    }
  };

  useEffect(() => {
    let active = true;

    const restoreCameraResult = async () => {
      try {
        const file = await consumeRestoredCameraFile(
          'product-screenshot',
          'shopping-assist-product',
        );

        if (active && file) {
          applyScreenshotFile(file);
        }
      } catch (cameraError) {
        if (active && !isCameraCancellation(cameraError)) {
          setError('Unable to restore the selected screenshot.');
        }
      }
    };

    void restoreCameraResult();

    const handleRestoredResult = () => {
      void restoreCameraResult();
    };

    window.addEventListener(
      NATIVE_CAMERA_RESTORED_EVENT,
      handleRestoredResult,
    );

    return () => {
      active = false;
      window.removeEventListener(
        NATIVE_CAMERA_RESTORED_EVENT,
        handleRestoredResult,
      );
    };
  }, [applyScreenshotFile]);

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
      clearScreenshot();

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
                ) || fallbackProductName(store);

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
          priceConfidence:
            preview?.price && preview.price > 0
              ? 60
              : 0,
          priceStatus:
            preview?.price && preview.price > 0
              ? 'verify'
              : 'missing',
          priceSource:
            preview?.price && preview.price > 0
              ? 'open_graph'
              : '',
          priceAgreement:
            preview?.price && preview.price > 0
              ? 1
              : 0,
          priceReason:
            preview?.price && preview.price > 0
              ? 'A likely price was found from the shared link. Please verify it on the store page.'
              : 'No reliable current selling price was found.',
          originalPrice: 0,
          priceDiagnostics: [],
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
        if (!active) return;

        const nextCapture: ShoppingAssistCapture = {
          sourceUrl,
          canonicalUrl: sourceUrl,
          store,
          title: fallbackProductName(store),
          image: '',
          displayedPrice: 0,
          currency: 'INR',
          variant: '',
          captureMethod: 'page_fallback',
          confidence: 20,
          priceConfidence: 0,
          priceStatus: 'missing',
          priceSource: '',
          priceAgreement: 0,
          priceReason: '',
          originalPrice: 0,
          priceDiagnostics: [],
          capturedAt: sharedTarget.receivedAt,
        };

        saveShoppingAssistCapture(nextCapture);
        setCapture(nextCapture);
        setTitle(nextCapture.title);
        setPrice('');
        setVariant('');
        setImageFailed(false);

        navigate('/shopping-assist/review', {
          replace: true,
          state: { capture: nextCapture },
        });
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

        const fallbackPrice =
          captureSnapshot.displayedPrice ||
          preview.price ||
          0;
        const nativePriceAvailable =
          captureSnapshot.displayedPrice > 0;

        const next: ShoppingAssistCapture = {
          ...captureSnapshot,
          title:
            isUsefulTitle(captureSnapshot.title)
              ? captureSnapshot.title
              : (
                  isUsefulTitle(preview.title || '')
                    ? preview.title
                    : inferProductNameFromUrl(
                        captureSnapshot.sourceUrl,
                        captureSnapshot.store,
                      ) || fallbackProductName(captureSnapshot.store)
                ),
          image:
            imageFailed
              ? preview.image ||
                captureSnapshot.image ||
                ''
              : captureSnapshot.image ||
                preview.image ||
                '',
          displayedPrice: fallbackPrice,
          confidence: Math.max(
            captureSnapshot.confidence,
            preview.fetched ? 70 : 35,
          ),
          priceConfidence:
            nativePriceAvailable
              ? captureSnapshot.priceConfidence ??
                captureSnapshot.confidence
              : fallbackPrice > 0
                ? 60
                : 0,
          priceStatus:
            nativePriceAvailable
              ? captureSnapshot.priceStatus ?? 'verify'
              : fallbackPrice > 0
                ? 'verify'
                : 'missing',
          priceSource:
            nativePriceAvailable
              ? captureSnapshot.priceSource
              : fallbackPrice > 0
                ? 'open_graph'
                : '',
          priceAgreement:
            nativePriceAvailable
              ? captureSnapshot.priceAgreement ?? 1
              : fallbackPrice > 0
                ? 1
                : 0,
          priceReason:
            nativePriceAvailable
              ? captureSnapshot.priceReason
              : fallbackPrice > 0
                ? 'A likely price was found from the shared link. Please verify it on the store page.'
                : 'No reliable current selling price was found.',
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

  const priceMissing = displayedPrice <= 0;
  const hasDetectedImage = Boolean(
    capture.image && !imageFailed,
  );
  const needsManualVerification =
    priceMissing ||
    !hasDetectedImage ||
    !isUsefulTitle(title);
  const activePreviewImage =
    screenshotPreview ||
    (hasDetectedImage ? capture.image : '');
  const previewIsScreenshot = Boolean(screenshotPreview);

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
          screenshotFile: screenshotFile || undefined,
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
        <input
          ref={screenshotInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleScreenshotChange}
        />

        <section
          className={`mb-4 rounded-[22px] border p-4 ${
            needsManualVerification
              ? 'border-blue-100 bg-blue-50/60'
              : 'border-emerald-100 bg-emerald-50/60'
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ${
                needsManualVerification
                  ? 'text-blue-600'
                  : 'text-emerald-600'
              }`}
            >
              <CheckCircle2 size={20} strokeWidth={2.4} />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  className={`text-sm font-extrabold ${
                    needsManualVerification
                      ? 'text-blue-950'
                      : 'text-emerald-950'
                  }`}
                >
                  {storeLabel(capture.store)} link saved
                </h2>
                <span className="rounded-full bg-white px-2 py-1 text-[9px] font-extrabold text-slate-500 shadow-sm">
                  {needsManualVerification
                    ? 'Manual verification'
                    : 'Details found'}
                </span>
              </div>

              <p
                className={`mt-1.5 text-[11px] leading-5 ${
                  needsManualVerification
                    ? 'text-blue-800'
                    : 'text-emerald-800'
                }`}
              >
                {needsManualVerification
                  ? 'No need to paste the link again. Add a screenshot for faster verification, or continue and Shop2Bhutan will confirm the missing details.'
                  : 'Review the detected details below. Shop2Bhutan will still confirm availability and the final price before quotation.'}
              </p>

              <a
                href={capture.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-extrabold text-orange-600"
              >
                Open product link
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[26px] border border-slate-100 bg-white shadow-sm shadow-slate-100">
          <div
            className={`relative flex items-center justify-center bg-slate-50 ${
              activePreviewImage
                ? 'min-h-[250px]'
                : 'min-h-[165px]'
            }`}
          >
            {activePreviewImage ? (
              <img
                src={activePreviewImage}
                alt={
                  previewIsScreenshot
                    ? 'Product screenshot'
                    : title || 'Product preview'
                }
                onError={() => {
                  if (!previewIsScreenshot) setImageFailed(true);
                }}
                className={`max-h-[330px] w-full ${
                  previewIsScreenshot
                    ? 'object-contain'
                    : 'object-contain'
                }`}
              />
            ) : (
              <div className="flex flex-col items-center px-6 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white p-2.5 shadow-sm ring-1 ring-slate-100">
                  <img
                    src={storeLogo(capture.store)}
                    alt={`${storeLabel(capture.store)} logo`}
                    className="h-full w-full object-contain"
                  />
                </span>
                <p className="mt-3 text-xs font-extrabold text-slate-600">
                  Product image will be verified
                </p>
                <p className="mt-1 text-[10px] leading-4 text-slate-400">
                  The saved product link is enough to continue.
                </p>
              </div>
            )}

            <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-extrabold text-slate-700 shadow-sm ring-1 ring-slate-100">
              {previewIsScreenshot
                ? 'Screenshot added'
                : priceText(displayedPrice)}
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
                className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500"
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
                placeholder={`${storeLabel(capture.store)} product`}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold leading-5 text-slate-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10"
              />
              {!isUsefulTitle(title) && (
                <p className="mt-1.5 text-[11px] leading-5 text-slate-400">
                  You may keep this general name or replace it with the exact
                  product name.
                </p>
              )}
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div>
                <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500">
                  Displayed price
                </p>

                {priceMissing ? (
                  <div className="flex h-12 items-center gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 px-3.5">
                    <CheckCircle2
                      size={17}
                      className="shrink-0 text-blue-500"
                    />
                    <span className="text-xs font-extrabold text-slate-700">
                      Price will be verified
                    </span>
                  </div>
                ) : (
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-slate-400">
                      ₹
                    </span>
                    <input
                      id="assist-price"
                      value={price}
                      readOnly
                      aria-readonly="true"
                      className="h-12 w-full cursor-default rounded-2xl border border-slate-200 bg-white pl-8 pr-3 text-sm font-extrabold text-slate-700 outline-none"
                    />
                  </div>
                )}
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500">
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
                    aria-label="Decrease quantity"
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
                    aria-label="Increase quantity"
                  >
                    <Plus size={15} />
                  </button>
                </div>
              </div>
            </div>

            <div
              className={`flex items-start gap-3 rounded-2xl border p-3.5 ${
                priceMissing
                  ? 'border-blue-100 bg-blue-50/50'
                  : 'border-slate-200 bg-slate-50'
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ${
                  priceMissing
                    ? 'text-blue-600'
                    : 'text-slate-600'
                }`}
              >
                <CheckCircle2 size={17} strokeWidth={2.3} />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold text-slate-800">
                  {priceMissing
                    ? 'Price will be confirmed by Shop2Bhutan'
                    : 'Detected price is a reference'}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  {priceMissing
                    ? 'Continue with this product. We will check the current selling price before preparing your quotation.'
                    : 'We will confirm the current price, availability and selected option before preparing your quotation.'}
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500">
                    Product screenshot
                  </p>
                  <p className="mt-1 text-[10px] leading-4 text-slate-400">
                    Optional, but useful when details could not be read.
                  </p>
                </div>

                {screenshotFile && (
                  <button
                    type="button"
                    onClick={clearScreenshot}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500"
                    aria-label="Remove product screenshot"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => void openScreenshotPicker()}
                disabled={openingScreenshot}
                className={`mt-2.5 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border px-4 text-xs font-extrabold transition active:scale-[0.99] disabled:opacity-60 ${
                  screenshotFile
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : needsManualVerification
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                {openingScreenshot ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Opening…
                  </>
                ) : (
                  <>
                    <Camera size={16} />
                    {screenshotFile
                      ? 'Replace product screenshot'
                      : 'Add product screenshot'}
                  </>
                )}
              </button>
            </div>

            <div>
              <label
                htmlFor="assist-variant"
                className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500"
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

        <section className="mt-4 flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
            <Sparkles size={17} />
          </span>
          <p className="text-[11px] leading-5 text-slate-600">
            Shop2Bhutan verifies the product, availability, selected option and
            final charges before you pay.
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
                : needsManualVerification
                  ? 'Continue to Request Bag'
                  : 'Add to Request Bag'}
            </>
          )}
        </button>
      </main>
    </div>
  );
}
