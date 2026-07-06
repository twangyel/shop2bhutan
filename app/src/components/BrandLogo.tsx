import { BRAND } from '@/config/brand'

type BrandLogoVariant = 'full' | 'short' | 'mark'

type BrandLogoProps = {
  variant?: BrandLogoVariant
  className?: string
  imgClassName?: string
  showTagline?: boolean
}

function BagMark({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      role="img"
      aria-label="Shop2Bhutan mark"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M39 42V31c0-14 10-24 21-24s21 10 21 24v11"
        fill="none"
        stroke="#0039A6"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <rect
        x="22"
        y="35"
        width="76"
        height="76"
        rx="16"
        fill="#ff7a00"
      />
      <rect
        x="27"
        y="42"
        width="66"
        height="62"
        rx="12"
        fill="#ff8a00"
        opacity="0.9"
      />
      <text
        x="60"
        y="90"
        textAnchor="middle"
        fontSize="62"
        fontWeight="900"
        fontFamily="Arial, Helvetica, sans-serif"
        fill="white"
      >
        2
      </text>
    </svg>
  )
}

export default function BrandLogo({
  variant = 'full',
  className = '',
  imgClassName = '',
  showTagline = false,
}: BrandLogoProps) {
  if (variant === 'mark') {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <BagMark className={`h-10 w-10 ${imgClassName}`} />
      </div>
    )
  }

  if (variant === 'short') {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <svg
          viewBox="0 0 310 120"
          className={`h-12 w-auto ${imgClassName}`}
          role="img"
          aria-label="S2B"
          xmlns="http://www.w3.org/2000/svg"
        >
          <text
            x="0"
            y="85"
            fontSize="86"
            fontWeight="900"
            fontFamily="Arial, Helvetica, sans-serif"
            fill="#0039A6"
          >
            S
          </text>

          <g transform="translate(110 5) scale(0.9)">
            <BagMark />
          </g>

          <text
            x="210"
            y="85"
            fontSize="86"
            fontWeight="900"
            fontFamily="Arial, Helvetica, sans-serif"
            fill="#0039A6"
          >
            B
          </text>
        </svg>
      </div>
    )
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg
        viewBox="0 0 520 230"
        className={`h-24 w-auto ${imgClassName}`}
        role="img"
        aria-label={BRAND.name}
        xmlns="http://www.w3.org/2000/svg"
      >
        <text
          x="0"
          y="90"
          fontSize="88"
          fontWeight="900"
          fontFamily="Arial, Helvetica, sans-serif"
          fill="#0039A6"
        >
          Shop
        </text>

        <g transform="translate(335 10) scale(0.85)">
          <BagMark />
        </g>

        <text
          x="0"
          y="188"
          fontSize="88"
          fontWeight="900"
          fontFamily="Arial, Helvetica, sans-serif"
          fill="#0039A6"
        >
          Bhutan
        </text>
      </svg>

      {showTagline && (
        <p className="mt-1 text-xs font-medium text-slate-500">
          {BRAND.tagline}
        </p>
      )}
    </div>
  )
}