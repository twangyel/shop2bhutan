import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Building2,
  CheckCircle,
  Copy,
  CreditCard,
  ShieldCheck,
  Upload,
  Loader2,
  Wallet,
  X,
  AlertTriangle,
  ScanLine,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppToast } from '@/components/shared/AppToast';
import {
  fetchCustomerOrderById,
  fetchPaymentMethods,
  submitCustomerPaymentProof,
  type PaymentSourceBank,
} from '@/lib/customerOrders';
import { DEFAULT_APP_SETTINGS, fetchPublicAppSettings } from '@/lib/appSettings';
import { isJaigaonPickupOrder } from '@/lib/fulfillment';
import type { Order, PaymentMethod } from '@/types';
import {
  consumeRestoredCameraFile,
  isCameraCancellation,
  isNativeCameraRuntime,
  NATIVE_CAMERA_RESTORED_EVENT,
  pickNativeImageFile,
} from '@/lib/camera';
import { usePrivacyScreen } from '@/lib/privacyScreen';
import {
  readPaymentProofScreenshot,
  type PaymentProofOcrResult,
  type PaymentProofOcrStatus,
  type PaymentReferenceDetectionSource,
} from '@/lib/paymentProofOcr';

const ALLOWED_SCREENSHOT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024;

type PaymentSelection = 'full' | 'advance' | 'remaining';
type PaymentTypeForLedger = 'full' | 'advance' | 'balance';


const PAYMENT_SOURCE_BANKS: Array<{
  id: PaymentSourceBank;
  shortName: string;
  name: string;
  referenceLabel: string;
  referencePlaceholder: string;
  referenceHelp: string;
}> = [
  {
    id: 'bob',
    shortName: 'BoB',
    name: 'Bank of Bhutan',
    referenceLabel: 'Journal Number',
    referencePlaceholder: 'Example: 126-711191575',
    referenceHelp: 'We will try to read the Journal No. automatically. Manual entry is optional.',
  },
  {
    id: 'dk',
    shortName: 'DK Bank',
    name: 'DK Bank',
    referenceLabel: 'RRNO / Fund Transfer Number',
    referencePlaceholder: 'Example: 619720623039',
    referenceHelp: 'We will try to read the RRNO automatically. Manual entry is optional.',
  },
  {
    id: 'bnb',
    shortName: 'BNB',
    name: 'Bhutan National Bank',
    referenceLabel: 'RRNO',
    referencePlaceholder: 'Example: 619708228126',
    referenceHelp: 'We will try to read the RRNO automatically. Manual entry is optional.',
  },
];

function normalizePaymentReferenceInput(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, '');
}

function withTimeout<T>(
  promise: Promise<T>,
  milliseconds: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(message));
    }, milliseconds);

    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function formatCurrency(amount: number) {
  return `Nu. ${Number(amount || 0).toLocaleString()}`;
}

function paymentMethodTypeLabel(type: string) {
  return type === 'bank_transfer' ? 'Bank Transfer' : 'Mobile Banking';
}

