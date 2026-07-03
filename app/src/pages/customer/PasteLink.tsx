import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Camera,
  CheckCircle,
  ExternalLink,
  ImageIcon,
  Info,
  Link2,
  Loader2,
  Plus,
  ShieldCheck,
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

const platforms = [
  { name: 'Amazon', key: 'amazon', color: 'bg-orange-50 text-orange-600 ring-orange-200', initial: 'A' },
  { name: 'Flipkart', key: 'flipkart', color: 'bg-blue-50 text-blue-600 ring-blue-200', initial: 'F' },
  { name: 'Myntra', key: 'myntra', color: 'bg-pink-50 text-pink-600 ring-pink-200', initial: 'M' },
  { name: 'Meesho', key: 'meesho', color: 'bg-violet-50 text-violet-600 ring-violet-200', initial: 'M' },
];

type PreviewState = {
  url: string;
  loading: boolean;
  data: ProductLinkPreview | null;
};

const emptyPreview: PreviewState = {
  url: '',
  loading: false,
  data: null,
};

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
    url: cleanUrl,
    platform,
    title: makeProductName(platform),
    image: '',
    price: 0,
    currency: 'INR',
    fetched: false,
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
  const { user } = useAuth();

  const locationState = location.state as { initialUrl?: string } | null;
  const [url, setUrl] = useState(locationState?.initialUrl ?? '');
  const [preview, setPreview] = useState<PreviewState>(emptyPreview);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cleanUrl = useMemo(() => normalizeProductUrl(url), [url]);
  const canTryPreview = cleanUrl && cleanUrl.length > 14 && cleanUrl.includes('.');

  /* ---- Auto-fetch preview when URL looks valid ---- */
  useEffect(() => {
    if (!canTryPreview) {
      setPreview(emptyPreview);
      return;
    }

    let cancelled = false;
    const activeUrl = cleanUrl;

    setPreview({
      url: activeUrl,
      loading: true,
      data: null,
    });

    const timer = window.setTimeout(async () => {
      try {
        const data = await fetchProductLinkPreview(activeUrl);
        if (cancelled) return;

        setPreview({
          url: activeUrl,
          loading: false,
          data: data || makeLocalFallbackPreview(activeUrl),
        });
      } catch {
        if (cancelled) return;

        setPreview({
          url: activeUrl,
          loading: false,
          data: makeLocalFallbackPreview(activeUrl),
        });
      }
    }, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canTryPreview, cleanUrl]);

  /* ---- Screenshot upload ---- */
  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }

    setError('');
    setSuccessMessage('');
    setScreenshotFile(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setScreenshotPreview(String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const clearScreenshot = () => {
    setScreenshotFile(null);
    setScreenshotPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetForm = () => {
    setUrl('');
    setPreview(emptyPreview);
    clearScreenshot();
  };

  /* ---- Add to Request Bag ---- */
  const addToRequestBag = async () => {
    setError('');
    setSuccessMessage('');

    const hasUrl = Boolean(cleanUrl);
    const hasScreenshot = Boolean(screenshotFile);

    if (!hasUrl && !hasScreenshot) {
      setError('Please paste a product link or upload a product screenshot.');
      return;
    }

    if (!user) {
      navigate('/login', { state: { from: location.pathname, initialUrl: url } });
      return;
    }

    let productPreview: ProductLinkPreview | null = null;

    if (hasUrl) {
      productPreview = isPreviewForUrl(preview, cleanUrl) ? preview.data : null;

      if (!productPreview) {
        setPreview({ url: cleanUrl, loading: true, data: null });

        try {
          productPreview = await fetchProductLinkPreview(cleanUrl);
        } catch {
          productPreview = makeLocalFallbackPreview(cleanUrl);
        }

        setPreview({
          url: cleanUrl,
          loading: false,
          data: productPreview,
        });
      }
    }

    const platform = productPreview?.platform || (hasUrl ? detectSourcePlatformFromUrl(cleanUrl) : 'other');
    const productName = productPreview?.fetched
      ? productPreview.title
      : hasUrl
        ? makeProductName(platform)
        : 'Screenshot product request';

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
          screenshotFile: screenshotFile || undefined,
        },
      });

      window.dispatchEvent(new Event('shop2bhutan:request-bag-updated'));
      setSuccessMessage('Added to Request Bag. You can add more items or review your bag.');
      resetForm();
    } catch (err) {
      console.error('Failed to add item to Request Bag:', err);
      setError(err instanceof Error ? err.message : 'Unable to add item to Request Bag.');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-32">
      <div className="mx-auto max-w-3xl px-4 pb-8 pt-4">

        {/* ====== MAIN CARD ====== */}
        <section className="relative overflow-hidden rounded-[1.5rem] bg-white p-5 shadow-[0_2px_16px_rgba(0,0,0,0.04)] ring-1 ring-orange-100/60 sm:p-6">
          {/* Soft gradient orb */}
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-orange-100/25 blur-3xl" />

          {/* Header */}
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-[1.15rem] font-bold leading-snug text-gray-950 sm:text-xl">
                Request Product
              </h1>
              <p className="mt-1 text-[0.78rem] leading-relaxed text-neutral-500">
                Paste a shopping link or upload a screenshot. Add items to your Request Bag and request quotation later.
              </p>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-500 shadow-sm ring-1 ring-orange-100/40">
              <ShieldCheck size={21} />
            </span>
          </div>

          {/* No payment info card */}
          <div className="relative mt-4 rounded-2xl border border-orange-100/80 bg-orange-50/60 px-4 py-3.5">
            <div className="flex items-start gap-2.5">
              <Info size={16} className="mt-0.5 shrink-0 text-orange-500" />
              <div>
                <p className="text-[0.8rem] font-bold text-orange-800">No payment required now</p>
                <p className="mt-0.5 text-[0.72rem] leading-relaxed text-orange-700/80">
                  Build your Request Bag first. Shop2Bhutan will verify availability, price, service fee, and delivery fee after you request quotation.
                </p>
              </div>
            </div>
          </div>

          {/* Platform selector */}
          <div className="mt-5 flex justify-center gap-3">
            {platforms.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => {
                  setUrl('');
                  setPreview(emptyPreview);
                }}
                className="group flex flex-col items-center gap-1.5 transition-transform active:scale-95"
              >
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-bold shadow-sm ring-1 transition-shadow group-hover:shadow-md ${p.color}`}
                >
                  {p.initial}
                </span>
                <span className="text-[0.6rem] font-semibold tracking-wide text-neutral-500">
                  {p.name}
                </span>
              </button>
            ))}
          </div>

          {/* ====== URL INPUT SECTION ====== */}
          <div className="relative mt-5">
            <div className="relative">
              <Link2
                size={17}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError('');
                  setSuccessMessage('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void addToRequestBag();
                }}
                placeholder="Paste product URL from Amazon, Flipkart, Myntra, Meesho..."
                className="h-[3rem] w-full rounded-2xl border border-neutral-200/80 bg-neutral-50/60 pl-10 pr-10 text-[0.8rem] text-neutral-800 placeholder:text-neutral-400 focus:border-orange-300 focus:bg-orange-50/30 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
              {url && (
                <button
                  type="button"
                  onClick={() => {
                    setUrl('');
                    setPreview(emptyPreview);
                  }}
                  className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 active:bg-neutral-200"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* ====== SCREENSHOT UPLOAD ====== */}
            <div className="mt-3">
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
                  className="flex min-h-[3.5rem] w-full items-center gap-3 rounded-2xl border-2 border-dashed border-neutral-200/80 bg-neutral-50/40 px-4 text-left transition-colors hover:border-orange-300 hover:bg-orange-50/30 active:border-orange-400"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-500 ring-1 ring-orange-100/40">
                    <Camera size={17} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[0.75rem] font-semibold text-neutral-700">Upload screenshot</p>
                    <p className="text-[0.65rem] leading-relaxed text-neutral-400">
                      Recommended for size, color, price, or unavailable links
                    </p>
                  </div>
                </button>
              ) : (
                <div className="relative overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-sm">
                  <img
                    src={screenshotPreview}
                    alt="Screenshot preview"
                    className="h-36 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={clearScreenshot}
                    className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-neutral-600 shadow-sm ring-1 ring-neutral-200/60 backdrop-blur-sm transition-colors hover:bg-white active:bg-neutral-50"
                  >
                    <X size={14} />
                  </button>
                  <div className="px-3.5 py-2.5">
                    <p className="truncate text-[0.7rem] text-neutral-500">{screenshotFile.name}</p>
                  </div>
                </div>
              )}
            </div>

            {/* ====== PREVIEW LOADING ====== */}
            {preview.loading && (
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-orange-100/60 bg-orange-50/40 p-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-100/50 text-orange-500">
                  <Loader2 size={20} className="animate-spin" />
                </span>
                <div>
                  <p className="text-[0.8rem] font-semibold text-gray-900">Checking product preview...</p>
                  <p className="text-[0.7rem] leading-relaxed text-neutral-500">
                    Auto-preview is optional. You can still add the item.
                  </p>
                </div>
              </div>
            )}

            {/* ====== PREVIEW RESULT ====== */}
            {!preview.loading && preview.data && cleanUrl && (
              <div className="mt-3 overflow-hidden rounded-2xl border border-neutral-200/80 bg-white p-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                <div className="flex gap-3">
                  {preview.data.image ? (
                    <img
                      src={preview.data.image}
                      alt=""
                      className="h-18 w-18 flex-shrink-0 rounded-xl bg-neutral-100 object-cover"
                    />
                  ) : (
                    <span className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl bg-orange-50 ring-1 ring-orange-100/40">
                      <ImageIcon size={22} className="text-orange-400" />
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-1.5">
                      <Sparkles size={12} className="shrink-0 text-orange-500" />
                      <span className="text-[0.65rem] font-bold uppercase tracking-wide text-orange-600">
                        {preview.data.fetched ? 'Preview found' : 'Link detected'}
                      </span>
                    </div>
                    <p className="text-[0.82rem] font-semibold leading-snug text-gray-900 line-clamp-2">
                      {preview.data.fetched ? preview.data.title : manualPreviewTitle(preview.data)}
                    </p>
                    {!preview.data.fetched && (
                      <p className="mt-1 text-[0.65rem] leading-relaxed text-neutral-500">
                        Shop2Bhutan will verify this manually. Add screenshot or price if available.
                      </p>
                    )}
                    <a
                      href={preview.data.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block truncate text-[0.65rem] text-neutral-400 transition-colors hover:text-orange-500"
                    >
                      {preview.data.url}
                    </a>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-orange-600 ring-1 ring-orange-100/40">
                        {preview.data.platform}
                      </span>
                      {preview.data.price ? (
                        <span className="text-[0.72rem] font-bold text-orange-600">
                          Price: {formatPrice(preview.data.price, preview.data.currency)}
                        </span>
                      ) : (
                        <span className="text-[0.65rem] font-medium text-neutral-400">
                          Price will be verified
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ====== SUCCESS MESSAGE ====== */}
            {successMessage && (
              <div className="mt-3 overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3.5">
                <div className="flex gap-2.5">
                  <CheckCircle size={18} className="mt-0.5 shrink-0 text-emerald-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.82rem] font-bold text-emerald-900">Item saved</p>
                    <p className="mt-0.5 text-[0.72rem] leading-relaxed text-emerald-700">
                      {successMessage}
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate('/request-bag')}
                      className="mt-2 inline-flex items-center gap-1 text-[0.72rem] font-bold text-emerald-700 transition-colors hover:text-emerald-800"
                    >
                      View Request Bag
                      <ShoppingBag size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ====== ERROR MESSAGE ====== */}
            {error && (
              <div className="mt-3 rounded-2xl border border-red-100 bg-red-50/70 px-3.5 py-3">
                <p className="flex items-start gap-2 text-[0.78rem] text-red-600">
                  <X size={15} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </p>
              </div>
            )}

            {/* ====== ADD TO REQUEST BAG CTA ====== */}
            <button
              type="button"
              onClick={addToRequestBag}
              disabled={(!cleanUrl && !screenshotFile) || preview.loading || adding}
              className="mt-4 flex h-[3rem] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-sm font-bold text-white shadow-lg shadow-orange-200/50 transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
            >
              {adding ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  Add to Request Bag
                  <Plus size={18} />
                </>
              )}
            </button>
          </div>
        </section>

        {/* ====== BOTTOM SECTION ====== */}
        <div className="mt-4 space-y-3">
          {/* How Request Bag works */}
          <section className="rounded-[1.35rem] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] ring-1 ring-neutral-100/80 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-500 shadow-sm ring-1 ring-orange-100/40">
                <Info size={18} />
              </span>
              <div>
                <p className="text-[0.85rem] font-bold text-gray-900">How Request Bag works</p>
                <p className="mt-1 text-[0.75rem] leading-relaxed text-neutral-500">
                  Add one or many product links first. Later, open Request Bag, review quantities and delivery details, then request one quotation for all items together.
                </p>
              </div>
            </div>
          </section>

          {/* Open Request Bag button */}
          <button
            type="button"
            onClick={() => navigate('/request-bag')}
            className="flex h-[3rem] w-full items-center justify-center gap-2 rounded-2xl border border-neutral-200/80 bg-white text-sm font-bold text-neutral-700 shadow-[0_2px_8px_rgba(0,0,0,0.03)] transition-all hover:bg-neutral-50 active:scale-[0.98] active:bg-neutral-100"
          >
            Open Request Bag
            <ExternalLink size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
