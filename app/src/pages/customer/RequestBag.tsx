import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  Edit3,
  ImageIcon,
  Loader2,
  MapPin,
  Minus,
  Package,
  Phone,
  Plus,
  ShoppingBag,
  Trash2,
  User,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  fetchActiveRequestBag,
  fetchActiveRequestBagFast,
  removeRequestBagItem,
  submitRequestBagAsOrder,
  updateRequestBagItem,
} from '@/lib/customerOrders';
import type { FulfillmentMode, RequestBag as RequestBagType, RequestBagItem } from '@/types';

type AnyRow = Record<string, any>;

type ProfileLike = {
  full_name?: string | null;
  name?: string | null;
  phone?: string | null;
  default_dzongkhag_id?: string | null;
  dzongkhag?: string | null;
  delivery_address?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  gewog?: string | null;
  village?: string | null;
  landmark?: string | null;
};

type DzongkhagOption = {
  id: string;
  name: string;
};

type CustomerAddress = {
  recipientName: string;
  phone: string;
  formattedAddress: string;
  label: string;
  isDefault: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanString(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function firstString(row: AnyRow | null | undefined, keys: string[], fallback = '') {
  if (!row) return fallback;

  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }

  return fallback;
}

function compactParts(parts: unknown[]) {
  const seen = new Set<string>();

  return parts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .filter((part) => {
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeDzongkhagOptions(data: unknown): DzongkhagOption[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as AnyRow;
      const id = cleanString(row.id);
      const name = cleanString(row.name);
      return id && name ? { id, name } : null;
    })
    .filter((item): item is DzongkhagOption => Boolean(item));
}

function getDzongkhagDisplayName(value: string | null | undefined, options: DzongkhagOption[]) {
  const cleanValue = value?.trim() || '';
  if (!cleanValue) return '';
  if (!UUID_RE.test(cleanValue)) return cleanValue;
  return options.find((item) => item.id === cleanValue)?.name || '';
}

function makeAddressText(row: AnyRow, options: DzongkhagOption[]) {
  const dzongkhag = getDzongkhagDisplayName(
    firstString(row, ['dzongkhag', 'dzongkhag_name', 'dzongkhag_id', 'default_dzongkhag_id', 'delivery_dzongkhag', 'delivery_city']),
    options
  );

  return compactParts([
    firstString(row, ['delivery_address', 'full_address', 'formatted_address', 'address_text', 'address', 'address_line1', 'address1', 'line1', 'street_address', 'town_area', 'town_area_name', 'town', 'area', 'area_name', 'locality', 'city', 'thromde', 'municipality', 'location']),
    firstString(row, ['address_line2', 'address2', 'line2', 'building', 'building_name', 'building_no', 'house', 'house_no', 'house_number', 'flat_no', 'apartment', 'floor', 'unit', 'room_no']),
    firstString(row, ['village', 'delivery_village']),
    firstString(row, ['gewog', 'delivery_gewog']),
    dzongkhag,
    firstString(row, ['landmark', 'delivery_landmark']),
  ]).join(', ');
}

function makeDeliveryAddress(profile: ProfileLike | null, options: DzongkhagOption[]) {
  if (!profile) return '';
  return makeAddressText(profile as AnyRow, options);
}

function mapCustomerAddress(row: AnyRow, options: DzongkhagOption[]): CustomerAddress {
  const formattedAddress = makeAddressText(row, options);

  return {
    recipientName: firstString(row, ['recipient_name', 'name', 'full_name', 'customer_name'], ''),
    phone: firstString(row, ['phone', 'recipient_phone', 'delivery_phone', 'customer_phone', 'whatsapp'], ''),
    formattedAddress,
    label: firstString(row, ['label', 'address_label'], 'Delivery'),
    isDefault: Boolean(row.is_default ?? row.isDefault ?? row.default),
  };
}

function formatPrice(value?: number) {
  if (!value || value <= 0) return '';
  return `₹ ${Math.round(value).toLocaleString()}`;
}

function platformLabel(platform?: string) {
  const raw = String(platform ?? '').toLowerCase();

  if (raw === 'amazon') return 'Amazon';
  if (raw === 'flipkart') return 'Flipkart';
  if (raw === 'myntra') return 'Myntra';
  if (raw === 'meesho') return 'Meesho';

  return 'Link';
}

function extractDomain(url?: string) {
  if (!url) return '';
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return url.length > 32 ? url.slice(0, 32) + '…' : url;
  }
}

function platformStyles(platform?: string) {
  const p = String(platform ?? '').toLowerCase();
  if (p === 'amazon') return { bg: 'bg-orange-100', text: 'text-orange-600', initial: 'A' };
  if (p === 'flipkart') return { bg: 'bg-blue-100', text: 'text-blue-600', initial: 'F' };
  if (p === 'myntra') return { bg: 'bg-pink-100', text: 'text-pink-600', initial: 'M' };
  if (p === 'meesho') return { bg: 'bg-purple-100', text: 'text-purple-600', initial: 'M' };
  return { bg: 'bg-gray-100', text: 'text-gray-400', initial: null };
}

type SelfPickupOption = {
  id: string;
  name: string;
  dzongkhag: string;
  pickupInstructions: string;
};

const SELF_PICKUP_OPTIONS: SelfPickupOption[] = [
  {
    id: 'jaigaon_pickup_point',
    name: 'Collect from Jaigaon',
    dzongkhag: 'Jaigaon pickup point',
    pickupInstructions:
      'Choose this only if you can personally collect the parcel from the Jaigaon pickup point. Shop2Bhutan will coordinate the order, but Bhutan delivery is not included.',
  },
  {
    id: 'shop2bhutan_handover',
    name: 'Collect from Shop2Bhutan',
    dzongkhag: 'Agreed pickup location',
    pickupInstructions:
      'Shop2Bhutan will receive the item and share the pickup location and timing after it arrives. Delivery to your address is not included.',
  },
];

function getSelfPickupOptionById(id: string) {
  return (
    SELF_PICKUP_OPTIONS.find((option) => option.id === id) ??
    SELF_PICKUP_OPTIONS[0]
  );
}


const REQUEST_BAG_CACHE_PREFIX = 'shop2bhutan:request-bag:';

function requestBagCacheKey(userId: string) {
  return `${REQUEST_BAG_CACHE_PREFIX}${userId}`;
}

function readCachedRequestBag(userId: string): RequestBagType | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(requestBagCacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RequestBagType;
    return parsed?.id ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedRequestBag(userId: string, value: RequestBagType | null) {
  if (typeof window === 'undefined' || !value) return;

  try {
    window.sessionStorage.setItem(requestBagCacheKey(userId), JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private mode. Ignore silently.
  }
}

function clearCachedRequestBag(userId: string) {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(requestBagCacheKey(userId));
  } catch {
    // Ignore silently.
  }
}

async function fetchSavedDefaultAddress(userId: string, options: DzongkhagOption[]) {
  const { data, error } = await supabase
    .from('customer_addresses')
    .select('*')
    .eq('user_id', userId)
    .limit(25);

  if (error) {
    console.warn('[RequestBag] Saved address lookup skipped:', error.message);
    return null;
  }

  const rows = Array.isArray(data) ? (data as AnyRow[]) : [];
  if (rows.length === 0) return null;

  const defaultRow = rows.find((row) => Boolean(row.is_default ?? row.isDefault ?? row.default)) || rows[0];
  return mapCustomerAddress(defaultRow, options);
}

function BagItemCard({
  item,
  saving,
  onPatch,
  onRemove,
}: {
  item: RequestBagItem;
  saving: boolean;
  onPatch: (itemId: string, patch: Partial<Pick<RequestBagItem, 'productName' | 'priceShown' | 'quantity' | 'notes'>>) => void;
  onRemove: (itemId: string) => void;
}) {
  const ps = platformStyles(item.sourcePlatform);

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
      <div className="flex gap-3">
        {item.productImage ? (
          <img
            src={item.productImage}
            alt=""
            className="h-20 w-20 flex-shrink-0 rounded-xl bg-gray-100 object-cover"
          />
        ) : (
          <div className={`flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-xl ${ps.bg}`}>
            {ps.initial ? (
              <span className={`text-lg font-bold ${ps.text}`}>{ps.initial}</span>
            ) : (
              <ImageIcon size={22} className={ps.text} />
            )}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <input
            type="text"
            value={item.productName}
            onChange={(e) => onPatch(item.id, { productName: e.target.value })}
            onBlur={() => onPatch(item.id, { productName: item.productName })}
            className="w-full border-0 p-0 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-0"
            placeholder="Product name"
          />

          {item.sourceUrl ? (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block truncate text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              {extractDomain(item.sourceUrl)}
            </a>
          ) : (
            <span className="mt-1 inline-block rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-600">
              Screenshot request
            </span>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase text-gray-600">
              {platformLabel(item.sourcePlatform)}
            </span>
            {item.screenshotUrl && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-600">
                Screenshot saved
              </span>
            )}
            {saving && (
              <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                <Loader2 size={10} className="animate-spin" />
                Saving
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="self-start p-1 text-red-400"
          aria-label="Remove item"
        >
          <Trash2 size={17} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_140px] gap-3">
        <div>
          <label className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
            Price shown on site
          </label>
          <input
            type="number"
            value={item.priceShown || ''}
            onChange={(e) => onPatch(item.id, { priceShown: Number(e.target.value) || 0 })}
            onBlur={() => onPatch(item.id, { priceShown: item.priceShown })}
            placeholder="Optional"
            className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          />
        </div>

        <div>
          <label className="block text-center text-[10px] font-medium uppercase tracking-wider text-gray-400">
            Qty
          </label>
          <div className="mt-1 flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPatch(item.id, { quantity: Math.max(1, item.quantity - 1) })}
              className="flex h-10 w-9 items-center justify-center rounded-xl bg-gray-100"
            >
              <Minus size={14} />
            </button>
            <span className="w-8 text-center text-sm font-semibold">{item.quantity}</span>
            <button
              type="button"
              onClick={() => onPatch(item.id, { quantity: item.quantity + 1 })}
              className="flex h-10 w-9 items-center justify-center rounded-xl bg-gray-100"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>

      {item.priceShown > 0 && (
        <p className="mt-2 text-xs font-semibold text-orange-600">
          Site price estimate: {formatPrice(item.priceShown * item.quantity)}
        </p>
      )}

      <textarea
        value={item.notes || ''}
        onChange={(e) => onPatch(item.id, { notes: e.target.value })}
        onBlur={() => onPatch(item.id, { notes: item.notes || '' })}
        placeholder="Size, color, variant, or instruction for this item..."
        rows={2}
        className="mt-3 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
      />
    </div>
  );
}

export default function RequestBag() {
  const navigate = useNavigate();
  const { user, context, loading: authLoading } = useAuth();
  const profile = (context?.profile ?? null) as ProfileLike | null;

  const [bag, setBag] = useState<RequestBagType | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingItemId, setSavingItemId] = useState('');
  const [removingItemId, setRemovingItemId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState('');
  const [deliveryExpanded, setDeliveryExpanded] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [savedAddress, setSavedAddress] = useState<CustomerAddress | null>(null);
  const [dzongkhagOptions, setDzongkhagOptions] = useState<DzongkhagOption[]>([]);
  const [fulfillmentMode, setFulfillmentMode] = useState<FulfillmentMode>('delivery');
  const [pickupHubId, setPickupHubId] = useState(SELF_PICKUP_OPTIONS[0].id);

  const [customer, setCustomer] = useState({
    name: '',
    phone: '',
    deliveryAddress: '',
    notes: '',
  });

  const hasItems = Boolean(bag?.items.length);
  const selectedPickupHub = getSelfPickupOptionById(pickupHubId);
  const isSelfPickup = fulfillmentMode === 'self_pickup';
  const hasDeliveryAddress = isSelfPickup || Boolean(customer.deliveryAddress.trim());
  const showDeliveryFields = deliveryExpanded || !customer.name.trim() || !customer.phone.trim() || (!isSelfPickup && !customer.deliveryAddress.trim());
  const itemCount = bag?.items.length ?? 0;
  const totalQuantity = bag?.items.reduce((sum, item) => sum + Math.max(1, item.quantity || 1), 0) ?? 0;
  const estimatedSiteTotal = bag?.items.reduce((sum, item) => sum + Math.max(0, item.priceShown || 0) * Math.max(1, item.quantity || 1), 0) ?? 0;

  const loadBag = useCallback(async () => {
    if (!user) {
      setBag(null);
      setLoading(false);
      return;
    }

    const cachedBag = readCachedRequestBag(user.id);
    if (cachedBag) {
      setBag(cachedBag);
      setLoading(false);
    } else {
      setLoading(true);
    }

    setError('');

    try {
      const fastBag = await fetchActiveRequestBagFast(user.id);
      setBag(fastBag);
      writeCachedRequestBag(user.id, fastBag);
      setLoading(false);

      // Upgrade private screenshot thumbnails in the background after the page is usable.
      fetchActiveRequestBag(user.id)
        .then((fullBag) => {
          setBag(fullBag);
          writeCachedRequestBag(user.id, fullBag);
        })
        .catch((backgroundError) => {
          console.warn('[RequestBag] Background image refresh skipped:', backgroundError);
        });
    } catch (err) {
      console.error('Failed to load Request Bag:', err);
      setError(err instanceof Error ? err.message : 'Unable to load your Request Bag.');
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let active = true;

    async function loadDzongkhags() {
      const { data, error } = await supabase.rpc('get_dzongkhag_options');

      if (!active) return;
      if (!error) setDzongkhagOptions(normalizeDzongkhagOptions(data));
    }

    void loadDzongkhags();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!authLoading) {
      void loadBag();
    }
  }, [authLoading, loadBag]);

  useEffect(() => {
    if (!user) return;

    const profileName =
      profile?.full_name?.trim() ||
      profile?.name?.trim() ||
      user.email?.split('@')[0] ||
      '';

    setCustomer((prev) => ({
      name: prev.name || bag?.customerName || profileName,
      phone: prev.phone || bag?.customerPhone || profile?.phone?.trim() || '',
      deliveryAddress: prev.deliveryAddress || bag?.deliveryAddress || '',
      notes: prev.notes || bag?.customerNotes || '',
    }));
  }, [user, profile, bag?.customerName, bag?.customerPhone, bag?.deliveryAddress, bag?.customerNotes]);

  useEffect(() => {
    if (!user) {
      setSavedAddress(null);
      return;
    }

    const activeUserId = user.id;
    let active = true;

    async function loadSavedAddress() {
      setAddressLoading(true);

      try {
        const address = await fetchSavedDefaultAddress(activeUserId, dzongkhagOptions);
        if (!active) return;

        setSavedAddress(address);

        if (address?.formattedAddress) {
          setCustomer((prev) => ({
            name: address.recipientName || prev.name,
            phone: address.phone || prev.phone,
            deliveryAddress: address.formattedAddress,
            notes: prev.notes,
          }));
          return;
        }

        const profileAddress = makeDeliveryAddress(profile, dzongkhagOptions);
        if (profileAddress) {
          setCustomer((prev) => ({
            ...prev,
            deliveryAddress: prev.deliveryAddress || profileAddress,
          }));
        }
      } finally {
        if (active) setAddressLoading(false);
      }
    }

    void loadSavedAddress();

    return () => {
      active = false;
    };
  }, [user, profile, dzongkhagOptions]);

  const patchItem = async (
    itemId: string,
    patch: Partial<Pick<RequestBagItem, 'productName' | 'priceShown' | 'quantity' | 'notes'>>
  ) => {
    if (!user || !bag) return;

    const nextBag = {
      ...bag,
      items: bag.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    };

    setBag(nextBag);
    writeCachedRequestBag(user.id, nextBag);

    setSavingItemId(itemId);
    setError('');

    try {
      await updateRequestBagItem(user.id, itemId, patch);
    } catch (err) {
      console.error('Failed to update Request Bag item:', err);
      setError(err instanceof Error ? err.message : 'Unable to update item.');
      void loadBag();
    } finally {
      setSavingItemId('');
    }
  };

  const removeItem = async (itemId: string) => {
    if (!user || !bag) return;

    setRemovingItemId(itemId);
    setError('');

    try {
      await removeRequestBagItem(user.id, itemId);
      const nextBag = {
        ...bag,
        items: bag.items.filter((item) => item.id !== itemId),
      };
      setBag(nextBag);
      writeCachedRequestBag(user.id, nextBag);
      window.dispatchEvent(new Event('shop2bhutan:request-bag-updated'));
    } catch (err) {
      console.error('Failed to remove Request Bag item:', err);
      setError(err instanceof Error ? err.message : 'Unable to remove item.');
    } finally {
      setRemovingItemId('');
    }
  };

  const validateRequestDetails = () => {
    setError('');

    if (!user || !bag) return false;

    if (bag.items.length === 0) {
      setError('Your Request Bag is empty.');
      return false;
    }

    if (!customer.name.trim()) {
      setError('Please enter your name.');
      setDeliveryExpanded(true);
      return false;
    }

    if (!customer.phone.trim()) {
      setError('Please enter your phone number.');
      setDeliveryExpanded(true);
      return false;
    }

    if (isSelfPickup && !selectedPickupHub?.id) {
      setError('Please select a pickup option.');
      return false;
    }

    if (!isSelfPickup && !customer.deliveryAddress.trim()) {
      setError('Please select or enter your delivery address.');
      setDeliveryExpanded(true);
      return false;
    }

    return true;
  };

  const openSubmitConfirmation = () => {
    if (!validateRequestDetails()) return;
    setConfirmOpen(true);
  };

  const submitBag = async () => {
    if (!validateRequestDetails()) return;
    if (!user || !bag) return;

    setSubmitting(true);
    setConfirmOpen(false);

    try {
      const result = await submitRequestBagAsOrder({
        bagId: bag.id,
        userId: user.id,
        email: user.email,
        customerName: customer.name.trim(),
        customerPhone: customer.phone.trim(),
        deliveryAddress: isSelfPickup ? `Pickup — ${selectedPickupHub.name}` : customer.deliveryAddress.trim(),
        customerNotes: customer.notes.trim() || 'Request Bag quotation request submitted by customer.',
        fulfillmentMode,
        pickupHubId: isSelfPickup ? selectedPickupHub.id : null,
        pickupHubName: isSelfPickup ? selectedPickupHub.name : null,
        pickupInstructions: isSelfPickup ? selectedPickupHub.pickupInstructions : null,
      });

      clearCachedRequestBag(user.id);
      window.dispatchEvent(new Event('shop2bhutan:request-bag-updated'));
      navigate(`/order/${result.orderId}`, { replace: true });
    } catch (err) {
      console.error('Failed to submit Request Bag:', err);
      setError(err instanceof Error ? err.message : 'Unable to submit quotation request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-white px-4 py-8">
        <div className="rounded-2xl bg-white border border-gray-100 p-6 text-center">
          <ShoppingBag size={42} className="mx-auto text-gray-300" />
          <h1 className="mt-3 text-lg font-bold text-gray-900">Sign in to view Request Bag</h1>
          <p className="mt-1 text-sm text-gray-500">
            Save product links and request quotation after signing in.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login', { state: { from: '/request-bag' } })}
            className="mt-4 h-11 rounded-xl bg-orange-500 px-5 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-36">
      <div className="sticky top-0 z-30 border-b border-gray-100 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-gray-900">Request Bag</h1>
            <p className="text-xs text-gray-500">
              Review items and request one quotation when ready.
            </p>
          </div>
          {hasItems && (
            <span className="rounded-full bg-orange-50 border border-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700">
              {bag?.items.length} item{bag?.items.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : !hasItems ? (
          <div className="rounded-2xl bg-white border border-gray-100 p-6 text-center">
            <ShoppingBag size={44} className="mx-auto text-gray-300" />
            <h2 className="mt-3 text-lg font-bold text-gray-900">Your Request Bag is empty</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              Add Amazon, Flipkart, Myntra, or Meesho links first. You can request quotation after adding items.
            </p>
            <button
              type="button"
              onClick={() => navigate('/paste-link')}
              className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 text-sm font-semibold text-white hover:bg-orange-600"
            >
              <Plus size={17} />
              Add Product Link
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {bag?.items.map((item) => (
                <div key={item.id} className={removingItemId === item.id ? 'opacity-50 pointer-events-none' : ''}>
                  <BagItemCard
                    item={item}
                    saving={savingItemId === item.id}
                    onPatch={patchItem}
                    onRemove={removeItem}
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => navigate('/paste-link')}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50/50 text-sm font-bold text-gray-700 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50/30 transition-colors"
            >
              <Plus size={17} />
              Add another product
            </button>

            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-gray-900">Contact & Fulfillment</h3>
                  <p className="text-xs text-gray-500">
                    {addressLoading
                      ? 'Loading your saved delivery address...'
                      : 'Choose delivery or pickup option before requesting quotation.'}
                  </p>
                </div>
                {!isSelfPickup && hasDeliveryAddress && !showDeliveryFields && (
                  <button
                    type="button"
                    onClick={() => setDeliveryExpanded(true)}
                    className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200"
                  >
                    <Edit3 size={13} />
                    Edit
                  </button>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFulfillmentMode('delivery')}
                  className={`rounded-2xl border px-3 py-3 text-left transition ${
                    fulfillmentMode === 'delivery'
                      ? 'border-orange-300 bg-orange-50 text-orange-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="block text-sm font-extrabold">Deliver to me</span>
                  <span className="mt-0.5 block text-[11px] leading-4 opacity-75">Use saved/manual address</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFulfillmentMode('self_pickup')}
                  className={`rounded-2xl border px-3 py-3 text-left transition ${
                    fulfillmentMode === 'self_pickup'
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span className="block text-sm font-extrabold">I will collect</span>
                  <span className="mt-0.5 block text-[11px] leading-4 opacity-75">Choose pickup option</span>
                </button>
              </div>

              {isSelfPickup && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Pickup option</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {SELF_PICKUP_OPTIONS.map((hub) => (
                      <button
                        key={hub.id}
                        type="button"
                        onClick={() => setPickupHubId(hub.id)}
                        className={`rounded-2xl border p-3 text-left transition ${
                          pickupHubId === hub.id
                            ? 'border-blue-300 bg-blue-50 text-blue-800'
                            : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="block text-sm font-bold">{hub.name}</span>
                        <span className="mt-0.5 block text-[11px] text-gray-500">{hub.dzongkhag}</span>
                      </button>
                    ))}
                  </div>
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 px-3 py-3 text-xs leading-5 text-blue-800">
                    {selectedPickupHub.pickupInstructions}
                  </div>
                </div>
              )}

              {addressLoading && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3 text-xs text-gray-500">
                  <Loader2 size={15} className="animate-spin text-orange-500" />
                  Loading saved delivery address...
                </div>
              )}

              {!isSelfPickup && hasDeliveryAddress && !showDeliveryFields && (
                <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600">
                      <CheckCircle size={18} strokeWidth={2.5} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-emerald-900">{customer.name || 'Customer'}</p>
                      {savedAddress?.label && (
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">{savedAddress.label} address</p>
                      )}
                      {customer.phone && <p className="text-xs font-medium text-emerald-600/80">{customer.phone}</p>}
                      <p className="mt-1 text-xs leading-5 font-medium text-emerald-900">{customer.deliveryAddress}</p>
                    </div>
                  </div>
                </div>
              )}

              {isSelfPickup && (
                <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-3">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600">
                      <MapPin size={18} strokeWidth={2.5} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-blue-950">Pickup Option</p>
                      <p className="mt-0.5 text-xs font-semibold text-blue-700">{selectedPickupHub.name}</p>
                      <p className="mt-1 text-xs leading-5 text-blue-800">{selectedPickupHub.pickupInstructions}</p>
                    </div>
                  </div>
                </div>
              )}

              {showDeliveryFields && (
                <div className="mt-3 space-y-3">
                  <div className="relative">
                    <User size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={customer.name}
                      onChange={(e) => setCustomer((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Full name"
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>

                  <div className="relative">
                    <Phone size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="tel"
                      value={customer.phone}
                      onChange={(e) => setCustomer((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="Phone number"
                      className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>

                  {!isSelfPickup && (
                    <div className="relative">
                      <MapPin size={17} className="absolute left-3 top-3 text-gray-400" />
                      <textarea
                        value={customer.deliveryAddress}
                        onChange={(e) => setCustomer((prev) => ({ ...prev, deliveryAddress: e.target.value }))}
                        placeholder="Delivery address"
                        rows={3}
                        className="w-full resize-none rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                      />
                    </div>
                  )}
                </div>
              )}

              <textarea
                value={customer.notes}
                onChange={(e) => setCustomer((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Optional note for all items..."
                rows={2}
                className="mt-3 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
          </>
        )}
      </div>

      {/* ===== REDESIGNED CONFIRMATION DIALOG ===== */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40 px-4 pb-4 pt-10 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-quotation-title"
        >
          <button
            type="button"
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={() => !submitting && setConfirmOpen(false)}
            aria-label="Close confirmation"
          />

          <div className="relative w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-2xl">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1.5 w-12 rounded-full bg-gray-200" />
            </div>

            <div className="max-h-[calc(100vh-2rem)] overflow-y-auto px-5 py-4">
              {/* Hero Header */}
              <div className="flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 mb-3">
                  <Package size={26} className="text-orange-500" strokeWidth={2} />
                </div>
                <h2 id="confirm-quotation-title" className="text-xl font-extrabold text-gray-900">
                  Confirm Quotation Request
                </h2>
                <p className="mx-auto mt-1.5 max-w-[260px] text-sm leading-relaxed text-gray-500">
                  You are sending <span className="font-semibold text-gray-700">{itemCount} item{itemCount === 1 ? '' : 's'}</span> to Shop2Bhutan for admin review.
                </p>
              </div>

              {/* Unified Summary Card */}
              <div className="mt-5 rounded-2xl border border-gray-100 bg-gray-50/80 p-4">
                {/* Top row: Items + Estimate */}
                <div className="flex items-center">
                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-gray-100 shadow-sm">
                      <ShoppingBag size={16} className="text-gray-500" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Items</p>
                      <p className="text-base font-bold text-gray-900">{itemCount} <span className="text-xs font-normal text-gray-500">({totalQuantity} qty)</span></p>
                    </div>
                  </div>
                  <div className="w-px h-10 bg-gray-200 mx-3" />
                  <div className="flex-1">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Site Estimate</p>
                    <p className="text-base font-bold text-gray-900">
                      {estimatedSiteTotal > 0 ? formatPrice(estimatedSiteTotal) : <span className="text-gray-400 font-medium">—</span>}
                    </p>
                  </div>
                </div>

                <div className="my-4 h-px bg-gray-200/80" />

                {/* Delivery Info */}
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100">
                    <CheckCircle size={16} className="text-emerald-600" strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900">{customer.name || 'Customer'}</p>
                    {customer.phone && (
                      <p className="text-xs text-gray-500 mt-0.5">{customer.phone}</p>
                    )}
                    <div className="mt-2 rounded-xl bg-white border border-gray-100 p-3">
                      <p className="text-xs leading-5 text-gray-600">
                        {isSelfPickup
                          ? `Self Pickup — ${selectedPickupHub.name}. ${selectedPickupHub.pickupInstructions}`
                          : customer.deliveryAddress}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Warning */}
              <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-amber-100 bg-amber-50 px-3.5 py-3">
                <span className="mt-0.5 shrink-0 text-amber-500">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </span>
                <p className="text-xs leading-5 text-amber-700">
                  This is not a payment or final order. Admin will send a quotation for your approval first.
                </p>
              </div>

              {/* Buttons */}
              <button
                type="button"
                onClick={submitBag}
                disabled={submitting}
                className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 text-base font-bold text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Sending Request...
                  </>
                ) : (
                  'Confirm & Send Request'
                )}
              </button>

              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={submitting}
                className="mt-3 h-12 w-full rounded-2xl text-sm font-semibold text-gray-500 transition-all hover:bg-gray-50 active:scale-[0.98] disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}{hasItems && (
        <div className="fixed bottom-16 left-0 right-0 z-40 border-t border-gray-200 bg-white px-4 py-3">
          <div className="mx-auto max-w-lg">
            <button
              type="button"
              onClick={openSubmitConfirmation}
              disabled={submitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 text-sm font-bold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Requesting quotation...
                </>
              ) : (
                <>
                  Request Quotation
                  <Package size={18} />
                </>
              )}
            </button>
            <p className="mt-2 text-center text-[11px] text-gray-500">
              You can review before sending. Admin will see your request only after confirmation.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}