# ADR: Move AI Text Generation to opencode-go and Gate Embeddings Off

## Status

Accepted

## Context

Scope: this record covers the AI calls made by the parquet reindex. It does not cover the markdown linter's sentence-case rule (`scripts/formatter/rules/sentence-case.ts`), which calls OpenRouter and is unchanged.

The parquet reindex called two classes of AI service, and they were treated as one concern:

- **Text generation.** SPR summaries and the `keywords` list, produced by Google `gemini-2.5-flash` through the Gemini API.
- **Embeddings.** Two vector columns, `embeddings_gemini` (768 dimensions, Gemini) and `embeddings_spr_custom` (1024 dimensions, Jina).

Both were paid, metered providers. `docs/cf-migration/build-inventory.md` records the consequence: the reindex was never run as part of routine validation, it fires only on a manual `workflow_dispatch`, and the committed parquet was left months stale as a result.

The embeddings turned out to be dead weight. Nothing reads them:

- Site search is MiniSearch, purely lexical, built from `scripts/generate-search-index.ts`.
- No component under `src/` and no Cloudflare Pages Function reads either vector column.
- The D1 export carries a `missing_embeddings` count as a health metric. It does not carry the vectors.

So the build was paying a metered embedding bill on every reindex to populate columns that no consumer queries.

## Decision

Split the two concerns and treat them differently.

**Text generation moves to opencode-go**, an OpenAI-compatible endpoint, on a flat-rate tier.

| Setting   | Value                                            |
| --------- | ------------------------------------------------ |
| Endpoint  | `https://opencode.ai/zen/go/v1/chat/completions` |
| Model     | `deepseek-v4-flash`                              |
| Key       | `OPENCODE_GO_API_KEY`                            |
| Overrides | `OPENCODE_GO_BASE_URL`, `OPENCODE_GO_MODEL`      |

A flat-rate tier removes the per-call cost pressure, which is what made the reindex something to avoid running. A missing or empty key degrades to an empty result rather than raising, so the export never crashes on a credential problem.

This is implemented twice, in `scripts/duckdb-export.ts` and in `Memo.Common.AIUtils`, because the Elixir task is retained as the export's verification oracle. The two must stay in step.

**Embeddings become opt-in.** Both vector columns are carried forward from the existing row unless `MEMO_EMBEDDINGS` is set to `1` or `true`.

```
  reindex a note
      |
      +--> summary + keywords ---> opencode-go        [always, flat rate]
      |
      +--> embeddings
              MEMO_EMBEDDINGS unset  ---> carry forward existing vectors   [default]
              MEMO_EMBEDDINGS=1      ---> Elixir oracle regenerates
                                          TypeScript exporter throws
```

The TypeScript exporter does not implement live embedding generation. If the gate is set, it fails loud rather than silently writing nulls into the columns. Regeneration remains possible only through the Elixir oracle.

Note that Gemini has not disappeared. It is no longer used for text generation, but `embed_gemini` and `GEMINI_API_KEY` remain on the oracle's embedding path, reachable only behind the gate.

## Consequences

### Positive

- Reindex cost becomes predictable, which lowers the barrier to running it more often.
- A default reindex makes no embedding calls at all.
- The columns and their carry-forward behaviour are preserved, so no data is lost and a future semantic-search feature can turn the gate back on.
- A missing generation key no longer breaks an export.

### Costs and risks

- The vector columns are now dormant schema. Any row created while the gate is off has null vectors, so the column is not uniformly populated. Check for nulls before building anything on it.
- Regenerating embeddings requires dropping back to the Elixir oracle, which is the component being retired. Whoever revives semantic search will have to port live embedding generation first.
- Generation quality now depends on a different model. The prompt is unchanged, but output wording will differ from the Gemini era.
- The generation logic exists in two languages and will drift without discipline.

## Verification

`lib/obsidian-compiler/test/ai_utils_test.exs` covers the missing-key degradation path. Run the Elixir tests from `lib/obsidian-compiler/`:

```sh
mix test
```

To confirm nothing consumes the vectors, search the application and function source for the column names; the only hits should be the exporter, its tests, the parquet health monitor, and documentation.
