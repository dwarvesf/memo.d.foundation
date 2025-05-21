'use client';

import { getRootLayoutPageProps } from '@/lib/content/utils';
import { getPrompts } from '@/lib/prompts';
import { IPromptItem, RootLayoutPageProps } from '@/types';
import { GetStaticProps } from 'next';
import { useRouter } from 'next/router';
import React, { useEffect, useMemo, useRef } from 'react';
import RootLayout from '../../components/layout/RootLayout';
import PromptCard from '../../components/prompts/PromptCard';
import CategoriesHeader from '../../components/prompts/CategoriesHeader';
import { useRouteSync } from '@/hooks/useRouteSync';

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
  const [activeCategory, setActiveCategory] = React.useState<string>('');
  const { updateRoute } = useRouteSync();

  // Get unique categories from prompts
  const categories = useMemo(
    () => Array.from(new Set(prompts.map(prompt => prompt.category))),
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

  // Initialize active category from URL hash or first category
  useEffect(() => {
    const hashCategory = window.location.hash.replace('#', '');
    setActiveCategory(hashCategory || categoryTitles[0].id);
  }, [categoryTitles, router.asPath]);

  // Handle route changes and scroll to the correct category
  useEffect(() => {
    const onPathChange = () => {
      // get category by hash
      const category = window.location.hash.replace('#', '');
      if (category && categoryRefs.current[category]) {
        categoryRefs.current[category]?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    };
    onPathChange();
    router.events.on('hashChangeComplete', onPathChange);
    return () => {
      router.events.off('hashChangeComplete', onPathChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChangeCategory = (category: string, isScrolling: boolean) => {
    const currentCategory = window.location.hash.replace('#', '');
    // Check if the current category is the same as the new category
    // If it is, do nothing
    if (currentCategory === category) {
      return;
    }

    // Router update hash category
    if (isScrolling) {
      router.replace(`#${category}`, undefined, {
        scroll: false,
      });
    } else {
      updateRoute(`#${category}`);
    }
  };

  // Update route based on scroll position
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const slugifiedCategory = entry.target.id;
            // Router update hash category
            handleChangeCategory(slugifiedCategory, false);
          }
        });
      },
      { threshold: 0.5 },
    );

    categories.forEach(category => {
      const slugifiedCategory = category.toLowerCase().replace(/\s+/g, '-');
      const ref = categoryRefs.current[slugifiedCategory];
      if (ref) {
        observer.observe(ref);
      }
    });

    return () => {
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <RootLayout
      title="AI Prompts"
      directoryTree={directoryTree}
      searchIndex={searchIndex}
      hideRightSidebar
      mainClassName="max-w-full w-full xl:p-2"
    >
      <div className="mx-auto w-full">
        <h1 className="-mt-2 mb-4 text-3xl font-bold text-neutral-700 dark:text-neutral-100">
          Prompt gallery
        </h1>
        <CategoriesHeader
          categories={categoryTitles}
          activeCategory={activeCategory}
          onCategoryClick={category => {
            setActiveCategory(category);
            // Router update hash category
            handleChangeCategory(category, true);
          }}
        />
        <div className="mt-8 space-y-4">
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
                <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4">
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
