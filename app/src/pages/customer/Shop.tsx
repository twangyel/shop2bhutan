import { useState } from 'react';
import {
  ArrowRight,
  Link2,
  Loader2,
  Package,
  ShieldCheck,
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
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto max-w-lg px-4 pb-4 pt-[calc(env(safe-area-inset-top)+0.85rem)]">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-orange-500">
            Shop2Bhutan
          </p>

          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950">
            Shop
          </h1>

          <p className="mt-1.5 max-w-md text-[13px] leading-5 text-slate-500">
            Browse supported Indian stores or add a product using its link or screenshot.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-4">
        <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100/70">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-orange-100 bg-white text-orange-500">
              <Sparkles size={22} strokeWidth={2.2} />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-orange-500">
                S2B Shopping Assist
              </p>

              <h2 className="mt-1 text-xl font-extrabold leading-7 text-slate-950">
                Browse Indian stores with Shop2Bhutan
              </h2>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                Open a product, review the available details, then save it directly to your Request Bag.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 divide-x divide-slate-100 rounded-2xl border border-slate-100 bg-white">
            {[
              ['1', 'Browse'],
              ['2', 'Review'],
              ['3', 'Request'],
            ].map(([step, label]) => (
              <div
                key={step}
                className="px-2 py-3 text-center"
              >
                <span className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-[11px] font-extrabold text-white">
                  {step}
                </span>
                <p className="mt-1.5 text-[10px] font-extrabold text-slate-600">
                  {label}
                </p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => navigate('/shopping-assist')}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 text-sm font-extrabold text-white transition active:scale-[0.98]"
          >
            Browse with S2B
            <ArrowRight size={17} />
          </button>
        </section>

        <section className="mt-6">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-orange-500">
              Supported stores
            </p>
            <h2 className="mt-1 text-lg font-extrabold text-slate-950">
              Choose where to shop
            </h2>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              Tap a store to start browsing products.
            </p>
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
                  className="flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white px-1 py-3.5 transition active:scale-95 disabled:opacity-60"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-white p-2">
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

                  <span className="w-full truncate text-center text-[10px] font-extrabold text-slate-700">
                    {store.name}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-6 rounded-[24px] border border-slate-200 bg-white p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-white text-blue-600">
              <ShieldCheck size={19} strokeWidth={2.2} />
            </span>

            <div>
              <h2 className="text-sm font-extrabold text-slate-950">
                Other ways to request
              </h2>
              <p className="mt-0.5 text-[10px] leading-4 text-slate-500">
                Add a link or continue with an existing shopping request.
              </p>
            </div>
          </div>

          <div className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-100 bg-white">
            <button
              type="button"
              onClick={() => navigate('/paste-link')}
              className="flex w-full items-center gap-3 px-3.5 py-3.5 text-left transition active:bg-slate-50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-orange-100 bg-white text-orange-500">
                <Link2 size={18} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold text-slate-800">
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
              className="flex w-full items-center gap-3 px-3.5 py-3.5 text-left transition active:bg-slate-50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-white text-blue-600">
                <ShoppingBag size={18} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold text-slate-800">
                  Open Request Bag
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
              className="flex w-full items-center gap-3 px-3.5 py-3.5 text-left transition active:bg-slate-50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-white text-emerald-600">
                <Package size={18} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-extrabold text-slate-800">
                  Track shopping orders
                </span>
                <span className="mt-0.5 block text-[10px] leading-4 text-slate-400">
                  Follow quotations, payments and delivery
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
