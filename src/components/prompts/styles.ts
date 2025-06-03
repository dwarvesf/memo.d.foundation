import { cn } from '@/lib/utils';

export const promptCardStyles = {
  container: cn(
    'group relative',
    'rounded-lg border p-4',
    'h-[300px] w-full overflow-hidden',
    // Default state colors
    'border-neutral-800/10 dark:border-neutral-100/10',
    'bg-gradient-to-br from-neutral-50/80 to-neutral-100/80',
    'dark:from-neutral-900 dark:to-neutral-800',
    'hover:bg-gradient-to-br hover:from-pink-50/90 hover:to-pink-100/90',
    'dark:hover:from-purple-950/10 dark:hover:to-pink-900/10',
    // // Glow effect
    // 'shadow-[var(--card-shadow)]',
    // 'dark:shadow-[var(--card-shadow-dark)]',
    // Hover state
    'hover:border-pink-500/40 dark:hover:border-pink-500/40',
    'hover:shadow-[var(--card-shadow-hover)]',
    'dark:hover:shadow-[var(--card-shadow-hover-dark)]',
    'transition-all duration-300 ease-out',
  ),

  copyButton: cn(
    'absolute top-2 right-2 z-1',
    'rounded px-2 py-1 text-xs',
    'bg-neutral-200/80 text-[var(--primary)] dark:bg-neutral-700/80 dark:text-[var(--primary)]',
    'opacity-0 transition-opacity group-hover:opacity-100',
    'hover:opacity-80',
  ),

  categoryLink: cn(
    'relative cursor-pointer px-2 py-1 text-sm flex items-center gap-2',
    'transition-all duration-200 ease-in-out',
    'text-neutral-700 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100',
    'after:absolute after:bottom-0 after:left-0 after:h-[1px] after:w-full',
    'after:bg-current after:transition-transform after:duration-200 hover:after:scale-x-100',
  ),

  content: cn(
    'flex-1 font-mono text-[12px] break-words space-y-4',
    'overflow-y-auto p-3',
    'scrollbar-thin scrollbar-thumb-neutral-300 dark:scrollbar-thumb-neutral-600 scrollbar-track-transparent',
    'bg-white/40 dark:bg-neutral-900/40',
    'rounded-lg backdrop-blur-sm',
    'group-hover:bg-white/70 dark:group-hover:bg-neutral-800/70',
  ),

  footer:
    'sticky right-0 bottom-0 left-0 mt-3 flex items-center justify-between gap-2',

  title: cn(
    'text-sm font-medium',
    'text-neutral-700 dark:text-neutral-300',
    'flex items-center gap-2',
  ),

  models: cn('text-neutral-500'),
};

export const promptMarkdownStyles = {
  inlineCode: cn(
    'rounded-lg px-0.5 py-0.5 font-mono text-sm',
    'bg-neutral-200/50 dark:bg-neutral-700/50',
    'text-neutral-500 dark:text-neutral-500',
    'group-hover:bg-neutral-200/70 dark:group-hover:bg-neutral-700/70',
    'transition-colors duration-200',
    'my-2 px-1',
  ),

  codeBlock: {
    pre: cn(
      'overflow-x-auto rounded px-1 py-1.5 font-mono text-[12px]',
      'bg-neutral-200/50 dark:bg-neutral-700/50',
      'backdrop-blur-sm',
      'my-2',
    ),
    code: cn(
      'text-neutral-500 dark:text-neutral-500',
      'group-hover:text-neutral-900 dark:group-hover:text-neutral-100',
      'transition-colors duration-200',
      'text-wrap',
    ),
  },

  template: cn(
    'group-[&:not(:hover)]:text-neutral-500 group-[&:not(:hover)]:dark:text-neutral-500',
    'group-hover:text-primary dark:group-hover:text-primary',
  ),

  textDefaultColor: cn(
    'group-[&:not(:hover)]:!text-neutral-500 group-[&:not(:hover)]:dark:!text-neutral-500',
    'transition-colors duration-200',
  ),
};
