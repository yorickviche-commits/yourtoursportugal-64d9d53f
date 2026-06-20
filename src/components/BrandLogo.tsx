import { cn } from '@/lib/utils';
import logoAsset from '@/assets/your-tours-logo.png.asset.json';

type BrandLogoProps = {
  className?: string;
  imageClassName?: string;
  showText?: boolean;
};

const BrandLogo = ({ className, imageClassName, showText = true }: BrandLogoProps) => (
  <div className={cn('flex items-center gap-2 min-w-0', className)}>
    <img
      src={logoAsset.url}
      alt="Your Tours Portugal"
      className={cn('h-9 w-9 shrink-0 rounded-full object-contain', imageClassName)}
      loading="eager"
    />
    {showText && (
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-bold text-primary">YOUR TOURS</p>
        <p className="truncate text-[11px] font-medium text-muted-foreground">Portugal</p>
      </div>
    )}
  </div>
);

export default BrandLogo;