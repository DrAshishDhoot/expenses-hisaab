Make category and subcategory names editable inline on the Categories page.

### What changes

1. **CategoriesManager component (`src/components/CategoriesManager.tsx`)**
   - Add inline editing state for categories and subcategories.
   - Click a category or subcategory name to enter edit mode.
   - Press Enter or blur to save; press Escape to cancel.
   - Reuse existing `saveCategory` and `saveSubcategory` from `src/lib/sync.ts` (both already support updates when passed an existing `id`).

### What stays the same

- No database or sync changes required — the update path already exists.
- Add / delete / expand / collapse behaviour remains unchanged.

### Interaction pattern

```text
Category row (collapsed)
  [Chevron] [Category name (click to edit)] (count) [Delete]

Subcategory row
  [Subcategory name (click to edit)] [Delete]
```

- Clicking the name text turns it into an input field pre-filled with the current name.
- Saving sends `{ id: existingId, name: newName }` (or `{ id, category_id, name }` for subcategories) through the existing save helpers, which write to IndexedDB and enqueue a sync outbox item.