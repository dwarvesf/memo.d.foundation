/**
 * export-markdown.ts, TypeScript port of the Elixir `mix export_markdown` step
 * (lib/obsidian-compiler, Memo.ExportMarkdown + Common.{Slugify,LinkUtils,KatexUtils,
 * Frontmatter,FileUtils,DuckDBUtils}).
 *
 * CF-N.2: collapse the build to one stack (TS in GitHub Actions). The Elixir compiler
 * stays as the oracle/fallback until this reaches parity + is deployed (a later step).
 *
 * This is a FAITHFUL port of the per-file content pipeline, aiming for byte-parity with
 * the Elixir output. Deliberate scope edges are marked `PARITY:` inline and collected in
 * docs/cf-migration/compiler-rewrite.md. Notably the incremental cache is intentionally
 * NOT ported (a clean run processes every file; the cache only affects re-runs), and the
 * verbose IO.puts debug lines the Elixir emits to stdout are not reproduced (they are not
 * part of the on-disk output being compared).
 *
 * Usage:
 *   tsx scripts/export-markdown.ts [--vault ../../vault] [--output ../../public/content]
 * (paths default to the same values the Elixir Mix task uses, relative to
 * lib/obsidian-compiler; when run from repo root pass --vault vault --output public/content)
 */
import * as fs from "fs";
import * as fsp from "fs/promises";
import * as nodePath from "path";
import { execFileSync } from "child_process";
import { createHash } from "crypto";

const P = nodePath.posix;

// ---------------------------------------------------------------------------
// Slugify (port of Memo.Common.Slugify)
// ---------------------------------------------------------------------------

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, ""); // String.trim("-")
}

function extname(file: string): string {
  const base = P.basename(file);
  const dot = base.lastIndexOf(".");
  // Elixir Path.extname returns "" when the dot is at position 0 (dotfile) or absent.
  if (dot <= 0) return "";
  return base.slice(dot);
}

function rootname(file: string): string {
  const ext = extname(file);
  return ext ? file.slice(0, file.length - ext.length) : file;
}

export function slugifyFilename(filename: string): string {
  const base = P.basename(filename);
  const name = rootname(base);
  const ext = extname(filename);
  return slugify(name) + ext;
}

// Elixir Path.dirname("file") === "." ; Path.split(".") === ["."] ; Path.join(["",...]) trims.
function elixirDirname(path: string): string {
  const d = P.dirname(path);
  return d;
}

function slugifyDirectory(path: string): string {
  const parts = path.split("/").filter((s) => s !== "");
  const mapped = parts.map(slugify).filter((s) => s !== "");
  return mapped.join("/");
}

export function slugifyPath(path: string): string {
  const dirname = elixirDirname(path);
  const basename = P.basename(path);
  const dir = slugifyDirectory(dirname);
  const file = slugifyFilename(basename);
  return dir ? `${dir}/${file}` : file;
}

function slugifyPathComponents(path: string): string {
  return path
    .split("/")
    .map((c) => {
      if (c === "." || c === ".." || c === "/" || c === "") return c;
      return slugifyFilename(c);
    })
    .filter((c, i, arr) => !(c === "" && i > 0 && i < arr.length)) // keep leading/trailing markers as Path.join would
    .join("/");
}

export function slugifyLinkPath(link: string): string {
  if (/^(https?:\/\/|#)/.test(link)) return link;
  if (link.includes("#")) {
    const idx = link.indexOf("#");
    const path = link.slice(0, idx);
    const fragment = link.slice(idx + 1);
    const slugged = slugifyPathComponents(safeDecode(path));
    return `${slugged}#${fragment}`;
  }
  return slugifyPathComponents(safeDecode(link));
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function splitContentAndCodeBlocks(content: string): Array<{ code: boolean; text: string }> {
  // Regex.split(~r/(```[\s\S]*?```)/m, include_captures: true)
  const re = /(```[\s\S]*?```)/g;
  const out: Array<{ code: boolean; text: string }> = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) out.push({ code: false, text: content.slice(last, m.index) });
    out.push({ code: true, text: m[0] });
    last = m.index + m[0].length;
  }
  if (last < content.length) out.push({ code: false, text: content.slice(last) });
  if (out.length === 0) out.push({ code: false, text: content });
  return out;
}

export function slugifyMarkdownLinks(content: string): string {
  return splitContentAndCodeBlocks(content)
    .map((part) => (part.code ? part.text : slugifyLinksInText(part.text)))
    .join("");
}

function slugifyLinksInText(text: string): string {
  const re = /!?\[([^\]]*)\]\(([^)]+)\)/g;
  return text.replace(re, (full, linkText, link) => {
    const slugged = slugifyLinkPath(link);
    return full.startsWith("!") ? `![${linkText}](${slugged})` : `[${linkText}](${slugged})`;
  });
}

