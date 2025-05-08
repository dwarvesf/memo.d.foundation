import React from 'react';
import clsx from 'clsx';

interface TagProps extends React.HTMLAttributes<HTMLAnchorElement> {
  className?: string;
  children: React.ReactNode;
  href?: string;
}

export const Tag: React.FC<TagProps> = ({ className, children, ...props }) => {
  return (
    <a
      className={clsx(
        'bg-muted hover:bg-muted/80 hover:text-primary dark:bg-border dark:text-foreground dark:hover:text-primary inline-flex items-center rounded-md px-1.5 py-0.5 font-medium text-[#4b4f53]',
        className,
      )}
      {...props}
    >
      {children}
    </a>
  );
};

export default Tag;
