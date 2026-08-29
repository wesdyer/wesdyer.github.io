## 2024-03-24 - Accessible Custom Radio Buttons in Tailwind
**Learning:** When styling custom radio buttons by hiding the native `<input type="radio">`, using `invisible w-0 absolute` removes the element from the accessibility tree and prevents keyboard focus.
**Action:** Always use the `sr-only` class to hide the native input visually while keeping it accessible to screen readers, and apply keyboard focus styles to the parent `<label>` using Tailwind's `has-[:focus-visible]` modifier.
