import { ComponentPropsWithoutRef, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface BentoGridProps extends ComponentPropsWithoutRef<'div'> {
  children: ReactNode;
  className?: string;
}

interface BentoCardProps extends ComponentPropsWithoutRef<'div'> {
  name: string;
  className: string;
  background: ReactNode;
  Icon: React.ElementType;
  description: string;
  href: string;
  cta: string;
}

const BentoGrid = ({ children, className, ...props }: BentoGridProps) => {
  return (
    <div
      className={cn(
        'grid w-full auto-rows-[22rem] grid-cols-1 gap-4 sm:grid-cols-9',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

const BentoCard = ({
  name,
  className,
  background,
  Icon,
  description,
  ...props
}: BentoCardProps) => (
  <div
    key={name}
    className={cn(
      'relative col-span-3 flex flex-col justify-between overflow-hidden rounded-xl',
      // light styles
      'bg-background [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]',
      // dark styles
      'dark:bg-background transform-gpu dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset] dark:[border:1px_solid_rgba(255,255,255,.1)]',
      className,
    )}
    {...props}
  >
    <div className="relative p-6 pb-1">{background}</div>
    <div className="pointer-events-none absolute bottom-0 z-10 flex flex-col gap-1 p-6 opacity-90">
      <Icon className="text-muted-foreground h-8 w-8" />
      <p className="text-foreground !m-0 text-xl font-semibold">{name}</p>
      <span className="text-muted-foreground !m-0 max-w-lg">{description}</span>
    </div>
  </div>
);

export { BentoCard, BentoGrid };
