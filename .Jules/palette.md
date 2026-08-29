## 2026-01-29 - Tailwind Invisible vs SR-Only
**Learning:** Tailwind's `invisible` utility (`visibility: hidden`) removes elements from the accessibility tree, making custom inputs inaccessible to keyboard and screen reader users.
**Action:** Use `sr-only` for hidden interactive elements. If creating custom radio buttons, ensure the wrapping label has visible focus states (e.g., `has-[:focus-visible]:ring`) since the input itself is hidden.