// ---------------------------------------------------------------------------
// KaTeX (port of Memo.Common.KatexUtils)
// ---------------------------------------------------------------------------

export function wrapMultilineKatex(content: string): string {
  return content.replace(/\$\$([\s\S]*?)\$\$/gm, (_full, katex) =>
    katex.includes("\n") ? `\n$$${katex}$$\n` : `$$${katex}$$`
  );
}

// ---------------------------------------------------------------------------
// Frontmatter (port of Memo.Common.Frontmatter)
// ---------------------------------------------------------------------------

// gray-matter/js-yaml are borrowed from the parent node_modules.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const yaml = require("js-yaml");

function parseFrontmatter(content: string): any | null {
  // ~r/^---\n(.*?)\n---/s
  const m = /^---\n([\s\S]*?)\n---/.exec(content);
  if (!m) return null;
  try {
    return yaml.load(m[1]);
  } catch {
    return null;
  }
}

function hasRequiredFields(fm: any): boolean {
  return fm && typeof fm === "object" && "title" in fm && "description" in fm;
}

function hasValidOptionalFields(fm: any): boolean {
  const authors = fm.authors;
  const tags = fm.tags;
  return (
    (authors === undefined || authors === null || Array.isArray(authors)) &&
    (tags === undefined || tags === null || Array.isArray(tags))
  );
}

export function containsRequiredFrontmatterKeys(file: string): boolean {
  let content: string;
  try {
    content = fs.readFileSync(file, "utf8");
  } catch {
    return false;
  }
  const fm = parseFrontmatter(content);
  if (fm === null || fm === undefined) return false;
  if (fm && typeof fm === "object" && !Array.isArray(fm)) {
    if (fm.skip_frontmatter_check === true) return true;
    return hasRequiredFields(fm) && hasValidOptionalFields(fm);
  }
  if (Array.isArray(fm)) {
    return fm.some(
      (item) =>
        item &&
        typeof item === "object" &&
        (item.skip_frontmatter_check === true ||
          (hasRequiredFields(item) && hasValidOptionalFields(item)))
    );
  }
  return false;
}

// ---------------------------------------------------------------------------
// FileUtils (port of Memo.Common.FileUtils)
// ---------------------------------------------------------------------------

function normalizePath(path: string): string {
  // The Elixir version replaces a mojibake sequence then round-trips codepoints < 128
  // unchanged and codepoints >= 128 unchanged too, i.e. it is effectively identity apart
  // from the "Â§" -> "§" fix. We replicate exactly that.
  return path.replace(/Â§/g, "§");
}

