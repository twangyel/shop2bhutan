import { trackingSteps } from '@/data/mockData';
import type { OrderStatus } from '@/types';
import { Check, Clock, FileText, CreditCard, Package, Truck, MapPin, CheckCircle } from 'lucide-react';

interface TrackingTimelineProps {
  currentStatus: OrderStatus;
}

const statusIcons: Record<string, React.ReactNode> = {
  pending_confirmation: <Clock size={14} />,
  quotation_pending: <FileText size={14} />,
  quoted: <FileText size={14} />,
  payment_pending: <CreditCard size={14} />,
  payment_verified: <Check size={14} />,
  order_placed: <Package size={14} />,
  in_transit: <Truck size={14} />,
  arrived_at_hub: <Package size={14} />,
  out_for_delivery: <MapPin size={14} />,
  delivered: <CheckCircle size={14} />,
};

export default function TrackingTimeline({ currentStatus }: TrackingTimelineProps) {
  const currentIndex = trackingSteps.findIndex(s => s.status === currentStatus);

  return (
    <div className="relative">
      <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-neutral-200" />

      <div className="space-y-0">
        {trackingSteps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          // Future step

          return (
            <div key={step.status} className="flex items-start gap-3 py-2 relative">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                isCompleted
                  ? 'bg-emerald-500 text-white'
                  : isCurrent
                    ? 'bg-amber-500 text-white ring-4 ring-amber-100'
                    : 'bg-neutral-200 text-neutral-400'
              }`}>
                {isCompleted ? <Check size={16} /> : statusIcons[step.status]}
              </div>
              <div className="pt-1.5">
                <p className={`text-sm font-semibold ${
                  isCompleted || isCurrent ? 'text-gray-900' : 'text-neutral-400'
                }`}>
                  {step.label}
                </p>
                <p className={`text-xs mt-0.5 ${
                  isCompleted || isCurrent ? 'text-neutral-500' : 'text-neutral-400'
                }`}>
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
