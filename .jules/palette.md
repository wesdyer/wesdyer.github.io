## 2024-05-14 - Icon-Only Buttons Accessibility

**Learning:** When using custom icon buttons (like `music-toggle`, `sound-toggle`, `smiley-button`, `cascade-button` in the `mines` app), it is important to include BOTH `aria-label` and `title` attributes for full accessibility (screen readers and tooltips), as well as explicit keyboard focus rings (e.g., `focus-visible:ring-2`) since the default browser focus ring might be removed by Tailwind utilities like `outline-none` or custom active states.

**Action:** Ensure that any future icon-only buttons added to the project receive `aria-label`, `title`, and explicit `:focus-visible` styling using Tailwind CSS.
