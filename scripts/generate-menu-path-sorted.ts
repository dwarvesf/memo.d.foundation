import fs from 'fs/promises';
import type { Stats } from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { glob, type GlobOptions } from 'glob';

// Create async glob function
const globAsync = (
  pattern: string,
  options: GlobOptions = {},
): Promise<string[]> =>
  new Promise((resolve, reject) => {
    glob(pattern, options)
      .then(matches => resolve(matches.map(match => match.toString())))
      .catch(err => reject(err));
  });

// Constants
const VAULT_DIR = 'vault';
const CONFIG_PATTERN = '**/.config.{yaml,yml}';
const READING_FILE_REGEX = /^\[.*.md\]$/i;
const OUTPUT_FILE = 'public/content/menu-sorted.json';

// Interfaces
interface SortPatterns {
  folders: string[];
  file_patterns: string[];
}

interface FilePatterns {
  sort?: string[];
}

interface NestedObject {
  [key: string]: string | NestedObject;
}

/**
 * Find all config files in the vault directory
 */
async function findConfigFiles(baseDir: string): Promise<string[]> {
  try {
    return await globAsync(CONFIG_PATTERN, {
      cwd: baseDir,
      absolute: false,
      dot: true,
    });
  } catch (error) {
    console.error('Error finding config files:', error);
    return [];
  }
}

/**
 * Parse YAML config file
 */
async function parseConfig(filePath: string): Promise<FilePatterns | null> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return yaml.load(content) as FilePatterns;
  } catch (error) {
    console.error(`Error parsing config file ${filePath}:`, error);
    return null;
  }
}

/**
 * Extract markdown links from MoC file content
 */
function extractMarkdownLinks(content: string): string[] {
  const links: string[] = [];

  // Match [[wiki-style]] links
  const wikiPattern = /\[\[(.*?)\]\]/g;
  let match;
  while ((match = wikiPattern.exec(content)) !== null) {
    if (match[1]) links.push(match[1]);
  }

  // Match [text](link.md) style links
  const markdownPattern = /\[.*?\]\((.*?\.md)\)/g;
  while ((match = markdownPattern.exec(content)) !== null) {
    if (match[1]) {
      // Remove .md extension and get basename
      const basename = path.basename(match[1], '.md');
      links.push(basename);
    }
  }

  return [...new Set(links)]; // Remove duplicates
}

function truncateMocFilePattern(mocFilePattern: string): string {
  // Remove leading and trailing brackets
  const trimmedPattern = mocFilePattern.replace(/^\[/, '').replace(/\]$/, '');
  return trimmedPattern;
}

/**
 * Process MoC files in a directory and extract ordered links
 */
async function processMoCFiles(
  dirPath: string,
  _mocPatterns: string[],
): Promise<string[]> {
  try {
    const mocPatterns = _mocPatterns.map(pattern =>
      truncateMocFilePattern(pattern),
    );
    let allLinks: string[] = [];
    // Get all MoC files matching the patterns
    for (const pattern of mocPatterns) {
      const mocFiles = await globAsync(pattern, {
        cwd: dirPath,
        absolute: false,
      });

      const mocFilesMatchingPattern = mocFiles.filter(file =>
        mocPatterns.some(pattern => matchPattern(file, pattern)),
      );
      for (const mocFile of mocFilesMatchingPattern) {
        const content = await fs.readFile(path.join(dirPath, mocFile), 'utf8');
        allLinks = [...allLinks, ...extractMarkdownLinks(content)];
      }
    }
    return [...new Set(allLinks)]; // Remove duplicates
  } catch (error) {
    console.error(`Error processing MoC files in ${dirPath}:`, error);
    return [];
  }
}

/**
 * Match item against pattern
 */
function matchPattern(item: string, pattern: string): boolean {
  const regex = new RegExp(`^${pattern.replace('*', '.*')}$`);
  return regex.test(item);
}

/**
 * Sort directories based on folder patterns
 */
function sortDirectories(
  folders: string[],
  folderPatterns: string[],
): string[] {
  const sortedFolders: string[] = [];
  const remainingFolders = new Set(folders);

  // First, sort by patterns
  for (const pattern of folderPatterns) {
    folders.forEach(folder => {
      if (matchPattern(folder, pattern)) {
        sortedFolders.push(folder);
        remainingFolders.delete(folder);
      }
    });
  }

  // Add remaining folders alphabetically
  sortedFolders.push(...Array.from(remainingFolders).sort());

  return sortedFolders;
}

/**
 * Sort markdown files based on patterns and MoC links
 */
function sortMarkdownFiles(
  mdFiles: string[],
  filePatterns: string[],
  mocLinks: string[],
): string[] {
  if (!filePatterns.length && !mocLinks.length) {
    return [];
  }
  const sortedFiles: string[] = [];
  const remainingFiles = new Set(mdFiles);

  // First, sort by patterns
  for (const pattern of filePatterns) {
    if (READING_FILE_REGEX.test(pattern)) continue; // Skip the file need to be read pattern

    mdFiles.forEach(file => {
      if (matchPattern(file, pattern)) {
        sortedFiles.push(file);
        remainingFiles.delete(file);
      }
    });
  }

  // Then, add files from MoC links
  for (const link of mocLinks) {
    const matchingFile = Array.from(remainingFiles).find(
      file => path.basename(file, path.extname(file)) === link,
    );
    if (matchingFile) {
      sortedFiles.push(matchingFile);
      remainingFiles.delete(matchingFile);
    }
  }

  // Finally, add remaining markdown files alphabetically
  sortedFiles.push(...Array.from(remainingFiles).sort());

  return sortedFiles;
}

