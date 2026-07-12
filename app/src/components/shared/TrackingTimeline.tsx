import type { ReactNode } from 'react';
import { Check, Clock, CreditCard, FileText, MapPin, Package, Truck, XCircle } from 'lucide-react';
import type { OrderStatus, TrackingEvent } from '@/types';

const BHUTAN_TIME_ZONE = 'Asia/Thimphu';

interface TrackingTimelineProps {
  currentStatus: OrderStatus;
  trackingEvents?: TrackingEvent[];
  showDetails?: boolean;
}

type TimelineStep = {
  status: OrderStatus;
  label: string;
  description: string;
  icon: ReactNode;
};

const trackingSteps: TimelineStep[] = [
  {
    status: 'pending_confirmation',
    label: 'Request Submitted',
    description: 'Customer shopping request submitted.',
    icon: <Clock size={14} />,
  },
  {
    status: 'quotation_pending',
    label: 'Checking Availability & Price',
    description: 'Product availability, selected options, current prices, and charges are being checked.',
    icon: <FileText size={14} />,
  },
  {
    status: 'quoted',
    label: 'Final Price Ready',
    description: 'Final price sent to the customer for confirmation.',
    icon: <FileText size={14} />,
  },
  {
    status: 'payment_pending',
    label: 'Payment in Progress',
    description: 'Waiting for payment submission or verification.',
    icon: <CreditCard size={14} />,
  },
  {
    status: 'payment_verified',
    label: 'Payment Verified',
    description: 'Payment has been verified.',
    icon: <Check size={14} />,
  },
  {
    status: 'order_placed',
    label: 'Order Placed',
    description: 'Product ordered from Indian seller.',
    icon: <Package size={14} />,
  },
  {
    status: 'in_transit',
    label: 'In Transit',
    description: 'Package is moving toward Bhutan.',
    icon: <Truck size={14} />,
  },
  {
    status: 'arrived_at_hub',
    label: 'Arrived at Hub',
    description: 'Package has reached the delivery hub.',
    icon: <Package size={14} />,
  },
  {
    status: 'out_for_delivery',
    label: 'Out for Delivery',
    description: 'Package is assigned for final delivery.',
    icon: <MapPin size={14} />,
  },
  {
    status: 'delivered',
    label: 'Delivered',
    description: 'Package delivered to customer.',
    icon: <Check size={14} />,
  },
];

function formatBhutanDateTime(value?: string) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const dateText = new Intl.DateTimeFormat('en-US', {
    timeZone: BHUTAN_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);

  const timeText = new Intl.DateTimeFormat('en-US', {
    timeZone: BHUTAN_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);

  return `${dateText}, ${timeText} BTT`;
}

function latestEventForStatus(events: TrackingEvent[] | undefined, status: OrderStatus) {
  return (events ?? [])
    .filter((event) => event.status === status)
    .sort((a, b) => (new Date(b.createdAt).getTime() || 0) - (new Date(a.createdAt).getTime() || 0))[0];
}

function customerFacingTrackingMessage(value: string | undefined, fallback: string) {
  const message = (value || fallback).trim();

  return message
    .replace(/quotation request/gi, 'shopping request')
    .replace(/order request/gi, 'shopping request')
    .replace(/quotation/gi, 'final price');
}

export default function TrackingTimeline({ currentStatus, trackingEvents = [], showDetails = false }: TrackingTimelineProps) {
  const currentIndex = trackingSteps.findIndex((step) => step.status === currentStatus);
  const safeCurrentIndex = currentStatus === 'cancelled' ? -1 : Math.max(0, currentIndex);

  if (currentStatus === 'cancelled') {
    const cancelEvent = latestEventForStatus(trackingEvents, 'cancelled');

    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-500 text-white">
            <XCircle size={17} />
          </div>
          <div>
            <p className="text-sm font-semibold text-red-700">Order Cancelled</p>
            <p className="mt-0.5 text-xs text-red-600">This order is no longer active.</p>
            <p className="mt-1 text-[11px] font-medium text-red-500">{formatBhutanDateTime(cancelEvent?.createdAt) || 'Updated recently'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-neutral-200" />

      <div className="space-y-0">
        {trackingSteps.map((step, index) => {
          const isCompleted = index < safeCurrentIndex;
          const isCurrent = index === safeCurrentIndex;
          const isActive = isCompleted || isCurrent;
          const event = latestEventForStatus(trackingEvents, step.status);
          const timestamp = formatBhutanDateTime(event?.createdAt);

          return (
            <div key={step.status} className="relative flex items-start gap-3 py-2">
              <div
                className={`z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
                  isCompleted
                    ? 'bg-emerald-500 text-white'
                    : isCurrent
                      ? 'bg-amber-500 text-white ring-4 ring-amber-100'
                      : 'bg-neutral-200 text-neutral-400'
                }`}
              >
                {isCompleted ? <Check size={16} /> : step.icon}
              </div>
              <div className="min-w-0 pt-1.5">
                <p className={`text-sm font-semibold ${isActive ? 'text-gray-900' : 'text-neutral-400'}`}>{step.label}</p>
                <p className={`mt-0.5 text-xs ${isActive ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  {customerFacingTrackingMessage(event?.message, step.description)}
                </p>
                <p className={`mt-1 text-[11px] font-medium ${timestamp ? 'text-neutral-500' : 'text-neutral-300'}`}>
                  {timestamp || 'Pending'}
                </p>
                {showDetails && event?.sellerReference && (
                  <p className="mt-1 text-[11px] font-semibold text-blue-600">Seller ref: {event.sellerReference}</p>
                )}
                {showDetails && event?.adminNote && (
                  <p className="mt-1 whitespace-pre-wrap rounded-lg bg-neutral-50 px-2 py-1 text-[11px] text-neutral-600">{event.adminNote}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
