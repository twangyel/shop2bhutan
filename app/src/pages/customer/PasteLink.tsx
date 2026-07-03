import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
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

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const platforms = [
  { name: 'Amazon',   key: 'amazon',   bg: 'bg-orange-50',  text: 'text-orange-600',  ring: 'ring-orange-200',  grad: 'from-orange-400 to-amber-500' },
  { name: 'Flipkart', key: 'flipkart', bg: 'bg-blue-50',    text: 'text-blue-600',    ring: 'ring-blue-200',    grad: 'from-blue-400 to-blue-600' },
  { name: 'Myntra',   key: 'myntra',   bg: 'bg-pink-50',    text: 'text-pink-600',    ring: 'ring-pink-200',    grad: 'from-pink-400 to-rose-500' },
  { name: 'Meesho',   key: 'meesho',   bg: 'bg-violet-50',  text: 'text-violet-600',  ring: 'ring-violet-200',  grad: 'from-violet-400 to-purple-500' },
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
  const { user } = useAuth();

  const locationState = location.state as { initialUrl?: string; sourcePlatform?: string } | null;
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

  /* ---- Screenshot upload ---- */
  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    <div className="min-h-screen bg-[#FAF8F5]">
      <div className="mx-auto max-w-3xl">

        {/* ═══════════════ HERO BANNER ═══════════════ */}
        <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-orange-400 to-amber-400 px-5 pb-6 pt-7">
          {/* Decorative circles */}
          <div className="pointer-events-none absolute -right-6 -top-8 h-36 w-36 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -left-4 bottom-0 h-20 w-20 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute right-20 top-2 h-3 w-3 rounded-full bg-white/30" />
          <div className="pointer-events-none absolute right-8 bottom-4 h-2 w-2 rounded-full bg-white/25" />

          <div className="relative">
            {/* Back + title row */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors active:bg-white/30"
              >
                <ArrowRight size={18} className="rotate-180" />
              </button>
              <h1 className="text-xl font-bold text-white">Request Product</h1>
            </div>

            <p className="mt-2.5 max-w-[280px] text-[0.82rem] leading-relaxed text-white/85">
              Paste a link or upload a screenshot. We will verify and quote.
            </p>

            {/* Inline trust row */}
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/20 px-3.5 py-1.5 backdrop-blur-sm">
              <CheckCircle size={13} className="text-white" />
              <span className="text-[0.72rem] font-medium text-white/90">No payment required now</span>
            </div>
          </div>
        </div>

        {/* ═══════════════ STEP FLOW BAR ═══════════════ */}
        <div className="mx-4 -mt-3 relative z-10">
          <div className="rounded-2xl bg-white p-3.5 shadow-lg shadow-orange-100/30 ring-1 ring-orange-100/40">
            <div className="flex items-center justify-between">
              {stepsFlow.map((step, idx) => {
                const Icon = step.icon;
                const isActive = step.status === 'active';
                const isLast = idx === stepsFlow.length - 1;
                return (
                  <div key={step.label} className="flex flex-1 items-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <span className={`flex h-9 w-9 items-center justify-center rounded-full text-white shadow-sm ${isActive ? 'bg-orange-500' : 'bg-neutral-200'}`}>
                        <Icon size={16} />
                      </span>
                      <span className={`text-[0.55rem] font-bold uppercase tracking-wider ${isActive ? 'text-orange-600' : 'text-neutral-400'}`}>
                        {step.label}
                      </span>
                    </div>
                    {!isLast && (
                      <div className="mx-1 mb-4 h-px flex-1 bg-gradient-to-r from-orange-200 to-neutral-200" />
                    )}
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
            <p className="mb-3 px-0.5 text-[0.75rem] font-bold uppercase tracking-wider text-neutral-400">
              Select Store
            </p>
            <div className="grid grid-cols-4 gap-2.5">
              {platforms.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => selectPlatform(p.key)}
                  className="group flex flex-col items-center gap-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-neutral-100/60 transition-all active:scale-95"
                >
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold shadow-sm ring-1 ${p.bg} ${p.text} ${p.ring} transition-shadow group-hover:shadow-md`}>
                    {p.name[0]}
                  </span>
                  <span className="text-[0.65rem] font-semibold text-neutral-600">{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ----- URL Input ----- */}
          <div className="mt-5">
            <p className="mb-3 px-0.5 text-[0.75rem] font-bold uppercase tracking-wider text-neutral-400">
              Product Link
            </p>
            <div className="relative">
              <Link2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400" />
              <input
                type="url"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setError(''); setSuccessMessage(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') void addToRequestBag(); }}
                placeholder="Paste product URL here..."
                className="h-14 w-full rounded-2xl border-2 border-blue-100 bg-blue-50/30 pl-12 pr-11 text-[0.85rem] text-neutral-800 placeholder:text-neutral-400 transition-all focus:border-blue-300 focus:bg-blue-50/50 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
              />
              {url ? (
                <button
                  type="button"
                  onClick={() => { setUrl(''); setPreview(emptyPreview); }}
                  className="absolute right-3.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition-colors hover:bg-neutral-200"
                >
                  <X size={15} />
                </button>
              ) : (
                <ScanLine size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-300" />
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
                className="flex h-20 w-full items-center gap-4 rounded-2xl border-2 border-dashed border-blue-150 bg-blue-50/20 px-5 transition-all hover:border-blue-300 hover:bg-blue-50/40 active:border-blue-400"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-500 shadow-sm ring-1 ring-blue-100/40">
                  <Camera size={22} />
                </span>
                <div className="text-left">
                  <p className="text-[0.82rem] font-bold text-neutral-700">Upload a screenshot</p>
                  <p className="text-[0.7rem] leading-relaxed text-neutral-400">
                    Tap to choose an image from your gallery
                  </p>
                </div>
              </button>
            ) : (
              <div className="relative overflow-hidden rounded-2xl border-2 border-blue-200 bg-white shadow-md">
                <img src={screenshotPreview} alt="Preview" className="h-44 w-full object-cover" />
                <button
                  type="button"
                  onClick={clearScreenshot}
                  className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-neutral-600 shadow-lg ring-1 ring-neutral-200/60 backdrop-blur-sm transition-colors hover:bg-white"
                >
                  <X size={16} />
                </button>
                <div className="flex items-center gap-2 px-4 py-3">
                  <CheckCircle size={15} className="text-emerald-500" />
                  <p className="truncate text-[0.75rem] font-medium text-neutral-600">{screenshotFile.name}</p>
                </div>
              </div>
            )}
          </div>

          {/* ----- Preview Loading ----- */}
          {preview.loading && (
            <div className="mt-4 flex items-center gap-4 rounded-2xl border border-blue-100 bg-blue-50/30 p-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100/40 text-blue-500">
                <Loader2 size={22} className="animate-spin" />
              </span>
              <div>
                <p className="text-[0.85rem] font-bold text-gray-900">Fetching product info...</p>
                <p className="text-[0.72rem] text-neutral-500">Hang tight while we check the link</p>
              </div>
            </div>
          )}

          {/* ----- Preview Result ----- */}
          {!preview.loading && preview.data && cleanUrl && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200/80 bg-white shadow-md">
              <div className="flex gap-4 p-4">
                {preview.data.image ? (
                  <img src={preview.data.image} alt="" className="h-20 w-20 flex-shrink-0 rounded-xl bg-neutral-100 object-cover" />
                ) : (
                  <span className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 ring-1 ring-blue-100/40">
                    <Package size={26} className="text-blue-400" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-violet-600 ring-1 ring-violet-100/40">
                      {preview.data.platform}
                    </span>
                    {preview.data.price ? (
                      <span className="text-[0.78rem] font-bold text-orange-600">
                        {formatPrice(preview.data.price, preview.data.currency)}
                      </span>
                    ) : (
                      <span className="text-[0.65rem] font-medium text-neutral-400">Price TBD</span>
                    )}
                  </div>
                  <p className="text-[0.85rem] font-semibold leading-snug text-gray-900 line-clamp-2">
                    {preview.data.fetched ? preview.data.title : manualPreviewTitle(preview.data)}
                  </p>
                  {!preview.data.fetched && (
                    <p className="mt-1 text-[0.7rem] leading-relaxed text-neutral-500">
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
                  <CheckCircle size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.9rem] font-bold text-emerald-900">Saved to Request Bag</p>
                  <p className="mt-0.5 text-[0.78rem] leading-relaxed text-emerald-700">{successMessage}</p>
                  <button
                    type="button"
                    onClick={() => navigate('/request-bag')}
                    className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-[0.8rem] font-bold text-white shadow-sm transition-colors hover:bg-emerald-600 active:bg-emerald-700"
                  >
                    Open Request Bag <ShoppingBag size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ----- Error ----- */}
          {error && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5">
              <p className="flex items-start gap-2.5 text-[0.82rem] font-medium text-red-700">
                <X size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </p>
            </div>
          )}

          {/* ----- ADD TO REQUEST BAG CTA ----- */}
          <button
            type="button"
            onClick={addToRequestBag}
            disabled={(!cleanUrl && !screenshotFile) || preview.loading || adding}
            className="mt-5 flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-[0.95rem] font-bold text-white shadow-xl shadow-orange-200/60 transition-all active:scale-[0.97] active:shadow-lg disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100"
          >
            {adding ? (
              <><Loader2 size={20} className="animate-spin" /> Adding...</>
            ) : (
              <><Plus size={20} strokeWidth={2.5} /> Add to Request Bag</>
            )}
          </button>

          {/* ═══════════════ BOTTOM SECTIONS ═══════════════ */}
          <div className="mt-6 space-y-4">

            {/* Tip card */}
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-100/60">
              <div className="flex items-start gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-500 ring-1 ring-blue-100/40">
                  <Sparkles size={18} />
                </span>
                <div>
                  <p className="text-[0.82rem] font-bold text-gray-900">Pro tip</p>
                  <p className="mt-1 text-[0.75rem] leading-relaxed text-neutral-500">
                    Add multiple products to your bag first, then request one quotation for everything together. Saves time and delivery cost.
                  </p>
                </div>
              </div>
            </div>

            {/* How it works — numbered steps */}
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-100/60">
              <p className="mb-3.5 text-[0.8rem] font-bold text-gray-900">How it works</p>
              <div className="space-y-3">
                {[
                  { num: '1', text: 'Paste product link or upload screenshot', accent: 'bg-orange-50 text-orange-600' },
                  { num: '2', text: 'Add items to your Request Bag', accent: 'bg-violet-50 text-violet-600' },
                  { num: '3', text: 'Review and request quotation', accent: 'bg-blue-50 text-blue-600' },
                  { num: '4', text: 'Pay after you approve the quote', accent: 'bg-emerald-50 text-emerald-600' },
                ].map((s) => (
                  <div key={s.num} className="flex items-center gap-3">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[0.7rem] font-bold ${s.accent}`}>
                      {s.num}
                    </span>
                    <p className="text-[0.78rem] text-neutral-600">{s.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Open Request Bag */}
            <button
              type="button"
              onClick={() => navigate('/request-bag')}
              className="flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-neutral-200 bg-white text-[0.9rem] font-bold text-neutral-700 shadow-sm transition-all hover:bg-neutral-50 active:scale-[0.98]"
            >
              Open Request Bag <ExternalLink size={17} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
