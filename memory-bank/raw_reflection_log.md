---
Date: 2025-07-01
TaskRef: "Fix hotkey error 'g>shift+g' not supported"

Learnings:
- The `react-hotkeys-hook` library does not support hotkey sequences where a part of the sequence is a key combination (e.g., `g>shift+g`).
- Hotkeys should be defined either as simple sequences (e.g., `g>g`) or simple combinations (e.g., `shift+g`).
- The `KeyboardShortcutDialog.tsx` component is for display only; the actual hotkey registration occurs in components like `TableOfContents.tsx` using `useHotkeys`.

Difficulties:
- Initially, it was unclear if the issue was with the display of the hotkey or its registration. Searching for the problematic hotkey string helped pinpoint the registration location.

Successes:
- Successfully identified the source of the hotkey registration.
- Correctly modified the hotkey definition to a supported format (`shift+g`) in `TableOfContents.tsx`.
- Updated the display of the hotkey in `KeyboardShortcutDialog.tsx` to match the new definition.

Improvements_Identified_For_Consolidation:
- General pattern: `react-hotkeys-hook` limitations regarding complex hotkey strings (sequences with combinations).
---
