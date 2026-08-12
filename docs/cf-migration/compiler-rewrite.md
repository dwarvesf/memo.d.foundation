# CF-N.2: Elixir `export_markdown` -> TypeScript rewrite

Design note + parity report for the real CF-N.2 sub-goal: rewrite the Elixir
`mix export_markdown` content-compilation step (`lib/obsidian-compiler/`) as TypeScript so
the memo.d.foundation build is one stack (TS in GitHub Actions), byte-comparable to the
Elixir output. Produced by porting the code and then running BOTH compilers against the
same real `vault` snapshot and diffing `public/content/`, not by reading code cold.

The Elixir compiler is **retained** as the oracle + fallback (`lib/obsidian-compiler/` is
not deleted). `.github/workflows/publish-pages.yml` (the live Cloudflare Pages deploy
path) now calls the TS version; see "CI cutover" below. `Makefile` / `Dockerfile` (the
Railway build path) are untouched, out of scope for that cutover.

## The half this rewrites (and the half already done)

Per the merged `build-inventory.md` (CF-N.3): the DOWNSTREAM artifact layer
(`scripts/memo-build.ts` + `generate-*.ts` + `next build`) is already TypeScript. The
UPSTREAM half, the vault -> `public/content` markdown compilation, was still Elixir. That
upstream half is what this sub-goal ports.

```
vault/ (Obsidian markdown, git submodule dwarvesf/brainery)
   |
   |  ==> WAS: mix export_markdown  (Elixir, lib/obsidian-compiler)
   |  ==> NOW: tsx scripts/export-markdown.ts  (TypeScript, this sub-goal)
   v
public/content/**/*.md (+ assets, + copied db/*.parquet)
   |
   |  scripts/memo-build.ts + generate-*.ts + next build  (already TypeScript, CF-N.3)
   v
site artifacts (menu/search/backlinks/redirects JSON, out/ static HTML, RSS)
```

Out of scope (unchanged, still Elixir): `mix duckdb.export` (regenerates `db/vault.parquet`
rows + embeddings from source; needs paid embedding providers; run only by manual
`workflow_dispatch`). That is a separate DuckDB/embeddings pipeline, not the markdown
compiler, and the inventory already documented its freshness/automation gap.

## The Elixir pipeline, mapped to the TS port

Source of truth: `lib/obsidian-compiler/lib/memo/export_markdown.ex` +
`lib/memo/common/{slugify,link_utils,katex_utils,frontmatter,file_utils,duckdb_utils}.ex`.
Every function below is ported in `scripts/export-markdown.ts`.

| Stage                             | Elixir                                                         | TS port                                                  | Notes                                                                                                                                         |
| --------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| List vault files                  | `FileUtils.list_files_recursive`                               | `listFilesRecursive`                                     | DFS, dirs + files                                                                                                                             |
| Ignore filter                     | `FileUtils.ignored?` + `.export-ignore`                        | `ignored` + `readExportIgnoreFile`                       | same `dir/`, `*suffix`, `prefix*`, exact-match pattern semantics                                                                              |
| Frontmatter gate                  | `Frontmatter.contains_required_frontmatter_keys?`              | `containsRequiredFrontmatterKeys`                        | requires `title`+`description` (or `skip_frontmatter_check: true`); `authors`/`tags` must be lists; handles a list-of-maps frontmatter        |
| Per-file content pipeline (below) | `process_file`                                                 | `processFileContent`                                     | run in order                                                                                                                                  |
| 1. Extract wikilinks              | `LinkUtils.extract_links`                                      | `extractLinks`                                           | **arity-drop parity, see below**                                                                                                              |
| 2. Resolve links                  | `LinkUtils.resolve_links`                                      | `resolveLinks`                                           | fuzzy: basename substring match, last-in-order wins                                                                                           |
| 3. Convert links                  | `LinkUtils.convert_links`                                      | `convertLinks`                                           | 4 ordered passes (with-alt, without-alt, embedded-image, markdown-link), skipping fenced code blocks                                          |
| 4. `dsql` blocks                  | `process_duckdb_queries` -> `DuckDBUtils`                      | `processDuckdbQueries`                                   | shells to the `duckdb` CLI (same `IMPORT DATABASE` + `markdown_link` TEMP MACRO + `-json` args); renders `dsql-table`/`dsql-list` to markdown |
| 5. Slugify md links               | `Slugify.slugify_markdown_links`                               | `slugifyMarkdownLinks`                                   | code-block-aware                                                                                                                              |
| 6. Wrap multiline KaTeX           | `KatexUtils.wrap_multiline_katex`                              | `wrapMultilineKatex`                                     | `$$...$$` with a newline -> padded with `\n`                                                                                                  |
| Export path + slug                | `replace_path_prefix` + `preserve_relative_prefix_and_slugify` | `replacePathPrefix` + `preserveRelativePrefixAndSlugify` | `.mdx` files keep their name unslugified; `home.md`/`index.md` at root are skipped                                                            |
| Assets + db copy                  | `export_assets_folder` + `export_db_directory`                 | (see Scope edges)                                        | not ported: byte-identical file copies, no transform                                                                                          |

