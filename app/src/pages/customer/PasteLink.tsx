import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import {
  Camera,
  CheckCircle,
  ClipboardList,
  ExternalLink,
  ImageIcon,
  Link2,
  Loader2,
  Package,
  Plus,
  ShoppingBag,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  addItemToRequestBag,
  detectSourcePlatformFromUrl,
  fetchProductLinkPreview,
  inferProductNameFromUrl,
  normalizeProductUrl,
  type ProductLinkPreview,
} from '@/lib/customerOrders';
import {
  DEFAULT_APP_SETTINGS,
  fetchPublicAppSettings,
} from '@/lib/appSettings';

const platforms = [
  {
    name: 'Amazon',
    key: 'amazon',
    url: 'https://www.amazon.in',
    logo: '/store-logos/amazon.png',
  },
  {
    name: 'Flipkart',
    key: 'flipkart',
    url: 'https://www.flipkart.com',
    logo: '/store-logos/flipkart.png',
  },
  {
    name: 'Myntra',
    key: 'myntra',
    url: 'https://www.myntra.com',
    logo: '/store-logos/myntra.png',
  },
  {
    name: 'Meesho',
    key: 'meesho',
    url: 'https://www.meesho.com',
    logo: '/store-logos/meesho.png',
  },
];

type InputMode = 'link' | 'screenshot';

type PreviewState = {
  url: string;
  loading: boolean;
  data: ProductLinkPreview | null;
};

type NoticeState = {
  title: string;
  message: string;
};

const emptyPreview: PreviewState = {
  url: '',
  loading: false,
  data: null,
};

const stepsFlow = [
  { label: 'Add product', icon: Link2, active: true },
  { label: 'Request Bag', icon: ShoppingBag, active: false },
  { label: 'Quotation', icon: ClipboardList, active: false },
];

function platformLabel(platform?: string) {
  const raw = String(platform ?? '').toLowerCase();

  if (raw === 'amazon') return 'Amazon';
  if (raw === 'flipkart') return 'Flipkart';
  if (raw === 'myntra') return 'Myntra';
  if (raw === 'meesho') return 'Meesho';

  return 'Product';
}

function makeProductName(platform: string) {
  if (!platform || platform === 'other') return 'Pasted product link';
  return `Product from ${platformLabel(platform)}`;
}

function formatPrice(value?: number, currency = 'INR') {
  if (!value || value <= 0) return '';

  const label =
    currency === 'BTN' ? 'Nu.' : currency === 'INR' ? '\u20B9' : currency;

  return `${label} ${Math.round(value).toLocaleString()}`;
}

function makeLocalFallbackPreview(cleanUrl: string): ProductLinkPreview {
  const platform = detectSourcePlatformFromUrl(cleanUrl);

  return {
    url: cleanUrl,
    platform,
    title: inferProductNameFromUrl(cleanUrl, platform),
    image: '',
    price: 0,
    currency: 'INR',
    fetched: false,
    message:
      'Shop2Bhutan will verify this product manually before quotation.',
  };
}

function isPreviewForUrl(preview: PreviewState, cleanUrl: string) {
  return Boolean(preview.data && preview.url === cleanUrl);
}

function resolvePreviewTitle(previewData: ProductLinkPreview | null) {
  const rawTitle = String(previewData?.title ?? '').trim();

  if (rawTitle) return rawTitle;

  return makeProductName(previewData?.platform || 'other');
}

function extractDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export default function PasteLink() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isGuest } = useAuth();

  const locationState = location.state as {
    initialUrl?: string;
    sourcePlatform?: string;
  } | null;

  const incomingShare = useMemo(() => {
    const params = new URLSearchParams(location.search);

    return {
      source: params.get('source') ?? '',
      url: params.get('url') ?? '',
      title: params.get('title') ?? '',
    };
  }, [location.search]);

  const initialUrl =
    locationState?.initialUrl ?? incomingShare.url ?? '';

  const [mode, setMode] = useState<InputMode>('link');
  const [url, setUrl] = useState(initialUrl);
  const [preview, setPreview] = useState<PreviewState>(emptyPreview);
  const [linkProductName, setLinkProductName] = useState('');
  const [screenshotProductName, setScreenshotProductName] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [appSettings, setAppSettings] = useState(DEFAULT_APP_SETTINGS);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const lastNotifiedUrlRef = useRef('');
  const lastHandledShareUrlRef = useRef('');
  const linkNameEditedRef = useRef(false);

  const cleanUrl = useMemo(() => normalizeProductUrl(url), [url]);
  const canTryPreview =
    mode === 'link' &&
    Boolean(cleanUrl) &&
    cleanUrl.length > 14 &&
    cleanUrl.includes('.');

  const visiblePlatforms = platforms.filter(
    (platform) =>
      appSettings.acceptedPlatforms[
        platform.key as keyof typeof appSettings.acceptedPlatforms
      ],
  );

  const hasRequestInput =
    mode === 'link' ? Boolean(cleanUrl) : Boolean(screenshotFile);

  const showNotice = (nextNotice: NoticeState) => {
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }

    setNotice(nextNotice);

    noticeTimerRef.current = window.setTimeout(() => {
      setNotice(null);
      noticeTimerRef.current = null;
    }, 2400);
  };

  const dismissKeyboard = async () => {
    linkInputRef.current?.blur();

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) activeElement.blur();

    if (Capacitor.isNativePlatform()) {
      try {
        await Keyboard.hide();
      } catch {
        // Keyboard may already be closed.
      }
    }
  };

  const revealResult = () => {
    window.setTimeout(() => {
      resultRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }, 220);
  };

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const sharedUrl = normalizeProductUrl(incomingShare.url);

    if (
      incomingShare.source !== 'android-share' ||
      !sharedUrl ||
      lastHandledShareUrlRef.current === sharedUrl
    ) {
      return;
    }

    lastHandledShareUrlRef.current = sharedUrl;
    linkNameEditedRef.current = Boolean(incomingShare.title.trim());
    lastNotifiedUrlRef.current = '';

    setMode('link');
    setUrl(sharedUrl);
    setPreview(emptyPreview);
    setLinkProductName(incomingShare.title.trim());
    setScreenshotProductName('');
    setScreenshotFile(null);
    setScreenshotPreview('');
    setError('');
    setSuccessMessage('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    void dismissKeyboard();

    showNotice({
      title: 'Product shared to Shop2Bhutan',
      message: 'Checking the product name, photo, and price now.',
    });
  }, [incomingShare.source, incomingShare.title, incomingShare.url]);

  useEffect(() => {
    if (!canTryPreview) {
      setPreview(emptyPreview);
      lastNotifiedUrlRef.current = '';

      if (!linkNameEditedRef.current) {
        setLinkProductName('');
      }

      return;
    }

    let cancelled = false;
    const activeUrl = cleanUrl;

    const localPreview = makeLocalFallbackPreview(activeUrl);

    setPreview({
      url: activeUrl,
      loading: true,
      data: localPreview,
    });

    if (!linkNameEditedRef.current) {
      setLinkProductName(resolvePreviewTitle(localPreview));
    }

    const timer = window.setTimeout(async () => {
      let nextPreview: ProductLinkPreview;

      try {
        const fetchedPreview = await fetchProductLinkPreview(activeUrl);
        nextPreview =
          fetchedPreview || makeLocalFallbackPreview(activeUrl);
      } catch {
        nextPreview = makeLocalFallbackPreview(activeUrl);
      }

      if (cancelled) return;

      setPreview({
        url: activeUrl,
        loading: false,
        data: nextPreview,
      });

      if (!linkNameEditedRef.current) {
        setLinkProductName(resolvePreviewTitle(nextPreview));
      }

      if (lastNotifiedUrlRef.current !== activeUrl) {
        lastNotifiedUrlRef.current = activeUrl;
        void dismissKeyboard();

        const detectedPlatform = platformLabel(nextPreview.platform);
        const detailsFound = Boolean(
          nextPreview.image || String(nextPreview.title || '').trim(),
        );

        showNotice({
          title: `${detectedPlatform} link detected`,
          message: detailsFound
            ? 'Product details are ready. Price can be verified later.'
            : 'The link is ready. Shop2Bhutan will verify the details.',
        });

        revealResult();
      }
    }, 650);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canTryPreview, cleanUrl]);

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      try {
        const loaded = await fetchPublicAppSettings();
        if (active) setAppSettings(loaded);
      } catch (settingsError) {
        console.warn('[PasteLink] App settings skipped:', settingsError);
      }
    }

    void loadSettings();

    const handleSettingsUpdated = () => {
      void loadSettings();
    };

    window.addEventListener(
      'shop2bhutan:app-settings-updated',
      handleSettingsUpdated,
    );

    return () => {
      active = false;
      window.removeEventListener(
        'shop2bhutan:app-settings-updated',
        handleSettingsUpdated,
      );
    };
  }, []);

  const switchMode = (nextMode: InputMode) => {
    setMode(nextMode);
    setError('');
    setSuccessMessage('');

    if (nextMode === 'link') {
      window.setTimeout(() => linkInputRef.current?.focus(), 80);
    }
  };

  const handleScreenshotChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }

    setMode('screenshot');
    setError('');
    setSuccessMessage('');
    setScreenshotFile(file);

    const reader = new FileReader();

    reader.onloadend = () => {
      setScreenshotPreview(String(reader.result || ''));
    };

    reader.readAsDataURL(file);

    void dismissKeyboard();

    showNotice({
      title: 'Screenshot added',
      message: 'Add a short product name, then place it in your Request Bag.',
    });

    revealResult();
  };

  const clearScreenshot = () => {
    setScreenshotFile(null);
    setScreenshotPreview('');
    setScreenshotProductName('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetForm = () => {
    setUrl('');
    setPreview(emptyPreview);
    setLinkProductName('');
    setScreenshotProductName('');
    linkNameEditedRef.current = false;
    lastNotifiedUrlRef.current = '';
    clearScreenshot();
  };

  const addToRequestBag = async () => {
    setError('');
    setSuccessMessage('');

    const hasUrl = mode === 'link' && Boolean(cleanUrl);
    const hasScreenshot =
      mode === 'screenshot' && Boolean(screenshotFile);

    if (!hasUrl && !hasScreenshot) {
      setError(
        mode === 'link'
          ? 'Please paste a product link.'
          : 'Please upload a product screenshot.',
      );
      return;
    }

    if (!user) {
      navigate('/login', {
        state: {
          from: location.pathname,
          initialUrl: url,
        },
      });
      return;
    }

    if (isGuest) {
      setError(
        'Please sign in or register to add shopping items. Guest mode is only for Parcel booking.',
      );
      return;
    }

    if (appSettings.maintenanceEnabled) {
      setError(
        appSettings.maintenanceMessage ||
          'Shop2Bhutan is under maintenance. Please try again later.',
      );
      return;
    }

    if (!appSettings.orderAcceptanceEnabled) {
      setError(
        'Shop2Bhutan is temporarily not accepting new order requests. Please try again later.',
      );
      return;
    }

    let productPreview: ProductLinkPreview | null = null;

    if (hasUrl) {
      productPreview = isPreviewForUrl(preview, cleanUrl)
        ? preview.data
        : null;

      if (!productPreview) {
        setPreview({
          url: cleanUrl,
          loading: true,
          data: null,
        });

        try {
          productPreview = await fetchProductLinkPreview(cleanUrl);
        } catch {
          productPreview = makeLocalFallbackPreview(cleanUrl);
        }

        if (!productPreview) {
          productPreview = makeLocalFallbackPreview(cleanUrl);
        }

        setPreview({
          url: cleanUrl,
          loading: false,
          data: productPreview,
        });
      }
    }

    const platform =
      productPreview?.platform ||
      (hasUrl ? detectSourcePlatformFromUrl(cleanUrl) : 'other');

    const productName = hasUrl
      ? linkProductName.trim() ||
        resolvePreviewTitle(productPreview) ||
        makeProductName(platform)
      : screenshotProductName.trim() || 'Screenshot product request';

    setAdding(true);

    try {
      await addItemToRequestBag({
        userId: user.id,
        item: {
          sourceUrl: hasUrl ? cleanUrl : '',
          sourcePlatform: platform,
          productName,
          productImage: productPreview?.image || '',
          price: productPreview?.price || 0,
          quantity: 1,
          notes: '',
          screenshotFile: hasScreenshot
            ? screenshotFile || undefined
            : undefined,
        },
      });

      window.dispatchEvent(
        new Event('shop2bhutan:request-bag-updated'),
      );

      setSuccessMessage(
        'Product added. You can add another item or open your Request Bag.',
      );

      showNotice({
        title: 'Added to Request Bag',
        message: 'Your product has been saved successfully.',
      });

      resetForm();
    } catch (addError) {
      console.error(
        'Failed to add item to Request Bag:',
        addError,
      );

      setError(
        addError instanceof Error
          ? addError.message
          : 'Unable to add item to Request Bag.',
      );
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-white">
      {notice && (
        <div
          className="fixed left-0 right-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[120] px-4"
          role="status"
          aria-live="polite"
        >
          <div className="mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-emerald-100 bg-white p-3.5 shadow-2xl shadow-slate-900/15">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle size={18} strokeWidth={2.5} />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-slate-950">
                {notice.title}
              </p>
              <p className="mt-0.5 text-[11px] leading-5 text-slate-500">
                {notice.message}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setNotice(null)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 active:bg-slate-100"
              aria-label="Dismiss notification"
            >
              <X size={15} strokeWidth={2.4} />
            </button>
          </div>
        </div>
      )}

      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-950">
              Add a product
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Use a product link or screenshot.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/request-bag')}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-slate-50 px-3.5 text-xs font-extrabold text-slate-700 transition active:scale-[0.97]"
          >
            <ShoppingBag size={15} strokeWidth={2.3} />
            View Bag
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-[calc(10rem+env(safe-area-inset-bottom))] pt-3">
        <section className="rounded-2xl border border-slate-100 bg-white p-3">
          <div className="relative flex items-center">
            <div className="absolute left-[18%] right-[18%] top-4 h-px bg-slate-200" />

            {stepsFlow.map((step) => {
              const Icon = step.icon;

              return (
                <div
                  key={step.label}
                  className="relative z-10 flex w-1/3 flex-col items-center gap-1.5 text-center"
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-white ${
                      step.active
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    <Icon size={14} strokeWidth={2.4} />
                  </span>

                  <span
                    className={`text-[9px] font-extrabold uppercase tracking-wide ${
                      step.active ? 'text-orange-600' : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {visiblePlatforms.length > 0 && (
          <section className="mt-3">
            <div className="flex items-end justify-between gap-3 px-1">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-orange-500">
                  Accepted stores
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  Tap a logo to browse the store.
                </p>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-4 gap-2">
              {visiblePlatforms.map((platform) => (
                <a
                  key={platform.name}
                  href={platform.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl border border-slate-100 bg-white px-1 py-2.5 transition active:scale-95"
                >
                  <span className="flex h-8 w-8 items-center justify-center">
                    <img
                      src={platform.logo}
                      alt={platform.name}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  </span>

                  <span className="truncate text-[10px] font-bold text-slate-600">
                    {platform.name}
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

        <section className="mt-4 overflow-hidden rounded-[24px] border border-slate-100 bg-white shadow-sm shadow-slate-100">
          <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => switchMode('link')}
              className={`flex h-11 items-center justify-center gap-2 rounded-[18px] text-sm font-extrabold transition ${
                mode === 'link'
                  ? 'bg-white text-orange-600 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              <Link2 size={17} strokeWidth={2.3} />
              Paste link
            </button>

            <button
              type="button"
              onClick={() => switchMode('screenshot')}
              className={`flex h-11 items-center justify-center gap-2 rounded-[18px] text-sm font-extrabold transition ${
                mode === 'screenshot'
                  ? 'bg-white text-orange-600 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              <Camera size={17} strokeWidth={2.3} />
              Screenshot
            </button>
          </div>

          <div className="p-4">
            {mode === 'link' ? (
              <>
                <div>
                  <label
                    htmlFor="product-link"
                    className="mb-1.5 block text-[13px] font-bold text-slate-800"
                  >
                    Product link
                  </label>

                  <div className="relative">
                    <Link2
                      size={17}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                      strokeWidth={2}
                    />

                    <input
                      ref={linkInputRef}
                      id="product-link"
                      type="url"
                      value={url}
                      inputMode="url"
                      autoCapitalize="none"
                      autoCorrect="off"
                      onChange={(event) => {
                        setUrl(event.target.value);
                        setError('');
                        setSuccessMessage('');
                        linkNameEditedRef.current = false;
                      }}
                      onPaste={() => {
                        setMode('link');
                        setError('');
                        setSuccessMessage('');
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void addToRequestBag();
                        }
                      }}
                      placeholder="Paste the full product URL"
                      className="h-[52px] w-full rounded-2xl border border-slate-200 bg-slate-50 pl-11 pr-11 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:ring-[3px] focus:ring-orange-500/10"
                    />

                    {url && (
                      <button
                        type="button"
                        onClick={() => {
                          setUrl('');
                          setPreview(emptyPreview);
                          setLinkProductName('');
                          linkNameEditedRef.current = false;
                          lastNotifiedUrlRef.current = '';
                          linkInputRef.current?.focus();
                        }}
                        className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm ring-1 ring-slate-200 transition active:scale-95"
                        aria-label="Clear product link"
                      >
                        <X size={15} strokeWidth={2.4} />
                      </button>
                    )}
                  </div>

                  {cleanUrl && (
                    <p className="mt-1.5 truncate text-[11px] font-medium text-slate-400">
                      {extractDomain(cleanUrl)}
                    </p>
                  )}
                </div>

                {preview.loading && (
                  <div className="mt-3 flex items-center gap-3 rounded-2xl bg-slate-50 px-3.5 py-3">
                    <Loader2
                      size={18}
                      className="shrink-0 animate-spin text-orange-500"
                      strokeWidth={2.4}
                    />
                    <div>
                      <p className="text-xs font-extrabold text-slate-800">
                        Detecting product details
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        Name and photo are checked first. Price is optional.
                      </p>
                    </div>
                  </div>
                )}

                {preview.data && cleanUrl && (
                  <div
                    ref={resultRef}
                    className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3"
                  >
                    <div className="flex gap-3">
                      {preview.data.image ? (
                        <img
                          src={preview.data.image}
                          alt=""
                          className="h-[76px] w-[76px] shrink-0 rounded-xl bg-white object-cover ring-1 ring-slate-100"
                        />
                      ) : (
                        <span className="flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-slate-100">
                          <Package
                            size={25}
                            className="text-orange-400"
                            strokeWidth={2}
                          />
                        </span>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-orange-600">
                            {platformLabel(preview.data.platform)}
                          </span>

                          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500 ring-1 ring-slate-100">
                            {preview.data.price
                              ? formatPrice(
                                  preview.data.price,
                                  preview.data.currency,
                                )
                              : 'Price to be verified'}
                          </span>
                        </div>

                        <p className="mt-2 text-[11px] leading-5 text-slate-500">
                          Product name is editable before adding it.
                        </p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <label
                        htmlFor="detected-product-name"
                        className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.1em] text-slate-400"
                      >
                        Product name
                      </label>

                      <input
                        id="detected-product-name"
                        type="text"
                        value={linkProductName}
                        onChange={(event) => {
                          linkNameEditedRef.current = true;
                          setLinkProductName(event.target.value);
                        }}
                        placeholder="Product name"
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-bold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10"
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleScreenshotChange}
                  className="hidden"
                />

                {!screenshotFile ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex min-h-[148px] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-orange-200 bg-orange-50/40 px-5 text-center transition active:scale-[0.99] active:bg-orange-50"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-orange-500 shadow-sm ring-1 ring-orange-100">
                      <Camera size={22} strokeWidth={2.2} />
                    </span>

                    <span className="mt-3 text-sm font-extrabold text-slate-900">
                      Upload product screenshot
                    </span>

                    <span className="mt-1 max-w-xs text-[11px] leading-5 text-slate-500">
                      Use this when the store link is unavailable or cannot be
                      detected.
                    </span>
                  </button>
                ) : (
                  <div ref={resultRef}>
                    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
                      <div className="relative flex min-h-[190px] max-h-[330px] items-center justify-center">
                        <img
                          src={screenshotPreview}
                          alt="Uploaded product screenshot"
                          className="max-h-[330px] w-full object-contain"
                        />

                        <div className="absolute right-3 top-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-extrabold text-slate-600 shadow-lg ring-1 ring-slate-200"
                          >
                            <ImageIcon size={14} strokeWidth={2.3} />
                            Replace
                          </button>

                          <button
                            type="button"
                            onClick={clearScreenshot}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-500 shadow-lg ring-1 ring-slate-200"
                            aria-label="Remove screenshot"
                          >
                            <X size={15} strokeWidth={2.4} />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 border-t border-slate-100 bg-white px-3.5 py-3">
                        <CheckCircle
                          size={14}
                          className="shrink-0 text-emerald-500"
                          strokeWidth={2.5}
                        />

                        <p className="truncate text-xs font-semibold text-slate-600">
                          {screenshotFile.name}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <label
                        htmlFor="screenshot-product-name"
                        className="mb-1.5 block text-[13px] font-bold text-slate-800"
                      >
                        Product name or short description
                      </label>

                      <input
                        id="screenshot-product-name"
                        type="text"
                        value={screenshotProductName}
                        onChange={(event) =>
                          setScreenshotProductName(event.target.value)
                        }
                        placeholder="Example: Black cotton shirt"
                        className="h-[50px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-[3px] focus:ring-orange-500/10"
                      />

                      <p className="mt-1.5 text-[11px] leading-5 text-slate-400">
                        The screenshot will be used as the product preview in
                        your Request Bag.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {error && (
              <div className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-3.5 py-3 text-xs font-semibold leading-5 text-red-700">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={addToRequestBag}
              disabled={!hasRequestInput || preview.loading || adding}
              className="mt-4 flex h-[54px] w-full items-center justify-center gap-2.5 rounded-2xl bg-orange-500 px-4 text-sm font-extrabold text-white shadow-lg shadow-orange-500/20 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-orange-200 disabled:shadow-none disabled:active:scale-100"
            >
              {adding ? (
                <>
                  <Loader2
                    size={19}
                    className="animate-spin"
                    strokeWidth={2.5}
                  />
                  Adding product...
                </>
              ) : (
                <>
                  <Plus size={19} strokeWidth={2.5} />
                  Add to Request Bag
                </>
              )}
            </button>
          </div>
        </section>

        {successMessage && (
          <section className="mt-3 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm">
              <CheckCircle size={20} strokeWidth={2.5} />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-emerald-950">
                Product saved
              </p>
              <p className="mt-1 text-[11px] leading-5 text-emerald-700">
                {successMessage}
              </p>

              <button
                type="button"
                onClick={() => navigate('/request-bag')}
                className="mt-2.5 inline-flex h-9 items-center gap-2 rounded-xl bg-emerald-600 px-3.5 text-xs font-extrabold text-white"
              >
                Open Request Bag
                <ExternalLink size={14} strokeWidth={2.4} />
              </button>
            </div>
          </section>
        )}

        <section className="mt-4 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-500 shadow-sm">
            <Sparkles size={17} strokeWidth={2.4} />
          </span>

          <p className="text-[11px] leading-5 text-blue-800">
            Add multiple products before requesting one quotation. Product
            prices can be verified by Shop2Bhutan later.
          </p>
        </section>
      </main>
    </div>
  );
}
