import fs from 'fs/promises';
import { get } from 'lodash';
import { serialize } from 'next-mdx-remote-client/serialize';
import recmaMdxEscapeMissingComponents from 'recma-mdx-escape-missing-components';
import remarkGfm from 'remark-gfm';
import {
  rehypeEnhanceLists,
  rehypeInlineCodeToSpan,
  remarkExtractTLDR,
  remarkProcessLinks,
} from './content/markdown';
import { getStaticJSONPaths } from './content/paths';

interface GetMdxSourceProps {
  mdxPath: string;
  fallbackPath?: string;
  scope?: Record<string, unknown>;
}
export async function getMdxSource(props: GetMdxSourceProps) {
  const { mdxPath, fallbackPath, scope } = props;

  let mdxContent = '';

  const mdxFileExists = await fs
    .stat(mdxPath)
    .then(() => true)
    .catch(() => false);

  let path = mdxPath;
  if (mdxFileExists) {
    mdxContent = await fs.readFile(mdxPath, 'utf-8');
  } else {
    if (fallbackPath) {
      path = fallbackPath;
      mdxContent = await fs.readFile(fallbackPath, 'utf-8');
    }
  }
  let aliasJSONPaths = {};
  if (mdxContent) {
    aliasJSONPaths = await getStaticJSONPaths();
  }
  const mdxSource = mdxContent
    ? await serialize({
        source: mdxContent,
        options: {
          scope,
          parseFrontmatter: true,
          mdxOptions: {
            recmaPlugins: [recmaMdxEscapeMissingComponents],
            remarkPlugins: [
              remarkGfm,
              remarkExtractTLDR,
              () => remarkProcessLinks(path, aliasJSONPaths),
            ],
            rehypePlugins: [rehypeInlineCodeToSpan, rehypeEnhanceLists],
          },
        },
      })
    : null;

  if (mdxSource?.frontmatter) {
    const processedFrontmatter = { ...mdxSource.frontmatter };

    // Loop through each frontmatter key
    if (scope) {
      Object.keys(processedFrontmatter).forEach(fmKey => {
        const value = processedFrontmatter[fmKey];

        // Only process string values
        if (typeof value === 'string') {
          // Replace all occurrences of {key} with the corresponding value from scope
          const varRegex = /{([^}]*)}/g;
          const processedValue = value.replace(varRegex, (match, p1) => {
            const value = get(scope, p1);
            return (value as string) || match;
          });

          processedFrontmatter[fmKey] = processedValue;
        }
      });
    }

    mdxSource.frontmatter = processedFrontmatter;
  }

  return mdxSource;
}
