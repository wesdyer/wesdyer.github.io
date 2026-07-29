#!/usr/bin/env python3
"""Bake a painted venue mask into collision polygons.

    python3 regatta/art/bake_mask.py arctic

Reads assets/images/venues/masks/<venue>-mask.png and writes
assets/images/venues/masks/<venue>-geo.json.

The mask is the SINGLE SOURCE OF TRUTH for where land is. Paint it, bake it,
and both the collider polygons and the drawn coastline come from the same file
— which is the whole reason for doing it this way rather than hand-authoring
polygons or generating them procedurally.

Colour classes (nearest match, so anti-aliased edges resolve cleanly):
    navy  -> water
    white -> snow  (snowy land / glacier)
    grey  -> granite (the rounding island)

Baked offline, not traced at load: the trace is O(pixels) and the result is
deterministic, which keeps the eval RNG stream untouched.
"""
import json
import pathlib
import sys

sys.setrecursionlimit(100000)
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
CLASSES = {
    'water':   (52, 63, 114),
    'snow':    (255, 255, 255),
    'granite': (141, 141, 141),
}
# The start/finish line is painted onto the mask in green, so the map carries
# the course as well as the land. Pulled from the FULL-RES image (not the traced
# grid) so a one-pixel line survives.
START_GREEN = lambda r, g, b: g > 150 and r < 120 and b < 120
GRID = 500          # trace resolution; 1000px mask downsampled 2x
MIN_AREA = 30       # cells; drops speckle from anti-aliasing
EPSILON = 2.2       # Douglas-Peucker tolerance in grid cells


def classify(im, n):
    im = im.convert('RGB').resize((n, n), Image.NEAREST)
    px = im.load()
    out = [[None] * n for _ in range(n)]
    names = list(CLASSES)
    cols = [CLASSES[k] for k in names]
    for y in range(n):
        for x in range(n):
            r, g, b = px[x, y]
            best, bi = 1 << 30, 0
            for i, (cr, cg, cb) in enumerate(cols):
                d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2
                if d < best:
                    best, bi = d, i
            out[y][x] = names[bi]
    return out


def components(grid, want):
    """4-connected components of cells matching `want`."""
    n = len(grid)
    seen = [[False] * n for _ in range(n)]
    comps = []
    for sy in range(n):
        for sx in range(n):
            if seen[sy][sx] or grid[sy][sx] != want:
                continue
            stack, cells = [(sx, sy)], []
            seen[sy][sx] = True
            while stack:
                x, y = stack.pop()
                cells.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < n and 0 <= ny < n and not seen[ny][nx] and grid[ny][nx] == want:
                        seen[ny][nx] = True
                        stack.append((nx, ny))
            if len(cells) >= MIN_AREA:
                comps.append(cells)
    return comps


def trace(cells, n):
    """Moore-neighbour boundary trace of one component, as grid-corner points."""
    member = set(cells)
    # start at the lowest-then-leftmost cell so the first step is well defined
    start = min(cells, key=lambda c: (c[1], c[0]))
    NB = [(1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1)]
    contour = [start]
    cur, bdir = start, 0
    for _ in range(len(cells) * 8 + 64):
        found = False
        for k in range(8):
            d = (bdir + 6 + k) % 8            # start from the back-left
            nb = (cur[0] + NB[d][0], cur[1] + NB[d][1])
            if nb in member:
                bdir = d
                cur = nb
                contour.append(nb)
                found = True
                break
        if not found or (len(contour) > 3 and cur == start):
            break
    return contour


