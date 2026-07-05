import { useId } from 'react';

export type VerificationBadgeKind = 'none' | 'blue' | 'gold';

type VerificationBadgeProps = {
  badge?: VerificationBadgeKind | string | null;
  size?: 'xs' | 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
};

const BADGE_COPY: Record<Exclude<VerificationBadgeKind, 'none'>, {
  label: string;
  shortLabel: string;
  title: string;
  shellClass: string;
  textClass: string;
}> = {
  blue: {
    label: 'Verified Contact',
    shortLabel: 'Verified',
    title: 'Verified Contact',
    shellClass: 'from-sky-500 via-blue-500 to-indigo-500 shadow-blue-500/25 ring-blue-100',
    textClass: 'text-blue-700 bg-blue-50 border-blue-100',
  },
  gold: {
    label: 'Trusted Customer',
    shortLabel: 'Trusted',
    title: 'Trusted Customer',
    shellClass: 'from-amber-300 via-yellow-500 to-orange-500 shadow-amber-500/30 ring-amber-100',
    textClass: 'text-amber-800 bg-amber-50 border-amber-100',
  },
};

const SIZE_CLASS = {
  xs: 'h-4 w-4',
  sm: 'h-5 w-5',
  md: 'h-6 w-6',
};

const LABEL_SIZE_CLASS = {
  xs: 'text-[10px] px-1.5 py-0.5 gap-1',
  sm: 'text-[11px] px-2 py-0.5 gap-1.5',
  md: 'text-xs px-2.5 py-1 gap-1.5',
};

export function normalizeVerificationBadge(value?: string | null): VerificationBadgeKind {
  const clean = String(value ?? '').trim().toLowerCase();
  if (clean === 'blue' || clean === 'gold') return clean;
  return 'none';
}

export function getVerificationBadgeLabel(value?: string | null) {
  const badge = normalizeVerificationBadge(value);
  if (badge === 'none') return 'No badge';
  return BADGE_COPY[badge].label;
}

export default function VerificationBadge({
  badge: rawBadge,
  size = 'sm',
  showLabel = false,
  className = '',
}: VerificationBadgeProps) {
  const badge = normalizeVerificationBadge(rawBadge);
  const gradientId = useId().replace(/:/g, '');

  if (badge === 'none') return null;

  const copy = BADGE_COPY[badge];

  const icon = (
    <span
      title={copy.title}
      aria-label={copy.title}
      className={`relative inline-flex shrink-0 items-center justify-center rounded-[0.55rem] bg-gradient-to-br ${copy.shellClass} ${SIZE_CLASS[size]} shadow-sm ring-2 ring-offset-1 ring-offset-white ${className}`}
    >
      <svg viewBox="0 0 32 32" className="h-full w-full drop-shadow-sm" aria-hidden="true">
        <defs>
          <linearGradient id={`${gradientId}-shine`} x1="7" y1="3" x2="25" y2="29" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="white" stopOpacity="0.72" />
            <stop offset="0.38" stopColor="white" stopOpacity="0.16" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M16 2.9 21.1 5l5.5 1.2 1.2 5.5L30 16l-2.2 4.3-1.2 5.5-5.5 1.2L16 29.1 10.9 27l-5.5-1.2-1.2-5.5L2 16l2.2-4.3 1.2-5.5L10.9 5 16 2.9Z"
          fill="currentColor"
          className={badge === 'gold' ? 'text-amber-500' : 'text-blue-500'}
        />
        <path
          d="M16 4.3 20.6 6.2l4.9 1.1 1.1 4.9 1.9 3.8-1.9 3.8-1.1 4.9-4.9 1.1-4.6 1.9-4.6-1.9-4.9-1.1-1.1-4.9L3.5 16l1.9-3.8 1.1-4.9 4.9-1.1L16 4.3Z"
          fill={`url(#${gradientId}-shine)`}
        />
        <path
          d="m12.3 16.3 2.3 2.35 5.35-6.1"
          fill="none"
          stroke="white"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );

  if (!showLabel) return icon;

  return (
    <span className={`inline-flex items-center rounded-full border font-bold ${copy.textClass} ${LABEL_SIZE_CLASS[size]}`} title={copy.title}>
      {icon}
      <span>{size === 'xs' ? copy.shortLabel : copy.label}</span>
    </span>
  );
}
