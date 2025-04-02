import { GetStaticProps } from 'next';

import { RootLayout } from '../components';
import { IMemoItem, RootLayoutPageProps } from '@/types';

import { getRootLayoutPageProps } from '@/lib/content/utils';
import {
  filterMemo,
  getAllMarkdownContents,
  sortMemos,
} from '@/lib/content/memo';
import MemoVList from '@/components/memo/MemoVList';
import MemoVLinkList from '@/components/memo/MemoVLinkList';

interface HomePageProps extends RootLayoutPageProps {
  ogifMemos: IMemoItem[];
  newMemos: IMemoItem[];
  teamMemos: IMemoItem[];
  changelogMemos: IMemoItem[];
  hiringMemos: IMemoItem[];
}

export const getStaticProps: GetStaticProps = async () => {
  try {
    const allMemos = await getAllMarkdownContents();
    const layoutProps = await getRootLayoutPageProps(allMemos);
    const sortedMemos = sortMemos(allMemos);
    const ogifMemos = filterMemo({
      data: sortedMemos,
      filters: {
        tags: 'ogif',
      },
      limit: 5,
    });
    const newMemos = filterMemo({
      data: sortedMemos,
    });
    const teamMemos = filterMemo({
      data: sortedMemos,
      filters: {
        tags: 'team',
      },
    });
    const changelogMemos = filterMemo({
      data: sortedMemos,
      filters: {
        tags: 'weekly-digest',
      },
    });
    const hiringMemos = filterMemo({
      data: sortedMemos,
      filters: {
        tags: 'hiring',
        hiring: true,
      },
    });

    return {
      props: {
        ...layoutProps,
        ogifMemos,
        newMemos,
        teamMemos,
        changelogMemos,
        hiringMemos,
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
  ogifMemos,
  newMemos,
  teamMemos,
  changelogMemos,
  hiringMemos,
}: HomePageProps) {
  return (
    <RootLayout
      title="Dwarves Memo - Home"
      description="Knowledge sharing platform for Dwarves Foundation"
      directoryTree={directoryTree}
      searchIndex={searchIndex}
    >
      <div className="font-serif">
        <img
          src="/assets/home_cover.webp"
          className="no-zoom max-h-[500px] rounded-sm"
        ></img>
        <p className="mt-[var(--element-margin)]">
          Welcome to the Dwarves Memo.
        </p>
        <p className="mt-[var(--element-margin)]">
          This site is a part of our continuous learning engine, where we want
          to build up the 1% improvement habit, learning in public.
        </p>
        <p className="mt-[var(--element-margin)]">
          Written by Dwarves for product craftsmen.
        </p>
        <p className="mt-[var(--element-margin)]">
          Learned by engineers. Experimented by engineers.
        </p>
        <h2 className="-track-[0.0125] mt-8 mb-2.5 text-[26px] leading-[140%] font-semibold">
          💡 OGIFs
        </h2>
        <MemoVLinkList data={ogifMemos} hideDate color="secondary" />

        <h2 className="-track-[0.0125] mt-8 mb-2.5 text-[26px] leading-[140%] font-semibold">
          ✨ New memos
        </h2>
        <MemoVList data={newMemos} hideDate />

        <h2 className="-track-[0.0125] mt-8 mb-2.5 text-[26px] leading-[140%] font-semibold">
          🧑‍💻 Life at Dwarves
        </h2>
        <MemoVList data={teamMemos} hideAuthors hideThumbnail />

        <h2 className="-track-[0.0125] mt-8 mb-2.5 text-[26px] leading-[140%] font-semibold">
          📝 Changelog
        </h2>
        <MemoVLinkList data={changelogMemos} />

        <h2 className="-track-[0.0125] mt-8 mb-2.5 text-[26px] leading-[140%] font-semibold">
          🤝 Open positions
        </h2>
        <MemoVList data={hiringMemos} hideAuthors hideThumbnail hideDate />

        <LoveWhatWeAreDoing />
      </div>
    </RootLayout>
  );
}

function LoveWhatWeAreDoing() {
  return (
    <div className="font-sans">
      <h2 className="mt-6 text-[10px] font-medium uppercase">
        Love what we are doing?
      </h2>
      <ul className="xs:grid-cols-2 mt-2.5 grid list-none gap-2.5 pl-0">
        <li>
          <a
            href="https://discord.gg/dwarvesv"
            className="text-primary text-sm"
          >
            🩷 Join our Discord Network →
          </a>
        </li>
        <li>
          <a
            href="https://github.com/dwarvesf/playground"
            className="text-primary text-sm"
          >
            🔥 Contribute to our Memo →
          </a>
        </li>
        <li>
          <a
            href="https://careers.d.foundation/"
            className="text-primary text-sm"
          >
            🤝 Join us, we are hiring →
          </a>
        </li>
        <li>
          <a
            href="http://memo.d.foundation/earn/"
            className="text-primary text-sm"
          >
            🙋 Give us a helping hand →
          </a>
        </li>
      </ul>
    </div>
  );
}
