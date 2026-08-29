## 2026-05-28 - Adding ARIA labels and focus-visible classes to icon-only buttons
**Learning:** Icon-only buttons frequently miss critical accessibility features. Specifically, screen readers need `aria-label` attributes to understand the button's purpose, and keyboard navigation requires visible focus indicators (like Tailwind's `focus-visible:ring-2`) since default styles are often removed.
**Action:** When inspecting or adding icon-only buttons, consistently ensure `aria-label`, `title`, and `focus-visible` utility classes are present.
