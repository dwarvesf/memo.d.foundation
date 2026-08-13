import { MemoWithTags } from '@/lib/content/memos-with-tags';
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';

export const MEMOS_WITH_TAGS_PATH = '/content/memos-with-tags.json';

// Every tagged memo, byte-identical for every visitor. Shipping it through page
// props inlined a copy into the homepage's HTML and its _next/data twin. It is
// now one static asset the browser fetches and caches once.
let cachedMemos: MemoWithTags[] | undefined;
let inflight: Promise<MemoWithTags[]> | undefined;

// The asset path is stable across builds, so pin the request to the build id.
// A new deploy busts the cache; a repeat visit on the same build reuses it.
function memosWithTagsUrl(): string {
  const nextData = (
    window as unknown as { __NEXT_DATA__?: { buildId?: string } }
  ).__NEXT_DATA__;
  return nextData?.buildId
    ? `${MEMOS_WITH_TAGS_PATH}?v=${nextData.buildId}`
    : MEMOS_WITH_TAGS_PATH;
}

function loadMemosWithTags(): Promise<MemoWithTags[]> {
  if (!inflight) {
    inflight = fetch(memosWithTagsUrl())
      .then(response => {
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }
        return response.json() as Promise<MemoWithTags[]>;
      })
      .then(memos => {
        cachedMemos = memos;
        return memos;
      })
      .catch(error => {
        console.error('Error fetching memos with tags:', error);
        // Drop the settled promise so a later mount can retry.
        inflight = undefined;
        return [] as MemoWithTags[];
      });
  }
  return inflight;
}

const MemosWithTagsContext = createContext<MemoWithTags[] | undefined>(
  undefined,
);

export const MemosWithTagsProvider = ({ children }: PropsWithChildren) => {
  const [memos, setMemos] = useState<MemoWithTags[] | undefined>(cachedMemos);

  useEffect(() => {
    if (memos) return;
    let active = true;
    loadMemosWithTags().then(loaded => {
      if (active) setMemos(loaded);
    });
    return () => {
      active = false;
    };
  }, [memos]);

  return (
    <MemosWithTagsContext.Provider value={memos}>
      {children}
    </MemosWithTagsContext.Provider>
  );
};

// Undefined until the fetch resolves. Every consumer already handles a missing list.
export const useMemosWithTags = () => useContext(MemosWithTagsContext);
