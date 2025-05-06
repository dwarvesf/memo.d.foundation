---
title: Migrate to Asynchronous File System Operations
date: 2025-05-01T00:00:00.000Z
authors:
  - monotykamary
tags:
  - adr
  - file system
  - async
  - performance
author_addresses:
  - '0xfdfb16ffaf364a4ae15db843ae18a76fd848e79e'
---

## Context

The application currently uses synchronous functions from the `fs` module for file system operations such as reading files, checking file existence, and listing directories. Synchronous I/O operations can block the Node.js event loop, leading to potential performance bottlenecks and unresponsiveness, especially when dealing with larger files or directories, or under heavy load.

## Decision

We have decided to migrate from synchronous `fs` module functions (e.g., `readFileSync`, `existsSync`, `readdirSync`, `statSync`) to their asynchronous, promise-based counterparts available in the `fs/promises` module (e.g., `fs.readFile`, `fs.stat`, `fs.readdir`).

## Status

Implemented. The changes have been made in the following files:

- `src/lib/content/markdown.ts`
- `src/lib/content/memo.ts`
- `src/lib/content/paths.ts`
- `src/pages/[...slug].tsx`
- `src/pages/index.tsx`

The relevant functions have been updated to use `async/await` syntax to handle the promises returned by the `fs/promises` functions.

## Consequences

- **Positive:**

  - Improved application performance and responsiveness by preventing the blocking of the Node.js event loop during file system operations.
  - Better utilization of system resources.
  - Aligns with best practices for asynchronous programming in Node.js.

- **Negative:**
  - Requires updating functions that perform file system operations to be asynchronous, involving the use of `async/await`. This necessitates changes propagating through the call stack.
  - Requires careful handling of errors in asynchronous code using `try...catch` blocks.
