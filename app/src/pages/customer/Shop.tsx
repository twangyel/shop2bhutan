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

  const openStore = async (
    store: ShoppingAssistStore,
  ) => {
    if (openingStore) return;

    setOpeningStore(store);

    try {
      const opened =
        await openShoppingAssist({ store });

      if (!opened) {
        navigate('/shopping-assist');
      }
    } finally {
      setOpeningStore(null);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-white">
      <header className="bg-white">
        <div className="mx-auto max-w-lg px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.8rem)]">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-orange-500">
            Shop2Bhutan
          </p>
          <h1 className="mt-1 text-[26px] font-extrabold tracking-tight text-slate-950">
            Shop
          </h1>
          <p className="mt-1 text-[13px] leading-5 text-slate-500">
            Choose a store or add a product using its link.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-2">
        <section className="rounded-[24px] border border-slate-200 bg-white p-4">
          <div className="flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-orange-100 bg-white text-orange-500">
              <Sparkles size={20} strokeWidth={2.3} />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-orange-500">
                Shopping Assist
              </p>
              <h2 className="mt-0.5 text-[17px] font-extrabold leading-6 text-slate-950">
                Browse products with S2B
              </h2>
              <p className="mt-1 text-[11px] leading-[18px] text-slate-500">
                Open a product, review its details and add it to your Request Bag.
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center rounded-2xl border border-slate-100 bg-white px-3 py-2.5">
            {[
              ['1', 'Browse'],
              ['2', 'Review'],
              ['3', 'Request'],
            ].map(([step, label], index) => (
              <div
                key={step}
                className="flex min-w-0 flex-1 items-center"
              >
                <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500 text-[10px] font-extrabold text-white">
                    {step}
                  </span>
                  <span className="truncate text-[10px] font-extrabold text-slate-600">
                    {label}
                  </span>
                </div>

                {index < 2 && (
                  <span className="h-px w-4 shrink-0 bg-slate-200" />
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => navigate('/shopping-assist')}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 text-sm font-extrabold text-white transition active:scale-[0.98]"
          >
            Browse with S2B
            <ArrowRight size={17} />
          </button>
        </section>

        <section className="mt-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-extrabold text-slate-950">
                Browse stores
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Tap a store to begin.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/shopping-assist')}
              className="text-[11px] font-extrabold text-orange-500"
            >
              View all
            </button>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-2">
            {SHOPPING_ASSIST_STORES.map((store) => {
              const opening =
                openingStore === store.key;

              return (
                <button
                  key={store.key}
                  type="button"
                  onClick={() =>
                    void openStore(store.key)
                  }
                  disabled={Boolean(openingStore)}
                  className="flex min-w-0 flex-col items-center rounded-2xl border border-slate-200 bg-white px-1 py-3 transition active:scale-95 disabled:opacity-60"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-100 bg-white p-2">
                    {opening ? (
                      <Loader2
                        size={17}
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

                  <span className="mt-2 w-full truncate text-center text-[10px] font-extrabold text-slate-700">
                    {store.name}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="text-[17px] font-extrabold text-slate-950">
            More options
          </h2>

          <div className="mt-2 divide-y divide-slate-100 border-y border-slate-100 bg-white">
            <button
              type="button"
              onClick={() => navigate('/paste-link')}
              className="flex w-full items-center gap-3 py-3.5 text-left transition active:scale-[0.99]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-orange-100 bg-white text-orange-500">
                <Link2 size={18} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold text-slate-900">
                  Paste a product link
                </span>
                <span className="mt-0.5 block text-[10px] leading-4 text-slate-400">
                  Use a copied link or upload a screenshot
                </span>
              </span>

              <ArrowRight
                size={16}
                className="shrink-0 text-slate-300"
              />
            </button>

            <button
              type="button"
              onClick={() => navigate('/request-bag')}
              className="flex w-full items-center gap-3 py-3.5 text-left transition active:scale-[0.99]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-white text-blue-600">
                <ShoppingBag size={18} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold text-slate-900">
                  Request Bag
                </span>
                <span className="mt-0.5 block text-[10px] leading-4 text-slate-400">
                  Review products and request a quotation
                </span>
              </span>

              <ArrowRight
                size={16}
                className="shrink-0 text-slate-300"
              />
            </button>

            <button
              type="button"
              onClick={() => navigate('/orders')}
              className="flex w-full items-center gap-3 py-3.5 text-left transition active:scale-[0.99]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-emerald-100 bg-white text-emerald-600">
                <Package size={18} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold text-slate-900">
                  Shopping orders
                </span>
                <span className="mt-0.5 block text-[10px] leading-4 text-slate-400">
                  Track quotations, payments and delivery
                </span>
              </span>

              <ArrowRight
                size={16}
                className="shrink-0 text-slate-300"
              />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
