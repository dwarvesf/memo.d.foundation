import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { cn, uppercaseSpecialWords } from '@/lib/utils';
import { SearchResult } from '../search/SearchProvider';
import { ISearchResultItem } from '@/types';
import RenderMarkdown from '../RenderMarkdown';
import { CommandSearchInput } from './CommandSearchInput';
import { MemoIcons } from '../icons';
import { Editor } from 'draft-js';

interface Props {
  isOpen: boolean;
  result: SearchResult;
  defaultResult: {
    flat: ISearchResultItem[];
    grouped: Record<string, ISearchResultItem[]>;
  };
  goto: () => void;
  searchInputRef: React.RefObject<Editor | null>;
  searchContainerRef: React.RefObject<HTMLDivElement | null>;
  setQuery: (query: string) => void;
  query: string;
  setSelectedIndex: (index: number) => void;
  selectedIndex: number;
  setSelectedCategory: (category: string) => void;
  selectedCategory: string;
  isSearching: boolean;
  setIsSearching: (isSearching: boolean) => void;
}

const CommandPaletteModal = (props: Props) => {
  const {
    isOpen,
    result,
    defaultResult,
    goto,
    searchInputRef,
    searchContainerRef,
    setQuery,
    query,
    setSelectedIndex,
    selectedIndex,
    setSelectedCategory,
    selectedCategory,
    isSearching,
    setIsSearching,
  } = props;

  const selectedItem = result.grouped[selectedCategory]?.[selectedIndex];
  const PreviewIcon = useMemo(
    () => getCategoryIcon(selectedItem?.category || ''),
    [selectedItem?.category],
  );
  return (
    isOpen &&
    typeof document !== 'undefined' &&
    createPortal(
      <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/50 p-4 backdrop-blur-sm md:pt-[min(8vh,6rem)]">
        <div
          ref={searchContainerRef}
          className="dark:bg-background w-full max-w-[800px] overflow-hidden rounded-lg bg-white shadow-lg"
          style={{ animation: 'fadeIn 0.15s ease-out' }}
        >
          <CommandSearchInput
            value={query}
            onChange={(value: string) => {
              setQuery(value);
              setIsSearching(true);
            }}
            inputRef={searchInputRef}
          />

          <div className="flex max-h-[70vh]">
            <div className="flex flex-1 basis-2/5 flex-col overflow-y-auto">
              {/* Search result.flat */}
              {query && Object.keys(result.grouped).length > 0 && (
                <div>
                  {Object.entries(result.grouped).map(
                    ([category, categoryResults]) => (
                      <div key={category} className="flex flex-col">
                        <div className="bg-border px-3 py-1.5 text-xs font-medium capitalize">
                          {uppercaseSpecialWords(category)}
                        </div>
                        {categoryResults.map((result, index) => {
                          const isSelected = selectedItem?.id === result.id;
                          return (
                            <button
                              id={`result-${result.id}`}
                              key={result.file_path}
                              className={cn(
                                'border-border group flex w-full flex-col border-b px-4 py-2.5 text-left text-sm last:border-b-0',
                                {
                                  'bg-primary text-primary-foreground':
                                    isSelected,
                                },
                              )}
                              onClick={() => {
                                goto();
                              }}
                              onMouseEnter={() => {
                                setSelectedIndex(index);
                                setSelectedCategory(category);
                              }}
                            >
                              <div className="font-medium">{result.title}</div>
                              {result.matchingLines && (
                                <div
                                  className={cn(
                                    'text-muted-foreground [&_span]:text-primary mt-1 line-clamp-2 text-xs [&_span]:underline',
                                    {
                                      'text-secondary-dark [&_span]:text-white':
                                        isSelected,
                                    },
                                  )}
                                  dangerouslySetInnerHTML={{
                                    __html: result.matchingLines,
                                  }}
                                ></div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ),
                  )}
                </div>
              )}

              {/* No result.flat state */}
              {!isSearching &&
                query &&
                Object.keys(result.grouped).length === 0 && (
                  <div className="text-muted-foreground flex flex-col items-center p-8 text-center">
                    <p>No result for &ldquo;{query}&rdquo;.</p>
                  </div>
                )}

              {!query &&
                Object.entries(defaultResult.grouped).map(
                  ([category, categoryResults]) => (
                    <div className="my-2 px-3" key={category}>
                      <div className="text-muted-foreground px-2 py-1.5 text-xs font-medium">
                        {category}
                      </div>
                      <div className="space-y-0.5">
                        {categoryResults.map((result, index) => {
                          const isSelected =
                            defaultResult.grouped[selectedCategory]?.[
                              selectedIndex
                            ]?.id === result.id;
                          return (
                            <div
                              id={`result-${result.id}`}
                              key={result.title}
                              className={cn(
                                `hover:bg-muted flex cursor-pointer items-center rounded-md px-2 py-2 text-sm`,
                                {
                                  'bg-muted': isSelected,
                                },
                              )}
                              onClick={e => {
                                e.preventDefault();
                                goto();
                              }}
                              onMouseEnter={() => {
                                setSelectedIndex(index);
                                setSelectedCategory(category);
                              }}
                              data-suggestion-id="0"
                            >
                              <div className="cmd-idle-icon bg-primary/10 mr-3 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg">
                                {result.icon}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-foreground">
                                  {result.title}
                                </span>
                                <span className="text-muted-foreground text-xs">
                                  {result.description}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ),
                )}
            </div>
            {query && !!result.flat.length && (
              <div
                className={cn(
                  'flex-1 basis-3/5 shadow-[inset_1px_1px_2px_rgba(147,149,159,.24),inset_2px_2px_8px_rgba(147,149,159,.1)]',
                  'bg-background-secondary hidden flex-col items-center overflow-y-auto border-l px-9 py-6 md:flex',
                )}
              >
                <div className="h-9 w-9">
                  <PreviewIcon className="h-9 w-9" />
                </div>

                {selectedItem && (
                  <>
                    {/* Category/Path */}
                    <span className="mt-3.5 text-center text-xs capitalize">
                      {uppercaseSpecialWords(selectedItem.category)}
                    </span>

                    {/* Title */}
                    <h3 className="m-0 mt-2 text-center font-serif text-2xl leading-tight font-medium">
                      {selectedItem.title}
                    </h3>

                    {/* Description */}
                    <p className="mt-3.5 w-full font-serif text-sm font-medium">
                      {selectedItem.description}
                    </p>

                    {/* Content preview */}
                    {selectedItem.spr_content && (
                      <div className="text-secondary-light dark:text-secondary-dark mt-8 self-start font-serif">
                        <span className="text-xs font-medium uppercase underline">
                          on this page
                        </span>

                        <div className="mt-5 text-sm [&_code]:italic">
                          <RenderMarkdown content={selectedItem.spr_content} />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer with keyboard shortcuts */}
          <div className="border-border text-muted-foreground flex justify-between border-t p-2 text-xs">
            <div className="flex space-x-4">
              <div className="flex items-center">
                <svg
                  className="mr-1"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="18 15 12 9 6 15"></polyline>
                </svg>
                <svg
                  className="mr-1"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                to navigate
              </div>
              <div className="flex items-center">
                <kbd className="bg-muted mr-1 rounded border px-1 py-0.5">
                  ↵
                </kbd>
                to select
              </div>
            </div>
            <div className="flex items-center">
              <kbd className="bg-muted mr-1 rounded border px-1 py-0.5">
                Esc
              </kbd>
              to close
            </div>
          </div>
        </div>
      </div>,
      document.body,
    )
  );
};

export default CommandPaletteModal;

function getCategoryIcon(
  category: string,
): React.FunctionComponent<React.SVGProps<SVGSVGElement>> {
  const icon = category.split(' > ')[0];

  return MemoIcons[icon as keyof typeof MemoIcons] || MemoIcons.playbook;
}
