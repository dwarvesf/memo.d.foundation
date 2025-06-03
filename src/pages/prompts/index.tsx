'use client';

import { getRootLayoutPageProps } from '@/lib/content/utils';
import { getPrompts } from '@/lib/prompts';
import { IPromptItem, RootLayoutPageProps } from '@/types';
import { GetStaticProps } from 'next';
import { useRouter } from 'next/router';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'; // Added useCallback
import RootLayout from '../../components/layout/RootLayout';
import CategoriesHeader from '../../components/prompts/CategoriesHeader';
import PromptCard from '../../components/prompts/PromptCard';

const useSafeLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface PromptsPageProps extends RootLayoutPageProps {
  prompts: IPromptItem[];
}

/**
 * Get static props for the prompts category page
 * @param params Contains the category parameter from the URL
 * @returns Props for the page component
 */
export const getStaticProps: GetStaticProps<PromptsPageProps> = async () => {
  const prompts = await getPrompts();
  const layoutProps = await getRootLayoutPageProps();
  return {
    props: {
      ...layoutProps,
      prompts,
    },
  };
};

/**
 * Prompts category page component
 * Displays a grid of prompt cards filtered by category
 */
const PromptsPage: React.FC<PromptsPageProps> = ({
  directoryTree,
  searchIndex,
  prompts,
}) => {
  const categoryRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const router = useRouter();
  const [isInitialLoadScrollHandled, setIsInitialLoadScrollHandled] =
    useState(false);

  // Get unique categories from prompts
  const categories = useMemo(
    () =>
      Array.from(new Set(prompts.map(prompt => prompt.category))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [prompts],
  );

  // Group prompts by category
  const groupedPrompts = useMemo(() => {
    return categories.reduce(
      (acc, category) => {
        const slugifiedCategory = category.toLowerCase().replace(/\s+/g, '-');
        acc[slugifiedCategory] = {
          prompts: prompts.filter(prompt => prompt.category === category),
          title: category,
        };
        return acc;
      },
      {} as Record<string, { prompts: IPromptItem[]; title: string }>,
    );
  }, [categories, prompts]);

  const categoryTitles = Object.entries(groupedPrompts).map(([id, cat]) => ({
    id,
    title: cat.title,
    count: cat.prompts.length,
  }));

  const handleChangeCategory = useCallback(
    (categorySlug: string, triggeredByScroll: boolean) => {
      const currentHash = window.location.hash.replace('#', '');
      if (currentHash === categorySlug) {
        return;
      }

      if (triggeredByScroll) {
        // For updates triggered by scrolling:
        // Directly use history.replaceState to update hash without scrolling or adding to history.
        // This bypasses Next.js router's scroll handling for this specific case.
        const newUrl = `${window.location.pathname}#${categorySlug}`;
        window.history.replaceState(
          { ...window.history.state, as: newUrl, url: newUrl },
          '',
          newUrl,
        );
      } else {
        // For updates triggered by user click (e.g., from CategoriesHeader):
        // Push URL, DO add to history, DO scroll to the element.
        router.replace(`#${categorySlug}`, undefined, { scroll: true }); // scroll: true is default, can be omitted
      }
    },
    [router], // Dependency for useCallback
  );

  // Update route based on scroll position
  const debouncedScrollUpdateRef = useRef<NodeJS.Timeout | null>(null);

  // Effect for initial scroll to hash on page load/refresh
  useSafeLayoutEffect(() => {
    if (router.isReady && !isInitialLoadScrollHandled) {
      const hash = window.location.hash.substring(1); // Get hash without '#'
      if (hash) {
        const element = document.getElementById(hash);
        if (element) {
          element.scrollIntoView({ block: 'start' }); // Default behavior 'auto' is instant
        }
        // Defer setting the flag to allow scroll to take effect before observer logic fully engages
        const timerId = setTimeout(() => {
          setIsInitialLoadScrollHandled(true);
        }, 0);
        return () => clearTimeout(timerId);
      } else {
        // No hash, still defer setting the flag for consistent behavior timing
        const timerId = setTimeout(() => {
          setIsInitialLoadScrollHandled(true);
        }, 0);
        return () => clearTimeout(timerId);
      }
    }
  }, [router.isReady, router.asPath, isInitialLoadScrollHandled]);

  useEffect(() => {
    if (!isInitialLoadScrollHandled) {
      return; // Don't set up observer until initial scroll is handled
    }

    const observer = new IntersectionObserver(
      entries => {
        if (!isInitialLoadScrollHandled) return;

        const intersectingEntries = entries.filter(
          entry => entry.isIntersecting,
        );

        if (intersectingEntries.length > 0) {
          // Sort by top position to find the one closest to the top of the viewport
          intersectingEntries.sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          );

          // The first one is the "most active" at the top
          const activeEntry = intersectingEntries[0];
          const slugifiedCategory = activeEntry.target.id;

          if (debouncedScrollUpdateRef.current) {
            clearTimeout(debouncedScrollUpdateRef.current);
          }
          debouncedScrollUpdateRef.current = setTimeout(() => {
            handleChangeCategory(slugifiedCategory, true);
          }, 150); // Debounce time: 150ms
        }
      },
      { threshold: 0.5 }, // Adjust threshold as needed
    );

    const currentCategoryRefs = categoryRefs.current;
    categories.forEach(category => {
      // `categories` is a dependency
      const slugifiedCategory = category.toLowerCase().replace(/\s+/g, '-');
      const ref = currentCategoryRefs[slugifiedCategory];
      if (ref) {
        observer.observe(ref);
      }
    });

    return () => {
      // Disconnect observer when component unmounts or dependencies change
      categories.forEach(category => {
        const slugifiedCategory = category.toLowerCase().replace(/\s+/g, '-');
        const ref = currentCategoryRefs[slugifiedCategory];
        if (ref) {
          observer.unobserve(ref); // More precise cleanup
        }
      });
      if (debouncedScrollUpdateRef.current) {
        clearTimeout(debouncedScrollUpdateRef.current);
      }
      observer.disconnect();
    };
  }, [categories, handleChangeCategory, isInitialLoadScrollHandled]); // Added isInitialLoadScrollHandled

  return (
    <RootLayout
      title="AI Prompts"
      directoryTree={directoryTree}
      searchIndex={searchIndex}
      hideRightSidebar
      fullWidth
      mainClassName="max-w-full w-full xl:p-2"
    >
      <div className="mx-auto w-full xl:-mt-6">
        <h1 className="mb-4 inline-flex transform text-3xl font-bold text-neutral-700 dark:text-neutral-100">
          Prompt gallery
        </h1>
        <CategoriesHeader
          categories={categoryTitles}
          onSelectCategory={slug => handleChangeCategory(slug, false)}
        />
        <div className="mt-8 space-y-4 pb-4">
          {Object.entries(groupedPrompts).map(([category, catPrompts]) => {
            return (
              <section
                key={category}
                id={category}
                ref={(el: HTMLDivElement | null) => {
                  categoryRefs.current[category] = el;
                }}
              >
                <h2 className="text-md mb-4 font-bold text-neutral-700 dark:text-neutral-100">
                  {catPrompts.title}
                </h2>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
                  {catPrompts.prompts.map(prompt => (
                    <PromptCard
                      category={category}
                      key={prompt.filePath}
                      prompt={prompt}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </RootLayout>
  );
};

export default PromptsPage;
