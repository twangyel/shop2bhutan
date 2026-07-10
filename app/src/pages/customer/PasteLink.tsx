import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Camera,
  CheckCircle,
  ClipboardList,
  ExternalLink,
  Link2,
  Loader2,
  Package,
  Plus,
  ScanLine,
  ShoppingBag,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  addItemToRequestBag,
  detectSourcePlatformFromUrl,
  fetchProductLinkPreview,
  normalizeProductUrl,
  type ProductLinkPreview,
} from '@/lib/customerOrders';
import { DEFAULT_APP_SETTINGS, fetchPublicAppSettings } from '@/lib/appSettings';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const platforms = [
  { name: 'Amazon',   key: 'amazon',   url: 'https://www.amazon.in',   logo: '/store-logos/amazon.png' },
  { name: 'Flipkart', key: 'flipkart', url: 'https://www.flipkart.com', logo: '/store-logos/flipkart.png' },
  { name: 'Myntra',   key: 'myntra',   url: 'https://www.myntra.com',   logo: '/store-logos/myntra.png' },
  { name: 'Meesho',   key: 'meesho',   url: 'https://www.meesho.com',   logo: '/store-logos/meesho.png' },
];

type PreviewState = { url: string; loading: boolean; data: ProductLinkPreview | null };
const emptyPreview: PreviewState = { url: '', loading: false, data: null };