export function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  const entries = fs.readdirSync(dir);
  for (const file of entries) {
    const normalized = normalizePath(file);
    const full = P.join(dir, normalized);
    let isDir = false;
    try {
      isDir = fs.statSync(full).isDirectory();
    } catch {
      isDir = false;
    }
    if (isDir) {
      out.push(full, ...listFilesRecursive(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function readExportIgnoreFile(ignoreFile: string): string[] {
  if (!fs.existsSync(ignoreFile)) return [];
  return fs
    .readFileSync(ignoreFile, "utf8")
    .split("\n")
    .map((l) => l.replace(/\r$/, ""))
    .filter((l) => l !== "" && !l.startsWith("#"));
}

function matchPattern(path: string, pattern: string): boolean {
  if (pattern.endsWith("/")) {
    return path.startsWith(pattern) || path.includes(`/${pattern}`);
  }
  if (pattern.startsWith("*")) {
    return path.endsWith(pattern.replace(/^\*+/, ""));
  }
  if (pattern.endsWith("*")) {
    return path.startsWith(pattern.replace(/\*+$/, ""));
  }
  return path === pattern;
}

function ignored(file: string, patterns: string[], vaultpath: string): boolean {
  const rel = P.relative(vaultpath, file);
  const normalized = normalizePath(rel);
  return patterns.some((p) => matchPattern(normalized, p));
}

// ---------------------------------------------------------------------------
// LinkUtils (port of Memo.Common.LinkUtils)
// ---------------------------------------------------------------------------

const EXTRACT_RE =
  /!\[\[((?:[^\]]|\.mp4|\.webp|\.png|\.jpg|\.gif|\.svg)+)\]\]|\[\[([^\|\]]+\.md)\|([^\]]+)\]\]|\[\[([^\|\]]+)\|([^\]]+)\]\]|\[\[([^\|\]]+\.md)\]\]|\[\[([^\]]+)\]\]/g;

export function extractLinks(content: string): string[] {
  const links: string[] = [];
  let m: RegExpExecArray | null;
  EXTRACT_RE.lastIndex = 0;
  while ((m = EXTRACT_RE.exec(content)) !== null) {
    // Mirror the Elixir flat_map clause ordering (first non-nil group wins).
    if (m[1] !== undefined) links.push(m[1]); // image embed
    else if (m[3] !== undefined) links.push(m[2]); // [[x.md|alt]] -> pre (the path)
    else if (m[5] !== undefined) links.push(m[4]); // [[x|alt]] -> file
    else if (m[6] !== undefined) links.push(m[6]); // [[x.md]]
    else if (m[7] !== undefined) links.push(m[7]); // [[x]]
  }
  return links;
}

/**
 * resolve_links: for each link, find files whose basename contains the link string (case
 * variants). Later matches (in all_files order) overwrite earlier for the same link key, * we replicate `for ... into: %{}` (last write wins).
 */
export function resolveLinks(
  links: string[],
  allFiles: string[],
  vaultpath: string
): Map<string, string> {
  const resolved = new Map<string, string>();
  for (const link of links) {
    const downLink = link.toLowerCase();
    for (const path of allFiles) {
      const base = P.basename(path);
      const downBase = base.toLowerCase();
      if (base.includes(link) || downBase.includes(downLink)) {
        resolved.set(link, P.relative(vaultpath, path).toLowerCase()); // last write wins
      }
    }
  }
  return resolved;
}

function removeIndexSuffix(path: string): string {
  return path.replace(/_index\.md$/, ".md").replace(/_index$/, "");
}

function fileValid(link: string, currentFile: string): boolean {
  // check_frontmatter=false variant (the only one used by convert_links).
  const decoded = link.replace(/%20/g, " ");
  const currentDir = P.dirname(currentFile);
  const fullPath = P.join(currentDir, decoded);
  const normalized = nodePath.resolve(fullPath);
  if (fs.existsSync(normalized)) return true;
  const filename = P.basename(decoded);
  const lower = filename.toLowerCase();
  if (["index.md", "readme.md", "index.mdx", "readme.mdx"].includes(lower)) {
    return caseInsensitiveFileExists(currentDir, filename);
  }
  return false;
}

function caseInsensitiveFileExists(directory: string, target: string): boolean {
  const lower = target.toLowerCase();
  try {
    return fs.readdirSync(directory).some((f) => f.toLowerCase() === lower);
  } catch {
    return false;
  }
}

function buildLink(altText: string, resolvedPath: string, link: string, currentFile: string): string {
  return fileValid(link, currentFile) ? `[${altText}](${resolvedPath})` : `[${altText}]()`;
}

