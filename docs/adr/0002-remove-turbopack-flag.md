# 0002 - Remove Turbopack Flag

## Status

Accepted

## Context

The `dev` script in `package.json` was configured to use the `--turbopack` flag for faster local development builds. However, it was observed that enabling turbopack caused a persistent compile loop, preventing the development server from starting successfully.

## Decision

The `--turbopack` flag has been removed from the `dev` script in `package.json`.

## Consequences

Removing the turbopack flag resolves the compilation loop issue, allowing the development server to start correctly. This ensures a functional local development environment. The potential performance benefits of turbopack are foregone for now, but this can be revisited in the future if the underlying issue is resolved in newer versions of Next.js or Turbopack.
