# ADR: Incremental File Processing Using Modification Timestamps

**Date**: 2025-05-08

**Status**: Accepted (Plan B)

## Context

The initial approach to incremental file processing in `Memo.ExportDuckDB` relied on Git revision markers (`commits_back`). This proved problematic in practice, specifically causing unexpected data removal in GitHub Actions workflows.

There is a need for a reliable incremental processing strategy that avoids reprocessing unchanged files in a large vault, independent of Git history for the primary file selection.

## Decision

We will implement a two-stage filtering mechanism for determining files to process in `Memo.ExportDuckDB`:

1.  **Initial Pattern Filter**: Files will be filtered based on the user-provided file `pattern` (defaulting to `**/*.md`) and the `.export-ignore` file. The `commits_back` parameter will be accepted by the `run` function but will be ignored for file selection purposes.
2.  **Secondary Timestamp Filter**: After the initial pattern filtering, files will be further filtered based on their last modification timestamp (`mtime`). This `mtime` will be compared against a `last_processed_at` timestamp stored in a new DuckDB table named `processing_metadata`. Only files modified _after_ this stored timestamp will be processed.

The `processing_metadata` table will store a single row with the `last_processed_at` timestamp, which will be updated upon successful completion of the export process.

## Consequences

**Positive**:

- Provides a more reliable incremental processing strategy compared to the Git-based approach, addressing the bug observed in GitHub Actions.
- Reduces redundant processing of unchanged files, saving CPU cycles and potentially speeding up the export process for large vaults with infrequent changes.
- The `commits_back` parameter is retained in the function signature for backward compatibility but its file filtering effect is removed.

**Negative/Considerations**:

- Introduces a new database table (`processing_metadata`) and the logic to manage it (creation, reading, updating).
- Relies on the accuracy of file system modification timestamps (`mtime`). These can sometimes be altered by system operations or tools.
- Requires careful handling of timezone conversions for timestamps to ensure accurate comparisons (file mtime vs. stored `last_processed_at`). We will standardize on UTC for stored timestamps and convert file mtimes to UTC for comparison.
- The first run after this change (or if the `processing_metadata` table is cleared) will effectively process all files matching the pattern (and not ignored), as there will be no prior `last_processed_at` timestamp to filter against (or it will be a very old default).

**Implementation Details**:

- A new table `processing_metadata (id INTEGER PRIMARY KEY, last_processed_at TIMESTAMP)` has been created.
- The `run/4` function in `Memo.ExportDuckDB` fetches `last_processed_at` at the start and updates it at the end.
- The `get_files_to_process/5` function ignores the `commits_back` parameter for filtering and applies pattern and timestamp filtering.
- Helper functions for mtime conversion to UTC `DateTime` are used.