export function convertLinks(
  content: string,
  resolvedLinks: Map<string, string>,
  currentFile: string
): string {
  // sanitize: key `\|` -> `|`, value trailing `\` -> ""
  const sanitized = new Map<string, string>();
  for (const [k, v] of resolvedLinks) {
    sanitized.set(k.replace(/\\\|/g, "|"), v.replace(/\\$/, ""));
  }

  return splitContentAndCodeBlocks(content)
    .map((part) => {
      if (part.code) return part.text;
      let text = part.text;
      text = convertLinksWithAltText(text, sanitized, currentFile);
      text = convertLinksWithoutAltText(text, sanitized, currentFile);
      text = convertEmbeddedImages(text, sanitized, currentFile);
      text = convertMarkdownLinks(text, sanitized, currentFile);
      return text;
    })
    .join("");
}

function convertLinksWithAltText(content: string, resolved: Map<string, string>, cur: string): string {
  const re = /(?<![`\w])\[\[([^\|\]]+)\|([^\]]+)\]\](?![`\w])/g;
  return content.replace(re, (_full, link, altText) => {
    const resolvedPath = removeIndexSuffix(
      slugifyLinkPath((resolved.get(link) ?? link).replace(/\\$/, ""))
    );
    return buildLink(altText, resolvedPath, link, cur);
  });
}

function convertLinksWithoutAltText(content: string, resolved: Map<string, string>, cur: string): string {
  const re = /(?![`\w])\[\[([^\]]+)\]\](?![`\w])/g;
  return content.replace(re, (_full, link) => {
    const resolvedPath = removeIndexSuffix(
      slugifyLinkPath((resolved.get(link) ?? `${link}.md`).replace(/\\$/, ""))
    );
    const altText = P.basename(resolvedPath, ".md");
    return buildLink(altText, resolvedPath, link, cur);
  });
}

function convertEmbeddedImages(content: string, resolved: Map<string, string>, cur: string): string {
  const re = /!\[\[([^\]]+)\]\]/g;
  return content.replace(re, (_full, link) => {
    const resolvedPath = slugifyLinkPath((resolved.get(link) ?? link).replace(/\\$/, ""));
    return fileValid(link, cur) ? `![](${resolvedPath})` : `![]()`;
  });
}

function convertMarkdownLinks(content: string, resolved: Map<string, string>, cur: string): string {
  const re = /\[([^\]]+)\]\(([^)]+\.md)\)/g;
  return content.replace(re, (_full, altText, link) => {
    const resolvedPath = removeIndexSuffix(
      slugifyLinkPath((resolved.get(link) ?? link).replace(/\\$/, ""))
    );
    return buildLink(altText, resolvedPath, link, cur);
  });
}

// ---------------------------------------------------------------------------
// DuckDB dsql blocks (port of Memo.Common.DuckDBUtils, via the duckdb CLI)
// ---------------------------------------------------------------------------

const MACRO =
  "CREATE OR REPLACE TEMP MACRO markdown_link(title, file_path) AS '[' || COALESCE(title, '/' || REGEXP_REPLACE(REGEXP_REPLACE(LOWER(REGEXP_REPLACE(REPLACE(REPLACE(file_path, '.md', ''), ' ', '-'),'[^a-zA-Z0-9/_-]+', '-')), '(-/|-$|_index$)', ''), '/readme$', '')) || '](/' || REGEXP_REPLACE(REGEXP_REPLACE(LOWER(REGEXP_REPLACE(REPLACE(REPLACE(file_path, '.md', ''), ' ', '-'),'[^a-zA-Z0-9/_-]+', '-')), '(-/|-$|_index$)', ''), '/readme$', '') || ')'";

function duckdbQueryTemp(query: string, dbDir: string): { ok: boolean; data: any } {
  try {
    const out = execFileSync(
      "duckdb",
      ["-json", "-cmd", `IMPORT DATABASE '${dbDir}'`, "-cmd", MACRO, "-c", query],
      { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }
    );
    if (out === "") return { ok: true, data: [] };
    try {
      return { ok: true, data: JSON.parse(out) };
    } catch {
      return { ok: true, data: out };
    }
  } catch (e: any) {
    return { ok: false, data: e.stderr || e.message };
  }
}

