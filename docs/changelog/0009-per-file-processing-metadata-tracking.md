# Enhancement: Per-File Processing Metadata Tracking

## Overview

Significantly enhanced the memo export system's processing metadata tracking by implementing per-file tracking instead of a single global timestamp. The `processing_metadata.parquet` file now contains detailed information for each processed file, enabling better tracking, filtering, and analysis.

## What Changed

### Before: Global Timestamp Approach

```sql
-- Old schema
CRETE TABLE processing_metadata (
  id INTEGER PRIMARY KEY DEFAULT 1,
  last_processed_at TIMESTAMP
);
```

- Single row with global timestamp
- Limited visibility into individual file processing
- Difficult to debug or analyze processing patterns
- Coarse-grained incremental processing

### After: Per-File Metadata Tracking

```sql
-- New schema
CREATE TABLE processing_metadata (
  file_path TEXT PRIMARY KEY,
  last_processed_at TIMESTAMP,
  git_commit_timestamp TIMESTAMP,
  processing_status VARCHAR DEFAULT 'processed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

- One row per file with comprehensive metadata
- Rich tracking and analysis capabilities
- Git integration for accurate timestamping
- Status tracking for operational visibility

## New Capabilities

### Enhanced Processing Metadata Export

The `processing_metadata.parquet` file now contains:

| Field                  | Type      | Description                                 |
| ---------------------- | --------- | ------------------------------------------- |
| `file_path`            | TEXT      | Relative path of the processed file         |
| `last_processed_at`    | TIMESTAMP | When the file was last processed            |
| `git_commit_timestamp` | TIMESTAMP | Git commit timestamp of the file            |
| `processing_status`    | VARCHAR   | Processing status (processed, failed, etc.) |
| `created_at`           | TIMESTAMP | When tracking started for this file         |
| `updated_at`           | TIMESTAMP | When metadata was last updated              |

### Rich Analysis Queries

Users can now perform detailed analysis:

```sql
-- Files processed in the last hour
SELECT file_path, last_processed_at
FROM processing_metadata
WHERE last_processed_at > NOW() - INTERVAL 1 HOUR;

-- Files needing reprocessing (Git newer than processing)
SELECT file_path, git_commit_timestamp, last_processed_at
FROM processing_metadata
WHERE git_commit_timestamp > last_processed_at;

-- Processing frequency analysis
SELECT file_path,
       DATEDIFF('day', created_at, updated_at) as days_tracked,
       last_processed_at
FROM processing_metadata
ORDER BY updated_at DESC;

-- Correlate with vault data
SELECT v.title, v.tags, pm.last_processed_at, pm.processing_status
FROM vault v
JOIN processing_metadata pm ON v.file_path = pm.file_path
WHERE pm.processing_status = 'processed'
ORDER BY pm.last_processed_at DESC;
```

## Use Cases Enabled

### 1. Processing Analytics

- **Track processing patterns**: Identify which files are processed most frequently
- **Performance monitoring**: Monitor processing times and identify bottlenecks
- **Status reporting**: Generate reports on processing success rates

### 2. Operational Debugging

- **Failed processing identification**: Quickly find files that failed to process
- **Incremental processing verification**: Verify which files were included in each run
- **Git sync analysis**: Compare Git timestamps with processing timestamps

### 3. Content Management

- **Stale content detection**: Find files that haven't been processed recently
- **Update tracking**: Monitor when specific files were last updated
- **Audit trails**: Maintain complete processing history per file

### 4. Export Analysis

- **Filtering by processing time**: Filter exports by when files were processed
- **Cross-reference data**: Join vault data with processing metadata
- **Time-based analysis**: Analyze content changes over time

## Example Workflows

### Monitoring Recent Changes

```sql
-- Files processed today with their content
SELECT
    v.file_path,
    v.title,
    v.tags,
    pm.last_processed_at,
    pm.git_commit_timestamp
FROM vault v
JOIN processing_metadata pm ON v.file_path = pm.file_path
WHERE pm.last_processed_at >= CURRENT_DATE
ORDER BY pm.last_processed_at DESC;
```

### Finding Outdated Content

```sql
-- Files that haven't been processed in a week
SELECT
    file_path,
    last_processed_at,
    processing_status,
    DATEDIFF('day', last_processed_at, NOW()) as days_since_processing