### The one real parity bug the port had to reproduce

Elixir's `extract_links` returns a link only for three wikilink shapes: image embeds
`![[...]]`, the `.md` path of `[[x.md|alt]]`, and the file of `[[x|alt]]`. It does **not**
extract plain `[[x]]` or `[[x.md]]`. This is not by design, it is an emergent artifact:
the `flat_map` clauses pattern-match on the **arity** of each `Regex.scan` result list
(`[_, image]`, `[_, _, pre, _]`, `[_, _, _, _, file, _]`), and Elixir's `Regex.scan` drops
trailing non-participating capture groups. A plain `[[x]]` matches the 7th alternative, so
its result list has 8 elements and lands on none of the 2/4/6-arity clauses; it is silently
dropped. `[[x.md]]` (group 6, 7-elem list) is dropped the same way.

The first cut of the port faithfully extracted plain `[[x]]`, which is the "obvious" reading
of the regex. That over-populated the fuzzy resolver: a plain `[[Go]]` or `[[1]]` was
resolved by naive basename-substring matching (`"go"` is a substring of `argocd.md`,
`remote-...going...webp`, etc.), so the port emitted a different (still broken) link target
than Elixir, which fell through to its fallback. Matching Elixir's arity-drop behavior, i.e.
**not** extracting plain `[[x]]`/`[[x.md]]`, closed the gap to 100%.

The resolved links in those degenerate cases are broken in BOTH outputs (`[alt]()` with an
empty target, because the fuzzy match does not point at a real reachable file); only the
dead link's alt text differed. Parity here means reproducing the Elixir behavior exactly,
bug included, since the Elixir output is the oracle the downstream TS layer already consumes.

## Parity method

1. Check out the real `vault` submodule (`dwarvesf/brainery`, 568M, https override for the
   SSH `.gitmodules` URL, same as the CF-N.3 validation).
2. Run the Elixir oracle: `cd lib/obsidian-compiler && mix export_markdown --vault ../../vault --output ../../public/content` (local Elixir 1.18/OTP26, `mix deps.get && mix compile`).
3. Run the TS port to a parallel dir: `tsx scripts/export-markdown.ts --vault ../../vault --output ../../ts-content --db ../../db` (deps borrowed read-only from a sibling `node_modules`; no install in the worktree).
4. Diff the two `*.md`/`*.mdx` trees: file-set comparison + byte comparison of every common file.

## Measured parity

Real vault snapshot (`dwarvesf/brainery`, 687 source `.md` files):

| Metric                      | Result               |
| --------------------------- | -------------------- |
| Files emitted (Elixir)      | 655 (`.md` + `.mdx`) |
| Files emitted (TS)          | 655                  |
| Files only in Elixir output | 0                    |
| Files only in TS output     | 0                    |
| Common files                | 655                  |
| **Byte-identical**          | **655 / 655**        |
| **Byte-parity**             | **100.00%**          |

The 687 -> 655 reduction (Elixir and TS identically) is the frontmatter gate + `.export-ignore`

- root `home.md`/`index.md` skip removing files that do not export.

Determinism: the Elixir oracle is deterministic run-to-run (verified: a second full export
produced a 0-file self-diff). The TS port uses Node's deterministic sorted directory order.
Because the arity-drop fix removes the only links that fed the order-sensitive fuzzy resolver
on ambiguous short keys, the port is order-independent in practice and matches the oracle
under normal (sorted) traversal, no order-pinning needed. A debug hook (`N2_ORDER_FILE`) can
pin the traversal order for future re-verification.

## Scope edges (the honest gap list)

None of these block the 100% markdown byte-parity above; they are the parts of the Elixir
task deliberately not carried into the content port, with why.