function extractHeadersFromQuery(query: string): string[] {
  const m = /SELECT\s+([\s\S]+?)\s+FROM/i.exec(query);
  if (!m) return [];
  return m[1]
    .split(",")
    .map(extractColumnName)
    .filter((c): c is string => c != null);
}

function cleanName(name: string): string {
  return name.replace(/["\[\]`()]/g, "").trim();
}

function extractColumnName(column: string): string | null {
  const col = column.trim();
  let mm: RegExpExecArray | null;
  if ((mm = /\sAS\s+'([^']+)'/i.exec(col))) return cleanName(mm[1]);
  if ((mm = /\sAS\s+"([^"]+)"/i.exec(col))) return cleanName(mm[1]);
  if (/\sAS\s/i.test(col)) {
    const parts = col.split(/\sAS\s/i);
    return cleanName(parts[parts.length - 1]);
  }
  if (/^[\w\d_]+\(.*\)\s+AS\s+\w+$/i.test(col)) {
    mm = /^.*\)\s+AS\s+(\w+)$/i.exec(col);
    return mm ? cleanName(mm[1]) : cleanName(col);
  }
  if (/^[\w\d_]+\(.*\)\s+\w+$/.test(col)) {
    mm = /^.*\)\s+(\w+)$/.exec(col);
    return mm ? cleanName(mm[1]) : cleanName(col);
  }
  return cleanName(col);
}

function getValue(row: any, key: string): any {
  if (row == null || typeof row !== "object") return row;
  if (key in row) return row[key];
  if (key.toLowerCase() in row) return row[key.toLowerCase()];
  if (key.toUpperCase() in row) return row[key.toUpperCase()];
  return null;
}

function resultToMarkdownTable(result: any, query: string): string {
  if (typeof result === "string") return result;
  if (!Array.isArray(result) || result.length === 0) return "No results or invalid data format.";
  const available = result[0] && typeof result[0] === "object" ? Object.keys(result[0]) : [];
  let headers = extractHeadersFromQuery(query);
  headers = headers.length === 0 ? available : headers.filter((h) => available.includes(h));
  if (headers.length === 0) headers = Object.keys(result[0]);
  if (headers.length === 0) return "No headers found in the result.";
  const headerRow = `| ${headers.join(" | ")} |`;
  const sep = `|${"---|".repeat(headers.length)}`;
  const rows = result.map(
    (row) => `| ${headers.map((h) => String(getValue(row, h) ?? "").trim()).join(" | ")} |`
  );
  return [headerRow, sep, ...rows].join("\n");
}

function formatItem(item: any): string {
  if (typeof item === "string") return item.trim();
  if (item && typeof item === "object") {
    const vals = Object.values(item);
    if (vals.length === 1) return formatItem(vals[0]);
    return Object.entries(item)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
  }
  return String(item);
}

function resultToMarkdownList(result: any, query: string): string {
  if (typeof result === "string") return `- ${result}`;
  if (!Array.isArray(result) || result.length === 0) return "No results or invalid data format.";
  const available = result[0] && typeof result[0] === "object" ? Object.keys(result[0]) : [];
  let headers = extractHeadersFromQuery(query);
  headers = headers.length === 0 ? available : headers.filter((h) => available.includes(h));
  return result
    .map((row) => {
      const value =
        headers.length === 0
          ? formatItem(row)
          : headers.map((h) => getValue(row, h)).map(formatItem).join(": ");
      return `- ${value}`;
    })
    .join("\n");
}

function processDuckdbQueries(content: string, dbDir: string): string {
  let out = content.replace(/```dsql-table\n([\s\S]*?)```/g, (_full, query) => {
    const r = duckdbQueryTemp(query, dbDir);
    return r.ok ? resultToMarkdownTable(r.data, query) : `Error executing query: ${r.data}`;
  });
  out = out.replace(/```dsql-list\n([\s\S]*?)```/g, (_full, query) => {
    const r = duckdbQueryTemp(query, dbDir);
    return r.ok ? resultToMarkdownList(r.data, query) : `Error executing query: ${r.data}`;
  });
  return out;
}

// ---------------------------------------------------------------------------
// Path mapping (port of replace_path_prefix + preserve_relative_prefix_and_slugify)
// ---------------------------------------------------------------------------

