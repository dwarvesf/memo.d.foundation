# Content source-of-truth (memo-track CF-N.3)

Two halves. The submodule-ingest robustness half is BUILT and verified below. The
Notion-authoring half is a FINGERPRINT only, gated on a Notion sandbox that does not
exist yet, per the goal contract's minimum-infra-first rule.

## 1. Current source of truth: git vault via submodule

```
memo.d.foundation (.gitmodules: vault -> dwarvesf/brainery)
  vault/                       Obsidian markdown, technical content
    handbook/    (submodule -> dwarvesf/handbook)
    playbook/    (submodule -> dwarvesf/playbook)
    research/    (submodule -> dwarvesf/research, ~500MB, by far the heaviest leaf)
    careers/     (submodule -> dwarvesf/WeAreHiring)
    radar/       (submodule -> dwarvesf/radar)
    opensource/  (submodule -> dwarvesf/opensource)
      auto-dnd, blurred, code-viewer, github-agent, go-threads, hidden,
      llm-hosting, micro-sniff, mochi-ui, react-toolkit, session-buddy,
      sudo-fm-macos   (12 further nested submodules, one per showcased project)
```

There is no Notion involvement anywhere in this chain today; every note in memo lands
by editing a markdown file in one of these git repos.

Two independent consumers of the checked-out tree:

- **CI build** (`generate-redirects.yml`, `publish-pages.yml`, `add-mint-post.yml`,
  `deploy-arweave.yml`): all use
  `actions/checkout@v4` with `submodules: recursive` (`secrets.DWARVES_PAT` has since
  been dropped from every checkout). This is the robust path: if a submodule fetch fails,
  the checkout step itself fails and the job goes red. Nobody has to notice a silent
  partial checkout here.
- **Local dev / manual reindex** (`make fetch`, `make fetch-force` -> `git-fetch.sh`):
  a hand-rolled SSH-then-HTTPS-fallback loop, not used by any CI workflow. This is
  where the actual fragility lived (below).
- **`.github/workflows/dispatch.yml`** ("Update submodules"): `workflow_dispatch`
  only, no schedule. Runs `pnpm run generate-summary` + `duckdb-export` (embeddings,
  `db/vault.parquet`) against whatever the recursive submodule checkout resolves to,
  then commits the result back. Already flagged manual-only + fragile by the #302
  inventory; see `## Known gap not fixed here` below. **SUPERSEDED**: this workflow
  is deleted. The reindex is a stage of `scripts/build-and-deploy.sh`, called by
  `publish-pages.yml`; `generate-summary` was not carried over.

## 2. The fragility: what DF-120 found, what was already fixed, what wasn't

DF-120 traced `dispatch.yml` failing since 2026-06-23 to three dead nested submodule
pointers three levels down the chain (`memo -> vault -> opensource -> {dotfiles,
yggdrasil, glod}`, all 404: two deleted repos, one migrated to a private personal
repo `actions/checkout` has no access to). The repair PR,
[`dwarvesf/opensource#1`](https://github.com/dwarvesf/opensource/pull/1), removed the
three dead entries and **is merged**. Confirmed live in this branch: a full recursive
`git submodule update --init --recursive` now resolves and checks out all 19
submodules (6 under `vault`, 12 more under `vault/opensource`) with no 404s.

That fixes the specific dead-repo incident. It does not fix the class of bug: nothing
in `git-fetch.sh` would have told anyone the tree was broken in the first place.
Reading it closely:

- The SSH->HTTPS retry logic (`try_https_fallback`, invoked via
  `git submodule foreach 'try_https_fallback "$PWD"'`) never checks its own exit
  code, so a submodule failing on BOTH transports is swallowed.
- Every per-submodule checkout/pull step is deliberately `|| true` / `|| echo
"Failed to ..."` so one dead submodule doesn't abort the whole tree (fine, by
  design, for resilience) -- but the script itself never turns any of that into a
  final non-zero exit. `make fetch` always returned 0, dead submodules or not.

That is the actual bug this sub-goal fixes: **the fail-loud gap**, not the specific
404s (already closed upstream).

### Fix: `scripts/verify-submodules.sh` + a tripwire at the end of `git-fetch.sh`

A small script that runs `git submodule status --recursive` and fails (exit 1,
naming every offending path on stderr) if any line is uninitialized (`-`) or
checked out at the wrong commit (`+`) versus the superproject's pin. `git-fetch.sh`
now pipes its own final `git submodule status --recursive` through it
unconditionally, on both the "did an update" and the "cache still warm" branches, so
`make fetch` can no longer report success while `vault/` is actually broken or
partially cloned.

Verified (`docs/cf-migration/content-sot.md` companion proof, not duplicated here,
see the PR for the full transcript):

- **Positive control**: real repo state, all 19 submodules resolved -> `All
submodules verified OK (19 checked)`, exit 0.
- **Negative control**: synthetic `-`/`+` lines fed to the script (mirroring an
  uninitialized submodule and a stale-checkout submodule) -> exits 1, names the
  broken path on stderr.
