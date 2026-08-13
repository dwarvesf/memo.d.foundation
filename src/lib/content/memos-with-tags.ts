import { queryDuckDB } from '@/lib/db/utils';
import { getCompactContributorsFromContentJSON } from '@/lib/contributor';

export interface MemoWithTags {
  title: string;
  tags: string[];
  filePath: string;
  date: string;
  authors: string[];
  authorAvatars: (string | null)[];
}

/**
 * Every tagged memo, newest first. Homepage-only, feeds the "Worth Reading" and
 * "Latest memos" sections. Result is identical for every visitor, so it is
 * written once to `public/content/memos-with-tags.json` by
 * `scripts/generate-memos-with-tags.ts` and fetched by the client, instead of
 * being inlined into the homepage's props.
 */
export async function getMemosWithTags(): Promise<MemoWithTags[]> {
  const userProfiles = await getCompactContributorsFromContentJSON();
  const avatarMap = userProfiles.reduce(
    (acc, profile) => {
      if (profile.avatar) {
        acc[profile.username] = profile.avatar;
      }
      return acc;
    },
    {} as Record<string, string>,
  );

  const results = await queryDuckDB(`
    SELECT title, tags, file_path, date, authors
    FROM vault
    WHERE tags IS NOT NULL
    ORDER BY date DESC
  `);

  const filteredResults = results.filter(
    result => result.title && Array.isArray(result.tags),
  );

  return Promise.all(
    filteredResults.map(async result => {
      const authorAvatars =
        result.authors && Array.isArray(result.authors)
          ? result.authors.map(author => avatarMap[author] ?? null)
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
}
