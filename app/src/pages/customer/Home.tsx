import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  ChevronDown,
  ClipboardList,
  CreditCard,
  FileText,
  Headphones,
  Link2,
  MapPin,
  PackageCheck,
  ScanLine,
  ShieldCheck,
  Tag,
  Truck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import Logo from '@/components/shared/Logo';
import { getUnreadNotificationCount } from '@/lib/customerOrders';

type StoreItem = {
  name: string;
  platform: string;
  logo: string;
};

const quickActions = [
  { icon: Link2, label: 'Paste Link', path: '/paste-link' },
  { icon: ClipboardList, label: 'My Orders', path: '/orders' },
  { icon: Truck, label: 'Track Order', path: '/orders' },
  { icon: Headphones, label: 'Support', path: '/support' },
];

const steps = [
  { icon: Link2, title: 'Send link', text: 'Paste product link' },
  { icon: FileText, title: 'Get quote', text: 'We verify details' },
  { icon: CreditCard, title: 'Pay', text: 'Upload payment' },
  { icon: PackageCheck, title: 'Receive', text: 'Track delivery' },
];

const trustItems = [
  { icon: ShieldCheck, title: 'Secure', text: 'Trusted service' },
  { icon: Tag, title: 'Verified', text: 'Human checked' },
  { icon: Headphones, title: 'Support', text: 'Real humans' },
];

const stores: StoreItem[] = [
  { name: 'Amazon', platform: 'amazon', logo: '/store-logos/amazon.png' },
  { name: 'Flipkart', platform: 'flipkart', logo: '/store-logos/flipkart.png' },
  { name: 'Myntra', platform: 'myntra', logo: '/store-logos/myntra.png' },
  { name: 'Meesho', platform: 'meesho', logo: '/store-logos/meesho.png' },
];

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StoreLogo({ store }: { store: StoreItem }) {
  const [logoAvailable, setLogoAvailable] = useState(true);

  if (!logoAvailable) {
    return (
      <span className="text-[10px] font-extrabold leading-none text-orange-600">
        {store.name}
      </span>
    );
  }

  return (
    <img
      src={store.logo}
      alt={store.name}
      className="max-h-4 max-w-[58px] object-contain"
      loading="lazy"
      onError={() => setLogoAvailable(false)}
    />
  );
}