FROM processing_metadata
WHERE last_processed_at < NOW() - INTERVAL 7 DAY
ORDER BY last_processed_at ASC;
```

### Git Sync Verification

```sql
-- Files where Git is newer than processing (need reprocessing)
SELECT
    file_path,
    git_commit_timestamp,
    last_processed_at,
    DATEDIFF('hour', last_processed_at, git_commit_timestamp) as hours_behind
FROM processing_metadata
WHERE git_commit_timestamp > last_processed_at
ORDER BY hours_behind DESC;
```

## Migration and Compatibility

### Automatic Migration

- **Zero downtime**: Existing installations automatically migrate to the new schema
- **Backward compatibility**: All existing functionality continues to work
- **Preserved behavior**: Incremental processing behavior remains unchanged

### Compatibility Layer

- The system maintains backward compatibility by using `MIN(last_processed_at)` as a fallback global timestamp
- Existing scripts and workflows continue to function
- New capabilities are additive, not breaking

## Performance Improvements

### Optimized Database Operations

- **Indexed queries**: Added index on `last_processed_at` for fast temporal queries
- **Batch processing**: Metadata updates processed in batches of 50 files
- **Efficient upserts**: Atomic `ON CONFLICT` operations for reliability

### Scalability Enhancements

- **O(1) lookups**: Primary key on `file_path` ensures constant-time access
- **Minimal overhead**: Per-file tracking adds negligible processing time
- **Efficient storage**: Compact schema design minimizes storage impact

## Integration with Git Timestamps

This enhancement builds on the Git timestamp integration (ADR-0013) to provide:

- **Accurate change detection**: Git commit timestamps stored alongside processing times
- **Cross-validation**: Compare processing timestamps with actual Git history
- **Sync verification**: Identify files that need reprocessing based on Git changes

## Developer Benefits

### Enhanced Debugging

```sql
-- Debug processing issues
SELECT
    file_path,
    processing_status,
    last_processed_at,
    updated_at
FROM processing_metadata
WHERE processing_status != 'processed'
ORDER BY updated_at DESC;
```

### Processing Statistics

```sql
-- Processing success rate
SELECT
    processing_status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM processing_metadata
GROUP BY processing_status;
```

## Future Enhancements

The new schema enables future capabilities:

1. **Error Tracking**: Store specific error messages and failure reasons
2. **Processing Duration**: Track how long each file takes to process
3. **Retry Logic**: Implement intelligent retry mechanisms based on processing history
4. **Alerting**: Notify when files haven't been processed for extended periods
5. **Analytics Dashboard**: Rich visualizations of processing patterns and trends

## Impact on Exports

### Enhanced Parquet Files

- **processing_metadata.parquet**: Now contains actionable per-file data instead of single global timestamp
- **Rich analysis**: Enables sophisticated analysis of processing patterns
- **Cross-referencing**: Easy to correlate with vault.parquet data using file_path

### Query Examples for Exported Data

```python
# Python example using pandas
import pandas as pd

# Load the parquet files
vault_df = pd.read_parquet('vault.parquet')
processing_df = pd.read_parquet('processing_metadata.parquet')

# Join vault data with processing metadata
merged_df = vault_df.merge(processing_df, on='file_path', how='left')

# Analyze recent changes
recent_changes = merged_df[
    merged_df['last_processed_at'] > pd.Timestamp.now() - pd.Timedelta(days=1)
]

# Find files that need reprocessing
needs_reprocessing = merged_df[
    merged_df['git_commit_timestamp'] > merged_df['last_processed_at']
]
```

## Summary

This enhancement transforms the processing metadata from a simple global timestamp into a comprehensive per-file tracking system. Users can now:

- **Track individual files**: Know exactly when each file was processed
- **Analyze patterns**: Understand processing behavior and identify issues
- **Reference in exports**: Use file_path to correlate data across parquet files
- **Monitor system health**: Get detailed visibility into processing status
- **Debug efficiently**: Quickly identify and resolve processing issues

The change is fully backward compatible and adds significant value for users who need to understand and analyze their content processing workflows.
