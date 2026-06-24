## 2025-03-05 - Added ARIA labels to interactive elements in Regatta
**Learning:** Found that custom inputs (like color pickers and range sliders) and icon-only floating buttons (like settings/help close buttons and pause button) in the `regatta` app lacked accessible names, making them difficult to use for screen reader users.
**Action:** Always verify that icon-only buttons and custom input elements have `aria-label` attributes to ensure they are properly announced by assistive technologies.
