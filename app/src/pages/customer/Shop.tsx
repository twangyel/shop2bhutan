import { useState } from 'react';
import {
  ArrowRight,
  Link2,
  Loader2,
  Package,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  openShoppingAssist,
  SHOPPING_ASSIST_STORES,
} from '@/lib/shoppingAssist';
import type { ShoppingAssistStore } from '@/types';

export default function Shop() {
  const navigate = useNavigate();
  const [openingStore, setOpeningStore] =
    useState<ShoppingAssistStore | null>(null);

  const openStore = async (store: ShoppingAssistStore) => {
    if (openingStore) return;

    setOpeningStore(store);

    try {
      const opened = await openShoppingAssist({ store });

      if (!opened) {
        navigate('/shopping-assist');
      }
    } finally {
      setOpeningStore(null);
    }
  };

  const scrollToStores = () => {
    document.getElementById('browse-stores')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  return (
    <div className="min-h-[100dvh] bg-white">
      <header className="bg-white">
        <div className="mx-auto max-w-lg px-4 pb-4 pt-[calc(env(safe-area-inset-top)+0.9rem)]">
          <h1 className="text-[30px] font-black tracking-[-0.035em] text-slate-950">
            Shop
          </h1>
          <p className="mt-1 text-[14px] leading-5 text-slate-500">
            Choose a store or submit a product link
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))]">
        <section
          className="relative overflow-hidden rounded-[26px] px-5 pb-5 pt-5 shadow-[0_14px_32px_rgba(249,115,22,0.18)]"
          style={{
            background:
              'linear-gradient(135deg, #ff8b22 0%, #ff710b 52%, #ff6200 100%)',
          }}
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/[0.07]" />
          <div className="pointer-events-none absolute -bottom-8 right-16 h-24 w-24 rounded-full bg-white/[0.05]" />

          <div className="relative z-10 flex items-start gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-white ring-1 ring-white/10">
              <Sparkles size={23} strokeWidth={2.35} />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/85">
                Shopping Assist
              </p>
              <h2 className="mt-1 text-[20px] font-black leading-6 text-white">
                Browse products with S2B
              </h2>
              <p className="mt-2 max-w-[290px] text-[13px] leading-5 text-white/82">
                Open a product, review it, and add it to your Request Bag.
              </p>
            </div>
          </div>

          <div className="relative z-10 mt-5 flex items-center justify-center gap-2.5">
            {[
              ['1', 'Browse'],
              ['2', 'Review'],
              ['3', 'Request'],
            ].map(([step, label], index) => (
              <div key={step} className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-[11px] font-black text-white ring-1 ring-white/10">
                    {step}
                  </span>
                  <span className="text-[12px] font-bold text-white/95">
                    {label}
                  </span>
                </div>
                {index < 2 && (
                  <span className="h-px w-4 shrink-0 bg-white/35" />
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={scrollToStores}
            className="relative z-10 mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-[20px] bg-white text-[15px] font-black text-orange-600 shadow-[0_8px_20px_rgba(126,34,0,0.18)] transition active:scale-[0.985]"
          >
            Choose a store
            <ArrowRight size={18} strokeWidth={2.4} />
          </button>
        </section>

        <section id="browse-stores" className="scroll-mt-4 pt-7">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-[19px] font-black tracking-[-0.02em] text-slate-950">
              Browse stores
            </h2>
            <button
              type="button"
              onClick={() => navigate('/shopping-assist')}
              className="inline-flex items-center gap-1 text-[13px] font-black text-orange-500 transition active:scale-95"
            >
              View all
              <ArrowRight size={15} strokeWidth={2.5} />
            </button>
          </div>

          <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide">
            {SHOPPING_ASSIST_STORES.map((store) => {
              const opening = openingStore === store.key;

              return (
                <button
                  key={store.key}
                  type="button"
                  onClick={() => void openStore(store.key)}
                  disabled={Boolean(openingStore)}
                  className="flex min-w-[92px] flex-col items-center rounded-[22px] border border-slate-200/80 bg-white px-3 py-4 shadow-[0_5px_14px_rgba(15,23,42,0.045)] transition active:scale-[0.97] disabled:opacity-60"
                >
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 p-1.5">
                    {opening ? (
                      <Loader2
                        size={19}
                        className="animate-spin text-orange-500"
                      />
                    ) : (
                      <img
                        src={store.logo}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    )}
                  </span>

                  <span className="mt-2.5 w-full truncate text-center text-[12px] font-black text-slate-800">
                    {store.name}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-6">
          <button
            type="button"
            onClick={() => navigate('/paste-link')}
            className="flex w-full items-center gap-3.5 rounded-[24px] border border-slate-200/70 bg-white p-4 text-left shadow-[0_6px_18px_rgba(15,23,42,0.045)] transition active:scale-[0.99]"
          >
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
              <Link2 size={22} strokeWidth={2.25} />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-medium text-slate-400">
                Already found a product?
              </span>
              <span className="mt-0.5 block text-[15px] font-black leading-5 text-slate-950">
                Paste link or upload screenshot
              </span>
              <span className="mt-1 block text-[12px] leading-[18px] text-slate-500">
                Use a copied link or a product image you already have.
              </span>
            </span>

            <ArrowRight
              size={18}
              strokeWidth={2.3}
              className="shrink-0 text-slate-400"
            />
          </button>
        </section>

        <section className="mt-7">
          <h2 className="text-[19px] font-black tracking-[-0.02em] text-slate-950">
            Your shopping activity
          </h2>

          <div className="mt-3 overflow-hidden rounded-[24px] border border-slate-200/70 bg-white shadow-[0_6px_18px_rgba(15,23,42,0.045)]">
            <button
              type="button"
              onClick={() => navigate('/request-bag')}
              className="flex w-full items-center gap-3.5 px-4 py-4 text-left transition active:bg-slate-50"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
                <ShoppingBag size={21} strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-black text-slate-950">
                  Request Bag
                </span>
                <span className="mt-0.5 block text-[12px] leading-[18px] text-slate-500">
                  Review selected products before requesting a final price
                </span>
              </span>
              <ArrowRight
                size={18}
                strokeWidth={2.3}
                className="shrink-0 text-slate-400"
              />
            </button>

            <div className="ml-[70px] h-px bg-slate-100" />

            <button
              type="button"
              onClick={() => navigate('/orders')}
              className="flex w-full items-center gap-3.5 px-4 py-4 text-left transition active:bg-slate-50"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
                <Package size={21} strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-black text-slate-950">
                  Shopping Orders
                </span>
                <span className="mt-0.5 block text-[12px] leading-[18px] text-slate-500">
                  Track final prices, payments, and delivery
                </span>
              </span>
              <ArrowRight
                size={18}
                strokeWidth={2.3}
                className="shrink-0 text-slate-400"
              />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
