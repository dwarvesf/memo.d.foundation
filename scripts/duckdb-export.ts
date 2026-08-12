/**
 * duckdb-export.ts, TypeScript port of the Elixir `mix duckdb.export` reindexer
 * (lib/obsidian-compiler, Memo.ExportDuckDB + Common.{FileUtils,Frontmatter,GitUtils,AIUtils}).
 *
 * Rebuilds db/vault.parquet, the content database every site script reads through
 * @duckdb/node-api. Sibling of scripts/export-markdown.ts, which ported the other Mix task.
 *
 * The port is faithful down to the generated SQL text, because the Elixir builds its
 * INSERT statements by string concatenation and several storage quirks fall out of that
 * (md_content keeps literal `\n` two-char sequences, array columns are sorted, empty
 * VARCHAR[] round-trips as `'[]'`). Reproducing the value serializers rather than using
 * bound parameters is what keeps the parquet byte-comparable with the Elixir oracle.
 *
 * Deliberate scope edges, marked `PARITY:` inline:
 *   - The Elixir shells out to the `duckdb` CLI once per query, so a large batch can blow
 *     past ARG_MAX and the batch is silently dropped. This port talks to the in-process
 *     engine and fails loud instead.
 *   - Live embedding generation (Gemini + Jina) is not ported. MEMO_EMBEDDINGS defaults
 *     off upstream; the columns and the carry-forward behaviour are preserved.
 *   - The legacy processing_metadata migration paths are not ported (db/schema.sql has
 *     been on the per-file schema for a long time and cannot regress to the `id` shape).
 *   - `keywords` is carried forward on the frontmatter-only upsert path, where the Elixir
 *     wipes it. Marked `DIVERGENCE:` at batch_upsert_into_duckdb.
 *
 * Usage:
 *   tsx scripts/duckdb-export.ts [--vault vault] [--db db] [--format parquet]
 *                                [--ignore-filter] [--ignore-embeddings-check]
 */
import * as fs from "fs";
import * as nodePath from "path";
import { execFileSync } from "child_process";
import * as yaml from "js-yaml";
import dotenv from "dotenv";
import { DuckDBInstance, DuckDBConnection } from "@duckdb/node-api";
import { listFilesRecursive, readExportIgnoreFile, isIgnored } from "./export-markdown";

const P = nodePath.posix;

// ---------------------------------------------------------------------------
// Schema contract (port of @allowed_frontmatter / @embed_ignore_frontmatter)
// ---------------------------------------------------------------------------

const MIN_CONTENT_LENGTH = 100;

const EMBED_IGNORE_FRONTMATTER: readonly string[] = [
  "file_path",
  "md_content",
  "spr_content",
  "keywords",
  "embeddings_gemini",
  "embeddings_spr_custom",
  "estimated_tokens",
  "previous_paths",
  "has_redirects",
  "redirect",
];

const ALLOWED_FRONTMATTER: ReadonlyArray<readonly [string, string]> = [
  ["file_path", "TEXT UNIQUE"],
  ["md_content", "TEXT"],
  ["spr_content", "TEXT"],
  ["keywords", "VARCHAR[]"],
  ["embeddings_gemini", "FLOAT[768]"],
  ["embeddings_spr_custom", "FLOAT[1024]"],
  ["title", "VARCHAR"],
  ["short_title", "VARCHAR"],
  ["description", "VARCHAR"],
  ["tags", "VARCHAR[]"],
  ["authors", "VARCHAR[]"],
  ["date", "DATE"],
  ["pinned", "BOOLEAN"],
  ["hide_frontmatter", "BOOLEAN"],
  ["hide_title", "BOOLEAN"],
  ["hide_on_sidebar", "BOOLEAN"],
  ["hiring", "BOOLEAN"],
  ["featured", "BOOLEAN"],
  ["draft", "BOOLEAN"],
  ["social", "TEXT[]"],
  ["github", "VARCHAR"],
  ["website", "VARCHAR"],
  ["avatar", "VARCHAR"],
  ["discord_id", "VARCHAR"],
  ["aliases", "VARCHAR[]"],
  ["icy", "DOUBLE"],
  ["bounty", "DOUBLE"],
  ["PICs", "TEXT[]"],
  ["status", "TEXT"],
  ["function", "TEXT"],
  ["estimated_tokens", "BIGINT"],
  ["total_tokens", "BIGINT"],
  ["should_deploy_perma_storage", "BOOLEAN"],
  ["perma_storage_id", "VARCHAR"],
  ["should_mint", "BOOLEAN"],
  ["minted_at", "DATE"],
  ["token_id", "VARCHAR"],
  ["previous_paths", "VARCHAR[]"],
  ["ai_summary", "BOOLEAN"],
  ["ai_generated_summary", "VARCHAR[]"],
  ["has_redirects", "BOOLEAN"],
  ["redirect", "VARCHAR[]"],
];

const ALLOWED_KEYS: readonly string[] = ALLOWED_FRONTMATTER.map(([name]) => name);

function isArrayType(type: string): boolean {
  return type.includes("[]") || type.includes("ARRAY");
}

function isArrayKey(key: string): boolean {
  const def = ALLOWED_FRONTMATTER.find(([k]) => k === key);
  return def !== undefined && isArrayType(def[1]);
}

function isDateKey(key: string): boolean {
  const def = ALLOWED_FRONTMATTER.find(([k]) => k === key);
  return def !== undefined && def[1] === "DATE";
}

const ARRAY_COLUMNS: readonly string[] = ALLOWED_FRONTMATTER.filter(([, t]) => isArrayType(t)).map(
  ([k]) => k
);

// ---------------------------------------------------------------------------
// Elixir value semantics
// ---------------------------------------------------------------------------

const ASCII_ONLY = /^[\x00-\x7F]*$/;
let segmenter: Intl.Segmenter | undefined;

/**
 * Elixir's String.length counts extended grapheme clusters, and the count feeds
 * estimated_tokens (a stored column) plus the @min_content_length gate, so the
 * difference from JS's UTF-16 code-unit length is load bearing. CRLF is a single
 * cluster, which is why the ASCII fast path has to exclude it.
 */
export function graphemeLength(s: string): number {
  if (ASCII_ONLY.test(s) && !s.includes("\r\n")) return s.length;
  segmenter ??= new Intl.Segmenter("en", { granularity: "grapheme" });
  let n = 0;
  for (const _ of segmenter.segment(s)) n++;
  return n;
}

