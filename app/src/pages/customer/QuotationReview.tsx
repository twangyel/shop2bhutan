import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Check,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Info,
  MessageSquareText,
  X,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  acceptCustomerQuotation,
  fetchCustomerOrderById,
} from '@/lib/customerOrders';
import { isJaigaonPickupOrder } from '@/lib/fulfillment';
import type { Order, Quotation, QuotationItem } from '@/types';

function money(value?: number) {
  return `Nu. ${Number(value ?? 0).toLocaleString()}`;
}

function readableDate(value?: string) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function quotationDisplay(quotation: Quotation) {
  if (quotation.status === 'approved') {
    return {
      badge: 'Price Confirmed',
      badgeClass: 'bg-emerald-50 text-emerald-600',
      eyebrow: 'FINAL PRICE CONFIRMED',
      title: 'Ready for payment',
      subtitle: 'Your final price is confirmed. Continue to payment when ready.',
      statusLabel: 'Confirmed',
      iconClass: 'text-emerald-500',
      icon: <Check size={28} strokeWidth={2.4} />,
    };
  }

  if (quotation.status === 'rejected') {
    return {
      badge: 'Changes Requested',
      badgeClass: 'bg-red-50 text-red-600',
      eyebrow: 'PRICE REVIEW',
      title: 'Changes requested',
      subtitle: 'Your requested corrections were sent to Shop2Bhutan for review.',
      statusLabel: 'Under revision',
      iconClass: 'text-red-500',
      icon: <X size={28} strokeWidth={2.4} />,
    };
  }

  if (quotation.status === 'expired') {
    return {
      badge: 'Price Expired',
      badgeClass: 'bg-red-50 text-red-600',
      eyebrow: 'FINAL PRICE STATUS',
      title: 'Final price expired',
      subtitle: 'Please contact Shop2Bhutan for an updated final price.',
      statusLabel: 'Expired',
      iconClass: 'text-red-500',
      icon: <X size={28} strokeWidth={2.4} />,
    };
  }

  return {
    badge:
      quotation.status === 'pending'
        ? 'Checking Details'
        : 'Final Price Ready',
    badgeClass:
      quotation.status === 'pending'
        ? 'bg-amber-50 text-amber-600'
        : 'bg-orange-50 text-orange-600',
    eyebrow:
      quotation.status === 'pending'
        ? 'AVAILABILITY & PRICE CHECK'
        : 'FINAL PRICE READY',
    title:
      quotation.status === 'pending'
        ? 'Checking your request'
        : 'Review final price',
    subtitle:
      quotation.status === 'pending'
        ? 'Shop2Bhutan is confirming availability, selected options, product prices, and delivery charges.'
        : 'Availability is confirmed. Review the items and complete price breakdown before payment.',
    statusLabel:
      quotation.status === 'pending'
        ? 'Checking'
        : 'Awaiting confirmation',
    iconClass:
      quotation.status === 'pending'
        ? 'text-amber-500'
        : 'text-orange-500',
    icon:
      quotation.status === 'pending' ? (
        <Clock size={28} strokeWidth={2.4} />
      ) : (
        <FileText size={28} strokeWidth={2.2} />
      ),
  };
}

type PreviewableQuotationItem = QuotationItem & {
  attachmentPath?: string;
};

type PreviewableOrderItem = Order['items'][number] & {
  screenshotUrl?: string;
  attachmentPath?: string;
};

type QuotationItemSource = {
  sourceUrl: string;
  sourcePlatform: string;
  productImage: string;
  screenshotUrl: string;
  attachmentPath: string;
};

function sourceForItem(
  order: Order,
  item: PreviewableQuotationItem,
  index: number,
): QuotationItemSource {
  const exactOrderItem = order.items.find(
    (orderItem) => orderItem.id === item.orderItemId,
  ) as PreviewableOrderItem | undefined;
  const indexedOrderItem = order.items[index] as PreviewableOrderItem | undefined;
  const fromOrder = exactOrderItem ?? indexedOrderItem;

  const itemProductImage = item.productImage?.trim() || '';
  const originalProductImage = fromOrder?.productImage?.trim() || '';

  return {
    sourceUrl: item.sourceUrl || fromOrder?.sourceUrl || '',
    sourcePlatform: item.sourcePlatform || fromOrder?.sourcePlatform || '',
    productImage:
      itemProductImage && !isGeneratedFallbackImage(itemProductImage)
        ? itemProductImage
        : originalProductImage || itemProductImage,
    screenshotUrl: item.screenshotUrl || fromOrder?.screenshotUrl || '',
    attachmentPath: item.attachmentPath || fromOrder?.attachmentPath || '',
  };
}

