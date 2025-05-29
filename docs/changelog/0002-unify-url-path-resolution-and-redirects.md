## Unified URL Path Resolution and Redirect Handling

This update introduces a comprehensive system for managing URL path resolution and redirects throughout the application, ensuring consistency and improving user experience.

Key changes include:

- **Unified Redirect System**: Implemented a centralized mechanism to handle URL redirects. This ensures that users and search engines are consistently directed to the canonical versions of pages, improving SEO and reducing confusion from multiple URLs pointing to the same content.
- **Client-Side Redirects**: A map of all known redirects is now injected into the `window` object on page load. This allows the client-side router to immediately redirect to the correct path without a server roundtrip, speeding up navigation for aliased or moved content.
- **Server-Side Path Normalization**: Enhanced server-side logic to correctly resolve and normalize paths, especially for markdown content. This includes better handling of relative links within markdown files, ensuring they point to the correct, possibly redirected, final URL.
- **Backlink Accuracy**: Improved the backlink generation process to account for redirects. Backlinks will now correctly point to the canonical URL of a page, even if the link in the source document uses an alias or an old path.
- **Path Utilities**: Introduced new utility functions for normalizing paths (e.g., ensuring consistent trailing slashes, handling special characters) and for resolving paths on both client and server sides.

These changes affect several parts of the application:

- **Command Palette**: Navigation from the command palette now uses the client-side redirect logic to ensure users land on the correct page.
- **Markdown Link Processing**: Links within markdown content are now resolved considering the unified redirect map, ensuring they are always up-to-date.
- **Static Page Generation (`[...slug].tsx`)**: Page generation logic now correctly identifies canonical paths and incorporates redirect information for folder structures and backlinks.
- **Application Entry (`_document.tsx`)**: Modified to inject the redirect map for client-side use.

Overall, this refactor streamlines how URLs are handled, making the application more robust and user-friendly.
