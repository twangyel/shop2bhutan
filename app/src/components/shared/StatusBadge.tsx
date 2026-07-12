import { orderStatusLabels, orderStatusColors } from '@/data/mockData';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

const shoppingJourneyLabels: Record<string, string> = {
  pending_confirmation: 'Request Submitted',
  quotation_pending: 'Checking Availability',
  quoted: 'Final Price Ready',
};

const shoppingJourneyColors: Record<string, { bg: string; text: string }> = {
  pending_confirmation: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
  },
  quotation_pending: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
  },
  quoted: {
    bg: 'bg-orange-50',
    text: 'text-orange-700',
  },
};

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const normalizedStatus = status.trim().toLowerCase();
  const label =
    shoppingJourneyLabels[normalizedStatus] ||
    orderStatusLabels[status] ||
    status;
  const colors =
    shoppingJourneyColors[normalizedStatus] ||
    orderStatusColors[status] ||
    { bg: 'bg-gray-100', text: 'text-gray-600' };

  return (
    <span className={`inline-flex items-center rounded-full border border-gray-100 font-semibold ${colors.bg} ${colors.text} ${
      size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
    }`}>
      {label}
    </span>
  );
}
