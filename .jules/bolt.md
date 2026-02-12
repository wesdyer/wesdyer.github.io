## 2024-05-22 - Optimizing Wind Simulation
**Learning:** In highly iterative simulation loops like `getWindAt` (called per-frame/per-particle), avoiding `Math.sqrt` via squared-distance checks and caching trigonometric values (`sin`/`cos`) on the entity (gusts) provided a measurable performance boost without altering logic.
**Action:** Always inspect frequently called physics functions for redundant trig/sqrts and implement caching on the update cycle.
