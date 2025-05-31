### Added: Support for Limited RSS/Atom Feeds

Users can now request RSS and Atom feeds with a specific number of recent items by adding a `?limit=N` query parameter to the feed URL, where `N` is a positive integer.

For example:

- `/rss.xml?limit=20` will return the 20 most recent items in RSS format.
- `/atom.xml?limit=50` will return the 50 most recent items in Atom format.
- `/feed/index.xml?limit=10` will return the 10 most recent items for that specific feed path.

If the `limit` parameter is not provided or is invalid (e.g., not a positive integer), the feed will default to showing 20 items. If a pre-generated limited feed file for the exact user-specified limit (or the default 20) is not available, the full, unlimited feed will be served as before.

This feature enhances flexibility for feed readers and can help reduce bandwidth usage.

### Enhanced: Stricter Date Validation for Feed Content (2025-05-31)

- The RSS/Atom feed generation script now enforces stricter validation for `date` and `lastmod` fields in content frontmatter.
- Posts **must** have a valid `date` in their frontmatter (e.g., `date: 'YYYY-MM-DD'`) to be included in any RSS/Atom feed. Posts with invalid or missing `date` fields will be excluded.
- The `lastmod` field, if invalid or missing, will correctly fall back to the `date` field's value.
- This change ensures greater accuracy and reliability of publication dates in our feeds. Content authors should verify their articles have valid `date` frontmatter if they are intended for syndication.
