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
    <div className="min-h-[100dvh] bg-neutral-50">
      {/* ═══════════════ HEADER ═══════════════ */}
      <header className="bg-white">
        <div className="px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
          <h1 className="text-lg font-extrabold tracking-tight text-slate-950">
            Add a product
          </h1>
        </div>
      </header>

      {/* ═══════════════ MAIN ═══════════════ */}
      <main className="px-4 pb-[calc(10rem+env(safe-area-inset-bottom))] pt-3">

        {/* ── Compact stepper ── */}
        <section className="rounded-2xl bg-white p-3 shadow-sm shadow-slate-100 ring-1 ring-slate-100">
          <div className="relative flex items-center">
            <div className="absolute left-[18%] right-[18%] top-1/2 h-px -translate-y-1/2 bg-slate-200" />
            {stepsFlow.map((step) => {
              const Icon = step.icon;
              const isActive = step.status === 'active';

              return (
                <div
                  key={step.label}
                  className="relative z-10 flex w-1/3 flex-col items-center gap-1.5 text-center"
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-white ${
                      isActive
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    <Icon size={14} strokeWidth={2.4} />
                  </span>
                  <span
                    className={`text-[9px] font-extrabold uppercase tracking-wide ${
                      isActive ? 'text-orange-600' : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Accepted stores (compact horizontal scroll) ── */}
        {visiblePlatforms.length > 0 && (
          <section className="mt-3">
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-orange-500">
                Accepted stores
              </p>
              <span className="text-[10px] font-medium text-slate-400">
                Tap to open
              </span>
            </div>

            <div className="mt-2 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {visiblePlatforms.map((platform) => (
                <a
                  key={platform.name}
                  href={platform.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => selectPlatform(platform.key)}
                  className="flex w-[72px] shrink-0 flex-col items-center gap-1.5 rounded-xl bg-white py-2.5 shadow-sm shadow-slate-100 ring-1 ring-slate-100 transition active:scale-95"
                >
                  <span className="flex h-8 w-8 items-center justify-center">
                    <img
                      src={platform.logo}
                      alt={platform.name}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  </span>
                  <span className="text-[10px] font-bold text-slate-600">
                    {platform.name}
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Hide scrollbar for horizontal scroll */}
        <style>{`
          .scrollbar-hide::-webkit-scrollbar { display: none; }
          .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>

        {/* ── Input card (hero) ── */}
        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm shadow-slate-100 ring-1 ring-slate-100">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white shadow-md shadow-orange-500/20">
              <Link2 size={18} strokeWidth={2.2} />
            </span>
            <div>
              <h2 className="text-sm font-extrabold text-slate-950">
                Paste product link
              </h2>
              <p className="text-[11px] text-slate-400">
                Amazon, Flipkart, Myntra, or Meesho
              </p>
            </div>
          </div>

          <div className="relative mt-3">
            <Link2
              size={17}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
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
              className="h-[52px] w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-11 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:bg-white focus:ring-[3px] focus:ring-orange-500/10"
            />

            {url ? (
              <button
                type="button"
                onClick={() => {
                  setUrl('');
                  setPreview(emptyPreview);
                }}
                className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-white text-slate-400 shadow-sm ring-1 ring-slate-200 transition active:scale-95"
                aria-label="Clear product link"
              >
                <X size={15} strokeWidth={2.4} />
              </button>
            ) : (
              <ScanLine
                size={17}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-300"
                strokeWidth={2}
              />
            )}
          </div>

          <div className="my-3 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-100" />
            <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
              or upload instead
            </span>
            <div className="h-px flex-1 bg-slate-100" />
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
              className="flex min-h-[72px] w-full items-center gap-3.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-left transition active:scale-[0.99] active:border-orange-400 active:bg-orange-50/40"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-orange-500 shadow-sm ring-1 ring-slate-100">
                <Camera size={20} strokeWidth={2.1} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold text-slate-900">
                  Upload screenshot
                </span>
                <span className="text-[11px] leading-5 text-slate-400">
                  When a shareable link is not available
                </span>
              </span>
            </button>
          ) : (
            <div className="overflow-hidden rounded-xl border border-orange-200 bg-white">
              <div className="relative flex min-h-[180px] max-h-[320px] items-center justify-center bg-slate-50">
                <img
                  src={screenshotPreview}
                  alt="Uploaded product screenshot"
                  className="max-h-[320px] w-full object-contain"
                />
                <button
                  type="button"
                  onClick={clearScreenshot}
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 shadow-lg ring-1 ring-slate-200 transition active:scale-95"
                  aria-label="Remove screenshot"
                >
                  <X size={15} strokeWidth={2.4} />
                </button>
              </div>
              <div className="flex items-center gap-2 px-4 py-3">
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
          )}
        </section>

        {/* ── Preview loading ── */}
        {preview.loading && (
          <section className="mt-3 flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm shadow-slate-100 ring-1 ring-slate-100">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
              <Loader2 size={20} className="animate-spin" strokeWidth={2.4} />
            </span>
            <div>
              <p className="text-sm font-extrabold text-slate-900">
                Checking product link...
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Product details may take a moment to appear.
              </p>
            </div>
          </section>
        )}

        {/* ── Preview result ── */}
        {!preview.loading && preview.data && cleanUrl && (
          <section className="mt-3 overflow-hidden rounded-2xl bg-white shadow-sm shadow-slate-100 ring-1 ring-slate-100">
            <div className="flex gap-3.5 p-4">
              {preview.data.image ? (
                <img
                  src={preview.data.image}
                  alt=""
                  className="h-[72px] w-[72px] shrink-0 rounded-xl bg-slate-100 object-cover"
                />
              ) : (
                <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-xl bg-orange-50">
                  <Package size={24} className="text-orange-400" strokeWidth={2} />
                </span>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-orange-600">
                    {platformLabel(preview.data.platform)}
                  </span>
                  {preview.data.price ? (
                    <span className="text-sm font-extrabold text-orange-600">
                      {formatPrice(preview.data.price, preview.data.currency)}
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-400">
                      Price to be verified
                    </span>
                  )}
                </div>

                <p className="mt-2 line-clamp-2 text-sm font-bold leading-5 text-slate-900">
                  {preview.data.fetched
                    ? preview.data.title
                    : manualPreviewTitle(preview.data)}
                </p>

                {!preview.data.fetched && (
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">
                    Shop2Bhutan will verify this product manually before preparing your quotation.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── Success message ── */}
        {successMessage && (
          <section className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm">
                <CheckCircle size={20} strokeWidth={2.5} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-extrabold text-emerald-950">
                  Added to Request Bag
                </p>
                <p className="mt-1 text-[11px] leading-5 text-emerald-700">
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

        {/* ── Error message ── */}
        {error && (
          <section className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3.5">
            <div className="flex items-start gap-2.5 text-red-700">
              <X size={17} className="mt-0.5 shrink-0" strokeWidth={2.5} />
              <p className="text-sm font-medium leading-5">{error}</p>
            </div>
          </section>
        )}

        {/* ── Tip card (subtle) ── */}
        <section className="mt-4 flex items-start gap-3 rounded-2xl bg-blue-50 px-4 py-3.5">
          <Sparkles size={16} className="mt-0.5 shrink-0 text-blue-500" strokeWidth={2.2} />
          <p className="text-[12px] leading-[1.6] text-blue-800">
            <span className="font-extrabold text-blue-950">Pro tip:</span> Add multiple products to your bag, then request one quotation for everything together.
          </p>
        </section>

        {/* ── Open Request Bag (secondary) ── */}
        <button
          type="button"
          onClick={() => navigate('/request-bag')}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700 transition active:scale-[0.98] active:bg-slate-50"
        >
          Open Request Bag
          <ExternalLink size={15} strokeWidth={2.4} />
        </button>
      </main>

      {/* ═══════════════ STICKY BOTTOM CTA ═══════════════ */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-100 bg-white/95 px-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm">
        <button
          type="button"
          onClick={addToRequestBag}
          disabled={!hasRequestInput || preview.loading || adding}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 text-sm font-extrabold text-white shadow-lg shadow-orange-500/20 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:active:scale-100"
        >
          {adding ? (
            <>
              <Loader2 size={18} className="animate-spin" strokeWidth={2.5} />
              Adding...
            </>
          ) : hasRequestInput ? (
            <>
              <Plus size={18} strokeWidth={2.5} />
              Add to Request Bag
            </>
          ) : (
            'Paste a link or upload a screenshot'
          )}
        </button>
      </div>
    </div>
  );
}
