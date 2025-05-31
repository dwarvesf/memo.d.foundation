# Handling `limit` query parameter for RSS/Atom feeds with Nginx and pre-generated files

## Context

There is a need to provide users with RSS/Atom feeds containing a variable number of items, controlled by a `limit` query parameter (e.g., `/rss.xml?limit=50`). This enhances user experience for clients that prefer shorter or longer feeds and can reduce bandwidth if users only need recent items. This requires changes in both feed generation and web server request handling.

## Decision

1.  **Feed Generation (`scripts/generate-rss.ts`):**

    - The script has been updated to pre-generate multiple versions of each feed type (RSS, Atom).
    - Before generating limited feeds, the script first filters all potential content to include only items with valid `date` frontmatter. Items with missing or invalid dates are excluded from all feed generation.
    - For each base feed (e.g., `rss.xml`), variants corresponding to predefined limits (e.g., `rss_10.xml`, `rss_50.xml`) are created from this filtered and sorted list of items. These files are named using the pattern `{feed_type}_{limit}.xml` for root feeds (e.g., `rss_50.xml`) and `{subdirectory}/{feed_name}_{limit}.xml` for feeds in subdirectories (e.g., `feed/index_50.xml`).
    - The script also uses asynchronous file system operations for improved performance, aligning with ADR-0001.

2.  **Nginx Configuration (`nginx/nginx.custom.conf`):**
    - Nginx is configured to inspect the `limit` query parameter on feed URLs using `map` directives.
    - **For general feed paths** (e.g., `/rss.xml`, `/atom.xml`, `/feed.xml`, `/index.xml`):
      - A `map $arg_limit $general_limited_feed_path` directive is used. This map checks if `$arg_limit` is a positive integer.
      - If valid, `$general_limited_feed_path` is set to `/${feed_type}_$arg_limit.xml` (where `$feed_type` is captured from the request URI like `location ~ ^/(?<feed_type>rss|atom|feed|index)\.xml$`).
      - If invalid or not present, it defaults to `/${feed_type}_20.xml`.
      - The `location` block uses `try_files $general_limited_feed_path $uri /404.html;` to attempt to serve the limited version (either user-specified or default 20), then the original URI (e.g. `/rss.xml`), then a 404 page.
    - **For the specific `/feed/index.xml` path:**
      - A separate `map $arg_limit $feed_index_limited_feed_path` directive is used.
      - If `$arg_limit` is a valid positive integer, `$feed_index_limited_feed_path` is set to `/feed_$arg_limit.xml`.
      - If invalid or not present, it defaults to `/feed_20.xml`.
      - The `location = /feed/index.xml` block uses `try_files $feed_index_limited_feed_path /feed.xml /404.html;` to attempt to serve the limited version (user-specified or default 20), then the default `/feed.xml`, then a 404 page.
    - This approach consistently uses `map` directives and `try_files`, avoiding `if` blocks for request rewriting, which is generally a more robust and recommended Nginx practice.

## Consequences

- **Positive:**
  - Users can request feeds with a specific number of items; if no limit is specified or an invalid one is provided, a default limit of 20 items is applied.
  - Reduced server load for clients that only need a few items, as smaller, pre-generated files are served.
  - Nginx configuration is robust and adheres to best practices by using `map` directives and avoiding `if` for rewrites.
  - Feed generation script is more performant due to async operations.
- **Negative:**
  - Increased build time due to the generation of multiple feed variants (including the default '20' variants if not explicitly generated for other limits).
  - Increased storage space required for the pre-generated feed files.
  - The number of `limit` variants is fixed at build time. Dynamic limits beyond the pre-generated ones (other than the default 20) are not supported by this approach.
