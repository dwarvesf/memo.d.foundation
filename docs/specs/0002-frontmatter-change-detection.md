# Specification: Frontmatter Change Detection in DuckDB Export

**Version:** 1.0
**Date:** 2025-05-08

## 1. Introduction

This document outlines the requirements for enhancing the `Memo.ExportDuckDB` process to accurately detect and handle changes made exclusively to the frontmatter (metadata) of Markdown files, ensuring these changes are reflected in the DuckDB database while preserving existing embeddings when content remains unchanged.

## 2. Goals

- Ensure the DuckDB database accurately reflects the latest frontmatter metadata from Markdown files.
- Prevent unnecessary re-embedding when only frontmatter metadata has changed.
- Improve the efficiency and accuracy of the data synchronization process.

## 3. Problem Statement

The current `Memo.ExportDuckDB` process primarily determines whether to update a database record based on changes detected in the main Markdown content (`md_content`). This check (`needs_embeddings_update`) dictates whether embeddings are regenerated and if an update occurs.

This leads to a significant limitation: if a user modifies _only_ the frontmatter fields (e.g., `title`, `tags`, `date`, `pinned`, custom fields) without altering the main content, the existing logic often fails to detect this change. Consequently, the corresponding record in the DuckDB `vault` table is not updated, resulting in stale metadata.

Furthermore, even if a content change triggers an update, the comparison of frontmatter values might be unreliable due to potential differences in data representation between the parsed file (e.g., date as a string) and the database (e.g., date as a DATE type). This lack of robust comparison could lead to missed updates or incorrect change detection.

## 4. Requirements

### 4.1. Independent Frontmatter Comparison

- **REQ-FCD-001:** The system MUST compare the frontmatter data extracted from the current file version against the corresponding frontmatter data stored in the existing DuckDB record.
- **REQ-FCD-002:** This frontmatter comparison MUST occur independently of whether the `md_content` has changed.
- **REQ-FCD-003:** The comparison MUST consider all relevant frontmatter fields defined in `@allowed_frontmatter`, excluding fields derived directly from content (e.g., `md_content`, `spr_content`, `embeddings_*`, `estimated_tokens`).

### 4.2. Robust Value Normalization for Comparison

- **REQ-FCD-010:** Before comparison, values from both the current file's frontmatter and the existing database record MUST be normalized to a canonical representation to handle potential type and format differences.
- **REQ-FCD-011:** Normalization rules MUST be defined and applied for at least the following cases:
  - **Numbers vs. Strings:** Treat numeric values and their string representations as equivalent (e.g., `10` == `"10"`, `10.0` == `"10"`).
  - **Dates:** Convert various date representations (e.g., ISO8601 strings, Date objects) to a single, consistent format (e.g., `"YYYY-MM-DD"`).
  - **Arrays/Lists:** Handle `nil` vs. empty list equivalence (`nil` == `[]`). Ensure order-insensitive comparison for simple lists (e.g., `tags`, `authors`) by sorting elements after normalization.
  - **String Escaping:** Handle potential differences in quote escaping (e.g., `'` vs `''`).
  - **Booleans & Nil:** Compare directly.

### 4.3. Conditional Database Update Logic

- **REQ-FCD-020:** A new flag or state (e.g., `frontmatter_changed`) MUST be determined based on the outcome of the normalized frontmatter comparison.
- **REQ-FCD-021:** The database update logic (`batch_upsert_into_duckdb`) MUST be modified based on both `embeddings_updated` and `frontmatter_changed` flags:
  - **Case 1: `embeddings_updated` is true:** Perform a full UPSERT, updating all fields including content, embeddings, and frontmatter.
  - **Case 2: `embeddings_updated` is false AND `frontmatter_changed` is true:** Perform a partial UPSERT for _existing_ records, updating only the changed frontmatter fields while explicitly **preserving** the existing `md_content`, `spr_content`, `embeddings_openai`, and `embeddings_spr_custom` values in the database.
  - **Case 3: `embeddings_updated` is false AND `frontmatter_changed` is true:** Perform a full INSERT for _new_ records (records not previously in the DB).
  - **Case 4: `embeddings_updated` is false AND `frontmatter_changed` is false:** No database update should occur for the record.

### 4.4. Data Fetching

- **REQ-FCD-030:** The `pre_fetch_existing_data` function MUST be modified to retrieve all necessary frontmatter fields from the database, not just content/embedding-related fields, to enable the comparison required by REQ-FCD-001.

## 5. Scope

- **In Scope:** Modifications to `Memo.ExportDuckDB` module, specifically functions related to data fetching (`pre_fetch_existing_data`), comparison logic (within `process_files`), and database updates (`batch_upsert_into_duckdb`). Introduction of necessary helper functions for normalization.
- **Out of Scope:** Changes to the embedding generation process (`AIUtils`), frontmatter parsing (`Frontmatter`), database schema definition (beyond ensuring columns exist), or UI components.

## 6. Success Criteria

- Modifying only a frontmatter field (e.g., `title`) in a Markdown file results in the corresponding DuckDB record being updated with the new title, while its embedding fields remain unchanged (verified by checking DB state before/after running the export).
- Modifying only the `md_content` results in the record being updated with new content and new embeddings.
- Modifying both content and frontmatter results in the record being updated with new content, new embeddings, and new frontmatter.
- Running the export process twice without any file changes results in no database updates being performed for existing records.
- Comparison correctly handles variations in date formats, number representations, nil/empty lists, and string quoting between file and DB representations.
