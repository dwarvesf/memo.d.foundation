/**
 * Search index generation script
 * Using ES module format as per package.json "type": "module"
 * @packageDocumentation
 */

import fs from 'fs';
import path from 'path';
import { asyncBufferFromFile, parquetRead } from 'hyparquet';
import MiniSearch from 'minisearch';

/**
 * Extract paths from file path to create category
 * @param filePath File path
 * @returns Category string
 */
function extractCategory(filePath: string) {
  const parts = filePath.split('/');
  parts.pop(); // Remove the file name
  return parts.join(' > ');
}

async function generateSearchIndex() {
  try {
    const parquetFilePath = path.join(process.cwd(), 'db/vault.parquet');
    if (!fs.existsSync(parquetFilePath)) {
      console.error('Parquet file not found:', parquetFilePath);
      return;
    }

    let searchIndex: readonly any[] = [];

    await parquetRead({
      file: await asyncBufferFromFile(parquetFilePath),
      columns: [
        'file_path',
        'title',
        'description',
        'md_content',
        'spr_content',
        'tags',
        'authors',
        'date',
        'draft',
        'hiring',
        'status',
      ],
      onComplete: data => {
        searchIndex = data
          .map((row, idx) => {
            const filePath = row[0]?.toString() || '';
            const title = row[1]?.toString() || '';
            const description = row[2]?.toString() || '';
            // const mdContent = row[3]?.toString() || '';
            const sprContent = row[4]?.toString() || '';
            const tags = Array.isArray(row[5])
              ? row[5].filter(
                tag => tag !== null && tag !== undefined && tag !== '',
              )
              : [];
            const authors = Array.isArray(row[6]) ? row[6] : [];
            const date = row[7]?.toString() || '';
            const draft = row[8] === true;
            const hiring = row[9] === false;
            const status = row[10]?.toString() || '';

            return {
              id: String(idx),
              file_path: filePath,
              title,
              description,
              // md_content: mdContent,
              spr_content: sprContent?.replaceAll('\n', '<hr />'),
              tags,
              authors,
              date,
              category: extractCategory(filePath),
              // Exclude items that should be filtered out
              _exclude: draft || hiring || (status && status !== 'Open'),
            };
          })
          .filter(doc => !doc._exclude && doc.title && doc.description);
      },
    });

    // Create optimized index without full content
    const miniSearch = new MiniSearch({
      fields: ['title', 'description', 'tags', 'authors'],
      storeFields: [
        'file_path',
        'title',
        'description',
        'spr_content',
        'tags',
        'authors',
        'date',
        'category',
      ],
      searchOptions: {
        boost: { title: 2, tags: 1.5, authors: 1.2 },
        fuzzy: 0.2,
        prefix: true,
      },
      extractField: (document, fieldName) => {
        if (fieldName === 'tags' && Array.isArray(document.tags)) {
          return document.tags.join(' ');
        }
        if (fieldName === 'authors' && Array.isArray(document.authors)) {
          return document.authors.join(' ');
        }
        return document[fieldName] || '';
      },
    });

    // Add documents to index
    miniSearch.addAll(searchIndex);

    // Create the output directory if it doesn't exist
    const publicDir = path.join(process.cwd(), 'public');
    const dataDir = path.join(publicDir, 'content');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Write the serialized index to a file
    const outputPath = path.join(dataDir, 'search-index.json');
    fs.writeFileSync(
      outputPath,
      JSON.stringify({
        index: miniSearch.toJSON(),
        // documents: searchIndex.map(doc => ({
        //   id: doc.id,
        //   file_path: doc.file_path,
        //   title: doc.title,
        //   description: doc.description,
        //   tags: doc.tags,
        //   authors: doc.authors,
        //   date: doc.date,
        //   category: doc.category,
        // })),
      }),
    );

    console.log(`Search index generated at: ${outputPath}`);
  } catch (error) {
    console.error('Error generating search index:', error);
  }
}

// Run the function
generateSearchIndex();
