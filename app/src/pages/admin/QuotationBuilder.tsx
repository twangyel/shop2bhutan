import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CircleMinus,
  ExternalLink,
  Eye,
  Loader2,
  MapPin,
  RefreshCw,
  RotateCcw,
  Send,
  Truck,
  X,
} from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import SmartQuotationReview from '@/components/admin/SmartQuotationReview';
import { useAppToast } from '@/components/shared/AppToast';
import {
  calculateQuotationSettingsAmounts,
  createOrUpdateAdminQuotation,
  fetchAdminOrderById,
  fetchDeliveryFeeRules,
  fetchServiceChargeRules,
} from '@/lib/customerOrders';
import { getFulfillmentDisplay, isJaigaonPickupOrder, isSelfPickupOrder } from '@/lib/fulfillment';
import type { DeliveryFeeRule, Order, OrderItem, ServiceChargeRule } from '@/types';

type QuoteItemState = {
  orderItemId: string;
  productName: string;
  productImage: string;
  sourceUrl?: string;
  sourcePlatform?: string;
  screenshotUrl?: string;
  quantity: number;
  customerUnitPrice: number;
  quotedUnitPrice: number;
  customerNotes: string;
  adminNotes: string;
  isIncluded: boolean;
  exclusionReason: string;
};

const validHourOptions = [24, 48, 72, 120] as const;
const exclusionReasonOptions = [
  'Cancelled by customer',
  'Product unavailable',
  'Duplicate item',
  'Wrong product',
  'Other',
] as const;

const EXCLUSION_SECTION_START = '[Excluded from revised final price]';
const EXCLUSION_SECTION_END = '[/Excluded from revised final price]';

function parseQuotationNotes(value?: string | null) {
  const raw = String(value ?? '');
  const start = raw.indexOf(EXCLUSION_SECTION_START);
  const end = raw.indexOf(EXCLUSION_SECTION_END);

  if (start < 0 || end < start) {
    return {
      customerNote: raw.trim(),
      exclusions: new Map<string, string>(),
    };
  }

  const section = raw.slice(start + EXCLUSION_SECTION_START.length, end);
  const exclusions = new Map<string, string>();

  section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .forEach((line) => {
      const content = line.slice(2);
      const separator = content.lastIndexOf(' — ');
      if (separator < 0) return;

      const productName = content.slice(0, separator).trim();
      const reason = content.slice(separator + 3).trim();
      if (productName) exclusions.set(productName.toLowerCase(), reason);
    });

  const customerNote = `${raw.slice(0, start)}${raw.slice(end + EXCLUSION_SECTION_END.length)}`.trim();
  return { customerNote, exclusions };
}

function buildQuotationNotes(customerNote: string, excludedItems: QuoteItemState[]) {
  const cleanNote = customerNote.trim();
  if (excludedItems.length === 0) return cleanNote;

  const exclusionSection = [
    EXCLUSION_SECTION_START,
    ...excludedItems.map(
      (item) =>
        `- ${item.productName} — ${item.exclusionReason.trim() || 'Not included in revised final price'}`,
    ),
    EXCLUSION_SECTION_END,
  ].join('\n');

  return [cleanNote, exclusionSection].filter(Boolean).join('\n\n');
}

function numberValue(value: string | number | undefined | null) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function formatAmount(value?: number) {
  if (!value || value <= 0) return 'Nu. 0';
  return `Nu. ${Math.round(value).toLocaleString()}`;
}

