import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LockKeyhole, ShoppingBag, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type RequireAuthProps = {
  children: ReactNode;
  title?: string;
  message?: string;
  primaryLabel?: string;
};

function getReturnTo(location: ReturnType<typeof useLocation>) {
  return `${location.pathname}${location.search}`;
}

export default function RequireAuth({
  children,
  title = 'Sign in required',
  message = 'Please sign in or create an account to continue securely.',
  primaryLabel = 'Sign In',
}: RequireAuthProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();

  const returnTo = getReturnTo(location);

  if (loading) {
    return (
      <div className="min-h-[70vh] bg-neutral-50 px-4 py-8">
        <div className="mx-auto max-w-md space-y-4">
          <div className="h-32 animate-pulse rounded-[2rem] bg-white shadow-sm" />
          <div className="h-20 animate-pulse rounded-3xl bg-white shadow-sm" />
          <div className="h-20 animate-pulse rounded-3xl bg-white shadow-sm" />
        </div>
      </div>
    );
  }

  if (user) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-[70vh] bg-neutral-50 px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-neutral-100">
          <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 px-5 py-6 text-white">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur">
              <LockKeyhole size={27} />
            </div>
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-white/90">{message}</p>
          </div>

          <div className="space-y-3 p-5">
            <button
              type="button"
              onClick={() => navigate('/login', { state: { returnTo } })}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 text-sm font-bold text-white shadow-sm transition hover:bg-amber-600"
            >
              <ShoppingBag size={18} />
              {primaryLabel}
            </button>

            <button
              type="button"
              onClick={() => navigate('/register', { state: { returnTo } })}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-neutral-100 text-sm font-bold text-neutral-800 transition hover:bg-neutral-200"
            >
              <UserPlus size={18} />
              Create Account
            </button>

            <button
              type="button"
              onClick={() => navigate('/')}
              className="h-11 w-full rounded-2xl text-sm font-semibold text-neutral-500 transition hover:bg-neutral-50"
            >
              Continue browsing
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-3xl border border-amber-100 bg-amber-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
            Why sign in?
          </p>
          <p className="mt-1 text-sm leading-6 text-amber-800">
            Orders, quotations, payment uploads, addresses, and parcel bookings need a secure customer account so you can track everything later.
          </p>
        </div>
      </div>
    </div>
  );
}
