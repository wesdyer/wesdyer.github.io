## 2024-05-19 - [Optimize trigonometric functions]
**Learning:** `getWindAt` is called frequently and does a lot of math operations. Caching `Math.sin(baseDir)` and `Math.cos(baseDir)` globally could save time.
**Action:** Implemented caching for trigonometric functions.
