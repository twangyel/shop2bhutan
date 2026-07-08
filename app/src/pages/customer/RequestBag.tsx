import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
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
  index,
  saving,
  removing,
  onPatch,
  onRemove,
}: {
  item: RequestBagItem;
  index: number;
  saving: boolean;
  removing: boolean;
  onPatch: (itemId: string, patch: Partial<Pick<RequestBagItem, 'productName' | 'priceShown' | 'quantity' | 'notes'>>) => void;
  onRemove: (itemId: string) => void;
}) {
  const ps = platformStyles(item.sourcePlatform);
  const hasSourceUrl = Boolean(item.sourceUrl);
  const hasScreenshot = Boolean(item.screenshotUrl);
  const itemTypeLabel = hasSourceUrl ? 'Product link' : 'Screenshot request';
  const domain = extractDomain(item.sourceUrl);

  return (
    <article
      className={`overflow-hidden rounded-3xl border bg-white shadow-sm transition-all duration-200 ${
        removing
          ? 'pointer-events-none translate-x-2 scale-[0.98] opacity-0'
          : 'translate-x-0 scale-100 border-gray-200 opacity-100'
      }`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/60 px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-gray-500 ring-1 ring-gray-200">
            Item {index + 1}
          </span>
          <span className="truncate text-[12px] font-semibold text-gray-500">
            {itemTypeLabel}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onRemove(item.id)}
          disabled={removing}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-red-50 hover:text-red-500 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
          aria-label="Remove item"
        >
          {removing ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
        </button>
      </div>

      <div className="p-3.5">
        <div className="flex gap-3">
          {item.productImage ? (
            <img
              src={item.productImage}
              alt=""
              className="h-[82px] w-[82px] flex-shrink-0 rounded-2xl bg-gray-100 object-cover ring-1 ring-gray-100"
            />
          ) : (
            <div className={`flex h-[82px] w-[82px] flex-shrink-0 items-center justify-center rounded-2xl ring-1 ring-gray-100 ${ps.bg}`}>
              {ps.initial ? (
                <span className={`text-lg font-bold ${ps.text}`}>{ps.initial}</span>
              ) : (
                <ImageIcon size={23} className={ps.text} />
              )}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <input
              type="text"
              value={item.productName}
              onChange={(e) => onPatch(item.id, { productName: e.target.value })}
              onBlur={() => onPatch(item.id, { productName: item.productName })}
              className="w-full border-0 bg-transparent p-0 text-[15px] font-extrabold leading-5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
              placeholder="Product name"
            />

            {hasSourceUrl ? (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block truncate text-[12px] font-medium text-gray-500 transition-colors hover:text-orange-600"
              >
                {domain || 'Open product link'}
              </a>
            ) : (
              <p className="mt-1 text-[12px] font-medium text-gray-500">
                Product details from screenshot
              </p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-600">
                {platformLabel(item.sourcePlatform)}
              </span>

              {!hasSourceUrl && (
                <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-bold text-orange-600">
                  Screenshot request
                </span>
              )}

              {hasScreenshot && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-600">
                  Screenshot saved
                </span>
              )}

              {saving && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-1 text-[10px] font-semibold text-gray-400">
                  <Loader2 size={10} className="animate-spin" />
                  Saving
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_104px] items-end gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Price shown on site
            </label>
            <input
              type="number"
              value={item.priceShown || ''}
              onChange={(e) => onPatch(item.id, { priceShown: Number(e.target.value) || 0 })}
              onBlur={() => onPatch(item.id, { priceShown: item.priceShown })}
              placeholder="Price if known"
              className="mt-1.5 h-11 w-full rounded-2xl border border-gray-200 bg-white px-3 text-[14px] font-semibold text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/15"
            />
          </div>

          <div className="flex flex-col items-center">
            <label className="block text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Qty
            </label>
            <div className="mt-1.5 flex h-11 items-center justify-center rounded-2xl border border-gray-200 bg-white px-1 shadow-xs">
              <button
                type="button"
                onClick={() => onPatch(item.id, { quantity: Math.max(1, item.quantity - 1) })}
                className="flex h-9 w-8 items-center justify-center rounded-xl bg-gray-50 text-gray-700 transition active:scale-95 active:bg-gray-100"
                aria-label="Decrease quantity"
              >
                <Minus size={14} />
              </button>
              <span className="w-8 text-center text-[15px] font-extrabold text-gray-900">
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={() => onPatch(item.id, { quantity: item.quantity + 1 })}
                className="flex h-9 w-8 items-center justify-center rounded-xl bg-gray-50 text-gray-700 transition active:scale-95 active:bg-gray-100"
                aria-label="Increase quantity"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>

        {item.priceShown > 0 && (
          <p className="mt-2 text-[12px] font-bold text-orange-600">
            Site price estimate: {formatPrice(item.priceShown * item.quantity)}
          </p>
        )}

        <textarea
          value={item.notes || ''}
          onChange={(e) => onPatch(item.id, { notes: e.target.value })}
          onBlur={() => onPatch(item.id, { notes: item.notes || '' })}
          placeholder="Size, color, variant, or instruction for this item..."
          rows={2}
          className="mt-3 w-full resize-none rounded-2xl border border-gray-200 bg-white px-3 py-2.5 text-[14px] leading-5 outline-none transition placeholder:text-gray-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/15"
        />
      </div>
    </article>
  );
}


export default function RequestBag() {
  const navigate = useNavigate();
  const { user, context, loading: authLoading, isGuest } = useAuth();
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
    if (!user || isGuest) {
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
  }, [user, isGuest]);

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
    if (!user || isGuest) return;

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
  }, [user, isGuest, profile, bag?.customerName, bag?.customerPhone, bag?.deliveryAddress, bag?.customerNotes]);

  useEffect(() => {
    if (!user || isGuest) {
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
  }, [user, isGuest, profile, dzongkhagOptions]);

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
    if (!user || !bag || removingItemId) return;

    const previousBag = bag;
    setRemovingItemId(itemId);
    setError('');

    await new Promise((resolve) => window.setTimeout(resolve, 180));

    const nextBag = {
      ...previousBag,
      items: previousBag.items.filter((item) => item.id !== itemId),
    };

    setBag(nextBag);
    writeCachedRequestBag(user.id, nextBag);
    window.dispatchEvent(new Event('shop2bhutan:request-bag-updated'));

    try {
      await removeRequestBagItem(user.id, itemId);
    } catch (err) {
      console.error('Failed to remove Request Bag item:', err);
      setError(err instanceof Error ? err.message : 'Unable to remove item.');
      setBag(previousBag);
      writeCachedRequestBag(user.id, previousBag);
      window.dispatchEvent(new Event('shop2bhutan:request-bag-updated'));
    } finally {
      setRemovingItemId('');
    }
  };

  const validateRequestDetails = () => {
    setError('');

    if (!user || !bag) return false;

    if (isGuest) {
      setError('Please sign in or register to request shopping quotations. Guest mode is only for Parcel booking.');
      return false;
    }

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

  if (!authLoading && (!user || isGuest)) {
    return (
      <div className="min-h-screen bg-white px-4 py-8">
        <div className="rounded-2xl bg-white border border-gray-100 p-6 text-center">
          <ShoppingBag size={42} className="mx-auto text-gray-300" />
          <h1 className="mt-3 text-lg font-bold text-gray-900">Sign in to use Request Bag</h1>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            Guest mode is only for Parcel booking. Please sign in or create an account to request shopping quotations.
          </p>
          <button
            type="button"
            onClick={() => navigate('/login', { state: { from: '/request-bag' } })}
            className="mt-4 h-11 rounded-xl bg-orange-500 px-5 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => navigate('/register', { state: { returnTo: '/request-bag' } })}
            className="mt-2 h-11 rounded-xl px-5 text-sm font-semibold text-orange-600 hover:bg-orange-50"
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => navigate('/parcel')}
            className="mt-1 h-10 rounded-xl px-5 text-xs font-semibold text-gray-500 hover:bg-gray-50"
          >
            Continue to Parcel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-36">
      <div className="sticky top-0 z-30 border-b border-gray-100 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-gray-900">Request Bag</h1>
            <p className="text-[12px] leading-5 text-gray-500">
              Review your items before requesting one quotation.
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
              {bag?.items.map((item, index) => (
                <BagItemCard
                  key={item.id}
                  item={item}
                  index={index}
                  saving={savingItemId === item.id}
                  removing={removingItemId === item.id}
                  onPatch={patchItem}
                  onRemove={removeItem}
                />
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

      {/* ===== CONFIRMATION DIALOG ===== */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/30 px-4 py-6"
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

          <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl shadow-black/10">
            <div className="max-h-[calc(100vh-3rem)] overflow-y-auto px-6 py-7">
              {/* Header */}
              <div className="text-center">
                <h2 id="confirm-quotation-title" className="text-xl font-extrabold tracking-tight text-gray-900">
                  Confirm Quotation Request
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
                  You are sending <span className="font-semibold text-gray-800">{itemCount} item{itemCount === 1 ? '' : 's'}</span> to Shop2Bhutan for admin review.
                </p>
              </div>

              {/* Summary */}
              <div className="mt-6 space-y-4">
                {/* Items row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50">
                      <ShoppingBag size={18} className="text-orange-500" strokeWidth={1.8} />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Items</p>
                      <p className="text-[15px] font-bold text-gray-900">{itemCount} <span className="text-xs font-normal text-gray-500">({totalQuantity} qty)</span></p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Site Estimate</p>
                    <p className="text-[15px] font-bold text-gray-900">
                      {estimatedSiteTotal > 0 ? formatPrice(estimatedSiteTotal) : <span className="text-sm font-medium text-gray-400">To be quoted</span>}
                    </p>
                  </div>
                </div>

                <div className="h-px bg-gray-100" />

                {/* Delivery Info */}
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                    <CheckCircle size={18} className="text-emerald-600" strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900">{customer.name || 'Customer'}</p>
                    {customer.phone && (
                      <p className="mt-0.5 text-xs text-gray-500">{customer.phone}</p>
                    )}
                    <p className="mt-2 text-xs leading-5 text-gray-600">
                      {isSelfPickup
                        ? `Self Pickup — ${selectedPickupHub.name}. ${selectedPickupHub.pickupInstructions}`
                        : customer.deliveryAddress}
                    </p>
                  </div>
                </div>
              </div>

              {/* Warning */}
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3.5">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <p className="text-xs leading-5 font-medium text-amber-700">
                  This is not a payment or final order. Admin will send a quotation for your approval first.
                </p>
              </div>

              {/* Buttons */}
              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={submitBag}
                  disabled={submitting}
                  className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 text-[15px] font-bold text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={18} strokeWidth={2.5} className="animate-spin" />
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
                  className="h-11 w-full rounded-2xl text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-50 active:scale-[0.98] disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
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