- `test/verify-submodules.test.ts` (vitest, 3 cases) pins both controls plus the
  clean case so a regression here fails CI's `pnpm test`, not just a future manual
  `make fetch` run. 73/73 repo tests green after the change (9 files, 3 new).

This is scoped to the fail-loud tripwire only. It does not touch the SSH/HTTPS retry
logic itself (works, just doesn't self-report), and it does not touch
`dispatch.yml`'s recursive checkout depth or the CI workflows (already robust: a
broken `actions/checkout` submodule fetch already fails the job natively).

### Known gap not fixed here

**Closed since.** `dispatch.yml` and `backup.yml` are deleted. The reindex runs as
a stage of `scripts/build-and-deploy.sh` on every publish, so the parquet can no
longer drift from the deployed site, and a dead submodule pointer fails the daily
publish instead of waiting for someone to press a button. The spend concern below
is answered by the exporter's own incremental gate: `needs_embeddings_update` only
re-embeds notes whose content changed. The rest of this section is the record of
the state before that change.

`dispatch.yml` staying `workflow_dispatch`-only (no cron) means a future dead
pointer could sit unnoticed until someone manually re-runs it, exactly like the
2026-06-23 -> now gap did. Making it schedule-driven is a real product decision
(it burns `OPENAI_API_KEY`/embedding-provider spend on every run), not a CI-hygiene
fix, so it's left as a documented gap rather than something this sub-goal decided
unilaterally. `Monitor Vault Parquet`'s scheduled job (`monitor-vault-parquet.yml`)
already exists as a lighter-weight staleness alarm for the parquet side of this; it
was auto-disabled by GitHub's 60-day-inactive-schedule rule per DF-120 and needs a
manual re-enable, tracked there, not here.

## 3. Fingerprint only: Notion authoring for business notes

**Not built.** The megagoal brief for CF-N.3 describes a second content source:
business-facing notes authored in Notion, ingested by the same CI alongside the git
vault, so a non-technical author can publish to memo without touching git. This
needs infrastructure that does not exist in this environment (no dev Notion
workspace, no sandbox to build or test a Notion adapter against), so per
minimum-infra-first it is fingerprinted, not built.

What it would actually take:

1. **A dev Notion workspace** with a database shaped like memo's frontmatter
   contract (title, tags, authors, date, draft flag at minimum -- see
   `docs/cf-migration/build-inventory.md` for the exact fields the downstream
   `generate-*.ts` scripts expect out of `public/content`).
2. **A Notion source adapter** in the ingest pipeline, parallel to the existing
   `vault/` git-submodule path:
   - Pull pages via the Notion API (integration token, scoped to one workspace),
     convert Notion blocks -> the same markdown+frontmatter shape
     `lib/obsidian-compiler` emits from Obsidian markdown today.
   - Land the converted output in `public/content` (or a sibling directory merged
     into it) so every downstream `generate-*.ts` script and the Next.js build stay
     untouched -- the adapter's contract is "produce the same shape", not "rewire
     the build".
   - Decide once designed (not guessed here): incremental sync via Notion's
     `last_edited_time` + a cursor, vs. full pull each CI run. Given `research/`
     alone is ~500MB, a full-pull-every-run posture for Notion content should stay
     cheap by construction (business notes, not a second vault-sized corpus) but
     that assumption needs validating against real workspace size once one exists.
   - Needs its own fail-loud contract, same shape as `scripts/verify-submodules.sh`
     above: a bad/expired integration token or a malformed page should fail the CI
     job, not silently skip that note.
3. **CI wiring**: a new step (or a new job) alongside the existing `actions/checkout
submodules: recursive` step, running the adapter before `make build`/
   `build-static`, with its own secret (`NOTION_TOKEN` or similar) and its own
   Discord failure notification (mirroring `dispatch.yml`'s pattern).
4. **The editorial/promotion-gate question** DF-120 already surfaces for the
   git-vault publish path (`brand/content/promotion_gate.md` has no memo/brainery
   bucket yet) applies here too, and probably needs answering ONCE for both paths
   rather than twice.

This is exactly the shape of a `10-memo-uat`-gated item: it needs a live UAT/deploy
environment (a real Notion workspace, a real CI run against it, a real author
publishing a note end-to-end) to build and verify honestly, which is out of reach
in this run. Tracked as the deps-on-04 half of that row, not attempted here.

## Notes

- All findings above were verified by actually initializing and walking the real
  submodule tree in a scratch worktree (branch `feat/cfm-n3-content-sot`), not read
  cold from `.gitmodules`. `dwarvesf/opensource#1`'s own validation transcript
  (quoted in the PR body) was cross-checked against a live recursive checkout here
  and matches.
- The full recursive clone of `vault` + all nested submodules is legitimately heavy
  (`research` alone is ~500MB) and took long enough locally to threaten a naive
  test's timeout. That's a real cost of the current topology worth knowing about,
  but the actual failures on record (DF-120, dispatch.yml red since 2026-06-23) were
  404s, not timeouts, so no fix for clone weight/depth is proposed here --
  speculative without a second observed timeout-shaped incident.
