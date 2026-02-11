# Improved Island Rendering

## SDF/Mask Approach
The new island renderer simulates a soft, illustrated look without using expensive per-pixel shaders or SDF textures. Instead, it leverages the existing collision polygon data:

1.  **Sand Layer**: Drawn using the collision polygon directly.
2.  **Grass Layer**: Drawn using an eroded version of the polygon (`vegVertices`), created by scaling vertices towards the centroid.
3.  **Shallow Water Halo**: Drawn using the sand polygon with a wide stroke and `shadowBlur` (glow) to create a soft, gradient fade-out effect around the island.
4.  **Decorations**: Procedurally generated sprites (Palms, Bushes, Rocks) are instanced and placed using a simplified Poisson-disk distribution logic within `generateIslands`.

## Configuration
Configuration is currently code-driven within `js/island_renderer.js` and `js/script.js`:

*   **Halo Width/Color**: Adjusted in `IslandRenderer.drawHalo`. Currently set to `40` units width with a teal color (`rgba(45, 212, 191, 0.4)`).
*   **Decoration Density**: Controlled in `generateIslands` (in `script.js`) by the `count` variable derived from island area (`area / 1500`).
*   **Sprite Assets**: Generated procedurally in `IslandRenderer.generateAssets` using Canvas 2D drawing commands. Variants (number of leaves, rocks points) are randomized.

## Caching
To maintain high performance with many islands, each island is rendered once to an offscreen canvas (`isl.cache`) when first viewed. Subsequent frames simply draw this cached image. This avoids re-running the expensive shadow blur and path rendering operations every frame.
