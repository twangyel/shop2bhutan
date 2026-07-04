import { orderStatusLabels, orderStatusColors } from '@/data/mockData';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const label = orderStatusLabels[status] || status;
  const colors = orderStatusColors[status] || { bg: 'bg-gray-100', text: 'text-gray-600' };

  return (
    <span className={`inline-flex items-center font-semibold rounded-full border border-gray-100 ${colors.bg} ${colors.text} ${
      size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
    }`}>
      {label}
    </span>
  );
}
