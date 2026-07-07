import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Upload, CheckCircle, Wallet, Building2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchCustomerOrderById, fetchPaymentMethods, submitCustomerPaymentProof } from '@/lib/customerOrders';
import { DEFAULT_APP_SETTINGS, fetchPublicAppSettings } from '@/lib/appSettings';
import type { Order, PaymentMethod } from '@/types';

const ALLOWED_SCREENSHOT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024;

type PaymentSelection = 'full' | 'advance' | 'remaining';

type PaymentTypeForLedger = 'full' | 'advance' | 'balance';

function formatCurrency(amount: number) {
 return `Nu. ${Number(amount || 0).toLocaleString()}`;
}

function paymentMethodTypeLabel(type: string) {
 return type === 'bank_transfer' ? 'Bank Transfer' : 'Mobile Banking';
}

function getItemCount(order: Order) {
 return order.items.reduce((total, item) => total + Math.max(1, Number(item.quantity) || 1), 0);
}

function getDeliverySummary(order: Order) {
 const addressParts = [
 order.shippingAddress?.village,
 order.shippingAddress?.gewog,
 order.shippingAddress?.dzongkhag,
 ].filter(Boolean);

 const hubName = String(order.deliveryHub?.name ?? '').trim();
 const hubLabel = hubName && !/^selected hub$/i.test(hubName) ? hubName : '';
 const addressLabel = addressParts.join(', ');

 return [hubLabel, addressLabel].filter(Boolean).join(' • ') || 'Delivery address will be confirmed.';
}

function getPaymentSummary(order: Order | null) {
 const payments = order?.payments ?? (order?.payment ? [order.payment] : []);
 const totalPayable = order?.quotation?.totalAmount || 0;
 const verifiedPaid = payments
 .filter((payment) => payment.status === 'verified')
 .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
 const pendingAmount = payments
 .filter((payment) => payment.status === 'pending')
 .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
 const rejectedAmount = payments
 .filter((payment) => payment.status === 'rejected')
 .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
 const balanceDue = Math.max(totalPayable - verifiedPaid, 0);
 const hasPendingPayment = payments.some((payment) => payment.status === 'pending');

 return {
 totalPayable,
 verifiedPaid,
 pendingAmount,
 rejectedAmount,
 balanceDue,
 hasPendingPayment,
 isFullyPaid: totalPayable> 0 && verifiedPaid>= totalPayable,
 isPartiallyPaid: verifiedPaid> 0 && verifiedPaid < totalPayable,
 };
}

