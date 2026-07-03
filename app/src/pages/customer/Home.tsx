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

/* ------------------------------------------------------------------ */
/*  Accent color system                                                */
/* ------------------------------------------------------------------ */

const A = {
  orange: { bg: 'bg-orange-50', text: 'text-orange-500' },
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-600' },
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-500' },
  emerald:{ bg: 'bg-emerald-50',text: 'text-emerald-500' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-500' },
} as const;

type AccentKey = keyof typeof A;

const quickActions: { icon: typeof Link2; label: string; path: string; accent: AccentKey }[] = [
  { icon: Link2,         label: 'Paste Link', path: '/paste-link', accent: 'orange' },
  { icon: ClipboardList, label: 'My Orders',  path: '/orders',     accent: 'violet' },
  { icon: Truck,         label: 'Track Order',path: '/orders',     accent: 'blue' },
  { icon: Headphones,    label: 'Support',    path: '/support',    accent: 'emerald' },
];

const steps: { icon: typeof Link2; title: string; text: string; accent: AccentKey }[] = [
  { icon: Link2,      title: 'Send link', text: 'Paste product link', accent: 'orange' },
  { icon: FileText,   title: 'Get quote', text: 'We verify details',  accent: 'violet' },
  { icon: CreditCard, title: 'Pay',       text: 'Upload payment',     accent: 'amber' },
  { icon: PackageCheck,title:'Receive',   text: 'Track delivery',     accent: 'emerald' },
];

const trustItems: { icon: typeof ShieldCheck; title: string; text: string; accent: AccentKey }[] = [
  { icon: ShieldCheck, title: 'Secure',  text: 'Trusted service', accent: 'emerald' },
  { icon: Tag,         title: 'Verified',text: 'Human checked',   accent: 'violet' },
  { icon: Headphones,  title: 'Support', text: 'Real humans',     accent: 'blue' },
];

const stores: StoreItem[] = [
  { name: 'Amazon',   platform: 'amazon',   logo: '/store-logos/amazon.png' },
  { name: 'Flipkart', platform: 'flipkart', logo: '/store-logos/flipkart.png' },
  { name: 'Myntra',   platform: 'myntra',   logo: '/store-logos/myntra.png' },
  { name: 'Meesho',   platform: 'meesho',   logo: '/store-logos/meesho.png' },
];

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StoreLogo({ store }: { store: StoreItem }) {
  const [logoAvailable, setLogoAvailable] = useState(true);
  if (!logoAvailable) {
    return (
      <span className="text-[10px] font-extrabold leading-none text-orange-600">{store.name}</span>
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
    if (!authUser || authLoading) { setUnreadCount(0); return; }
    try {
      const count = await getUnreadNotificationCount(authUser.id);
      setUnreadCount(count);
    } catch (error) {
      console.warn('[Home] Notification count skipped:', error);
      setUnreadCount(0);
    }
  }, [authLoading, authUser]);

  useEffect(() => { void refreshUnreadCount(); }, [refreshUnreadCount]);

  useEffect(() => {
    const handler = () => { void refreshUnreadCount(); };
    window.addEventListener('shop2bhutan:notifications-updated', handler);
    window.addEventListener('focus', handler);
    return () => {
      window.removeEventListener('shop2bhutan:notifications-updated', handler);
      window.removeEventListener('focus', handler);
    };
  }, [refreshUnreadCount]);

  const deliveryLabel = appUser?.dzongkhag || 'Thimphu';

  return (
    <div className="min-h-screen bg-white">
      {/* ========== HEADER ========== */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="mx-auto max-w-3xl px-4 pb-3 pt-3">
          <div className="flex items-center justify-between">
            <Logo size="sm" />
            <button
              type="button"
              onClick={() => navigate('/notifications')}
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition-colors hover:bg-gray-100 active:bg-gray-200"
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

          <button
            type="button"
            onClick={() => navigate('/account')}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-gray-50 border border-gray-100 px-3 py-1.5 text-left text-xs font-medium text-gray-600 transition-colors active:bg-gray-100"
          >
            <MapPin size={13} className="text-orange-500" />
            <span>Delivering to {deliveryLabel}</span>
            <ChevronDown size={12} className="ml-0.5 text-gray-400" />
          </button>
        </div>
      </header>

      {/* ========== MAIN ========== */}
      <main className="mx-auto max-w-3xl px-4 pb-10 pt-4">

        {/* ----- Hero CTA Card ----- */}
        <section className="bg-white border border-gray-100 rounded-2xl p-5">
          <div className="flex items-start gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
              <Link2 size={22} strokeWidth={2.5} />
            </span>
            <div className="min-w-0 pt-0.5">
              <h1 className="text-[1.05rem] font-bold leading-snug text-black sm:text-lg">
                Paste a product link or upload a screenshot
              </h1>
              <p className="mt-1 text-[0.8rem] leading-relaxed text-gray-500">
                We verify the price, prepare a quotation, and handle everything else.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/paste-link')}
            className="mt-4 flex h-12 w-full items-center gap-3 rounded-xl bg-gray-50 px-4 text-left text-sm text-gray-400 border-2 border-transparent transition-all focus-within:border-orange-500 focus-within:bg-white"
          >
            <Link2 size={17} className="shrink-0 text-gray-400" />
            <span className="min-w-0 flex-1 truncate">Paste Amazon, Flipkart, Myntra or Meesho link</span>
            <ScanLine size={17} className="shrink-0 text-gray-400" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/paste-link')}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 text-sm font-semibold text-white transition-colors hover:bg-orange-600 active:scale-[0.98]"
          >
            Request Quotation <ArrowRight size={17} />
          </button>
        </section>

        {/* ----- Shop From India Banner ----- */}
        <section className="mt-4 bg-gray-50 rounded-2xl border border-gray-100 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white border border-gray-100 text-emerald-600">
              <ShieldCheck size={21} strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[0.92rem] font-bold text-black sm:text-base">Shop from India, delivered to Bhutan</h2>
              <p className="mt-1 text-[0.78rem] leading-relaxed text-gray-600">
                Clear quotation, verified product details, and order tracking from your account.
              </p>
              <div className="mt-3.5 grid grid-cols-4 gap-2">
                {stores.map((store) => (
                  <button
                    key={store.name}
                    type="button"
                    onClick={() => navigate('/paste-link', { state: { sourcePlatform: store.platform } })}
                    className="flex h-9 items-center justify-center rounded-lg bg-white border border-gray-100 transition-all hover:bg-gray-50 active:scale-95"
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
        <section className="mt-4 bg-white border border-gray-100 rounded-2xl p-3">
          <div className="grid grid-cols-4 gap-1">
            {quickActions.map((action) => {
              const Icon = action.icon;
              const c = A[action.accent];
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => navigate(action.path)}
                  className={`group flex flex-col items-center justify-center gap-2 rounded-xl px-1.5 py-3 text-center transition-colors hover:bg-gray-50 active:bg-gray-100`}
                >
                  <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${c.bg} ${c.text}`}>
                    <Icon size={20} strokeWidth={2} />
                  </span>
                  <span className="text-[0.7rem] font-semibold leading-tight text-gray-700">
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
            <h2 className="text-base font-bold text-black">How it works</h2>
            <button
              type="button"
              onClick={() => navigate('/support')}
              className="text-xs font-semibold text-orange-500 transition-colors active:text-orange-600"
            >
              Learn more
            </button>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-4">
            <div className="grid grid-cols-4 gap-2">
              {steps.map((step, idx) => {
                const Icon = step.icon;
                const c = A[step.accent];
                const isLast = idx === steps.length - 1;
                return (
                  <div key={step.title} className="relative text-center">
                    {!isLast && (
                      <div className="pointer-events-none absolute left-[calc(50%+1.25rem)] top-5 hidden h-px w-[calc(100%-2.5rem)] bg-gray-100 min-[400px]:block" />
                    )}
                    <span className={`relative z-10 mx-auto flex h-10 w-10 items-center justify-center rounded-full ${c.bg} ${c.text}`}>
                      <Icon size={18} strokeWidth={2.5} />
                    </span>
                    <p className="mt-2.5 text-[0.7rem] font-bold leading-tight text-gray-900">{step.title}</p>
                    <p className="mt-0.5 hidden text-[0.6rem] leading-4 text-gray-500 min-[380px]:block">{step.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ----- Trust Badges ----- */}
        <section className="mt-4 bg-white border border-gray-100 rounded-2xl p-4">
          <div className="grid grid-cols-3 gap-4">
            {trustItems.map((item) => {
              const Icon = item.icon;
              const c = A[item.accent];
              return (
                <div key={item.title} className="flex flex-col items-center text-center">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.bg} ${c.text}`}>
                    <Icon size={18} strokeWidth={2.5} />
                  </span>
                  <p className="mt-2 text-[0.7rem] font-bold leading-tight text-gray-700">{item.title}</p>
                  <p className="mt-0.5 hidden text-[0.6rem] leading-4 text-gray-400 min-[380px]:block">{item.text}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ----- Footer Note ----- */}
        <p className="mt-6 px-2 text-center text-[0.65rem] leading-relaxed text-gray-400">
          Orders accepted from all 20 dzongkhags. Delivery currently available in Thimphu, Paro, and Phuntsholing/Chhukha.
        </p>
      </main>
    </div>
  );
}
