# ADR: Replace mtime with Git Timestamps for Incremental Processing

## Status

Accepted

## Context

The memo export system uses incremental processing to avoid reprocessing unchanged files by comparing file modification times (mtime) against a stored `last_processed_timestamp`. However, this approach has a critical flaw when dealing with files fetched from Git repositories:

### Problem

- **Local mtime != Remote modification time**: When files are fetched/synced from Git repositories (like submodules), the local filesystem mtime reflects when the file was written to disk locally, not when it was actually modified in the remote repository.
- **Incorrect filtering**: This causes the system to either:
  - Skip files that were actually updated remotely (false negatives)
  - Process files that haven't changed remotely (false positives)
- **Data inconsistency**: Users reported that files weren't being processed correctly after Git fetches, leading to stale data in the export.

### Original Implementation

```elixir
case File.stat(file_path) do
  {:ok, %{mtime: mtime_tuple}} ->
    case DateTime.from_naive(NaiveDateTime.from_erl!(mtime_tuple), "Etc/UTC") do
      {:ok, file_mtime_utc} ->
        DateTime.compare(file_mtime_utc, last_processed_timestamp) == :gt
    end
end
```

This approach uses filesystem modification time, which is unreliable for Git-managed files.

## Decision

Replace filesystem mtime-based filtering with Git commit timestamp-based filtering to accurately determine when files were last modified in the repository.

### New Implementation

```elixir
defp get_file_last_commit_timestamp(file_path) do
  # Find the appropriate Git repository (main vault or submodule)
  git_root = find_git_root_for_file(containing_dir_abs)
  file_relative_to_git_root = Path.relative_to(file_abs, git_root)

  # Get the last commit timestamp for this file
  case System.cmd("git", [
    "log", "-1", "--format=%cI", "--", file_relative_to_git_root
  ], cd: git_root) do
    {timestamp_str, 0} ->
      DateTime.from_iso8601(String.trim(timestamp_str))
  end
end
```

## Rationale

### Benefits

1. **Accurate Change Detection**: Git commit timestamps reflect the actual time when files were modified in the repository, regardless of when they were fetched locally.

2. **Repository-Aware**: The solution correctly handles both main vault files and Git submodules by finding the appropriate Git root for each file.

3. **Resilient to Git Operations**: File timestamps remain consistent across:
   - `git pull` operations
   - `git submodule update` operations
   - Repository cloning
   - File system operations

4. **Backward Compatible**: The change maintains the same interface and doesn't affect the database schema or other components.

### Technical Details

- Uses `git log -1 --format=%cI` to get the ISO8601 commit timestamp of the last commit that modified each file
- Handles both main repository and Git submodule files by dynamically finding the correct Git root
- Includes fallback logic for files that might not have Git history
- Maintains error handling and logging for debugging

### Safety Measures

- **Graceful Degradation**: If Git timestamp cannot be determined, the file is included for processing (safer approach)
- **Error Logging**: Detailed error messages help with debugging timestamp issues
- **Fallback Strategy**: Attempts to get first commit timestamp if latest commit lookup fails

## Consequences

### Positive

- **Reliable Incremental Processing**: Files are now correctly identified as changed/unchanged based on actual repository history
- **Improved Data Consistency**: Export data will be more accurate and up-to-date
- **Better Git Integration**: The system now properly understands Git-managed file lifecycles
- **Submodule Support**: Correctly handles files in Git submodules

### Considerations

- **Git Dependency**: The system now requires Git to be available and properly configured
- **Performance**: Git operations have some overhead, but this is acceptable for the accuracy gained
- **Error Handling**: Need to handle cases where Git history is not available or corrupted

### Migration

No data migration is required. The change is transparent to existing users and databases.

## Implementation Notes

### Key Functions Added

- `get_file_last_commit_timestamp/1`: Gets Git commit timestamp for a file
- `find_git_root_for_file/1`: Finds appropriate Git repository root

### Error Handling Strategy

- Include files for processing if Git timestamp cannot be determined
- Log warnings for debugging but don't fail the entire process
- Provide clear error messages for troubleshooting

## References

- Original issue: "Use mtime here seem not correct with fetched files, because of the time indicate for local files were not matched with remote file"
- Git documentation: `git log --format` options
- DateTime handling in Elixir: `DateTime.from_iso8601/1`
