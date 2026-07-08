import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  ExternalLink,
  Eye,
  Loader2,
  MapPin,
  RefreshCw,
  Send,
  Truck,
} from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
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
};

const validHourOptions = [24, 48, 72, 120] as const;

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

function buildInitialItems(order: Order): QuoteItemState[] {
  return order.items.map((item) => {
    const existingQuoteItem = order.quotation?.items.find((quoteItem) => quoteItem.orderItemId === item.id);

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
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<QuoteItemState[]>([]);
  const [serviceRules, setServiceRules] = useState<ServiceChargeRule[]>([]);
  const [deliveryRules, setDeliveryRules] = useState<DeliveryFeeRule[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [validHours, setValidHours] = useState<number>(48);
  const [additionalChargeLabel, setAdditionalChargeLabel] = useState('');
  const [additionalChargeAmount, setAdditionalChargeAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
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
      setError(err instanceof Error ? err.message : 'Unable to load quotation settings.');
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
        setItems(buildInitialItems(realOrder));
        setNotes(realOrder.quotation?.notes || '');
        setAdditionalChargeLabel(realOrder.quotation?.additionalChargeLabel || '');
        setAdditionalChargeAmount(realOrder.quotation?.additionalChargeAmount || 0);
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

  const productTotal = useMemo(
    () => items.reduce((sum, item) => sum + numberValue(item.quotedUnitPrice) * Math.max(1, Number(item.quantity) || 1), 0),
    [items]
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

  const serviceCharge = settingsAmounts.serviceCharge;
  const deliveryFee = settingsAmounts.deliveryFee;
  const safeAdditionalCharge = numberValue(additionalChargeAmount);
  const totalAmount = productTotal + serviceCharge + deliveryFee + safeAdditionalCharge;
  const deliveryAddressText = order ? fullDeliveryAddress(order) : '';
  const fulfillmentDisplay = order ? getFulfillmentDisplay(order) : null;
  const deliveryFeeLabel = order && isSelfPickupOrder(order) && !isJaigaonPickupOrder(order)
    ? 'Pickup / Handover Fee'
    : 'Delivery Fee';

  const updateQuotedPrice = (orderItemId: string, price: number) => {
    setSaved(false);
    setItems((prev) => prev.map((item) => (item.orderItemId === orderItemId ? { ...item, quotedUnitPrice: price } : item)));
  };

  const updateAdminNotes = (orderItemId: string, value: string) => {
    setSaved(false);
    setItems((prev) => prev.map((item) => (item.orderItemId === orderItemId ? { ...item, adminNotes: value } : item)));
  };

  const handleSendQuotation = async () => {
    if (!order) return;

    if (settingsLoading) {
      setError('Please wait for service charge and delivery fee settings to finish loading.');
      return;
    }

    if (items.length === 0) {
      setError('This order has no items to quote.');
      return;
    }

    if (items.some((item) => numberValue(item.quotedUnitPrice) <= 0)) {
      setError('Please enter a quotation price for every item.');
      return;
    }

    if (safeAdditionalCharge > 0 && !additionalChargeLabel.trim()) {
      setError('Please enter a label for the additional charge.');
      return;
    }

    setSaving(true);
    setSaved(false);
    setError('');

    try {
      await createOrUpdateAdminQuotation({
        orderId: order.id,
        items: items.map((item) => ({
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
        notes: notes.trim(),
        validUntil: validUntilFromHours(validHours),
      });

      setSaved(true);
      const refreshedOrder = await fetchAdminOrderById(order.id);
      if (refreshedOrder) {
        setOrder(refreshedOrder);
        setItems(buildInitialItems(refreshedOrder));
        setNotes(refreshedOrder.quotation?.notes || notes);
        setAdditionalChargeLabel(refreshedOrder.quotation?.additionalChargeLabel || additionalChargeLabel);
        setAdditionalChargeAmount(refreshedOrder.quotation?.additionalChargeAmount || safeAdditionalCharge);
      }
    } catch (err) {
      console.error('Failed to send quotation:', err);
      setError(err instanceof Error ? err.message : 'Unable to send quotation.');
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
            <h1 className="text-lg font-semibold text-gray-900">Build Quotation</h1>
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
              <h1 className="text-lg font-semibold text-gray-900">Build Quotation</h1>
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
            disabled={saving || settingsLoading}
            className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Send Quotation
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle size={17} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {saved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-start gap-2">
          <CheckCircle size={17} className="mt-0.5 flex-shrink-0" />
          <span>Quotation sent successfully. Customer can now review it from /quotation/{order.id}.</span>
        </div>
      )}

      {(settingsAmounts.serviceNeedsReview || settingsAmounts.deliveryNeedsManualQuote) && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700 flex items-start gap-2">
          <AlertCircle size={17} className="mt-0.5 flex-shrink-0" />
          <span>
            {settingsAmounts.serviceNeedsReview && 'High-value service charge tier needs manual review. '}
            {settingsAmounts.deliveryNeedsManualQuote && 'Delivery destination is marked manual quote or inactive. Use additional charges only if required.'}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-white rounded-xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Customer Request</h3>
              <span className="text-xs text-neutral-500">{items.length} item{items.length === 1 ? '' : 's'}</span>
            </div>

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
                const lineTotal = numberValue(item.quotedUnitPrice) * Math.max(1, Number(item.quantity) || 1);

                return (
                  <div key={item.orderItemId} className="rounded-xl border border-neutral-200 p-4">
                    <div className="flex flex-col lg:flex-row gap-4">
                      <img
                        src={item.productImage}
                        alt=""
                        className="w-24 h-24 rounded-xl object-cover bg-neutral-100 flex-shrink-0"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs text-neutral-500">Item {index + 1}</p>
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
                            <p className="text-base font-bold text-amber-600">{formatAmount(lineTotal)}</p>
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

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                          <div>
                            <label className="text-xs font-semibold text-neutral-500 uppercase">Quoted Unit Price</label>
                            <input
                              type="number"
                              value={item.quotedUnitPrice}
                              onChange={(e) => updateQuotedPrice(item.orderItemId, numberValue(e.target.value))}
                              className="w-full h-10 mt-1 px-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-neutral-500 uppercase">Item Note to Customer</label>
                            <input
                              type="text"
                              value={item.adminNotes}
                              onChange={(e) => updateAdminNotes(item.orderItemId, e.target.value)}
                              className="w-full h-10 mt-1 px-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                              placeholder="Optional: size, availability, ETA..."
                            />
                          </div>
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
                    setSaved(false);
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
                    setSaved(false);
                    setAdditionalChargeAmount(numberValue(e.target.value));
                  }}
                  className="w-full h-10 mt-1 px-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-card">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Quotation Note</h3>
            <textarea
              value={notes}
              onChange={(e) => {
                setSaved(false);
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
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Quotation Summary</h3>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Product Total</span>
                <span className="font-semibold">{formatAmount(productTotal)}</span>
              </div>
              <div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600">Service Charge</span>
                  <span className="font-semibold">{settingsLoading ? 'Loading...' : formatAmount(serviceCharge)}</span>
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">{ruleSummary(settingsAmounts.serviceRule)}</p>
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
              <span className="text-base font-semibold text-gray-900">Grand Total</span>
              <span className="text-2xl font-bold text-amber-600">{formatAmount(totalAmount)}</span>
            </div>

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
              disabled={saving || settingsLoading}
              className="w-full h-12 mt-4 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              Send Quotation
            </button>

            <p className="text-xs text-neutral-400 mt-3">
              Service charge and delivery fee are fetched from settings. The saved quotation stores a snapshot using order UUID only.
            </p>
          </div>

          {previewOpen && (
            <div className="bg-violet-50 rounded-xl p-5 border border-violet-100">
              <h3 className="text-sm font-semibold text-violet-800 mb-3">Customer Preview</h3>
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.orderItemId} className="flex justify-between gap-3 text-sm">
                    <span className="text-violet-700 truncate">{item.productName} x{item.quantity}</span>
                    <span className="font-semibold text-violet-900 flex-shrink-0">
                      {formatAmount(numberValue(item.quotedUnitPrice) * Math.max(1, Number(item.quantity) || 1))}
                    </span>
                  </div>
                ))}
                <hr className="border-violet-200 my-2" />
                <div className="flex justify-between text-sm">
                  <span className="text-violet-700">Service Charge</span>
                  <span className="font-semibold text-violet-900">{formatAmount(serviceCharge)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-violet-700">Delivery Fee</span>
                  <span className="font-semibold text-violet-900">{formatAmount(deliveryFee)}</span>
                </div>
                {safeAdditionalCharge > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-violet-700">{additionalChargeLabel || 'Additional Charge'}</span>
                    <span className="font-semibold text-violet-900">{formatAmount(safeAdditionalCharge)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-2 border-t border-violet-200">
                  <span className="font-semibold text-violet-800">Grand Total</span>
                  <span className="font-bold text-violet-900">{formatAmount(totalAmount)}</span>
                </div>
              </div>
              <p className="text-xs text-violet-600 mt-4">
                Customer will review this in /quotation/{order.id} and then upload payment after acceptance.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
