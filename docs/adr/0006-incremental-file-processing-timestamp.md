# ADR: Incremental File Processing Using Git History and Modification Timestamps

**Date**: 2025-05-08

**Status**: Proposed

## Context

The current file processing mechanism in `Memo.ExportDuckDB` relies on Git revision markers (`commits_back`) to determine which files to process. While useful for deltas, this approach doesn't cover scenarios where files might be modified without being committed, or when a more persistent incremental processing strategy is desired independent of recent Git history alone.

There's a need to optimize file processing by avoiding reprocessing of files that haven't changed since their last successful processing, especially in a vault with a large number of files.

## Decision

We will implement a two-stage filtering mechanism for determining files to process in `Memo.ExportDuckDB`:

1.  **Initial Git & Pattern Filter**: The existing logic based on the `commits_back` parameter and the file `pattern` will be retained. If `commits_back` is not `:all`, files are first filtered based on Git modification history. Then, the `pattern` is applied.
2.  **Secondary Timestamp Filter**: After the initial filtering, files will be further filtered based on their last modification timestamp (`mtime`). This `mtime` will be compared against a `last_processed_at` timestamp stored in a new DuckDB table named `processing_metadata`. Only files modified _after_ this stored timestamp will be processed.

The `processing_metadata` table will store a single row with the `last_processed_at` timestamp, which will be updated upon successful completion of the export process.

## Consequences

**Positive**:

- Reduces redundant processing of unchanged files, saving CPU cycles and potentially speeding up the export process for large vaults with infrequent changes.
- Provides a more robust incremental processing strategy that isn't solely tied to Git commits.
- The `commits_back` parameter remains useful for users who want to explicitly process only files changed within a specific Git revision range, now further refined by the timestamp.

**Negative/Considerations**:

- Introduces a new database table (`processing_metadata`) and the logic to manage it (creation, reading, updating).
- Relies on the accuracy of file system modification timestamps (`mtime`). These can sometimes be altered by system operations or tools.
- Requires careful handling of timezone conversions for timestamps to ensure accurate comparisons (file mtime vs. stored `last_processed_at`). We will standardize on UTC for stored timestamps and convert file mtimes to UTC for comparison.
- The first run after this change (or if the `processing_metadata` table is cleared) will effectively process all files selected by the Git/pattern filter, as there will be no prior `last_processed_at` timestamp to filter against (or it will be a very old default).

**Implementation Details**:

- A new table `processing_metadata (id INTEGER PRIMARY KEY, last_processed_at TIMESTAMP)` will be created.
- The `run/4` function in `Memo.ExportDuckDB` will fetch `last_processed_at` at the start and update it at the end.
- The `get_files_to_process/4` function will be updated to `get_files_to_process/5`, taking `last_processed_at` as an argument and implementing the mtime comparison.
- Helper functions for mtime conversion to UTC `DateTime` will be used.
