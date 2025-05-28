import fs from 'fs/promises';
import path from 'path';
import {
  getAllMarkdownFiles,
  getJSONFileContent,
  getNginxRedirects,
  getReversedAliasPaths,
  normalizePathWithSlash,
} from './common.js';

const CONTENT_DIR = path.join(process.cwd(), 'public/content');
const SHORTEN_REDIRECTS_JSON_PATH = path.join(
  CONTENT_DIR,
  'shorten-redirects.json',
);
const NGINX_MAP_OUTPUT_PATH = path.join(CONTENT_DIR, 'nginx_redirect_map.conf');

/**
 * Filters and returns valid shortened paths from the provided redirects and alias records.
 *
 * This function validates shortened redirects against three criteria:
 * 1. The target URL matches an alias URL or target
 * 2. The target URL matches a redirect source or target
 * 3. The target URL corresponds to an existing markdown file
 *
 * @param alias - Object containing alias paths as keys and their target paths as values
 * @returns A filtered object containing only valid shortened redirect entries
 * @async
 */
async function getValidShortenPaths(alias: Record<string, string> = {}) {
  const shortenRedirects = await getJSONFileContent(
    SHORTEN_REDIRECTS_JSON_PATH,
  );
  const markdownFiles = (await getAllMarkdownFiles(CONTENT_DIR)).map(
    slugs => `/${slugs.join('/')}`,
  );

  const aliasEntries = Object.entries(alias).map(([key, value]) => [
    normalizePathWithSlash(key),
    normalizePathWithSlash(value),
  ]);

  return Object.fromEntries(
    Object.entries(shortenRedirects).filter(([, targetUrl]) => {
      // If is an alias
      if (
        aliasEntries.some(
          ([aliasURL, aliasTarget]) =>
            aliasTarget === targetUrl || aliasURL === targetUrl,
        )
      ) {
        return true;
      }

      // Check if the target URL is a valid markdown file path
      return markdownFiles.includes(targetUrl);
    }),
  );
}

async function generateNginxRedirectMap() {
  const alias = await getReversedAliasPaths();
  const redirects = await getNginxRedirects();
  const shortenRedirects = await getValidShortenPaths(alias);

  let mapContent = 'map $request_uri $redirect_target {\n';
  mapContent += '    default 0;\n';

  const paths = [alias, redirects, shortenRedirects];
  // Flatten the array of objects into a single array of objects
  const flattenedPaths = paths.reduce<Record<string, string>>((acc, obj) => {
    const mapEntries = Object.entries(obj).map<Record<string, string>>(
      ([key, value]) => ({
        [normalizePathWithSlash(key)]: normalizePathWithSlash(value),
      }),
    );
    return Object.assign(acc, ...mapEntries);
  }, {});

  for (const sourceUri in flattenedPaths) {
    if (Object.prototype.hasOwnProperty.call(flattenedPaths, sourceUri)) {
      const targetUri = flattenedPaths[sourceUri];
      // Skip empty or self-referential redirects
      if (!targetUri || sourceUri === targetUri) {
        continue;
      }
      // Ensure proper quoting if URIs contain special characters, though typically they shouldn't for Nginx map keys.
      // Nginx map keys are typically matched literally.
      mapContent += `    "${sourceUri}" "${targetUri}";\n`;
    }
  }

  mapContent += '}\n';

  try {
    await fs.writeFile(NGINX_MAP_OUTPUT_PATH, mapContent, 'utf-8');
    console.log(`Nginx redirect map generated at ${NGINX_MAP_OUTPUT_PATH}`);
  } catch (error) {
    console.error(
      `Error writing Nginx redirect map to ${NGINX_MAP_OUTPUT_PATH}: ${(error as Error).message}`,
    );
    process.exit(1);
  }
}

generateNginxRedirectMap();
