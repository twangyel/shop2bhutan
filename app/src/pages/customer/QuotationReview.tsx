import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Check,
  ChevronRight,
  Clock,
  CreditCard,
  ExternalLink,
  FileText,
  Info,
  MessageSquareText,
  ShieldCheck,
  Truck,
  X,
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
      badge: 'Quotation Approved',
      badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
      eyebrow: 'QUOTATION ACCEPTED',
      title: 'Ready for payment',
      subtitle: 'Your quotation is accepted. Continue to payment when ready.',
      statusLabel: 'Approved',
      iconClass: 'text-emerald-500',
      icon: <Check size={30} strokeWidth={2.4} />,
    };
  }

  if (quotation.status === 'rejected') {
    return {
      badge: 'Changes Requested',
      badgeClass: 'bg-red-50 text-red-700 ring-red-100',
      eyebrow: 'QUOTATION RESPONSE',
      title: 'Quotation declined',
      subtitle: 'This quotation was marked as needing changes.',
      statusLabel: 'Declined',
      iconClass: 'text-red-500',
      icon: <X size={30} strokeWidth={2.4} />,
    };
  }

  if (quotation.status === 'expired') {
    return {
      badge: 'Quotation Expired',
      badgeClass: 'bg-red-50 text-red-700 ring-red-100',
      eyebrow: 'QUOTATION STATUS',
      title: 'Quotation expired',
      subtitle: 'Please contact Shop2Bhutan for an updated quotation.',
      statusLabel: 'Expired',
      iconClass: 'text-red-500',
      icon: <X size={30} strokeWidth={2.4} />,
    };
  }

  return {
    badge: quotation.status === 'pending' ? 'Preparing Quote' : 'Quotation Ready',
    badgeClass:
      quotation.status === 'pending'
        ? 'bg-amber-50 text-amber-700 ring-amber-100'
        : 'bg-violet-50 text-violet-700 ring-violet-100',
    eyebrow: quotation.status === 'pending' ? 'QUOTATION IN REVIEW' : 'FINAL QUOTATION',
    title: quotation.status === 'pending' ? 'Quotation pending' : 'Review your quotation',
    subtitle:
      quotation.status === 'pending'
        ? 'Shop2Bhutan is finalizing your product and delivery charges.'
        : 'Check the items and complete price breakdown before accepting.',
    statusLabel: quotation.status === 'pending' ? 'Pending' : 'Awaiting approval',
    iconClass: quotation.status === 'pending' ? 'text-amber-500' : 'text-violet-500',
    icon:
      quotation.status === 'pending' ? (
        <Clock size={30} strokeWidth={2.4} />
      ) : (
        <FileText size={30} strokeWidth={2.2} />
      ),
  };
}

function sourceForItem(order: Order, item: QuotationItem) {
  const fromOrder = order.items.find((orderItem) => orderItem.id === item.orderItemId);

  return {
    sourceUrl: item.sourceUrl || fromOrder?.sourceUrl || '',
    sourcePlatform: item.sourcePlatform || fromOrder?.sourcePlatform || '',
    productImage: item.productImage || fromOrder?.productImage || '',
    screenshotUrl: item.screenshotUrl || fromOrder?.screenshotUrl || '',
  };
}

