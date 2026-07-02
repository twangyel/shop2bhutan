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
import { createOrUpdateAdminQuotation, fetchAdminOrderById } from '@/lib/customerOrders';
import type { Order, OrderItem } from '@/types';

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

function numberValue(value: string | number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function formatAmount(value?: number) {
  if (!value || value <= 0) return '-';
  return `Nu. ${value.toLocaleString()}`;
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
  return compactAddressParts([
    order.shippingAddress.village,
    order.shippingAddress.gewog,
    order.shippingAddress.dzongkhag,
    order.shippingAddress.landmark,
  ]).join(', ');
}

function defaultDeliveryFee(order: Order) {
  const text = `${order.deliveryHub.name} ${order.deliveryHub.dzongkhag} ${order.shippingAddress.dzongkhag}`.toLowerCase();
  if (text.includes('paro')) return 400;
  if (text.includes('thimphu')) return 350;
  if (text.includes('chhukha') || text.includes('phuntsholing') || text.includes('phuentsholing')) return 150;
  return 150;
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

export default function QuotationBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<QuoteItemState[]>([]);
  const [serviceCharge, setServiceCharge] = useState(200);
  const [deliveryFee, setDeliveryFee] = useState(150);
  const [taxPercent, setTaxPercent] = useState(0);
  const [validHours, setValidHours] = useState<number>(48);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [error, setError] = useState('');

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
        setServiceCharge(realOrder.quotation?.serviceCharge ?? 200);
        setDeliveryFee(realOrder.quotation?.deliveryFee ?? defaultDeliveryFee(realOrder));
        setTaxPercent(
          realOrder.quotation?.productTotal
            ? Math.round((realOrder.quotation.taxAmount / realOrder.quotation.productTotal) * 100)
            : 0
        );
        setNotes(realOrder.quotation?.notes || '');
      }
    } catch (err) {
      console.error('Failed to load quotation builder order:', err);
      setError(err instanceof Error ? err.message : 'Unable to load order.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const productTotal = useMemo(
    () => items.reduce((sum, item) => sum + numberValue(item.quotedUnitPrice) * Math.max(1, Number(item.quantity) || 1), 0),
    [items]
  );
  const taxAmount = Math.round(productTotal * (numberValue(taxPercent) / 100));
  const totalAmount = productTotal + numberValue(serviceCharge) + numberValue(deliveryFee) + taxAmount;
  const deliveryAddressText = order ? fullDeliveryAddress(order) : '';

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

    if (items.length === 0) {
      setError('This order has no items to quote.');
      return;
    }

    if (items.some((item) => numberValue(item.quotedUnitPrice) <= 0)) {
      setError('Please enter a quotation price for every item.');
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
        serviceCharge: numberValue(serviceCharge),
        deliveryFee: numberValue(deliveryFee),
        taxAmount,
        notes: notes.trim(),
        validUntil: validUntilFromHours(validHours),
      });

      setSaved(true);
      const refreshedOrder = await fetchAdminOrderById(order.id);
      if (refreshedOrder) {
        setOrder(refreshedOrder);
        setItems(buildInitialItems(refreshedOrder));
        setNotes(refreshedOrder.quotation?.notes || notes);
      }
    } catch (err) {
      console.error('Failed to send quotation:', err);
      setError(err instanceof Error ? err.message : 'Unable to send quotation.');
    } finally {
      setSaving(false);
    }
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
          <p className="text-sm text-neutral-600 mb-4">{error || 'Order not found'}</p>
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
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin/orders')} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-neutral-600" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
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
            onClick={loadOrder}
            disabled={saving}
            className="px-4 py-2 bg-white border border-neutral-200 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-50 transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setPreviewOpen((value) => !value)}
            className="px-4 py-2 bg-neutral-100 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-200 transition-colors flex items-center gap-2"
          >
            <Eye size={16} />
            {previewOpen ? 'Hide Preview' : 'Preview'}
          </button>
          <button
            type="button"
            onClick={handleSendQuotation}
            disabled={saving || items.length === 0}
            className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {order.quotation ? 'Update & Send' : 'Send Quotation'}
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
          <span>Quotation saved and sent to the customer.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl p-5 shadow-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Customer Request</h3>
              <span className="text-xs text-neutral-500">{items.length} items</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div className="rounded-lg bg-neutral-50 p-3">
                <p className="text-xs font-semibold text-neutral-500 uppercase mb-1">Customer</p>
                <p className="text-sm font-semibold text-gray-900">{order.user.name}</p>
                <p className="text-xs text-neutral-500">{order.user.phone || order.shippingAddress.phone || '-'}</p>
                <p className="text-xs text-neutral-500 truncate">{order.user.email || '-'}</p>
              </div>
              <div className="rounded-lg bg-neutral-50 p-3">
                <p className="text-xs font-semibold text-neutral-500 uppercase mb-1">Delivery</p>
                <div className="flex items-start gap-2">
                  <MapPin size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-neutral-700 whitespace-pre-wrap">{deliveryAddressText || '-'}</p>
                </div>
                <div className="flex items-start gap-2 mt-1">
                  <Truck size={15} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-neutral-500">{order.deliveryHub.name}</p>
                </div>
              </div>
            </div>

            {order.notes && (
              <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 mb-4">
                <p className="text-xs font-semibold text-amber-700 uppercase mb-1">Customer Notes</p>
                <p className="text-sm text-amber-800 whitespace-pre-wrap">{order.notes}</p>
              </div>
            )}

            <div className="space-y-3">
              {items.map((item, index) => {
                const lineTotal = numberValue(item.quotedUnitPrice) * Math.max(1, Number(item.quantity) || 1);
                return (
                  <div key={item.orderItemId} className="rounded-xl border border-neutral-200 p-3">
                    <div className="flex flex-col md:flex-row gap-3">
                      <img
                        src={item.productImage}
                        alt=""
                        className="w-full md:w-24 h-32 md:h-24 rounded-lg object-cover bg-neutral-100 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs text-neutral-400">Item {index + 1}</p>
                            <p className="text-sm font-semibold text-gray-900 line-clamp-2">{item.productName}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-[10px] font-semibold text-neutral-600 uppercase">
                                {item.sourcePlatform || 'link'}
                              </span>
                              <span className="text-xs text-neutral-500">Qty: {item.quantity}</span>
                              <span className="text-xs text-neutral-500">Shown: {formatAmount(item.customerUnitPrice)}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-neutral-500">Line Total</p>
                            <p className="text-base font-bold text-amber-600">Nu. {lineTotal.toLocaleString()}</p>
                          </div>
                        </div>

                        {item.sourceUrl && (
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 text-xs text-blue-500 hover:underline flex items-center gap-1 min-w-0"
                          >
                            <span className="truncate">{item.sourceUrl}</span>
                            <ExternalLink size={12} className="flex-shrink-0" />
                          </a>
                        )}

                        {item.screenshotUrl && (
                          <a
                            href={item.screenshotUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex text-xs text-violet-600 hover:underline"
                          >
                            View uploaded screenshot
                          </a>
                        )}

                        {item.customerNotes && (
                          <div className="mt-2 rounded-lg bg-neutral-50 p-2">
                            <p className="text-[11px] font-semibold text-neutral-500 uppercase">Customer item note</p>
                            <p className="text-xs text-neutral-700 whitespace-pre-wrap">{item.customerNotes}</p>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                          <div>
                            <label className="text-xs font-medium text-neutral-500 uppercase">Quoted Unit Price</label>
                            <input
                              type="number"
                              min="0"
                              value={item.quotedUnitPrice}
                              onChange={(event) => updateQuotedPrice(item.orderItemId, numberValue(event.target.value))}
                              className="w-full h-10 mt-1 px-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-neutral-500 uppercase">Item Note to Customer</label>
                            <input
                              type="text"
                              value={item.adminNotes}
                              onChange={(event) => updateAdminNotes(item.orderItemId, event.target.value)}
                              placeholder="Optional: size, availability, ETA..."
                              className="w-full h-10 mt-1 px-3 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4 shadow-card">
              <h4 className="text-xs font-medium text-neutral-500 uppercase mb-2">Service Charge</h4>
              <input
                type="number"
                min="0"
                value={serviceCharge}
                onChange={(event) => {
                  setSaved(false);
                  setServiceCharge(numberValue(event.target.value));
                }}
                className="w-full h-9 px-2 border border-neutral-200 rounded text-sm"
              />
              <p className="text-xs text-neutral-400 mt-1">Shop2Bhutan service charge</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-card">
              <h4 className="text-xs font-medium text-neutral-500 uppercase mb-2">Delivery Fee</h4>
              <input
                type="number"
                min="0"
                value={deliveryFee}
                onChange={(event) => {
                  setSaved(false);
                  setDeliveryFee(numberValue(event.target.value));
                }}
                className="w-full h-9 px-2 border border-neutral-200 rounded text-sm"
              />
              <p className="text-xs text-neutral-400 mt-1">{order.deliveryHub.name}</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-card">
              <h4 className="text-xs font-medium text-neutral-500 uppercase mb-2">Tax %</h4>
              <input
                type="number"
                min="0"
                value={taxPercent}
                onChange={(event) => {
                  setSaved(false);
                  setTaxPercent(numberValue(event.target.value));
                }}
                className="w-full h-9 px-2 border border-neutral-200 rounded text-sm"
              />
              <p className="text-xs text-neutral-400 mt-1">Set 0 if no tax is applied</p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-card">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Notes to Customer</h3>
            <textarea
              value={notes}
              onChange={(event) => {
                setSaved(false);
                setNotes(event.target.value);
              }}
              placeholder="Example: Price includes product cost, service charge, and delivery to selected hub."
              className="w-full h-24 p-3 border border-neutral-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl p-5 shadow-card h-fit sticky top-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Quotation Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Product Total</span>
                <span className="font-medium">Nu. {productTotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Service Charge</span>
                <span className="font-medium">Nu. {numberValue(serviceCharge).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Delivery Fee</span>
                <span className="font-medium">Nu. {numberValue(deliveryFee).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-600">Tax ({numberValue(taxPercent)}%)</span>
                <span className="font-medium">Nu. {taxAmount.toLocaleString()}</span>
              </div>
              <hr className="border-neutral-200" />
              <div className="flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="text-xl font-bold text-amber-600">Nu. {totalAmount.toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-4">
              <label className="text-xs font-medium text-neutral-500 uppercase">Valid For</label>
              <select
                value={validHours}
                onChange={(event) => setValidHours(Number(event.target.value))}
                className="w-full h-9 mt-1 px-2 border border-neutral-200 rounded text-sm bg-white"
              >
                {validHourOptions.map((hours) => (
                  <option key={hours} value={hours}>
                    {hours} hours
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleSendQuotation}
              disabled={saving || items.length === 0}
              className="w-full h-11 mt-4 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {order.quotation ? 'Update & Send Quotation' : 'Send Quotation'}
            </button>

            <p className="text-[11px] text-neutral-400 mt-3 leading-relaxed">
              This writes to quotations.order_id using the order UUID only. Order number #{order.orderNumber} is display only.
            </p>
          </div>

          {previewOpen && (
            <div className="bg-violet-50 rounded-xl p-5 border border-violet-100">
              <h3 className="text-sm font-semibold text-violet-800 mb-3">Customer Preview</h3>
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.orderItemId} className="flex justify-between gap-3 text-sm">
                    <span className="text-violet-700 line-clamp-1">
                      {item.productName} x{item.quantity}
                    </span>
                    <span className="font-semibold text-violet-900 whitespace-nowrap">
                      Nu. {(numberValue(item.quotedUnitPrice) * Math.max(1, Number(item.quantity) || 1)).toLocaleString()}
                    </span>
                  </div>
                ))}
                <hr className="border-violet-200" />
                <div className="flex justify-between text-sm">
                  <span className="text-violet-700">Grand Total</span>
                  <span className="font-bold text-violet-900">Nu. {totalAmount.toLocaleString()}</span>
                </div>
                <p className="text-xs text-violet-600 pt-2">Customer will review this in /quotation/{order.id} and then upload payment.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
