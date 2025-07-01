# ADR: Per-File Processing Metadata Tracking

## Status

Accepted

## Context

The memo export system previously used a single global `last_processed_at` timestamp to track incremental processing across all files. This approach had several limitations:

### Problems with Global Timestamp Approach

1. **Coarse Granularity**: A single timestamp for all files meant that if processing failed for some files, we couldn't track which specific files were successfully processed.

2. **Limited Tracking Information**: Only tracked when processing occurred, not which files were processed or their Git commit information.

3. **Poor Export Reference**: No way to reference specific files in the processing metadata parquet export for analysis or debugging.

4. **Incomplete Audit Trail**: Difficult to understand processing history for individual files.

### User Request

The user specifically requested:

> "For `processed_metadata` parquet file should have file_path along with latest processed time to easier tracking, and for filtering export to reference"

## Decision

Replace the global timestamp approach with per-file processing metadata tracking that includes:

- **file_path**: Primary key for tracking individual files
- **last_processed_at**: When the file was last processed
- **git_commit_timestamp**: The Git commit timestamp of the file
- **processing_status**: Current status (e.g., 'processed', 'failed', 'skipped')
- **created_at**: When the metadata record was first created
- **updated_at**: When the metadata record was last updated

### New Schema

```sql
CREATE TABLE processing_metadata (
  file_path TEXT PRIMARY KEY,
  last_processed_at TIMESTAMP,
  git_commit_timestamp TIMESTAMP,
  processing_status VARCHAR DEFAULT 'processed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_processing_metadata_last_processed_at
ON processing_metadata(last_processed_at);
```

## Implementation

### Key Changes

1. **Schema Migration**: Updated `create_processing_metadata_table()` to use the new per-file schema

2. **Global Timestamp Compatibility**: Modified `fetch_last_processed_timestamp()` to get the minimum timestamp from all files for backward compatibility

3. **Per-File Metadata Functions**:
   - `fetch_file_processing_metadata(file_paths)`: Retrieves metadata for specific files
   - `update_file_processing_metadata(processed_files)`: Updates metadata after processing
   - `update_batch_processing_metadata(file_paths, ts_string)`: Batch updates with Git timestamps

4. **Processing Integration**: Modified the main processing flow to return processed files and update their metadata

### Backward Compatibility

The system maintains backward compatibility by:

- Using `MIN(last_processed_at)` as a fallback global timestamp
- Gracefully handling missing metadata for new installations
- Preserving existing incremental processing behavior

## Benefits

### Enhanced Tracking Capabilities

1. **Granular File Tracking**: Know exactly which files were processed when
2. **Git Integration**: Store Git commit timestamps alongside processing timestamps
3. **Status Tracking**: Track processing status per file (processed, failed, etc.)
4. **Audit Trail**: Complete history of file processing with creation and update timestamps

### Improved Export Analysis

1. **Better Parquet Export**: The `processing_metadata.parquet` file now contains actionable per-file data
2. **Filtering Capabilities**: Easy to filter and analyze processing patterns by file
3. **Reference Data**: Can correlate vault data with processing metadata using file_path

### Operational Benefits

1. **Debugging**: Easier to identify which files had processing issues
2. **Performance Analysis**: Track processing times and patterns per file
3. **Incremental Processing**: More precise incremental processing decisions
4. **Monitoring**: Better visibility into system processing behavior

## Example Queries

With the new schema, users can perform rich analysis:

```sql
-- Files processed in the last hour
SELECT file_path, last_processed_at
FROM processing_metadata
WHERE last_processed_at > NOW() - INTERVAL 1 HOUR;

-- Files where Git timestamp is newer than last processing
SELECT file_path, git_commit_timestamp, last_processed_at
FROM processing_metadata
WHERE git_commit_timestamp > last_processed_at;

-- Processing frequency by file
SELECT file_path,
       COUNT(*) as process_count,
       MIN(created_at) as first_processed,
       MAX(updated_at) as last_processed
FROM processing_metadata
GROUP BY file_path;

-- Files that haven't been processed recently
SELECT file_path, last_processed_at
FROM processing_metadata
WHERE last_processed_at < NOW() - INTERVAL 1 DAY
ORDER BY last_processed_at;
```

## Migration Notes

### Automatic Migration

- Existing installations will automatically migrate to the new schema
- Old global timestamp data is preserved through the MIN() compatibility layer
- No manual intervention required

### Data Preservation

- All existing processing behavior continues to work
- Incremental processing logic remains the same
- Export functionality enhanced but not breaking

## Performance Considerations

### Optimizations

1. **Indexed Queries**: Added index on `last_processed_at` for fast temporal queries
2. **Batch Processing**: Process metadata updates in batches of 50 files
3. **Efficient Upserts**: Use `ON CONFLICT` for atomic upsert operations

### Scalability

- Primary key on `file_path` ensures O(1) lookups
- Batch processing prevents database overload
- Minimal overhead compared to global timestamp approach

## Future Enhancements

The new schema enables future features:

1. **Processing Statistics**: Track processing duration, success rates
2. **Error Tracking**: Store error messages and failure reasons
3. **Retry Logic**: Implement smart retry based on processing history
4. **Analytics Dashboard**: Rich visualizations of processing patterns
5. **Alerting**: Notify when files haven't been processed for extended periods

## Consequences

### Positive

- **Better User Experience**: Users can now easily track and analyze file processing
- **Enhanced Debugging**: Granular visibility into processing behavior
- **Future-Proof**: Schema supports advanced features and analytics
- **Export Value**: Processing metadata parquet file becomes much more useful

### Considerations

- **Storage Overhead**: Per-file metadata requires more storage than single timestamp
- **Complexity**: Slightly more complex queries and processing logic
- **Migration**: Existing systems need to understand the new schema

### Mitigation

- Storage overhead is minimal compared to benefits
- Backward compatibility ensures smooth transitions
- Clear documentation and examples provided

## References

- User request for file_path in processing metadata
- Git timestamp integration (ADR-0013)
- Incremental processing architecture
- DuckDB parquet export capabilities
