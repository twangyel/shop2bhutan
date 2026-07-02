import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ChevronRight, FileText, ShoppingBag } from 'lucide-react';
import type { Order } from '@/types';
import StatusBadge from './StatusBadge';

interface OrderCardProps {
  order: Order;
}

function money(value?: number) {
  const amount = Number(value ?? 0);
  return `Nu. ${amount.toLocaleString()}`;
}

function safeDateDistance(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  return formatDistanceToNow(date, { addSuffix: true });
}

function fallbackTotal(order: Order) {
  return order.items.reduce((sum, item) => sum + Number(item.unitPrice || 0) * Math.max(1, Number(item.quantity) || 1), 0);
}

function orderTitle(order: Order) {
  if (order.items.length === 0) return 'Shop2Bhutan request';
  const first = order.items[0]?.productName || 'Requested product';
  if (order.items.length === 1) return first;
  return `${first} + ${order.items.length - 1} more`;
}

export default function OrderCard({ order }: OrderCardProps) {
  const navigate = useNavigate();
  const isQuotationReady = order.status === 'quoted' && Boolean(order.quotation);
  const totalAmount = order.quotation?.totalAmount || fallbackTotal(order);
  const firstItem = order.items[0];
  const title = useMemo(() => orderTitle(order), [order]);

  return (
    <article className={`rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md ${isQuotationReady ? 'border-violet-200' : 'border-neutral-100'}`}>
      <button type="button" onClick={() => navigate(`/order/${order.id}`)} className="w-full p-4 text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">#{order.orderNumber}</p>
            <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-gray-900">{title}</h3>
            <p className="mt-1 text-xs text-neutral-500">{safeDateDistance(order.createdAt)}</p>
          </div>
          <StatusBadge status={order.status} size="sm" />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-neutral-100 ring-1 ring-neutral-200">
            {firstItem?.productImage ? (
              <img src={firstItem.productImage} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <ShoppingBag size={22} className="text-neutral-300" />
              </div>
            )}
            {order.items.length > 1 && (
              <span className="absolute bottom-1 right-1 rounded-full bg-gray-900/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                +{order.items.length - 1}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {firstItem?.sourcePlatform && (
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
                  {firstItem.sourcePlatform}
                </span>
              )}
              <span className="text-xs text-neutral-500">
                {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <div>
                <p className="text-xs text-neutral-500">{order.quotation ? 'Quotation total' : 'Estimated total'}</p>
                <p className="text-lg font-bold tracking-tight text-gray-900">{money(totalAmount)}</p>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                Details <ChevronRight size={14} />
              </span>
            </div>
          </div>
        </div>
      </button>

      {isQuotationReady && order.quotation && (
        <div className="border-t border-violet-100 bg-violet-50/70 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate(`/quotation/${order.id}`)}
            className="flex w-full items-center justify-between gap-3 rounded-xl bg-white px-3 py-3 text-left ring-1 ring-violet-100 transition-colors hover:bg-violet-50"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                <FileText size={18} />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-violet-900">Quotation ready</p>
                <p className="text-xs text-violet-600">Review quote and upload payment after accepting.</p>
              </div>
            </div>
            <span className="flex-shrink-0 text-xs font-semibold text-violet-700">Review</span>
          </button>
        </div>
      )}
    </article>
  );
}
