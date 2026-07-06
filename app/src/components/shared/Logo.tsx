import BrandLogo from '@/components/BrandLogo';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

const sizeMap = {
  sm: {
    mark: 'h-8 w-8',
    text: 'text-base',
    gap: 'gap-1.5',
  },
  md: {
    mark: 'h-10 w-10',
    text: 'text-lg',
    gap: 'gap-2',
  },
  lg: {
    mark: 'h-12 w-12',
    text: 'text-xl',
    gap: 'gap-2.5',
  },
  xl: {
    mark: 'h-16 w-16',
    text: 'text-2xl',
    gap: 'gap-3',
  },
};

export default function Logo({
  size = 'md',
  showText = true,
  className = '',
}: LogoProps) {
  const s = sizeMap[size];

  return (
    <div className={`flex items-center ${s.gap} ${className}`}>
      <BrandLogo
        variant="mark"
        imgClassName={s.mark}
      />

      {showText && (
        <span
          className={`${s.text} whitespace-nowrap font-black tracking-[-0.04em] text-[#0039A6]`}
        >
          Shop<span className="text-orange-500">2</span>Bhutan
        </span>
      )}
    </div>
  );
}