function canShowSourceLink(url?: string) {
  return Boolean(url && /^https?:\/\//i.test(url.trim()));
}

function canShowImageUrl(url?: string) {
  return Boolean(url && /^(https?:|data:|blob:)/i.test(url.trim()));
}

function isGeneratedFallbackImage(url?: string) {
  const cleanUrl = url?.trim() || '';
  return cleanUrl.startsWith('data:image/svg+xml') && cleanUrl.includes('S2B');
}

function cleanStoragePath(value?: string) {
  const cleanValue = value?.trim().replace(/^\/+/, '') || '';
  return cleanValue.replace(/^order-screenshots\//i, '');
}

const QUOTATION_IMAGE_FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="22" fill="#f9fafb"/><rect x="32" y="36" width="96" height="88" rx="18" fill="#ffffff" stroke="#e5e7eb" stroke-width="2"/><path d="M56 94l18-20 14 15 9-10 18 21" fill="none" stroke="#cbd5e1" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="61" cy="59" r="7" fill="#fdba74"/><text x="80" y="139" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#94a3b8">S2B</text></svg>`,
  );

function QuotationItemPreviewImage({
  source,
  productName,
}: {
  source: QuotationItemSource;
  productName: string;
}) {
  const initialImage =
    [source.screenshotUrl, source.productImage].find(
      (url) => canShowImageUrl(url) && !isGeneratedFallbackImage(url),
    ) || QUOTATION_IMAGE_FALLBACK;
  const [imageSrc, setImageSrc] = useState(initialImage);

  useEffect(() => {
    let active = true;

    async function loadPreview() {
      const directScreenshot = canShowImageUrl(source.screenshotUrl)
        ? source.screenshotUrl.trim()
        : '';
      const directProductImage =
        canShowImageUrl(source.productImage) &&
        !isGeneratedFallbackImage(source.productImage)
          ? source.productImage.trim()
          : '';

      if (directScreenshot) {
        if (active) setImageSrc(directScreenshot);
        return;
      }

      const rawStoragePath =
        source.attachmentPath ||
        (!canShowImageUrl(source.screenshotUrl) ? source.screenshotUrl : '') ||
        (!canShowImageUrl(source.productImage) &&
        !isGeneratedFallbackImage(source.productImage)
          ? source.productImage
          : '');
      const storagePath = cleanStoragePath(rawStoragePath);

      if (storagePath) {
        const { data, error: signedUrlError } = await supabase.storage
          .from('order-screenshots')
          .createSignedUrl(storagePath, 60 * 30);

        if (!active) return;

        if (!signedUrlError && data?.signedUrl) {
          setImageSrc(data.signedUrl);
          return;
        }

        if (signedUrlError) {
          console.warn(
            '[QuotationReview] Product screenshot preview skipped:',
            signedUrlError.message,
          );
        }
      }

      if (active) {
        setImageSrc(directProductImage || QUOTATION_IMAGE_FALLBACK);
      }
    }

    void loadPreview();

    return () => {
      active = false;
    };
  }, [
    source.attachmentPath,
    source.productImage,
    source.screenshotUrl,
  ]);

  return (
    <img
      src={imageSrc || QUOTATION_IMAGE_FALLBACK}
      alt={productName || 'Quoted product'}
      className="h-13 w-13 shrink-0 rounded-xl bg-gray-50 object-cover"
      loading="lazy"
      onError={(event) => {
        const image = event.currentTarget;
        if (image.src !== QUOTATION_IMAGE_FALLBACK) {
          image.src = QUOTATION_IMAGE_FALLBACK;
        }
      }}
    />
  );
}

export default function QuotationReview() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectRemark, setRejectRemark] = useState('');
  const [error, setError] = useState('');

  const loadOrder = useCallback(async () => {
    if (!orderId || !user) {
      setOrder(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const realOrder = await fetchCustomerOrderById(orderId, user.id, user.email ?? '');
      setOrder(realOrder);
    } catch (err) {
      console.error('Failed to load final price:', err);
      setError(err instanceof Error ? err.message : 'Unable to load final price.');
    } finally {
      setLoading(false);
    }
  }, [orderId, user]);

  useEffect(() => {
    if (!authLoading) {
      void loadOrder();
    }
  }, [authLoading, loadOrder]);

  const quotation = order?.quotation;
  const display = useMemo(() => (quotation ? quotationDisplay(quotation) : null), [quotation]);

  const handleReject = () => {
    if (!quotation || submitting) return;
    setRejectRemark('');
    setError('');
    setShowRejectDialog(true);
  };

  const confirmReject = async () => {
    if (!quotation || !order) return;

    const cleanRemark = rejectRemark.trim();
    if (cleanRemark.length < 5) {
      setError('Please briefly explain what should be changed in the final price.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const { error: revisionError } = await supabase.rpc('request_quotation_revision', {
        p_quotation_id: quotation.id,
        p_remark: cleanRemark,
      });

      if (revisionError) throw revisionError;

      setShowRejectDialog(false);
      navigate(`/order/${order.id}`, { replace: true });
    } catch (err) {
      console.error('Failed to request final price revision:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to send your revision request. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccept = async () => {
    if (!quotation || !order) return;

    setSubmitting(true);
    setError('');

    try {
      await acceptCustomerQuotation({
        orderId: order.id,
        quotationId: quotation.id,
      });

      navigate(`/payment/${order.id}`);
    } catch (err) {
      console.error('Failed to confirm final price:', err);
      setError(err instanceof Error ? err.message : 'Unable to confirm final price.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!authLoading && !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
          <FileText size={28} strokeWidth={2} />
        </div>
        <h1 className="mt-5 text-xl font-bold text-gray-900">Sign in to view</h1>
        <p className="mt-2 text-sm text-gray-500">Please sign in to view your final price.</p>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="mt-6 h-12 rounded-xl bg-orange-500 px-6 text-sm font-bold text-white transition active:scale-[0.98]"
        >
          Sign In
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="border-b border-gray-100 px-5 py-4">
          <div className="mx-auto max-w-2xl">
            <div className="h-3 w-24 animate-pulse rounded-full bg-gray-100" />
            <div className="mt-3 h-7 w-44 animate-pulse rounded-xl bg-gray-100" />
            <div className="mt-2 h-3 w-36 animate-pulse rounded-full bg-gray-100" />
          </div>
        </div>
        <div className="mx-auto max-w-2xl space-y-5 px-5 py-5">
          <div className="h-40 animate-pulse rounded-xl bg-gray-50" />
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-xl bg-gray-50" />
          ))}
        </div>
      </div>
    );
  }

  if (!order || !quotation || !display) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-500">
          <X size={28} strokeWidth={2} />
        </div>
        <h1 className="mt-5 text-xl font-bold text-gray-900">Not found</h1>
        <p className="mt-2 text-sm text-gray-500">{error || 'Final price not found'}</p>
        <button
          type="button"
          onClick={() => navigate('/orders')}
          className="mt-6 h-12 rounded-xl bg-orange-500 px-6 text-sm font-bold text-white transition active:scale-[0.98]"
        >
          Back to Orders
        </button>
      </div>
    );
  }

  const canRespond = ['pending', 'sent'].includes(quotation.status);
  const isApproved = quotation.status === 'approved';
  const isJaigaonPickup = isJaigaonPickupOrder(order);
  const validUntil = readableDate(quotation.validUntil);
 

  return (
    <div className="min-h-screen bg-white pb-[calc(6rem+env(safe-area-inset-bottom))]">
      {/* Header */}
      <header className="border-b border-gray-100 px-5 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/order/${order.id}`)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-700 transition active:scale-95"
            aria-label="Back"
          >
            <ArrowLeft size={20} strokeWidth={2.2} />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Review Final Price</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-6">
        {error && (
          <div className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {error}
          </div>
        )}

        {/* Status + Order */}
        <div className="mb-5 flex items-center gap-3">
          <span className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${display.badgeClass}`}>
            {display.badge}
          </span>
          <span className="text-[13px] text-gray-400">#{order.orderNumber}</span>
        </div>

        {/* Total */}
        <div className="mb-8">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-gray-400">
            {isJaigaonPickup ? 'Payable to Shop2Bhutan' : 'Total Payable'}
          </p>
          <p className="mt-1 text-[38px] font-extrabold tracking-tight text-gray-900">
            {money(quotation.totalAmount)}
          </p>
          <div className="mt-2.5 flex items-center gap-3">
            {quotation.status !== 'pending' && (
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-600">
                <Check size={15} strokeWidth={2.5} />
                Price confirmed
              </span>
            )}
            {quotation.status === 'pending' && (
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-600">
                <Clock size={15} strokeWidth={2.5} />
                Checking availability
              </span>
            )}
            <span className="h-2.5 w-px bg-gray-200" />
            <span className="text-[12px] text-gray-400">Valid until {validUntil || 'No expiry set'}</span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-100 mb-7" />

        {/* Price Breakdown */}
        <h2 className="mb-4 text-[15px] font-bold text-gray-900">Price Breakdown</h2>

        <div className="mb-8">
          <div className="flex items-center justify-between py-2">
            <span className="text-[14px] font-medium text-gray-500">
              {isJaigaonPickup ? 'Product value (reference)' : 'Product total'}
            </span>
            <span className="text-[14px] font-bold text-gray-700">{money(quotation.productTotal)}</span>
          </div>
          {isJaigaonPickup && (
            <p className="text-[11px] leading-relaxed text-gray-400 -mt-1 mb-2">
              Product value is paid directly during Jaigaon pickup and is not included below.
            </p>
          )}
          <div className="flex items-center justify-between py-2">
            <span className="text-[14px] font-medium text-gray-500">Service charge</span>
            <span className="text-[14px] font-bold text-gray-700">{money(quotation.serviceCharge)}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-[14px] font-medium text-gray-500">Delivery fee</span>
            <span className="text-[14px] font-bold text-gray-700">{money(quotation.deliveryFee)}</span>
          </div>
          {quotation.taxAmount > 0 && (
            <div className="flex items-center justify-between py-2">
              <span className="text-[14px] font-medium text-gray-500">Tax</span>
              <span className="text-[14px] font-bold text-gray-700">{money(quotation.taxAmount)}</span>
            </div>
          )}
          {(quotation.additionalChargeAmount ?? 0) > 0 && (
            <div className="flex items-center justify-between py-2">
              <span className="text-[14px] font-medium text-gray-500">
                {quotation.additionalChargeLabel || 'Additional charge'}
              </span>
              <span className="text-[14px] font-bold text-gray-700">
                {money(quotation.additionalChargeAmount)}
              </span>
            </div>
          )}
          <div className="h-px bg-gray-100 my-2" />
          <div className="flex items-center justify-between pt-2">
            <span className="text-[15px] font-bold text-gray-900">
              {isJaigaonPickup ? 'Payable to Shop2Bhutan' : 'Total'}
            </span>
            <span className="text-[18px] font-extrabold text-gray-900">{money(quotation.totalAmount)}</span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-100 mb-7" />

        {/* Items */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-gray-900">Confirmed Items</h2>
          <span className="text-[12px] font-semibold text-gray-400">
            {quotation.items.length} {quotation.items.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        <div className="mb-8">
          {quotation.items.map((item, index) => {
            const source = sourceForItem(order, item, index);
            const hasSourceLink = canShowSourceLink(source.sourceUrl);

            return (
              <div key={item.id} className="flex gap-3.5 py-3.5 border-b border-gray-100 last:border-b-0">
                <QuotationItemPreviewImage
                  source={source}
                  productName={item.productName}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {source.sourcePlatform && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-500">
                        {source.sourcePlatform}
                      </span>
                    )}
                    <span className="text-[11px] text-gray-400">Qty {item.quantity}</span>
                  </div>

                  <p className="text-[14px] font-bold text-gray-900 leading-snug line-clamp-2">
                    {item.productName}
                  </p>

                  <div className="mt-1.5 flex items-end justify-between gap-3">
                    <span className="text-[12px] text-gray-400">
                      {money(item.unitPrice)} each
                    </span>
                    <span className="text-[14px] font-extrabold text-gray-900">
                      {money(item.totalPrice)}
                    </span>
                  </div>

                  {(hasSourceLink || item.notes) && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {hasSourceLink && (
                        <a
                          href={source.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-500"
                          onClick={(event) => event.stopPropagation()}
                        >
                          Source <ExternalLink size={11} />
                        </a>
                      )}
                      {item.notes && (
                        <span className="inline-flex max-w-full items-center gap-1 text-[11px] text-gray-500">
                          <Info size={11} className="shrink-0" />
                          <span className="truncate">{item.notes}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {!canRespond && !isApproved && (
          <button
            type="button"
            onClick={() => navigate(`/order/${order.id}`)}
            className="flex h-12 w-full items-center justify-between rounded-xl bg-gray-50 px-4 text-left transition active:scale-[0.99]"
          >
            <span>
              <span className="block text-sm font-bold text-gray-900">View order details</span>
              <span className="block text-xs text-gray-400">Return to the complete order journey</span>
            </span>
            <ChevronRight size={18} className="text-gray-400" />
          </button>
        )}
      </main>

      {/* Bottom Actions */}
      {canRespond && !showRejectDialog && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white px-5 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <div className="mx-auto flex max-w-2xl gap-3">
            <button
              type="button"
              onClick={handleReject}
              disabled={submitting}
              className="h-12 flex-1 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 transition active:scale-[0.98] disabled:opacity-50"
            >
              Request Changes
            </button>
            <button
              type="button"
              onClick={handleAccept}
              disabled={submitting}
              className="flex h-12 flex-[1.5] items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-4 text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? 'Processing...' : 'Confirm & Pay'}
              {!submitting && <ChevronRight size={17} />}
            </button>
          </div>
        </div>
      )}

      {isApproved && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white px-5 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <div className="mx-auto max-w-2xl">
            <button
              type="button"
              onClick={() => navigate(`/payment/${order.id}`)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 text-sm font-bold text-white transition active:scale-[0.98]"
            >
              Continue to Payment
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
      )}

      {/* Reject Dialog */}
      {showRejectDialog && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/50 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-10 backdrop-blur-[2px] sm:items-center sm:pb-10">
          <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-sm overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="px-5 pb-5 pt-4">
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />

              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <MessageSquareText size={20} />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Request Changes</h3>
                  <p className="mt-1 text-sm leading-relaxed text-gray-500">
                    Tell Shop2Bhutan what should be corrected so the final price can be reviewed and updated.
                  </p>
                </div>
              </div>

              <label className="mt-4 block">
                <span className="text-xs font-bold text-gray-700">What needs to change?</span>
                <textarea
                  value={rejectRemark}
                  onChange={(event) => {
                    setRejectRemark(event.target.value.slice(0, 500));
                    if (error) setError('');
                  }}
                  rows={4}
                  autoFocus
                  placeholder="Example: Please recheck the product price and remove the second item."
                  className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-violet-300 focus:bg-white"
                />
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="text-[11px] text-gray-400">Min 5 characters</span>
                  <span className="text-[11px] font-semibold text-gray-400">{rejectRemark.length}/500</span>
                </div>
              </label>

              {error && (
                <div className="mt-3 rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-600">
                  {error}
                </div>
              )}

              <div className="mt-3 rounded-xl bg-violet-50 px-4 py-3 text-xs leading-relaxed text-violet-700">
                The current final price will be marked for revision, your request will return to "Checking Availability," and the admin team will receive your remark.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-gray-100 px-4 py-4">
              <button
                type="button"
                onClick={() => {
                  setShowRejectDialog(false);
                  setError('');
                }}
                disabled={submitting}
                className="h-12 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-700 transition active:scale-[0.98] disabled:opacity-50"
              >
                Keep Final Price
              </button>
              <button
                type="button"
                onClick={confirmReject}
                disabled={submitting || rejectRemark.trim().length < 5}
                className="h-12 rounded-xl bg-violet-600 px-3 text-sm font-bold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
