import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { cn, uppercaseSpecialWords } from '@/lib/utils';
import { SearchResult } from '../search/SearchProvider';
import { ISearchResultItem } from '@/types';
import RenderMarkdown from '../RenderMarkdown';
import { CommandSearchInput } from './CommandSearchInput';
import { MemoIcons } from '../icons';
import { Editor } from 'draft-js';
import { useThemeContext } from '@/contexts/theme';

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
  onClose: () => void;
}

export function CommandPaletteModal({
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
}: Props) {
  const { theme } = useThemeContext();

  const selectedItem = result.grouped[selectedCategory]?.[selectedIndex];
  const PreviewIcon = useMemo(
    () => getCategoryIcon(selectedItem?.category || ''),
    [selectedItem?.category],
  );

  return (
    <>
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:items-center sm:justify-center sm:p-4"
            style={{
              background:
                theme === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.2)',
            }}
          >
            <div
              ref={searchContainerRef}
              className={cn(
                'command-palette-modal dark:bg-background flex w-full flex-col overflow-hidden border border-[var(--border)] backdrop-blur-xl',
                // Mobile: bottom sheet styles
                'fixed right-0 bottom-0 left-0 max-h-[85vh] rounded-t-[16px] border-b-0',
                // Desktop: centered modal styles
                'sm:relative sm:max-h-[80vh] sm:max-w-[800px] sm:rounded-[8px] sm:border-b',
                'md:max-h-[75vh]',
              )}
              style={{
                animation: isOpen ? 'fadeIn 0.15s ease-out' : undefined,
                background:
                  'color-mix(in oklab, var(--background) 75%, transparent)',
                WebkitBackdropFilter: 'blur(16px)',
                backdropFilter: 'blur(16px)',
                boxShadow:
                  '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 25px 25px -5px rgba(0, 0, 0, 0.15)',
              }}
            >
              <div className="search-section-border relative flex-shrink-0 border-b border-[var(--border)] px-4 py-3">
                <CommandSearchInput
                  value={query}
                  onChange={(value: string) => {
                    setQuery(value);
                    setIsSearching(true);
                  }}
                  inputRef={searchInputRef}
                />
              </div>

              <div className="flex h-[450px] min-h-0 overflow-hidden sm:h-[509px]">
                <div className="flex flex-1 basis-2/5 flex-col overflow-y-auto">
                  {/* Search result.flat */}
                  {query && Object.keys(result.grouped).length > 0 && (
                    <div>
                      {Object.entries(result.grouped).map(
                        ([category, categoryResults]) => (
                          <div key={category} className="flex flex-col">
                            <div className="px-3 py-1.5 text-xs font-medium capitalize">
                              {uppercaseSpecialWords(category)}
                            </div>
                            {categoryResults.map((result, index) => {
                              const isSelected = selectedItem?.id === result.id;
                              return (
                                <button
                                  id={`result-${result.id}`}
                                  key={result.file_path}
                                  className={cn(
                                    'result-item-border command-palette-modal-result border-border group flex w-full flex-col border-b px-3 py-2.5 text-left text-sm last:border-b-0',
                                    {
                                      selected: isSelected,
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
                                  <div className="line-clamp-1 font-medium">
                                    {result.title}
                                  </div>
                                  {result.matchingLines && (
                                    <div
                                      className={cn(
                                        'text-muted-foreground [&_span]:text-primary mt-1 line-clamp-2 text-xs [&_span]:underline',
                                        {
                                          selected: isSelected,
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
                                    `command-palette-modal-result flex cursor-pointer items-center rounded-md px-2 py-2 text-sm`,
                                    {
                                      selected: isSelected,
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
                                  <div className="cmd-idle-icon bg-primary/10 mr-3 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg">
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
                      'bg-background-secondary hidden flex-1 basis-3/5 flex-col items-center overflow-y-auto border-l px-9 py-6 md:flex',
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
                              <RenderMarkdown
                                content={selectedItem.spr_content}
                              />
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Footer with keyboard shortcuts */}
              <div className="footer-section-border text-muted-foreground relative flex flex-shrink-0 justify-between border-t border-[var(--border)] p-2 text-xs">
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
                    <kbd className="esc-key mr-1 flex items-center justify-center rounded-md bg-[var(--border)] px-1.5 pt-0.5 pb-0 font-sans text-[12px] leading-4 font-medium text-[var(--muted-foreground)]">
                      ↵
                    </kbd>
                    to select
                  </div>
                </div>
                <div className="flex items-center">
                  <kbd className="esc-key mr-1 flex items-center justify-center rounded-md bg-[var(--border)] px-1 py-0.5 font-sans text-[12px] leading-4 font-medium text-[var(--muted-foreground)]">
                    Esc
                  </kbd>
                  to close
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function getCategoryIcon(
  category: string,
): React.FunctionComponent<React.ComponentProps<'svg'>> {
  const icon = category.split(' > ')[0];

  return MemoIcons[icon as keyof typeof MemoIcons] || MemoIcons.playbook;
}