function graphemes(s: string): string[] {
  if (ASCII_ONLY.test(s) && !s.includes("\r\n")) return s.split("");
  segmenter ??= new Intl.Segmenter("en", { granularity: "grapheme" });
  return Array.from(segmenter.segment(s), (g) => g.segment);
}

/**
 * Erlang/Elixir float formatting: shortest round-trip digits, rendered in whichever of
 * the plain and scientific forms is textually shorter (plain wins ties). Matters because
 * the float text is what lands in the generated SQL, and DuckDB's DECIMAL -> FLOAT cast
 * is not correctly rounded, so a different rendering shifts stored embeddings by 1 ULP.
 */
export function elixirFloat(n: number): string {
  if (Number.isNaN(n)) return "NaN";
  if (!Number.isFinite(n)) return n > 0 ? "Infinity" : "-Infinity";
  const sign = n < 0 || Object.is(n, -0) ? "-" : "";
  const abs = Math.abs(n);
  if (abs === 0) return `${sign}0.0`;

  const [mantissa, expStr] = abs.toExponential().split("e");
  const exp = Number(expStr);
  const digits = mantissa.replace(".", "");

  let plain: string;
  if (exp >= 0) {
    plain =
      exp + 1 >= digits.length
        ? `${digits}${"0".repeat(exp + 1 - digits.length)}.0`
        : `${digits.slice(0, exp + 1)}.${digits.slice(exp + 1)}`;
  } else {
    plain = `0.${"0".repeat(-exp - 1)}${digits}`;
  }
  const sciMantissa = digits.length === 1 ? `${digits}.0` : `${digits[0]}.${digits.slice(1)}`;
  const sci = `${sciMantissa}e${exp}`;
  return sign + (sci.length < plain.length ? sci : plain);
}

function elixirToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isInteger(value) ? String(value) : elixirFloat(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

/** Elixir's Float.parse/1 succeeds only on a leading decimal; we require full consumption. */
const FULL_FLOAT = /^[+-]?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$/;

/** Elixir sorts binaries byte-wise (UTF-8 order), which differs from JS's UTF-16 order. */
function sortBinaries(list: string[]): string[] {
  return [...list].sort((a, b) => Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8")));
}

/** Jason.encode! iterates small Erlang maps in sorted key order; JSON.stringify does not. */
function jasonEncode(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, (v as Record<string, unknown>)[k]]))
      : v
  );
}

// ---------------------------------------------------------------------------
// SQL value serializers (port of transform_value and friends)
// ---------------------------------------------------------------------------

export function escapeString(value: string): string {
  return value.replaceAll("''", "'").replaceAll("'", "''");
}

export function escapeMultilineText(text: string): string {
  return `'${text.trim().replaceAll("'", "''").replaceAll("\n", "\\n")}'`;
}

function serializeArray(value: unknown): string {
  if (Array.isArray(value)) {
    // PARITY: the Elixir picks the zero-vector width by inspecting its own stacktrace, a
    // check that never matches, so the empty case is always the 1024-wide vector.
    if (value.length === 0) return `[${Array(1024).fill("0").join(", ")}]`;
    return `ARRAY[${value.map((v) => `${elixirFloat(Number(v))}::FLOAT`).join(", ")}]`;
  }
  if (typeof value === "string") return `CAST(${value} AS FLOAT[])`;
  return "NULL";
}

function serializeList(value: unknown): string {
  let normalized: string[];
  if (typeof value === "string") normalized = [value];
  else if (Array.isArray(value)) normalized = value.filter((v) => v !== "" && v !== null && v !== undefined).map(String);
  else normalized = [];
  if (normalized.length === 0) return "NULL";
  return `[${normalized.map((v) => `'${v.replaceAll("'", "''")}'`).join(", ")}]`;
}

function defaultTransformValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `'${jasonEncode(value.filter((v) => v !== "" && v !== null && v !== undefined))}'`;
  }
  if (typeof value === "string") return `'${escapeString(value)}'`;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return elixirToString(value);
  if (value && typeof value === "object") return `'${jasonEncode(value)}'`;
  return "NULL";
}

export function transformValue(value: unknown, key: string): string {
  if (value === null || value === undefined) return "NULL";
  switch (key) {
    case "embeddings_gemini":
    case "embeddings_spr_custom":
      return serializeArray(value);
    case "tags":
    case "authors":
    case "aliases":
    case "keywords":
    case "previous_paths":
      return serializeList(value);
    case "md_content":
    case "spr_content":
      return escapeMultilineText(String(value));
    case "estimated_tokens":
      return elixirToString(value);
    default:
      return defaultTransformValue(value);
  }
}

type Frontmatter = Record<string, unknown>;

function ensureAllColumns(frontmatter: Frontmatter): Frontmatter {
  const base: Frontmatter = {};
  for (const key of ALLOWED_KEYS) base[key] = null;
  return { ...base, ...frontmatter };
}

function prepareData(keys: readonly string[], frontmatter: Frontmatter): string[] {
  return keys.map((key) => transformValue(frontmatter[key], key));
}

// ---------------------------------------------------------------------------
// Comparison normalization (port of normalize_array_value / normalize_value_for_comparison)
// ---------------------------------------------------------------------------

export function normalizeArrayValue(value: unknown, key: string): string[] {
  let stringList: string[];
  if (value === null || value === undefined) {
    stringList = [];
  } else if (Array.isArray(value)) {
    stringList = value.map(elixirToString).filter((v) => v !== "");
  } else if (typeof value === "string") {
    if (value.startsWith("[") && value.endsWith("]")) {
      stringList = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^'+|'+$/g, "").replace(/^"+|"+$/g, ""))
        .filter((s) => s !== "");
    } else if (value.includes(",")) {
      stringList = value.split(",").map((s) => s.trim()).filter((s) => s !== "");
    } else if (value.trim() === "") {
      stringList = [];
    } else {
      stringList = [value];
    }
  } else {
    stringList = [];
  }

  if (key === "ai_generated_summary") {
    const normalized = stringList
      .join(" ")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}_\s-]/gu, "")
      .replace(/\s+/gu, " ")
      .trim();
    return normalized === "" ? [] : sortBinaries(normalized.split(" "));
  }
  return sortBinaries(stringList);
}

function normalizeDateValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return value;
  const dt = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/.exec(value);
  if (dt) return dt[1];
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    const probe = new Date(Date.UTC(y, m - 1, d));
    if (probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d) {
      return value;
    }
  }
  return value;
}

export function normalizeValueForComparison(value: unknown, key: string): unknown {
  if (typeof value === "boolean") return value;
  if (isDateKey(key)) return normalizeDateValue(value);
  if (isArrayKey(key)) return normalizeArrayValue(value, key);
  if (value === null || value === undefined) return null;

  const str = elixirToString(value);
  if (FULL_FLOAT.test(str)) {
    const f = Number(str);
    return f === Math.floor(f) ? elixirFloat(Math.floor(f)) : elixirFloat(f);
  }
  return str.replaceAll("''", "'");
}

// ---------------------------------------------------------------------------
// Jaro similarity (port of String.jaro_distance, the change-detection predicate)
// ---------------------------------------------------------------------------

export function jaroDistance(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a === "" || b === "") return 0.0;

  const A = graphemes(a);
  const B = graphemes(b);
  const aLen = A.length;
  const bLen = B.length;
  const dist = Math.max(1, Math.floor(Math.max(aLen, bLen) / 2));

  // B becomes grapheme -> ascending index list; `cursor` is OTP's per-grapheme remainder,
  // which only advances when a match consumes it.
  const indexMap = new Map<string, number[]>();
  for (let j = 0; j < bLen; j++) {
    const list = indexMap.get(B[j]);
    if (list) list.push(j);
    else indexMap.set(B[j], [j]);
  }
  const cursor = new Map<string, number>();

  const matchedA: string[] = [];
  const matchedB: Array<[number, string]> = [];
  for (let i = 0; i < aLen; i++) {
    const list = indexMap.get(A[i]);
    if (list === undefined) continue;
    const min = i - dist;
    const max = i + dist;
    let k = cursor.get(A[i]) ?? 0;
    let found = -1;
    while (k < list.length) {
      const j = list[k];
      if (min < j && j < max) {
        found = j;
        k++;
        break;
      }
      if (j >= max) break;
      k++;
    }
    if (found < 0) continue;
    cursor.set(A[i], k);
    matchedA.push(A[i]);
    matchedB.push([found, A[i]]);
  }

  const m = matchedA.length;
  if (m === 0) return 0.0;
  const bOrder = [...matchedB].sort((x, y) => x[0] - y[0]);
  let t = 0;
  for (let i = 0; i < m; i++) if (matchedA[i] !== bOrder[i][1]) t++;
  return (m / aLen + m / bLen + (m - t / 2) / m) / 3;
}

// ---------------------------------------------------------------------------
// Frontmatter (port of Memo.Common.Frontmatter.extract_frontmatter)
// ---------------------------------------------------------------------------

interface Extracted {
  frontmatter: Frontmatter;
  mdContent: string;
}

export function extractFrontmatter(content: string): Extracted | null {
  const m = /^---\n([\s\S]+?)\n---\n/.exec(content);
  if (!m) return null;
  let parsed: unknown;
  try {
    parsed = yaml.load(m[1]);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const afterOpen = content.slice(content.indexOf("---\n") + 4);
  const close = afterOpen.indexOf("\n---\n");
  const mdContent = close === -1 ? afterOpen : afterOpen.slice(close + 5);
  return { frontmatter: parsed as Frontmatter, mdContent };
}

// ---------------------------------------------------------------------------
// Git helpers (port of Memo.Common.GitUtils + get_file_last_commit_timestamp)
// ---------------------------------------------------------------------------

function git(args: string[], cwd: string): { out: string; ok: boolean } {
  try {
    return { out: execFileSync("git", args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }), ok: true };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string };
    return { out: `${err.stdout ?? ""}${err.stderr ?? ""}`, ok: false };
  }
}

const gitRootCache = new Map<string, string>();

function findGitRoot(startDir: string): string {
  const cached = gitRootCache.get(startDir);
  if (cached !== undefined) return cached;
  let root: string;
  const dir = fs.existsSync(startDir) && fs.statSync(startDir).isDirectory() ? startDir : ".";
  const r = git(["rev-parse", "--show-toplevel"], dir);
  if (r.ok) root = r.out.trim();
  else {
    const fallback = git(["rev-parse", "--show-toplevel"], ".");
    root = fallback.ok ? fallback.out.trim() : ".";
  }
  gitRootCache.set(startDir, root);
  return root;
}

