import React, { useState, useEffect, useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { ITocItem } from '@/types';
import { flattenTocItems } from '@/lib/utils'; // Assuming this utility exists or will be created

interface HeadingNavigatorProps {
  items?: ITocItem[];
  scrollToId: (id: string) => void;
}

const HeadingNavigator: React.FC<HeadingNavigatorProps> = ({
  items,
  scrollToId,
}) => {
  const [open, setOpen] = useState(false);
  const flattenedHeadings = items ? flattenTocItems(items) : [];

  // Hotkey to open the dialog
  useHotkeys(
    'g>h',
    () => {
      setOpen(prev => !prev);
    },
    { enableOnFormTags: true, preventDefault: true },
    [],
  );

  // Close on Escape key (handled by Dialog component, but good to have explicit control if needed)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const handleSelect = useCallback(
    (id: string) => {
      scrollToId(id);
      setOpen(false);
    },
    [scrollToId],
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search headings..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Headings">
          {flattenedHeadings.map(item => (
            <CommandItem
              key={item.id}
              value={item.value} // This is used for searching
              onSelect={() => handleSelect(item.id)}
            >
              {item.value}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};

export default HeadingNavigator;
