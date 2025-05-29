# Feature Specification: Limited RSS/Atom Feeds

## Overview

Implement support for a `limit` query parameter on RSS and Atom feed URLs to allow users to specify the number of recent items they wish to retrieve.

## Requirements

- The system must generate multiple versions of each feed type (RSS 2.0 and Atom 1.0) with varying limits on the number of items.
- The generated limited feed files must be stored in a location accessible by the web server.
- The web server (Nginx) must be configured to:
  - Detect the presence and value of the `limit` query parameter on feed URLs (e.g., `/rss.xml`, `/atom.xml`, `/feed.xml`, `/index.xml`, `/feed/index.xml`).
  - If a valid positive integer `limit` is provided, attempt to serve the corresponding pre-generated limited feed file (e.g., `/rss_50.xml` for `/rss.xml?limit=50`, `/feed_20.xml` for `/feed/index.xml?limit=20`).
  - If the specified limited feed file does not exist, or if the `limit` parameter is invalid or not present, fall back to serving the default, full version of the feed file (e.g., `/rss.xml`, `/feed.xml`).
  - Return a 404 error if neither the limited nor the default feed file is found.

## Implementation Details

### Feed Generation (`scripts/generate-rss.ts`)

- Modify the existing script to iterate through a predefined list of limit values (e.g., 10, 15, 20, ..., 100).
- For each limit value and each feed type (RSS, Atom), generate the corresponding XML content, truncating the list of items to the specified limit.
- Save the generated XML content to files named according to the pattern `{feed_type}_{limit}.xml` in the output directory (e.g., `out/rss_50.xml`, `out/atom_30.xml`).
- For the `/feed/index.xml` case, to align with the Nginx configuration, the script should generate files named `out/feed_{limit}.xml` at the root of the output directory (e.g., `out/feed_50.xml`).
- Ensure the script uses asynchronous file system operations (`fs/promises`) for reading source markdown files and writing output feed files.

### Nginx Configuration (`nginx/nginx.custom.conf`)

- Add a `map` directive to check the `$arg_limit` variable for general feed paths (`~ ^/(?<feed_type>rss|atom|feed|index)\.xml$`). This map will set a variable (e.g., `$limited_feed_path`) to the expected path of the limited feed file (e.g., `/${feed_type}_$arg_limit.xml`) if `$arg_limit` is a valid positive integer, and to an empty string otherwise.
- In the `location ~ ^/(?<feed_type>rss|atom|feed|index)\.xml$` block, use `try_files $limited_feed_path $uri /404.html;`.
- For the specific `location = /feed/index.xml` block, use an `if` block to check for a valid positive integer `limit` query parameter (`$arg_limit`). If a valid `limit` is present, use a `rewrite ^/feed/index\.xml$ /feed_$arg_limit.xml last;` to internally redirect the request to a file named `/feed_N.xml` at the root level (e.g., `/feed_50.xml`). If no valid `limit` is present, or if the rewrite does not occur, use `try_files /feed.xml /404.html;` to serve the default `/feed.xml` file or a 404 error.
- Ensure the Nginx configuration correctly points to the directory where the generated feed files are placed (e.g., `/usr/share/nginx/html`, assuming the `out` directory content is copied there).

## Open Questions/Future Considerations

- Should the list of limit variants be configurable externally?
- Consider adding caching headers for the generated feed files.
- Explore alternative approaches for dynamic limiting without pre-generation if build time/storage becomes a significant issue.
