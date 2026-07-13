import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  ChevronDown,
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
  hapticError,
  hapticLight,
  hapticSuccess,
  hapticWarning,
} from '@/lib/haptics';
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

type RequestReviewStep = 1 | 2 | 3;

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

function platformStyles(platform?: string) {
  const p = String(platform ?? '').toLowerCase();
  if (p === 'amazon') return { bg: 'bg-orange-100', text: 'text-orange-600', initial: 'A' };
  if (p === 'flipkart') return { bg: 'bg-blue-100', text: 'text-blue-600', initial: 'F' };
  if (p === 'myntra') return { bg: 'bg-pink-100', text: 'text-pink-600', initial: 'M' };
  if (p === 'meesho') return { bg: 'bg-purple-100', text: 'text-purple-600', initial: 'M' };
  return { bg: 'bg-gray-100', text: 'text-gray-400', initial: null };
}

function platformLogo(platform?: string) {
  const p = String(platform ?? '').toLowerCase();

  if (p === 'amazon') return '/store-logos/amazon.png';
  if (p === 'flipkart') return '/store-logos/flipkart.png';
  if (p === 'myntra') return '/store-logos/myntra.png';
  if (p === 'meesho') return '/store-logos/meesho.png';

  return '';
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

const DELIVERY_DESTINATION_OPTIONS = ['Thimphu', 'Paro', 'Chhukha'] as const;

type DeliveryDestinationOption = (typeof DELIVERY_DESTINATION_OPTIONS)[number];

function normalizeSupportedDeliveryDestination(value: unknown, options: DzongkhagOption[] = []) {
  const raw = cleanString(value);
  if (!raw) return '';

  const resolved = UUID_RE.test(raw)
    ? (Array.isArray(options) ? options.find((item) => item.id === raw)?.name : '') || raw
    : raw;

  const text = resolved.toLowerCase();

  if (text.includes('thimphu')) return 'Thimphu' satisfies DeliveryDestinationOption;
  if (text.includes('paro')) return 'Paro' satisfies DeliveryDestinationOption;
  if (text.includes('chhukha') || text.includes('phuentsholing') || text.includes('phuntsholing')) {
    return 'Chhukha' satisfies DeliveryDestinationOption;
  }

  return '';
}

function getProfileDestinationDzongkhag(profile: ProfileLike | null, options: DzongkhagOption[]) {
  if (!profile) return '';

  const row = profile as AnyRow;
  const candidates = [
    firstString(row, ['dzongkhag', 'dzongkhag_name', 'dzongkhag_id', 'default_dzongkhag_id', 'delivery_dzongkhag', 'delivery_city']),
    makeDeliveryAddress(profile, options),
  ];

  for (const candidate of candidates) {
    const destination = normalizeSupportedDeliveryDestination(candidate, options);
    if (destination) return destination;
  }

  return '';
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
  onPatch: (
    itemId: string,
    patch: Partial<
      Pick<RequestBagItem, 'productName' | 'priceShown' | 'quantity' | 'notes'>
    >,
  ) => void;
  onRemove: (itemId: string) => void;
}) {
  const ps = platformStyles(item.sourcePlatform);
  const storeLogo = platformLogo(item.sourcePlatform);
  const hasSourceUrl = Boolean(item.sourceUrl);
  const hasScreenshot = Boolean(item.screenshotUrl);
  const previewImage = item.productImage || item.screenshotUrl || '';
  const previewIsScreenshot = Boolean(!item.productImage && item.screenshotUrl);
  const safeQuantity = Math.max(1, Number(item.quantity) || 1);
  const sitePriceEstimate = Math.max(0, Number(item.priceShown || 0));
  const hasSitePriceEstimate = sitePriceEstimate > 0;
  const sitePriceEstimateLabel = hasSitePriceEstimate
    ? formatPrice(sitePriceEstimate)
    : 'To be verified';

  return (
    <article
      className={`rounded-[22px] border bg-white p-3 transition-all duration-200 ${
        removing
          ? 'pointer-events-none translate-x-2 scale-[0.98] border-slate-100 opacity-0'
          : 'translate-x-0 scale-100 border-slate-200 opacity-100'
      }`}
    >
      <div className="flex gap-3">
        <div className="shrink-0">
          {previewImage ? (
            <img
              src={previewImage}
              alt={item.productName || 'Product preview'}
              className={`h-[82px] w-[82px] rounded-2xl border border-slate-100 bg-white ${
                previewIsScreenshot ? 'object-contain' : 'object-cover'
              }`}
            />
          ) : storeLogo ? (
            <div className="flex h-[82px] w-[82px] items-center justify-center rounded-2xl border border-slate-100 bg-white p-4">
              <img
                src={storeLogo}
                alt={`${platformLabel(item.sourcePlatform)} logo`}
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div
              className={`flex h-[82px] w-[82px] items-center justify-center rounded-2xl border border-slate-100 bg-white ${ps.text}`}
            >
              {ps.initial ? (
                <span className="text-xl font-black">{ps.initial}</span>
              ) : (
                <ImageIcon size={25} />
              )}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p
              className="min-w-0 flex-1 break-words pr-1 text-[15px] font-extrabold leading-5 text-slate-950 [overflow-wrap:anywhere]"
              title={item.productName || `Product ${index + 1}`}
            >
              {item.productName?.trim() || `Product ${index + 1}`}
            </p>

            <button
              type="button"
              onClick={() => onRemove(item.id)}
              disabled={removing}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 transition active:bg-red-50 active:text-red-500 disabled:pointer-events-none disabled:opacity-50"
              aria-label="Remove item"
            >
              {removing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Trash2 size={17} />
              )}
            </button>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {hasSourceUrl ? (
              <a
                href={item.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 max-w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-600 transition active:border-orange-200 active:text-orange-600"
              >
                {storeLogo ? (
                  <img
                    src={storeLogo}
                    alt=""
                    className="h-4 w-4 shrink-0 object-contain"
                  />
                ) : (
                  <span
                    className={`flex h-4 w-4 items-center justify-center text-[9px] font-black ${ps.text}`}
                  >
                    {ps.initial}
                  </span>
                )}
                <span className="truncate">
                  {platformLabel(item.sourcePlatform)}
                </span>
              </a>
            ) : (
              <span className="inline-flex h-8 items-center rounded-xl border border-slate-200 bg-white px-2.5 text-[11px] font-bold text-slate-600">
                Screenshot request
              </span>
            )}

            {hasScreenshot && (
              <span className="inline-flex h-8 items-center rounded-xl border border-emerald-100 bg-white px-2.5 text-[10px] font-bold text-emerald-600">
                Screenshot saved
              </span>
            )}

            {saving && (
              <span className="inline-flex h-8 items-center gap-1 rounded-xl border border-slate-100 bg-white px-2.5 text-[10px] font-semibold text-slate-400">
                <Loader2 size={11} className="animate-spin" />
                Saving
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-2 items-end gap-2.5">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-400">
            Price
          </p>
          <div className="mt-1.5 flex h-10 items-center justify-between rounded-xl border border-slate-200 bg-white px-3">
            <span
              className={`truncate text-sm font-extrabold ${
                hasSitePriceEstimate ? 'text-slate-900' : 'text-orange-500'
              }`}
            >
              {sitePriceEstimateLabel}
            </span>
            {!hasSitePriceEstimate && (
              <CheckCircle
                size={15}
                className="shrink-0 text-slate-300"
                strokeWidth={2.2}
              />
            )}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-400">
            Quantity
          </p>
          <div className="mt-1.5 flex h-10 items-center justify-between rounded-xl border border-slate-200 bg-white px-1">
            <button
              type="button"
              onClick={() =>
                onPatch(item.id, {
                  quantity: Math.max(1, safeQuantity - 1),
                })
              }
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition active:bg-slate-100"
              aria-label="Decrease quantity"
            >
              <Minus size={15} />
            </button>

            <span className="min-w-7 text-center text-sm font-extrabold text-slate-950">
              {safeQuantity}
            </span>

            <button
              type="button"
              onClick={() =>
                onPatch(item.id, { quantity: safeQuantity + 1 })
              }
              className="flex h-8 w-8 items-center justify-center rounded-lg text-orange-500 transition active:bg-orange-50"
              aria-label="Increase quantity"
            >
              <Plus size={15} />
            </button>
          </div>
        </div>
      </div>

      <div className="relative mt-3">
        <Edit3
          size={15}
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type="text"
          value={item.notes || ''}
          onChange={(event) =>
            onPatch(item.id, { notes: event.target.value })
          }
          onBlur={() =>
            onPatch(item.id, { notes: item.notes || '' })
          }
          placeholder="Size, colour, variant or instruction"
          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 pr-10 text-[12px] font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/10"
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-1.5 text-[10px] leading-4 text-slate-400">
          <CheckCircle
            size={13}
            className="shrink-0 text-blue-500"
            strokeWidth={2.3}
          />
          Price will be verified before confirmation
        </p>

        {hasSitePriceEstimate && (
          <p className="shrink-0 text-[11px] font-extrabold text-orange-600">
            Estimated total{' '}
            {formatPrice(sitePriceEstimate * safeQuantity)}
          </p>
        )}
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
  const [reviewStep, setReviewStep] = useState<RequestReviewStep>(1);
  const [destinationPickerOpen, setDestinationPickerOpen] = useState(false);
  const [error, setError] = useState('');
  const [addressLoading, setAddressLoading] = useState(false);
  const [savedAddress, setSavedAddress] = useState<CustomerAddress | null>(null);
  const [useSavedAddress, setUseSavedAddress] = useState(true);
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
  const selectedDeliveryZone = normalizeSupportedDeliveryDestination(
    customer.deliveryAddress,
    dzongkhagOptions,
  );
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

    const bagAddress = cleanString(bag?.deliveryAddress);
    const profileAddress = makeDeliveryAddress(profile, dzongkhagOptions);
    const profileDestination = getProfileDestinationDzongkhag(
      profile,
      dzongkhagOptions,
    );

    setCustomer((prev) => ({
      name: prev.name || bag?.customerName || profileName,
      phone: prev.phone || bag?.customerPhone || profile?.phone?.trim() || '',
      deliveryAddress:
        cleanString(prev.deliveryAddress) ||
        bagAddress ||
        profileAddress ||
        profileDestination,
      notes: prev.notes || bag?.customerNotes || '',
    }));
  }, [user, isGuest, profile, bag?.customerName, bag?.customerPhone, bag?.deliveryAddress, bag?.customerNotes, dzongkhagOptions]);

  useEffect(() => {
    if (!user || isGuest) {
      setSavedAddress(null);
      setUseSavedAddress(false);
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
        setUseSavedAddress(Boolean(address?.formattedAddress));

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
        const profileDestination = getProfileDestinationDzongkhag(
          profile,
          dzongkhagOptions,
        );

        setCustomer((prev) => ({
          ...prev,
          deliveryAddress:
            cleanString(prev.deliveryAddress) ||
            profileAddress ||
            profileDestination,
        }));
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
      void hapticError();
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
      void hapticError();
      console.error('Failed to remove Request Bag item:', err);
      setError(err instanceof Error ? err.message : 'Unable to remove item.');
      setBag(previousBag);
      writeCachedRequestBag(user.id, previousBag);
      window.dispatchEvent(new Event('shop2bhutan:request-bag-updated'));
    } finally {
      setRemovingItemId('');
    }
  };

  const validateRequestBagItems = () => {
    setError('');

    if (!user || !bag) {
      void hapticWarning();
      return false;
    }

    if (isGuest) {
      void hapticWarning();
      setError('Please sign in or register to submit shopping requests. Guest mode is only for Parcel booking.');
      return false;
    }

    if (bag.items.length === 0) {
      void hapticWarning();
      setError('Your Request Bag is empty.');
      return false;
    }

    return true;
  };

  const scrollReviewToTop = () => {
    window.setTimeout(() => {
      document
        .getElementById('request-review-scroll')
        ?.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }, 0);
  };

  const goToReviewStep = (nextStep: RequestReviewStep) => {
    void hapticLight();
    setError('');
    setDestinationPickerOpen(false);
    setReviewStep(nextStep);
    scrollReviewToTop();
  };

  const validateContactStep = () => {
    setError('');

    if (!customer.name.trim()) {
      void hapticWarning();
      setError('Please enter your name.');
      return false;
    }

    if (!customer.phone.trim()) {
      void hapticWarning();
      setError('Please enter your phone number.');
      return false;
    }

    return true;
  };

  const validateRequestDetails = () => {
    if (!validateRequestBagItems()) return false;

    if (!customer.name.trim()) {
      void hapticWarning();
      setReviewStep(2);
      setError('Please enter your name.');
      scrollReviewToTop();
      return false;
    }

    if (!customer.phone.trim()) {
      void hapticWarning();
      setReviewStep(2);
      setError('Please enter your phone number.');
      scrollReviewToTop();
      return false;
    }

    if (isSelfPickup && !selectedPickupHub?.id) {
      void hapticWarning();
      setReviewStep(3);
      setError('Please select a pickup option.');
      scrollReviewToTop();
      return false;
    }

    if (
      !isSelfPickup &&
      !normalizeSupportedDeliveryDestination(
        customer.deliveryAddress,
        dzongkhagOptions,
      )
    ) {
      void hapticWarning();
      setReviewStep(3);
      setError('Please select Thimphu, Paro, or Chhukha as your destination.');
      scrollReviewToTop();
      return false;
    }

    return true;
  };

  const openSubmitConfirmation = () => {
    if (!validateRequestBagItems()) return;

    void hapticLight();
    setError('');
    setReviewStep(1);
    setDestinationPickerOpen(false);
    setConfirmOpen(true);
  };

  const closeSubmitConfirmation = () => {
    if (submitting) return;

    setConfirmOpen(false);
    setReviewStep(1);
    setDestinationPickerOpen(false);
    setError('');
  };

  const continueReview = () => {
    if (reviewStep === 1) {
      goToReviewStep(2);
      return;
    }

    if (reviewStep === 2) {
      if (!validateContactStep()) return;
      goToReviewStep(3);
    }
  };

  const selectSavedDefaultAddress = () => {
    if (!savedAddress?.formattedAddress) return;

    setUseSavedAddress(true);
    setDestinationPickerOpen(false);
    setCustomer((previous) => ({
      ...previous,
      name: savedAddress.recipientName || previous.name,
      phone: savedAddress.phone || previous.phone,
      deliveryAddress: savedAddress.formattedAddress,
    }));
    setError('');
  };

  const useAnotherDeliveryArea = () => {
    const savedZone = normalizeSupportedDeliveryDestination(
      savedAddress?.formattedAddress,
      dzongkhagOptions,
    );

    setUseSavedAddress(false);
    setCustomer((previous) => ({
      ...previous,
      deliveryAddress:
        normalizeSupportedDeliveryDestination(
          previous.deliveryAddress,
          dzongkhagOptions,
        ) ||
        savedZone ||
        '',
    }));
    setDestinationPickerOpen(true);
    setError('');
  };

  const openAddressManager = () => {
    if (submitting) return;

    setConfirmOpen(false);
    setReviewStep(1);
    setDestinationPickerOpen(false);
    navigate('/addresses', {
      state: { returnTo: '/request-bag' },
    });
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
        customerNotes: customer.notes.trim() || 'Shopping request submitted by customer.',
        fulfillmentMode,
        pickupHubId: isSelfPickup ? selectedPickupHub.id : null,
        pickupHubName: isSelfPickup ? selectedPickupHub.name : null,
        pickupInstructions: isSelfPickup ? selectedPickupHub.pickupInstructions : null,
      });

      clearCachedRequestBag(user.id);
      window.dispatchEvent(new Event('shop2bhutan:request-bag-updated'));
      void hapticSuccess();
      navigate(`/order/${result.orderId}`, { replace: true });
    } catch (err) {
      void hapticError();
      console.error('Failed to submit Request Bag:', err);
      setError(err instanceof Error ? err.message : 'Unable to submit shopping request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!authLoading && (!user || isGuest)) {
    return (
      <div className="min-h-screen bg-neutral-50 px-5 py-8">
        <div className="mx-auto max-w-lg rounded-2xl border border-slate-100 bg-white p-7 text-center shadow-sm shadow-slate-100">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-500 ring-1 ring-orange-100">
            <ShoppingBag size={30} strokeWidth={2.1} />
          </span>
          <h1 className="mt-5 text-xl font-extrabold text-slate-950">
            Sign in to use Request Bag
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
            Shopping requests require an account so we can save your products,
            send updates, and track your order.
          </p>

          <button
            type="button"
            onClick={() =>
              navigate('/login', { state: { from: '/request-bag' } })
            }
            className="mt-6 flex h-[52px] w-full items-center justify-center rounded-2xl bg-orange-500 text-[15px] font-bold text-white shadow-lg shadow-orange-500/20 transition active:scale-[0.98] active:bg-orange-600"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() =>
              navigate('/register', {
                state: { returnTo: '/request-bag' },
              })
            }
            className="mt-2.5 flex h-12 w-full items-center justify-center rounded-2xl bg-orange-50 text-sm font-bold text-orange-700 transition active:scale-[0.98]"
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => navigate('/parcel')}
            className="mt-2 h-11 w-full rounded-2xl text-sm font-semibold text-slate-500 transition active:bg-slate-50"
          >
            Continue to Parcel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.8rem)]">
          <div className="min-w-0 flex-1">
            <h1 className="text-[23px] font-extrabold tracking-tight text-slate-950">
              Request Bag
            </h1>
            <p className="mt-0.5 text-[12px] leading-5 text-slate-500">
              Review products before submitting your request.
            </p>
          </div>

          {hasItems && (
            <span className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700">
              <ShoppingBag size={14} className="text-orange-500" />
              {bag?.items.length} item{bag?.items.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-lg space-y-3 px-4 py-4">
        {error && !confirmOpen && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-5 text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((item) => (
              <div
                key={item}
                className="h-56 animate-pulse rounded-[22px] border border-slate-100 bg-slate-50"
              />
            ))}
          </div>
        ) : !hasItems ? (
          <div className="rounded-2xl border border-slate-100 bg-white p-7 text-center shadow-sm shadow-slate-100">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-500 ring-1 ring-orange-100">
              <ShoppingBag size={30} strokeWidth={2.1} />
            </span>
            <h2 className="mt-5 text-xl font-extrabold text-slate-950">
              Your Request Bag is empty
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
              Add a product link or screenshot first. You can include multiple
              items in one shopping request.
            </p>
            <button
              type="button"
              onClick={() => navigate('/paste-link')}
              className="mt-6 inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 text-[15px] font-bold text-white shadow-lg shadow-orange-500/20 transition active:scale-[0.98]"
            >
              <Plus size={18} />
              Add Product
            </button>
          </div>
        ) : (
          <>
            <section className="space-y-3">
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
            </section>

            <button
              type="button"
              onClick={() => navigate('/shop')}
              className="flex h-[50px] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white text-sm font-extrabold text-slate-700 transition active:scale-[0.99] active:border-orange-300 active:text-orange-600"
            >
              <Plus size={19} />
              Add another product
            </button>

            {itemCount > 1 && (
              <section className="flex items-start gap-3 border-t border-slate-100 bg-white pt-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-white text-blue-600">
                  <CheckCircle size={16} strokeWidth={2.3} />
                </span>
                <div>
                  <p className="text-xs font-extrabold text-slate-800">
                    Multiple products, one request
                  </p>
                  <p className="mt-0.5 text-[10px] leading-[17px] text-slate-500">
                    Contact and delivery details are confirmed next. We’ll check availability and final price before payment.
                  </p>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/45 pt-[calc(env(safe-area-inset-top)+0.5rem)] backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-request-title"
        >
          <button
            type="button"
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={closeSubmitConfirmation}
            aria-label="Close request review"
          />

          <section className="relative flex max-h-[calc(100dvh-env(safe-area-inset-top)-0.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-[32px] bg-white shadow-2xl">
            <div className="flex shrink-0 justify-center pt-3">
              <span className="h-1.5 w-12 rounded-full bg-slate-200" />
            </div>

            <div className="shrink-0 border-b border-slate-100 px-5 pb-4 pt-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-orange-500">
                    Step {reviewStep} of 3
                  </p>
                  <h2
                    id="submit-request-title"
                    className="mt-1 text-xl font-extrabold tracking-tight text-slate-950"
                  >
                    {reviewStep === 1
                      ? 'Review products'
                      : reviewStep === 2
                        ? 'Contact & address'
                        : 'Delivery preference'}
                  </h2>
                  <p className="mt-1 text-sm leading-5 text-slate-500">
                    {reviewStep === 1
                      ? 'Confirm the products and add any final request notes.'
                      : reviewStep === 2
                        ? 'Confirm how Shop2Bhutan should contact you and your delivery area.'
                        : 'Choose delivery or pickup before submitting your request.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeSubmitConfirmation}
                  disabled={submitting}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition active:scale-95"
                  aria-label="Close"
                >
                  <ChevronDown size={20} strokeWidth={2.4} />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { step: 1 as const, label: 'Products' },
                  { step: 2 as const, label: 'Contact' },
                  { step: 3 as const, label: 'Delivery' },
                ].map((item) => {
                  const active = reviewStep === item.step;
                  const completed = reviewStep > item.step;

                  return (
                    <button
                      key={item.step}
                      type="button"
                      onClick={() => {
                        if (item.step < reviewStep) {
                          goToReviewStep(item.step);
                        }
                      }}
                      disabled={item.step > reviewStep || submitting}
                      className={`rounded-2xl border px-2 py-2.5 text-center transition ${
                        active
                          ? 'border-orange-200 bg-orange-50 text-orange-700'
                          : completed
                            ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                            : 'border-slate-100 bg-white text-slate-400'
                      }`}
                    >
                      <span
                        className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black ${
                          active
                            ? 'bg-orange-500 text-white'
                            : completed
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {completed ? (
                          <CheckCircle size={15} strokeWidth={2.7} />
                        ) : (
                          item.step
                        )}
                      </span>
                      <span className="mt-1.5 block text-[10px] font-extrabold">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              id="request-review-scroll"
              className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4"
            >
              {error && (
                <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs font-medium leading-5 text-red-700">
                  {error}
                </div>
              )}

              {reviewStep === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3.5">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Products
                      </p>
                      <p className="mt-1 text-base font-extrabold text-slate-950">
                        {itemCount} item{itemCount === 1 ? '' : 's'}
                        <span className="ml-1 text-sm font-semibold text-slate-500">
                          ({totalQuantity} qty)
                        </span>
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 px-4 py-3.5 text-right">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                        Site estimate
                      </p>
                      <p className="mt-1 text-base font-extrabold text-slate-950">
                        {estimatedSiteTotal > 0 ? (
                          formatPrice(estimatedSiteTotal)
                        ) : (
                          <span className="text-sm font-semibold text-slate-400">
                            Final price pending
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <div>
                        <p className="text-sm font-extrabold text-slate-950">
                          Product preview
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Product names are locked. Edit quantity or options from
                          the Request Bag.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={closeSubmitConfirmation}
                        className="shrink-0 rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 transition active:scale-[0.97]"
                      >
                        Edit Bag
                      </button>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {bag?.items.map((item) => {
                        const previewImage =
                          item.productImage || item.screenshotUrl || '';
                        const quantity = Math.max(
                          1,
                          Number(item.quantity) || 1,
                        );
                        const itemEstimate =
                          Math.max(0, Number(item.priceShown || 0)) * quantity;

                        return (
                          <div
                            key={item.id}
                            className="flex items-start gap-3 px-4 py-3"
                          >
                            {previewImage ? (
                              <img
                                src={previewImage}
                                alt=""
                                className="h-14 w-14 shrink-0 rounded-xl border border-slate-100 bg-white object-cover"
                              />
                            ) : (
                              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
                                <ImageIcon size={20} />
                              </span>
                            )}

                            <div className="min-w-0 flex-1">
                              <p className="break-words text-sm font-extrabold leading-5 text-slate-950 [overflow-wrap:anywhere]">
                                {item.productName || 'Product'}
                              </p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-500">
                                <span>Qty {quantity}</span>
                                <span>{platformLabel(item.sourcePlatform)}</span>
                                <span>
                                  {itemEstimate > 0
                                    ? formatPrice(itemEstimate)
                                    : 'Price to be verified'}
                                </span>
                              </div>

                              {item.notes && (
                                <p className="mt-1.5 rounded-lg bg-orange-50 px-2.5 py-1.5 text-[11px] font-semibold leading-4 text-orange-700">
                                  {item.notes}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-100 bg-white p-4">
                    <p className="text-sm font-extrabold text-slate-950">
                      Request notes
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Add a general instruction that applies to this shopping
                      request.
                    </p>
                    <textarea
                      value={customer.notes}
                      onChange={(event) =>
                        setCustomer((previous) => ({
                          ...previous,
                          notes: event.target.value,
                        }))
                      }
                      placeholder="Optional note for Shop2Bhutan..."
                      rows={3}
                      className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-5 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/15"
                    />
                  </section>
                </div>
              )}

              {reviewStep === 2 && (
                <div className="space-y-4">
                  <section className="rounded-2xl border border-slate-100 bg-white p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-500">
                        <User size={18} strokeWidth={2.2} />
                      </span>
                      <div>
                        <p className="text-sm font-extrabold text-slate-950">
                          Contact details
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Used for request, final price, payment, and delivery
                          updates.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <div className="relative">
                        <User
                          size={17}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          type="text"
                          value={customer.name}
                          onChange={(event) => {
                            setCustomer((previous) => ({
                              ...previous,
                              name: event.target.value,
                            }));
                            setError('');
                          }}
                          placeholder="Full name"
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/15"
                        />
                      </div>

                      <div className="relative">
                        <Phone
                          size={17}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                        />
                        <input
                          type="tel"
                          value={customer.phone}
                          onChange={(event) => {
                            setCustomer((previous) => ({
                              ...previous,
                              phone: event.target.value,
                            }));
                            setError('');
                          }}
                          placeholder="Phone number"
                          className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-3 text-sm font-medium text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/15"
                        />
                      </div>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-100 bg-white p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-orange-500">
                        <MapPin size={18} strokeWidth={2.2} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-extrabold text-slate-950">
                          Delivery address
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Your default saved address is selected automatically.
                          The delivery zone is detected from the full address.
                        </p>
                      </div>
                    </div>

                    {addressLoading ? (
                      <div className="mt-4 flex items-center gap-2 rounded-2xl bg-slate-50 px-3.5 py-3 text-xs text-slate-500">
                        <Loader2
                          size={15}
                          className="animate-spin text-orange-500"
                        />
                        Loading your default address...
                      </div>
                    ) : savedAddress?.formattedAddress ? (
                      <div className="mt-4 space-y-3">
                        <button
                          type="button"
                          onClick={selectSavedDefaultAddress}
                          className={`w-full rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
                            useSavedAddress
                              ? 'border-orange-200 bg-orange-50 ring-1 ring-orange-100'
                              : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={`text-sm font-extrabold ${
                                    useSavedAddress
                                      ? 'text-orange-800'
                                      : 'text-slate-950'
                                  }`}
                                >
                                  {savedAddress.label || 'Home'}
                                </span>
                                {savedAddress.isDefault && (
                                  <span className="rounded-full bg-white px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-orange-600 ring-1 ring-orange-100">
                                    Default
                                  </span>
                                )}
                              </div>

                              <p className="mt-2 text-sm font-bold text-slate-900">
                                {savedAddress.recipientName || customer.name}
                                {(savedAddress.phone || customer.phone) &&
                                  ` · ${savedAddress.phone || customer.phone}`}
                              </p>
                              <p className="mt-1.5 break-words text-sm leading-5 text-slate-600 [overflow-wrap:anywhere]">
                                {savedAddress.formattedAddress}
                              </p>

                              <div className="mt-3 flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                  Delivery zone
                                </span>
                                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-slate-700 ring-1 ring-slate-200">
                                  {normalizeSupportedDeliveryDestination(
                                    savedAddress.formattedAddress,
                                    dzongkhagOptions,
                                  ) || 'To be confirmed'}
                                </span>
                              </div>
                            </div>

                            <span
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                                useSavedAddress
                                  ? 'bg-orange-500 text-white'
                                  : 'bg-slate-100 text-slate-400'
                              }`}
                            >
                              <CheckCircle size={17} strokeWidth={2.5} />
                            </span>
                          </div>
                        </button>

                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={openAddressManager}
                            className="flex h-11 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition active:scale-[0.98] active:bg-slate-50"
                          >
                            Manage addresses
                          </button>

                          <button
                            type="button"
                            onClick={useAnotherDeliveryArea}
                            className="flex h-11 items-center justify-center rounded-2xl bg-slate-100 px-3 text-xs font-bold text-slate-600 transition active:scale-[0.98]"
                          >
                            Use another area
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3.5">
                        <p className="text-sm font-extrabold text-amber-800">
                          No saved delivery address found
                        </p>
                        <p className="mt-1 text-xs leading-5 text-amber-700">
                          Add a complete address for easier future requests, or
                          choose a supported delivery area below.
                        </p>
                        <button
                          type="button"
                          onClick={openAddressManager}
                          className="mt-3 h-10 rounded-xl bg-white px-4 text-xs font-extrabold text-amber-700 ring-1 ring-amber-200"
                        >
                          Add saved address
                        </button>
                      </div>
                    )}

                    {(!savedAddress?.formattedAddress || !useSavedAddress) && (
                      <div className="mt-4">
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          Delivery-area fallback
                        </p>
                        <div className="rounded-2xl border border-slate-200 bg-white p-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setDestinationPickerOpen((previous) => !previous)
                            }
                            className="flex min-h-[50px] w-full items-center justify-between gap-3 rounded-xl px-3 text-left transition active:scale-[0.99]"
                            aria-expanded={destinationPickerOpen}
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-orange-500">
                                <MapPin size={17} strokeWidth={2.2} />
                              </span>
                              <span className="min-w-0">
                                <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                  Supported delivery area
                                </span>
                                <span className="block truncate text-sm font-extrabold text-slate-950">
                                  {selectedDeliveryZone ||
                                    'Choose Thimphu, Paro, or Chhukha'}
                                </span>
                              </span>
                            </span>

                            <ChevronDown
                              size={18}
                              strokeWidth={2.4}
                              className={`shrink-0 text-slate-400 transition-transform ${
                                destinationPickerOpen ? 'rotate-180' : ''
                              }`}
                            />
                          </button>

                          {destinationPickerOpen && (
                            <div className="mt-1.5 grid gap-1.5 border-t border-slate-100 pt-1.5">
                              {DELIVERY_DESTINATION_OPTIONS.map((destination) => {
                                const selected =
                                  selectedDeliveryZone === destination;

                                return (
                                  <button
                                    key={destination}
                                    type="button"
                                    onClick={() => {
                                      setUseSavedAddress(false);
                                      setCustomer((previous) => ({
                                        ...previous,
                                        deliveryAddress: destination,
                                      }));
                                      setDestinationPickerOpen(false);
                                      setError('');
                                    }}
                                    className={`flex min-h-[46px] items-center justify-between rounded-xl px-3 text-left transition active:scale-[0.99] ${
                                      selected
                                        ? 'bg-orange-50 text-orange-700 ring-1 ring-orange-100'
                                        : 'bg-white text-slate-700 active:bg-slate-50'
                                    }`}
                                  >
                                    <span className="flex items-center gap-2.5">
                                      <span
                                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                                          selected
                                            ? 'bg-white text-orange-500'
                                            : 'bg-slate-50 text-slate-400'
                                        }`}
                                      >
                                        <MapPin size={15} strokeWidth={2.3} />
                                      </span>
                                      <span className="text-sm font-bold">
                                        {destination}
                                      </span>
                                    </span>

                                    {selected && (
                                      <CheckCircle
                                        size={17}
                                        strokeWidth={2.5}
                                      />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {savedAddress?.formattedAddress && (
                          <button
                            type="button"
                            onClick={selectSavedDefaultAddress}
                            className="mt-2.5 h-10 w-full rounded-xl bg-orange-50 text-xs font-extrabold text-orange-700"
                          >
                            Use my default saved address
                          </button>
                        )}
                      </div>
                    )}
                  </section>
                </div>
              )}

              {reviewStep === 3 && (
                <div className="space-y-4">
                  <section className="rounded-2xl border border-slate-100 bg-white p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-slate-500">
                        <MapPin size={18} strokeWidth={2.2} />
                      </span>
                      <div>
                        <p className="text-sm font-extrabold text-slate-950">
                          How would you like to receive it?
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          The final price will include the applicable delivery
                          or pickup handling charge.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          setFulfillmentMode('delivery');
                          setError('');
                        }}
                        className={`rounded-2xl border px-3.5 py-3 text-left transition active:scale-[0.99] ${
                          fulfillmentMode === 'delivery'
                            ? 'border-orange-200 bg-orange-50 text-orange-700 ring-1 ring-orange-100'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <span className="block text-sm font-extrabold">
                          Deliver to me
                        </span>
                        <span className="mt-1 block text-xs leading-4 opacity-75">
                          Use saved address
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setFulfillmentMode('self_pickup');
                          setDestinationPickerOpen(false);
                          setError('');
                        }}
                        className={`rounded-2xl border px-3.5 py-3 text-left transition active:scale-[0.99] ${
                          fulfillmentMode === 'self_pickup'
                            ? 'border-orange-200 bg-orange-50 text-orange-700 ring-1 ring-orange-100'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <span className="block text-sm font-extrabold">
                          I will collect
                        </span>
                        <span className="mt-1 block text-xs leading-4 opacity-75">
                          Choose pickup option
                        </span>
                      </button>
                    </div>

                    {isSelfPickup ? (
                      <div className="mt-4 space-y-2.5">
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                          Pickup option
                        </p>

                        {SELF_PICKUP_OPTIONS.map((hub) => (
                          <button
                            key={hub.id}
                            type="button"
                            onClick={() => {
                              setPickupHubId(hub.id);
                              setError('');
                            }}
                            className={`w-full rounded-2xl border p-3.5 text-left transition active:scale-[0.99] ${
                              pickupHubId === hub.id
                                ? 'border-orange-200 bg-orange-50 text-orange-700 ring-1 ring-orange-100'
                                : 'border-slate-200 bg-white text-slate-600'
                            }`}
                          >
                            <span className="block text-sm font-bold">
                              {hub.name}
                            </span>
                            <span className="mt-1 block text-xs leading-4 text-slate-500">
                              {hub.dzongkhag}
                            </span>
                          </button>
                        ))}

                        <div className="rounded-2xl bg-slate-50 px-3.5 py-3 text-xs leading-5 text-slate-600">
                          {selectedPickupHub.pickupInstructions}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              {useSavedAddress && savedAddress?.formattedAddress
                                ? 'Deliver to saved address'
                                : 'Delivery area'}
                            </p>
                            <p className="mt-1 text-sm font-extrabold text-slate-950">
                              {useSavedAddress && savedAddress?.formattedAddress
                                ? savedAddress.label || 'Default address'
                                : selectedDeliveryZone ||
                                  'No delivery area selected'}
                            </p>
                            <p className="mt-1.5 break-words text-xs leading-5 text-slate-500 [overflow-wrap:anywhere]">
                              {customer.deliveryAddress ||
                                'Choose an address or delivery area.'}
                            </p>
                            {selectedDeliveryZone && (
                              <span className="mt-2 inline-flex rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-extrabold text-slate-600">
                                Zone: {selectedDeliveryZone}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => goToReviewStep(2)}
                            className="shrink-0 rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 transition active:scale-[0.97]"
                          >
                            {customer.deliveryAddress ? 'Change' : 'Choose'}
                          </button>
                        </div>
                      </div>
                    )}
                  </section>

                  <section className="rounded-2xl border border-slate-100 bg-white p-4">
                    <p className="text-sm font-extrabold text-slate-950">
                      Request summary
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-slate-50 px-3.5 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Products
                        </p>
                        <p className="mt-1 text-sm font-extrabold text-slate-950">
                          {itemCount} item{itemCount === 1 ? '' : 's'} ·{' '}
                          {totalQuantity} qty
                        </p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 px-3.5 py-3 text-right">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Site estimate
                        </p>
                        <p className="mt-1 text-sm font-extrabold text-slate-950">
                          {estimatedSiteTotal > 0
                            ? formatPrice(estimatedSiteTotal)
                            : 'Pending'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 rounded-2xl bg-slate-50 px-3.5 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        Contact
                      </p>
                      <p className="mt-1 text-sm font-extrabold text-slate-950">
                        {customer.name.trim()} · {customer.phone.trim()}
                      </p>
                    </div>
                  </section>

                  <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-white px-4 py-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                      <CheckCircle size={17} strokeWidth={2.3} />
                    </span>
                    <div>
                      <p className="text-sm font-extrabold text-slate-950">
                        No payment now
                      </p>
                      <p className="mt-1 text-xs font-medium leading-5 text-slate-600">
                        We’ll confirm availability and the final price first.
                        Payment comes only after you approve it.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-slate-100 bg-white/95 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
              <div className={`grid gap-2.5 ${reviewStep > 1 ? 'grid-cols-[0.72fr_1.28fr]' : 'grid-cols-1'}`}>
                {reviewStep > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      goToReviewStep(
                        (reviewStep - 1) as RequestReviewStep,
                      )
                    }
                    disabled={submitting}
                    className="flex h-[52px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-600 transition active:scale-[0.98] active:bg-slate-50 disabled:opacity-60"
                  >
                    Back
                  </button>
                )}

                {reviewStep < 3 ? (
                  <button
                    type="button"
                    onClick={continueReview}
                    disabled={submitting}
                    className="flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-orange-500 text-sm font-extrabold text-white shadow-md shadow-orange-500/15 transition active:scale-[0.98] active:bg-orange-600 disabled:opacity-60"
                  >
                    {reviewStep === 1
                      ? 'Continue to Contact'
                      : 'Continue to Delivery'}
                    <Package size={17} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submitBag}
                    disabled={submitting}
                    className="flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-orange-500 text-sm font-extrabold text-white shadow-md shadow-orange-500/15 transition active:scale-[0.98] active:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? (
                      <>
                        <Loader2
                          size={18}
                          strokeWidth={2.5}
                          className="animate-spin"
                        />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Submit Request
                        <Package size={18} />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {hasItems && (
        <div className="sticky bottom-[calc(4.55rem+env(safe-area-inset-bottom))] z-40 mt-3 border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur-xl">
          <div className="mx-auto max-w-lg">
            <button
              type="button"
              onClick={openSubmitConfirmation}
              disabled={submitting}
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 text-sm font-extrabold text-white shadow-md shadow-orange-500/15 transition active:scale-[0.98] active:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Sending request...
                </>
              ) : (
                <>
                  Continue
                  <Package size={18} />
                </>
              )}
            </button>
            <p className="mt-1.5 text-center text-[10px] text-slate-500">
              No payment now. We’ll check availability and final price first.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
