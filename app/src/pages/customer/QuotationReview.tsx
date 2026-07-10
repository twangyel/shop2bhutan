import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
 AlertTriangle,
 Check,
 Clock,
 CreditCard,
 ExternalLink,
 FileText,
 Info,
 PackageCheck,
 ShieldCheck,
 Truck,
 X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
 acceptCustomerQuotation,
 fetchCustomerOrderById,
 updateQuotationStatus,
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
 return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function quotationDisplay(quotation: Quotation) {
 if (quotation.status === 'approved') {
 return {
 card: 'border-gray-100 bg-white shadow-sm',
 accent: 'text-emerald-600',
 iconBg: 'bg-emerald-500',
 icon: <Check size={19} className="text-white" />,
 eyebrow: 'Verified quotation accepted',
 title: 'Quotation approved',
 subtitle: 'Upload your payment screenshot to continue.',
 };
 }

 if (quotation.status === 'rejected') {
 return {
 card: 'border-gray-100 bg-white shadow-sm',
 accent: 'text-red-600',
 iconBg: 'bg-red-500',
 icon: <X size={19} className="text-white" />,
 eyebrow: 'Quotation response recorded',
 title: 'Quotation rejected',
 subtitle: 'This quotation has been rejected.',
 };
 }

 if (quotation.status === 'expired') {
 return {
 card: 'border-gray-100 bg-white shadow-sm',
 accent: 'text-red-600',
 iconBg: 'bg-red-500',
 icon: <X size={19} className="text-white" />,
 eyebrow: 'Quotation expired',
 title: 'Quotation expired',
 subtitle: 'Please contact support for a fresh quotation.',
 };
 }

 return {
 card: 'border-gray-100 bg-white shadow-sm',
 accent: 'text-orange-600',
 iconBg: 'bg-orange-500',
 icon: <Clock size={19} className="text-white" />,
 eyebrow: 'Reviewed by Shop2Bhutan',
 title: quotation.status === 'pending' ? 'Quotation pending' : 'Quotation ready',
 subtitle: quotation.validUntil
 ? `Valid until ${readableDate(quotation.validUntil)}`
 : 'Review the price breakdown before accepting.',
 };
}

