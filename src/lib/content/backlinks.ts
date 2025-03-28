import fs from 'fs';
import path from 'path';
import { asyncBufferFromFile, parquetRead } from 'hyparquet';
import { IBackLinkItem } from '@/types';
import { getMarkdownMetadata } from './markdown';

/**
 * Slugify a string (based on Memo.Common.Slugify.slugify)
 * @param str The string to slugify
 * @returns Slugified string
 */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .replace(/^-+|-+$/g, '');
}

/**
 * Slugify filename (based on Memo.Common.Slugify.slugify_filename)
 * @param filename The filename to slugify
 * @returns Slugified filename with extension preserved
 */
function slugifyFilename(filename: string): string {
  const ext = path.extname(filename);
  const name = path.basename(filename, ext);
  return slugify(name) + ext;
}

/**
 * Slugify path components (based on Memo.Common.Slugify.slugify_path_components)
 * @param pathStr The path to slugify
 * @returns Path with components slugified
 */
function slugifyPathComponents(pathStr: string): string {
  return pathStr
    .split('/')
    .map(component => {
      if (['.', '..', ''].includes(component)) {
        return component;
      }
      return slugifyFilename(component);
    })
    .join('/');
}

/**
 * Queries the parquet database for backlinks to a specific page
 * @param slug The slug array of the current page
 * @returns Array of backlink paths
 */
export async function getBacklinks(slug: string[]) {
  let backlinks: IBackLinkItem[] = [];
  try {
    const parquetFilePath = path.join(process.cwd(), 'db/vault.parquet');
    if (fs.existsSync(parquetFilePath)) {
      // Create escaped versions for pattern matching
      const escapedFullPath = slug.join('/');
      const escapedSlug = slug[slug.length - 1];

      // Also create slugified versions
      const slugifiedFullPath = slugifyPathComponents(escapedFullPath);
      const slugifiedSlug = slugify(escapedSlug);

      await parquetRead({
        file: await asyncBufferFromFile(parquetFilePath),
        columns: ['file_path', 'md_content', 'title', 'description'],
        onComplete: data => {
          const filteredData = data.filter(row => {
            const content = row[1]?.toString() || ''; // md_content is at index 1
            const title = row[2]?.toString() || ''; // title is at index 2
            const description = row[3]?.toString() || ''; // description is at index 3

            // Skip entries with empty title or description
            if (!title || !description) {
              return false;
            }

            // Check both original and slugified versions in content, title and description
            return (
              // Search in content
              content.includes(
                `https://memo.d.foundation/${escapedFullPath}`,
              ) ||
              content.includes(
                `https://memo.d.foundation/${slugifiedFullPath}`,
              ) ||
              content.includes(`${escapedFullPath}`) ||
              content.includes(`${slugifiedFullPath}`) ||
              content.includes(`/${escapedSlug}.md`) ||
              content.includes(`/${slugifiedSlug}.md`) ||
              content.includes(`#${escapedSlug}.md`) ||
              content.includes(`#${slugifiedSlug}.md`)
            );
          });

          backlinks = filteredData.map(row => {
            const filePath = row[0]?.toString() || '';
            // Slugify the path components
            const slugifiedPath = slugifyPathComponents(filePath);
            // Remove .md extension from the output
            const path = slugifiedPath.endsWith('.md')
              ? slugifiedPath.slice(0, -3)
              : slugifiedPath;
            return {
              title:
                getMarkdownMetadata(filePath).title ||
                path.split('/').pop() ||
                path,
              path,
            };
          });
        },
      });
    }
  } catch (parquetError) {
    console.error('Error reading parquet file:', parquetError);
  }

  return backlinks;
}