function getFileLastCommitTimestamp(filePath: string): Date | null {
  const fileAbs = nodePath.resolve(filePath);
  const gitRoot = findGitRoot(nodePath.dirname(fileAbs));
  const rel = P.relative(gitRoot, fileAbs);

  for (const extra of [[], ["--reverse"]]) {
    const r = git(["log", ...extra, "-1", "--format=%cI", "--", rel], gitRoot);
    if (!r.ok) continue;
    const ts = r.out.trim();
    if (ts === "") continue;
    const d = new Date(ts);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function getPreviousPaths(filePathFromVaultRoot: string, mainGitRoot: string): string[] {
  const absoluteFilePath = P.join(mainGitRoot, "vault", filePathFromVaultRoot);
  const specificGitRoot = findGitRoot(nodePath.dirname(absoluteFilePath));
  const pathPrefix =
    specificGitRoot !== mainGitRoot
      ? P.relative(mainGitRoot, specificGitRoot).replace(/^vault\//, "")
      : "";
  const relToSpecific = P.relative(specificGitRoot, absoluteFilePath);

  const r = git(
    ["log", "--follow", "--name-status", '--pretty=format:""', "--", relToSpecific],
    specificGitRoot
  );
  if (!r.ok) return [];

  const acc: string[] = [];
  for (const line of r.out.split("\n")) {
    if (line === "") continue;
    const m = /^R\d*\t([^\t]+)\t([^\t]+)/.exec(line);
    if (!m) continue;
    const full = pathPrefix === "" ? m[1] : P.join(pathPrefix, m[1]);
    acc.unshift(`/${full.replace(/^(vault\/)+/, "")}`);
  }
  return acc;
}

// ---------------------------------------------------------------------------
// SPR compression over opencode-go (port of Memo.Common.AIUtils)
// ---------------------------------------------------------------------------

const DEFAULT_BASE_URL = "https://opencode.ai/zen/go/v1";
const DEFAULT_MODEL = "deepseek-v4-flash";
const HTTP_TIMEOUT_MS = 60_000;

const SPR_COMPRESSION_PROMPT = `You are a lesson extraction specialist, your task is to analyze the following text/script and identify the key "lessons learned" from it.

**OUTPUT REQUIREMENTS:**
- **Keywords section**: List 8-20 key terms from the content for easy searching, including proper nouns and names.
- 4-5 thematic sections with bold headings
- 2-4 concise bullet points per section
- Present these lessons as a concise bulleted list
- Each bullet point should be direct, actionable, and express a single, clear takeaway.
- Section headings should be bold and descriptive, and should be in sentence case.
- Aim for a similar length and succinctness as the bullet points in the provided JSON example, avoiding any verbose explanations or introductory phrases.
- The tone should be objective and analytical.
- Must fit on single A4 page when printed
- **Output format: JSON with keywords array and summary string**

Here's an example of the desired style and quality:
- LLMs are akin to a new operating system, indicating a foundational shift.
- Technology diffusion is inverted, with consumers leading adoption over corporations.

**JSON FORMAT:**
\`\`\`json
{
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7", "keyword8"],
  "summary": "**Theme heading**
* Key insight
* Key insight

**Theme heading**
* Key insight
* Key insight"
}
\`\`\`

Extract the essence, not explanations. Focus on what someone should remember and apply.

**EXAMPLE OUTPUT:**
\`\`\`json
{
  "keywords": ["Software paradigms", "LLMs", "operating systems", "jagged intelligence", "anterograde amnesia", "Iron Man suits", "generation-verification", "autonomy sliders"],
  "summary": "**Three programming paradigms**
* Software 1.0: Traditional code for computers
* Software 2.0: Neural network weights from training
* Software 3.0: English prompts that program LLMs
* Be fluent in all three paradigms for different use cases

**LLMs as operating systems**
* Complex software ecosystems, not simple utilities
* 1960s computing era - expensive, centralized, time-sharing
* Context windows are memory for orchestrating compute

**LLM psychology**
* "Stochastic simulations of people" with emergent psychology
* "Jagged intelligence" - superhuman yet basic mistakes
* "Anterograde amnesia" - context wiped, no learning over time

**Building AI products**
* "Iron Man suits" not robots - augmentation over automation
* Human-AI cooperation: AI generates, humans verify
* Autonomy sliders for user control levels

**Working with AI**
* Keep AI "on the leash" - avoid large, hard-to-audit changes
* Fast generation-verification loops
* Small incremental chunks, not massive changes"
}
\`\`\`
`;

interface SprResult {
  keywords: string[];
  summary: string;
}

const EMPTY_SPR: SprResult = { keywords: [], summary: "" };

function envOr(name: string, fallback: string): string {
  const v = process.env[name];
  return typeof v === "string" && v !== "" ? v : fallback;
}

function coerceSpr(parsed: unknown, raw: string): SprResult | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { keywords: [], summary: raw };
  const o = parsed as Record<string, unknown>;
  if (Array.isArray(o.keywords) && typeof o.summary === "string") {
    return { keywords: o.keywords.map(String), summary: o.summary };
  }
  if (typeof o.summary === "string") return { keywords: [], summary: o.summary };
  return { keywords: [], summary: raw };
}

function tryJson(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Last-ditch regex extraction for JSON with unescaped newlines. */
function extractKeywordsManually(jsonContent: string): SprResult | null {
  const kw = /"keywords":\s*\[([\s\S]*?)\]/.exec(jsonContent);
  if (!kw) return null;
  const keywords = kw[1]
    .split(",")
    .map((s) => s.trim().replace(/^"+|"+$/g, "").trim())
    .filter((s) => s !== "");
  if (keywords.length === 0) return null;
  const sm = /"summary":\s*"([\s\S]*?)"\s*\}/.exec(jsonContent);
  const summary = sm ? sm[1].replaceAll("\\n", "\n").replaceAll('\\"', '"').trim() : "";
  return { keywords, summary };
}

function parseCompletionContent(content: string): SprResult {
  const direct = tryJson(content);
  if (direct !== undefined) return coerceSpr(direct, content) ?? EMPTY_SPR;

  const fenced = /```json\s*\n([\s\S]*?)\n```/.exec(content);
  if (!fenced) return { keywords: [], summary: content };

  const inner = tryJson(fenced[1]);
  if (inner !== undefined) return coerceSpr(inner, content) ?? EMPTY_SPR;
  return extractKeywordsManually(fenced[1]) ?? { keywords: [], summary: content };
}

/**
 * Text generation runs on the opencode-go OpenAI-compatible endpoint (flat-rate tier).
 * Any failure, including a missing key, degrades to an empty result so the export never
 * crashes, exactly as the Elixir does.
 */
async function compressTextLlm(text: string): Promise<SprResult> {
  const apiKey = process.env.OPENCODE_GO_API_KEY;
  if (typeof apiKey !== "string" || apiKey === "") return EMPTY_SPR;

  const payload = {
    model: envOr("OPENCODE_GO_MODEL", DEFAULT_MODEL),
    temperature: 0.1,
    max_tokens: 2048,
    messages: [
      { role: "system", content: "You are a helpful assistant. Do not show your thinking process." },
      { role: "user", content: `${SPR_COMPRESSION_PROMPT}\n\n${text}` },
    ],
  };

  try {
    const res = await fetch(`${envOr("OPENCODE_GO_BASE_URL", DEFAULT_BASE_URL)}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
    });
    const body = (await res.json()) as Record<string, unknown>;
    if ("error" in body) return EMPTY_SPR;
    const choices = body.choices;
    if (!Array.isArray(choices) || choices.length === 0) return EMPTY_SPR;
    const content = (choices[0] as { message?: { content?: unknown } }).message?.content;
    if (typeof content !== "string") return EMPTY_SPR;
    return parseCompletionContent(content);
  } catch {
    return EMPTY_SPR;
  }
}

async function sprCompress(text: string): Promise<SprResult> {
  const flat = text.replaceAll("\n", " ");
  return graphemeLength(flat) > 100 ? compressTextLlm(flat) : EMPTY_SPR;
}

function skipEmbeddings(): boolean {
  const v = process.env.MEMO_EMBEDDINGS;
  return v !== "1" && v !== "true";
}

// ---------------------------------------------------------------------------
// DuckDB access
// ---------------------------------------------------------------------------

export class Duck {
  private constructor(private readonly conn: DuckDBConnection) {}

  static async open(): Promise<Duck> {
    const instance = await DuckDBInstance.create(":memory:");
    return new Duck(await instance.connect());
  }

  async exec(sql: string): Promise<void> {
    await this.conn.run(sql);
  }

  async tryExec(sql: string): Promise<string | null> {
    try {
      await this.conn.run(sql);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  }

  async rows<T extends Record<string, unknown>>(sql: string): Promise<T[]> {
    const reader = await this.conn.runAndReadAll(sql);
    return (await reader.getRowObjectsJson()) as T[];
  }
}

export function vaultTableDdl(): string {
  const cols = ALLOWED_FRONTMATTER.map(([n, t]) => `${quoteIdent(n)} ${t}`).join(", ");
  return `CREATE TABLE IF NOT EXISTS vault (${cols})`;
}

/**
 * Port of setup_database. The Elixir issues `IMPORT DATABASE '../../db'`, which replays
 * schema.sql then load.sql verbatim, and load.sql carries hardcoded '../../db/...' COPY
 * paths that only resolve from lib/obsidian-compiler. Replaying the two files ourselves
 * with the COPY paths rebased on --db makes the script runnable from the repo root while
 * doing exactly what IMPORT DATABASE does.
 */
async function setupDatabase(db: Duck, dbDir: string): Promise<void> {
  const schemaPath = nodePath.join(dbDir, "schema.sql");
  const loadPath = nodePath.join(dbDir, "load.sql");

  if (fs.existsSync(schemaPath) && fs.existsSync(loadPath)) {
    await db.exec(fs.readFileSync(schemaPath, "utf8"));
    for (const stmt of fs.readFileSync(loadPath, "utf8").split(";\n")) {
      const line = stmt.trim();
      if (line === "") continue;
      await db.exec(line.replace(/'[^']*\/([^/']+\.parquet)'/g, `'${nodePath.resolve(dbDir)}/$1'`));
    }
  } else {
    console.error("duckdb-export: no exported database at " + dbDir + ", creating tables");
    await db.exec(vaultTableDdl());
    await db.exec(`CREATE TABLE IF NOT EXISTS processing_metadata (
      file_path TEXT PRIMARY KEY,
      last_processed_at TIMESTAMP,
      git_commit_timestamp TIMESTAMP,
      processing_status VARCHAR DEFAULT 'processed',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
  }
  await mergeColumns(db);
}

const RESERVED_IDENTS = new Set(["function"]);

function quoteIdent(name: string): string {
  return RESERVED_IDENTS.has(name.toLowerCase()) ? `"${name}"` : name;
}

/** Port of merge_columns: align the imported vault table with @allowed_frontmatter. */
async function mergeColumns(db: Duck): Promise<void> {
  const existing = await db.rows<{ column_name: string }>(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'vault'"
  );
  const existingNames = existing.map((r) => r.column_name.toLowerCase());
  const allowedLower = ALLOWED_KEYS.map((k) => k.toLowerCase());

  for (const [name, type] of ALLOWED_FRONTMATTER) {
    if (existingNames.includes(name.toLowerCase())) continue;
    const err = await db.tryExec(`ALTER TABLE vault ADD COLUMN ${quoteIdent(name)} ${type}`);
    if (err) throw new Error(`failed to add column ${name}: ${err}`);
    console.error(`duckdb-export: added column ${name}`);
  }
  for (const name of existingNames) {
    if (allowedLower.includes(name)) continue;
    const err = await db.tryExec(`ALTER TABLE vault DROP COLUMN ${quoteIdent(name)}`);
    if (err) throw new Error(`failed to drop column ${name}: ${err}`);
    console.error(`duckdb-export: removed column ${name}`);
  }
}

/** Port of export/1 + clean_exported_schema, preserving the committed load.sql paths. */
async function exportDatabase(db: Duck, dbDir: string, format: string): Promise<void> {
  const abs = nodePath.resolve(dbDir);
  const clause = format === "parquet" ? " (FORMAT PARQUET)" : "";
  if (format !== "parquet" && format !== "csv") {
    console.error(`duckdb-export: unsupported export format: ${format}`);
    return;
  }
  await db.exec(`EXPORT DATABASE '${abs}'${clause}`);

  const schemaPath = nodePath.join(abs, "schema.sql");
  if (fs.existsSync(schemaPath)) {
    const cleaned = fs
      .readFileSync(schemaPath, "utf8")
      .split("\n")
      .filter((l) => l !== "CREATE SCHEMA information_schema;" && l !== "CREATE SCHEMA pg_catalog;")
      .join("\n");
    fs.writeFileSync(schemaPath, cleaned);
  }
  // EXPORT DATABASE writes COPY paths matching the directory it was handed. Rewrite them
  // back to the committed '../../db/...' form so the artifact does not move with the cwd
  // and the Elixir oracle can still IMPORT it during the transition.
  const loadPath = nodePath.join(abs, "load.sql");
  if (fs.existsSync(loadPath)) {
    const rewritten = fs
      .readFileSync(loadPath, "utf8")
      .replace(/'[^']*\/([^/']+\.parquet)'/g, "'../../db/$1'");
    fs.writeFileSync(loadPath, rewritten);
  }
}

// ---------------------------------------------------------------------------
// Incremental filtering (port of fetch_*_metadata + get_files_to_process)
// ---------------------------------------------------------------------------

interface FileMetadata {
  lastProcessedAt: Date | null;
  gitCommitTimestamp: Date | null;
}

function parseTimestamp(ts: unknown): Date | null {
  if (typeof ts !== "string" || ts === "") return null;
  const d = new Date(ts.includes("T") ? ts : `${ts.replace(" ", "T")}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function fetchLastProcessedTimestamp(db: Duck): Promise<Date | null> {
  const rows = await db.rows<{ global_last_processed_at: unknown }>(
    "SELECT MIN(last_processed_at) AS global_last_processed_at FROM processing_metadata WHERE last_processed_at IS NOT NULL"
  );
  return rows.length === 0 ? null : parseTimestamp(rows[0].global_last_processed_at);
}

async function fetchFileProcessingMetadata(
  db: Duck,
  filePaths: string[]
): Promise<Map<string, FileMetadata>> {
  const out = new Map<string, FileMetadata>();
  if (filePaths.length === 0) return out;
  const inList = filePaths.map((p) => `'${escapeString(p)}'`).join(", ");
  const rows = await db.rows<{ file_path: string; last_processed_at: unknown; git_commit_timestamp: unknown }>(
    `SELECT file_path, last_processed_at, git_commit_timestamp, processing_status FROM processing_metadata WHERE file_path IN (${inList})`
  );
  for (const row of rows) {
    out.set(row.file_path, {
      lastProcessedAt: parseTimestamp(row.last_processed_at),
      gitCommitTimestamp: parseTimestamp(row.git_commit_timestamp),
    });
  }
  return out;
}

/**
 * Port of Path.wildcard("<vault>/**\/*.md"): `**` spans zero or more directories and, with
 * match_dot off, no component may start with a dot.
 */
function matchesDefaultPattern(relPath: string): boolean {
  const parts = relPath.split("/");
  return parts.every((p) => !p.startsWith(".")) && relPath.endsWith(".md");
}

async function getFilesToProcess(
  db: Duck,
  vaultPath: string,
  allFiles: string[],
  lastProcessedTimestamp: Date | null
): Promise<string[]> {
  const vaultAbs = nodePath.resolve(vaultPath);
  const patternMatched = allFiles.filter((f) =>
    matchesDefaultPattern(P.relative(vaultAbs, nodePath.resolve(f)))
  );
  const relPaths = patternMatched.map((f) => P.relative(vaultAbs, nodePath.resolve(f)));
  const metadata = await fetchFileProcessingMetadata(db, relPaths);

  return patternMatched.filter((filePath) => {
    const rel = P.relative(vaultAbs, nodePath.resolve(filePath));
    const meta = metadata.get(rel);
    if (meta === undefined || meta.lastProcessedAt === null) return true;

    const currentGit = getFileLastCommitTimestamp(filePath);
    if (currentGit === null) {
      // Cannot read a Git timestamp: fall back to the global processed-at comparison.
      return lastProcessedTimestamp === null || lastProcessedTimestamp > meta.lastProcessedAt;
    }
    const gitChanged = meta.gitCommitTimestamp === null || currentGit > meta.gitCommitTimestamp;
    const processedRecently = currentGit <= meta.lastProcessedAt;
    return gitChanged && !processedRecently;
  });
}

// ---------------------------------------------------------------------------
// Existing-data reuse (port of pre_fetch_existing_data + needs_embeddings_update)
// ---------------------------------------------------------------------------

type ExistingRow = Record<string, unknown>;

async function preFetchExistingData(
  db: Duck,
  filePaths: string[]
): Promise<Map<string, ExistingRow>> {
  const out = new Map<string, ExistingRow>();
  if (filePaths.length === 0) return out;
  const wanted = new Set(filePaths);
  const rows = await db.rows<ExistingRow>(
    `SELECT ${ALLOWED_KEYS.map(quoteIdent).join(", ")} FROM vault`
  );
  for (const row of rows) {
    const normPath = String(row.file_path ?? "").replace(/^(vault\/)+/, "").replace(/^\/+/, "");
    if (!wanted.has(normPath)) continue;
    const complete: ExistingRow = {};
    for (const key of ALLOWED_KEYS) complete[key] = row[key] ?? null;
    out.set(normPath, complete);
  }
  return out;
}

export function needsEmbeddingsUpdate(existing: ExistingRow, mdContent: string): boolean {
  const sprExists = existing.spr_content !== null && existing.spr_content !== undefined && existing.spr_content !== "";
  if (!sprExists) return true;

  const existingMd = typeof existing.md_content === "string" ? existing.md_content.trim() : "";
  const similarity = jaroDistance(existingMd, mdContent.trim());
  const contentChanged = similarity < 0.7;
  const embeddingsExist =
    existing.embeddings_gemini !== null &&
    existing.embeddings_gemini !== undefined &&
    existing.embeddings_spr_custom !== null &&
    existing.embeddings_spr_custom !== undefined;
  return contentChanged || !embeddingsExist;
}

// ---------------------------------------------------------------------------
// Per-file processing
// ---------------------------------------------------------------------------

interface ProcessedFile {
  filePath: string;
  mdContent: string;
  frontmatter: Frontmatter;
  embeddingsUpdated: boolean;
  frontmatterChanged: boolean;
}

function normalizeTags(frontmatter: Frontmatter): Frontmatter {
  const tags = frontmatter.tags;
  let normalized: unknown;
  if (typeof tags === "string") {
    normalized = tags.includes(",")
      ? tags.split(",").map((t) => t.trim()).filter((t) => t !== "")
      : [tags];
  } else if (Array.isArray(tags)) {
    normalized = tags;
  } else {
    normalized = [];
  }
  return { ...frontmatter, tags: normalized };
}

function comparableFrontmatter(source: Frontmatter | ExistingRow): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ALLOWED_KEYS) {
    if (EMBED_IGNORE_FRONTMATTER.includes(key)) continue;
    out[key] = normalizeValueForComparison(source[key] ?? null, key);
  }
  return out;
}

/** Port of regenerate_embeddings with the two vector calls gated behind MEMO_EMBEDDINGS. */
async function regenerateEmbeddings(
  mdContent: string,
  frontmatter: Frontmatter,
  existing: ExistingRow
): Promise<Frontmatter> {
  const { keywords, summary } = await sprCompress(mdContent);
  if (!skipEmbeddings()) {
    // PARITY GAP: live Gemini/Jina embedding generation is not ported. The upstream
    // default is off and nothing reads the vectors; opting in here would silently write
    // zero vectors, so refuse instead of corrupting the columns.
    throw new Error(
      "MEMO_EMBEDDINGS is set but live embedding generation is not implemented in the TypeScript exporter"
    );
  }
  return {
    ...frontmatter,
    spr_content: summary,
    keywords,
    embeddings_spr_custom: existing.embeddings_spr_custom ?? null,
    embeddings_gemini: existing.embeddings_gemini ?? null,
    estimated_tokens: Math.floor(graphemeLength(mdContent) / 4),
  };
}

function transformFrontmatterNoDb(
  mdContent: string,
  frontmatter: Frontmatter,
  filePath: string,
  previousPathsMap: Map<string, string[]>,
  mainGitRoot: string
): Frontmatter {
  const withTokens: Frontmatter = {
    ...frontmatter,
    estimated_tokens: Math.floor(graphemeLength(mdContent) / 4),
  };
  for (const key of ARRAY_COLUMNS) {
    withTokens[key] = key in withTokens ? normalizeArrayValue(withTokens[key], key) : [];
  }

  const merged = [...(previousPathsMap.get(filePath) ?? []), ...getPreviousPaths(filePath, mainGitRoot)];
  withTokens.previous_paths = [...new Set(merged)];

  const taken: Frontmatter = {};
  for (const key of ALLOWED_KEYS) if (key in withTokens) taken[key] = withTokens[key];
  return { ...taken, file_path: filePath, md_content: mdContent };
}

async function fetchAllPreviousPaths(db: Duck, filePaths: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (filePaths.length === 0) return out;
  const inList = filePaths.map((p) => `'${escapeString(p)}'`).join(", ");
  const rows = await db.rows<{ file_path: string; previous_paths: unknown }>(
    `SELECT file_path, previous_paths FROM vault WHERE file_path IN (${inList})`
  );
  for (const row of rows) {
    out.set(row.file_path, normalizeArrayValue(row.previous_paths, "previous_paths"));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Upsert (port of batch_upsert_into_duckdb)
// ---------------------------------------------------------------------------

const BATCH_SIZE = 15;

function valuesTuple(data: ProcessedFile, keys: readonly string[]): string {
  return `(${prepareData(keys, ensureAllColumns(data.frontmatter)).join(", ")})`;
}

async function runOrThrow(db: Duck, sql: string, what: string): Promise<void> {
  const err = await db.tryExec(sql);
  // PARITY: the Elixir logs and continues here, which silently drops a batch whenever the
  // generated SQL exceeds the shell's ARG_MAX. A dropped batch means a stale row in the
  // published parquet, so this port fails the run instead.
  if (err) throw new Error(`${what}: ${err}`);
}

export async function batchUpsertIntoDuckdb(db: Duck, processed: ProcessedFile[]): Promise<void> {
  const keys = ALLOWED_KEYS;
  const updateAll = keys.filter((k) => k !== "file_path").map((k) => `${quoteIdent(k)} = EXCLUDED.${quoteIdent(k)}`).join(", ");
  // Existing rows whose frontmatter changed but whose content did not keep their vectors,
  // summary and keywords: those columns stay out of the SET clause.
  // DIVERGENCE from lib/obsidian-compiler: the Elixir omits `keywords` from this exclusion
  // list, so every note taking this path has its keywords overwritten with the frontmatter
  // value, which is almost always absent and therefore NULL. Only regenerate_embeddings
  // ever writes keywords, so an incremental run silently strips them from any note it does
  // not regenerate. generate-search-index.ts weights keywords above spr_content, so the
  // wipe degrades site search. The oracle is not fixed: it is being deleted.
  const updateFmOnly = keys
    .filter(
      (k) =>
        k !== "file_path" &&
        k !== "embeddings_gemini" &&
        k !== "embeddings_spr_custom" &&
        k !== "spr_content" &&
        k !== "keywords"
    )
    .map((k) => `${quoteIdent(k)} = EXCLUDED.${quoteIdent(k)}`)
    .join(", ");
  const columnList = keys.map(quoteIdent).join(", ");

  for (let i = 0; i < processed.length; i += BATCH_SIZE) {
    const batch = processed.slice(i, i + BATCH_SIZE);
    const withEmbeddings = batch.filter((d) => d.embeddingsUpdated);
    const fmChanged = batch.filter((d) => !d.embeddingsUpdated && d.frontmatterChanged);

    if (withEmbeddings.length > 0) {
      await runOrThrow(
        db,
        `INSERT INTO vault (${columnList})
         VALUES ${withEmbeddings.map((d) => valuesTuple(d, keys)).join(", ")}
         ON CONFLICT (file_path) DO UPDATE SET ${updateAll}`,
        "batch upsert with embeddings update"
      );
    }
    if (fmChanged.length === 0) continue;

    const inList = fmChanged.map((d) => `'${escapeString(d.filePath)}'`).join(", ");
    const existingRows = await db.rows<{ file_path: string }>(
      `SELECT file_path FROM vault WHERE file_path IN (${inList})`
    );
    const existingSet = new Set(existingRows.map((r) => r.file_path));
    const known = fmChanged.filter((d) => existingSet.has(d.filePath));
    const fresh = fmChanged.filter((d) => !existingSet.has(d.filePath));

    if (fresh.length > 0) {
      await runOrThrow(
        db,
        `INSERT INTO vault (${columnList}) VALUES ${fresh.map((d) => valuesTuple(d, keys)).join(", ")}`,
        "batch insert of new records"
      );
    }
    if (known.length > 0) {
      await runOrThrow(
        db,
        `INSERT INTO vault (${columnList})
         VALUES ${known.map((d) => valuesTuple(d, keys)).join(", ")}
         ON CONFLICT (file_path) DO UPDATE SET ${updateFmOnly}`,
        "batch upsert of frontmatter-only updates"
      );
    }
  }
}

async function removeOldFiles(db: Duck, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const inList = paths.map((p) => `'${escapeString(p)}'`).join(", ");
  await runOrThrow(db, `DELETE FROM vault WHERE file_path NOT IN (${inList})`, "prune deleted files");
}

// ---------------------------------------------------------------------------
// processing_metadata bookkeeping (port of update_file_processing_metadata)
// ---------------------------------------------------------------------------

const METADATA_BATCH_SIZE = 50;

async function updateFileProcessingMetadata(
  db: Duck,
  processedFiles: string[],
  vaultPath: string
): Promise<void> {
  if (processedFiles.length === 0) return;
  const tsString = `${new Date().toISOString().slice(0, 19)}Z`;
  const vaultAbs = nodePath.resolve(vaultPath);

  for (let i = 0; i < processedFiles.length; i += METADATA_BATCH_SIZE) {
    const values = processedFiles
      .slice(i, i + METADATA_BATCH_SIZE)
      .map((filePath) => {
        const rel = P.relative(vaultAbs, nodePath.resolve(filePath));
        const git = getFileLastCommitTimestamp(filePath);
        const gitTs = git === null ? tsString : `${git.toISOString().slice(0, 19)}Z`;
        return `('${escapeString(rel)}', '${tsString}', '${gitTs}', 'processed', '${tsString}', '${tsString}')`;
      })
      .join(", ");

    await runOrThrow(
      db,
      `INSERT INTO processing_metadata (file_path, last_processed_at, git_commit_timestamp, processing_status, created_at, updated_at)
       VALUES ${values}
       ON CONFLICT(file_path) DO UPDATE SET
         last_processed_at = EXCLUDED.last_processed_at,
         git_commit_timestamp = EXCLUDED.git_commit_timestamp,
         processing_status = EXCLUDED.processing_status,
         updated_at = '${tsString}'`,
      "processing metadata upsert"
    );
  }
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

interface Opts {
  vault: string;
  db: string;
  format: string;
  ignoreFilter: boolean;
  ignoreEmbeddingsCheck: boolean;
}

export function parseArgs(argv: string[]): Opts {
  const opts: Opts = {
    vault: "vault",
    db: "db",
    format: "parquet",
    ignoreFilter: false,
    ignoreEmbeddingsCheck: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if ((a === "--vault" || a === "-v") && argv[i + 1]) opts.vault = argv[++i];
    else if ((a === "--format" || a === "-f") && argv[i + 1]) opts.format = argv[++i];
    else if (a === "--db" && argv[i + 1]) opts.db = argv[++i];
    else if (a === "--ignore-filter") opts.ignoreFilter = true;
    else if (a === "--ignore-embeddings-check") opts.ignoreEmbeddingsCheck = true;
  }
  return opts;
}

async function processFiles(
  db: Duck,
  files: string[],
  vaultPath: string,
  allFilesToProcess: string[],
  ignoreEmbeddingsCheck: boolean
): Promise<string[]> {
  const vaultAbs = nodePath.resolve(vaultPath);
  const rel = (f: string): string => P.relative(vaultAbs, nodePath.resolve(f));
  const existingDataMap = await preFetchExistingData(db, files.map(rel));
  const mainGitRoot = findGitRoot(".");

  const processed: ProcessedFile[] = [];
  for (const file of files) {
    const relativePath = rel(file);
    let content: string;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch (e) {
      console.error(`duckdb-export: failed to read ${relativePath}: ${String(e)}`);
      continue;
    }
    const extracted = extractFrontmatter(content);
    if (extracted === null) continue;

    const { mdContent } = extracted;
    const normalized = normalizeTags(extracted.frontmatter);
    const existing = existingDataMap.get(relativePath) ?? {};
    const tooShort = graphemeLength(mdContent) < MIN_CONTENT_LENGTH;
    const embeddingsUpdated = ignoreEmbeddingsCheck
      ? !tooShort
      : !tooShort && needsEmbeddingsUpdate(existing, mdContent);

    const updatedFrontmatter = embeddingsUpdated
      ? await regenerateEmbeddings(mdContent, normalized, existing)
      : {
          ...normalized,
          spr_content: existing.spr_content ?? null,
          embeddings_gemini: existing.embeddings_gemini ?? null,
          embeddings_spr_custom: existing.embeddings_spr_custom ?? null,
        };

    const frontmatterChanged =
      JSON.stringify(comparableFrontmatter(normalized)) !==
      JSON.stringify(comparableFrontmatter(existing));

    processed.push({
      filePath: relativePath,
      mdContent,
      frontmatter: updatedFrontmatter,
      embeddingsUpdated,
      frontmatterChanged,
    });
  }

  const previousPathsMap = await fetchAllPreviousPaths(db, processed.map((p) => p.filePath));
  for (const p of processed) {
    p.frontmatter = transformFrontmatterNoDb(
      p.mdContent,
      p.frontmatter,
      p.filePath,
      previousPathsMap,
      mainGitRoot
    );
  }

  await batchUpsertIntoDuckdb(db, processed);
  await removeOldFiles(db, allFilesToProcess.map(rel));
  return files;
}

export async function runDuckdbExport(opts: Opts): Promise<void> {
  const ignorePatterns = readExportIgnoreFile(P.join(opts.vault, ".export-ignore"));
  const allFiles = listFilesRecursive(opts.vault).filter((p) => {
    if (!p.endsWith(".md")) return false;
    try {
      return fs.statSync(p).isFile();
    } catch {
      return false;
    }
  });
  const allFilesToProcess = allFiles.filter((f) => !isIgnored(f, ignorePatterns, opts.vault));

  const db = await Duck.open();
  await db.exec("INSTALL parquet");
  await db.exec("LOAD parquet");
  await setupDatabase(db, opts.db);

  const lastProcessed = await fetchLastProcessedTimestamp(db);
  const filtered = opts.ignoreFilter
    ? allFilesToProcess
    : await getFilesToProcess(db, opts.vault, allFilesToProcess, lastProcessed);

  console.error(`duckdb-export: ${allFilesToProcess.length} vault files, ${filtered.length} to process`);
  if (filtered.length === 0) {
    console.error("duckdb-export: no files to process based on the given pattern or last processed timestamp");
    return;
  }

  const processedFiles = await processFiles(
    db,
    filtered,
    opts.vault,
    allFilesToProcess,
    opts.ignoreEmbeddingsCheck
  );
  await updateFileProcessingMetadata(db, processedFiles, opts.vault);
  await exportDatabase(db, opts.db, opts.format);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // The Mix task loaded lib/obsidian-compiler/.env; every TypeScript script in this repo
  // reads the repo-root .env instead, so follow the repo convention.
  dotenv.config({ quiet: true });
  const opts = parseArgs(process.argv.slice(2));
  const start = Date.now();
  runDuckdbExport(opts)
    .then(() => {
      console.error(`duckdb-export: done in ${((Date.now() - start) / 1000).toFixed(1)}s -> ${opts.db}`);
    })
    .catch((e: unknown) => {
      console.error(`duckdb-export: ${e instanceof Error ? e.stack : String(e)}`);
      process.exit(1);
    });
}
