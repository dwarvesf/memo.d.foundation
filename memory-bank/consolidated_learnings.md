## Hotkey Management (react-hotkeys-hook)

**Limitation: Complex Hotkey Strings**

- The `react-hotkeys-hook` library does not support hotkey sequences where a part of the sequence is a key combination (e.g., `g>shift+g`).
- Hotkeys should be defined either as simple sequences (e.g., `g>g`) or simple combinations (e.g., `shift+g`).
- When defining hotkeys for display (e.g., in a shortcut dialog) and for registration, ensure consistency and adherence to the library's supported formats.
- The `KeyboardShortcutDialog.tsx` component is for display only; actual hotkey registration occurs in components like `TableOfContents.tsx` using `useHotkeys`.

**Specific Hotkey Management & UI/UX Consistency**

- Removed redundant or less useful hotkeys (e.g., `shift+]` and `shift+[` for same-level heading navigation) when a more general hotkey (e.g., `]` and `[`) already provides the desired functionality (unconstrained navigation through all headings).
- Always ensure that keyboard shortcut documentation (e.g., `KeyboardShortcutDialog.tsx`) accurately reflects the actual hotkey implementation (e.g., `TableOfContents.tsx`) to maintain UI/UX consistency.

## Data Structures & Rendering

**Pattern: Flattening Hierarchical Data for Linear Rendering**

- For hierarchical data structures (e.g., nested `ITocItem` arrays) where filtering and linear rendering (e.g., in a search result list) are required, flatten the structure into a single-level array first.
- Preserve relevant hierarchical properties (e.g., `depth`) in the flattened items for UI presentation (e.g., indentation).
- _Rationale:_ Simplifies rendering logic by avoiding complex recursive rendering and ensures correct display order, especially when filtering.
