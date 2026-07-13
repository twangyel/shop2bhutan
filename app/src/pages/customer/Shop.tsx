import { useState } from 'react';
import {
  ArrowRight,
  Link2,
  Loader2,
  Package,
  ShoppingBag,
  Sparkles,
  Search,
  MoreHorizontal,
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
      {/* Header */}
      <header className="bg-white">
        <div className="mx-auto max-w-lg px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.8rem)] flex items-start justify-between">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight text-slate-950">
              Shop
            </h1>
            <p className="mt-0.5 text-[13px] leading-5 text-slate-500">
              Choose a store or paste a link
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/search')}
            className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition active:scale-95"
          >
            <Search size={18} strokeWidth={2} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-2">
        {/* Shopping Assist Banner */}
        <section
          className="relative overflow-hidden rounded-2xl p-4"
          style={{
            background: 'linear-gradient(135deg, #FF8C2A 0%, #FF6B00 100%)',
          }}
        >
          {/* Decorative circles */}
          <div className="pointer-events-none absolute -top-3 -right-3 h-20 w-20 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-5 right-8 h-12 w-12 rounded-full bg-white/5" />

          <div className="relative z-10 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white">
              <Sparkles size={20} strokeWidth={2.3} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-white/85">
                Shopping Assist
              </p>
              <h2 className="mt-0.5 text-[15px] font-extrabold leading-5 text-white">
                Browse products with S2B
              </h2>
              <p className="mt-1 text-[11px] leading-[18px] text-white/80">
                Open a product, review it, and add to your Request Bag.
              </p>
            </div>
          </div>

          {/* Steps — centered */}
          <div className="relative z-10 mt-3 flex items-center justify-center gap-2">
            {[
              ['1', 'Browse'],
              ['2', 'Review'],
              ['3', 'Request'],
            ].map(([step, label], index) => (
              <div key={step} className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/25 text-[9px] font-extrabold text-white">
                    {step}
                  </span>
                  <span className="text-[11px] font-semibold text-white/90">
                    {label}
                  </span>
                </div>
                {index < 2 && (
                  <span className="h-px w-3 shrink-0 bg-white/30" />
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => navigate('/shopping-assist')}
            className="relative z-10 mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-extrabold text-orange-500 shadow-md transition active:scale-[0.98]"
          >
            Browse with S2B
            <ArrowRight size={16} />
          </button>
        </section>

        {/* Browse Stores — Horizontal Scroll */}
        <section className="mt-5">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-[17px] font-extrabold text-slate-950">
              Browse stores
            </h2>
            <button
              type="button"
              onClick={() => navigate('/shopping-assist')}
              className="text-[12px] font-extrabold text-orange-500"
            >
              View all
            </button>
          </div>

          <div className="mt-3 -mx-4 px-4 flex gap-2.5 overflow-x-auto scrollbar-hide">
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
                  className="flex min-w-[76px] flex-col items-center rounded-2xl border border-slate-200 bg-white px-2 py-3 shadow-sm transition active:scale-95 disabled:opacity-60"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white">
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

                  <span className="mt-2 w-full truncate text-center text-[11px] font-extrabold text-slate-700">
                    {store.name}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => navigate('/shopping-assist')}
              className="flex min-w-[76px] flex-col items-center rounded-2xl border border-slate-200 bg-slate-50 px-2 py-3 transition active:scale-95"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white">
                <MoreHorizontal size={18} className="text-slate-400" />
              </span>
              <span className="mt-2 w-full truncate text-center text-[11px] font-extrabold text-slate-400">
                More
              </span>
            </button>
          </div>
        </section>

        {/* More Options — Card Style */}
        <section className="mt-6">
          <h2 className="text-[17px] font-extrabold text-slate-950">
            More options
          </h2>

          <div className="mt-3 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/paste-link')}
              className="flex w-full items-center gap-3.5 rounded-2xl border border-slate-100 bg-white p-3.5 text-left shadow-sm transition active:scale-[0.99]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                <Link2 size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-extrabold text-slate-900">
                  Paste a product link
                </span>
                <span className="mt-0.5 block text-[11px] leading-4 text-slate-400">
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
              className="flex w-full items-center gap-3.5 rounded-2xl border border-slate-100 bg-white p-3.5 text-left shadow-sm transition active:scale-[0.99]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                <ShoppingBag size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-extrabold text-slate-900">
                  Request Bag
                </span>
                <span className="mt-0.5 block text-[11px] leading-4 text-slate-400">
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
              className="flex w-full items-center gap-3.5 rounded-2xl border border-slate-100 bg-white p-3.5 text-left shadow-sm transition active:scale-[0.99]"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
                <Package size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-extrabold text-slate-900">
                  Shopping orders
                </span>
                <span className="mt-0.5 block text-[11px] leading-4 text-slate-400">
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
