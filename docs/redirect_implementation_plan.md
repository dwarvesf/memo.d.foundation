## Documentation: Short Link and History Routing Implementation Plan

**1. Goal:**

Implement two features for the statically exported Next.js site (`output: 'export'`):

- **Short Links:** Allow defining short, memorable URLs in markdown frontmatter (`short_links: ['link1', 'link2']`) that map to the canonical page URL.
- **History Tracking:** Automatically handle links pointing to old file paths (due to renames/moves tracked in Git history) by redirecting them to the current file path.

Both features must work without generating additional static HTML files for every possible short or historical link.

**2. Data Storage & Processing (Build Time):**

- **Centralized Metadata:** All mapping information (short links, historical paths) will be stored within the existing DuckDB/Parquet database managed by `lib/obsidian-compiler/lib/memo/export_duckdb.ex`.
- **Schema Modification:**
  - Add two new columns to the `vault` table schema in DuckDB:
    - `short_links VARCHAR[]`: To store the array of short links defined in frontmatter.
    - `previous_paths VARCHAR[]`: To store an array of known previous paths for a file, derived from Git history.
- **`export_duckdb.ex` Modifications:**
  - **Short Link Extraction:** When processing a markdown file, read the `short_links` array from its frontmatter and store it in the corresponding `short_links` column in the DuckDB table.
  - **History Extraction:** When processing a file, use Git commands (`git log --follow --name-status -- <vault_file_path>`) to identify previous paths for that file within the `vault/` directory. Store these identified paths in the `previous_paths` column.

**3. Combined Lookup Map Generation (Build Time):**

- **New Build Step:** Introduce a new step in the build process (e.g., via `Makefile`) that executes _after_ `export_duckdb.ex` has finished populating the DuckDB database.
- **Query DuckDB:** This step will query the `vault` table in the generated `db/vault.db` file. It will select the `file_path`, `short_links`, and `previous_paths` for all entries where `short_links` or `previous_paths` are not empty.
- **Generate `redirects.json`:** The query results will be processed to create a single JSON file: `public/content/redirects.json`.
  - **Structure:** This file will contain a single JSON object (a map/dictionary).
  - **Keys:** The keys of the map will be all the unique short links and all the unique previous paths found in the database.
  - **Values:** The value associated with each key will be the corresponding _current_ canonical `file_path` (formatted appropriately for URL routing, e.g., `/path/to/current/file`).
  - _Example:_
    ```json
    {
      "shortlink1": "/current/path/file1",
      "/old/path/file1": "/current/path/file1",
      "another-short-link": "/current/path/file2",
      "/another/old/path/file2": "/new/location/file2"
    }
    ```

**4. Client-Side Routing (Runtime):**

- **Frontend Logic:** Implement logic within the Next.js application, most likely in the custom 404 page (`src/pages/404.tsx`) or potentially using `useEffect` and `router.events` in `src/pages/_app.tsx`.
- **Fetch Map:** When a 404 error occurs (or potentially on initial load/route change), the client-side code will fetch the `public/content/redirects.json` file.
- **Lookup:** It will check if the requested URL path (e.g., `router.asPath`) exists as a key in the fetched `redirects` map.
- **Redirect:** If a match is found, it will use `router.replace(redirects[requestedPath])` to perform a client-side redirect to the correct current page URL. This avoids a full page reload and updates the URL in the browser bar.
- **No Match:** If the requested path is not found in the `redirects.json` map, the standard 404 page content will be displayed.

**5. Benefits:**

- Keeps primary metadata within the established DuckDB/Parquet workflow.
- Avoids static generation overhead for numerous redirect pages.
- Provides fast client-side lookups using a single, optimized JSON file.
- Compatible with the `output: 'export'` configuration.
