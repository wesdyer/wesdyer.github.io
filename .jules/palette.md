## 2025-02-28 - Focus Rings for Icon-Only Buttons
**Learning:** Adding `focus-visible` to icon-only buttons built with Tailwind is critical to ensure keyboard users see a clear focus indicator, especially when `outline-none` might otherwise remove default focus styles. Combining this with `aria-label` provides a robust, accessible component for both screen readers and keyboard navigation.
**Action:** Always ensure that any interactive element missing visible text has an explicit `focus-visible` utility class (e.g., `focus-visible:ring-2`) and an `aria-label`.
