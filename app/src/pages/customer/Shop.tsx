import { useState } from 'react';
import {
  ArrowRight,
  Boxes,
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
      <header className="border-b border-slate-100 bg-white">
        <div className="mx-auto max-w-lg px-4 pb-4 pt-[calc(env(safe-area-inset-top)+0.85rem)]">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-orange-500">
            Shop2Bhutan
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-950">
            Shop
          </h1>
          <p className="mt-1.5 text-[13px] leading-5 text-slate-500">
            Buy local products here or request something from supported Indian stores.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-4">
        <section className="rounded-[26px] border border-slate-100 bg-slate-50/70 p-5">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-600 ring-1 ring-slate-100">
              <Boxes size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-slate-950">
                  Local products
                </h2>
                <span className="rounded-full bg-blue-50 px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide text-blue-600">
                  Coming next
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-5 text-slate-500">
                A curated fixed-price catalogue of Bhutanese and locally available products is being prepared.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-[28px] bg-slate-950 p-5 text-white shadow-xl shadow-slate-900/10">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-orange-400 ring-1 ring-white/10">
              <Sparkles size={22} />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-orange-400">
                S2B Shopping Assist
              </p>
              <h2 className="mt-1 text-xl font-extrabold">
                Browse Indian stores inside Shop2Bhutan
              </h2>
              <p className="mt-2 text-xs leading-5 text-white/70">
                Open a product, review the detected name, image and displayed price, then save it to your Request Bag.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/shopping-assist')}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 text-sm font-extrabold text-white transition active:scale-[0.98]"
          >
            Browse with S2B
            <ArrowRight size={17} />
          </button>
        </section>

        <section className="mt-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-orange-500">
                Supported stores
              </p>
              <h2 className="mt-1 text-lg font-extrabold text-slate-950">
                Start browsing
              </h2>
            </div>
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
                  className="flex min-w-0 flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-white px-1 py-3.5 shadow-sm shadow-slate-100 transition active:scale-95 disabled:opacity-60"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 p-2">
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

        <section className="mt-6 rounded-[24px] border border-slate-100 bg-white p-4 shadow-sm shadow-slate-100">
          <h2 className="text-sm font-extrabold text-slate-950">
            Other ways to request
          </h2>

          <button
            type="button"
            onClick={() => navigate('/paste-link')}
            className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-3.5 text-left transition active:scale-[0.99]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-orange-500 ring-1 ring-slate-100">
              <Link2 size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold text-slate-800">
                Paste a product link
              </span>
              <span className="mt-0.5 block text-[10px] text-slate-400">
                Use a copied link or screenshot
              </span>
            </span>
            <ArrowRight size={16} className="text-slate-300" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/request-bag')}
            className="mt-2 flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-3.5 text-left transition active:scale-[0.99]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 ring-1 ring-slate-100">
              <ShoppingBag size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold text-slate-800">
                Open Request Bag
              </span>
              <span className="mt-0.5 block text-[10px] text-slate-400">
                Review products and request a quotation
              </span>
            </span>
            <ArrowRight size={16} className="text-slate-300" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="mt-2 flex w-full items-center gap-3 rounded-2xl bg-slate-50 p-3.5 text-left transition active:scale-[0.99]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600 ring-1 ring-slate-100">
              <Package size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-extrabold text-slate-800">
                Track shopping orders
              </span>
              <span className="mt-0.5 block text-[10px] text-slate-400">
                Follow quotations, payments and delivery
              </span>
            </span>
            <ArrowRight size={16} className="text-slate-300" />
          </button>
        </section>
      </main>
    </div>
  );
}
