import { BRAND } from '@/config/brand'

type BrandLogoVariant = 'full' | 'short' | 'mark'

type BrandLogoProps = {
  variant?: BrandLogoVariant
  className?: string
  imgClassName?: string
  showTagline?: boolean
}

export default function BrandLogo({
  variant = 'full',
  className = '',
  imgClassName = '',
  showTagline = false,
}: BrandLogoProps) {
  const src = BRAND.logos[variant]

  const defaultSize =
    variant === 'mark'
      ? 'h-10 w-10'
      : variant === 'short'
        ? 'h-10 w-auto'
        : 'h-12 w-auto'

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src={src}
        alt={BRAND.name}
        className={`${defaultSize} object-contain ${imgClassName}`}
        draggable={false}
      />

      {showTagline && variant === 'full' && (
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-900">{BRAND.name}</p>
          <p className="text-xs text-slate-500">{BRAND.tagline}</p>
        </div>
      )}
    </div>
  )
}