# Island Rendering Implementation Notes

## Overview
The new island rendering system replaces flat procedural fills with a layered, SDF-driven visual style. It aims for a "soft illustrated" look with sandy shorelines, grassy interiors, and procedural vegetation.

## Implementation Details

### SDF & Masking (`IslandRenderer.js`)
Instead of computing a real-time SDF per pixel (expensive), we render each island to a cached off-screen canvas.
1. **Halo Layer:** A wide, soft cyan stroke is drawn behind the island to simulate shallow water/reef.
2. **Sand Layer:** The base polygon is drawn in a sandy color (`#fde6b1`).
3. **Grass Layer:** The inner polygon (`vegVertices`) is drawn in green (`#84cc16`). To add depth, we use a radial gradient masked to the polygon (lighter center, darker edges).
4. **Decorations:** Sprites are stamped onto the cached canvas.

### Procedural Assets
Vegetation and rocks are generated procedurally on init:
- **Palms:** Composition of ellipses for leaves (dark + light layers) and a simple trunk.
- **Bushes:** Clusters of circles with randomized offsets and shades.
- **Rocks:** Irregular polygons with simple highlight clipping.

These assets are rendered to small off-screen canvases (`64x64`) and reused as stamps.

### Configuration
Key parameters in `IslandRenderer` (and `script.js` generation):
- **Halo Width:** Controlled by `ctx.lineWidth` and `shadowBlur` in `drawHalo`.
- **Vegetation Density:** Controlled by `script.js` loops in `generateIslands` (currently ~2-5 trees/bushes per island based on size).
- **Scale:** Sprite scaling is randomized (0.8 - 1.2).

## Tweaking
To adjust the look:
- **Colors:** Edit `IslandRenderer.drawSand`, `drawGrass`, etc.
- **Density:** Modify the loop counts in `script.js -> generateIslands`.
- **Halo Intensity:** Adjust `rgba` alpha values in `IslandRenderer.drawHalo`.

## Integration
The renderer is integrated via `IslandRenderer.drawIsland(ctx, isl)` in the main loop. This checks for a cached canvas (`isl.cache`) and renders it if missing, then draws the cached image. This ensures high performance even with many islands.
