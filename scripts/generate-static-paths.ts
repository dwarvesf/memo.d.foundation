import path from 'path';
import {
  getAllMarkdownFiles,
  getRedirectsNotToAliases,
  getReversedAliasPaths,
  normalizePathWithSlash,
} from './common.js';
import { writeFile } from 'fs/promises';

const CONTENT_DIR = path.join(process.cwd(), 'public/content');
const STATIC_JSON_PATHS = path.join(
  process.cwd(),
  'public/content/static-paths.json',
);

const generateStaticJSONPaths = async () => {
  const redirectsPaths = await getRedirectsNotToAliases();
  const aliasesPaths = await getReversedAliasPaths();
  const markdownPaths = (await getAllMarkdownFiles(CONTENT_DIR))
    .filter(
      slugArray =>
        !slugArray[0]?.toLowerCase()?.startsWith('contributor') &&
        !slugArray[0]?.toLowerCase()?.startsWith('tags'),
    )
    .map(slugArray => slugArray.join('/'));

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
