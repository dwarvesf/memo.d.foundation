import fs from 'fs/promises';
import path from 'path';

const CONTENT_DIR = path.join(process.cwd(), 'public/content');
const REDIRECTS_JSON_PATH = path.join(CONTENT_DIR, 'redirects.json');
const ALIAS_JSON_PATH = path.join(CONTENT_DIR, 'aliases.json');

export function removingTrailingSlash(path: string): string {
  return path.replace(/\/$/, '');
}

function removingRedundantSymbols(path: string): string {
  return path.replace(/\"|"/, '');
}

export function normalizePathWithSlash(path: string): string {
  if (path.startsWith('/')) {
    return removingTrailingSlash(removingRedundantSymbols(path));
  }
  return removingTrailingSlash(removingRedundantSymbols(`/${path}`));
}

export async function getJSONFileContent(
  filePath: string,
): Promise<Record<string, string>> {
  try {
    const jsonContent = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(jsonContent);
  } catch (error) {
    console.warn(
      `Warning: Could not read or parse ${filePath}. Error: ${(error as Error).message}`,
    );
    return {};
  }
}

/**
 * Gets all markdown and MDX files recursively from a directory
 * @param dir The directory to search in
 * @param basePath The base path for the current directory
 * @returns Array of slug arrays for each markdown/MDX file
 */
export async function getAllMarkdownFiles(
  dir: string,
  basePath: string[] = [],
): Promise<string[][]> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    console.error(`Error reading directory ${dir}: ${error}`);
    return [];
  }

  const paths: string[][] = [];

  // Check for readme files (markdown and MDX)
  const readmeFilePath = path.join(dir, 'readme.md');
  const readmeMdxFilePath = path.join(dir, 'readme.mdx');
  const indexFilePath = path.join(dir, '_index.md');
  const indexMdxFilePath = path.join(dir, '_index.mdx');

  let readmeExists = false;
  try {
    // Check for readme.md first
    await fs.stat(readmeFilePath);
    readmeExists = true;
  } catch {
    // If readme.md doesn't exist, try readme.mdx
    try {
      await fs.stat(readmeMdxFilePath);
      readmeExists = true;
    } catch {
      // Neither exists
    }
  }

  let indexExists = false;
  try {
    // Check for _index.md first
    await fs.stat(indexFilePath);
    indexExists = true;
  } catch {
    // If _index.md doesn't exist, try _index.mdx
    try {
      await fs.stat(indexMdxFilePath);
      indexExists = true;
    } catch {
      // Neither exists
    }
  }

  // Prioritize readme over _index
  if (readmeExists && basePath.length > 0) {
    paths.push([...basePath]);
    paths.push([...basePath, 'readme']);
  } else if (indexExists && basePath.length > 0) {
    paths.push([...basePath]);
  } else if (entries.length > 0 && basePath.length > 0) {
    paths.push([...basePath]);
  }

  for (const entry of entries) {
    const res = path.resolve(dir, entry.name);
    if (entry.isDirectory()) {
      paths.push(
        ...(await getAllMarkdownFiles(res, [...basePath, entry.name])),
      );
    } else if (
      // Include both .md and .mdx files
      (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) &&
      entry.name !== '_index.md' &&
      entry.name !== '_index.mdx' &&
      entry.name !== 'readme.md' &&
      entry.name !== 'readme.mdx'
    ) {
      // Remove file extension (.md or .mdx) for the slug
      const slugName = entry.name.replace(/\.(md|mdx)$/, '');
      paths.push([...basePath, slugName]);
    }
  }

  return paths;
}

export async function getAliasPaths(): Promise<Record<string, string>> {
  const aliases = await getJSONFileContent(ALIAS_JSON_PATH);

  const excludePaths = ['index'];

  // 1. Gather nested alias paths by enumerating all children under each alias target
  const nestedAliasPaths: Record<string, string> = {};
  for (const aliasKey in aliases) {
    const aliasValue = aliases[aliasKey].split('/').filter(Boolean).join('/');
    const aliasKeySegments = aliasKey.split('/').filter(Boolean);
    const targetDir = path.join(CONTENT_DIR, ...aliasValue.split('/'));
    let childSlugs: string[][] = [];
    try {
      childSlugs = await getAllMarkdownFiles(targetDir);
    } catch {
      nestedAliasPaths[aliasKey] = aliasValue;
      // If the alias target doesn't exist, skip
      continue;
    }
    for (const childSlug of childSlugs) {
      // Don't add the root alias itself (handled by aliasPaths)
      if (childSlug.length === 0) {
        nestedAliasPaths[aliasKey] = aliasValue;
        continue;
      }
      const newAliasSlug = [...aliasKeySegments, ...childSlug].join('/');
      const redirectTarget = [aliasValue, ...childSlug].join('/');
      if (excludePaths.includes(newAliasSlug)) {
        continue;
      }
      nestedAliasPaths[newAliasSlug] = redirectTarget;
    }
  }
  return Object.assign({}, nestedAliasPaths, aliases);
}

