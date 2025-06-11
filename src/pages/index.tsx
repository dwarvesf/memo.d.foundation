import { GetStaticProps } from 'next';

import { RootLayout } from '../components';
import { IMemoItem, RootLayoutPageProps } from '@/types';

import { getRootLayoutPageProps } from '@/lib/content/utils';
import { convertToMemoItems } from '@/lib/content/memo';
import { getMdxSource } from '@/lib/mdx';
import path from 'path';
import RemoteMdxRenderer from '@/components/RemoteMdxRenderer';
import { SerializeResult } from 'next-mdx-remote-client';
import { queryDuckDB } from '@/lib/db/utils';
import { serialize } from 'next-mdx-remote-client/serialize';
import { fetchContributorProfiles } from '@/lib/contributor-profile';

interface HomePageProps extends RootLayoutPageProps {
  mdxSource?: SerializeResult;
}

export const getStaticProps: GetStaticProps = async () => {
  try {
    const layoutProps = await getRootLayoutPageProps(); // Await the asynchronous function
    const queryFields = [
      'short_title',
      'title',
      'file_path',
      'authors',
      'description',
      'date',
      'tags',
      'md_content',
    ];
    const querySelect = `SELECT ${queryFields.join(', ')}`;

    // Add default empty arrays and error handling for each query
    let ogifMemos: IMemoItem[] = [];
    try {
      ogifMemos = await queryDuckDB(`
        ${querySelect}
        FROM vault
        WHERE ARRAY_CONTAINS(tags, 'ogif')
        ORDER BY date DESC
        LIMIT 5
        `).then(convertToMemoItems);
    } catch (error) {
      console.error('Error fetching ogif memos:', error);
    }

    let newMemos: IMemoItem[] = [];
    try {
      newMemos = await queryDuckDB(`
        ${querySelect}
        FROM vault
        ORDER BY date DESC
        LIMIT 3
        `).then(convertToMemoItems);
    } catch (error) {
      console.error('Error fetching new memos:', error);
    }

    let teamMemos: IMemoItem[] = [];
    try {
      teamMemos = await queryDuckDB(`
        ${querySelect}
        FROM vault
        WHERE tags IS NOT NULL
        AND ARRAY_CONTAINS(tags, 'team')
        ORDER BY date DESC
        LIMIT 3
        `).then(convertToMemoItems);
    } catch (error) {
      console.error('Error fetching team memos:', error);
    }

    let changelogMemos: IMemoItem[] = [];
    try {
      changelogMemos = await queryDuckDB(`
        ${querySelect}
        FROM vault
        WHERE file_path LIKE 'updates/changelog%'
        ORDER BY date DESC
        LIMIT 3
        `).then(convertToMemoItems);
    } catch (error) {
      console.error('Error fetching changelog memos:', error);
    }

    let hiringMemos: IMemoItem[] = [];
    try {
      hiringMemos = await queryDuckDB(`
        ${querySelect}
        FROM vault
        WHERE tags IS NOT NULL
        AND ARRAY_CONTAINS(tags, 'hiring') AND hiring = true
        ORDER BY date DESC
        LIMIT 3
        `).then(convertToMemoItems);
    } catch (error) {
      console.error('Error fetching hiring memos:', error);
    }

    // get all memos with tags (object with title and tags field)
    let memosWithTags: { title: string; tags: string[] }[] = [];
    try {
      memosWithTags = await queryDuckDB(`
        SELECT title, tags, file_path, date, authors
        FROM vault
        WHERE tags IS NOT NULL
        ORDER BY date DESC
      `).then(async results => {
        const filteredResults = results.filter(
          result => result.title && Array.isArray(result.tags),
        );

        return await Promise.all(
          filteredResults.map(async result => {
            const authorAvatars =
              result.authors && Array.isArray(result.authors)
                ? (
                    await fetchContributorProfiles(
                      result.authors.filter(
                        (author): author is string =>
                          typeof author === 'string',
                      ),
                    )
                  ).map(profile => profile?.avatar ?? null)
                : [];

            return {
              title: result.title as string,
              tags: result.tags as string[],
              filePath: result.file_path as string,
              date: result.date as string,
              authors: result.authors as string[],
              authorAvatars,
            };
          }),
        );
      });
    } catch (error) {
      console.error('Error fetching memos with tags:', error);
    }

    const mdxPath = path.join(process.cwd(), 'public/content/', `index.mdx`);
    const mdxSource = await getMdxSource({
      mdxPath,
      scope: {
        ogifMemos,
        newMemos,
        teamMemos,
        changelogMemos,
        hiringMemos,
        directoryTree: layoutProps.directoryTree,
        memosWithTags,
      },
    });

    // temp
    const newSource = await serialize({
      source: `
## Welcome to Dwarves Memo

This site is a part of our continuous learning engine, where we want to build up the 1% improvement habit, learning in public.

- Research: [vibe coding](updates/build-log/vibe-coding/readme.md)
- Hiring: [🧠 growth lead](careers/open-positions/growth-lead.md), [💼 sales manager](careers/open-positions/sales-manager.md)
- Just shipped: [brainery](updates/build-log/brainery/readme.md), [memo](updates/build-log/memo/readme.md), [mcp-playbook](updates/build-log/playbook/readme.md)
- Latest report: [2025 May report](updates/forward/2025-05.md)

<If condition={memosWithTags}>
  <WorthReading 
    memos={memosWithTags}
    blocks={[
      {
        title: 'Engineering',
        subtitle: 'Craftsmen knowledge',
        tag: 'engineering',
      },
      {
        title: 'Blockchain',
        subtitle: 'Decentralized future',
        tag: 'blockchain',
      },
      {
        title: 'Wealth',
        subtitle: 'Growth and prosperity',
        tag: 'market-report',
      },
      {
        title: 'Artificial Intelligence',
        subtitle: 'Pushing human limits',
        tag: 'AI',
      },
    ]} />
</If>

<If condition={memosWithTags}>
  <MemoFilterList title="Latest memos" all={memosWithTags} filters={['web3', 'design', 'culture']} />
</If>

<TagsMarquee directoryTree={directoryTree} />

<div className="love-watch-we-are-doing">
  <h2>
    Love what we are doing?
  </h2>
  <ul>
    <li>
      <a
        href="https://discord.gg/dfoundation"
        className="text-primary text-sm" >
        🩷 Join our Discord Network →
      </a>
    </li>
    <li>
      <a
        href="https://github.com/dwarvesf/playground"
        className="!text-primary text-sm" >
        🔥 Contribute to our Memo →
      </a>
    </li>
    <li>
      <a
        href="https://careers.d.foundation/"
        className="text-primary text-sm" >
        🤝 Join us, we are hiring →
      </a>
    </li>
    <li>
      <a
        href="http://memo.d.foundation/earn/"
        className="text-primary text-sm" >
        🙋 Give us a helping hand →
      </a>
    </li>
  </ul>
</div>

---

> Ecclesiastes 7:12:
> "For wisdom is a defence, and money is a defence: but the excellency of knowledge is, that wisdom giveth life to them that have it."

_Written by Dwarves for product craftsmen._\\
_Learned by engineers. Experimented by engineers._
`,
    });

    if (!newSource || 'error' in newSource) {
      return { notFound: true }; // Handle serialization error
    }

    if (!mdxSource || 'error' in mdxSource) {
      return { notFound: true }; // Handle serialization error
    }

    mdxSource.compiledSource = newSource.compiledSource;
    return {
      props: {
        ...layoutProps,
        mdxSource,
      },
    };
  } catch (error) {
    console.error('Error in getStaticProps:', error);
    return {
      props: {
        featuredPosts: [],
      },
    };
  }
};

export default function Home({
  directoryTree,
  searchIndex,
  mdxSource,
}: HomePageProps) {
  if (!mdxSource || 'error' in mdxSource) {
    // We already handle this in getStaticProps
    return null;
  }
  return (
    <RootLayout
      title="Dwarves Memo - Home"
      description="Knowledge sharing platform for Dwarves Foundation"
      directoryTree={directoryTree}
      searchIndex={searchIndex}
    >
      <RemoteMdxRenderer mdxSource={mdxSource} />
    </RootLayout>
  );
}
