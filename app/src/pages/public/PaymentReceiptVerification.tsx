import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  BadgeCheck,
  CircleAlert,
  Headphones,
  Home,
  Loader2,
  ReceiptText,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

const BHUTAN_TIME_ZONE = 'Asia/Thimphu';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type VerifiedReceipt = {
  receipt_number: string;
  order_number: string;
  amount: number;
  currency: string;
  payment_type: string;
  payment_method: string;
  verified_at: string;
};

function formatCurrency(amount: number, currency: string) {
  const value = Number(amount || 0).toLocaleString();

  if (String(currency || '').toUpperCase() === 'BTN') {
    return `Nu. ${value}`;
  }

  return `${String(currency || 'BTN').toUpperCase()} ${value}`;
}

function formatDateTime(value?: string) {
  if (!value) return 'Not available';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';

  const formatted = new Intl.DateTimeFormat('en-GB', {
    timeZone: BHUTAN_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);

  return `${formatted.replace(
    /\b(am|pm)\b/gi,
    (period) => period.toUpperCase(),
  )} BTT`;
}

function readableText(value?: string) {
  const clean = String(value || '').trim();
  if (!clean) return 'Not provided';

  return clean
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default function PaymentReceiptVerification() {
  const { token = '' } = useParams();
  const cleanToken = useMemo(() => token.trim(), [token]);
  const [receipt, setReceipt] = useState<VerifiedReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function verifyReceipt() {
      if (!cleanToken || !UUID_PATTERN.test(cleanToken)) {
        setReceipt(null);
        setError('');
        setLoading(false);
        return;
      }

      setLoading(true);
      setReceipt(null);
      setError('');

      try {
        const { data, error: rpcError } = await supabase.rpc(
          'verify_payment_receipt',
          { p_token: cleanToken },
        );

        if (rpcError) throw rpcError;
        if (!active) return;

        const row = Array.isArray(data) ? data[0] : data;
        setReceipt(row ? (row as VerifiedReceipt) : null);
      } catch (verificationError) {
        console.error(
          '[PaymentReceiptVerification] Verification failed:',
          verificationError,
        );

        if (!active) return;

        setError(
          verificationError instanceof Error
            ? verificationError.message
            : 'Unable to verify this receipt right now.',
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void verifyReceipt();

    return () => {
      active = false;
    };
  }, [cleanToken]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 flex justify-center">
          <img
            src="/brand/logo-full-ui.png"
            alt="Shop2Bhutan"
            className="h-14 w-auto object-contain"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = '/brand/logo-full-final.png';
            }}
          />
        </div>

        {loading ? (
          <section className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-900/5">
            <Loader2
              size={30}
              className="mx-auto animate-spin text-orange-500"
            />
            <h1 className="mt-4 text-xl font-black text-slate-950">
              Verifying receipt
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Checking this payment directly with Shop2Bhutan.
            </p>
          </section>
        ) : receipt ? (
          <section className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-white shadow-xl shadow-slate-900/5">
            <div className="bg-emerald-50 px-6 py-6 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-100">
                <BadgeCheck size={34} strokeWidth={2.3} />
              </span>
              <p className="mt-4 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                Valid Shop2Bhutan receipt
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
                Payment Verified
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                This receipt matches a verified payment in the
                Shop2Bhutan system.
              </p>
            </div>

            <div className="space-y-5 p-6">
              <div className="rounded-3xl bg-slate-950 p-5 text-white">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
                  Amount received
                </p>
                <p className="mt-1 text-3xl font-black tracking-tight">
                  {formatCurrency(receipt.amount, receipt.currency)}
                </p>
              </div>

              <div className="divide-y divide-slate-100 rounded-3xl border border-slate-100 bg-white px-4">
                {[
                  ['Receipt number', receipt.receipt_number],
                  ['Order number', receipt.order_number],
                  ['Payment type', readableText(receipt.payment_type)],
                  ['Payment method', readableText(receipt.payment_method)],
                  ['Verified', formatDateTime(receipt.verified_at)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-start justify-between gap-5 py-3.5"
                  >
                    <span className="text-xs font-semibold text-slate-500">
                      {label}
                    </span>
                    <span className="max-w-[65%] break-words text-right text-sm font-black text-slate-900">
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-start gap-3 rounded-3xl bg-blue-50 p-4 text-blue-800">
                <ShieldCheck size={20} className="mt-0.5 shrink-0" />
                <p className="text-xs leading-5">
                  Customer addresses, phone numbers, payment proofs,
                  internal IDs, and admin notes remain private.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/"
                  className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 text-xs font-black text-white transition active:scale-[0.98]"
                >
                  <Home size={15} />
                  Shop2Bhutan
                </Link>

                <Link
                  to="/support"
                  className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition active:scale-[0.98]"
                >
                  <Headphones size={15} />
                  Support
                </Link>
              </div>
            </div>
          </section>
        ) : (
          <section className="rounded-[2rem] border border-red-100 bg-white p-7 text-center shadow-xl shadow-slate-900/5">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
              {error ? (
                <CircleAlert size={31} />
              ) : (
                <ReceiptText size={31} />
              )}
            </span>

            <h1 className="mt-4 text-xl font-black text-slate-950">
              {error ? 'Verification unavailable' : 'Receipt not found'}
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              {error
                ? 'We could not check this receipt right now. Please try again or contact Shop2Bhutan support.'
                : 'This link does not match a verified Shop2Bhutan payment. Check that the complete QR code was scanned.'}
            </p>

            {error && (
              <p className="mt-3 rounded-2xl bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">
                {error}
              </p>
            )}

            <div className="mt-6 grid grid-cols-2 gap-2">
              <Link
                to="/"
                className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-xs font-black text-white"
              >
                <Home size={15} />
                Home
              </Link>

              <Link
                to="/support"
                className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700"
              >
                <Headphones size={15} />
                Support
              </Link>
            </div>
          </section>
        )}

        <p className="mt-5 text-center text-[11px] leading-5 text-slate-400">
          Shop2Bhutan secure payment receipt verification
        </p>
      </div>
    </main>
  );
}
