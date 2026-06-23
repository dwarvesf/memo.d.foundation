import path from 'path';
import {
  getAllMarkdownFiles,
  getRedirectsNotToAliases,
  getReversedAliasPaths,
  normalizePathWithSlash,
} from './common.js';
import { readFile, writeFile, stat } from 'fs/promises';
import matter from 'gray-matter';

const CONTENT_DIR = path.join(process.cwd(), 'public/content');

/**
 * A slug from getAllMarkdownFiles may resolve to `<slug>.md`, `<slug>.mdx`, or a
 * directory index (`<slug>/readme.md`, `<slug>/_index.md`, or just a folder).
 * Returns true if the underlying source file carries `draft: true`. Directory
 * entries with no concrete source file are treated as published (the folder
 * listing already excludes draft children via getAllMarkdownContents).
 */
const isDraftSlug = async (slug: string): Promise<boolean> => {
  const candidates = [
    `${slug}.md`,
    `${slug}.mdx`,
    path.join(slug, 'readme.md'),
    path.join(slug, 'readme.mdx'),
    path.join(slug, '_index.md'),
    path.join(slug, '_index.mdx'),
  ];
  for (const candidate of candidates) {
    const filePath = path.join(CONTENT_DIR, candidate);
    try {
      await stat(filePath);
    } catch {
      continue;
    }
    try {
      const raw = await readFile(filePath, 'utf-8');
      return matter(raw).data?.draft === true;
    } catch {
      return false;
    }
  }
  return false;
};
const STATIC_JSON_PATHS = path.join(
  process.cwd(),
  'public/content/static-paths.json',
);

const generateStaticJSONPaths = async () => {
  const redirectsPaths = await getRedirectsNotToAliases();
  const aliasesPaths = await getReversedAliasPaths();
  const allMarkdownSlugs = (await getAllMarkdownFiles(CONTENT_DIR))
    .filter(
      slugArray =>
        !slugArray[0]?.toLowerCase()?.startsWith('contributor') &&
        !slugArray[0]?.toLowerCase()?.startsWith('tags'),
    )
    .map(slugArray => slugArray.join('/'));

  // Exclude draft pages so a draft is never a directly reachable static path.
  const draftFlags = await Promise.all(allMarkdownSlugs.map(isDraftSlug));
  const markdownPaths = allMarkdownSlugs.filter((_, i) => !draftFlags[i]);

  // Aliases paths as primary paths
  const aliasesEntries = Object.entries(aliasesPaths);

  // Only getting redirects paths that are unique and not already in aliases
  const redirectsPathsToAliases = Object.entries(redirectsPaths);

  // Removing all markdown paths that are already in redirects and aliases
  const filteredMarkdownPaths = markdownPaths
    .filter(mdPath => {
      const normalizedPath = normalizePathWithSlash(mdPath);
      const isMatchedRedirects = redirectsPathsToAliases.some(
        ([redirectKey]) => {
          const normalizedRedirectKey = normalizePathWithSlash(redirectKey);
          return normalizedPath === normalizedRedirectKey;
        },
      );
      if (isMatchedRedirects) {
        return false;
      }

      const isMatchedAliases = aliasesEntries.some(([aliasKey]) => {
        const normalizedAliasKey = normalizePathWithSlash(aliasKey);
        return normalizedPath === normalizedAliasKey;
      });
      return !isMatchedAliases;
    })
    .map(mdPath => [mdPath, mdPath]);
  const aliasesEntriesPaths = aliasesEntries.map(([key, value]) => {
    return [value, key];
  });

  const paths: Record<string, string> = {
    ...Object.fromEntries(filteredMarkdownPaths),
    ...redirectsPaths,
    ...Object.fromEntries(aliasesEntriesPaths),
  };

  const normalizedPaths = Object.fromEntries(
    Object.entries(paths).map(([key, value]) => [
      normalizePathWithSlash(key),
      normalizePathWithSlash(value),
    ]),
  );
  // Write the paths to json file
  await writeFile(
    STATIC_JSON_PATHS,
    JSON.stringify(normalizedPaths, null, 2),
    'utf-8',
  );
  console.log(`Static paths JSON generated at ${STATIC_JSON_PATHS}`);
};

generateStaticJSONPaths().catch(error => {
  console.error('Error generating static paths JSON:', error);
  process.exit(1);
});
