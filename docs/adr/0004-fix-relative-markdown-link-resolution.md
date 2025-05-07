# Relative markdown link resolution

## Status

Accepted

## Context

Markdown files within the project contain relative links (e.g., `../some-page.md`, `sibling-page.md`). When these markdown files are processed into HTML and rendered on pages like `/[...slug].tsx`, the client-side navigation handler uses `new URL(href, window.location.href)` to resolve the link `href` against the current page's URL (`window.location.href`).

This led to incorrect link resolution for relative links. For example, a link `[Link to Sibling](../sibling-page.md)` on a page `/parent/current-page` would resolve to `/parent/sibling-page`. However, a link `[Link to Other Page](other-page.md)` on the same page `/parent/current-page` would incorrectly resolve to `/parent/current-page/other-page` instead of the desired `/parent/other-page` or `/parent/current-page/other-page` depending on the intended structure.

The specific issue highlighted was a link like `[Building use-cases from and for our true second brain](building-use-cases-second-brain.md)` on a page like `/updates/build-log/how-we-stream-promote-raw-data-to-insight-second-brain/`. The desired behavior was to navigate to `/updates/build-log/building-use-cases-second-brain/`, but the current implementation appended the relative path, resulting in `/updates/build-log/how-we-stream-promote-raw-data-to-insight-second-brain/building-use-cases-second-brain/`.

## Decision

We will modify the `remarkProcessLinks` plugin in `src/lib/content/markdown.ts` to resolve relative markdown links against the source markdown file's path and convert them into site-root-relative URLs (paths starting with `/`).

The updated plugin will:

1.  Accept the `markdownFilePath` as an argument.
2.  For relative links (not starting with `http`, `https`, `mailto`, `tel`, or `/`), it will use `path.resolve` to get the absolute file system path of the linked markdown file.
3.  It will then calculate the path of this linked file relative to the project's `public/content` directory.
4.  This relative path will be converted to use forward slashes (`/`) and prepended with a `/` to create a site-root-relative URL.
5.  The `.md` extension will be removed from the final URL.
6.  Links that already start with `/` will have their `.md` extension removed if present.
7.  External links and anchor links will be left unchanged.

This ensures that the `href` attribute of `<a>` tags in the generated HTML contains a site-root-relative path, which the client-side Next.js router can correctly interpret and navigate to, effectively replacing the current path segments as intended.

Additionally, the `remarkProcessLinks` plugin will be removed from the `summaryProcessor` chain, as relative link resolution is not necessary or intended for summary content.

## Consequences

- Relative links within markdown content will now resolve correctly to site-root-relative paths, fixing the unintended appending behavior.
- Client-side navigation using the Next.js router will work as expected for these links.
- The `remarkProcessLinks` plugin now requires the `markdownFilePath` argument, necessitating updates to where it is used in the `unified` processor chains.
- Summaries will not have relative links resolved, which is acceptable as they are typically short text snippets without complex internal linking requirements.
- A new ADR file (`docs/adr/0003-fix-relative-markdown-link-resolution.md`) will be created to document this decision.