function sourceForItem(order: Order, item: QuotationItem) {
 const fromOrder = order.items.find((orderItem) => orderItem.id === item.orderItemId);
 return {
 sourceUrl: item.sourceUrl || fromOrder?.sourceUrl || '',
 sourcePlatform: item.sourcePlatform || fromOrder?.sourcePlatform || '',
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
 `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" rx="22" fill="#f9fafb"/><rect x="32" y="36" width="96" height="88" rx="18" fill="#ffffff" stroke="#e5e7eb" stroke-width="2"/><path d="M56 94l18-20 14 15 9-10 18 21" fill="none" stroke="#cbd5e1" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="61" cy="59" r="7" fill="#fdba74"/><text x="80" y="139" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#94a3b8">S2B</text></svg>`
 );

export default function QuotationReview() {
 const { orderId } = useParams<{ orderId: string }>();
 const navigate = useNavigate();
 const { user, loading: authLoading } = useAuth();
 const [order, setOrder] = useState<Order | null>(null);
 const [loading, setLoading] = useState(true);
 const [submitting, setSubmitting] = useState(false);
 const [showRejectDialog, setShowRejectDialog] = useState(false);
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
 setShowRejectDialog(true);
 };

 const confirmReject = async () => {
 if (!quotation) return;

 setSubmitting(true);
 setError('');

 try {
 await updateQuotationStatus(quotation.id, 'rejected');
 setShowRejectDialog(false);
 await loadOrder();
 } catch (err) {
 console.error('Failed to reject quotation:', err);
 setError(err instanceof Error ? err.message : 'Unable to reject quotation.');
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
 <div className="min-h-screen bg-white pb-24">
 <div className="border-b border-gray-100 bg-white px-4 py-3">
 <div className="mx-auto flex max-w-2xl items-center gap-3">
 <h1 className="text-lg font-semibold text-gray-900">Review Quotation</h1>
 </div>
 </div>
 <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
 {[1, 2, 3].map((item) => (
 <div key={item} className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
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
 const isJaigaonPickup = isJaigaonPickupOrder(order);
 const nextSteps = isJaigaonPickup
 ? [
 'Accept this quotation',
 'Pay Shop2Bhutan charges in full',
 'Coordinate product pickup at Jaigaon',
 'Track your order from your account',
 ]
 : [
 'Accept this quotation',
 'Upload payment screenshot',
 'We place your order with the seller',
 'Track your order from your account',
 ];

 return (
 <div className="min-h-screen bg-white pb-[calc(8rem+env(safe-area-inset-bottom))]">
 <header className="sticky top-0 z-30 border-b border-gray-100 bg-white px-4 py-3">
 <div className="mx-auto flex max-w-2xl items-center gap-3">
 <div className="min-w-0">
 <h1 className="text-lg font-semibold text-gray-900">Review Quotation</h1>
 <p className="truncate text-xs text-gray-500">#{order.orderNumber}</p>
 </div>
 </div>
 </header>

 <main className="mx-auto max-w-2xl px-4 py-4">
 {error && (
 <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
 {error}
 </div>
 )}

 <section className={`overflow-hidden rounded-2xl border ${display.card}`}>
 <div className="flex items-start justify-between gap-3 p-4">
 <div className="flex min-w-0 items-start gap-3">
 <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ${display.iconBg}`}>
 {display.icon}
 </div>
 <div className="min-w-0">
 <p className="text-[11px] font-semibold tracking-wide text-gray-500">{display.eyebrow}</p>
 <h2 className="mt-1 text-xl font-bold tracking-tight text-gray-950">{display.title}</h2>
 <p className="mt-1 text-sm text-gray-600">{display.subtitle}</p>
 </div>
 </div>
 <div className="flex-shrink-0 rounded-2xl bg-white px-3 py-2 text-right ring-1 ring-gray-200">
 <p className="text-[10px] font-bold tracking-wide text-gray-400">{isJaigaonPickup ? 'Payable to S2B' : 'Total payable'}</p>
 <p className="whitespace-nowrap text-base font-black text-gray-950">{money(quotation.totalAmount)}</p>
 </div>
 </div>
 <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-2 text-[11px] text-gray-500">
 <span>{isJaigaonPickup ? 'Product value is reference only' : 'Clear quotation before payment'}</span>
 <span className={`font-semibold ${display.accent}`}>No hidden charges</span>
 </div>
 </section>

 <section className="mt-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
 <div className="mb-4 flex items-start justify-between gap-3">
 <div className="flex min-w-0 items-start gap-2.5">
 <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-500 ring-1 ring-orange-100">
 <FileText size={17} />
 </span>
 <div className="min-w-0">
 <h3 className="text-base font-semibold text-gray-900">Price breakdown</h3>
 <p className="mt-0.5 text-xs leading-5 text-gray-500">Review charges before accepting this quotation.</p>
 </div>
 </div>
 <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600">
 Final
 </span>
 </div>

 <div className="space-y-3">
 <div>
 <div className="flex justify-between gap-4 text-sm">
 <span className="text-gray-600">{isJaigaonPickup ? 'Product value (reference)' : 'Product total'}</span>
 <span className="font-semibold text-gray-900">{money(quotation.productTotal)}</span>
 </div>
 {isJaigaonPickup && (
 <p className="mt-1 text-[11px] leading-5 text-gray-400">This product value is not included in the amount payable to Shop2Bhutan.</p>
 )}
 </div>
 <div className="flex justify-between gap-4 text-sm">
 <span className="text-gray-600">Service charge</span>
 <span className="font-semibold text-gray-900">{money(quotation.serviceCharge)}</span>
 </div>
 <div className="flex justify-between gap-4 text-sm">
 <span className="text-gray-600">Delivery fee</span>
 <span className="font-semibold text-gray-900">{money(quotation.deliveryFee)}</span>
 </div>
 {quotation.taxAmount> 0 && (
 <div className="flex justify-between gap-4 text-sm">
 <span className="text-gray-600">Tax</span>
 <span className="font-semibold text-gray-900">{money(quotation.taxAmount)}</span>
 </div>
 )}
 {(quotation.additionalChargeAmount ?? 0)> 0 && (
 <div className="flex justify-between gap-4 text-sm">
 <span className="text-gray-600">{quotation.additionalChargeLabel || 'Additional charge'}</span>
 <span className="font-semibold text-gray-900">{money(quotation.additionalChargeAmount)}</span>
 </div>
 )}
 </div>

 <div className="my-4 border-t border-dashed border-gray-200" />
 <div className="rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-100">
 <div className="flex items-center justify-between gap-4">
 <div className="min-w-0">
 <p className="text-sm font-bold text-gray-950">{isJaigaonPickup ? 'Payable to Shop2Bhutan' : 'Total payable'}</p>
 <p className="mt-1 text-xs leading-relaxed text-gray-500">{isJaigaonPickup ? 'Pay only Shop2Bhutan charges for Jaigaon pickup. No Bhutan delivery fee.' : 'Final payable amount. No hidden charges.'}</p>
 </div>
 <p className="shrink-0 whitespace-nowrap text-xl font-black tracking-tight text-gray-950 sm:text-2xl">
 {money(quotation.totalAmount)}
 </p>
 </div>
 </div>
 </section>

 <section className="mt-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
 <div className="mb-4 flex items-center justify-between">
 <h3 className="text-base font-semibold text-gray-900">Quoted items</h3>
 <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] font-medium text-gray-600">
 {quotation.items.length} {quotation.items.length === 1 ? 'item' : 'items'}
 </span>
 </div>

 <div className="space-y-3">
 {quotation.items.map((item) => {
 const source = sourceForItem(order, item);
 const hasSourceLink = canShowSourceLink(source.sourceUrl);
 const displayImageUrl =
 [item.productImage, source.screenshotUrl].find((url) => canShowImageUrl(url)) || QUOTATION_IMAGE_FALLBACK;

 return (
 <div key={item.id} className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
 <div className="flex gap-3">
 <img
 src={displayImageUrl}
 alt={item.productName || 'Quoted product'}
 className="h-20 w-20 flex-shrink-0 rounded-2xl bg-gray-50 object-cover ring-1 ring-gray-200"
 loading="lazy"
 onError={(event) => {
 const image = event.currentTarget;
 if (image.src !== QUOTATION_IMAGE_FALLBACK) {
 image.src = QUOTATION_IMAGE_FALLBACK;
 }
 }}
 />
 <div className="min-w-0 flex-1">
 <div className="flex flex-wrap items-center gap-2">
 {source.sourcePlatform && (
 <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold tracking-wide text-gray-600 ring-1 ring-gray-200">
 {source.sourcePlatform}
 </span>
 )}
 <span className="text-xs text-gray-500">Qty: {item.quantity}</span>
 </div>
 <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-gray-900">{item.productName}</p>
 <div className="mt-2 flex items-end justify-between gap-3">
 <div>
 <p className="text-[11px] text-gray-500">Unit price</p>
 <p className="text-sm font-semibold text-orange-600">{money(item.unitPrice)}</p>
 </div>
 <p className="text-sm font-bold text-gray-900">{money(item.totalPrice)}</p>
 </div>
 </div>
 </div>

 {(hasSourceLink || item.notes) && (
 <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-3">
 {hasSourceLink && (
 <a
 href={source.sourceUrl}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200 transition-colors hover:bg-gray-50"
 onClick={(event) => event.stopPropagation()}
>
 <ExternalLink size={13} /> View product source
 </a>
 )}
 {item.notes && (
 <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs text-gray-600 ring-1 ring-gray-200">
 <Info size={13} /> {item.notes}
 </span>
 )}
 </div>
 )}
 </div>
 );
 })}
 </div>
 </section>

 <section className="mt-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
 <div className="mb-3 flex items-center gap-2">
 <CreditCard size={18} className="text-gray-500" />
 <h3 className="text-base font-semibold text-gray-900">Payment options</h3>
 </div>
 <div className={`grid gap-3 ${isJaigaonPickup ? 'sm:grid-cols-1' : 'sm:grid-cols-2'}`}>
 <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
 <p className="text-xs font-semibold text-gray-600">{isJaigaonPickup ? 'Full charges payment' : 'Full payment'}</p>
 <p className="mt-1 text-lg font-black text-gray-950">{money(quotation.totalAmount)}</p>
 <p className="mt-1 text-xs leading-5 text-gray-500">
 {isJaigaonPickup
 ? '50% advance is not available for Jaigaon pickup. Pay Shop2Bhutan charges in full.'
 : 'Pay full quotation amount now and keep the balance clear.'}
 </p>
 </div>
 {!isJaigaonPickup && (
 <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
 <p className="text-xs font-semibold text-gray-600">50% advance accepted</p>
 <p className="mt-1 text-lg font-black text-gray-950">{money(Math.ceil(quotation.totalAmount * 0.5))}</p>
 <p className="mt-1 text-xs leading-5 text-gray-500">We can start fulfillment after verified advance. Remaining balance stays visible until paid.</p>
 </div>
 )}
 </div>
 </section>

 <section className="mt-4 grid gap-3 sm:grid-cols-2">
 <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
 <div className="mb-2 flex items-center gap-2 text-gray-700">
 <ShieldCheck size={18} />
 <p className="text-sm font-semibold">Service charge</p>
 </div>
 <p className="text-xs leading-relaxed text-gray-500">
 Covers product verification, sourcing, coordination, order support, and customer updates.
 </p>
 </div>
 <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
 <div className="mb-2 flex items-center gap-2 text-gray-700">
 <Truck size={18} />
 <p className="text-sm font-semibold">Delivery fee</p>
 </div>
 <p className="text-xs leading-relaxed text-gray-500">
 {isJaigaonPickup ? 'No Bhutan delivery fee is charged because you selected direct Jaigaon pickup.' : 'Charged once per quotation/request bag, not once per item.'}
 </p>
 </div>
 </section>

 <section className="mt-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
 <div className="mb-3 flex items-center gap-2">
 <PackageCheck size={18} className="text-gray-500" />
 <h3 className="text-base font-semibold text-gray-900">What happens next?</h3>
 </div>
 <div className="grid gap-2 text-sm text-gray-600">
 {nextSteps.map((step, index) => (
 <div key={step} className="flex items-center gap-3">
 <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-700">
 {index + 1}
 </span>
 <span className="text-xs">{step}</span>
 </div>
 ))}
 </div>
 </section>
 </main>

 {canRespond && !showRejectDialog && (
 <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-100 bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-[0_-12px_32px_rgba(15,23,42,0.08)] backdrop-blur-xl">
 <div className="mx-auto flex max-w-2xl gap-3">
 <button
 type="button"
 onClick={handleReject}
 disabled={submitting}
 className="h-12 flex-1 rounded-2xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
>
 Need Changes
 </button>
 <button
 type="button"
 onClick={handleAccept}
 disabled={submitting}
 className="h-12 flex-[1.5] rounded-2xl bg-emerald-500 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:opacity-50"
>
 {submitting ? 'Processing...' : 'Accept & Continue'}
 </button>
 </div>
 </div>
 )}

 {showRejectDialog && (
 <div className="fixed inset-0 z-50 flex items-end justify-center bg-gray-950/45 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-10 sm:items-center sm:pb-10">
 <div className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-gray-200">
 <div className="p-5">
 <div className="mb-4 flex items-start gap-3">
 <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 ring-1 ring-orange-100">
 <AlertTriangle size={22} />
 </span>
 <div>
 <h3 className="text-lg font-bold text-gray-950">Need changes?</h3>
 <p className="mt-1 text-sm leading-6 text-gray-500">
 If the price or product details are not suitable, you can mark this quotation as needing changes. Shop2Bhutan can follow up from your request.
 </p>
 </div>
 </div>
 <div className="rounded-2xl bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-500 ring-1 ring-gray-100">
 This will mark the quotation as rejected. Your request will remain in your account for reference.
 </div>
 </div>
 <div className="flex gap-3 border-t border-gray-100 bg-gray-50 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
 <button
 type="button"
 onClick={() => setShowRejectDialog(false)}
 disabled={submitting}
 className="h-11 flex-1 rounded-2xl bg-white text-sm font-semibold text-gray-700 ring-1 ring-gray-200 transition-colors hover:bg-gray-100 disabled:opacity-50"
>
 Keep quotation
 </button>
 <button
 type="button"
 onClick={confirmReject}
 disabled={submitting}
 className="h-11 flex-1 rounded-2xl bg-red-500 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
>
 {submitting ? 'Updating...' : 'Reject Quotation'}
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 );
}