function compactAddressParts(parts: Array<string | undefined>) {
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

function fullDeliveryAddress(order: Order) {
  if (isSelfPickupOrder(order)) {
    const display = getFulfillmentDisplay(order);
    return compactAddressParts([display.title, display.details]).join(' • ');
  }

  return compactAddressParts([
    order.shippingAddress.village,
    order.shippingAddress.gewog,
    order.shippingAddress.dzongkhag,
    order.shippingAddress.landmark,
  ]).join(', ');
}

function validUntilFromHours(hours: number) {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

function orderItemNotes(item: OrderItem) {
  const itemWithNotes = item as OrderItem & { notes?: string };
  return itemWithNotes.notes || '';
}

function orderItemScreenshot(item: OrderItem) {
  const itemWithScreenshot = item as OrderItem & { screenshotUrl?: string };
  return itemWithScreenshot.screenshotUrl || '';
}

function buildInitialItems(
  order: Order,
  exclusionReasons = new Map<string, string>(),
): QuoteItemState[] {
  const hasExistingQuotation = Boolean(
    order.quotation?.id && order.quotation.items.length > 0,
  );

  return order.items.map((item) => {
    const existingQuoteItem = order.quotation?.items.find(
      (quoteItem) => quoteItem.orderItemId === item.id,
    );
    const isIncluded = !hasExistingQuotation || Boolean(existingQuoteItem);

    return {
      orderItemId: item.id,
      productName: existingQuoteItem?.productName || item.productName,
      productImage: existingQuoteItem?.productImage || item.productImage,
      sourceUrl: item.sourceUrl,
      sourcePlatform: item.sourcePlatform,
      screenshotUrl: orderItemScreenshot(item),
      quantity: existingQuoteItem?.quantity || item.quantity || 1,
      customerUnitPrice: item.unitPrice || 0,
      quotedUnitPrice: existingQuoteItem?.unitPrice || item.unitPrice || 0,
      customerNotes: orderItemNotes(item),
      adminNotes: existingQuoteItem?.notes || '',
      isIncluded,
      exclusionReason: isIncluded
        ? ''
        : exclusionReasons.get(item.productName.toLowerCase()) ||
          'Not included in revised final price',
    };
  });
}

function ruleSummary(rule?: ServiceChargeRule) {
  if (!rule) return 'No active tier found';
  const min = `Nu. ${rule.minAmount.toLocaleString()}`;
  const max = rule.maxAmount === null ? '∞' : `Nu. ${rule.maxAmount.toLocaleString()}`;
  return `${rule.name}: ${rule.percentage}% or min Nu. ${(rule.minimumCharge ?? rule.flatFee ?? 0).toLocaleString()} (${min}–${max})`;
}

function deliveryRuleSummary(rule?: DeliveryFeeRule, order?: Order | null) {
  if (order && isJaigaonPickupOrder(order)) {
    return 'Jaigaon pickup selected: delivery fee is not charged.';
  }

  if (!rule) return 'No active destination rule found';
  return `${rule.destination}: Nu. ${rule.baseFee.toLocaleString()}${rule.estimatedDays ? ` • ${rule.estimatedDays} days` : ''}`;
}

export default function QuotationBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useAppToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<QuoteItemState[]>([]);
  const [serviceRules, setServiceRules] = useState<ServiceChargeRule[]>([]);
  const [deliveryRules, setDeliveryRules] = useState<DeliveryFeeRule[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [validHours, setValidHours] = useState<number>(48);
  const [additionalChargeLabel, setAdditionalChargeLabel] = useState('');
  const [additionalChargeAmount, setAdditionalChargeAmount] = useState(0);
  const [manualServiceCharge, setManualServiceCharge] = useState<number | '' | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [excludeTargetId, setExcludeTargetId] = useState<string | null>(null);
  const [excludeReason, setExcludeReason] = useState<(typeof exclusionReasonOptions)[number]>(
    'Cancelled by customer',
  );
  const [customExclusionReason, setCustomExclusionReason] = useState('');
  const [error, setError] = useState('');

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);

    try {
      const [realServiceRules, realDeliveryRules] = await Promise.all([
        fetchServiceChargeRules(),
        fetchDeliveryFeeRules(),
      ]);
      setServiceRules(realServiceRules);
      setDeliveryRules(realDeliveryRules);
    } catch (err) {
      console.error('Failed to load quotation settings:', err);
      const message = err instanceof Error ? err.message : 'Unable to load quotation settings.';
      setError(message);
      toast.error('Quotation settings unavailable', message);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  const loadOrder = useCallback(async () => {
    if (!id) {
      setOrder(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const realOrder = await fetchAdminOrderById(id);
      setOrder(realOrder);

      if (realOrder) {
        const parsedNotes = parseQuotationNotes(realOrder.quotation?.notes);
        setItems(buildInitialItems(realOrder, parsedNotes.exclusions));
        setNotes(parsedNotes.customerNote);
        setAdditionalChargeLabel(realOrder.quotation?.additionalChargeLabel || '');
        setAdditionalChargeAmount(realOrder.quotation?.additionalChargeAmount || 0);

        const existingServiceCharge = realOrder.quotation?.serviceCharge;
        setManualServiceCharge(
          typeof existingServiceCharge === 'number' && Number.isFinite(existingServiceCharge)
            ? Math.max(0, existingServiceCharge)
            : null
        );
      }
    } catch (err) {
      console.error('Failed to load quotation builder order:', err);
      setError(err instanceof Error ? err.message : 'Unable to load order.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const includedItems = useMemo(
    () => items.filter((item) => item.isIncluded),
    [items],
  );
  const excludedItems = useMemo(
    () => items.filter((item) => !item.isIncluded),
    [items],
  );

  const productTotal = useMemo(
    () =>
      includedItems.reduce(
        (sum, item) =>
          sum +
          numberValue(item.quotedUnitPrice) *
            Math.max(1, Number(item.quantity) || 1),
        0,
      ),
    [includedItems],
  );

  const settingsAmounts = useMemo(() => {
    if (!order) {
      return {
        serviceCharge: 0,
        deliveryFee: 0,
        serviceRule: undefined,
        deliveryRule: undefined,
        serviceNeedsReview: false,
        deliveryNeedsManualQuote: false,
      };
    }

    return calculateQuotationSettingsAmounts({
      order,
      productTotal,
      serviceRules,
      deliveryRules,
    });
  }, [deliveryRules, order, productTotal, serviceRules]);

  const suggestedServiceCharge = settingsAmounts.serviceCharge;
  const serviceChargeIsEditable = settingsAmounts.serviceNeedsReview;
  const serviceCharge = serviceChargeIsEditable
    ? manualServiceCharge === null
      ? suggestedServiceCharge
      : numberValue(manualServiceCharge)
    : suggestedServiceCharge;
  const deliveryFee = settingsAmounts.deliveryFee;
  const safeAdditionalCharge = numberValue(additionalChargeAmount);
  const isJaigaonPickup = order ? isJaigaonPickupOrder(order) : false;
  const payableProductTotal = isJaigaonPickup ? 0 : productTotal;
  const totalAmount = payableProductTotal + serviceCharge + deliveryFee + safeAdditionalCharge;
  const deliveryAddressText = order ? fullDeliveryAddress(order) : '';
  const fulfillmentDisplay = order ? getFulfillmentDisplay(order) : null;
  const deliveryFeeLabel = order && isSelfPickupOrder(order) && !isJaigaonPickupOrder(order)
    ? 'Pickup / Handover Fee'
    : 'Delivery Fee';

  const updateQuotedPrice = (orderItemId: string, price: number) => {
    setItems((prev) => prev.map((item) => (item.orderItemId === orderItemId ? { ...item, quotedUnitPrice: price } : item)));
  };

  const updateAdminNotes = (orderItemId: string, value: string) => {
    setItems((prev) => prev.map((item) => (item.orderItemId === orderItemId ? { ...item, adminNotes: value } : item)));
  };

  const openExcludeItemDialog = (item: QuoteItemState) => {
    if (includedItems.length <= 1) {
      const message = 'At least one product must remain in the final price.';
      setError(message);
      toast.warning('Cannot exclude the final item', message);
      return;
    }

    const savedReason = item.exclusionReason.trim();
    const predefinedReason = exclusionReasonOptions.find(
      (reason) => reason !== 'Other' && reason === savedReason,
    );

    setExcludeTargetId(item.orderItemId);
    setExcludeReason(predefinedReason || (savedReason ? 'Other' : 'Cancelled by customer'));
    setCustomExclusionReason(predefinedReason ? '' : savedReason);
    setError('');
  };

  const closeExcludeItemDialog = () => {
    if (saving) return;
    setExcludeTargetId(null);
    setExcludeReason('Cancelled by customer');
    setCustomExclusionReason('');
  };

  const confirmExcludeItem = () => {
    if (!excludeTargetId) return;

    const finalReason =
      excludeReason === 'Other'
        ? customExclusionReason.trim()
        : excludeReason;

    if (finalReason.length < 3) {
      setError('Please enter a short reason for excluding this product.');
      return;
    }

    setItems((prev) =>
      prev.map((item) =>
        item.orderItemId === excludeTargetId
          ? {
              ...item,
              isIncluded: false,
              exclusionReason: finalReason,
            }
          : item,
      ),
    );
    closeExcludeItemDialog();
  };

  const restoreItem = (orderItemId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.orderItemId === orderItemId
          ? { ...item, isIncluded: true, exclusionReason: '' }
          : item,
      ),
    );
    setError('');
  };

  const handleSendQuotation = async () => {
    if (!order) return;

    if (settingsLoading) {
      setError('Please wait for service charge and delivery fee settings to finish loading.');
      toast.warning('Quotation settings are loading', 'Please wait for service charge and delivery fee settings to finish loading.');
      return;
    }

    if (includedItems.length === 0) {
      setError('At least one product must remain in the final price.');
      toast.warning('No included products', 'Restore at least one product before sending the final price.');
      return;
    }

    if (includedItems.some((item) => numberValue(item.quotedUnitPrice) <= 0)) {
      setError('Please enter a confirmed unit price for every included item.');
      toast.warning('Confirmed prices required', 'Please price every product included in the final price.');
      return;
    }

    if (safeAdditionalCharge > 0 && !additionalChargeLabel.trim()) {
      setError('Please enter a label for the additional charge.');
      toast.warning('Charge label required', 'Please enter a label for the additional charge.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await createOrUpdateAdminQuotation({
        orderId: order.id,
        items: includedItems.map((item) => ({
          orderItemId: item.orderItemId,
          productName: item.productName,
          productImage: item.productImage,
          quantity: Math.max(1, Number(item.quantity) || 1),
          unitPrice: numberValue(item.quotedUnitPrice),
          notes: item.adminNotes.trim(),
        })),
        serviceCharge,
        deliveryFee,
        taxAmount: 0,
        additionalChargeLabel: additionalChargeLabel.trim(),
        additionalChargeAmount: safeAdditionalCharge,
        payableProductTotal,
        notes: buildQuotationNotes(notes, excludedItems),
        validUntil: validUntilFromHours(validHours),
      });

      toast.success(
        'Final price sent',
        'The customer can now review the confirmed price and continue to payment.',
      );
      const refreshedOrder = await fetchAdminOrderById(order.id);
      if (refreshedOrder) {
        const parsedNotes = parseQuotationNotes(refreshedOrder.quotation?.notes);
        setOrder(refreshedOrder);
        setItems(buildInitialItems(refreshedOrder, parsedNotes.exclusions));
        setNotes(parsedNotes.customerNote || notes);
        setAdditionalChargeLabel(refreshedOrder.quotation?.additionalChargeLabel || additionalChargeLabel);
        setAdditionalChargeAmount(refreshedOrder.quotation?.additionalChargeAmount || safeAdditionalCharge);

        const refreshedServiceCharge = refreshedOrder.quotation?.serviceCharge;
        setManualServiceCharge(
          typeof refreshedServiceCharge === 'number' && Number.isFinite(refreshedServiceCharge)
            ? Math.max(0, refreshedServiceCharge)
            : null
        );
      }
    } catch (err) {
      console.error('Failed to send quotation:', err);
      const message = err instanceof Error ? err.message : 'Unable to send final price.';
      setError(message);
      toast.error('Final price was not sent', message);
    } finally {
      setSaving(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([loadSettings(), loadOrder()]);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/orders')} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-neutral-600" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Confirm Availability & Final Price</h1>
            <p className="text-xs text-neutral-500">Loading order details...</p>
          </div>
        </div>
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-36 rounded-xl bg-white shadow-card animate-pulse" />
        ))}
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/admin/orders')} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors">
          <ArrowLeft size={20} className="text-neutral-600" />
        </button>
        <div className="bg-white rounded-xl p-8 shadow-card text-center">
          <AlertCircle size={38} className="text-red-400 mx-auto mb-3" />
          <p className="text-sm text-neutral-600 mb-4">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/admin/orders')}
            className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return <div className="text-neutral-500">Order not found</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-3">
          <button onClick={() => navigate('/admin/orders')} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors mt-0.5">
            <ArrowLeft size={20} className="text-neutral-600" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold text-gray-900">Confirm Availability & Final Price</h1>
              <StatusBadge status={order.status} size="sm" />
            </div>
            <p className="text-xs text-neutral-500">
              #{order.orderNumber} — {order.user.name} — UUID {order.id}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={refreshAll}
            disabled={loading || saving || settingsLoading}
            className="px-4 py-2 bg-white border border-neutral-200 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-50 transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setPreviewOpen((prev) => !prev)}
            className="px-4 py-2 bg-neutral-100 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-200 transition-colors flex items-center gap-2"
          >
            <Eye size={16} />
            {previewOpen ? 'Hide Preview' : 'Show Preview'}
          </button>
          <button
            type="button"
            onClick={handleSendQuotation}
            disabled={saving || settingsLoading || includedItems.length === 0}
            className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Send Final Price
          </button>
        </div>
      </div>

      {(settingsAmounts.serviceNeedsReview || settingsAmounts.deliveryNeedsManualQuote) && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700 flex items-start gap-2">
          <AlertCircle size={17} className="mt-0.5 flex-shrink-0" />
          <span>
            {settingsAmounts.serviceNeedsReview && 'This service charge tier is set to Review. Adjust the suggested charge in Final Price Summary if needed. '}
            {settingsAmounts.deliveryNeedsManualQuote && 'Delivery destination requires manual pricing or is inactive. Use additional charges only if required.'}
          </span>
        </div>
      )}

      <SmartQuotationReview
        order={order}
        currentNote={notes}
        onApplyNote={(value) => {
          setNotes(value);
              }}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-white rounded-xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">Customer Request</h3>
              <span className="text-xs text-neutral-500">
                {includedItems.length} included
                {excludedItems.length > 0 ? ` • ${excludedItems.length} excluded` : ''}
              </span>
            </div>
            <p className="mb-4 text-xs leading-5 text-neutral-500">
              Confirm product availability, selected options, current seller price, and all applicable charges before sending the final price.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl bg-neutral-50 p-4">
                <p className="text-xs font-semibold text-neutral-500 uppercase">Customer</p>
                <p className="text-sm font-semibold text-gray-900 mt-1">{order.user.name}</p>
                <p className="text-xs text-neutral-600">{order.user.phone || order.shippingAddress.phone || '-'}</p>
                <p className="text-xs text-neutral-500 truncate">{order.user.email || '-'}</p>
              </div>
              <div className="rounded-xl bg-neutral-50 p-4">
                <p className="text-xs font-semibold text-neutral-500 uppercase">{fulfillmentDisplay?.addressLabel || 'Delivery'}</p>
                <div className="flex items-start gap-2 mt-1">
                  <MapPin size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-neutral-700">{deliveryAddressText || '-'}</p>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Truck size={15} className="text-emerald-500 flex-shrink-0" />
                  <p className="text-xs text-neutral-600">{fulfillmentDisplay?.subtitle || order.deliveryHub.name}</p>
                </div>
              </div>
            </div>

            {order.notes && (
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 mb-4">
                <p className="text-xs font-semibold text-amber-700 uppercase mb-1">Customer Notes</p>
                <p className="text-sm text-amber-800 whitespace-pre-wrap">{order.notes}</p>
              </div>
            )}

            <div className="space-y-3">
              {items.map((item, index) => {
                const lineTotal = item.isIncluded
                  ? numberValue(item.quotedUnitPrice) *
                    Math.max(1, Number(item.quantity) || 1)
                  : 0;

                return (
                  <div
                    key={item.orderItemId}
                    className={`rounded-xl border p-4 transition ${
                      item.isIncluded
                        ? 'border-neutral-200 bg-white'
                        : 'border-red-100 bg-red-50/50'
                    }`}
                  >
                    <div className={`flex flex-col gap-4 lg:flex-row ${item.isIncluded ? '' : 'opacity-75'}`}>
                      <img
                        src={item.productImage}
                        alt=""
                        className="w-24 h-24 rounded-xl object-cover bg-neutral-100 flex-shrink-0"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-xs text-neutral-500">Item {index + 1}</p>
                              {!item.isIncluded && (
                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-700">
                                  Excluded
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-semibold text-gray-900 line-clamp-2">{item.productName}</h4>
                            <div className="flex items-center gap-2 flex-wrap mt-1">
                              {item.sourcePlatform && (
                                <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 text-[10px] font-semibold uppercase">
                                  {item.sourcePlatform}
                                </span>
                              )}
                              <span className="text-xs text-neutral-500">Qty: {item.quantity}</span>
                              {item.customerUnitPrice > 0 && (
                                <span className="text-xs text-neutral-500">Shown: {formatAmount(item.customerUnitPrice)}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-neutral-500">Line Total</p>
                            <p className={`text-base font-bold ${item.isIncluded ? 'text-amber-600' : 'text-red-500'}`}>
                              {formatAmount(lineTotal)}
                            </p>
                          </div>
                        </div>

                        {item.sourceUrl && (
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-2 max-w-full"
                          >
                            <span className="truncate">{item.sourceUrl}</span>
                            <ExternalLink size={12} className="flex-shrink-0" />
                          </a>
                        )}

                        {item.screenshotUrl && (
                          <a
                            href={item.screenshotUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline mt-2 ml-0 lg:ml-3"
                          >
                            View screenshot
                            <ExternalLink size={12} />
                          </a>
                        )}

                        {item.customerNotes && (
                          <div className="mt-3 rounded-lg bg-neutral-50 px-3 py-2">
                            <p className="text-xs font-semibold text-neutral-500">Customer item note</p>
                            <p className="text-xs text-neutral-700 whitespace-pre-wrap">{item.customerNotes}</p>
                          </div>
                        )}

                        {!item.isIncluded && (
                          <div className="mt-3 rounded-lg border border-red-100 bg-white px-3 py-2.5">
                            <p className="text-xs font-semibold text-red-700">Reason</p>
                            <p className="mt-0.5 text-xs text-red-600">
                              {item.exclusionReason || 'Not included in revised final price'}
                            </p>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                          <div>
                            <label className="text-xs font-semibold text-neutral-500 uppercase">Confirmed Unit Price</label>
                            <input
                              type="number"
                              value={item.quotedUnitPrice}
                              onChange={(e) => updateQuotedPrice(item.orderItemId, numberValue(e.target.value))}
                              disabled={!item.isIncluded}
                              className="w-full h-10 mt-1 px-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:bg-neutral-100 disabled:text-neutral-400"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-neutral-500 uppercase">Item Note to Customer</label>
                            <input
                              type="text"
                              value={item.adminNotes}
                              onChange={(e) => updateAdminNotes(item.orderItemId, e.target.value)}
                              disabled={!item.isIncluded}
                              className="w-full h-10 mt-1 px-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 disabled:bg-neutral-100 disabled:text-neutral-400"
                              placeholder="Optional: size, availability, ETA..."
                            />
                          </div>
                        </div>

                        <div className="mt-3 flex justify-end">
                          {item.isIncluded ? (
                            <button
                              type="button"
                              onClick={() => openExcludeItemDialog(item)}
                              disabled={saving}
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                            >
                              <CircleMinus size={15} />
                              Exclude from final price
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => restoreItem(item.orderItemId)}
                              disabled={saving}
                              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                            >
                              <RotateCcw size={15} />
                              Restore item
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-card">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Optional Additional Charge</h3>
            <p className="text-xs text-neutral-500 mb-4">
              Use only when applicable, such as manual customs/import charge, heavy item handling, or special delivery. GST is not auto-applied in MVP.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-neutral-500 uppercase">Charge Label</label>
                <input
                  type="text"
                  value={additionalChargeLabel}
                  onChange={(e) => {
                                    setAdditionalChargeLabel(e.target.value);
                  }}
                  className="w-full h-10 mt-1 px-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  placeholder="Customs / import charge, if applicable"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-500 uppercase">Amount</label>
                <input
                  type="number"
                  value={additionalChargeAmount}
                  onChange={(e) => {
                                    setAdditionalChargeAmount(numberValue(e.target.value));
                  }}
                  className="w-full h-10 mt-1 px-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-card">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Note to Customer</h3>
            <textarea
              value={notes}
              onChange={(e) => {
                            setNotes(e.target.value);
              }}
              rows={3}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
              placeholder="Optional message for customer..."
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl p-5 shadow-card sticky top-20">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Final Price Summary</h3>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">{isJaigaonPickup ? 'Product Value (Reference)' : 'Product Total'}</span>
                  <span className="font-semibold">{formatAmount(productTotal)}</span>
                </div>
                {isJaigaonPickup && (
                  <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">
                    Product value is shown to the customer for reference only. It is not included in the amount payable to Shop2Bhutan.
                  </p>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-neutral-600">Service Charge</span>
                  {settingsLoading ? (
                    <span className="font-semibold">Loading...</span>
                  ) : serviceChargeIsEditable ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-neutral-400">Nu.</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={manualServiceCharge === null ? Math.round(suggestedServiceCharge) : manualServiceCharge}
                        onChange={(e) => {
                                                setManualServiceCharge(e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0));
                        }}
                        className="h-9 w-28 rounded-lg border border-orange-200 bg-orange-50/50 px-3 text-right text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                        aria-label="Editable service charge"
                      />
                    </div>
                  ) : (
                    <span className="font-semibold">{formatAmount(serviceCharge)}</span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">{ruleSummary(settingsAmounts.serviceRule)}</p>
                {serviceChargeIsEditable && !settingsLoading && (
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <p className="text-[11px] leading-relaxed text-orange-600">
                      Review mode: suggested {formatAmount(suggestedServiceCharge)}. You may adjust it before sending.
                    </p>
                    {manualServiceCharge !== null && (
                      <button
                        type="button"
                        onClick={() => {
                                                setManualServiceCharge(null);
                        }}
                        className="flex-shrink-0 text-[11px] font-semibold text-orange-600 hover:text-orange-700"
                      >
                        Use suggested
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">{deliveryFeeLabel}</span>
                  <span className="font-semibold">{settingsLoading ? 'Loading...' : formatAmount(deliveryFee)}</span>
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">{deliveryRuleSummary(settingsAmounts.deliveryRule, order)}</p>
                {order && isJaigaonPickupOrder(order) && (
                  <p className="mt-2 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-[11px] leading-relaxed text-neutral-600">
                    Customer chose to collect from Jaigaon. Service charge still applies, but Bhutan delivery fee is zero.
                  </p>
                )}
              </div>
              {safeAdditionalCharge > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">{additionalChargeLabel || 'Additional Charge'}</span>
                  <span className="font-semibold">{formatAmount(safeAdditionalCharge)}</span>
                </div>
              )}
            </div>

            <hr className="my-4 border-neutral-200" />

            <div className="flex justify-between items-center">
              <span className="text-base font-semibold text-gray-900">{isJaigaonPickup ? 'Payable to Shop2Bhutan' : 'Grand Total'}</span>
              <span className="text-2xl font-bold text-amber-600">{formatAmount(totalAmount)}</span>
            </div>
            {isJaigaonPickup && (
              <p className="mt-2 rounded-lg bg-neutral-50 px-3 py-2 text-[11px] leading-relaxed text-neutral-500">
                Jaigaon pickup is charges-only. Customer pays service/additional charges here; product value is only a reference.
              </p>
            )}

            <div className="mt-4">
              <label className="text-xs font-semibold text-neutral-500 uppercase">Valid For</label>
              <select
                value={validHours}
                onChange={(e) => setValidHours(Number(e.target.value))}
                className="w-full h-10 mt-1 px-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 bg-white"
              >
                {validHourOptions.map((hours) => (
                  <option key={hours} value={hours}>
                    {hours < 24 ? `${hours} hours` : `${hours / 24} day${hours / 24 === 1 ? '' : 's'}`}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleSendQuotation}
              disabled={saving || settingsLoading || includedItems.length === 0}
              className="w-full h-12 mt-4 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Send Final Price
            </button>

            <p className="text-xs text-neutral-400 mt-3">
              Auto tiers use the calculated service charge. Review tiers use it as a suggestion and allow manual adjustment before sending. Delivery fees still come from settings.
            </p>
          </div>

          {previewOpen && (
            <div className="bg-violet-50 rounded-xl p-5 border border-violet-100">
              <h3 className="text-sm font-semibold text-violet-800 mb-3">Customer Preview</h3>
              <div className="space-y-2">
                {includedItems.map((item) => (
                  <div key={item.orderItemId} className="flex justify-between gap-3 text-sm">
                    <span className="text-violet-700 truncate">{item.productName} x{item.quantity}</span>
                    <span className="font-semibold text-violet-900 flex-shrink-0">
                      {formatAmount(numberValue(item.quotedUnitPrice) * Math.max(1, Number(item.quantity) || 1))}
                    </span>
                  </div>
                ))}
                {excludedItems.length > 0 && (
                  <div className="rounded-lg border border-violet-200 bg-white/70 px-2.5 py-2 text-[11px] leading-relaxed text-violet-700">
                    {excludedItems.length} product{excludedItems.length === 1 ? '' : 's'} excluded from this revised final price.
                  </div>
                )}
                {isJaigaonPickup && (
                  <p className="rounded-lg bg-white/70 px-2.5 py-2 text-[11px] leading-relaxed text-violet-700">
                    Product value is reference only for Jaigaon pickup and is not included in the payable amount.
                  </p>
                )}
                <hr className="border-violet-200 my-2" />
                <div className="flex justify-between text-sm">
                  <span className="text-violet-700">Service Charge</span>
                  <span className="font-semibold text-violet-900">{formatAmount(serviceCharge)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-violet-700">{deliveryFeeLabel}</span>
                  <span className="font-semibold text-violet-900">{formatAmount(deliveryFee)}</span>
                </div>
                {safeAdditionalCharge > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-violet-700">{additionalChargeLabel || 'Additional Charge'}</span>
                    <span className="font-semibold text-violet-900">{formatAmount(safeAdditionalCharge)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-2 border-t border-violet-200">
                  <span className="font-semibold text-violet-800">{isJaigaonPickup ? 'Payable to Shop2Bhutan' : 'Grand Total'}</span>
                  <span className="font-bold text-violet-900">{formatAmount(totalAmount)}</span>
                </div>
              </div>
              <p className="text-xs text-violet-600 mt-4">
                The customer will review the final price and continue to payment after confirmation.
              </p>
            </div>
          )}
        </div>
      </div>
      {excludeTargetId && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/50 px-3 pb-3 pt-10 backdrop-blur-[2px] sm:items-center sm:pb-10">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Exclude product?</h3>
                <p className="mt-1 text-xs leading-5 text-neutral-500">
                  The original customer request will remain in the order history. This product will be removed only from the revised final price.
                </p>
              </div>
              <button
                type="button"
                onClick={closeExcludeItemDialog}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <label className="block">
                <span className="text-xs font-semibold uppercase text-neutral-500">Reason</span>
                <select
                  value={excludeReason}
                  onChange={(event) => {
                    setExcludeReason(event.target.value as (typeof exclusionReasonOptions)[number]);
                    setError('');
                  }}
                  className="mt-1 h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-red-500/20"
                >
                  {exclusionReasonOptions.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </label>

              {excludeReason === 'Other' && (
                <label className="block">
                  <span className="text-xs font-semibold uppercase text-neutral-500">Custom reason</span>
                  <input
                    type="text"
                    value={customExclusionReason}
                    onChange={(event) => {
                      setCustomExclusionReason(event.target.value.slice(0, 160));
                      setError('');
                    }}
                    autoFocus
                    placeholder="Briefly explain why this product is excluded"
                    className="mt-1 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:ring-2 focus:ring-red-500/20"
                  />
                </label>
              )}

              {error && (
                <div className="rounded-xl bg-red-50 px-3 py-2.5 text-xs font-medium text-red-600">
                  {error}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-neutral-100 px-5 py-4">
              <button
                type="button"
                onClick={closeExcludeItemDialog}
                className="h-11 rounded-xl border border-neutral-200 bg-white text-sm font-semibold text-neutral-700"
              >
                Keep item
              </button>
              <button
                type="button"
                onClick={confirmExcludeItem}
                className="h-11 rounded-xl bg-red-600 px-3 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Exclude item
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
