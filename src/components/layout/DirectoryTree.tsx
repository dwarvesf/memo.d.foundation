import { cn } from '@/lib/utils';
import React from 'react';

const DirectoryTree = () => {
  return (
    <div
      id="sidebar"
      className={cn(
        'bg-background-secondary flex h-[calc(100svh-32px)] w-[calc(72px+200px+28px)] flex-col pt-10 pr-3 pb-2 pl-18 text-sm leading-normal',
        'duration-0.1 transition-[opacity,transform] ease-in-out',
        'z-2 overflow-y-auto',
      )}
    >
      <p className="p-2"></p>
    </div>
  );
};

export default DirectoryTree;