export async function getReversedAliasPaths(): Promise<Record<string, string>> {
  const aliases = await getAliasPaths();

  // Reverse the keys and values
  const reversedAliases = Object.fromEntries(
    Object.entries(aliases).map(([key, value]) => [value, key]),
  );
  return reversedAliases;
}

export async function getRedirects(): Promise<Record<string, string>> {
  const redirects = await getJSONFileContent(REDIRECTS_JSON_PATH);
  return redirects;
}

async function filterRedirectsLogic(
  processRedirect: (
    normalizedRedirectKey: string,
    normalizedRedirectValue: string,
    aliasesEntries: [string, string][],
    markdownPaths: string[],
    filteredRedirects: Record<string, string>,
  ) => void,
): Promise<Record<string, string>> {
  const redirects = await getRedirects();
  const aliases = await getReversedAliasPaths();
  const allMarkdownFiles = await getAllMarkdownFiles(CONTENT_DIR);
  const aliasesEntries = Object.entries(aliases);

  const markdownPaths = allMarkdownFiles
    .filter(
      slugArray =>
        !slugArray[0]?.toLowerCase()?.startsWith('contributor') &&
        !slugArray[0]?.toLowerCase()?.startsWith('tags'),
    )
    .map(slugArray => slugArray.join('/'));

  const filteredRedirects: Record<string, string> = {};

  for (const [redirectKey, redirectValue] of Object.entries(redirects)) {
    const normalizedRedirectKey = normalizePathWithSlash(redirectKey);
    const normalizedRedirectValue = normalizePathWithSlash(redirectValue);

    // Special case: Always include README.md redirects, regardless of alias conflicts
    const isReadmeRedirect = normalizedRedirectKey
      .toLowerCase()
      .endsWith('/readme.md');

    const isMatchedAlias =
      !isReadmeRedirect &&
      aliasesEntries.some(([aliasKey, aliasVal]) => {
        const normalizedAliasKey = normalizePathWithSlash(aliasKey);
        const normalizedAliasValue = normalizePathWithSlash(aliasVal);
        const isMatchedReversedValues =
          normalizedRedirectValue === normalizedAliasKey ||
          normalizedRedirectKey === normalizedAliasValue;
        if (isMatchedReversedValues) {
          return true;
        }
        return normalizedRedirectKey === normalizedAliasKey;
      });

    if (!isMatchedAlias || isReadmeRedirect) {
      processRedirect(
        normalizedRedirectKey,
        normalizedRedirectValue,
        aliasesEntries,
        markdownPaths,
        filteredRedirects,
      );
    }
  }
  return filteredRedirects;
}

export async function getNginxRedirects(): Promise<Record<string, string>> {
  return filterRedirectsLogic(
    (
      normalizedRedirectKey,
      normalizedRedirectValue,
      aliasesEntries,
      markdownPaths,
      filteredRedirects,
    ) => {
      const aliasRedirectValue = aliasesEntries.find(([aliasKey]) => {
        const normalizedAliasKey = normalizePathWithSlash(aliasKey);
        return normalizedRedirectValue === normalizedAliasKey;
      });

      if (aliasRedirectValue) {
        filteredRedirects[normalizedRedirectKey] = aliasRedirectValue[1];
        return;
      }

      const isMatchedMdPath = markdownPaths.find(
        mdPath => normalizePathWithSlash(mdPath) === normalizedRedirectValue,
      );
      if (isMatchedMdPath) {
        filteredRedirects[normalizedRedirectKey] = isMatchedMdPath;
      }
    },
  );
}

export async function getRedirectsNotToAliases(): Promise<
  Record<string, string>
> {
  return filterRedirectsLogic(
    (
      normalizedRedirectKey,
      normalizedRedirectValue,
      aliasesEntries,
      markdownPaths,
      filteredRedirects,
    ) => {
      const aliasRedirectValue = aliasesEntries.find(([aliasKey]) => {
        const normalizedAliasKey = normalizePathWithSlash(aliasKey);
        return normalizedRedirectValue === normalizedAliasKey;
      });

      if (!aliasRedirectValue) {
        const isMatchedMdPath = markdownPaths.find(
          mdPath => normalizePathWithSlash(mdPath) === normalizedRedirectValue,
        );
        if (!isMatchedMdPath) {
          filteredRedirects[normalizedRedirectKey] = normalizedRedirectValue;
        }
      }
    },
  );
}
