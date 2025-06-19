# Refactor Link Utils: Eliminate Code Duplication and Improve Maintainability

## Changes Made

### Code Duplication Elimination

- **Removed duplicated conditional logic** from three functions: `convert_links_with_alt_text`, `convert_links_without_alt_text`, and `convert_markdown_links`
- **Created new helper function** `build_link/4` that consolidates the shared link building logic
- **Unified file validation logic** by enhancing `file_valid?/3` to accept an optional `check_frontmatter` parameter

### Function Consolidation

- **Enhanced `file_valid?/3`** to handle both file existence checking and frontmatter validation
- **Removed `file_exists?/2`** function as its logic is now integrated into the enhanced `file_valid?/3`
- **Updated `convert_embedded_images/3`** to use the unified `file_valid?/3` function

### Technical Benefits

- **Reduced code duplication** by ~30 lines of repeated conditional logic
- **Improved maintainability** - changes to link building logic now only need to be made in one place
- **Enhanced consistency** - all link conversion functions now use the same validation approach
- **Better parameter control** - frontmatter checking can now be optionally disabled per function call

### API Changes

- `file_valid?/3` now accepts a third parameter `check_frontmatter` (defaults to `true` for backward compatibility)
- `file_exists?/2` function has been removed (functionality moved to `file_valid?/3`)
- New private function `build_link/4` handles the unified link building logic

### Usage Examples

```elixir
# Check file validity with frontmatter validation (default behavior)
file_valid?(link, current_file)
file_valid?(link, current_file, true)

# Check file existence only (no frontmatter validation)
file_valid?(link, current_file, false)
```

This refactoring maintains all existing functionality while making the codebase more maintainable and reducing the potential for inconsistencies between different link conversion functions.
