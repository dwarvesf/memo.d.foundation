import React, { useMemo, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  cn,
  enrichedQueryMatchedValue,
  uppercaseSpecialWords,
} from '@/lib/utils';
import { SearchResult } from '../search/SearchProvider';
import { ISearchResultItem } from '@/types';
import RenderMarkdown from '../RenderMarkdown';
import { CommandSearchInput } from './CommandSearchInput';
import { MemoIcons } from '../icons';
import { Editor } from 'draft-js';
import { useThemeContext } from '@/contexts/theme';
import { Drawer, DrawerContent } from '../ui/drawer';

interface Props {
  isOpen: boolean;
  result: SearchResult;
  defaultResult: {
    flat: ISearchResultItem[];
    grouped: Record<string, ISearchResultItem[]>;
  };
  goto: () => void;
  searchInputRef: React.RefObject<Editor | null>;
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
  setQuery,
  query,
  setSelectedIndex,
  selectedIndex,
  setSelectedCategory,
  selectedCategory,
  isSearching,
  setIsSearching,
  onClose,
}: Props) {
  const { theme } = useThemeContext();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 640;
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const selectedItem = result.grouped[selectedCategory]?.[selectedIndex];
  const PreviewIcon = useMemo(
    () => getCategoryIcon(selectedItem?.category || ''),
    [selectedItem?.category],
  );

  // Ref for scrollable result list
  const resultListRef = React.useRef<HTMLDivElement>(null);
  const contentListRef = React.useRef<HTMLDivElement>(null);

  // Reset scroll offset to top on query change
  useEffect(() => {
    if (resultListRef.current) {
      resultListRef.current.scrollTop = 0;
    }
  }, [query]);

  // Reset scroll offset to top on selectedItem change
  useEffect(() => {
    if (contentListRef.current) {
      contentListRef.current.scrollTop = 0;
    }
  }, [selectedItem]);

  // Shared content for both desktop and mobile views
  const bodyRender = (
    <>
      <div className="search-section-border relative flex h-11 flex-shrink-0 items-center border-b border-[var(--border)] px-4">
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
        <div
          className="flex flex-1 basis-2/5 flex-col overflow-y-auto"
          ref={resultListRef}
        >
          {/* Search result.flat */}
          {query && Object.keys(result.grouped).length > 0 && (
            <div>
              {Object.entries(result.grouped).map(
                ([category, categoryResults]) => (
                  <div key={category} className="flex flex-col">
                    <div
                      className="[&_span]:text-primary px-3 py-1.5 text-xs font-medium capitalize [&_span]:underline"
                      dangerouslySetInnerHTML={{
                        __html: enrichedQueryMatchedValue(
                          uppercaseSpecialWords(category),
                          query,
                        ),
                      }}
                    />
                    {categoryResults.map((result, index) => {
                      const isSelected = selectedItem?.id === result.id;
                      return (
                        <button
                          id={`result-${result.id}`}
                          key={result.file_path}
                          className={cn(
                            'result-item-border command-palette-modal-result border-border group flex w-full cursor-pointer flex-col border-b px-3 py-2.5 text-left text-sm last:border-b-0',
                            {
                              selected: isSelected,
                            },
                          )}
                          onClick={e => {
                            e.stopPropagation();
                            goto();
                          }}
                          onMouseEnter={() => {
                            setSelectedIndex(index);
                            setSelectedCategory(category);
                          }}
                        >
                          <div
                            className="[&_span]:text-primary line-clamp-1 font-medium [&_span]:underline"
                            dangerouslySetInnerHTML={{
                              __html: result.title,
                            }}
                          />
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
                        defaultResult.grouped[selectedCategory]?.[selectedIndex]
                          ?.id === result.id;
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
                            e.stopPropagation();
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
            ref={contentListRef}
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
                <span
                  className="[&_span]:text-primary mt-3.5 text-center text-xs capitalize [&_span]:underline"
                  dangerouslySetInnerHTML={{
                    __html: enrichedQueryMatchedValue(
                      uppercaseSpecialWords(selectedItem.category),
                      query,
                    ),
                  }}
                />

                {/* Title */}
                <h3
                  className="[&_span]:text-primary m-0 mt-2 text-center font-serif text-2xl leading-tight font-medium [&_span]:underline"
                  dangerouslySetInnerHTML={{ __html: selectedItem.title }}
                />

                {/* Description */}
                <p className="mt-3.5 font-serif text-sm font-medium">
                  {selectedItem.description}
                </p>

                {/* Content preview */}
                {selectedItem.spr_content && (
                  <div className="text-secondary-light dark:text-secondary-dark mt-8 self-start font-serif">
                    <span className="text-xs font-medium uppercase underline">
                      on this page
                    </span>

                    <div className="[&_span.spr-content-highlight]:text-primary mt-5 text-sm [&_code]:italic [&_span.spr-content-highlight]:underline">
                      <RenderMarkdown
                        content={selectedItem.spr_content}
                        getHighlightedText={value =>
                          enrichedQueryMatchedValue(
                            value,
                            query,
                            'spr-content-highlight',
                          )
                        }
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
    </>
  );

  // Desktop modal version (unchanged for screens >= 640px)
  const desktopModal = (
    <>
      {typeof document !== 'undefined' &&
        createPortal(
          isOpen ? (
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
              style={{
                background:
                  theme === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.2)',
              }}
              onClick={() => {
                onClose();
              }}
            >
              <div
                className={cn(
                  'command-palette-modal dark:bg-background flex w-full flex-col overflow-hidden border border-[var(--border)] backdrop-blur-xl',
                  'relative max-h-[80vh] max-w-[800px] rounded-lg border-b',
                  'md:max-h-[75vh]',
                )}
                onClick={e => e.stopPropagation()}
                style={{
                  animation: 'fadeIn 0.15s ease-out',
                  background:
                    'color-mix(in oklab, var(--background) 75%, transparent)',
                  WebkitBackdropFilter: 'blur(16px)',
                  backdropFilter: 'blur(16px)',
                  boxShadow:
                    '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 25px 25px -5px rgba(0, 0, 0, 0.15)',
                }}
              >
                {bodyRender}
              </div>
            </div>
          ) : null,
          document.body,
        )}
    </>
  );

  // Mobile drawer version using vaul
  const mobileDrawer = (
    <Drawer
      open={isOpen}
      onOpenChange={open => !open && onClose()}
      direction="bottom"
    >
      <DrawerContent
        hideHandle={true}
        className="command-palette-modal max-h-[85vh] rounded-t-2xl border-b-0"
        style={{
          background: 'color-mix(in oklab, var(--background) 75%, transparent)',
          WebkitBackdropFilter: 'blur(16px)',
          backdropFilter: 'blur(16px)',
          boxShadow:
            '0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 25px 25px -5px rgba(0, 0, 0, 0.15)',
        }}
      >
        <div className="flex w-full flex-col overflow-hidden">{bodyRender}</div>
      </DrawerContent>
    </Drawer>
  );

  return isMobile ? mobileDrawer : desktopModal;
}

function getCategoryIcon(
  category: string,
): React.FunctionComponent<React.ComponentProps<'svg'>> {
  const icon = category.split(' > ')[0];

  return MemoIcons[icon as keyof typeof MemoIcons] || MemoIcons.playbook;
}
