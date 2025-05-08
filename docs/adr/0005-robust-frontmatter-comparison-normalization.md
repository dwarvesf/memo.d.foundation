# ADR: Robust Frontmatter Comparison Normalization

**Status:** Accepted

**Context:**

The `Memo.ExportDuckDB` module compares frontmatter extracted from Markdown files against existing data stored in DuckDB to detect changes and determine if updates (including potentially expensive re-embedding) are necessary. The initial comparison logic performed strict equality checks.

This strict comparison led to frequent false positives, flagging frontmatter as changed even when values were semantically equivalent but represented differently. Examples included:

- Numbers vs. String representations (`10` vs `"10"`, `10.0` vs `"10"`)
- Different date formats (`"2023-10-26"` vs `~D[2023-10-26]`)
- `nil` vs. empty lists (`nil` vs `[]` for array types like `tags`)
- Variations in text segmentation within string arrays (e.g., `ai_generated_summary` having one long sentence vs. multiple shorter strings)
- Differences in string quoting/escaping (`"Robin Sloan's"` vs `"Robin Sloan''s"`)

These false positives triggered unnecessary database updates and potentially costly re-embedding operations.

**Decision:**

Implement a comprehensive normalization strategy within the `normalize_value_for_comparison/2` function and its helpers (`normalize_date_value/1`, `normalize_array_value/2`) before comparing the `current_fm_for_comparison` and `existing_fm_for_comparison` maps.

The normalization rules applied before comparison are:

1.  **Booleans:** Compared directly (no normalization needed).
2.  **Dates:** All fields identified by `is_date_key?/1` (checking `@allowed_frontmatter` for type `"DATE"`) are normalized to a standard `"YYYY-MM-DD"` string format using `normalize_date_value/1`. This handles various input types like ISO8601 strings, `Date`, and `DateTime` structs.
3.  **Arrays (General):** Fields identified by `is_array_key?/1` are processed by `normalize_array_value/2`. For general arrays:
    - Input is converted to a list of strings.
    - `nil` values are treated as `[]`.
    - Empty strings or `nil` elements within the list are rejected.
    - The resulting list of strings is sorted alphabetically.
4.  **Arrays (ai_generated_summary):** A special case within `normalize_array_value/2` handles this key:
    - Input is converted to a list of strings.
    - All strings are joined into a single text block.
    - The combined text is lowercased, punctuation is removed (keeping alphanumeric, whitespace, hyphens), and whitespace is normalized.
    - The normalized text is split into words.
    - The resulting list of words is sorted alphabetically. This "bag-of-words" approach makes the comparison robust to segmentation and ordering differences.
5.  **Numbers/Numeric Strings:** Values that are numbers or can be parsed as floats are converted to a canonical string representation (integer string like `"10"` if it's a whole number, otherwise standard float string like `"10.5"`).
6.  **Other Strings:** For strings that are not numeric:
    - Escaped single quotes (`''`) are normalized to standard single quotes (`'`).
7.  **Nil (Non-Array/Date):** `nil` values for keys not handled above are compared directly as `nil`.

**Consequences:**

- **Positive:**
  - Significantly reduces false positive change detection for frontmatter.
  - Prevents unnecessary database updates and re-embedding operations triggered by representation differences.
  - Makes the comparison logic more resilient to variations in data representation from file parsing vs. database retrieval.
- **Negative:**
  - Increases the complexity of the comparison logic within `Memo.ExportDuckDB`.
  - The "bag-of-words" normalization for `ai_generated_summary` loses sentence structure and original segmentation information _during the comparison step_. The original data structure is still stored in the database.
