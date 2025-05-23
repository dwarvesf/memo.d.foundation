import fs from 'fs/promises';
import path from 'path';
import {
  getReversedAliasPaths,
  getJSONFileContent,
  getRedirects,
  normalizePathWithSlash,
} from './common.js';

const CONTENT_DIR = path.join(process.cwd(), 'public/content');
const SHORTEN_REDIRECTS_JSON_PATH = path.join(
  CONTENT_DIR,
  'shorten-redirects.json',
);
const NGINX_MAP_OUTPUT_PATH = path.join(CONTENT_DIR, 'nginx_redirect_map.conf');

async function generateNginxRedirectMap() {
  const redirects = await getRedirects();
  const alias = await getReversedAliasPaths();
  const shortenRedirects = await getJSONFileContent(
    SHORTEN_REDIRECTS_JSON_PATH,
  );

  let mapContent = 'map $request_uri $redirect_target {\n';
  mapContent += '    default 0;\n';

  const paths = [redirects, alias, shortenRedirects];
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
