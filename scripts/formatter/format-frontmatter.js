// format-frontmatters.js
// Usage: node format-frontmatters.js <path-to-directory>

import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';

// Helper: Convert string to hyphen-case (kebab-case)
function toHyphenCase(str) {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toLowerCase();
}

/**
 * Build frontmatter string in required order.
 * Only required: title, date, description (always present, null if missing).
 * authors and tags: if present, split by comma and trim, then bullet list.
 * tags: also convert to hyphen-case.
 */
function formatDateToYMD(dateValue) {
  if (!dateValue) return null;
  let d;
  if (typeof dateValue === 'string') {
    // Try to parse as date string
    d = new Date(dateValue);
  } else if (dateValue instanceof Date) {
    d = dateValue;
  } else {
    return null;
  }
  if (isNaN(d.getTime())) return null;
  // Format as YYYY-mm-DD
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function yamlValue(val) {
  if (val === null) return 'null';
  if (typeof val === 'string') {
    // Wrap in double quotes if value contains any of these characters: ' # ` :
    if (
      val.includes("'") ||
      val.includes('#') ||
      val.includes('`') ||
      val.includes(':')
    ) {
      return `"${val.replace(/"/g, '\\"')}"`;
    }
    return val;
  }
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  // Fallback for arrays/objects: JSON (rare for extra fields)
  return JSON.stringify(val);
}

function buildFrontmatter(data) {
  // Only these are required
  const requiredFields = ['title', 'date', 'description'];
  const fm = {};

  // Ensure required fields exist, null if missing
  for (const key of requiredFields) {
    if (data[key] === undefined || data[key] === null || data[key] === '') {
      fm[key] = null;
    } else if (key === 'date') {
      const formatted = formatDateToYMD(data[key]);
      fm[key] = formatted === null ? null : formatted;
    } else {
      fm[key] = data[key];
    }
  }

  // Process authors field if present
  let authors = data.authors;
  if (typeof authors === 'string') {
    // Split by comma, trim
    authors = authors
      .split(',')
      .map(a => a.trim())
      .filter(a => a.length > 0);
  } else if (Array.isArray(authors)) {
    authors = authors
      .map(a => (typeof a === 'string' ? a.trim() : a))
      .filter(a => a && a.length > 0);
  } else {
    authors = undefined;
  }
  if (authors && authors.length === 0) authors = undefined;

  // Process tags field if present
  let tags = data.tags;
  if (typeof tags === 'string') {
    tags = tags
      .split(',')
      .map(t => toHyphenCase(t.trim()))
      .filter(t => t.length > 0);
  } else if (Array.isArray(tags)) {
    tags = tags
      .map(t => toHyphenCase(typeof t === 'string' ? t.trim() : t))
      .filter(t => t && t.length > 0);
  } else {
    tags = undefined;
  }
  if (tags && tags.length === 0) tags = undefined;

  // Collect all original keys in order, except whitelist and tags
  const originalKeys = Object.keys(data);
  const extraKeys = originalKeys.filter(
    k => !requiredFields.includes(k) && k !== 'authors' && k !== 'tags',
  );

  // Build YAML frontmatter string
  let yaml = '---\n';
  // 1. Whitelist fields
  for (const key of requiredFields) {
    yaml += `${key}: ${yamlValue(fm[key])}\n`;
  }
  // 2. Authors (if present, keep after whitelist)
  if (authors) {
    yaml += 'authors:\n';
    authors.forEach(a => {
      yaml += `  - ${a}\n`;
    });
  }
  // 3. Extra fields (in original order, except tags)
  for (const key of extraKeys) {
    yaml += `${key}: ${yamlValue(data[key])}\n`;
  }
  // 4. Tags always at the bottom
  if (tags) {
    yaml += 'tags:\n';
    tags.forEach(t => {
      yaml += `  - ${t}\n`;
    });
  }
  yaml += '---\n';
  return yaml;
}

async function findMarkdownFiles(dir) {
  let results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(await findMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

const main = async () => {
  const targetPath = process.argv[2];
  if (!targetPath) {
    console.error('Usage: node format-frontmatters.js <path-to-directory>');
    process.exit(1);
  }

  // Find all markdown files recursively (no external dependencies)
  const absPath = path.resolve(targetPath);
  const mdFiles = await findMarkdownFiles(absPath);

  for (const file of mdFiles) {
    try {
      const content = await fs.readFile(file, 'utf8');
      const parsed = matter(content);

      // Format frontmatter
      const newFrontmatter = buildFrontmatter(parsed.data);

      // Replace old frontmatter with new
      const body = parsed.content.trimStart();
      const newContent = `${newFrontmatter}\n${body}\n`;

      await fs.writeFile(file, newContent, 'utf8');
      console.log(`\u2705  ${file}`);
    } catch (err) {
      console.error(`\u274C  ${file}: ${err.message}`);
    }
  }
};

main();
