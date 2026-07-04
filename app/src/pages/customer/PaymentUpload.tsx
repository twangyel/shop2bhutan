import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Upload, CheckCircle, Wallet, Building2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchCustomerOrderById, fetchPaymentMethods, submitCustomerPaymentProof } from '@/lib/customerOrders';
import type { Order, PaymentMethod } from '@/types';

const ALLOWED_SCREENSHOT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024;
const MIN_INITIAL_PAYMENT_RATIO = 0.5;

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
    isFullyPaid: totalPayable > 0 && verifiedPaid >= totalPayable,
    isPartiallyPaid: verifiedPaid > 0 && verifiedPaid < totalPayable,
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
  const [amountPaid, setAmountPaid] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [copiedField, setCopiedField] = useState('');
  const [submitting, setSubmitting] = useState(false);
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

      const summary = getPaymentSummary(realOrder);
      const defaultAmount = summary.balanceDue || realOrder?.quotation?.totalAmount || realOrder?.payment?.amount || 0;
      setAmountPaid(defaultAmount > 0 ? String(defaultAmount) : '');
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
  const amountPaidNumber = Number(amountPaid);
  const minimumInitialPayment = quotationTotal > 0 && paymentSummary.verifiedPaid <= 0
    ? Math.ceil(quotationTotal * MIN_INITIAL_PAYMENT_RATIO)
    : 0;
  const amountAboveBalance = paymentSummary.balanceDue > 0 && amountPaidNumber > paymentSummary.balanceDue;
  const firstPaymentBelowMinimum = minimumInitialPayment > 0 && amountPaidNumber > 0 && amountPaidNumber < minimumInitialPayment;
  const setSuggestedAmount = (value: number) => {
    const safeValue = Math.max(0, Math.min(Math.round(value), paymentSummary.balanceDue || value));
    setAmountPaid(safeValue > 0 ? String(safeValue) : '');
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
      paymentSummary.balanceDue > 0
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
      setError(`Minimum first payment is 50% of the quotation: ${formatCurrency(minimumInitialPayment)}.`);
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
        amount: Number(amountPaid),
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
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-md rounded-2xl bg-white border border-neutral-200 p-6 shadow-sm">
        <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={28} className="text-amber-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-sm text-neutral-500 mb-6">{description}</p>
        <button
          type="button"
          onClick={() => navigate(path)}
          className="w-full h-12 bg-amber-500 text-white font-semibold rounded-xl hover:bg-amber-600 transition-colors"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );

  if (!authLoading && !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-neutral-500 mb-4">Please sign in to upload payment.</p>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="h-11 px-5 rounded-xl bg-amber-500 text-white text-sm font-semibold"
        >
          Sign In
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 pb-32">
        <div className="bg-white border-b border-neutral-200 px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <button type="button" onClick={() => navigate(-1)} className="p-1">
              <ArrowLeft size={22} className="text-neutral-700" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Upload Payment</h1>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-32 rounded-xl bg-white animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <p className="text-neutral-500 mb-4">{error || 'Order not found'}</p>
        <button
          type="button"
          onClick={() => navigate('/orders')}
          className="h-11 px-5 rounded-xl bg-amber-500 text-white text-sm font-semibold"
        >
          Back to Orders
        </button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl bg-white border border-neutral-200 p-6 text-center shadow-sm">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment proof submitted</h1>
          <p className="text-sm text-neutral-500 mb-6">We will verify your payment and update your order.</p>
          <button
            type="button"
            onClick={() => navigate(`/order/${order.id}`)}
            className="w-full h-12 bg-amber-500 text-white font-semibold rounded-xl hover:bg-amber-600 transition-colors"
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
    <div className="min-h-screen bg-neutral-50 pb-32">
      <div className="bg-white border-b border-neutral-200 px-4 py-3 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft size={22} className="text-neutral-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Upload Payment</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl p-5 border border-amber-100 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">Upload Payment Proof</p>
              <h2 className="text-lg font-bold text-gray-900 mt-1">Order #{order.orderNumber}</h2>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${paymentSummary.isPartiallyPaid ? 'bg-blue-50 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
              {paymentSummary.isPartiallyPaid ? 'Balance Due' : 'Payment Pending'}
            </span>
          </div>

          <div className="rounded-2xl bg-amber-50 p-4 mb-4">
            <p className="text-xs text-amber-700 font-medium">Total Payable</p>
            <p className="text-3xl font-bold text-amber-700 mt-1">{formatCurrency(quotationTotal)}</p>
            <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
              <div className="rounded-xl bg-white/70 p-3">
                <p className="text-xs text-amber-700">Verified Paid</p>
                <p className="font-bold text-gray-900 mt-1">{formatCurrency(paymentSummary.verifiedPaid)}</p>
              </div>
              <div className="rounded-xl bg-white/70 p-3">
                <p className="text-xs text-amber-700">Balance Due</p>
                <p className="font-bold text-gray-900 mt-1">{formatCurrency(paymentSummary.balanceDue)}</p>
              </div>
            </div>
            {paymentSummary.isPartiallyPaid && (
              <p className="text-xs text-blue-700 mt-3">Partial payment verified. You can upload the remaining balance when ready.</p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSuggestedAmount(paymentSummary.balanceDue)}
                className="rounded-xl bg-white/80 px-3 py-2 text-left text-xs font-semibold text-amber-700 ring-1 ring-amber-100 active:scale-[0.98]"
              >
                Pay full balance
                <span className="mt-0.5 block text-[11px] font-bold text-gray-950">{formatCurrency(paymentSummary.balanceDue)}</span>
              </button>
              {minimumInitialPayment > 0 ? (
                <button
                  type="button"
                  onClick={() => setSuggestedAmount(minimumInitialPayment)}
                  className="rounded-xl bg-white/80 px-3 py-2 text-left text-xs font-semibold text-blue-700 ring-1 ring-blue-100 active:scale-[0.98]"
                >
                  Pay 50% advance
                  <span className="mt-0.5 block text-[11px] font-bold text-gray-950">{formatCurrency(minimumInitialPayment)}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSuggestedAmount(paymentSummary.balanceDue)}
                  className="rounded-xl bg-white/80 px-3 py-2 text-left text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100 active:scale-[0.98]"
                >
                  Remaining payment
                  <span className="mt-0.5 block text-[11px] font-bold text-gray-950">{formatCurrency(paymentSummary.balanceDue)}</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-neutral-50 p-3">
              <p className="text-xs text-neutral-500">Item Count</p>
              <p className="font-semibold text-gray-900 mt-1">{getItemCount(order)} item(s)</p>
            </div>
            <div className="rounded-xl bg-neutral-50 p-3">
              <p className="text-xs text-neutral-500">Delivery Hub / Address</p>
              <p className="font-semibold text-gray-900 mt-1">{getDeliverySummary(order)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Payment Instructions</h3>
          <div className="space-y-2 text-sm text-neutral-600">
            <p>You can pay the full balance or start with a 50% advance payment.</p>
            <p>Upload your payment screenshot after payment. Each upload stays in the payment ledger.</p>
            <p>We can start fulfillment after a verified advance, but the remaining balance will stay visible until paid.</p>
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-3">Select Payment Method</h3>
          <div className="space-y-2">
            {paymentMethodsLoading ? (
              [1, 2].map((item) => (
                <div key={item} className="h-24 rounded-xl bg-white border border-neutral-200 animate-pulse" />
              ))
            ) : paymentMethods.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                No active payment methods are available. Please contact Shop2Bhutan support.
              </div>
            ) : (
              paymentMethods.map((paymentMethod) => (
                <button
                  key={paymentMethod.id}
                  type="button"
                  onClick={() => setSelectedMethod(paymentMethod.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-colors ${
                    selectedMethod === paymentMethod.id
                      ? 'border-amber-500 bg-amber-50/50'
                      : 'border-neutral-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        selectedMethod === paymentMethod.id ? 'bg-amber-500' : 'bg-neutral-100'
                      }`}
                    >
                      {paymentMethod.type === 'bank_transfer' ? (
                        <Building2
                          size={18}
                          className={selectedMethod === paymentMethod.id ? 'text-white' : 'text-neutral-500'}
                        />
                      ) : (
                        <Wallet
                          size={18}
                          className={selectedMethod === paymentMethod.id ? 'text-white' : 'text-neutral-500'}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{paymentMethod.name}</p>
                      <p className="text-xs text-neutral-500">{paymentMethodTypeLabel(paymentMethod.type)}</p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        selectedMethod === paymentMethod.id ? 'border-amber-500' : 'border-neutral-300'
                      }`}
                    >
                      {selectedMethod === paymentMethod.id && <div className="w-2.5 h-2.5 bg-amber-500 rounded-full" />}
                    </div>
                  </div>

                  {selectedMethod === paymentMethod.id && (
                    <div className="mt-3 pt-3 border-t border-neutral-200 space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs text-neutral-500">Type</span>
                        <span className="text-sm font-medium text-right">{paymentMethodTypeLabel(paymentMethod.type)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs text-neutral-500">Account Name</span>
                        <span className="text-sm font-medium text-right">{paymentMethod.accountName || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs text-neutral-500">Account Number / Code</span>
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
                              className="p-1 text-neutral-400 hover:text-amber-600"
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
                          <span className="text-xs text-neutral-500">Bank</span>
                          <span className="text-sm text-right">{paymentMethod.bankName}</span>
                        </div>
                      )}
                      {paymentMethod.branch && (
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-xs text-neutral-500">Branch</span>
                          <span className="text-sm text-right">{paymentMethod.branch}</span>
                        </div>
                      )}
                      {paymentMethod.instructions && (
                        <p className="text-xs text-neutral-500 bg-neutral-50 p-2 rounded-lg mt-2">
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

        <div className="bg-white rounded-2xl p-5 border border-neutral-200 shadow-sm space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-900">Amount Paid</label>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              max={paymentSummary.balanceDue || undefined}
              value={amountPaid}
              onChange={(event) => setAmountPaid(event.target.value)}
              placeholder="Enter amount paid or balance amount"
              className="w-full h-12 mt-1.5 px-4 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
            <p className="text-xs text-neutral-400 mt-1">Balance due: {formatCurrency(paymentSummary.balanceDue)}</p>
            {minimumInitialPayment > 0 && (
              <p className="mt-1 text-xs text-blue-600">Minimum first payment: {formatCurrency(minimumInitialPayment)} (50% advance).</p>
            )}
            {amountAboveBalance && (
              <p className="mt-1 text-xs font-medium text-red-600">Amount cannot exceed the remaining balance.</p>
            )}
            {firstPaymentBelowMinimum && (
              <p className="mt-1 text-xs font-medium text-red-600">First payment must be at least 50% of the quotation.</p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium text-gray-900">Transaction / Reference Number</label>
            <input
              type="text"
              value={transactionId}
              onChange={(event) => setTransactionId(event.target.value)}
              placeholder="Optional"
              className="w-full h-12 mt-1.5 px-4 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-900">Note</label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional note for Shop2Bhutan"
              rows={3}
              className="w-full mt-1.5 px-4 py-3 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 resize-none"
            />
          </div>

          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-3">Payment Screenshot</h3>
            {!screenshotPreview ? (
              <label className="w-full h-48 border-2 border-dashed border-neutral-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-amber-500 transition-colors bg-neutral-50">
                <Upload size={40} className="text-neutral-400" />
                <p className="text-sm text-neutral-500 mt-2">Tap to upload screenshot</p>
                <p className="text-xs text-neutral-400 mt-1">JPG, PNG, WEBP up to 5MB</p>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="relative rounded-xl overflow-hidden">
                <img src={screenshotPreview} alt="Payment screenshot" className="w-full h-48 object-cover" />
                <button
                  type="button"
                  onClick={clearScreenshot}
                  className="absolute top-2 right-2 px-3 py-1 bg-white/90 rounded-lg text-xs font-medium shadow-md"
                >
                  Change
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 p-4 z-40">
        <div className="max-w-2xl mx-auto">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || paymentMethodsLoading}
            className="w-full h-12 bg-amber-500 text-white font-semibold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Uploading...' : paymentSummary.isPartiallyPaid ? 'Submit Remaining Payment Proof' : 'Submit Payment Proof'}
          </button>
        </div>
      </div>
    </div>
  );
}