function canShowSourceLink(url?: string) {
  return Boolean(url && /^https?:\/\//i.test(url));
}

function canShowImageUrl(url?: string) {
  return Boolean(url && /^(https?:|data:|blob:)/i.test(url));
}

const QUOTATION_IMAGE_FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="22" fill="#f9fafb"/><rect x="32" y="36" width="96" height="88" rx="18" fill="#ffffff" stroke="#e5e7eb" stroke-width="2"/><path d="M56 94l18-20 14 15 9-10 18 21" fill="none" stroke="#cbd5e1" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="61" cy="59" r="7" fill="#fdba74"/><text x="80" y="139" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#94a3b8">S2B</text></svg>`,
  );

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
      console.error('Failed to load quotation:', err);
      setError(err instanceof Error ? err.message : 'Unable to load quotation.');
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
      setError('Please briefly explain what should be changed in the quotation.');
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
      console.error('Failed to request quotation revision:', err);
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
      console.error('Failed to accept quotation:', err);
      setError(err instanceof Error ? err.message : 'Unable to accept quotation.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!authLoading && !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
        <p className="mb-4 text-gray-500">Please sign in to view your quotation.</p>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="h-11 rounded-2xl bg-orange-500 px-5 text-sm font-semibold text-white"
        >
          Sign In
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white pb-28">
        <div className="border-b border-gray-100 bg-white px-5 py-4">
          <div className="mx-auto max-w-2xl">
            <div className="h-3 w-24 animate-pulse rounded-full bg-gray-100" />
            <div className="mt-3 h-7 w-44 animate-pulse rounded-xl bg-gray-100" />
            <div className="mt-2 h-3 w-36 animate-pulse rounded-full bg-gray-100" />
          </div>
        </div>
        <div className="mx-auto max-w-2xl space-y-5 px-5 py-5">
          <div className="h-60 animate-pulse rounded-[2rem] bg-gray-100" />
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-40 animate-pulse rounded-[1.75rem] bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (!order || !quotation || !display) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
        <p className="mb-4 text-gray-500">{error || 'Quotation not found'}</p>
        <button
          type="button"
          onClick={() => navigate('/orders')}
          className="h-11 rounded-2xl bg-orange-500 px-5 text-sm font-semibold text-white"
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
  const itemCount = quotation.items.reduce(
    (total, item) => total + Math.max(1, Number(item.quantity) || 1),
    0,
  );
  const advanceAmount = Math.ceil(quotation.totalAmount * 0.5);
  const nextSteps = isJaigaonPickup
    ? [
        'Accept this quotation',
        'Pay Shop2Bhutan charges in full',
        'Coordinate product pickup at Jaigaon',
        'Track your order from your account',
      ]
    : [
        'Accept this quotation',
        'Upload your payment screenshot',
        'Shop2Bhutan places the seller order',
        'Track every update from your account',
      ];

  return (
    <div className="min-h-screen bg-white pb-[calc(8.5rem+env(safe-area-inset-bottom))]">
      <header className="border-b border-gray-100 bg-white px-5 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-orange-500">
              Quotation
            </p>
            <h1 className="mt-1 text-[1.45rem] font-black tracking-tight text-gray-950">
              Review Quotation
            </h1>
            <p className="mt-1 truncate text-sm font-medium text-gray-400">#{order.orderNumber}</p>
          </div>

          <span
            className={`shrink-0 rounded-full px-3.5 py-2 text-[11px] font-extrabold ring-1 ${display.badgeClass}`}
          >
            {display.badge}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-5 py-5 scroll-pb-44">
        {error && (
          <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-600">
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-[1.85rem] bg-[#050713] text-white shadow-[0_18px_42px_rgba(5,7,19,0.16)]">
          <div className="px-5 pb-4 pt-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">
                  {display.eyebrow}
                </p>
                <h2 className="mt-2.5 max-w-[13rem] text-[1.5rem] font-black leading-tight tracking-tight text-white">
                  {display.title}
                </h2>
                <p className="mt-2.5 max-w-[16rem] text-[13px] leading-[1.4rem] text-gray-400">
                  {display.subtitle}
                </p>
              </div>

              <span
                className={`flex h-[4.2rem] w-[4.2rem] shrink-0 items-center justify-center rounded-[1.4rem] bg-white ${display.iconClass}`}
              >
                {display.icon}
              </span>
            </div>

            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-500">
                {isJaigaonPickup ? 'Payable to Shop2Bhutan' : 'Total payable'}
              </p>
              <div className="mt-2 flex items-end justify-between gap-4">
                <p className="text-[1.9rem] font-black tracking-tight text-white">
                  {money(quotation.totalAmount)}
                </p>
                <span className="mb-1 rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-bold text-gray-200 ring-1 ring-white/10">
                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 border-t border-white/10 bg-white/[0.04]">
            <div className="px-5 py-3.5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Status</p>
              <p className="mt-1 text-sm font-bold text-white">{display.statusLabel}</p>
            </div>
            <div className="border-l border-white/10 px-5 py-3.5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
                Valid until
              </p>
              <p className="mt-1 text-sm font-bold text-white">{validUntil || 'No expiry set'}</p>
            </div>
          </div>
        </section>

        <section className="mt-7">
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-500">
                Price details
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-gray-950">Price breakdown</h2>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1.5 text-[11px] font-bold text-gray-600">
              Final
            </span>
          </div>

          <div className="overflow-hidden rounded-[1.75rem] border border-gray-100 bg-white shadow-sm">
            <div className="space-y-4 px-5 py-5">
              <div>
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-gray-500">
                    {isJaigaonPickup ? 'Product value (reference)' : 'Product total'}
                  </span>
                  <span className="font-extrabold text-gray-950">{money(quotation.productTotal)}</span>
                </div>
                {isJaigaonPickup && (
                  <p className="mt-1.5 text-[11px] leading-5 text-gray-400">
                    Product value is paid directly during Jaigaon pickup and is not included below.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-gray-500">Service charge</span>
                <span className="font-extrabold text-gray-950">{money(quotation.serviceCharge)}</span>
              </div>

              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-gray-500">Delivery fee</span>
                <span className="font-extrabold text-gray-950">{money(quotation.deliveryFee)}</span>
              </div>

              {quotation.taxAmount > 0 && (
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-gray-500">Tax</span>
                  <span className="font-extrabold text-gray-950">{money(quotation.taxAmount)}</span>
                </div>
              )}

              {(quotation.additionalChargeAmount ?? 0) > 0 && (
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-gray-500">
                    {quotation.additionalChargeLabel || 'Additional charge'}
                  </span>
                  <span className="font-extrabold text-gray-950">
                    {money(quotation.additionalChargeAmount)}
                  </span>
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-gray-200 bg-gray-50 px-5 py-5">
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-black text-gray-950">
                    {isJaigaonPickup ? 'Payable to Shop2Bhutan' : 'Total payable'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    {isJaigaonPickup
                      ? 'Shop2Bhutan charges only. No Bhutan delivery fee.'
                      : 'Final quoted amount with no hidden charges.'}
                  </p>
                </div>
                <p className="shrink-0 whitespace-nowrap text-2xl font-black tracking-tight text-gray-950">
                  {money(quotation.totalAmount)}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-7">
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-500">
                Products
              </p>
              <h2 className="mt-1 text-xl font-black tracking-tight text-gray-950">Quoted items</h2>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1.5 text-[11px] font-bold text-gray-600">
              {quotation.items.length} {quotation.items.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          <div className="overflow-hidden rounded-[1.75rem] border border-gray-100 bg-white shadow-sm">
            {quotation.items.map((item, index) => {
              const source = sourceForItem(order, item);
              const hasSourceLink = canShowSourceLink(source.sourceUrl);
              const displayImageUrl =
                [item.productImage, source.productImage, source.screenshotUrl].find((url) => canShowImageUrl(url)) ||
                QUOTATION_IMAGE_FALLBACK;

              return (
                <div
                  key={item.id}
                  className={`p-4 ${index > 0 ? 'border-t border-gray-100' : ''}`}
                >
                  <div className="flex gap-3.5">
                    <img
                      src={displayImageUrl}
                      alt={item.productName || 'Quoted product'}
                      className="h-[5.25rem] w-[5.25rem] shrink-0 rounded-[1.45rem] bg-gray-50 object-cover ring-1 ring-gray-100"
                      loading="lazy"
                      onError={(event) => {
                        const image = event.currentTarget;
                        if (image.src !== QUOTATION_IMAGE_FALLBACK) {
                          image.src = QUOTATION_IMAGE_FALLBACK;
                        }
                      }}
                    />

                    <div className="min-w-0 flex-1 py-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {source.sourcePlatform && (
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-gray-600">
                            {source.sourcePlatform}
                          </span>
                        )}
                        <span className="text-xs font-medium text-gray-400">Qty {item.quantity}</span>
                      </div>

                      <p className="mt-2 line-clamp-2 text-sm font-extrabold leading-5 text-gray-950">
                        {item.productName}
                      </p>

                      <div className="mt-2 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                            Unit price
                          </p>
                          <p className="mt-0.5 text-sm font-bold text-gray-600">{money(item.unitPrice)}</p>
                        </div>
                        <p className="shrink-0 text-base font-black text-gray-950">{money(item.totalPrice)}</p>
                      </div>
                    </div>
                  </div>

                  {(hasSourceLink || item.notes) && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
                      {hasSourceLink && (
                        <a
                          href={source.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-600 ring-1 ring-blue-100"
                          onClick={(event) => event.stopPropagation()}
                        >
                          Source <ExternalLink size={12.5} />
                        </a>
                      )}

                      {item.notes && (
                        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-gray-50 px-3 py-1.5 text-xs text-gray-600 ring-1 ring-gray-100">
                          <Info size={12.5} className="shrink-0" />
                          <span className="truncate">{item.notes}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-7">
          <div className="mb-3 px-1">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-500">
              Payment choice
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-gray-950">How you can pay</h2>
          </div>

          <div className={`grid gap-2.5 ${isJaigaonPickup ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <div className="rounded-[1.35rem] border border-orange-100 bg-orange-50/60 p-3 ring-1 ring-orange-50">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-orange-500 ring-1 ring-orange-100">
                  <CreditCard size={15.5} />
                </span>
                <p className="text-[11px] font-extrabold leading-4 text-gray-600">
                  {isJaigaonPickup ? 'Full charges' : 'Full payment'}
                </p>
              </div>
              <p className="mt-2.5 text-base font-black tracking-tight text-gray-950">
                {money(quotation.totalAmount)}
              </p>
              <p className="mt-1 text-[10px] leading-4 text-gray-500">
                {isJaigaonPickup ? 'Required for Jaigaon pickup.' : 'Pay the complete quotation now.'}
              </p>
            </div>

            {!isJaigaonPickup && (
              <div className="rounded-[1.35rem] border border-violet-100 bg-violet-50/60 p-3 ring-1 ring-violet-50">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-violet-500 ring-1 ring-violet-100">
                    <CreditCard size={15.5} />
                  </span>
                  <p className="text-[11px] font-extrabold leading-4 text-gray-600">50% advance</p>
                </div>
                <p className="mt-2.5 text-base font-black tracking-tight text-gray-950">
                  {money(advanceAmount)}
                </p>
                <p className="mt-1 text-[10px] leading-4 text-gray-500">
                  Start after verification; pay the balance later.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-7">
          <div className="mb-3 px-1">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-500">
              Included service
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-gray-950">What the charges cover</h2>
          </div>

          <div className="overflow-hidden rounded-[1.75rem] border border-gray-100 bg-white shadow-sm">
            <div className="flex gap-3.5 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                <ShieldCheck size={18} />
              </span>
              <div>
                <p className="text-sm font-extrabold text-gray-950">Service charge</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  Product verification, sourcing, coordination, order support, and customer updates.
                </p>
              </div>
            </div>

            <div className="flex gap-3.5 border-t border-gray-100 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                <Truck size={18} />
              </span>
              <div>
                <p className="text-sm font-extrabold text-gray-950">Delivery fee</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  {isJaigaonPickup
                    ? 'No Bhutan delivery fee is charged for direct Jaigaon pickup.'
                    : 'Charged once per quotation or request bag, not once per item.'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-7">
          <div className="mb-3 px-1">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-500">
              Next steps
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-gray-950">What happens next?</h2>
          </div>

          <div className="rounded-[1.75rem] border border-gray-100 bg-white px-5 py-2 shadow-sm">
            {nextSteps.map((step, index) => (
              <div
                key={step}
                className={`flex items-center gap-3.5 py-3.5 ${index > 0 ? 'border-t border-gray-100' : ''}`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-950 text-[11px] font-black text-white">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 text-sm font-semibold text-gray-700">{step}</span>
                {index === 0 && canRespond && (
                  <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-orange-600">
                    Now
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {!canRespond && !isApproved && (
          <button
            type="button"
            onClick={() => navigate(`/order/${order.id}`)}
            className="mt-6 flex h-14 w-full items-center justify-between rounded-2xl bg-gray-50 px-4 text-left ring-1 ring-gray-100"
          >
            <span>
              <span className="block text-sm font-extrabold text-gray-950">View order details</span>
              <span className="mt-0.5 block text-xs text-gray-500">Return to the complete order journey</span>
            </span>
            <ChevronRight size={20} className="text-gray-400" />
          </button>
        )}
      </main>

      {canRespond && !showRejectDialog && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white/95 px-4 pt-2.5 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="mx-auto flex max-w-2xl gap-2.5">
            <button
              type="button"
              onClick={handleReject}
              disabled={submitting}
              className="h-12 flex-1 rounded-2xl bg-gray-100 px-3 text-sm font-extrabold text-gray-700 transition active:scale-[0.98] disabled:opacity-50"
            >
              Request Changes
            </button>
            <button
              type="button"
              onClick={handleAccept}
              disabled={submitting}
              className="flex h-12 flex-[1.55] items-center justify-center gap-1.5 rounded-2xl bg-orange-500 px-4 text-sm font-extrabold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? 'Processing...' : 'Accept & Continue'}
              {!submitting && <ChevronRight size={17} />}
            </button>
          </div>
        </div>
      )}

      {isApproved && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white/95 px-4 pt-2.5 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="mx-auto max-w-2xl">
            <button
              type="button"
              onClick={() => navigate(`/payment/${order.id}`)}
              className="flex h-12 w-full items-center justify-between rounded-2xl bg-orange-500 px-4 text-sm font-extrabold text-white transition active:scale-[0.99]"
            >
              <span>Continue to Payment</span>
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {showRejectDialog && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/50 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-10 backdrop-blur-[2px] sm:items-center sm:pb-10">
          <div className="max-h-[calc(100dvh-1.5rem)] w-full max-w-sm overflow-y-auto rounded-[2rem] bg-white shadow-2xl ring-1 ring-black/5">
            <div className="px-5 pb-5 pt-3">
              <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-gray-200" />

              <div className="flex items-start gap-3.5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 ring-1 ring-violet-100">
                  <MessageSquareText size={22} />
                </span>
                <div>
                  <h3 className="text-xl font-black tracking-tight text-gray-950">Request quotation changes</h3>
                  <p className="mt-1.5 text-sm leading-6 text-gray-500">
                    Tell Shop2Bhutan what should be corrected so the admin can prepare and resend a revised quotation.
                  </p>
                </div>
              </div>

              <label className="mt-5 block">
                <span className="text-xs font-extrabold text-gray-700">What needs to change?</span>
                <textarea
                  value={rejectRemark}
                  onChange={(event) => {
                    setRejectRemark(event.target.value.slice(0, 500));
                    if (error) setError('');
                  }}
                  rows={4}
                  autoFocus
                  placeholder="Example: Please recheck the product price and remove the second item."
                  className="mt-2 w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-50"
                />
                <div className="mt-1.5 flex items-center justify-between gap-3">
                  <span className="text-[11px] text-gray-400">Required · minimum 5 characters</span>
                  <span className="text-[11px] font-semibold text-gray-400">{rejectRemark.length}/500</span>
                </div>
              </label>

              {error && (
                <div className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-3.5 py-3 text-xs leading-5 text-red-600">
                  {error}
                </div>
              )}

              <div className="mt-4 rounded-2xl bg-violet-50 px-4 py-3 text-xs leading-5 text-violet-700 ring-1 ring-violet-100">
                The current quotation will be marked for revision, your order will return to “Waiting for Quotation,” and all admins will receive this remark with a direct link to the order.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-gray-100 bg-gray-50 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowRejectDialog(false);
                  setError('');
                }}
                disabled={submitting}
                className="h-12 rounded-2xl bg-white text-sm font-extrabold text-gray-700 ring-1 ring-gray-200 transition active:scale-[0.98] disabled:opacity-50"
              >
                Keep Quotation
              </button>
              <button
                type="button"
                onClick={confirmReject}
                disabled={submitting || rejectRemark.trim().length < 5}
                className="h-12 rounded-2xl bg-violet-600 px-3 text-sm font-extrabold text-white transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
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
