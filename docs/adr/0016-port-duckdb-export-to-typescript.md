# ADR: Port the DuckDB Export to TypeScript and Retain the Elixir Oracle

## Status

Accepted

## Context

`db/vault.parquet` is the content database every build script reads. It was produced by the Elixir Mix task `mix duckdb.export` in `lib/obsidian-compiler/`.

That left the build split across two toolchains. The downstream artifact layer and the markdown compiler port are TypeScript, but regenerating the parquet still required Elixir, DuckDB, and a devbox shell. The reindex ran only under a manual `workflow_dispatch`, so the parquet drifted stale for long stretches.

The Elixir task also had two behaviours worth naming:

1. It builds every DuckDB statement by string concatenation and shells out to the `duckdb` CLI once per query. A large batch can exceed `ARG_MAX`, and when it does the batch is silently dropped.
2. On the frontmatter-only upsert path it omits `keywords` from its exclusion list, so it overwrites the stored keywords with the frontmatter value, which is almost always absent. Only the embedding-regeneration path ever writes keywords back. An incremental run therefore strips keywords from every note it does not regenerate.

The second is a real defect. `scripts/generate-search-index.ts` indexes `keywords` and boosts it above `spr_content`, so the wipe quietly degrades site search.

## Decision

Port the exporter to `scripts/duckdb-export.ts` and make it the production path. `make duckdb-export` now runs the TypeScript version, and `devbox run duckdb-export` resolves to the same target, so the dispatch workflow picks it up without change.

Keep `mix duckdb.export` in the tree as a **verification oracle**. Nothing in the build calls it. Its only job is to be diffable against the port.

The port is faithful down to the generated SQL text, because several storage quirks fall out of the Elixir's string concatenation: `md_content` keeps literal two-character `\n` sequences, array columns are sorted, and an empty `VARCHAR[]` round-trips as `'[]'`. Reproducing the value serializers rather than using bound parameters is what keeps the parquet byte-comparable.

```
  vault/  --->  scripts/duckdb-export.ts  --->  db/vault.parquet   [PRODUCTION]
                          |
                          |  diff to verify a change
                          v
                mix duckdb.export                                  [ORACLE ONLY]
```

Two deliberate departures from the oracle:

| Behaviour                             | Elixir oracle                   | TypeScript port | Why                                                                                         |
| ------------------------------------- | ------------------------------- | --------------- | ------------------------------------------------------------------------------------------- |
| Oversize query batch                  | silently dropped past `ARG_MAX` | fails loud      | the port uses the in-process engine, so the limit does not exist and silence would be worse |
| `keywords` on frontmatter-only upsert | overwritten, usually to null    | carried forward | the wipe degrades search; fixing it in the port is the point                                |

Live embedding generation is not ported. The legacy `processing_metadata` migration paths are not ported either, because `db/schema.sql` has been on the per-file schema long enough that it cannot regress to the older shape.

## Consequences

### Positive

- Regenerating the parquet no longer needs Elixir or a devbox shell.
- The `keywords` wipe is fixed, so incremental runs stop degrading search relevance.
- An oversize batch now fails visibly instead of dropping rows.
- The oracle stays available, so any future port change can still be proven against a reference implementation.

### Costs and risks

- Two implementations of the same logic exist. They will drift unless the oracle is used. The AI generation path in particular is written twice and has to stay in step or the diff stops meaning anything.
- The port is now the only implementation that is correct on `keywords`. A diff against the oracle will always show that difference; it is expected, not a regression.
- `make duckdb-export-pattern` was not ported and still calls `mix duckdb.export_pattern`.

## Verification

`test/duckdb-export.test.ts` covers the value serializers, the schema contract, and the upsert paths, including the `keywords` carry-forward. Run it with:

```sh
pnpm exec vitest run test/duckdb-export.test.ts
```

For a full behavioural check, run both implementations against the same vault snapshot and compare the resulting parquet.
