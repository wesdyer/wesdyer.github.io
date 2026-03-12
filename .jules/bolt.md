
## 2025-02-19 - Cached Math.sin/Math.cos in global physics loop
**Learning:** `getWindAt` is a hot-path function in `regatta/js/script.js` called multiple times per frame for almost everything (particles, boats, physics, wind rendering). Repeatedly calling `Math.sin()` and `Math.cos()` on the same base wind direction was creating unnecessary CPU load.
**Action:** When a global value (like `state.wind.direction`) changes infrequently but is read constantly in a loop, pre-calculate its trig values (`sinDir`, `cosDir`) directly where the state is updated and store them alongside it.