function replacePathPrefix(path: string, oldPrefix: string, newPrefix: string): string {
  const normalizedPath = nodePath.resolve(path);
  const normalizedOld = nodePath.resolve(oldPrefix);
  const relativePart = P.relative(normalizedOld, normalizedPath);
  const insidePrefix = relativePart !== normalizedPath && !relativePart.startsWith("..");
  if (insidePrefix) {
    const result = P.join(newPrefix, relativePart);
    return path.startsWith("../") ? result : nodePath.resolve(result);
  }
  // fallback
  const oldBase = P.basename(oldPrefix);
  const newBase = P.basename(newPrefix);
  return path.replace(new RegExp(`(^|/)${oldBase}(/|$)`), `$1${newBase}$2`);
}

function preserveRelativePrefixAndSlugify(path: string): string {
  if (path.endsWith(".mdx")) return path;
  const m = /^(\.\.\/)+/.exec(path);
  if (m) {
    const prefix = m[0];
    const rest = path.slice(prefix.length);
    return prefix + slugifyPath(rest);
  }
  return slugifyPath(path);
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

function computeFileHash(file: string): string {
  return createHash("md5").update(fs.readFileSync(file)).digest("hex");
}

interface Opts {
  vault: string;
  output: string;
  dbDir: string;
}

function processFileContent(file: string, vaultDir: string, allFiles: string[], dbDir: string): string {
  const content = fs.readFileSync(file, "utf8");
  const links = extractLinks(content);
  const resolved = resolveLinks(links, allFiles, vaultDir);
  let out = convertLinks(content, resolved, file);
  out = processDuckdbQueries(out, dbDir);
  out = slugifyMarkdownLinks(out);
  out = wrapMultilineKatex(out);
  return out;
}

export function runExport(opts: Opts): { exported: number; skipped: number } {
  const { vault: vaultDir, output: exportpath, dbDir } = opts;
  const ignorePatterns = readExportIgnoreFile(P.join(vaultDir, ".export-ignore"));
  const paths = listFilesRecursive(vaultDir);
  const allFiles = paths.filter((p) => {
    try {
      return fs.statSync(p).isFile();
    } catch {
      return false;
    }
  });
  const allValidFiles = allFiles.filter((f) => !ignored(f, ignorePatterns, vaultDir));

  let exported = 0;
  let skipped = 0;

  for (const file of allValidFiles) {
    if (!containsRequiredFrontmatterKeys(file)) continue;
    const exportFile = replacePathPrefix(file, vaultDir, exportpath);
    const slugifiedExportFile = preserveRelativePrefixAndSlugify(exportFile);
    const dirname = P.dirname(slugifiedExportFile);
    const basename = P.basename(slugifiedExportFile);
    if ((basename === "home.md" || basename === "index.md") && dirname === exportpath) {
      skipped++;
      continue;
    }
    const converted = processFileContent(file, vaultDir, allValidFiles, dbDir);
    fs.mkdirSync(P.dirname(slugifiedExportFile), { recursive: true });
    fs.writeFileSync(slugifiedExportFile, converted);
    exported++;
  }
  return { exported, skipped };
}

function parseArgs(argv: string[]): Opts {
  let vault = "../../vault";
  let output = "../../public/content";
  let dbDir = "../../db";
  for (let i = 0; i < argv.length; i++) {
    if ((argv[i] === "--vault" || argv[i] === "-v") && argv[i + 1]) vault = argv[++i];
    else if ((argv[i] === "--output" || argv[i] === "-o") && argv[i + 1]) output = argv[++i];
    else if (argv[i] === "--db" && argv[i + 1]) dbDir = argv[++i];
  }
  return { vault, output, dbDir };
}

if (require.main === module) {
  const opts = parseArgs(process.argv.slice(2));
  const start = Date.now();
  const { exported, skipped } = runExport(opts);
  console.error(
    `export-markdown(ts): exported ${exported}, skipped(root) ${skipped} in ${(
      (Date.now() - start) /
      1000
    ).toFixed(1)}s -> ${opts.output}`
  );
}
