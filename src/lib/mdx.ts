import fs from 'fs/promises';
import { serialize } from 'next-mdx-remote-client/serialize';
import recmaMdxEscapeMissingComponents from 'recma-mdx-escape-missing-components';
import remarkGfm from 'remark-gfm';

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

  if (mdxFileExists) {
    mdxContent = await fs.readFile(mdxPath, 'utf-8');
  } else {
    if (fallbackPath) {
      mdxContent = await fs.readFile(fallbackPath, 'utf-8');
    }
  }
  const mdxSource = mdxContent
    ? await serialize({
        source: mdxContent,
        options: {
          scope,
          parseFrontmatter: true,
          mdxOptions: {
            recmaPlugins: [recmaMdxEscapeMissingComponents],
            remarkPlugins: [remarkGfm],
          },
        },
      })
    : null;

  if (mdxSource?.frontmatter) {
    const processedFrontmatter = { ...mdxSource.frontmatter };

    // Loop through each frontmatter key
    Object.keys(processedFrontmatter).forEach(fmKey => {
      const value = processedFrontmatter[fmKey];

      // Only process string values
      if (typeof value === 'string') {
        // Replace all occurrences of {key} with the corresponding value from scope
        let processedValue = value;

        if (scope) {
          Object.keys(scope).forEach(scopeKey => {
            const placeholder = `{${scopeKey}}`;
            const scopeValue = scope[scopeKey];

            // Only replace with string or number values
            if (
              typeof scopeValue === 'string' ||
              typeof scopeValue === 'number'
            ) {
              processedValue = processedValue.replace(
                new RegExp(placeholder, 'g'),
                String(scopeValue),
              );
            }
          });
        }

        processedFrontmatter[fmKey] = processedValue;
      }
    });

    mdxSource.frontmatter = processedFrontmatter;
  }

  return mdxSource;
}
