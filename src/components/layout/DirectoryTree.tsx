import { cn } from '@/lib/utils';
import React from 'react';

const DirectoryTree = () => {
  return (
    <div
      id="sidebar"
      className={cn(
        'bg-background-secondary h-[calc(100svh-32px)] w-0 flex-col pt-10 pb-2 pl-0 text-sm leading-normal xl:w-[calc(72px+200px+28px)] xl:pr-3 xl:pl-18 2xl:w-[360px]',
        'translate-0 transition duration-100 ease-in-out',
        'z-2 overflow-y-auto',
        'reading:opacity-0 reading:translate-x-[-10%] xl:reading:w-[72px] reading:pr-0',
      )}
    >
      <p className="p-2"></p>
    </div>
  );
};

export default DirectoryTree;