def simplify_closed(pts, eps):
    """Douglas-Peucker for a CLOSED ring.

    Running plain RDP on a closed contour collapses it: the first and last
    points coincide, so the baseline has zero length and every perpendicular
    distance degenerates (measured: a 185-point island came back as 2 points).
    Split the ring at the vertex farthest from the start, simplify each half as
    an open polyline, then rejoin.
    """
    if len(pts) < 5:
        return pts
    if pts[0] == pts[-1]:
        pts = pts[:-1]
    x0, y0 = pts[0]
    far = max(range(len(pts)), key=lambda i: (pts[i][0] - x0) ** 2 + (pts[i][1] - y0) ** 2)
    a = simplify(pts[:far + 1], eps)
    b = simplify(pts[far:] + [pts[0]], eps)
    return a[:-1] + b[:-1]


def simplify(pts, eps):
    if len(pts) < 3:
        return pts
    def rdp(a, b):
        if b <= a + 1:
            return []
        (x1, y1), (x2, y2) = pts[a], pts[b]
        dx, dy = x2 - x1, y2 - y1
        nrm = (dx * dx + dy * dy) ** 0.5 or 1
        worst, wi = -1, a
        for i in range(a + 1, b):
            x0, y0 = pts[i]
            d = abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / nrm
            if d > worst:
                worst, wi = d, i
        if worst <= eps:
            return []
        return rdp(a, wi) + [wi] + rdp(wi, b)
    keep = [0] + rdp(0, len(pts) - 1) + [len(pts) - 1]
    return [pts[i] for i in sorted(set(keep))]


def main():
    venue = sys.argv[1] if len(sys.argv) > 1 else 'arctic'
    src = ROOT / 'assets/images/venues/masks' / f'{venue}-mask.png'
    im = Image.open(src)
    grid = classify(im, GRID)

    out = {'venue': venue, 'grid': GRID, 'shapes': []}
    for cls in ('snow', 'granite'):
        for cells in components(grid, cls):
            ring = simplify_closed(trace(cells, GRID), EPSILON)
            if len(ring) < 4:
                continue
            xs = [p[0] for p in ring]
            ys = [p[1] for p in ring]
            cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
            rad = max(((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 for x, y in ring)
            out['shapes'].append({
                'cls': cls,
                'area': len(cells),
                # normalized 0..1 so the game can map the mask to any world size
                'c': [round(cx / GRID, 5), round(cy / GRID, 5)],
                'r': round(rad / GRID, 5),
                'ring': [[round(x / GRID, 5), round(y / GRID, 5)] for x, y in ring],
            })

    # Start/finish line, painted green on the mask
    full = im.convert('RGB')
    fw, fh = full.size
    fp = full.load()
    green = [(x, y) for y in range(fh) for x in range(fw) if START_GREEN(*fp[x, y])]
    if green:
        a = min(green, key=lambda p: p[0] + p[1])
        b = max(green, key=lambda p: p[0] + p[1])
        out['start'] = [[round(a[0] / fw, 5), round(a[1] / fh, 5)],
                        [round(b[0] / fw, 5), round(b[1] / fh, 5)]]

    out['shapes'].sort(key=lambda s: -s['area'])
    dst = src.with_name(f'{venue}-geo.js')
    dst.write_text('// GENERATED by art/bake_mask.py - do not edit.\n'
                   '// Emitted as JS rather than JSON because the eval harness loads the\n'
                   '// page over file://, where fetch() is blocked by CORS.\n'
                   'window.VENUE_GEO = window.VENUE_GEO || {};\n'
                   f'window.VENUE_GEO[{venue!r}] = ' + json.dumps(out) + ';\n')
    tot = sum(len(s['ring']) for s in out['shapes'])
    print(f'{dst.relative_to(ROOT)}: {len(out["shapes"])} shapes, {tot} vertices')
    if out.get('start'):
        print(f"   start line: {out['start'][0]} -> {out['start'][1]}")
    for s in out['shapes'][:12]:
        print(f"   {s['cls']:8} area {s['area']:6}  verts {len(s['ring']):4}  "
              f"c=({s['c'][0]:.3f},{s['c'][1]:.3f}) r={s['r']:.3f}")


if __name__ == '__main__':
    main()
