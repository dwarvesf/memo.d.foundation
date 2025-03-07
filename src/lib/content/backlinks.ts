import fs from 'fs';
import path from 'path';
import { asyncBufferFromFile, parquetRead } from 'hyparquet';

/**
 * Queries the parquet database for backlinks to a specific page
 * @param slug The slug array of the current page
 * @returns Array of backlink paths
 */
export async function getBacklinks(slug: string[]): Promise<string[]> {
  let backlinks: string[] = [];
  try {
    const parquetFilePath = path.join(process.cwd(), 'db/vault.parquet');
    if (fs.existsSync(parquetFilePath)) {
      // Create escaped versions for pattern matching
      const escapedFullPath = slug.join('/');
      const escapedSlug = slug[slug.length - 1];

      await parquetRead({
        file: await asyncBufferFromFile(parquetFilePath),
        columns: ['file_path', 'md_content'],
        onComplete: (data) => {
          const filteredData = data.filter(row => {
            const content = row[1]?.toString() || ''; // md_content is at index 1
            return (
              // Search for full URL mentions
              content.includes(`https://memo.d.foundation/${escapedFullPath}`) ||
              // Search for relative path mentions
              content.includes(`${escapedFullPath}`) ||
              // Search for just the slug mentions with .md extension
              content.includes(`/${escapedSlug}.md`) ||
              content.includes(`#${escapedSlug}.md`)
            );
          });

          backlinks = filteredData.map(row => row[0]?.toString() || '');
          console.log('Pages referencing this content:', backlinks);
        }
      });
    }
  } catch (parquetError) {
    console.error('Error reading parquet file:', parquetError);
  }
  
  return backlinks;
}