import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Building2,
  CheckCircle,
  Copy,
  CreditCard,
  FileText,
  ShieldCheck,
  Upload,
  Wallet,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchCustomerOrderById,
  fetchPaymentMethods,
  submitCustomerPaymentProof,
} from '@/lib/customerOrders';
import { DEFAULT_APP_SETTINGS, fetchPublicAppSettings } from '@/lib/appSettings';
import { getFulfillmentDisplay, isJaigaonPickupOrder, isSelfPickupOrder } from '@/lib/fulfillment';
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
  if (isSelfPickupOrder(order)) {
    const display = getFulfillmentDisplay(order);
    return [display.title, display.details].filter(Boolean).join(' • ') || 'Pickup point will be confirmed.';
  }

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
    isFullyPaid: totalPayable > 0 && verifiedPaid >= totalPayable,
    isPartiallyPaid: verifiedPaid > 0 && verifiedPaid < totalPayable,
  };
}

function PaymentStep({ number, label }: { number: number; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-gray-100 bg-white px-3 py-1.5 shadow-sm">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-50 text-[11px] font-black text-orange-600">
        {number}
      </span>
      <span className="text-[11px] font-bold text-gray-600">{label}</span>
    </div>
  );
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
      void loadOrder();
    }
  }, [authLoading, loadOrder]);

  useEffect(() => {
    void loadPaymentMethods();
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
    [paymentMethods, selectedMethod],
  );

  const paymentSummary = getPaymentSummary(order);
  const isJaigaonPickup = order ? isJaigaonPickupOrder(order) : false;
  const productReferenceTotal = order?.quotation?.productTotal ?? 0;
  const quotationTotal = paymentSummary.totalPayable;
  const minimumAdvancePercent = isJaigaonPickup
    ? 100
    : appSettings.partialPaymentEnabled
      ? Math.min(100, Math.max(1, Math.round(Number(appSettings.minimumAdvancePaymentPercent) || 50)))
      : 100;
  const minimumInitialPayment = quotationTotal > 0 && paymentSummary.verifiedPaid <= 0
    ? Math.ceil(quotationTotal * (minimumAdvancePercent / 100))
    : 0;
  const fullPaymentAmount = Math.max(0, Math.round(paymentSummary.balanceDue));
  const advancePaymentAmount = minimumInitialPayment > 0
    ? Math.min(fullPaymentAmount, minimumInitialPayment)
    : fullPaymentAmount;
  const selectedPaymentAmount = paymentSelection === 'advance' ? advancePaymentAmount : fullPaymentAmount;
  const balanceAfterSelectedPayment = Math.max(0, Math.round(paymentSummary.balanceDue - selectedPaymentAmount));
  const selectedLedgerPaymentType: PaymentTypeForLedger = paymentSelection === 'advance'
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
        order.payment?.status === 'rejected'),
  );
  const canUpload = Boolean(
    canStartPayment &&
      !paymentSummary.hasPendingPayment &&
      !paymentSummary.isFullyPaid &&
      paymentSummary.balanceDue > 0,
  );
  const canSubmit = Boolean(
    screenshotFile &&
      selectedPaymentMethod &&
      amountPaidNumber > 0 &&
      !amountAboveBalance &&
      !firstPaymentBelowMinimum &&
      canUpload &&
      !submitting,
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
    if ((isJaigaonPickup || !appSettings.partialPaymentEnabled || minimumAdvancePercent >= 100) && paymentSelection === 'advance') {
      setPaymentSelection('full');
    }
  }, [
    order,
    appSettings.partialPaymentEnabled,
    isJaigaonPickup,
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

    if (file.size > MAX_SCREENSHOT_SIZE) {
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
      setError(
        isJaigaonPickup
          ? `Jaigaon pickup requires full Shop2Bhutan charges: ${formatCurrency(minimumInitialPayment)}.`
          : `Minimum first payment is ${minimumAdvancePercent}% of the quotation: ${formatCurrency(minimumInitialPayment)}.`,
      );
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
      <div className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
          <CheckCircle size={28} />
        </div>
        <h1 className="mb-2 text-xl font-bold text-gray-900">{title}</h1>
        <p className="mb-6 text-sm leading-6 text-gray-500">{description}</p>
        <button
          type="button"
          onClick={() => navigate(path)}
          className="h-12 w-full rounded-2xl bg-orange-500 font-semibold text-white transition-colors hover:bg-orange-600"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );

  if (!authLoading && !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
        <p className="mb-4 text-gray-500">Please sign in to upload payment.</p>
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
          <div className="mx-auto max-w-2xl">
            <h1 className="text-lg font-bold text-gray-900">Upload Payment</h1>
            <p className="text-xs text-gray-500">Preparing your payment form...</p>
          </div>
        </div>
        <div className="mx-auto max-w-2xl space-y-3 px-4 py-4">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-3xl bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
        <p className="mb-4 text-gray-500">{error || 'Order not found'}</p>
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

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white px-6">
        <div className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600">
            <CheckCircle size={32} />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Payment proof submitted</h1>
          <p className="mb-6 text-sm leading-6 text-gray-500">We will verify your payment and update your order.</p>
          <button
            type="button"
            onClick={() => navigate(`/order/${order.id}`)}
            className="h-12 w-full rounded-2xl bg-orange-500 font-semibold text-white transition-colors hover:bg-orange-600"
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
      `/order/${order.id}`,
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
      `/quotation/${order.id}`,
    );
  }

  if (!canUpload) {
    return renderBlockedState(
      'Payment upload not available',
      'This order is not ready for payment upload yet.',
      'View Order',
      `/order/${order.id}`,
    );
  }

  return (
    <div className="min-h-screen bg-white pb-28">
      <div className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-wider text-orange-500">Payment proof</p>
          <h1 className="text-lg font-extrabold text-gray-900">Upload Payment</h1>
          <p className="truncate text-xs font-medium text-gray-500">#{order.orderNumber}</p>
        </div>
      </div>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4">
        {error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm leading-6 text-red-600">
            {error}
          </div>
        )}

        <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
          <div className="border-l-4 border-orange-500 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{isJaigaonPickup ? 'Shop2Bhutan charges to pay' : 'Amount to pay'}</p>
                <p className="mt-1 text-3xl font-black tracking-tight text-gray-950">{formatCurrency(amountPaidNumber)}</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  {isJaigaonPickup
                    ? 'Jaigaon pickup selected. Product value is reference only; pay Shop2Bhutan charges in full.'
                    : paymentSelection === 'advance'
                      ? `${minimumAdvancePercent}% advance selected. Remaining balance stays visible until paid.`
                      : paymentSummary.isPartiallyPaid
                        ? 'Remaining balance selected for this payment.'
                        : 'Full payment selected for this order.'}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-gray-100 bg-gray-50 px-3 py-1 text-xs font-bold text-gray-600">
                {paymentSummary.isPartiallyPaid ? 'Balance due' : 'Payment pending'}
              </span>
            </div>

            <div className={`mt-4 grid gap-2 ${isJaigaonPickup ? 'grid-cols-1' : 'grid-cols-2'}`}>
              <div className="rounded-2xl bg-gray-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Verified paid</p>
                <p className="mt-1 text-sm font-black text-gray-900">{formatCurrency(paymentSummary.verifiedPaid)}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Balance after</p>
                <p className="mt-1 text-sm font-black text-gray-900">{formatCurrency(balanceAfterSelectedPayment)}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <PaymentStep number={1} label="Select amount" />
              <PaymentStep number={2} label="Choose bank" />
              <PaymentStep number={3} label="Upload proof" />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <CreditCard size={18} className="text-orange-500" />
            <h2 className="text-sm font-extrabold text-gray-900">Select payment amount</h2>
          </div>

          <div className={`grid gap-2 ${isJaigaonPickup ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <button
              type="button"
              onClick={() => selectPaymentAmount(paymentSummary.isPartiallyPaid ? 'remaining' : 'full')}
              aria-pressed={paymentSelection === 'full' || paymentSelection === 'remaining'}
              className={`rounded-2xl border p-3 text-left transition active:scale-[0.98] ${
                paymentSelection === 'full' || paymentSelection === 'remaining'
                  ? 'border-orange-400 bg-orange-50/40 ring-2 ring-orange-500/10'
                  : 'border-gray-100 bg-white hover:bg-gray-50'
              }`}
            >
              <p className="text-xs font-bold text-gray-700">
                {isJaigaonPickup ? 'Pay Shop2Bhutan charges' : paymentSummary.isPartiallyPaid ? 'Pay remaining' : 'Pay full balance'}
              </p>
              <p className="mt-1 text-base font-black text-gray-950">{formatCurrency(fullPaymentAmount)}</p>
              <p className="mt-1 text-[11px] font-semibold text-gray-400">
                {paymentSelection === 'full' || paymentSelection === 'remaining' ? 'Selected' : 'Tap to select'}
              </p>
            </button>

            {!isJaigaonPickup && !paymentSummary.isPartiallyPaid && appSettings.partialPaymentEnabled && minimumAdvancePercent < 100 && minimumInitialPayment > 0 ? (
              <button
                type="button"
                onClick={() => selectPaymentAmount('advance')}
                aria-pressed={paymentSelection === 'advance'}
                className={`rounded-2xl border p-3 text-left transition active:scale-[0.98] ${
                  paymentSelection === 'advance'
                    ? 'border-orange-400 bg-orange-50/40 ring-2 ring-orange-500/10'
                    : 'border-gray-100 bg-white hover:bg-gray-50'
                }`}
              >
                <p className="text-xs font-bold text-gray-700">Pay {minimumAdvancePercent}% advance</p>
                <p className="mt-1 text-base font-black text-gray-950">{formatCurrency(advancePaymentAmount)}</p>
                <p className="mt-1 text-[11px] font-semibold text-gray-400">
                  {paymentSelection === 'advance' ? 'Selected' : 'Tap to select'}
                </p>
              </button>
            ) : null}
          </div>

          <div className="mt-3 rounded-2xl bg-gray-50 p-3 text-xs leading-5 text-gray-500">
            {isJaigaonPickup ? (
              <>
                Jaigaon pickup is charges-only. 50% advance is not available, and the selected amount is locked to the full Shop2Bhutan charges.
                {productReferenceTotal > 0 && (
                  <span className="mt-1 block">Product value reference: <span className="font-bold text-gray-700">{formatCurrency(productReferenceTotal)}</span>.</span>
                )}
              </>
            ) : (
              <>
                Minimum first payment: <span className="font-bold text-gray-700">{formatCurrency(minimumInitialPayment)}</span> ({minimumAdvancePercent}% advance). The selected amount is locked to avoid mismatch during verification.
              </>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck size={18} className="text-orange-500" />
            <h2 className="text-sm font-extrabold text-gray-900">Order summary</h2>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-white p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Items</p>
              <p className="mt-1 font-bold text-gray-900">{getItemCount(order)} item(s)</p>
            </div>
            {isJaigaonPickup && productReferenceTotal > 0 && (
              <div className="rounded-2xl border border-gray-100 bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Product value</p>
                <p className="mt-1 font-bold text-gray-900">{formatCurrency(productReferenceTotal)}</p>
                <p className="mt-1 text-[11px] leading-4 text-gray-400">Reference only</p>
              </div>
            )}
            <div className="rounded-2xl border border-gray-100 bg-white p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Delivery / address</p>
              <p className="mt-1 text-sm font-bold leading-5 text-gray-900">{getDeliverySummary(order)}</p>
            </div>
          </div>
          <div className="mt-3 rounded-2xl bg-gray-50 p-3 text-xs leading-5 text-gray-500">
            Pay using one of the active methods below, then upload a clear screenshot showing the paid amount and transaction details.
          </div>
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Building2 size={18} className="text-orange-500" />
            <h2 className="text-sm font-extrabold text-gray-900">Select payment method</h2>
          </div>

          <div className="space-y-2">
            {paymentMethodsLoading ? (
              [1, 2].map((item) => (
                <div key={item} className="h-24 animate-pulse rounded-2xl border border-gray-100 bg-gray-100" />
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
                  className={`w-full rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
                    selectedMethod === paymentMethod.id
                      ? 'border-orange-400 bg-white shadow-sm ring-2 ring-orange-500/10'
                      : 'border-gray-100 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                        selectedMethod === paymentMethod.id ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {paymentMethod.type === 'bank_transfer' ? <Building2 size={18} /> : <Wallet size={18} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-900">{paymentMethod.name}</p>
                      <p className="text-xs font-medium text-gray-400">{paymentMethodTypeLabel(paymentMethod.type)}</p>
                    </div>
                    <div
                      className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                        selectedMethod === paymentMethod.id ? 'border-orange-500' : 'border-gray-200'
                      }`}
                    >
                      {selectedMethod === paymentMethod.id && <div className="h-2.5 w-2.5 rounded-full bg-orange-500" />}
                    </div>
                  </div>

                  {selectedMethod === paymentMethod.id && (
                    <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs font-medium text-gray-400">Type</span>
                        <span className="text-right text-sm font-semibold text-gray-900">{paymentMethodTypeLabel(paymentMethod.type)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs font-medium text-gray-400">Account Name</span>
                        <span className="text-right text-sm font-semibold text-gray-900">{paymentMethod.accountName || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs font-medium text-gray-400">Account Number / Code</span>
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-right font-mono text-sm font-semibold text-gray-900">
                            {paymentMethod.accountNumber || '-'}
                          </span>
                          {paymentMethod.accountNumber && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void copyToClipboard(paymentMethod.accountNumber, `acc-${paymentMethod.id}`);
                              }}
                              className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
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
                          <span className="text-xs font-medium text-gray-400">Bank</span>
                          <span className="text-right text-sm font-semibold text-gray-900">{paymentMethod.bankName}</span>
                        </div>
                      )}
                      {paymentMethod.branch && (
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs font-medium text-gray-400">Branch</span>
                          <span className="text-right text-sm font-semibold text-gray-900">{paymentMethod.branch}</span>
                        </div>
                      )}
                      {paymentMethod.instructions && (
                        <p className="mt-2 rounded-2xl bg-gray-50 p-3 text-xs leading-5 text-gray-500">
                          {paymentMethod.instructions}
                        </p>
                      )}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <FileText size={18} className="text-orange-500" />
            <h2 className="text-sm font-extrabold text-gray-900">Payment details</h2>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
                  {isJaigaonPickup ? 'Shop2Bhutan charges' : paymentSelection === 'advance' ? 'Advance payment' : paymentSelection === 'remaining' ? 'Remaining balance' : 'Full payment'}
                </p>
                <p className="mt-1 text-2xl font-black text-gray-950">{formatCurrency(amountPaidNumber)}</p>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-gray-500 ring-1 ring-gray-200">
                Locked
              </span>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-bold text-gray-900">Transaction / Reference Number</label>
              <input
                type="text"
                value={transactionId}
                onChange={(event) => setTransactionId(event.target.value)}
                placeholder="Optional, but recommended"
                className="mt-1.5 h-12 w-full rounded-2xl border border-gray-200 px-4 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-gray-900">Note</label>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Optional note for Shop2Bhutan"
                rows={3}
                className="mt-1.5 w-full resize-none rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10"
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Upload size={18} className="text-orange-500" />
              <h2 className="text-sm font-extrabold text-gray-900">Payment screenshot</h2>
            </div>
            <span className="rounded-full bg-gray-50 px-2.5 py-1 text-[11px] font-bold text-gray-500 ring-1 ring-gray-100">
              Required
            </span>
          </div>

          {!screenshotPreview ? (
            <label className="flex h-48 w-full cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50 transition hover:border-orange-400 hover:bg-orange-50/30">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-orange-500 shadow-sm ring-1 ring-gray-100">
                <Upload size={24} />
              </span>
              <p className="mt-3 text-sm font-bold text-gray-700">Tap to upload payment screenshot</p>
              <p className="mt-1 text-xs font-medium text-gray-400">JPG, PNG, WEBP up to 5MB</p>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          ) : (
            <div className="relative overflow-hidden rounded-3xl border border-gray-100 bg-gray-50">
              <img
                src={screenshotPreview}
                alt="Payment screenshot"
                className="h-auto max-h-[65vh] min-h-48 w-full object-contain p-2"
              />
              <div className="absolute bottom-2 left-2 rounded-xl bg-black/60 px-2.5 py-1 text-[10px] font-semibold text-white">
                Screenshot preview
              </div>
              <button
                type="button"
                onClick={clearScreenshot}
                className="absolute right-2 top-2 rounded-xl border border-gray-100 bg-white px-3 py-1 text-xs font-bold text-gray-700 shadow-sm"
              >
                Change
              </button>
            </div>
          )}
        </section>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-100 bg-white p-4">
        <div className="mx-auto max-w-2xl">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || paymentMethodsLoading}
            className="h-12 w-full rounded-2xl bg-orange-500 font-bold text-white shadow-lg shadow-orange-500/20 transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-orange-300 disabled:shadow-none"
          >
            {submitting ? 'Uploading...' : paymentSummary.isPartiallyPaid ? 'Submit Remaining Payment Proof' : 'Submit Payment Proof'}
          </button>
        </div>
      </div>
    </div>
  );
}