/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function Home() {
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();
  const { user: appUser } = useApp();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!authUser || authLoading) {
      setUnreadCount(0);
      return;
    }
    try {
      const count = await getUnreadNotificationCount(authUser.id);
      setUnreadCount(count);
    } catch (error) {
      console.warn('[Home] Notification count skipped:', error);
      setUnreadCount(0);
    }
  }, [authLoading, authUser]);

  useEffect(() => {
    void refreshUnreadCount();
  }, [refreshUnreadCount]);

  useEffect(() => {
    const handleNotificationsUpdated = () => {
      void refreshUnreadCount();
    };
    window.addEventListener('shop2bhutan:notifications-updated', handleNotificationsUpdated);
    window.addEventListener('focus', handleNotificationsUpdated);
    return () => {
      window.removeEventListener('shop2bhutan:notifications-updated', handleNotificationsUpdated);
      window.removeEventListener('focus', handleNotificationsUpdated);
    };
  }, [refreshUnreadCount]);

  const deliveryLabel = appUser?.dzongkhag || 'Thimphu';

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* ========== HEADER ========== */}
      <header className="sticky top-0 z-40 border-b border-orange-100/50 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-4 pt-3 pb-3">
          <div className="flex items-center justify-between">
            <Logo size="sm" />

            {/* Notification bell */}
            <button
              type="button"
              onClick={() => navigate('/notifications')}
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-neutral-700 transition-all active:scale-95 active:bg-orange-100"
              aria-label="Notifications"
            >
              <Bell size={18} strokeWidth={1.8} />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Location pill */}
          <button
            type="button"
            onClick={() => navigate('/account')}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-left text-xs font-medium text-neutral-600 transition-colors active:bg-orange-100"
          >
            <MapPin size={13} className="text-orange-500" />
            <span>Delivering to {deliveryLabel}</span>
            <ChevronDown size={12} className="ml-0.5 text-neutral-400" />
          </button>
        </div>
      </header>

      {/* ========== MAIN ========== */}
      <main className="mx-auto max-w-3xl px-4 pb-10 pt-4">

        {/* ----- Hero CTA Card ----- */}
        <section className="relative overflow-hidden rounded-[1.5rem] bg-white p-5 shadow-[0_2px_16px_rgba(0,0,0,0.04)] ring-1 ring-orange-100/60 sm:p-6">
          {/* Soft gradient orb in corner */}
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-orange-100/30 blur-3xl" />

          <div className="relative flex items-start gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-100 to-amber-100 text-orange-500 shadow-sm">
              <Link2 size={22} />
            </span>
            <div className="min-w-0 pt-0.5">
              <h1 className="text-[1.05rem] font-bold leading-snug text-gray-950 sm:text-lg">
                Paste a product link or upload a screenshot
              </h1>
              <p className="mt-1 text-[0.8rem] leading-relaxed text-neutral-500">
                We verify the price, prepare a quotation, and handle everything else.
              </p>
            </div>
          </div>

          {/* Paste-link input bar */}
          <button
            type="button"
            onClick={() => navigate('/paste-link')}
            className="relative mt-4 flex h-[3rem] w-full items-center gap-3 rounded-2xl border border-neutral-200/80 bg-neutral-50/80 px-4 text-left text-[0.8rem] text-neutral-400 transition-all hover:border-orange-200 hover:bg-orange-50/40 active:border-orange-300"
          >
            <Link2 size={17} className="shrink-0 text-neutral-400" />
            <span className="min-w-0 flex-1 truncate">
              Paste Amazon, Flipkart, Myntra or Meesho link
            </span>
            <ScanLine size={17} className="shrink-0 text-neutral-400" />
          </button>

          {/* Primary CTA */}
          <button
            type="button"
            onClick={() => navigate('/paste-link')}
            className="mt-3 flex h-[3rem] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-sm font-bold text-white shadow-lg shadow-orange-200/50 transition-transform active:scale-[0.98]"
          >
            Request Quotation
            <ArrowRight size={17} />
          </button>
        </section>

        {/* ----- Shop From India Banner ----- */}
        <section
          className="relative mt-4 overflow-hidden rounded-[1.35rem] border border-orange-100/80 bg-orange-50/60 p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] sm:p-5"
          style={{
            backgroundImage:
              "linear-gradient(100deg, rgba(255,247,237,0.97) 0%, rgba(255,247,237,0.90) 45%, rgba(255,247,237,0.55) 100%), url('/home-india-bg.jpg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center right',
          }}
        >
          <div className="relative z-10 flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/90 text-orange-500 shadow-sm ring-1 ring-orange-100">
              <ShieldCheck size={21} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[0.92rem] font-bold text-gray-950 sm:text-base">
                Shop from India, delivered to Bhutan
              </h2>
              <p className="mt-1 text-[0.78rem] leading-relaxed text-neutral-600">
                Clear quotation, verified product details, and order tracking from your account.
              </p>

              {/* Store pills */}
              <div className="mt-3.5 grid grid-cols-4 gap-2">
                {stores.map((store) => (
                  <button
                    key={store.name}
                    type="button"
                    onClick={() =>
                      navigate('/paste-link', {
                        state: { sourcePlatform: store.platform },
                      })
                    }
                    className="flex h-9 items-center justify-center rounded-full bg-white/95 px-2 shadow-sm ring-1 ring-orange-100/70 transition-all hover:bg-white hover:shadow active:scale-95"
                    aria-label={`Request quotation from ${store.name}`}
                  >
                    <StoreLogo store={store} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ----- Quick Actions Grid ----- */}
        <section className="mt-4 rounded-[1.35rem] bg-white p-3 shadow-[0_2px_12px_rgba(0,0,0,0.03)] ring-1 ring-neutral-100/80">
          <div className="grid grid-cols-4 divide-x divide-neutral-100/70">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => navigate(action.path)}
                  className="group flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-2xl px-1.5 py-2.5 text-center transition-colors hover:bg-orange-50/60 active:bg-orange-100/40"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-[0.9rem] bg-orange-50 text-orange-500 shadow-sm ring-1 ring-orange-100/40 transition-transform group-active:scale-95">
                    <Icon size={19} />
                  </span>
                  <span className="text-[0.65rem] font-semibold leading-tight tracking-wide text-neutral-700 sm:text-[0.7rem]">
                    {action.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ----- How It Works ----- */}
        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between px-0.5">
            <h2 className="text-base font-bold text-gray-950">How it works</h2>
            <button
              type="button"
              onClick={() => navigate('/support')}
              className="text-xs font-semibold text-orange-600 transition-colors active:text-orange-700"
            >
              Learn more
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2 rounded-[1.35rem] bg-white p-3.5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] ring-1 ring-neutral-100/80">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              const isLast = idx === steps.length - 1;
              return (
                <div key={step.title} className="relative text-center">
                  {/* Connector line */}
                  {!isLast && (
                    <div className="pointer-events-none absolute left-[calc(50%+1.25rem)] top-5 hidden h-px w-[calc(100%-2.5rem)] bg-gradient-to-r from-orange-200 to-orange-100 min-[400px]:block" />
                  )}

                  <span className="relative z-10 mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-orange-500 ring-1 ring-orange-100/40">
                    <Icon size={18} />
                  </span>
                  <p className="mt-2.5 text-[0.7rem] font-bold leading-tight text-gray-900">
                    {step.title}
                  </p>
                  <p className="mt-0.5 hidden text-[0.6rem] leading-4 text-neutral-500 min-[380px]:block">
                    {step.text}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ----- Trust Badges ----- */}
        <section className="mt-4 grid grid-cols-3 divide-x divide-neutral-100/70 rounded-[1.35rem] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] ring-1 ring-neutral-100/80">
          {trustItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="flex flex-col items-center px-1 text-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-500 ring-1 ring-orange-100/40">
                  <Icon size={18} />
                </span>
                <p className="mt-2 text-[0.7rem] font-bold leading-tight text-neutral-700">
                  {item.title}
                </p>
                <p className="mt-0.5 hidden text-[0.6rem] leading-4 text-neutral-400 min-[380px]:block">
                  {item.text}
                </p>
              </div>
            );
          })}
        </section>

        {/* ----- Footer Note ----- */}
        <p className="mt-6 px-2 text-center text-[0.65rem] leading-relaxed text-neutral-400">
          Orders accepted from all 20 dzongkhags. Delivery currently available in
          Thimphu, Paro, and Phuntsholing/Chhukha.
        </p>
      </main>
    </div>
  );
}
