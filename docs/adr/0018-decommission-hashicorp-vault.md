# ADR: Decommission HashiCorp Vault

## Status

Accepted

## Context

Secrets used to be fetched at runtime from a HashiCorp Vault instance. The repo reached it through the `node-vault` package, a set of `VAULT_*` environment variables, and Vault build arguments baked into both Dockerfiles. The Elixir compiler additionally used Vault as a fallback source for the Gemini API key when the environment variable was absent.

The Vault instance has been shut down. Every code path that reached for it was therefore either dead or a latency cost on the way to a failure, and the container images were still declaring build arguments for a service that no longer answers.

## Decision

Remove HashiCorp Vault from the repo completely.

| Surface                                   | Before                         | After                                  |
| ----------------------------------------- | ------------------------------ | -------------------------------------- |
| Node dependency                           | `node-vault`                   | removed                                |
| GCS credentials (`src/lib/storage.ts`)    | Vault-provided key and secret  | Google Application Default Credentials |
| GCS bucket name                           | Vault                          | `LANDING_ZONE_GCS_BUCKET` env var      |
| Gemini key lookup (`Memo.Common.AIUtils`) | env var, falling back to Vault | env var only                           |
| `Dockerfile`, `Dockerfile.legacy`         | Vault `ARG` and `ENV`          | removed                                |

GCS now follows Google's standard credential chain, so it resolves through `GOOGLE_APPLICATION_CREDENTIALS`, an interactive `gcloud` login, or the workload identity of the host, whichever is present. This is the same mechanism the Google client library uses by default, so there is nothing bespoke to maintain.

Everything else reads a plain environment variable, supplied in CI as a repo secret.

Two categories of secret were deliberately left in place in the repository settings:

- The five `VAULT_*` secrets. They are dead. Nothing reads them.
- `ENCRYPTED_WALLET_PRIVATE_KEY`. This is **permanently undecryptable**. It was encrypted with Vault's Transit engine, and that key died with the instance. There is no recovery path.

Deleting them is a separate cleanup decision and was not bundled into this change.

## Consequences

### Positive

- One fewer runtime dependency and one fewer network round trip on the credential path.
- Container images no longer carry build arguments for a decommissioned service.
- Credential resolution is now a documented, standard mechanism rather than a bespoke fallback chain.

### Costs and risks

- Anyone running GCS-touching code locally must now have ADC configured. A missing credential surfaces as a Google client error at call time rather than a Vault error at startup.
- `ENCRYPTED_WALLET_PRIVATE_KEY` is a tombstone. Do not write code that depends on it, and do not assume it can be rotated back into use. If that wallet is still needed, it has to be re-provisioned from its original source.
- The dead `VAULT_*` secrets remain visible in the repository settings and may mislead. Treat their presence as history, not configuration.

## Verification

Search the repository, excluding the content submodule, for `node-vault`, `VAULT_ADDR`, `VAULT_TOKEN`, and related identifiers. The only remaining matches should be explanatory comments in `src/lib/storage.ts` and `Memo.Common.AIUtils` recording that the fallback was removed, plus this record.