| Item                                                                                          | Ported?           | Why                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Per-file markdown transforms (links, slugs, dsql, katex, frontmatter gate, ignore, path/slug) | **Yes**           | the actual compiler; 100% byte-parity                                                                                                                                                                                                                                                                                                |
| Asset-folder copy (`export_assets_folder`)                                                    | **Yes**           | byte-identical file copies, no transform; a plain recursive copy with slugified names. Ported for the CI cutover (load-bearing: `public/` is served statically, exported markdown links point at these slugified asset paths). Verified byte-identical against the Elixir oracle (1222/1222 files), not just excluded from the diff. |
| `db/` directory copy (`export_db_directory`)                                                  | **Yes**           | same, a copy of the git-committed parquet artifacts into `public/content/db/`. Ported alongside the asset copy for full parity, though nothing in the TS/Next layer actually reads `public/content/db/` (every `generate-*.ts` script reads repo-root `db/vault.parquet` directly). Verified byte-identical (5/5 files).             |
| Incremental cache (`.memo_export_cache.json`)                                                 | No                | a re-run optimization (size/mtime/md5 skip). A clean CI build processes every file, so the cache changes nothing about the OUTPUT. Omitting it keeps the port simple; a full rebuild is the CI norm anyway.                                                                                                                          |
| `mix duckdb.export` (parquet + embeddings regen)                                              | No (out of scope) | a separate DuckDB/embeddings pipeline, not the markdown compiler; needs paid embedding providers; run only by manual `workflow_dispatch`. Its gap was already named in `build-inventory.md`.                                                                                                                                         |
| Verbose `IO.puts` progress lines                                                              | No                | stdout debug noise, not part of the on-disk output being compared.                                                                                                                                                                                                                                                                   |

## CI cutover (done)

`.github/workflows/publish-pages.yml` now runs `tsx scripts/export-markdown.ts --vault
vault --output public/content --db db` instead of the Elixir setup + `mix export_markdown`.
The Elixir setup-beam step, mix deps cache, and `mix compile`/`mix export_markdown` steps
are removed from that workflow; the DuckDB CLI setup step stays (both compilers shell out
to the same `duckdb` binary for `dsql` blocks). `lib/obsidian-compiler/` itself is **not**
deleted, it stays in the tree as a reference/rollback path and for `dispatch.yml`'s
separate `mix duckdb.export` task (a different Mix task, unrelated to markdown export,
still Elixir, untouched by this cutover).

Two things surfaced while wiring this in, both fixed in the same change:

1. **Asset + db directory copy were ported.** The original port only covered the
   per-file markdown transform (see Scope edges above, now updated); it did not copy
   vault `assets/` folders or the repo-root `db/` directory into `public/content/`, both
   of which `mix export_markdown` does as part of the same run. Skipping this would have
   broken every embedded image on the deployed site (`public/` is served statically).
   Ported faithfully from `Memo.ExportMarkdown.export_assets_folder`/`copy_directory`/
   `export_db_directory`, verified byte-identical against the Elixir oracle.
2. **`replacePathPrefix` had a real bug in the invocation mode CI needs.** When called
   with a path that does not start with `../` (i.e. exactly the "run from repo root"
   mode this script's own header comment documents as supported, and what CI uses), the
   function resolved to an absolute path before slugifying. `slugifyPath`/
   `slugifyDirectory` then slugified every segment of that absolute path, including the
   whole cwd chain, scattering every exported file into a bogus nested directory instead
   of the intended output tree. This branch is never exercised by Elixir in production
   (`mix` only ever runs from `lib/obsidian-compiler` with the "../../"-prefixed default
   args, so the equivalent `Path.expand` branch in `export_markdown.ex` is dead code in
   practice too), which is why the original 655/655 parity verification never caught it,
   it was run in the "../../vault"-relative mode, not the repo-root mode CI needs. Fixed
   by always returning the plain relative path; re-verified full parity after the fix.

## Independent re-verification (2026-08-12, CI cutover)

Re-ran both compilers against the real vault submodule (`bc8945d9`, 687 source files) as
part of wiring the CI cutover, this time diffing the FULL output tree (markdown, assets,
and db), not just `*.md`/`*.mdx`:

| Comparison               | Result                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------ |
| Markdown/mdx files (655) | 100% byte-identical (confirms the original claim still holds)                                          |
| Asset files (1222)       | 100% byte-identical (new: not covered by the original claim)                                           |
| db files (5)             | 100% byte-identical (new: not covered by the original claim)                                           |
| Full tree (1883 files)   | Identical except the Elixir-only `.memo_export_cache.json` (intentionally not ported, see Scope edges) |

## Reproduce

```
# oracle
cd lib/obsidian-compiler && mix deps.get && mix compile
mix export_markdown --vault ../../vault --output ../../public/content
# port
cd .. && tsx scripts/export-markdown.ts --vault vault --output ts-content --db db
# diff *.md/*.mdx trees, byte-compare every common file  (expect 655/655 identical)
# unit guards
pnpm exec vitest run test/export-markdown.test.ts
```
