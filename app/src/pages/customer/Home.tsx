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
  { icon: Link2, title: 'Send link', text: 'Paste link or upload screenshot' },
  { icon: FileText, title: 'Receive quote', text: 'We verify price clearly' },
  { icon: CreditCard, title: 'Accept & pay', text: 'Upload payment proof' },
  { icon: PackageCheck, title: 'Track delivery', text: 'Follow every update' },
];

const trustItems = [
  { icon: ShieldCheck, title: 'Secure & trusted', text: 'Your data is safe' },
  { icon: Tag, title: 'Human verified', text: 'We check for you' },
  { icon: Headphones, title: 'Real support', text: 'We are here to help' },
];

const stores: StoreItem[] = [
  { name: 'Amazon', platform: 'amazon', logo: '/store-logos/amazon.png' },
  { name: 'Flipkart', platform: 'flipkart', logo: '/store-logos/flipkart.png' },
  { name: 'Myntra', platform: 'myntra', logo: '/store-logos/myntra.png' },
  { name: 'Meesho', platform: 'meesho', logo: '/store-logos/meesho.png' },
];

function StoreLogo({ store }: { store: StoreItem }) {
  const [logoAvailable, setLogoAvailable] = useState(true);

  if (!logoAvailable) {
    return <span className="text-[10px] font-extrabold leading-none text-orange-600">{store.name}</span>;
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
    <div className="min-h-screen bg-[#fbfaf8]">
      <header className="sticky top-0 z-40 border-b border-orange-100/40 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-4 pb-3 pt-3">
          <div className="flex items-center justify-between">
            <Logo size="sm" />
            <button
              type="button"
              onClick={() => navigate('/notifications')}
              className="relative flex h-8 w-8 items-center justify-center rounded-full text-neutral-700 transition-colors hover:bg-neutral-100 active:bg-neutral-100"
              aria-label="Notifications"
            >
              <Bell size={17} strokeWidth={1.9} />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-bold leading-none text-white ring-2 ring-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => navigate('/account')}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-orange-50/70 px-3 py-1.5 text-left text-xs font-medium text-neutral-600 transition-colors hover:bg-orange-100/70"
          >
            <MapPin size={14} className="text-orange-500" />
            <span>Delivering to: {deliveryLabel}</span>
            <ChevronDown size={12} className="text-neutral-400" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-8 pt-4">
        <section className="rounded-[1.65rem] bg-white p-4 shadow-sm ring-1 ring-orange-100/70 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
              <Link2 size={23} />
            </span>
            <div className="min-w-0 pt-0.5">
              <h1 className="text-lg font-bold leading-snug text-gray-950 sm:text-xl">
                Paste a product link or upload a screenshot
              </h1>
              <p className="mt-1 text-sm leading-6 text-neutral-500">
                We verify the price, prepare a quotation, and handle the rest.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/paste-link')}
            className="mt-4 flex h-12 w-full items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 text-left text-sm text-neutral-400 transition-colors hover:border-orange-200 hover:bg-orange-50/50"
          >
            <Link2 size={18} className="shrink-0 text-neutral-400" />
            <span className="min-w-0 flex-1 truncate">Paste Amazon, Flipkart, Myntra or Meesho link</span>
            <ScanLine size={18} className="shrink-0 text-neutral-400" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/paste-link')}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-sm font-bold text-white shadow-lg shadow-orange-200/60 transition-transform active:scale-[0.99]"
          >
            Request Quotation
            <ArrowRight size={18} />
          </button>
        </section>

        <section
          className="relative mt-4 overflow-hidden rounded-[1.5rem] border border-orange-100 bg-orange-50 p-4 shadow-sm"
          style={{
            backgroundImage:
              "linear-gradient(90deg, rgba(255,247,237,0.98) 0%, rgba(255,247,237,0.92) 46%, rgba(255,247,237,0.58) 100%), url('/home-india-bg.jpg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center right',
          }}
        >
          <div className="relative z-10 flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/90 text-orange-500 shadow-sm ring-1 ring-orange-100">
              <ShieldCheck size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-gray-950">Shop from India, delivered to Bhutan</h2>
              <p className="mt-1 text-sm leading-6 text-neutral-600">
                Clear quotation, verified product details, and order tracking from your account.
              </p>

              <div className="mt-3 grid grid-cols-4 gap-1.5">
                {stores.map((store) => (
                  <button
                    key={store.name}
                    type="button"
                    onClick={() => navigate('/paste-link', { state: { sourcePlatform: store.platform } })}
                    className="flex h-8 items-center justify-center rounded-full bg-white/90 px-2 shadow-sm ring-1 ring-orange-100 transition-colors hover:bg-white"
                    aria-label={`Request quotation from ${store.name}`}
                  >
                    <StoreLogo store={store} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-[1.35rem] bg-white p-2 shadow-sm ring-1 ring-neutral-100">
          <div className="grid grid-cols-4 divide-x divide-neutral-100">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => navigate(action.path)}
                  className="flex min-h-[78px] flex-col items-center justify-center gap-2 rounded-2xl px-1.5 py-2 text-center transition-colors hover:bg-orange-50/70"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
                    <Icon size={18} />
                  </span>
                  <span className="text-[10px] font-semibold leading-tight text-neutral-700">{action.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-950">How it works</h2>
            <button type="button" onClick={() => navigate('/support')} className="text-xs font-semibold text-orange-600">
              Learn more
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2 rounded-[1.35rem] bg-white p-3 shadow-sm ring-1 ring-neutral-100">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="text-center">
                  <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
                    <Icon size={18} />
                  </span>
                  <p className="mt-2 text-[11px] font-bold leading-tight text-gray-900">{step.title}</p>
                  <p className="mt-1 hidden text-[10px] leading-4 text-neutral-500 min-[380px]:block">{step.text}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-4 grid grid-cols-3 divide-x divide-neutral-100 rounded-[1.35rem] bg-white p-3 shadow-sm ring-1 ring-neutral-100">
          {trustItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="px-2 text-center">
                <Icon size={20} className="mx-auto text-orange-500" />
                <p className="mt-2 text-[11px] font-bold leading-tight text-neutral-700">{item.title}</p>
                <p className="mt-0.5 hidden text-[10px] leading-4 text-neutral-400 min-[380px]:block">{item.text}</p>
              </div>
            );
          })}
        </section>

        <p className="mt-5 px-2 text-center text-[11px] leading-relaxed text-neutral-400">
          Orders accepted from all 20 dzongkhags. Delivery currently available in Thimphu, Paro, and Phuntsholing/Chhukha.
        </p>
      </main>
    </div>
  );
}
