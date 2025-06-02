# Feature Specification: Limited RSS/Atom Feeds

## Overview

Implement support for a `limit` query parameter on RSS and Atom feed URLs to allow users to specify the number of recent items they wish to retrieve.

## Requirements

- The system must generate multiple versions of each feed type (RSS 2.0 and Atom 1.0) with varying limits on the number of items.
- The generated limited feed files must be stored in a location accessible by the web server.
- The web server (Nginx) must be configured to:
  - Detect the presence and value of the `limit` query parameter on feed URLs (e.g., `/rss.xml`, `/atom.xml`, `/feed.xml`, `/index.xml`, `/feed/index.xml`).
  - If a valid positive integer `limit` is provided, attempt to serve the corresponding pre-generated limited feed file (e.g., `/rss_50.xml` for `/rss.xml?limit=50`, `/feed_50.xml` for `/feed/index.xml?limit=50`).
  - If the `limit` parameter is invalid or not present, Nginx should default to serving a pre-generated feed with 20 items (e.g., `/rss_20.xml`, `/feed_20.xml`).
  - If the specified limited feed file (either user-defined or the default 20-item version) does not exist, fall back to serving the original, full version of the feed file (e.g., `/rss.xml` for general feeds, `/feed.xml` for `/feed/index.xml`).
  - Return a 404 error if none of the above files are found.

## Implementation Details

### Feed Generation (`scripts/generate-rss.ts`)

- Modify the existing script to iterate through a predefined list of limit values (e.g., 10, 15, 20, ..., 100). It's crucial that a version with `limit=20` is generated for each feed type to support Nginx's default fallback.
- Source items for feeds are first filtered to include only those with valid `date` frontmatter. Posts with invalid or missing dates are excluded.
- For each limit value and each feed type (RSS, Atom), generate the corresponding XML content from the filtered and sorted list of items, truncating this list to the specified limit.
- Save the generated XML content to files named according to the pattern `{feed_type}_{limit}.xml` in the output directory (e.g., `out/rss_50.xml`, `out/atom_20.xml`).
- For the `/feed/index.xml` case, the script should generate files named `out/feed_{limit}.xml` at the root of the output directory (e.g., `out/feed_50.xml`, `out/feed_20.xml`).
- Ensure the script uses asynchronous file system operations (`fs/promises`) for reading source markdown files and writing output feed files.

### Nginx Configuration (`nginx/nginx.custom.conf`)

- Implement a `map $arg_limit $general_limited_feed_path` directive for general feed paths (`~ ^/(?<feed_type>rss|atom|feed|index)\.xml$`).
  - If `$arg_limit` is a positive integer, set `$general_limited_feed_path` to `/${feed_type}_$arg_limit.xml`.
  - Otherwise (invalid or no `limit`), default to `/${feed_type}_20.xml`.
- In the `location ~ ^/(?<feed_type>rss|atom|feed|index)\.xml$` block, use `try_files $general_limited_feed_path $uri /404.html;`.
- Implement a separate `map $arg_limit $feed_index_limited_feed_path` directive specifically for the `location = /feed/index.xml` block.
  - If `$arg_limit` is a positive integer, set `$feed_index_limited_feed_path` to `/feed_$arg_limit.xml`.
  - Otherwise (invalid or no `limit`), default to `/feed_20.xml`.
- In the `location = /feed/index.xml` block, use `try_files $feed_index_limited_feed_path /feed.xml /404.html;`.
- Ensure the Nginx configuration correctly points to the directory where the generated feed files are placed (e.g., `/usr/share/nginx/html`).

## Open Questions/Future Considerations

- Should the list of limit variants be configurable externally?
- Consider adding caching headers for the generated feed files.
- Explore alternative approaches for dynamic limiting without pre-generation if build time/storage becomes a significant issue.
