import { orderStatusLabels, orderStatusColors } from '@/data/mockData';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const label = orderStatusLabels[status] || status;
  const colors = orderStatusColors[status] || { bg: 'bg-neutral-100', text: 'text-neutral-600' };

  return (
    <span className={`inline-flex items-center font-medium rounded-full ${colors.bg} ${colors.text} ${
      size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
    }`}>
      {label}
    </span>
  );
}