export default function PaymentUpload() {
 const { orderId } = useParams<{ orderId: string }>();
 const navigate = useNavigate();
 const { user, loading: authLoading } = useAuth();
 const [order, setOrder] = useState<Order | null>(null);
 const [loading, setLoading] = useState(true);
 const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
 const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(true);
 const [selectedMethod, setSelectedMethod] = useState('');
 const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
 const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
 const [paymentSelection, setPaymentSelection] = useState<PaymentSelection>('full');
 const [transactionId, setTransactionId] = useState('');
 const [note, setNote] = useState('');
 const [submitted, setSubmitted] = useState(false);
 const [copiedField, setCopiedField] = useState('');
 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState('');
 const [appSettings, setAppSettings] = useState(DEFAULT_APP_SETTINGS);

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

 const summary = getPaymentSummary(realOrder);
 setPaymentSelection(summary.verifiedPaid > 0 ? 'remaining' : 'full');
 } catch (err) {
 console.error('Failed to load payment order:', err);
 setError(err instanceof Error ? err.message : 'Unable to load payment details.');
 } finally {
 setLoading(false);
 }
 }, [orderId, user]);

 const loadPaymentMethods = useCallback(async () => {
 setPaymentMethodsLoading(true);

 try {
 const methods = await fetchPaymentMethods({ includeInactive: false });
 setPaymentMethods(methods);
 setSelectedMethod((current) => {
 if (current && methods.some((method) => method.id === current)) return current;
 return methods[0]?.id ?? '';
 });
 } catch (err) {
 console.error('Failed to load payment methods:', err);
 setPaymentMethods([]);
 setError(err instanceof Error ? err.message : 'Unable to load payment methods.');
 } finally {
 setPaymentMethodsLoading(false);
 }
 }, []);

 useEffect(() => {
 if (!authLoading) {
 loadOrder();
 }
 }, [authLoading, loadOrder]);

 useEffect(() => {
 loadPaymentMethods();
 }, [loadPaymentMethods]);

 useEffect(() => {
 let active = true;

 async function loadAppSettings() {
 try {
 const loadedSettings = await fetchPublicAppSettings();
 if (active) setAppSettings(loadedSettings);
 } catch (err) {
 console.warn('[PaymentUpload] App settings skipped:', err);
 if (active) setAppSettings(DEFAULT_APP_SETTINGS);
 }
 }

 void loadAppSettings();

 const handleSettingsUpdated = () => {
 void loadAppSettings();
 };

 window.addEventListener('shop2bhutan:app-settings-updated', handleSettingsUpdated);

 return () => {
 active = false;
 window.removeEventListener('shop2bhutan:app-settings-updated', handleSettingsUpdated);
 };
 }, []);

 useEffect(() => {
 return () => {
 if (screenshotPreview?.startsWith('blob:')) {
 URL.revokeObjectURL(screenshotPreview);
 }
 };
 }, [screenshotPreview]);

 const selectedPaymentMethod = useMemo(
 () => paymentMethods.find((method) => method.id === selectedMethod) ?? paymentMethods[0] ?? null,
 [paymentMethods, selectedMethod]
 );

 const paymentSummary = getPaymentSummary(order);
 const quotationTotal = paymentSummary.totalPayable;
 const minimumAdvancePercent = appSettings.partialPaymentEnabled
 ? Math.min(100, Math.max(1, Math.round(Number(appSettings.minimumAdvancePaymentPercent) || 50)))
 : 100;
 const minimumInitialPayment = quotationTotal > 0 && paymentSummary.verifiedPaid <= 0
 ? Math.ceil(quotationTotal * (minimumAdvancePercent / 100))
 : 0;
 const fullPaymentAmount = Math.max(0, Math.round(paymentSummary.balanceDue));
 const advancePaymentAmount = minimumInitialPayment > 0
 ? Math.min(fullPaymentAmount, minimumInitialPayment)
 : fullPaymentAmount;
 const selectedPaymentAmount =
 paymentSelection === 'advance'
 ? advancePaymentAmount
 : fullPaymentAmount;
 const balanceAfterSelectedPayment = Math.max(0, Math.round(paymentSummary.balanceDue - selectedPaymentAmount));
 const selectedLedgerPaymentType: PaymentTypeForLedger =
 paymentSelection === 'advance'
 ? 'advance'
 : paymentSelection === 'remaining'
 ? 'balance'
 : 'full';
 const amountPaidNumber = selectedPaymentAmount;
 const amountAboveBalance = paymentSummary.balanceDue > 0 && amountPaidNumber > paymentSummary.balanceDue;
 const firstPaymentBelowMinimum = minimumInitialPayment > 0 && amountPaidNumber > 0 && amountPaidNumber < minimumInitialPayment;
 const selectPaymentAmount = (selection: PaymentSelection) => {
 setPaymentSelection(selection);
 setError('');
 };
 const canStartPayment = Boolean(
 order &&
 (order.status === 'payment_pending' ||
 order.quotation?.status === 'approved' ||
 order.payment?.status === 'rejected')
 );
 const canUpload = Boolean(
 canStartPayment &&
 !paymentSummary.hasPendingPayment &&
 !paymentSummary.isFullyPaid &&
 paymentSummary.balanceDue> 0
 );
 const canSubmit = Boolean(
 screenshotFile &&
 selectedPaymentMethod &&
 amountPaidNumber > 0 &&
 !amountAboveBalance &&
 !firstPaymentBelowMinimum &&
 canUpload &&
 !submitting
 );

 useEffect(() => {
 if (!order) return;
 if (paymentSummary.isPartiallyPaid && paymentSelection !== 'remaining') {
 setPaymentSelection('remaining');
 return;
 }
 if (!paymentSummary.isPartiallyPaid && paymentSelection === 'remaining') {
 setPaymentSelection('full');
 return;
 }
 if ((!appSettings.partialPaymentEnabled || minimumAdvancePercent >= 100) && paymentSelection === 'advance') {
 setPaymentSelection('full');
 return;
 }
 }, [
 order,
 appSettings.partialPaymentEnabled,
 minimumAdvancePercent,
 paymentSelection,
 paymentSummary.isPartiallyPaid,
 selectedPaymentAmount,
 ]);

 const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
 const file = event.target.files?.[0];
 if (!file) return;

 if (!ALLOWED_SCREENSHOT_TYPES.includes(file.type)) {
 setError('Please upload a JPG, PNG, or WEBP payment screenshot.');
 event.target.value = '';
 return;
 }

 if (file.size> MAX_SCREENSHOT_SIZE) {
 setError('Screenshot must be less than 5MB.');
 event.target.value = '';
 return;
 }

 if (screenshotPreview?.startsWith('blob:')) {
 URL.revokeObjectURL(screenshotPreview);
 }

 setScreenshotFile(file);
 setScreenshotPreview(URL.createObjectURL(file));
 setError('');
 };

 const clearScreenshot = () => {
 if (screenshotPreview?.startsWith('blob:')) {
 URL.revokeObjectURL(screenshotPreview);
 }
 setScreenshotFile(null);
 setScreenshotPreview(null);
 };

 const copyToClipboard = async (text: string, field: string) => {
 await navigator.clipboard.writeText(text);
 setCopiedField(field);
 window.setTimeout(() => setCopiedField(''), 2000);
 };

 const handleSubmit = async () => {
 if (!order || !user) return;

 if (!canUpload) {
 setError('Payment upload is not available for this order right now.');
 return;
 }

 if (!selectedPaymentMethod) {
 setError('Please select a payment method.');
 return;
 }

 if (!screenshotFile) {
 setError('Please upload your payment screenshot.');
 return;
 }

 if (!Number.isFinite(amountPaidNumber) || amountPaidNumber <= 0) {
 setError('Amount paid must be greater than 0.');
 return;
 }

 if (amountAboveBalance) {
 setError(`Amount paid cannot be more than the remaining balance of ${formatCurrency(paymentSummary.balanceDue)}.`);
 return;
 }

 if (firstPaymentBelowMinimum) {
 setError(`Minimum first payment is ${minimumAdvancePercent}% of the quotation: ${formatCurrency(minimumInitialPayment)}.`);
 return;
 }

 setSubmitting(true);
 setError('');

 try {
 await submitCustomerPaymentProof({
 order,
 userId: user.id,
 file: screenshotFile,
 paymentMethodName: selectedPaymentMethod.name,
 paymentMethodId: selectedPaymentMethod.id,
 paymentMethodType: selectedPaymentMethod.type,
 transactionId: transactionId.trim(),
 amount: amountPaidNumber,
 paymentType: selectedLedgerPaymentType,
 note: note.trim(),
 });

 setSubmitted(true);
 } catch (err) {
 console.error('Failed to submit payment proof:', err);
 setError(err instanceof Error ? err.message : 'Unable to submit payment proof.');
 } finally {
 setSubmitting(false);
 }
 };

 const renderBlockedState = (title: string, description: string, buttonLabel: string, path: string) => (
 <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
 <div className="w-full max-w-md rounded-2xl bg-white border border-gray-100 p-6 ">
 <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
 <CheckCircle size={28} className="text-gray-600" />
 </div>
 <h1 className="text-xl font-bold text-gray-900 mb-2">{title}</h1>
 <p className="text-sm text-gray-500 mb-6">{description}</p>
 <button
 type="button"
 onClick={() => navigate(path)}
 className="w-full h-12 bg-orange-500 text-white font-semibold rounded-2xl hover:bg-orange-600 transition-colors"
>
 {buttonLabel}
 </button>
 </div>
 </div>
 );

 if (!authLoading && !user) {
 return (
 <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
 <p className="text-gray-500 mb-4">Please sign in to upload payment.</p>
 <button
 type="button"
 onClick={() => navigate('/login')}
 className="h-11 px-5 rounded-2xl bg-orange-500 text-white text-sm font-semibold"
>
 Sign In
 </button>
 </div>
 );
 }

 if (loading) {
 return (
 <div className="min-h-screen bg-white pb-24">
 <div className="bg-white border-b border-gray-100 px-4 py-3">
 <div className="max-w-2xl mx-auto flex items-center gap-3">
 <button type="button" onClick={() => navigate(-1)} className="p-1">
 <ArrowLeft size={22} className="text-gray-900" />
 </button>
 <h1 className="text-lg font-semibold text-gray-900">Upload Payment</h1>
 </div>
 </div>
 <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
 {[1, 2, 3].map((item) => (
 <div key={item} className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
 ))}
 </div>
 </div>
 );
 }

 if (!order) {
 return (
 <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center">
 <p className="text-gray-500 mb-4">{error || 'Order not found'}</p>
 <button
 type="button"
 onClick={() => navigate('/orders')}
 className="h-11 px-5 rounded-2xl bg-orange-500 text-white text-sm font-semibold"
>
 Back to Orders
 </button>
 </div>
 );
 }

 if (submitted) {
 return (
 <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
 <div className="w-full max-w-md rounded-2xl bg-white border border-gray-100 p-6 text-center ">
 <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
 <CheckCircle size={32} className="text-emerald-600" />
 </div>
 <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment proof submitted</h1>
 <p className="text-sm text-gray-500 mb-6">We will verify your payment and update your order.</p>
 <button
 type="button"
 onClick={() => navigate(`/order/${order.id}`)}
 className="w-full h-12 bg-orange-500 text-white font-semibold rounded-2xl hover:bg-orange-600 transition-colors"
>
 View Order
 </button>
 </div>
 </div>
 );
 }

 if (paymentSummary.hasPendingPayment) {
 return renderBlockedState(
 'Payment proof already submitted',
 'We will verify your payment and update your order.',
 'View Order',
 `/order/${order.id}`
 );
 }

 if (paymentSummary.isFullyPaid) {
 return renderBlockedState('Payment verified', 'Your payment has already been verified.', 'View Order', `/order/${order.id}`);
 }

 if (order.status === 'quoted' && order.quotation?.status !== 'approved') {
 return renderBlockedState(
 'Please approve your quotation before uploading payment.',
 'Review and approve your quotation to continue with payment upload.',
 'Review Quotation',
 `/quotation/${order.id}`
 );
 }

 if (!canUpload) {
 return renderBlockedState(
 'Payment upload not available',
 'This order is not ready for payment upload yet.',
 'View Order',
 `/order/${order.id}`
 );
 }

 return (
 <div className="min-h-screen bg-white pb-24">
 <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-30">
 <div className="max-w-2xl mx-auto flex items-center gap-3">
 <button type="button" onClick={() => navigate(-1)} className="p-1">
 <ArrowLeft size={22} className="text-gray-900" />
 </button>
 <h1 className="text-lg font-semibold text-gray-900">Upload Payment</h1>
 </div>
 </div>

 <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
 {error && (
 <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
 {error}
 </div>
 )}

 <div className="bg-white rounded-2xl p-4 border border-gray-100 ">
 <div className="flex items-start justify-between gap-3 mb-4">
 <div className="min-w-0 flex-1">
 <p className="text-xs font-medium text-gray-500 tracking-wider uppercase">Upload Payment Proof</p>
 <div className="mt-1">
 <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Order ID</p>
 <p className="mt-0.5 inline-flex max-w-full rounded-xl bg-gray-50 px-2.5 py-1 font-mono text-[13px] font-extrabold leading-5 text-gray-900 ring-1 ring-gray-200 sm:text-sm">
 <span className="truncate">#{order.orderNumber}</span>
 </p>
 </div>
 </div>
 <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${paymentSummary.isPartiallyPaid ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
 {paymentSummary.isPartiallyPaid ? 'Balance Due' : 'Payment Pending'}
 </span>
 </div>

 <div className="rounded-2xl bg-white border border-gray-100 p-4 mb-4">
 <p className="text-xs text-gray-500 font-medium">Total Payable</p>
 <p className="text-3xl font-extrabold text-gray-900 mt-1">{formatCurrency(quotationTotal)}</p>
 <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
 <div className="rounded-2xl bg-gray-50 p-3">
 <p className="text-xs text-gray-400">Verified Paid</p>
 <p className="font-bold text-gray-900 mt-1">{formatCurrency(paymentSummary.verifiedPaid)}</p>
 </div>
 <div className="rounded-2xl bg-gray-50 p-3">
 <p className="text-xs text-gray-400">Balance After This</p>
 <p className="font-bold text-gray-900 mt-1">{formatCurrency(balanceAfterSelectedPayment)}</p>
 </div>
 </div>
 {paymentSummary.isPartiallyPaid && (
 <p className="text-xs text-gray-500 mt-3">Partial payment verified. You can upload the remaining balance when ready.</p>
 )}
 <div className="mt-4 grid grid-cols-2 gap-2">
 <button
 type="button"
 onClick={() => selectPaymentAmount(paymentSummary.isPartiallyPaid ? 'remaining' : 'full')}
 aria-pressed={paymentSelection === 'full' || paymentSelection === 'remaining'}
 className={`rounded-2xl bg-white px-3 py-3 text-left text-xs font-semibold ring-1 transition active:scale-[0.98] ${
 (paymentSelection === 'full' || paymentSelection === 'remaining')
 ? 'text-orange-600 ring-orange-400 bg-white'
 : 'text-gray-700 ring-orange-100'
 }`}
>
 {paymentSummary.isPartiallyPaid ? 'Pay remaining balance' : 'Pay full balance'}
 <span className="mt-0.5 block text-sm font-bold text-gray-900">{formatCurrency(fullPaymentAmount)}</span>
 <span className="mt-0.5 block text-[10px] font-medium text-gray-400">
 {paymentSelection === 'full' || paymentSelection === 'remaining' ? 'Selected' : 'Tap to select'}
 </span>
 </button>
 {!paymentSummary.isPartiallyPaid && appSettings.partialPaymentEnabled && minimumAdvancePercent < 100 && minimumInitialPayment > 0 ? (
 <button
 type="button"
 onClick={() => selectPaymentAmount('advance')}
 aria-pressed={paymentSelection === 'advance'}
 className={`rounded-2xl bg-white px-3 py-3 text-left text-xs font-semibold ring-1 transition active:scale-[0.98] ${
 paymentSelection === 'advance'
 ? 'text-blue-600 ring-blue-400 bg-white'
 : 'text-blue-700 ring-blue-100'
 }`}
>
 Pay {minimumAdvancePercent}% advance
 <span className="mt-0.5 block text-sm font-bold text-gray-900">{formatCurrency(advancePaymentAmount)}</span>
 <span className="mt-0.5 block text-[10px] font-medium text-gray-400">
 {paymentSelection === 'advance' ? 'Selected' : 'Tap to select'}
 </span>
 </button>
 ) : null}
 </div>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
 <div className="rounded-2xl bg-white border border-gray-100 p-3">
 <p className="text-xs text-gray-400">Item Count</p>
 <p className="font-semibold text-gray-900 mt-1">{getItemCount(order)} item(s)</p>
 </div>
 <div className="rounded-2xl bg-white border border-gray-100 p-3">
 <p className="text-xs text-gray-400">Delivery Hub / Address</p>
 <p className="font-semibold text-gray-900 mt-1">{getDeliverySummary(order)}</p>
 </div>
 </div>
 </div>

 <div className="bg-white rounded-2xl p-4 border border-gray-100 ">
 <h3 className="text-sm font-semibold text-gray-900 mb-3">Payment Instructions</h3>
 <div className="space-y-2 text-sm text-gray-500">
 <p>You can pay the full balance or start with the configured {minimumAdvancePercent}% advance payment.</p>
 <p>Upload your payment screenshot after payment. Each upload stays in the payment ledger.</p>
 <p>We can start fulfillment after a verified advance, but the remaining balance will stay visible until paid.</p>
 </div>
 </div>

 <div>
 <h3 className="text-sm font-semibold text-gray-900 mb-3">Select Payment Method</h3>
 <div className="space-y-2">
 {paymentMethodsLoading ? (
 [1, 2].map((item) => (
 <div key={item} className="h-24 rounded-2xl bg-gray-100 border border-gray-100 animate-pulse" />
 ))
 ) : paymentMethods.length === 0 ? (
 <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700">
 No active payment methods are available. Please contact Shop2Bhutan support.
 </div>
 ) : (
 paymentMethods.map((paymentMethod) => (
 <button
 key={paymentMethod.id}
 type="button"
 onClick={() => setSelectedMethod(paymentMethod.id)}
 className={`w-full text-left p-4 rounded-2xl border transition-colors ${
 selectedMethod === paymentMethod.id
 ? 'border-orange-500 bg-white'
 : 'border-gray-200 bg-white'
 }`}
>
 <div className="flex items-center gap-3">
 <div
 className={`w-10 h-10 rounded-full flex items-center justify-center ${
 selectedMethod === paymentMethod.id ? 'bg-orange-500' : 'bg-gray-100'
 }`}
>
 {paymentMethod.type === 'bank_transfer' ? (
 <Building2
 size={18}
 className={selectedMethod === paymentMethod.id ? 'text-white' : 'text-gray-500'}
 />
 ) : (
 <Wallet
 size={18}
 className={selectedMethod === paymentMethod.id ? 'text-white' : 'text-gray-500'}
 />
 )}
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm font-semibold text-gray-900">{paymentMethod.name}</p>
 <p className="text-xs text-gray-400">{paymentMethodTypeLabel(paymentMethod.type)}</p>
 </div>
 <div
 className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
 selectedMethod === paymentMethod.id ? 'border-orange-500' : 'border-gray-200'
 }`}
>
 {selectedMethod === paymentMethod.id && <div className="w-2.5 h-2.5 bg-orange-500 rounded-full" />}
 </div>
 </div>

 {selectedMethod === paymentMethod.id && (
 <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
 <div className="flex items-center justify-between gap-4">
 <span className="text-xs text-gray-400">Type</span>
 <span className="text-sm font-medium text-right">{paymentMethodTypeLabel(paymentMethod.type)}</span>
 </div>
 <div className="flex items-center justify-between gap-4">
 <span className="text-xs text-gray-400">Account Name</span>
 <span className="text-sm font-medium text-right">{paymentMethod.accountName || '-'}</span>
 </div>
 <div className="flex items-center justify-between gap-4">
 <span className="text-xs text-gray-400">Account Number / Code</span>
 <div className="flex items-center gap-2 min-w-0">
 <span className="text-sm font-mono font-medium text-right truncate">
 {paymentMethod.accountNumber || '-'}
 </span>
 {paymentMethod.accountNumber && (
 <button
 type="button"
 onClick={(event) => {
 event.stopPropagation();
 copyToClipboard(paymentMethod.accountNumber, `acc-${paymentMethod.id}`);
 }}
 className="p-1 text-gray-400 hover:text-gray-600"
 aria-label="Copy account number or code"
>
 {copiedField === `acc-${paymentMethod.id}` ? (
 <CheckCircle size={14} className="text-emerald-500" />
 ) : (
 <Copy size={14} />
 )}
 </button>
 )}
 </div>
 </div>
 {paymentMethod.bankName && (
 <div className="flex items-center justify-between gap-4">
 <span className="text-xs text-gray-400">Bank</span>
 <span className="text-sm text-right">{paymentMethod.bankName}</span>
 </div>
 )}
 {paymentMethod.branch && (
 <div className="flex items-center justify-between gap-4">
 <span className="text-xs text-gray-400">Branch</span>
 <span className="text-sm text-right">{paymentMethod.branch}</span>
 </div>
 )}
 {paymentMethod.instructions && (
 <p className="text-xs text-gray-400 bg-gray-50 p-2 rounded-2xl mt-2">
 {paymentMethod.instructions}
 </p>
 )}
 </div>
 )}
 </button>
 ))
 )}
 </div>
 </div>

 <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-4">
 <div>
 <label className="text-sm font-semibold text-gray-900">Selected Payment Amount</label>
 <div className="mt-1.5 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
 <div className="flex items-center justify-between gap-3">
 <div>
 <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
 {paymentSelection === 'advance' ? 'Advance payment' : paymentSelection === 'remaining' ? 'Remaining balance' : 'Full payment'}
 </p>
 <p className="mt-1 text-2xl font-bold text-gray-900">{formatCurrency(amountPaidNumber)}</p>
 </div>
 <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-gray-400 ring-1 ring-gray-200">
 Locked
 </span>
 </div>
 </div>
 <p className="text-xs text-gray-400 mt-2">
 Amount is locked based on the payment type selected above. Balance after this payment: {formatCurrency(balanceAfterSelectedPayment)}.
 </p>
 {minimumInitialPayment > 0 && (
 <p className="mt-1 text-xs text-gray-500">Minimum first payment: {formatCurrency(minimumInitialPayment)} ({minimumAdvancePercent}% advance).</p>
 )}
 {amountAboveBalance && (
 <p className="mt-1 text-xs font-medium text-red-600">Amount cannot exceed the remaining balance.</p>
 )}
 {firstPaymentBelowMinimum && (
 <p className="mt-1 text-xs font-medium text-red-600">First payment must be at least {minimumAdvancePercent}% of the quotation.</p>
 )}
 </div>

 <div>
 <label className="text-sm font-semibold text-gray-900">Transaction / Reference Number</label>
 <input
 type="text"
 value={transactionId}
 onChange={(event) => setTransactionId(event.target.value)}
 placeholder="Optional"
 className="w-full h-12 mt-1.5 px-4 border border-gray-200 rounded-2xl text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10"
 />
 </div>

 <div>
 <label className="text-sm font-semibold text-gray-900">Note</label>
 <textarea
 value={note}
 onChange={(event) => setNote(event.target.value)}
 placeholder="Optional note for Shop2Bhutan"
 rows={3}
 className="w-full mt-1.5 px-4 py-3 border border-gray-200 rounded-2xl text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 resize-none"
 />
 </div>

 <div>
 <h3 className="text-sm font-semibold text-gray-900 mb-3">Payment Screenshot</h3>
 {!screenshotPreview ? (
 <label className="w-full h-48 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-orange-500 transition-colors bg-gray-50">
 <Upload size={32} className="text-gray-300" />
 <p className="text-sm text-gray-400 mt-2">Tap to upload screenshot</p>
 <p className="text-xs text-gray-300 mt-1">JPG, PNG, WEBP up to 5MB</p>
 <input
 type="file"
 accept="image/jpeg,image/png,image/webp"
 onChange={handleFileChange}
 className="hidden"
 />
 </label>
 ) : (
 <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
 <img
 src={screenshotPreview}
 alt="Payment screenshot"
 className="h-auto max-h-[65vh] min-h-48 w-full object-contain p-2"
 />
 <div className="absolute bottom-2 left-2 rounded-xl bg-black/60 px-2.5 py-1 text-[10px] font-semibold text-white">
 Full screenshot preview
 </div>
 <button
 type="button"
 onClick={clearScreenshot}
 className="absolute top-2 right-2 px-3 py-1 bg-white rounded-xl text-xs font-medium shadow-sm border border-gray-100"
>
 Change
 </button>
 </div>
 )}
 </div>
 </div>
 </div>

 <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 z-40">
 <div className="max-w-2xl mx-auto">
 <button
 type="button"
 onClick={handleSubmit}
 disabled={!canSubmit || paymentMethodsLoading}
 className="w-full h-12 bg-orange-500 text-white font-semibold rounded-2xl hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
>
 {submitting ? 'Uploading...' : paymentSummary.isPartiallyPaid ? 'Submit Remaining Payment Proof' : 'Submit Payment Proof'}
 </button>
 </div>
 </div>
 </div>
 );
}
