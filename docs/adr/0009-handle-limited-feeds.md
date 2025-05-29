# Handling `limit` query parameter for RSS/Atom feeds with Nginx and pre-generated files

## Context

There is a need to provide users with RSS/Atom feeds containing a variable number of items, controlled by a `limit` query parameter (e.g., `/rss.xml?limit=50`). This enhances user experience for clients that prefer shorter or longer feeds and can reduce bandwidth if users only need recent items. This requires changes in both feed generation and web server request handling.

## Decision

1.  **Feed Generation (`scripts/generate-rss.ts`):**

    - The script has been updated to pre-generate multiple versions of each feed type (RSS, Atom).
    - For each base feed (e.g., `rss.xml`), variants corresponding to predefined limits (e.g., `rss_10.xml`, `rss_50.xml`) are created. These files are named using the pattern `{feed_type}_{limit}.xml` for root feeds (e.g., `rss_50.xml`) and `{subdirectory}/{feed_name}_{limit}.xml` for feeds in subdirectories (e.g., `feed/index_50.xml`).
    - The script also uses asynchronous file system operations for improved performance, aligning with ADR-0001.

2.  **Nginx Configuration (`nginx/nginx.custom.conf`):**
    - Nginx is configured to inspect the `limit` query parameter on feed URLs.
    - **For general feed paths** (e.g., `/rss.xml`, `/atom.xml`, `/feed.xml` excluding `/feed/index.xml`):
      - A `map $arg_limit $limited_feed_path` directive is used. This map checks if `$arg_limit` is a positive integer.
      - If valid, `$limited_feed_path` is set to `/$feed_type_$arg_limit.xml` (where `$feed_type` is captured from the request URI).
      - If invalid or not present, `$limited_feed_path` is empty.
      - The `location` block uses `try_files $limited_feed_path $uri /404.html;` to attempt to serve the limited version, then the original, then a 404 page. This avoids using `try_files` inside an `if` block.
    - **For the specific `/feed/index.xml` path:**
      - The `location = /feed/index.xml` block uses an `if` block to check for a valid positive integer `limit` query parameter (`$arg_limit`).
      - If a valid `limit` is present, it uses a `rewrite ^/feed/index\.xml$ /feed_$arg_limit.xml last;` to internally redirect the request to a file named `/feed_N.xml` at the root level (e.g., `/feed_50.xml`).
      - If no valid `limit` is present, or if the rewrite does not occur, `try_files /feed.xml /404.html;` is used to serve the default `/feed.xml` file or a 404 error.
      - Note: This implementation uses a `rewrite` inside an `if`, which is generally discouraged in Nginx configurations, and it targets a file at the root (`/feed_N.xml`) rather than within the `/feed/` subdirectory (`/feed/index_N.xml`).

## Consequences

- **Positive:**
  - Users can request feeds with a specific number of items.
  - Reduced server load for clients that only need a few items, as smaller, pre-generated files are served.
  - Nginx configuration remains relatively clean by using `map` and avoiding `try_files` in `if` blocks.
  - Feed generation script is more performant due to async operations.
- **Negative:**
  - Increased build time due to the generation of multiple feed variants.
  - Increased storage space required for the pre-generated feed files.
  - The number of `limit` variants is fixed at build time. Dynamic limits beyond the pre-generated ones are not supported by this approach.