function getItemCount(order: Order) {
  return order.items.reduce((total, item) => total + Math.max(1, Number(item.quantity) || 1), 0);
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

function PaymentStep({ number, label, active }: { number: number; label: string; active?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black ${
          active ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-500'
        }`}
      >
        {number}
      </span>
      <span className={`text-[11px] font-bold ${active ? 'text-slate-900' : 'text-slate-500'}`}>{label}</span>
    </div>
  );
}

export default function PaymentUpload() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { showToast } = useAppToast();
  const { user, loading: authLoading } = useAuth();
  usePrivacyScreen();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [openingCamera, setOpeningCamera] = useState(false);
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const [paymentSelection, setPaymentSelection] = useState<PaymentSelection>('full');
  const [sourceBank, setSourceBank] = useState<PaymentSourceBank | ''>('');
  const [transactionId, setTransactionId] = useState('');
  const [detectedAmount, setDetectedAmount] = useState<number | null>(null);
  const [ocrStatus, setOcrStatus] =
    useState<PaymentProofOcrStatus>('not_attempted');
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrConfidence, setOcrConfidence] = useState(0);
  const [ocrMessage, setOcrMessage] = useState('');
  const [referenceDetectionSource, setReferenceDetectionSource] =
    useState<PaymentReferenceDetectionSource>('none');
  const ocrRunIdRef = useRef(0);
  const manualReferenceEditedRef = useRef(false);
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [copiedField, setCopiedField] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [appSettings, setAppSettings] = useState(DEFAULT_APP_SETTINGS);

  useEffect(() => {
    if (!error) return;

    const normalized = error.toLowerCase();
    const isWarning =
      normalized.startsWith('please') ||
      normalized.includes('must be') ||
      normalized.includes('cannot be') ||
      normalized.includes('not available');

    showToast({
      type: isWarning ? 'warning' : 'error',
      title: isWarning ? 'Check payment details' : 'Payment action failed',
      message: error,
    });
  }, [error, showToast]);

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
  const selectedSourceBank = useMemo(
    () => PAYMENT_SOURCE_BANKS.find((bank) => bank.id === sourceBank) ?? null,
    [sourceBank],
  );
  const normalizedTransactionId = normalizePaymentReferenceInput(transactionId);

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
  const detectedAmountDifference =
    detectedAmount === null
      ? null
      : Math.round((detectedAmount - amountPaidNumber) * 100) / 100;
  const detectedAmountMatches =
    detectedAmountDifference !== null &&
    Math.abs(detectedAmountDifference) < 0.01;
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
    sourceBank &&
      screenshotFile &&
      selectedPaymentMethod &&
      (!normalizedTransactionId ||
        (normalizedTransactionId.length >= 6 &&
          normalizedTransactionId.length <= 40)) &&
      amountPaidNumber > 0 &&
      !amountAboveBalance &&
      !firstPaymentBelowMinimum &&
      ocrStatus !== 'reading' &&
      canUpload &&
      !submitting,
  );

  const submitButtonLabel = (() => {
    if (submitting) return 'Uploading...';
    if (!sourceBank) return 'Select paid-from bank';
    if (!screenshotFile) return 'Upload screenshot to continue';
    if (ocrStatus === 'reading') return 'Reading screenshot...';
    return paymentSummary.isPartiallyPaid
      ? 'Submit Remaining Payment Proof'
      : 'Submit Payment Proof';
  })();

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

  const resetOcrResult = useCallback(() => {
    ocrRunIdRef.current += 1;
    setDetectedAmount(null);
    setOcrStatus('not_attempted');
    setOcrProgress(0);
    setOcrConfidence(0);
    setOcrMessage('');
    setReferenceDetectionSource('none');
    manualReferenceEditedRef.current = false;
  }, []);

  const applyPaymentScreenshot = useCallback((file: File | null) => {
    if (!file) return;

    if (!ALLOWED_SCREENSHOT_TYPES.includes(file.type)) {
      setError('Please upload a JPG, PNG, or WEBP payment screenshot.');
      return;
    }

    if (file.size > MAX_SCREENSHOT_SIZE) {
      setError('Screenshot must be less than 5MB.');
      return;
    }

    resetOcrResult();
    setTransactionId('');
    setScreenshotFile(file);
    setScreenshotPreview((currentPreview) => {
      if (currentPreview?.startsWith('blob:')) {
        URL.revokeObjectURL(currentPreview);
      }

      return URL.createObjectURL(file);
    });
    setError('');
  }, [resetOcrResult]);

  const runPaymentProofOcr = useCallback(async () => {
    if (!screenshotFile || !sourceBank) return;

    const runId = ocrRunIdRef.current + 1;
    ocrRunIdRef.current = runId;
    setOcrStatus('reading');
    setOcrProgress(0);
    setOcrConfidence(0);
    setDetectedAmount(null);
    setOcrMessage('Reading the payment screenshot on this device...');

    try {
      const result: PaymentProofOcrResult =
        await withTimeout(
          readPaymentProofScreenshot({
            file: screenshotFile,
            bank: sourceBank,
            expectedAmount: amountPaidNumber,
            onProgress(progress) {
              if (ocrRunIdRef.current !== runId) return;
              setOcrProgress(progress.progress);
            },
          }),
          35_000,
          'Screenshot reading took too long. Manual review will be used.',
        );

      if (ocrRunIdRef.current !== runId) return;

      setOcrStatus(result.status);
      setOcrProgress(1);
      setOcrConfidence(result.confidence);
      setDetectedAmount(result.amount);

      if (
        result.reference &&
        !manualReferenceEditedRef.current
      ) {
        setTransactionId(result.reference);
        setReferenceDetectionSource('ocr');
      } else if (!manualReferenceEditedRef.current) {
        setReferenceDetectionSource('none');
      }

      if (result.status === 'detected') {
        setOcrMessage(
          'Reference and amount were detected. Please confirm them before submitting.',
        );
      } else if (result.status === 'partial') {
        setOcrMessage(
          'Some payment details were detected. You may submit even when a field is missing.',
        );
      } else {
        setOcrMessage(
          'The details could not be read clearly. You may still submit for manual admin review.',
        );
      }
    } catch (ocrError) {
      if (ocrRunIdRef.current !== runId) return;

      console.warn('[PaymentUpload] Screenshot reading skipped:', ocrError);
      ocrRunIdRef.current += 1;
      setOcrStatus('failed');
      setOcrProgress(0);
      setOcrConfidence(0);
      setDetectedAmount(null);
      setOcrMessage(
        'Automatic reading was unavailable. You may still submit the screenshot for manual review.',
      );
    }
  }, [amountPaidNumber, screenshotFile, sourceBank]);

  useEffect(() => {
    if (!screenshotFile || !sourceBank) return;

    void runPaymentProofOcr();
  }, [runPaymentProofOcr, screenshotFile, sourceBank]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    applyPaymentScreenshot(event.target.files?.[0] ?? null);
    event.target.value = '';
  };

  const openPaymentProofPicker = async () => {
    if (!isNativeCameraRuntime()) {
      screenshotInputRef.current?.click();
      return;
    }

    setOpeningCamera(true);
    setError('');

    try {
      const file = await pickNativeImageFile({
        purpose: 'payment-proof',
        fileNamePrefix: 'payment-proof',
        quality: 88,
        width: 1800,
        height: 1800,
      });

      if (file) applyPaymentScreenshot(file);
    } catch (cameraError) {
      if (!isCameraCancellation(cameraError)) {
        setError(
          cameraError instanceof Error
            ? cameraError.message
            : 'Unable to open the camera or gallery.',
        );
      }
    } finally {
      setOpeningCamera(false);
    }
  };

  useEffect(() => {
    let active = true;

    const restoreCameraResult = async () => {
      try {
        const file = await consumeRestoredCameraFile(
          'payment-proof',
          'payment-proof',
        );

        if (active && file) {
          applyPaymentScreenshot(file);
        }
      } catch (cameraError) {
        if (active && !isCameraCancellation(cameraError)) {
          setError('Unable to restore the selected payment screenshot.');
        }
      }
    };

    void restoreCameraResult();

    const handleRestoredResult = () => {
      void restoreCameraResult();
    };

    window.addEventListener(
      NATIVE_CAMERA_RESTORED_EVENT,
      handleRestoredResult,
    );

    return () => {
      active = false;
      window.removeEventListener(
        NATIVE_CAMERA_RESTORED_EVENT,
        handleRestoredResult,
      );
    };
  }, [applyPaymentScreenshot]);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      showToast({
        type: 'success',
        title: 'Copied',
        message: 'Payment information was copied to your clipboard.',
      });
      window.setTimeout(() => setCopiedField(''), 2000);
    } catch (copyError) {
      console.warn('[PaymentUpload] Copy failed:', copyError);
      showToast({
        type: 'error',
        title: 'Unable to copy',
        message: 'Please select and copy the payment information manually.',
      });
    }
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

    if (!sourceBank || !selectedSourceBank) {
      setError('Please select the bank you paid from.');
      return;
    }

    if (!screenshotFile) {
      setError('Please upload your payment screenshot.');
      return;
    }

    if (
      normalizedTransactionId &&
      (normalizedTransactionId.length < 6 ||
        normalizedTransactionId.length > 40)
    ) {
      setError(
        'The optional transaction reference looks incomplete. Correct it or clear the field to submit for manual review.',
      );
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
        sourceBank,
        transactionId: transactionId.trim(),
        detectedAmount,
        ocrStatus:
          ocrStatus === 'reading' ? 'not_attempted' : ocrStatus,
        ocrConfidence,
        referenceDetectionSource:
          normalizedTransactionId
            ? referenceDetectionSource === 'none'
              ? 'manual'
              : referenceDetectionSource
            : 'none',
        amount: amountPaidNumber,
        paymentType: selectedLedgerPaymentType,
        note: note.trim(),
      });

      showToast({
        type: 'success',
        title: 'Payment proof submitted',
        message: 'Shop2Bhutan will review your screenshot and update the payment status.',
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
      <div className="w-full max-w-md rounded-[22px] bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-500 ring-1 ring-orange-100">
          <CheckCircle size={28} strokeWidth={2.1} />
        </div>
        <h1 className="mb-2 text-xl font-black text-slate-950">{title}</h1>
        <p className="mb-6 text-sm leading-6 text-slate-500">{description}</p>
        <button
          type="button"
          onClick={() => navigate(path)}
          className="h-12 w-full rounded-2xl bg-orange-500 font-extrabold text-white shadow-lg shadow-orange-500/20 transition active:scale-[0.98] active:bg-orange-600"
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );

  if (!authLoading && !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-orange-50 text-orange-500 ring-1 ring-orange-100">
          <CreditCard size={29} strokeWidth={2.1} />
        </div>
        <h1 className="mt-5 text-xl font-black text-slate-950">Sign in to upload payment</h1>
        <p className="mt-2 text-sm text-slate-500">Your payment details are securely linked to your account.</p>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="mt-6 h-12 rounded-2xl bg-orange-500 px-6 text-sm font-extrabold text-white shadow-lg shadow-orange-500/20 transition active:scale-[0.98]"
        >
          Sign In
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 pb-24">
        <div className="border-b border-slate-100 bg-white px-4 py-3">
          <div className="mx-auto max-w-2xl">
            <div className="h-5 w-40 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-2 h-4 w-24 animate-pulse rounded-full bg-slate-200" />
          </div>
        </div>
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-4">
          <div className="h-40 rounded-[22px] bg-white animate-pulse shadow-sm" />
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-32 rounded-[22px] bg-white animate-pulse shadow-sm" />
          ))}
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-red-50 text-red-500 ring-1 ring-red-100">
          <X size={29} strokeWidth={2.1} />
        </div>
        <h1 className="mt-5 text-xl font-black text-slate-950">Order not found</h1>
        <p className="mt-2 text-sm text-slate-500">{error || 'We could not find this order.'}</p>
        <button
          type="button"
          onClick={() => navigate('/orders')}
          className="mt-6 h-12 rounded-2xl bg-orange-500 px-6 text-sm font-extrabold text-white shadow-lg shadow-orange-500/20 transition active:scale-[0.98]"
        >
          Back to Orders
        </button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-md rounded-[22px] bg-white p-6 text-center shadow-sm ring-1 ring-slate-100">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
            <CheckCircle size={32} strokeWidth={2.1} />
          </div>
          <h1 className="mb-2 text-2xl font-black text-slate-950">Payment proof submitted</h1>
          <p className="mb-6 text-sm leading-6 text-slate-500">We will verify your payment and update your order.</p>
          <button
            type="button"
            onClick={() => navigate(`/order/${order.id}`)}
            className="h-12 w-full rounded-2xl bg-orange-500 font-extrabold text-white shadow-lg shadow-orange-500/20 transition active:scale-[0.98] active:bg-orange-600"
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
    <div className="min-h-screen bg-slate-50 pb-[calc(7.5rem+var(--s2b-safe-area-bottom,env(safe-area-inset-bottom,0px)))]">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">Payment</p>
            <h1 className="mt-0.5 text-[22px] font-black tracking-tight text-slate-950">Confirm Payment</h1>
            <p className="mt-0.5 truncate text-sm font-medium text-slate-400">#{order.orderNumber}</p>
          </div>
          <span className="mt-1.5 shrink-0 rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-bold text-orange-700 ring-1 ring-orange-200">
            Payment Pending
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4 space-y-4">
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-5 text-red-700">
            {error}
          </div>
        )}

        {/* ===== AMOUNT HERO - clean ===== */}
        <section className="overflow-hidden rounded-[22px] bg-slate-900 text-white shadow-lg shadow-slate-900/10">
          <div className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/50">Amount to pay now</p>
                <h2 className="mt-2 text-[32px] font-black tracking-tight text-white">
                  {formatCurrency(amountPaidNumber)}
                </h2>
                <p className="mt-1.5 max-w-[260px] text-sm font-medium leading-5 text-white/60">
                  {isJaigaonPickup
                    ? 'Pay the full Shop2Bhutan charges for this Jaigaon pickup order.'
                    : paymentSelection === 'advance'
                      ? `${minimumAdvancePercent}% advance selected. The remaining balance stays visible in your order.`
                      : paymentSummary.isPartiallyPaid
                        ? 'This payment clears the remaining verified balance.'
                        : 'Full payment selected for this quotation.'}
                </p>
              </div>

              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-white shadow-sm">
                <CreditCard size={28} strokeWidth={2.2} className="text-orange-500" />
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/70">
                {paymentSelection === 'advance'
                  ? `${minimumAdvancePercent}% advance`
                  : paymentSummary.isPartiallyPaid
                    ? 'Remaining payment'
                    : 'Full payment'}
              </span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/70">
                {getItemCount(order)} {getItemCount(order) === 1 ? 'item' : 'items'}
              </span>
              {selectedPaymentMethod && (
                <span className="max-w-[180px] truncate rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/70">
                  {selectedPaymentMethod.name}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 border-t border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/40">Total</p>
              <p className="mt-0.5 text-[13px] font-black text-white">{formatCurrency(quotationTotal)}</p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/40">Verified</p>
              <p className="mt-0.5 text-[13px] font-black text-emerald-400">{formatCurrency(paymentSummary.verifiedPaid)}</p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-white/40">After this</p>
              <p className="mt-0.5 text-[13px] font-black text-white">{formatCurrency(balanceAfterSelectedPayment)}</p>
            </div>
          </div>
        </section>

        {/* ===== SIMPLE STEP INDICATOR ===== */}
        <div className="flex items-center gap-3 px-1">
          <PaymentStep number={1} label="Amount" active />
          <div className="h-px flex-1 bg-slate-200" />
          <PaymentStep number={2} label="Method" />
          <div className="h-px flex-1 bg-slate-200" />
          <PaymentStep number={3} label="Proof" />
        </div>

        {/* ===== PAYMENT CHOICE ===== */}
        <section>
          <div className="mb-2.5 px-1">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-500">Payment choice</p>
            <h2 className="mt-0.5 text-lg font-black text-slate-950">Choose amount</h2>
          </div>

          <div className={`grid gap-2.5 ${isJaigaonPickup ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <button
              type="button"
              onClick={() => selectPaymentAmount(paymentSummary.isPartiallyPaid ? 'remaining' : 'full')}
              aria-pressed={paymentSelection === 'full' || paymentSelection === 'remaining'}
              className={`min-h-[100px] rounded-[18px] p-3.5 text-left transition active:scale-[0.98] ${
                paymentSelection === 'full' || paymentSelection === 'remaining'
                  ? 'bg-orange-50 ring-1 ring-orange-200'
                  : 'bg-white ring-1 ring-slate-200'
              }`}
            >
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                paymentSelection === 'full' || paymentSelection === 'remaining'
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-100 text-slate-500'
              }`}>
                <CreditCard size={17} strokeWidth={2} />
              </span>
              <p className="mt-2 text-[12px] font-extrabold text-slate-900">
                {isJaigaonPickup
                  ? 'Full S2B charges'
                  : paymentSummary.isPartiallyPaid
                    ? 'Remaining balance'
                    : 'Full payment'}
              </p>
              <p className="mt-0.5 text-[16px] font-black tracking-tight text-slate-950">{formatCurrency(fullPaymentAmount)}</p>
              <p className="mt-1 text-[9px] font-bold text-slate-400">
                {paymentSelection === 'full' || paymentSelection === 'remaining' ? (
                  <span className="text-orange-600">Selected</span>
                ) : 'Tap to select'}
              </p>
            </button>

            {!isJaigaonPickup && !paymentSummary.isPartiallyPaid && appSettings.partialPaymentEnabled && minimumAdvancePercent < 100 && minimumInitialPayment > 0 && (
              <button
                type="button"
                onClick={() => selectPaymentAmount('advance')}
                aria-pressed={paymentSelection === 'advance'}
                className={`min-h-[100px] rounded-[18px] p-3.5 text-left transition active:scale-[0.98] ${
                  paymentSelection === 'advance'
                    ? 'bg-violet-50 ring-1 ring-violet-200'
                    : 'bg-white ring-1 ring-slate-200'
                }`}
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  paymentSelection === 'advance' ? 'bg-violet-500 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  <Wallet size={17} strokeWidth={2} />
                </span>
                <p className="mt-2 text-[12px] font-extrabold text-slate-900">{minimumAdvancePercent}% advance</p>
                <p className="mt-0.5 text-[16px] font-black tracking-tight text-slate-950">{formatCurrency(advancePaymentAmount)}</p>
                <p className="mt-1 text-[9px] font-bold text-slate-400">
                  {paymentSelection === 'advance' ? (
                    <span className="text-violet-600">Selected</span>
                  ) : 'Tap to select'}
                </p>
              </button>
            )}
          </div>

          <p className="mt-2.5 px-1 text-[11px] font-medium text-slate-400 leading-5">
            {isJaigaonPickup ? (
              <>
                Jaigaon pickup requires the complete Shop2Bhutan charges. Advance payment is unavailable.
                {productReferenceTotal > 0 && (
                  <span className="mt-1 block">
                    Product value reference: <span className="font-bold text-slate-600">{formatCurrency(productReferenceTotal)}</span>.
                  </span>
                )}
              </>
            ) : paymentSummary.isPartiallyPaid ? (
              <>Your verified payment has been deducted. Only the remaining balance can be submitted.</>
            ) : (
              <>
                The minimum first payment is <span className="font-bold text-slate-600">{formatCurrency(minimumInitialPayment)}</span> ({minimumAdvancePercent}%).
              </>
            )}
          </p>
        </section>

        {/* ===== PAYMENT METHOD - list style ===== */}
        <section>
          <div className="mb-2.5 px-1">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-500">Payment method</p>
            <h2 className="mt-0.5 text-lg font-black text-slate-950">Where to pay</h2>
          </div>

          {paymentMethodsLoading ? (
            <div className="space-y-2">
              {[1, 2].map((item) => (
                <div key={item} className="h-20 rounded-[22px] bg-white animate-pulse ring-1 ring-slate-100" />
              ))}
            </div>
          ) : paymentMethods.length === 0 ? (
            <div className="rounded-[22px] bg-white px-4 py-4 text-sm font-medium leading-6 text-slate-600 ring-1 ring-slate-100">
              No active payment methods are available. Please contact Shop2Bhutan support.
            </div>
          ) : (
            <div className="rounded-[22px] bg-white ring-1 ring-slate-100 overflow-hidden">
              {paymentMethods.map((paymentMethod, index) => {
                const selected = selectedMethod === paymentMethod.id;
                const isFirst = index === 0;

                return (
                  <button
                    key={paymentMethod.id}
                    type="button"
                    onClick={() => setSelectedMethod(paymentMethod.id)}
                    className={`w-full text-left transition active:bg-slate-50 ${
                      !isFirst ? 'border-t border-slate-100' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 p-4">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        selected ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {paymentMethod.type === 'bank_transfer' ? <Building2 size={18} strokeWidth={2} /> : <Wallet size={18} strokeWidth={2} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-slate-950">{paymentMethod.name}</p>
                        <p className="text-[11px] font-bold text-slate-400">{paymentMethodTypeLabel(paymentMethod.type)}</p>
                      </div>
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                        selected ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-200'
                      }`}>
                        {selected && <CheckCircle size={12} strokeWidth={3} />}
                      </span>
                    </div>

                    {/* Expanded details for selected method */}
                    {selected && (
                      <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4">
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400">Account name</span>
                            <span className="text-sm font-black text-slate-950">{paymentMethod.accountName || '-'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-400">Account / code</span>
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-right font-mono text-sm font-black text-slate-950">
                                {paymentMethod.accountNumber || '-'}
                              </span>
                              {paymentMethod.accountNumber && (
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void copyToClipboard(paymentMethod.accountNumber, `acc-${paymentMethod.id}`);
                                  }}
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200 transition active:scale-95"
                                  aria-label="Copy account number or code"
                                >
                                  {copiedField === `acc-${paymentMethod.id}` ? (
                                    <CheckCircle size={13} className="text-emerald-500" strokeWidth={2.5} />
                                  ) : (
                                    <Copy size={13} strokeWidth={2} />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                          {paymentMethod.bankName && (
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-400">Bank</span>
                              <span className="text-sm font-black text-slate-950">{paymentMethod.bankName}</span>
                            </div>
                          )}
                          {paymentMethod.branch && (
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-400">Branch</span>
                              <span className="text-sm font-black text-slate-950">{paymentMethod.branch}</span>
                            </div>
                          )}
                        </div>
                        {paymentMethod.instructions && (
                          <p className="mt-3 rounded-xl bg-white p-3 text-xs font-medium leading-5 text-slate-500 ring-1 ring-slate-100">
                            {paymentMethod.instructions}
                          </p>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <p className="mt-2 px-1 text-[11px] font-medium text-slate-400">Tap a method to view account details and copy.</p>
        </section>

        {/* ===== UPLOAD ===== */}
        <section>
          <div className="mb-2.5 px-1">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-500">Payment proof</p>
            <h2 className="mt-0.5 text-lg font-black text-slate-950">Upload screenshot</h2>
          </div>

          <div className="rounded-[22px] bg-white p-4 ring-1 ring-slate-100">
            <div className="mb-4">
              <div className="flex items-center justify-between gap-3">
                <label className="text-[11px] font-black text-slate-700">
                  Paid from bank <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] font-semibold text-slate-400">
                  Select the app used to pay
                </span>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2">
                {PAYMENT_SOURCE_BANKS.map((bank) => {
                  const selected = sourceBank === bank.id;

                  return (
                    <button
                      key={bank.id}
                      type="button"
                      onClick={() => {
                        if (sourceBank !== bank.id) {
                          resetOcrResult();
                          setTransactionId('');
                          setSourceBank(bank.id);
                        }
                        setError('');
                      }}
                      aria-pressed={selected}
                      className={`relative min-h-[68px] rounded-2xl border px-2 py-2.5 text-center transition active:scale-[0.98] ${
                        selected
                          ? 'border-orange-300 bg-orange-50 text-orange-700 ring-2 ring-orange-500/10'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                      }`}
                    >
                      {selected && (
                        <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-white">
                          <CheckCircle size={10} strokeWidth={3} />
                        </span>
                      )}
                      <span className="block text-xs font-black">
                        {bank.shortName}
                      </span>
                      <span className="mt-1 block text-[9px] font-semibold leading-3 text-slate-400">
                        {bank.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <input
              ref={screenshotInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />

            {!screenshotPreview ? (
              <button
                type="button"
                onClick={() => void openPaymentProofPicker()}
                disabled={openingCamera}
                className="flex min-h-[180px] w-full cursor-pointer flex-col items-center justify-center rounded-[18px] border-2 border-dashed border-slate-200 bg-slate-50 px-5 text-center transition active:scale-[0.99] disabled:cursor-wait disabled:opacity-70"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                  {openingCamera ? (
                    <Loader2 size={22} className="animate-spin" />
                  ) : (
                    <Upload size={22} strokeWidth={2} />
                  )}
                </span>
                <p className="mt-3 text-sm font-black text-slate-800">
                  {openingCamera
                    ? 'Opening camera or gallery...'
                    : 'Add payment screenshot'}
                </p>
                <p className="mt-1 text-[11px] font-medium text-slate-400">
                  Take Photo or Choose from Gallery &middot; Max 5MB
                </p>
              </button>
            ) : (
              <div className="relative overflow-hidden rounded-[18px] bg-slate-50 ring-1 ring-slate-100">
                <img
                  src={screenshotPreview}
                  alt="Payment screenshot"
                  className="max-h-[62vh] min-h-52 w-full object-contain p-2"
                />
                <span className="absolute bottom-3 left-3 rounded-lg bg-slate-950/75 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur">
                  Screenshot ready
                </span>
                <button
                  type="button"
                  onClick={() => void openPaymentProofPicker()}
                  disabled={openingCamera}
                  className="absolute right-3 top-3 rounded-lg bg-white px-3 py-1.5 text-xs font-black text-slate-700 shadow-sm ring-1 ring-slate-100 transition active:scale-95"
                >
                  Change
                </button>
              </div>
            )}

            {screenshotFile && sourceBank && (
              <div
                className={`mt-4 rounded-2xl border px-3.5 py-3 ${
                  ocrStatus === 'reading'
                    ? 'border-blue-100 bg-blue-50/70'
                    : ocrStatus === 'detected'
                      ? 'border-emerald-100 bg-emerald-50/70'
                      : ocrStatus === 'partial'
                        ? 'border-amber-100 bg-amber-50/70'
                        : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      ocrStatus === 'reading'
                        ? 'bg-blue-100 text-blue-600'
                        : ocrStatus === 'detected'
                          ? 'bg-emerald-100 text-emerald-600'
                          : ocrStatus === 'partial'
                            ? 'bg-amber-100 text-amber-600'
                            : 'bg-white text-slate-500 ring-1 ring-slate-200'
                    }`}
                  >
                    {ocrStatus === 'reading' ? (
                      <Loader2 size={17} className="animate-spin" />
                    ) : ocrStatus === 'detected' ? (
                      <Sparkles size={17} />
                    ) : ocrStatus === 'partial' ? (
                      <AlertTriangle size={17} />
                    ) : (
                      <ScanLine size={17} />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-black text-slate-900">
                        {ocrStatus === 'reading'
                          ? 'Reading payment screenshot'
                          : ocrStatus === 'detected'
                            ? 'Payment details detected'
                            : ocrStatus === 'partial'
                              ? 'Some details detected'
                              : ocrStatus === 'failed'
                                ? 'Automatic reading unavailable'
                                : 'Manual review will be used'}
                      </p>

                      {ocrStatus !== 'reading' &&
                        ocrStatus !== 'not_attempted' && (
                          <button
                            type="button"
                            onClick={() => void runPaymentProofOcr()}
                            className="inline-flex h-7 items-center gap-1 rounded-lg bg-white px-2 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200"
                          >
                            <RefreshCw size={11} />
                            Retry
                          </button>
                        )}
                    </div>

                    <p className="mt-1 text-[11px] leading-5 text-slate-500">
                      {ocrMessage ||
                        'The app will try to detect the transaction reference and amount. Detection is optional and never verifies the payment automatically.'}
                    </p>

                    {ocrStatus === 'reading' && (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-blue-100">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-[width] duration-300"
                          style={{
                            width: `${Math.max(
                              8,
                              Math.round(ocrProgress * 100),
                            )}%`,
                          }}
                        />
                      </div>
                    )}

                    {ocrStatus !== 'reading' &&
                      ocrStatus !== 'not_attempted' && (
                        <div className="mt-2 grid grid-cols-2 gap-2">
                          <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-100">
                            <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">
                              Reference
                            </p>
                            <p className="mt-1 truncate font-mono text-[11px] font-bold text-slate-800">
                              {normalizedTransactionId
                                ? transactionId
                                : 'Not detected'}
                            </p>
                          </div>

                          <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-100">
                            <p className="text-[9px] font-black uppercase tracking-wide text-slate-400">
                              Screenshot amount
                            </p>
                            <p
                              className={`mt-1 text-[11px] font-bold ${
                                detectedAmount === null
                                  ? 'text-slate-500'
                                  : detectedAmountMatches
                                    ? 'text-emerald-600'
                                    : 'text-red-600'
                              }`}
                            >
                              {detectedAmount === null
                                ? 'Not detected'
                                : `${formatCurrency(detectedAmount)} ${
                                    detectedAmountMatches
                                      ? '✓'
                                      : '— check amount'
                                  }`}
                            </p>
                          </div>
                        </div>
                      )}

                    {ocrConfidence > 0 &&
                      ocrStatus !== 'reading' && (
                        <p className="mt-2 text-[9px] font-semibold text-slate-400">
                          Detection confidence: {ocrConfidence}% · Admin
                          verification is still required.
                        </p>
                      )}
                  </div>
                </div>
              </div>
            )}

            <div className="mt-4 space-y-3 pt-4 border-t border-slate-100">
              <div>
                <label className="text-[11px] font-black text-slate-700">
                  {selectedSourceBank?.referenceLabel ?? 'Transaction Reference'}
                  <span className="ml-1 font-semibold text-slate-400">
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  inputMode="text"
                  autoCapitalize="characters"
                  maxLength={60}
                  value={transactionId}
                  onChange={(event) => {
                    const value = event.target.value;
                    manualReferenceEditedRef.current = true;
                    setTransactionId(value);
                    setReferenceDetectionSource(
                      normalizePaymentReferenceInput(value)
                        ? 'manual'
                        : 'none',
                    );
                    setError('');
                  }}
                  disabled={!selectedSourceBank}
                  placeholder={
                    ocrStatus === 'reading'
                      ? 'Reading automatically...'
                      : selectedSourceBank?.referencePlaceholder ??
                        'Select paid-from bank first'
                  }
                  className="mt-1.5 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                />
                <p className="mt-1.5 text-[10px] font-medium leading-4 text-slate-400">
                  {selectedSourceBank?.referenceHelp ??
                    'Choose BoB, DK Bank, or BNB to see the correct reference field.'}
                  {normalizedTransactionId && (
                    <span className="ml-1 font-bold text-slate-500">
                      {referenceDetectionSource === 'ocr'
                        ? 'Detected automatically.'
                        : referenceDetectionSource === 'manual'
                          ? 'Entered manually.'
                          : ''}
                    </span>
                  )}
                </p>
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-700">Note for Shop2Bhutan</label>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Add a note only when needed"
                  rows={2}
                  className="mt-1.5 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:ring-2 focus:ring-orange-500/10"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ===== SECURITY - inline, not a card ===== */}
        <div className="flex items-start gap-2.5 px-1 py-1">
          <ShieldCheck size={14} strokeWidth={2.5} className="text-emerald-500 shrink-0 mt-0.5" />
          <p className="text-[11px] font-medium text-slate-400 leading-5">
            Your payment proof is reviewed securely. We verify amount, method, and transaction details before updating your order.
          </p>
        </div>

        {/* ===== SUBMIT - clean full-width button ===== */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || paymentMethodsLoading}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[18px] bg-orange-500 text-sm font-black text-white shadow-md shadow-orange-500/15 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-orange-300"
        >
          <Upload size={17} strokeWidth={2.5} />
          <span className="truncate">{submitButtonLabel}</span>
        </button>

        {!canSubmit ? (
          <p className="text-center text-[11px] font-semibold text-slate-400 leading-5 -mt-2">
            {!sourceBank
              ? 'Select the bank you paid from.'
              : !screenshotFile
                ? 'Upload a clear payment screenshot above.'
                : ocrStatus === 'reading'
                  ? 'Reading the screenshot now. Submission will unlock when the scan finishes or falls back to manual review.'
                  : normalizedTransactionId &&
                      (normalizedTransactionId.length < 6 ||
                        normalizedTransactionId.length > 40)
                    ? 'Correct the optional reference or clear the field.'
                    : 'Complete the required payment details to enable submission.'}
          </p>
        ) : (
          <p className="text-center text-[11px] font-semibold text-slate-400 leading-5 -mt-2">
            Journal Number/RRNO is optional. Shop2Bhutan will verify the proof
            against the bank statement.
          </p>
        )}
      </main>


    </div>
  );
}
