/**
 * Slugify a string (based on Memo.Common.Slugify.slugify)
 * @param str The string to slugify
 * @returns Slugified string
 */
export function slugify(str: string): string {
  return (
    str
      // Add replacements for common problematic Obsidian characters and ¶
      .replace(/[\]\\/¶"#$^&*:|<>{}()*]/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
      .replace(/^-+|-+$/g, '')
  );
}

/**
 * Slugify filename (based on Memo.Common.Slugify.slugify_filename)
 * @param filename The filename to slugify
 * @returns Slugified filename with extension preserved
 */
export function slugifyFilename(filename: string): string {
  const ext = filename.includes('.') ? '.' + filename.split('.').pop() : '';
  const name = ext ? filename.slice(0, -ext.length) : filename;
  return slugify(name) + ext;
}

/**
 * Slugify path components (based on Memo.Common.Slugify.slugify_path_components)
 * @param pathStr The path to slugify
 * @returns Path with components slugified
 */
export function slugifyPathComponents(pathStr: string): string {
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
