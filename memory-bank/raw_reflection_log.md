------
Date: 2025-07-03
TaskRef: "Fix MiniSearch index to include spr_content and keywords for search"
Learnings:
- MiniSearch will only search fields explicitly listed in the `fields` array; missing fields in the index config or document schema will not be searchable.
- The backend index and frontend MiniSearch config must be kept in sync for all searchable fields.
- Adding a new field (like `keywords`) requires updating both the DuckDB row extraction and the MiniSearch document schema.
Difficulties:
- The original script did not extract or index `keywords`, and `spr_content` was omitted from the indexed fields, causing search failures for those fields.
- Ensuring type safety and correct array extraction from DuckDBValue objects is important for robust indexing.
Successes:
- After updating the script and regenerating the index, both `spr_content` and `keywords` are now searchable as intended.
Improvements_Identified_For_Consolidation:
- Always verify that all intended search fields are present in both the backend index and frontend config.
---

Date: 2025-07-03
TaskRef: "Reset scroll offset to top on user input search in CommandPaletteModal"
Learnings:

- For scrollable lists in React, using a ref and resetting `scrollTop` in a `useEffect` tied to the search query ensures the scroll position resets on input.
- This pattern improves UX for search-driven modals and avoids stale scroll positions when results change.
  Difficulties:
- Identifying the correct scrollable container and ensuring the ref is attached to the right element.
  Successes:
- Implemented scroll reset on query change, resulting in expected behavior for the command palette modal.
  Improvements_Identified_For_Consolidation:
- Use a ref and effect to reset scroll position for any dynamic, filterable list UI.

---

Date: 2025-07-01
TaskRef: 'Fix incorrect render order in HeadingNavigator.tsx'

Learnings:

- The original recursive `filterAndRenderHeadings` function in `HeadingNavigator.tsx` caused incorrect rendering order due to its depth-first traversal and conditional `CommandGroup` pushing.
- Flattening the hierarchical `ITocItem` array into a single-level array while preserving the `depth` property allows for a simpler, linear filtering and rendering process.
- Using `useCallback` for `getPrefix` and `flattenTocItems` ensures these utility functions are memoized and do not cause unnecessary re-renders.

Difficulties:

- Ensuring the `depth` property was correctly used for UI indentation after flattening the structure. This was handled by applying `ml-` classes based on `item.depth` directly to `CommandItem`.

Successes:

- Successfully refactored the `filterAndRenderHeadings` logic to first flatten the `tocItems` and then filter and render them, resolving the incorrect render order.
- Maintained the visual indentation based on heading depth.

Improvements_Identified_For_Consolidation:

- General pattern: For hierarchical data structures where filtering and linear rendering are required, flattening the structure first can simplify the rendering logic and ensure correct order.

---

---

Date: 2025-07-02
TaskRef: 'Refactor memo list view into a separate component'

Learnings:

- Successfully extracted the memo display logic, including year/month grouping and infinite scrolling, into a new `MemoList` component.
- This improves modularity and reusability, allowing the same display logic to be used on other pages.
- The `List` sub-component was also moved into `MemoList.tsx` to keep related rendering logic co-located.

Difficulties:

- Ensuring all necessary state (`displayedMemos`, `hasMore`, `loadingRef`) and effects (`useEffect` for IntersectionObserver) were correctly migrated to the new component.
- Correctly passing the `memos` prop to the new component and updating the `src/pages/all.tsx` to use it.

Successes:

- Created a reusable `MemoList` component that encapsulates complex display and loading logic.
- Simplified `src/pages/all.tsx` by delegating the rendering of the memo list to the new component.

Improvements_Identified_For_Consolidation:

- General pattern: Extracting complex UI logic and state management into dedicated, reusable components improves code organization and maintainability, especially for features like infinite scrolling and data grouping.

---

---

Date: 2025-07-03
TaskRef: 'Extract share dialog to a separate component'

Learnings:

- Successfully extracted the share dialog UI and logic from `ShareButton.tsx` into a new `ShareDialog.tsx` component.
- This improves modularity and makes `ShareButton.tsx` cleaner and more focused on triggering the share functionality.
- The `ShareDialog` component now encapsulates the social sharing links and their respective `href` constructions.

Difficulties:

- Ensuring all necessary props (`pageUrl`, `pageTitle`, `isOpen`, `onOpenChange`) were correctly passed to the new `ShareDialog` component.
- Resolving duplicate import errors in `ShareButton.tsx` after refactoring.

Successes:

- Created a dedicated `ShareDialog` component for better separation of concerns.
- Simplified `ShareButton.tsx` by replacing the inline dialog content with the new `ShareDialog` component.
- Maintained full functionality of the share feature.

Improvements_Identified_For_Consolidation:

- General pattern: Extracting complex UI elements like dialogs into separate, reusable components enhances code organization, readability, and maintainability.

---
