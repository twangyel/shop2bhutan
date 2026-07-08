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
  iconClass: string;
}> = {
  blue: {
    label: 'Verified Contact',
    shortLabel: 'Verified',
    title: 'Verified Contact',
    shellClass: 'from-sky-400 via-blue-500 to-indigo-600 shadow-blue-500/20 ring-blue-100',
    textClass: 'text-blue-700 bg-blue-50 border-blue-100',
    iconClass: 'text-blue-600',
  },
  gold: {
    label: 'Trusted Customer 🇧🇹',
    shortLabel: 'Trusted 🇧🇹',
    title: 'Trusted Customer',
    shellClass: 'from-amber-300 via-yellow-500 to-orange-500 shadow-amber-500/25 ring-amber-100',
    textClass: 'text-amber-800 bg-amber-50 border-amber-100',
    iconClass: 'text-amber-700',
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

export function getVerificationBadgeToneClass(value?: string | null) {
  const badge = normalizeVerificationBadge(value);
  if (badge === 'blue') return BADGE_COPY.blue.iconClass;
  if (badge === 'gold') return BADGE_COPY.gold.iconClass;
  return 'text-gray-500';
}

export default function VerificationBadge({
  badge: rawBadge,
  size = 'sm',
  showLabel = false,
  className = '',
}: VerificationBadgeProps) {
  const badge = normalizeVerificationBadge(rawBadge);

  if (badge === 'none') return null;

  const copy = BADGE_COPY[badge];

  const icon = (
    <span
      title={copy.title}
      aria-label={copy.title}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br ${copy.shellClass} ${SIZE_CLASS[size]} shadow-sm ring-2 ring-offset-1 ring-offset-white ${className}`}
    >
      <span className="absolute inset-[2px] rounded-full bg-white/15" />
      <span className="absolute left-[18%] top-[14%] h-[28%] w-[28%] rounded-full bg-white/45 blur-[1px]" />
      <svg
        viewBox="0 0 32 32"
        className="relative h-[78%] w-[78%] drop-shadow-[0_1px_1px_rgba(0,0,0,0.22)]"
        aria-hidden="true"
      >
        <path
          d="M9.2 16.7 13.5 21l9.3-10.1"
          fill="none"
          stroke="white"
          strokeWidth="4.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );

  if (!showLabel) return icon;

  return (
    <span
      className={`inline-flex items-center rounded-full border font-bold ${copy.textClass} ${LABEL_SIZE_CLASS[size]}`}
      title={copy.title}
    >
      {icon}
      <span>{size === 'xs' ? copy.shortLabel : copy.label}</span>
    </span>
  );
}