const stepsFlow = [
  { label: 'Paste Link',   icon: Link2,          status: 'active' as const },
  { label: 'Add to Bag',   icon: ShoppingBag,    status: 'pending' as const },
  { label: 'Get Quotation',icon: ClipboardList,  status: 'pending' as const },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function platformLabel(platform?: string) {
  const r = String(platform ?? '').toLowerCase();
  if (r === 'amazon') return 'Amazon';
  if (r === 'flipkart') return 'Flipkart';
  if (r === 'myntra') return 'Myntra';
  if (r === 'meesho') return 'Meesho';
  return 'Product';
}

function makeProductName(platform: string) {
  if (!platform || platform === 'other') return 'Pasted product link';
  return `Product from ${platformLabel(platform)}`;
}

function manualPreviewTitle(previewData: ProductLinkPreview) {
  const label = platformLabel(previewData.platform);
  return label === 'Product' ? 'Product link detected' : `${label} link detected`;
}

function formatPrice(value?: number, currency = 'INR') {
  if (!value || value <= 0) return '';
  const label = currency === 'BTN' ? 'Nu.' : currency === 'INR' ? '\u20B9' : currency;
  return `${label} ${Math.round(value).toLocaleString()}`;
}

function makeLocalFallbackPreview(cleanUrl: string): ProductLinkPreview {
  const platform = detectSourcePlatformFromUrl(cleanUrl);
  return {
    url: cleanUrl, platform, title: makeProductName(platform),
    image: '', price: 0, currency: 'INR', fetched: false,
    message: 'Shop2Bhutan will verify this product manually before quotation.',
  };
}

function isPreviewForUrl(preview: PreviewState, cleanUrl: string) {
  return Boolean(preview.data && preview.url === cleanUrl);
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function PasteLink() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isGuest } = useAuth();

  const locationState = location.state as { initialUrl?: string; sourcePlatform?: string } | null;
  const [url, setUrl] = useState(locationState?.initialUrl ?? '');
  const [preview, setPreview] = useState<PreviewState>(emptyPreview);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [appSettings, setAppSettings] = useState(DEFAULT_APP_SETTINGS);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanUrl = useMemo(() => normalizeProductUrl(url), [url]);
  const canTryPreview = cleanUrl && cleanUrl.length > 14 && cleanUrl.includes('.');

  /* ---- Auto-fetch preview ---- */
  useEffect(() => {
    if (!canTryPreview) { setPreview(emptyPreview); return; }
    let cancelled = false;
    const activeUrl = cleanUrl;
    setPreview({ url: activeUrl, loading: true, data: null });
    const timer = window.setTimeout(async () => {
      try {
        const data = await fetchProductLinkPreview(activeUrl);
        if (!cancelled) setPreview({ url: activeUrl, loading: false, data: data || makeLocalFallbackPreview(activeUrl) });
      } catch {
        if (!cancelled) setPreview({ url: activeUrl, loading: false, data: makeLocalFallbackPreview(activeUrl) });
      }
    }, 700);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [canTryPreview, cleanUrl]);

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      try {
        const loaded = await fetchPublicAppSettings();
        if (active) setAppSettings(loaded);
      } catch (error) {
        console.warn('[PasteLink] App settings skipped:', error);
      }
    }

    void loadSettings();

    const handleSettingsUpdated = () => { void loadSettings(); };
    window.addEventListener('shop2bhutan:app-settings-updated', handleSettingsUpdated);

    return () => {
      active = false;
      window.removeEventListener('shop2bhutan:app-settings-updated', handleSettingsUpdated);
    };
  }, []);

  const visiblePlatforms = platforms.filter((platform) => appSettings.acceptedPlatforms[platform.key as keyof typeof appSettings.acceptedPlatforms]);
  const hasRequestInput = Boolean(cleanUrl || screenshotFile);

  /* ---- Screenshot upload ---- */
  const handleScreenshotChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please select an image file.'); return; }
    setError(''); setSuccessMessage(''); setScreenshotFile(file);
    const reader = new FileReader();
    reader.onloadend = () => { setScreenshotPreview(String(reader.result || '')); };
    reader.readAsDataURL(file);
  };

  const clearScreenshot = () => {
    setScreenshotFile(null); setScreenshotPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetForm = () => { setUrl(''); setPreview(emptyPreview); clearScreenshot(); };

  /* ---- Add to Request Bag ---- */
  const addToRequestBag = async () => {
    setError(''); setSuccessMessage('');
    const hasUrl = Boolean(cleanUrl);
    const hasScreenshot = Boolean(screenshotFile);
    if (!hasUrl && !hasScreenshot) { setError('Please paste a product link or upload a product screenshot.'); return; }
    if (!user) { navigate('/login', { state: { from: location.pathname, initialUrl: url } }); return; }
    if (isGuest) {
      setError('Please sign in or register to add shopping items. Guest mode is only for Parcel booking.');
      return;
    }

    if (appSettings.maintenanceEnabled) {
      setError(appSettings.maintenanceMessage || 'Shop2Bhutan is under maintenance. Please try again later.');
      return;
    }

    if (!appSettings.orderAcceptanceEnabled) {
      setError('Shop2Bhutan is temporarily not accepting new order requests. Please try again later.');
      return;
    }

    let productPreview: ProductLinkPreview | null = null;
    if (hasUrl) {
      productPreview = isPreviewForUrl(preview, cleanUrl) ? preview.data : null;
      if (!productPreview) {
        setPreview({ url: cleanUrl, loading: true, data: null });
        try { productPreview = await fetchProductLinkPreview(cleanUrl); }
        catch { productPreview = makeLocalFallbackPreview(cleanUrl); }
        setPreview({ url: cleanUrl, loading: false, data: productPreview });
      }
    }
    const platform = productPreview?.platform || (hasUrl ? detectSourcePlatformFromUrl(cleanUrl) : 'other');
    const productName = productPreview?.fetched ? productPreview.title
      : hasUrl ? makeProductName(platform) : 'Screenshot product request';

    setAdding(true);
    try {
      await addItemToRequestBag({
        userId: user.id,
        item: {
          sourceUrl: hasUrl ? cleanUrl : '', sourcePlatform: platform, productName,
          productImage: productPreview?.image || '', price: productPreview?.price || 0,
          quantity: 1, notes: '', screenshotFile: screenshotFile || undefined,
        },
      });
      window.dispatchEvent(new Event('shop2bhutan:request-bag-updated'));
      setSuccessMessage('Added to Request Bag. Add more products or open your bag to request one quotation.');
      resetForm();
    } catch (err) {
      console.error('Failed to add item to Request Bag:', err);
      setError(err instanceof Error ? err.message : 'Unable to add item to Request Bag.');
    } finally { setAdding(false); }
  };

  /* ---- Select platform ---- */
  const selectPlatform = (key: string) => {
    setUrl('');
    setPreview(emptyPreview);
    // Could pre-fill placeholder text per platform in future
    void key;
  };

  return (
    <div className="min-h-[100dvh] bg-white">
      <div className="mx-auto w-full max-w-3xl">
        <header className="sticky top-0 z-40 border-b border-neutral-100 bg-white/95 backdrop-blur">
          <div className="px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
            <h1 className="text-lg font-extrabold tracking-tight text-neutral-950">
              Add a product
            </h1>
            <p className="mt-0.5 text-xs leading-5 text-neutral-500">
              Paste a supported store link or upload a screenshot.
            </p>
          </div>
        </header>

        <main className="px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-4">
          <section className="rounded-[1.5rem] border border-neutral-100 bg-white p-4 shadow-[0_10px_32px_rgba(15,23,42,0.05)]">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
                <Link2 size={19} strokeWidth={2.2} />
              </span>
              <div>
                <h2 className="text-sm font-extrabold text-neutral-950">
                  Paste product link
                </h2>
                <p className="text-xs text-neutral-400">
                  Amazon, Flipkart, Myntra, or Meesho
                </p>
              </div>
            </div>

            <div className="relative mt-4">
              <Link2
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
                strokeWidth={2}
              />
              <input
                type="url"
                value={url}
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                onChange={(event) => {
                  setUrl(event.target.value);
                  setError('');
                  setSuccessMessage('');
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void addToRequestBag();
                }}
                placeholder="Paste the full product link here"
                className="h-14 w-full rounded-2xl border border-neutral-200 bg-neutral-50 pl-12 pr-12 text-sm font-medium text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-orange-500 focus:bg-white focus:ring-[3px] focus:ring-orange-500/10"
              />

              {url ? (
                <button
                  type="button"
                  onClick={() => {
                    setUrl('');
                    setPreview(emptyPreview);
                  }}
                  className="absolute right-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-white text-neutral-400 shadow-sm ring-1 ring-neutral-200 transition active:scale-95"
                  aria-label="Clear product link"
                >
                  <X size={16} strokeWidth={2.4} />
                </button>
              ) : (
                <ScanLine
                  size={18}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-neutral-300"
                  strokeWidth={2}
                />
              )}
            </div>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-neutral-100" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-neutral-400">
                or
              </span>
              <div className="h-px flex-1 bg-neutral-100" />
            </div>

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
                className="flex min-h-[86px] w-full items-center gap-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 text-left transition active:scale-[0.99] active:border-orange-400 active:bg-orange-50/40"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-orange-500 shadow-sm ring-1 ring-neutral-100">
                  <Camera size={22} strokeWidth={2.1} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-extrabold text-neutral-900">
                    Upload product screenshot
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-neutral-400">
                    Use a screenshot when a product link is unavailable.
                  </span>
                </span>
                <Plus size={18} className="shrink-0 text-neutral-400" />
              </button>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-orange-200 bg-white">
                <div className="relative flex min-h-[200px] max-h-[350px] items-center justify-center bg-neutral-50">
                  <img
                    src={screenshotPreview}
                    alt="Uploaded product screenshot"
                    className="max-h-[350px] w-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={clearScreenshot}
                    className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-neutral-500 shadow-lg ring-1 ring-neutral-200 transition active:scale-95"
                    aria-label="Remove screenshot"
                  >
                    <X size={16} strokeWidth={2.4} />
                  </button>
                </div>
                <div className="flex items-center gap-2 px-4 py-3">
                  <CheckCircle
                    size={15}
                    className="shrink-0 text-emerald-500"
                    strokeWidth={2.5}
                  />
                  <p className="truncate text-xs font-semibold text-neutral-600">
                    {screenshotFile.name}
                  </p>
                </div>
              </div>
            )}
          </section>

          {preview.loading && (
            <section className="mt-4 flex items-center gap-4 rounded-[1.3rem] border border-neutral-100 bg-white p-4 shadow-sm">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
                <Loader2 size={22} className="animate-spin" strokeWidth={2.4} />
              </span>
              <div>
                <p className="text-sm font-extrabold text-neutral-900">
                  Checking the product link
                </p>
                <p className="mt-0.5 text-xs text-neutral-400">
                  Product details may take a moment to appear.
                </p>
              </div>
            </section>
          )}

          {!preview.loading && preview.data && cleanUrl && (
            <section className="mt-4 overflow-hidden rounded-[1.3rem] border border-neutral-100 bg-white shadow-sm">
              <div className="flex gap-4 p-4">
                {preview.data.image ? (
                  <img
                    src={preview.data.image}
                    alt=""
                    className="h-20 w-20 shrink-0 rounded-2xl bg-neutral-100 object-cover"
                  />
                ) : (
                  <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-orange-50">
                    <Package size={27} className="text-orange-400" strokeWidth={2} />
                  </span>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-orange-600">
                      {platformLabel(preview.data.platform)}
                    </span>
                    {preview.data.price ? (
                      <span className="text-sm font-extrabold text-orange-600">
                        {formatPrice(preview.data.price, preview.data.currency)}
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-neutral-400">
                        Price to be verified
                      </span>
                    )}
                  </div>

                  <p className="mt-2 line-clamp-2 text-sm font-bold leading-5 text-neutral-900">
                    {preview.data.fetched
                      ? preview.data.title
                      : manualPreviewTitle(preview.data)}
                  </p>

                  {!preview.data.fetched && (
                    <p className="mt-1 text-xs leading-5 text-neutral-500">
                      Shop2Bhutan will verify this product manually before preparing your quotation.
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          {error && (
            <section className="mt-4 rounded-[1.3rem] border border-red-100 bg-red-50 px-4 py-3.5">
              <div className="flex items-start gap-2.5 text-red-700">
                <X size={17} className="mt-0.5 shrink-0" strokeWidth={2.5} />
                <p className="text-sm font-medium leading-5">{error}</p>
              </div>
            </section>
          )}

          <button
            type="button"
            onClick={addToRequestBag}
            disabled={!hasRequestInput || preview.loading || adding}
            className="mt-4 flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-orange-500 px-4 text-center text-sm font-extrabold text-white shadow-lg shadow-orange-500/20 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-orange-200 disabled:shadow-none disabled:active:scale-100"
          >
            {adding ? (
              <>
                <Loader2 size={20} className="animate-spin" strokeWidth={2.5} />
                Adding to Request Bag...
              </>
            ) : hasRequestInput ? (
              <>
                <Plus size={20} strokeWidth={2.5} />
                Add to Request Bag
              </>
            ) : (
              'Paste a link or upload a screenshot'
            )}
          </button>

          {successMessage && (
            <section className="mt-4 rounded-[1.3rem] border border-emerald-100 bg-emerald-50 p-4">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm">
                  <CheckCircle size={20} strokeWidth={2.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-emerald-950">
                    Added to Request Bag
                  </p>
                  <p className="mt-1 text-xs leading-5 text-emerald-700">
                    {successMessage}
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/request-bag')}
                    className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-extrabold text-white transition active:scale-95"
                  >
                    Open Request Bag
                    <ShoppingBag size={16} strokeWidth={2.4} />
                  </button>
                </div>
              </div>
            </section>
          )}

          {visiblePlatforms.length > 0 && (
            <section className="mt-6">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-orange-500">
                  Accepted stores
                </p>
                <h2 className="mt-1 text-base font-extrabold text-neutral-950">
                  We currently accept orders from
                </h2>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2">
                {visiblePlatforms.map((platform) => (
                  <a
                    key={platform.name}
                    href={platform.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => selectPlatform(platform.key)}
                    className="flex min-h-[82px] flex-col items-center justify-center gap-2 rounded-[1.2rem] border border-neutral-100 bg-white px-2 py-3 text-center transition active:scale-95 active:bg-neutral-50"
                  >
                    <span className="flex h-9 w-9 items-center justify-center">
                      <img
                        src={platform.logo}
                        alt={platform.name}
                        className="h-full w-full object-contain"
                        loading="lazy"
                      />
                    </span>
                    <span className="text-[11px] font-bold text-neutral-700">
                      {platform.name}
                    </span>
                  </a>
                ))}
              </div>
            </section>
          )}

          <section className="mt-6 overflow-hidden rounded-[1.5rem] border border-neutral-100 bg-white">
            <div className="flex items-start gap-3 border-b border-neutral-100 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <CheckCircle size={19} strokeWidth={2.4} />
              </span>
              <div>
                <h2 className="text-sm font-extrabold text-neutral-950">
                  No payment is required now
                </h2>
                <p className="mt-1 text-xs leading-5 text-neutral-500">
                  Add all products first. You will pay only after reviewing and accepting the quotation.
                </p>
              </div>
            </div>

            <div className="p-4">
              <p className="mb-4 text-sm font-extrabold text-neutral-950">
                What happens next
              </p>
              <div className="relative flex items-start justify-between">
                <div className="absolute left-[16%] right-[16%] top-[18px] h-px bg-neutral-200" />
                {stepsFlow.map((step) => {
                  const Icon = step.icon;
                  const isActive = step.status === 'active';

                  return (
                    <div
                      key={step.label}
                      className="relative z-10 flex w-1/3 flex-col items-center gap-2 text-center"
                    >
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-full ring-4 ring-white ${
                          isActive
                            ? 'bg-orange-500 text-white'
                            : 'bg-neutral-100 text-neutral-400'
                        }`}
                      >
                        <Icon size={16} strokeWidth={2.4} />
                      </span>
                      <span
                        className={`text-[10px] font-extrabold uppercase tracking-wide ${
                          isActive ? 'text-orange-600' : 'text-neutral-400'
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-[1.35rem] border border-blue-100 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-500 shadow-sm">
                <Sparkles size={18} strokeWidth={2.4} />
              </span>
              <div>
                <h2 className="text-sm font-extrabold text-blue-950">
                  Add multiple products together
                </h2>
                <p className="mt-1 text-xs leading-5 text-blue-800/75">
                  Add everything to one Request Bag, review your items, and submit them together for one quotation.
                </p>
              </div>
            </div>
          </section>

          <button
            type="button"
            onClick={() => navigate('/request-bag')}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-neutral-200 bg-white text-sm font-bold text-neutral-700 transition active:scale-[0.98] active:bg-neutral-50"
          >
            Open Request Bag
            <ExternalLink size={16} strokeWidth={2.4} />
          </button>
        </main>
      </div>
    </div>
  );
}
