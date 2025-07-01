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
import { cn } from '@/lib/utils';

interface HeadingNavigatorProps {
  items?: ITocItem[];
  scrollToId: (id: string) => void;
}

const HeadingNavigator: React.FC<HeadingNavigatorProps> = ({
  items,
  scrollToId,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filteredHeadings, setFilteredHeadings] = useState<ITocItem[]>([]);

  // Hotkey to open the dialog
  useHotkeys(
    'g>h',
    () => {
      setTimeout(() => {
        setOpen(true);
        setSearch('');
      }, 100); // Delay to ensure dialog is ready
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

  const flattenTocItems = useCallback((tocItems: ITocItem[]): ITocItem[] => {
    let flattened: ITocItem[] = [];
    tocItems.forEach(item => {
      flattened.push(item);
      if (item.children) {
        flattened = flattened.concat(flattenTocItems(item.children));
      }
    });
    return flattened;
  }, []);

  // Function to filter headings, returns an array of ITocItem
  const filterHeadings = useCallback(
    (tocItems: ITocItem[], currentSearch: string) => {
      const lowerCaseSearch = currentSearch.toLowerCase();
      const flattenedItems = flattenTocItems(tocItems);

      return flattenedItems.filter(item =>
        item.value.toLowerCase().includes(lowerCaseSearch),
      );
    },
    [flattenTocItems],
  );

  // Update filteredHeadings state whenever items or search changes
  useEffect(() => {
    setFilteredHeadings(filterHeadings(items || [], search));
  }, [items, search, filterHeadings]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search headings..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Headings">
          {filteredHeadings.length > 0 ? (
            filteredHeadings.map((item, index) => (
              <CommandItem
                key={`${item.id}-${index}`}
                value={item.value} // This is used for searching
                onSelect={() => handleSelect(item.id)}
                className={cn(
                  'flex cursor-pointer items-center gap-1 space-x-2 rounded px-2 py-1.25 text-left text-xs leading-normal font-medium',
                  {
                    'ml-0': item.depth === 2,
                    'ml-5': item.depth === 3,
                    'ml-10': item.depth === 4,
                    'ml-15': item.depth === 5,
                  },
                )}
              >
                {item.value}
              </CommandItem>
            ))
          ) : (
            <CommandEmpty />
          )}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};

export default HeadingNavigator;
