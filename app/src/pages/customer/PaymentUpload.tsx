import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Upload, CheckCircle, Wallet, Building2 } from 'lucide-react';
import { paymentMethods } from '@/data/mockData';
import { useAuth } from '@/contexts/AuthContext';
import { fetchCustomerOrderById, submitCustomerPaymentProof } from '@/lib/customerOrders';
import type { Order } from '@/types';

export default function PaymentUpload() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState(paymentMethods[0]?.id ?? '');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState('');
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
    } catch (err) {
      console.error('Failed to load payment order:', err);
      setError(err instanceof Error ? err.message : 'Unable to load payment details.');
    } finally {
      setLoading(false);
    }
  }, [orderId, user]);

  useEffect(() => {
    if (!authLoading) {
      loadOrder();
    }
  }, [authLoading, loadOrder]);

  useEffect(() => {
    return () => {
      if (screenshotPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(screenshotPreview);
      }
    };
  }, [screenshotPreview]);

  const selectedPaymentMethod = useMemo(
    () => paymentMethods.find((method) => method.id === selectedMethod) ?? paymentMethods[0],
    [selectedMethod]
  );

  const amount = order?.quotation?.totalAmount || order?.payment?.amount || 0;

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload a JPG or PNG payment screenshot.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Screenshot must be less than 5MB.');
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
    if (!order || !user || !selectedPaymentMethod || !screenshotFile) return;

    setSubmitting(true);
    setError('');

    try {
      await submitCustomerPaymentProof({
        order,
        userId: user.id,
        file: screenshotFile,
        paymentMethodName: selectedPaymentMethod.name,
        transactionId: transactionId.trim(),
        amount,
      });

      setSubmitted(true);
    } catch (err) {
      console.error('Failed to submit payment proof:', err);
      setError(err instanceof Error ? err.message : 'Unable to submit payment proof.');
    } finally {
      setSubmitting(false);
    }
  };

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
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate(-1)} className="p-1">
              <ArrowLeft size={22} className="text-neutral-700" />
            </button>
            <h1 className="text-lg font-semibold text-gray-900">Upload Payment</h1>
          </div>
        </div>
        <div className="px-4 py-4 space-y-4">
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
        <div className="text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Submitted</h1>
          <p className="text-sm text-neutral-500 mb-2">
            Your payment of Nu. {amount.toLocaleString()} is under review.
          </p>
          <p className="text-xs text-neutral-400 mb-6">
            We will verify your payment and update your order status.
          </p>
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="w-full h-12 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600 transition-colors"
          >
            View My Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-32">
      <div className="bg-white border-b border-neutral-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft size={22} className="text-neutral-700" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Upload Payment</h1>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="bg-violet-50 rounded-2xl p-5 text-center">
          <p className="text-xs font-medium text-violet-600 uppercase tracking-wider">Amount Due</p>
          <p className="text-3xl font-bold text-violet-700 mt-1">Nu. {amount.toLocaleString()}</p>
          <p className="text-xs text-violet-500 mt-1">Order #{order.orderNumber}</p>
        </div>

        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-3">Select Payment Method</h3>
          <div className="space-y-2">
            {paymentMethods.map((paymentMethod) => (
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
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{paymentMethod.name}</p>
                    <p className="text-xs text-neutral-500">
                      {paymentMethod.type === 'bank_transfer' ? 'Bank Transfer' : 'Mobile Wallet'}
                    </p>
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
                      <span className="text-xs text-neutral-500">Account Number</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-medium">{paymentMethod.accountNumber}</span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            copyToClipboard(paymentMethod.accountNumber, 'acc');
                          }}
                          className="p-1 text-neutral-400 hover:text-amber-600"
                        >
                          {copiedField === 'acc' ? (
                            <CheckCircle size={14} className="text-emerald-500" />
                          ) : (
                            <Copy size={14} />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-xs text-neutral-500">Account Name</span>
                      <span className="text-sm font-medium text-right">{paymentMethod.accountName}</span>
                    </div>
                    {paymentMethod.bankName && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-xs text-neutral-500">Bank</span>
                        <span className="text-sm text-right">{paymentMethod.bankName}</span>
                      </div>
                    )}
                    <p className="text-xs text-neutral-500 bg-neutral-50 p-2 rounded-lg mt-2">
                      {paymentMethod.instructions}
                    </p>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-3">Payment Screenshot</h3>
          {!screenshotPreview ? (
            <label className="w-full h-48 border-2 border-dashed border-neutral-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-amber-500 transition-colors">
              <Upload size={40} className="text-neutral-400" />
              <p className="text-sm text-neutral-500 mt-2">Tap to upload screenshot</p>
              <p className="text-xs text-neutral-400 mt-1">JPG, PNG up to 5MB</p>
              <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
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

        <div>
          <label className="text-sm font-medium text-gray-900">Transaction / Reference ID</label>
          <input
            type="text"
            value={transactionId}
            onChange={(event) => setTransactionId(event.target.value)}
            placeholder="Enter transaction ID"
            className="w-full h-12 mt-1.5 px-4 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 p-4 z-40">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!screenshotFile || !transactionId.trim() || !selectedPaymentMethod || submitting}
          className="w-full h-12 bg-emerald-500 text-white font-semibold rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Submitting...' : 'Confirm Payment'}
        </button>
      </div>
    </div>
  );
}
