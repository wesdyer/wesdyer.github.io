## 2024-06-18 - Tailwind Screen Reader Radio Buttons
**Learning:** Using Tailwind classes like `invisible`, `hidden`, or `w-0 absolute` to visually hide native radio inputs completely removes them from the accessibility tree, breaking screen reader and keyboard focus entirely.
**Action:** Always use the `sr-only` class to visually hide native inputs while preserving accessibility. To show keyboard focus on custom visually-styled parent containers (like a label), apply `has-[:focus-visible]:outline-none has-[:focus-visible]:ring-2` to the parent container.
