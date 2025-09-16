import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { useAudioEffects } from '@/hooks/useAudioEffects';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-sans rounded-lg text-sm leading-6 font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive cursor-pointer",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-none hover:bg-primary/90',
        destructive:
          'bg-destructive text-white shadow-none hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'border bg-background shadow-none hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary:
          'bg-secondary text-secondary-foreground shadow-none hover:bg-secondary/80',
        ghost:
          'hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 p-2 min-w-25 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

interface ButtonProps
  extends React.ComponentProps<'button'>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  enableSounds?: boolean;
  soundOnHover?: 'slide' | 'none';
  soundOnClick?: 'pop' | 'sharp-click' | 'button-toggle' | 'none';
  isToggled?: boolean;
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  enableSounds = true,
  soundOnHover = 'none',
  soundOnClick = 'pop',
  isToggled,
  onClick,
  onMouseEnter,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  const {
    playSlide,
    playPop,
    playSharpClick,
    playButtonUp,
    playButtonDown,
    isSoundEnabled,
  } = useAudioEffects();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (enableSounds && isSoundEnabled) {
      if (soundOnClick === 'button-toggle') {
        // For toggle buttons, play different sounds based on state
        if (isToggled !== undefined) {
          if (isToggled) {
            playButtonDown();
          } else {
            playButtonUp();
          }
        } else {
          playPop();
        }
      } else if (soundOnClick === 'pop') {
        playPop();
      } else if (soundOnClick === 'sharp-click') {
        playSharpClick();
      }
    }

    if (onClick) {
      onClick(e);
    }
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (enableSounds && isSoundEnabled && soundOnHover === 'slide') {
      playSlide();
    }

    if (onMouseEnter) {
      onMouseEnter(e);
    }
  };

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      {...props}
    />
  );
}

export { Button, buttonVariants };