function normalizePath(filePath: string): string {
  // Removing path started with `vault/` and replacing backslashes with slashes
  return filePath.replace(/^(vault\/|\\)/, '').replace(/\\/g, '/');
}

function getSortPatterns(config: FilePatterns | null): SortPatterns {
  const sortPatterns: SortPatterns = {
    folders: [],
    file_patterns: [],
  };
  const sortConfig = (config?.sort || []).map((pattern: string) =>
    Array.isArray(pattern) ? `[${pattern}]` : String(pattern),
  );
  sortPatterns.folders =
    sortConfig.filter(p => p.startsWith('/')).map(p => p.replace(/^\//, '')) ||
    [];
  sortPatterns.file_patterns = sortConfig.filter(p => !p.startsWith('/')) || [];
  return sortPatterns;
}

/**
 * Recursively process a directory and build nested object structure
 */
async function processDirectoryRecursive(
  dirPath: string,
  configPath: string | null,
  baseDir: string,
): Promise<NestedObject | null> {
  const result: NestedObject = {};

  try {
    // Get sorting patterns and folder patterns from config
    let filePatterns: string[] = [];
    let folderPatterns: string[] = [];
    let mocLinks: string[] = [];

    if (configPath) {
      const globConfigPath = configPath.replace(
        /(.yml|.yaml)$/g,
        '.{yaml,yml}',
      );
      const configFiles = await globAsync(globConfigPath, {
        cwd: baseDir,
        absolute: false,
        dot: true,
      });
      console.log(baseDir, globConfigPath, configFiles);
      const configFile = configFiles[0];
      if (configFile) {
        const config = await parseConfig(path.join(baseDir, configFile));
        const sortPatterns = getSortPatterns(config);
        if (
          sortPatterns.file_patterns?.length ||
          sortPatterns?.folders?.length
        ) {
          filePatterns = sortPatterns.file_patterns;
          folderPatterns = sortPatterns.folders;
          const readingFilePatternsList = filePatterns.filter(pattern =>
            READING_FILE_REGEX.test(pattern),
          );
          if (readingFilePatternsList.length) {
            mocLinks = await processMoCFiles(
              path.join(baseDir, dirPath),
              readingFilePatternsList,
            );
          }
        }
      }
    }

    // Read directory contents and get stats
    const items = await fs.readdir(path.join(baseDir, dirPath));
    const stats = new Map<string, Stats>();
    for (const item of items) {
      stats.set(item, await fs.stat(path.join(baseDir, dirPath, item)));
    }

    // First, process all subdirectories
    const folders = items.filter(item => stats.get(item)?.isDirectory());
    const sortedFolders = sortDirectories(folders, folderPatterns);

    for (const folder of sortedFolders) {
      const fullPath = path.join(dirPath, folder);
      const configFiles = await globAsync(
        path.join(fullPath, '.config.{yaml,yml}'),
        {
          cwd: baseDir,
          absolute: false,
          dot: true,
        },
      );
      // Find config for this subdirectory
      const configYmlPath = configFiles[0] ?? null;
      // Process subdirectory
      const itemResults = await processDirectoryRecursive(
        fullPath,
        configYmlPath,
        baseDir,
      );
      if (itemResults) {
        result[folder] = itemResults;
      }
    }

    const isHasConfig = items.some(
      item =>
        !stats.get(item)?.isDirectory() && /\.config\.(yaml|yml)$/i.test(item),
    );
    if (!isHasConfig) {
      return result;
    }

    // Then, process files
    const files = items.filter(
      item => !stats.get(item)?.isDirectory() && /\.(md|mdx)$/i.test(item),
    );

    // Sort markdown files by patterns
    const sortedMdFiles = sortMarkdownFiles(files, filePatterns, mocLinks);
    for (const file of sortedMdFiles) {
      result[file] = normalizePath(path.join(dirPath, file));
    }

    return result;
  } catch (error) {
    console.error(`Error processing directory ${dirPath}:`, error);
    return null;
  }
}

async function processVaultDirectory() {
  return await processDirectoryRecursive(
    VAULT_DIR,
    VAULT_DIR + '/.config.yaml',
    '.',
  );
}

/**
 * Main execution function
 */
async function main() {
  try {
    // Find all config files in vault
    const configFiles = await findConfigFiles(VAULT_DIR);
    console.log(`Found ${configFiles.length} config files.`);

    if (!configFiles.length) {
      console.warn('No config files found');
      return;
    }
    // Process the vault directory
    const result = await processVaultDirectory();
    if (!result) {
      console.log('No valid config found in the vault.');
      return;
    }
    // Write the result to menu-sorted.json
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(result, null, 2));
    console.log('Successfully generated menu-sorted.json');
  } catch (error) {
    console.log('Error in main execution:', error);
    process.exit(1);
  }
}

// Execute the script
main();
