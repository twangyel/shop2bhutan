import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
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
      setSuccessMessage('Added to Request Bag. You can add more items or review your bag.');
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
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl">

        {/* ═══════════════ HEADER ═══════════════ */}
        <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
          <div className="px-4 pb-3 pt-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100 active:bg-gray-200"
              >
                <ArrowLeft size={20} strokeWidth={2} />
              </button>
              <div>
                <h1 className="text-lg font-bold text-black">Request Product</h1>
                <p className="text-sm text-gray-500">Paste a link or upload a screenshot. We will verify and quote.</p>
              </div>
            </div>

            <div className="mt-2.5 inline-flex items-center gap-2 rounded-full bg-orange-50 border border-orange-100 px-3 py-1">
              <CheckCircle size={13} className="text-orange-500" />
              <span className="text-xs font-medium text-orange-700">No payment required now</span>
            </div>
          </div>
        </header>

        {/* ═══════════════ STEP FLOW BAR ═══════════════ */}
        <div className="mx-4 mt-4">
          <div className="rounded-2xl bg-white border border-gray-100 p-3.5">
            <div className="relative flex justify-between items-start">
              {/* Connector line */}
              <div className="absolute top-[18px] left-[18px] right-[18px] h-px bg-gray-200" />

              {stepsFlow.map((step) => {
                const Icon = step.icon;
                const isActive = step.status === 'active';
                return (
                  <div key={step.label} className="relative z-10 flex flex-col items-center gap-1.5">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full text-white ${isActive ? 'bg-orange-500' : 'bg-gray-200'}`}>
                      <Icon size={16} strokeWidth={2.5} />
                    </span>
                    <span className={`text-[0.55rem] font-bold uppercase tracking-wider ${isActive ? 'text-orange-600' : 'text-gray-400'}`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ═══════════════ MAIN CONTENT ═══════════════ */}
        <div className="px-4 pb-10 pt-5">

          {/* ----- Platform Selector ----- */}
          <div>
            <p className="mb-3 px-0.5 text-xs font-bold uppercase tracking-wider text-gray-400">
              Select Store
            </p>
            <div className="grid grid-cols-4 gap-2.5">
              {visiblePlatforms.map((p) => (
                <a
                  key={p.name}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => selectPlatform(p.key)}
                  className="group flex flex-col items-center gap-2 rounded-2xl p-3 transition-all hover:bg-gray-50 active:scale-95"
                >
                  <div className="h-12 w-12 flex items-center justify-center">
                    <img 
                      src={p.logo} 
                      alt={p.name} 
                      className="h-full w-full object-contain" 
                      loading="lazy"
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-600">{p.name}</span>
                </a>
              ))}
            </div>
          </div>

          {/* ----- URL Input ----- */}
          <div className="mt-5">
            <p className="mb-3 px-0.5 text-xs font-bold uppercase tracking-wider text-gray-400">
              Product Link
            </p>
            <div className="relative">
              <Link2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" strokeWidth={2} />
              <input
                type="url"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setError(''); setSuccessMessage(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') void addToRequestBag(); }}
                placeholder="Paste product URL here..."
                className="h-14 w-full rounded-2xl border-2 border-gray-200 bg-white pl-12 pr-11 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm transition-all focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/10"
              />
              {url ? (
                <button
                  type="button"
                  onClick={() => { setUrl(''); setPreview(emptyPreview); }}
                  className="absolute right-3.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200"
                >
                  <X size={15} strokeWidth={2.5} />
                </button>
              ) : (
                <ScanLine size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300" strokeWidth={2} />
              )}
            </div>
          </div>

          {/* ----- Screenshot Upload ----- */}
          <div className="mt-3">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleScreenshotChange} className="hidden" />

            {!screenshotFile ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-20 w-full items-center gap-4 rounded-2xl border-2 border-dashed border-gray-300 bg-white px-5 shadow-sm transition-all hover:border-orange-400 hover:bg-orange-50/30 active:border-orange-500"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                  <Camera size={22} strokeWidth={2} />
                </span>
                <div className="text-left">
                  <p className="text-sm font-bold text-gray-900">Upload a screenshot</p>
                  <p className="text-xs leading-relaxed text-gray-400">
                    Tap to choose an image from your gallery
                  </p>
                </div>
              </button>
            ) : (
              <div className="relative overflow-hidden rounded-2xl border-2 border-orange-200 bg-white shadow-sm">
                <img src={screenshotPreview} alt="Preview" className="h-44 w-full object-cover" />
                <button
                  type="button"
                  onClick={clearScreenshot}
                  className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-600 shadow-lg ring-1 ring-gray-200 transition-colors hover:bg-gray-50"
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
                <div className="flex items-center gap-2 px-4 py-3">
                  <CheckCircle size={15} className="text-emerald-500" strokeWidth={2.5} />
                  <p className="truncate text-xs font-medium text-gray-600">{screenshotFile.name}</p>
                </div>
              </div>
            )}
          </div>

          {/* ----- Preview Loading ----- */}
          {preview.loading && (
            <div className="mt-4 flex items-center gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                <Loader2 size={22} className="animate-spin" strokeWidth={2.5} />
              </span>
              <div>
                <p className="text-sm font-bold text-gray-900">Fetching product info...</p>
                <p className="text-xs text-gray-500">Hang tight while we check the link</p>
              </div>
            </div>
          )}

          {/* ----- Preview Result ----- */}
          {!preview.loading && preview.data && cleanUrl && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="flex gap-4 p-4">
                {preview.data.image ? (
                  <img src={preview.data.image} alt="" className="h-20 w-20 flex-shrink-0 rounded-xl bg-gray-100 object-cover" />
                ) : (
                  <span className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-xl bg-orange-50">
                    <Package size={26} className="text-orange-400" strokeWidth={2} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-orange-600">
                      {preview.data.platform}
                    </span>
                    {preview.data.price ? (
                      <span className="text-sm font-bold text-orange-600">
                        {formatPrice(preview.data.price, preview.data.currency)}
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-gray-400">Price TBD</span>
                    )}
                  </div>
                  <p className="text-sm font-semibold leading-snug text-gray-900 line-clamp-2">
                    {preview.data.fetched ? preview.data.title : manualPreviewTitle(preview.data)}
                  </p>
                  {!preview.data.fetched && (
                    <p className="mt-1 text-xs leading-relaxed text-gray-500">
                      We will verify this product manually.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ----- Success ----- */}
          {successMessage && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle size={20} strokeWidth={2.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-emerald-900">Saved to Request Bag</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-emerald-700">{successMessage}</p>
                  <button
                    type="button"
                    onClick={() => navigate('/request-bag')}
                    className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-bold text-white transition-colors hover:bg-emerald-600 active:bg-emerald-700"
                  >
                    Open Request Bag <ShoppingBag size={16} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ----- Error ----- */}
          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5">
              <p className="flex items-start gap-2.5 text-sm font-medium text-red-700">
                <X size={16} className="mt-0.5 shrink-0" strokeWidth={2.5} />
                <span>{error}</span>
              </p>
            </div>
          )}

          {/* ----- ADD TO REQUEST BAG CTA ----- */}
          <button
            type="button"
            onClick={addToRequestBag}
            disabled={(!cleanUrl && !screenshotFile) || preview.loading || adding}
            className="mt-5 flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-orange-500 text-sm font-bold text-white transition-colors hover:bg-orange-600 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
          >
            {adding ? (
              <><Loader2 size={20} className="animate-spin" strokeWidth={2.5} /> Adding...</>
            ) : (
              <><Plus size={20} strokeWidth={2.5} /> Add to Request Bag</>
            )}
          </button>

          {/* ═══════════════ BOTTOM SECTIONS ═══════════════ */}
          <div className="mt-6 space-y-4">

            {/* Tip card */}
            <div className="rounded-2xl bg-white border border-gray-100 p-4">
              <div className="flex items-start gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-500">
                  <Sparkles size={18} strokeWidth={2.5} />
                </span>
                <div>
                  <p className="text-sm font-bold text-gray-900">Pro tip</p>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">
                    Add multiple products to your bag first, then request one quotation for everything together. Saves time and delivery cost.
                  </p>
                </div>
              </div>
            </div>

            {/* How it works — numbered steps */}
            <div className="rounded-2xl bg-white border border-gray-100 p-4">
              <p className="mb-3.5 text-sm font-bold text-gray-900">How it works</p>
              <div className="space-y-3">
                {[
                  { num: '1', text: 'Paste product link or upload screenshot', accent: 'bg-orange-50 text-orange-600' },
                  { num: '2', text: 'Add items to your Request Bag', accent: 'bg-violet-50 text-violet-600' },
                  { num: '3', text: 'Review and request quotation', accent: 'bg-blue-50 text-blue-600' },
                  { num: '4', text: 'Pay after you approve the quote', accent: 'bg-emerald-50 text-emerald-600' },
                ].map((s) => (
                  <div key={s.num} className="flex items-center gap-3">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${s.accent}`}>
                      {s.num}
                    </span>
                    <p className="text-xs text-gray-600">{s.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Open Request Bag */}
            <button
              type="button"
              onClick={() => navigate('/request-bag')}
              className="flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-gray-200 bg-white text-sm font-bold text-gray-700 transition-all hover:bg-gray-50 active:scale-[0.98]"
            >
              Open Request Bag <ExternalLink size={17} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
