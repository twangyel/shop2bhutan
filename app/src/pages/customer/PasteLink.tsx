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
  { name: 'Amazon', key: 'amazon', color: 'bg-orange-100 text-orange-700 border-orange-300', initial: 'A' },
  { name: 'Flipkart', key: 'flipkart', color: 'bg-blue-100 text-blue-700 border-blue-300', initial: 'F' },
  { name: 'Myntra', key: 'myntra', color: 'bg-pink-100 text-pink-700 border-pink-300', initial: 'M' },
  { name: 'Meesho', key: 'meesho', color: 'bg-violet-100 text-violet-700 border-violet-300', initial: 'M' },
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
  const label = currency === 'BTN' ? 'Nu.' : currency === 'INR' ? '₹' : currency;
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
    <div className="min-h-screen bg-neutral-50 pb-32">
      <div className="bg-white px-5 pt-6 pb-5 border-b border-neutral-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Request Product</h1>
            <p className="text-sm text-neutral-500 mt-1">
              Paste a shopping link or upload a screenshot. Add items to your Request Bag and request quotation later.
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <ShieldCheck size={20} />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
          <p className="text-sm font-bold text-amber-900">No payment required now</p>
          <p className="mt-0.5 text-xs leading-5 text-amber-700">
            Build your Request Bag first. Shop2Bhutan will verify availability, price, service fee, and delivery fee after you request quotation.
          </p>
        </div>

        <div className="flex gap-3 mt-5 justify-center">
          {platforms.map((p) => (
            <div key={p.name} className="flex flex-col items-center gap-1">
              <div
                className={`w-11 h-11 rounded-full border-2 flex items-center justify-center font-bold ${p.color}`}
              >
                {p.initial}
              </div>
              <span className="text-[10px] text-neutral-600">{p.name}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 bg-neutral-50 rounded-2xl p-4">
          <div className="relative">
            <Link2
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
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
              className="w-full h-12 pl-10 pr-10 bg-white border border-neutral-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
            {url && (
              <button
                type="button"
                onClick={() => {
                  setUrl('');
                  setPreview(emptyPreview);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
              >
                <X size={18} />
              </button>
            )}
          </div>

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
                className="w-full min-h-12 border-2 border-dashed border-neutral-300 rounded-xl px-3 py-3 flex items-center justify-center gap-2 text-sm text-neutral-500 hover:border-amber-400 hover:text-amber-600 transition-colors"
              >
                <Camera size={18} />
                <span>Screenshot recommended for size, color, price, or unavailable links</span>
              </button>
            ) : (
              <div className="relative rounded-xl border border-neutral-200 bg-white overflow-hidden">
                <img
                  src={screenshotPreview}
                  alt="Screenshot preview"
                  className="w-full h-32 object-cover"
                />
                <button
                  type="button"
                  onClick={clearScreenshot}
                  className="absolute top-2 right-2 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center shadow-sm"
                >
                  <X size={14} className="text-neutral-600" />
                </button>
                <div className="px-3 py-2 bg-white">
                  <p className="text-xs text-neutral-500 truncate">{screenshotFile.name}</p>
                </div>
              </div>
            )}
          </div>

          {preview.loading && (
            <div className="mt-3 rounded-xl border border-amber-100 bg-white p-3 flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-amber-50 flex items-center justify-center">
                <Loader2 size={20} className="text-amber-500 animate-spin" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Checking product preview...</p>
                <p className="text-xs text-neutral-500">Auto-preview is optional. You can still add the item.</p>
              </div>
            </div>
          )}

          {!preview.loading && preview.data && cleanUrl && (
            <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-3">
              <div className="flex gap-3">
                {preview.data.image ? (
                  <img
                    src={preview.data.image}
                    alt=""
                    className="w-16 h-16 rounded-lg object-cover bg-neutral-100 flex-shrink-0"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
                    <ImageIcon size={22} className="text-neutral-400" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sparkles size={13} className="text-amber-500" />
                    <span className="text-[11px] font-semibold text-amber-600">
                      {preview.data.fetched ? 'Product preview found' : 'Link detected'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-900 line-clamp-2">
                    {preview.data.fetched ? preview.data.title : manualPreviewTitle(preview.data)}
                  </p>
                  {!preview.data.fetched && (
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      Shop2Bhutan will verify this manually. Add screenshot or price if available.
                    </p>
                  )}
                  <a
                    href={preview.data.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-[11px] text-neutral-400 truncate mt-0.5"
                  >
                    {preview.data.url}
                  </a>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 bg-neutral-100 text-neutral-600 text-[10px] font-medium rounded-full uppercase">
                      {preview.data.platform}
                    </span>
                    {preview.data.price ? (
                      <span className="text-xs font-bold text-amber-600">
                        Price shown on site: {formatPrice(preview.data.price, preview.data.currency)}
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-neutral-500">
                        Price will be verified
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
              <div className="flex gap-2">
                <CheckCircle size={18} className="text-emerald-600 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-emerald-800">Item saved</p>
                  <p className="text-xs leading-5 text-emerald-700">{successMessage}</p>
                  <button
                    type="button"
                    onClick={() => navigate('/request-bag')}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700 underline"
                  >
                    View Request Bag
                    <ShoppingBag size={13} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={addToRequestBag}
            disabled={(!cleanUrl && !screenshotFile) || preview.loading || adding}
            className="w-full h-12 bg-amber-500 text-white font-semibold rounded-xl mt-3 hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
      </div>

      <div className="px-4 mt-4 space-y-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm border border-neutral-100">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Info size={18} />
            </span>
            <div>
              <p className="text-sm font-bold text-gray-900">How Request Bag works</p>
              <p className="mt-1 text-xs leading-5 text-neutral-500">
                Add one or many product links first. Later, open Request Bag, review quantities and delivery details, then request one quotation for all items together.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/request-bag')}
          className="w-full h-12 rounded-xl bg-white border border-neutral-200 text-sm font-bold text-neutral-700 flex items-center justify-center gap-2"
        >
          Open Request Bag
          <ExternalLink size={16} />
        </button>
      </div>
    </div>
  );
}
