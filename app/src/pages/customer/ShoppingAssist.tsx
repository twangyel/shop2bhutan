import {
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ArrowRight,
  Link2,
  Loader2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import {
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  openShoppingAssist,
  SHOPPING_ASSIST_STORES,
} from '@/lib/shoppingAssist';
import type { ShoppingAssistStore } from '@/types';

type ShoppingAssistLocationState = {
  preferredStore?: ShoppingAssistStore;
};

export default function ShoppingAssist() {
  const navigate = useNavigate();
  const location = useLocation();
  const [openingStore, setOpeningStore] =
    useState<ShoppingAssistStore | null>(null);
  const [error, setError] = useState('');
  const autoOpenedRef = useRef(false);

  const locationState =
    location.state as ShoppingAssistLocationState | null;

  const openStore = async (
    store: ShoppingAssistStore,
  ) => {
    if (openingStore) return;

    setOpeningStore(store);
    setError('');

    try {
      const opened = await openShoppingAssist({ store });

      if (!opened) {
        setError(
          'The S2B shopping browser is available in the latest Android app. You can still paste or share the product link.',
        );
      }
    } finally {
      setOpeningStore(null);
    }
  };

  useEffect(() => {
    const preferredStore =
      locationState?.preferredStore;

    if (
      !preferredStore ||
      autoOpenedRef.current
    ) {
      return;
    }

    autoOpenedRef.current = true;
    void openStore(preferredStore);
  }, [locationState?.preferredStore]);

  return (
    <div className="min-h-[100dvh] bg-white">
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto max-w-lg px-4 pb-4 pt-[calc(env(safe-area-inset-top)+0.9rem)]">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-orange-500">
            Shop2Bhutan
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950">
            S2B Shopping Assist
          </h1>
          <p className="mt-1.5 max-w-md text-[13px] leading-5 text-slate-500">
            Browse supported Indian stores, open a product and add it to your Request Bag.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-4">
        <section className="overflow-hidden rounded-[26px] border border-orange-100 bg-orange-50/60 p-5">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-orange-600 shadow-sm ring-1 ring-orange-100">
              <Sparkles size={22} strokeWidth={2.3} />
            </span>

            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-extrabold text-slate-950">
                Find it there. Request it here.
              </h2>
              <p className="mt-1.5 text-xs leading-5 text-slate-600">
                Product name, photo and displayed price are checked from the page you are viewing. You review everything before saving.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              ['1', 'Browse'],
              ['2', 'Review'],
              ['3', 'Request'],
            ].map(([step, label]) => (
              <div
                key={step}
                className="rounded-2xl bg-white px-2 py-3 text-center ring-1 ring-orange-100"
              >
                <span className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-[11px] font-extrabold text-white">
                  {step}
                </span>
                <p className="mt-1.5 text-[10px] font-extrabold text-slate-700">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-orange-500">
                Supported stores
              </p>
              <h2 className="mt-1 text-lg font-extrabold text-slate-950">
                Choose where to browse
              </h2>
            </div>

            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-extrabold text-blue-600">
              Secure browser
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            {SHOPPING_ASSIST_STORES.map((store) => {
              const opening = openingStore === store.key;

              return (
                <button
                  key={store.key}
                  type="button"
                  onClick={() => void openStore(store.key)}
                  disabled={Boolean(openingStore)}
                  className="group flex min-h-[108px] items-center gap-3 rounded-[22px] border border-slate-100 bg-white p-4 text-left shadow-sm shadow-slate-100 transition active:scale-[0.98] disabled:opacity-60"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-50 p-2.5 ring-1 ring-slate-100">
                    <img
                      src={store.logo}
                      alt=""
                      className="h-full w-full object-contain"
                    />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold text-slate-900">
                      {store.name}
                    </span>
                    <span className="mt-1 block text-[10px] font-semibold text-slate-400">
                      Browse products
                    </span>
                  </span>

                  {opening ? (
                    <Loader2
                      size={18}
                      className="shrink-0 animate-spin text-orange-500"
                    />
                  ) : (
                    <ArrowRight
                      size={17}
                      className="shrink-0 text-slate-300 transition group-active:translate-x-0.5"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {error && (
          <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-800">
            {error}
          </div>
        )}

        <section className="mt-6 rounded-[24px] border border-slate-100 bg-slate-50/70 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-600 ring-1 ring-slate-100">
              <ShieldCheck size={19} strokeWidth={2.3} />
            </span>
            <div>
              <p className="text-sm font-extrabold text-slate-900">
                You stay in control
              </p>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">
                Shop2Bhutan does not handle your shopping-site password or checkout. The detected price is verified again during quotation.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => navigate('/paste-link')}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-xs font-extrabold text-slate-700 transition active:scale-[0.98]"
          >
            <Link2 size={16} />
            Paste a link
          </button>

          <button
            type="button"
            onClick={() => navigate('/request-bag')}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 text-xs font-extrabold text-white transition active:scale-[0.98]"
          >
            <ShoppingBag size={16} />
            View Request Bag
          </button>
        </div>

        <p className="mt-5 text-center text-[10px] leading-4 text-slate-400">
          Shop2Bhutan is an independent shopping-assistance service and is not affiliated with the supported stores.
        </p>
      </main>
    </div>
  );
}
