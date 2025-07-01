# ADR: Fix DuckDB Timestamp Parsing Issue

## Status

Accepted

## Context

The Elixir code in `fetch_file_processing_metadata/1` was failing to parse timestamps retrieved from DuckDB, always returning `nil` values. The issue was discovered when processing file metadata showed:

```
Processing file: %{last_processed_at: nil, git_commit_timestamp: nil, processing_status: "migrated"}
```

Even though the database contained valid timestamps like `2025-07-01 02:38:18`.

## Problem

The root cause was a format mismatch between DuckDB's timestamp storage format and Elixir's parsing expectations:

1. **DuckDB stores timestamps** in format: `"2025-07-01 02:38:18"` (space-separated, no timezone)
2. **Elixir's `DateTime.from_iso8601/1`** expects: `"2025-07-01T02:38:18Z"` (T-separated with timezone)
3. **Original parsing logic** was converting successfully parsed `DateTime` structs to date strings, losing time information
4. **Later comparison code** expected `DateTime` structs for `DateTime.compare/2` operations

## Decision

Implemented a robust timestamp parsing solution:

### 1. Fixed Return Type

```elixir
# Before (incorrect)
case DateTime.from_iso8601(ts_str) do
  {:ok, datetime, _offset} -> Date.to_string(DateTime.to_date(datetime))  # ❌ Lost time info
  {:error, _} -> nil
end

# After (correct)
case DateTime.from_iso8601(ts_str) do
  {:ok, datetime, _offset} -> datetime  # ✅ Keep DateTime struct
  {:error, _} -> nil
end
```

### 2. Added Universal Timestamp Parser

```elixir
defp parse_timestamp(ts_str) when is_binary(ts_str) and ts_str != "" do
  # First try ISO8601 format (e.g., "2025-07-01T02:38:18.000Z")
  case DateTime.from_iso8601(ts_str) do
    {:ok, datetime, _offset} ->
      datetime

    {:error, _} ->
      # Try DuckDB's "YYYY-MM-DD HH:MM:SS" format, assuming UTC
      try do
        # Convert "YYYY-MM-DD HH:MM:SS" to "YYYY-MM-DDTHH:MM:SS"
        naive_dt_str = String.replace(ts_str, " ", "T")
        naive_dt = NaiveDateTime.from_iso8601!(naive_dt_str)
        DateTime.from_naive!(naive_dt, "Etc/UTC")
      rescue
        _e ->
          IO.puts("Warning: Could not parse timestamp string: '#{ts_str}'")
          nil
      end
  end
end
```

### 3. Updated Callers

```elixir
parsed_last_processed_at = parse_timestamp(row["last_processed_at"])
parsed_git_commit_timestamp = parse_timestamp(row["git_commit_timestamp"])
```

## Consequences

### Positive

- ✅ **Robust parsing**: Handles both ISO8601 and DuckDB timestamp formats
- ✅ **Preserves precision**: Maintains full `DateTime` structs for accurate comparisons
- ✅ **Backward compatible**: Still works with existing ISO8601 timestamps
- ✅ **Error handling**: Graceful fallback with clear warnings
- ✅ **Type consistency**: Returns `DateTime` structs that work with `DateTime.compare/2`

### Potential Risks

- ⚠️ **Timezone assumption**: DuckDB timestamps are assumed to be UTC
- ⚠️ **Format dependency**: Relies on DuckDB's consistent timestamp format

## Verification

The fix resolves the timestamp parsing issue and enables proper incremental file processing based on Git commit timestamps and processing metadata.

## Implementation Notes

- Applied to both `last_processed_at` and `git_commit_timestamp` fields
- Used throughout the processing metadata system
- Maintains consistency with existing DateTime operations in the codebase
