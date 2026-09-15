#!/usr/bin/env python3
"""Build the Otter Point venue document — the California coast, laid out from a design brief.

    python3 regatta/art/build_otter.py                 # write assets/venues/otter.venue.js
    python3 regatta/art/build_otter.py --scale 0.92    # shrink the whole map (course time knob)
    python3 regatta/art/build_otter.py --seed 11       # a different coast noise / planting
    python3 regatta/art/build_otter.py --dry           # report only, write nothing
    python3 regatta/art/build_otter.py --plant         # also scatter vegetation props (off by default)

Deterministic: same seed, same coast. Re-run after changing a parameter and everything
that hangs off the geometry — terrain bands, shallows, kelp, wind partition, props —
follows the new shoreline. The document it writes has NO course.paths; bake those in
editor.html (Save) or with the headless harness so the chart, the ruler and the time
estimate read the real sailable path.

THE DESIGN (Wes, 2026-09-13), in one paragraph. A one-way coastal course shaped like a
long hook: a protected start in the lee of a spur, an upwind beat along a granite coast
to a major headland guarded by offshore rocks (inside / middle / outside), a rounding
mark just beyond the point, then a long reach down a coast of alternating points and
coves that curves progressively away from the wind (100 -> 160 TWA), a late rock gate
(short inside channel vs longer outside route), and a finish in a protected bay behind
an entrance islet. The recurring question is "how close to shore?": inshore is shorter,
flatter and kelp-taxed under lighter, shiftier wind; offshore is longer under steadier
pressure.

HOW IT IS BUILT. Everything is authored in a DESIGN FRAME where the wind blows straight
down the map (direction 0, the editor's own convention), because a beat "up" and a
reach "across" are easy to reason about there. The finished map is then rotated 45° so
the prevailing wind is a northwesterly on the HUD's compass. Distances are in world
units, 5 per metre (VenueDoc.U_PER_M).

THE OBJECT LAYER (reworked 2026-09-14 against sixteen aerials of Point Lobos, Point
Pinos, Pebble Beach, Carmel Highlands and Big Sur). What those photographs agree on:

  * The coast is SCALLOPED. Between the big points the shore is a run of small round
    coves 60-120 m across bitten into the granite, separated by narrow finger points, so
    no stretch of shoreline is a smooth arc. Here every macro edge of the coast carries
    one to three bites and a finger between them, generated once and shared by every
    contour that follows the shore (granite, meadow, forest, wet rock, shelf) so the
    bands nest cleanly.
  * The LAND IS FOREST. Cypress floor is the interior, and it reaches nearly to the
    rock in the sheltered stretches (Pebble Beach, Carmel Highlands, the finish bay).
    Meadow — the tan scrub of the Point Lobos flats — is the cover of the exposed points
    and the tip, with cypress clumps standing on it and clearings punched in the forest.
  * The pale granite is a RAGGED BAND of very uneven width: broad ledges on the points,
    a sheer rim in the coves, toothed everywhere.
  * The dark wet rock (tidepool) is the LOWEST band, wide and toothed at the points, a
    thin rim in the coves, gone at the beaches; plus detached reefs and long fingers
    running seaward off the big points, with water behind them.
  * Off every point there are ISLETS — elongated ridges lying on one grain, in
    clusters, with sunken rock and turquoise shallows around them — and one or two
    rocks stand in the mouth of every cove.
  * Kelp is many SMALL STREAKS, not a few big beds: off the points in the deeper water,
    inside the coves, along the inside line of the beat.
  * Pocket beaches at the cove heads; one long crescent at the head of the bay.

Z-ORDER is document order, back to front: shallows, sunken rock, kelp, the wet-rock
apron and its fingers, reefs and islet halos, then the coast (granite), the meadow ring,
the forest, the point flats and clearings, cypress clumps, the beaches, and the islets on top. WIND is
a PARTITION — an offshore polygon and a coastal band cut into stations, all abutting
with the same falloff so the blend is a partition of unity — because unstated water is
calm and overlapping regions average.
"""
import argparse, json, math, pathlib, random, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "venues" / "otter.venue.js"

U_PER_M = 5
VERBOSE = False
# ── the vertex-budget knobs (Wes, 2026-09-14: the whole document under ~1,500 vertices) ──
TOL = {"coast": 22, "shelf-apron": 32, "meadow": 40, "forest": 50, "sand": 20}   # Douglas-Peucker tolerance per ring (units; ~1 px each)
COAST_NOISE = ((760, 280, 130), (1.0, 0.5, 0.2))     # wavelengths / weights of the shoreline noise
MAX_BITES = 3                                        # coves per macro edge, at most
FINGER_P = 0.65                                      # chance of a finger between two coves

# ── geometry helpers ─────────────────────────────────────────────────────────
def seg_intersect(a, b, c, d):
    def orient(p, q, r):
        v = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
        return 0 if abs(v) < 1e-9 else (1 if v > 0 else -1)
    o1, o2, o3, o4 = orient(a, b, c), orient(a, b, d), orient(c, d, a), orient(c, d, b)
    return o1 != o2 and o3 != o4 and o1 != 0 and o2 != 0 and o3 != 0 and o4 != 0

def ring_self_intersects(pts):
    n = len(pts)
    segs = [(pts[i], pts[(i + 1) % n]) for i in range(n)]
    bb = [(min(a[0], b[0]), max(a[0], b[0]), min(a[1], b[1]), max(a[1], b[1])) for a, b in segs]
    for i in range(n):
        a, b = segs[i]; x0, x1, y0, y1 = bb[i]
        for j in range(i + 2, n):
            if i == 0 and j == n - 1: continue
            q = bb[j]
            if q[0] > x1 or q[1] < x0 or q[2] > y1 or q[3] < y0: continue
            c, d = segs[j]
            if seg_intersect(a, b, c, d): return (i, j)
    return None

def untangle(ring, owner=None, max_iter=80):
    """Cut the inverted loops an offset ring grows at a sharp corner: at every self-
    intersection drop the SHORTER of the two loops it closes. Returns (ring, owner, cut)."""
    ring = list(ring); owner = list(owner) if owner is not None else None; cut = 0
    for _ in range(max_iter):
        si = ring_self_intersects(ring)
        if not si: return ring, owner, cut
        i, j = si; m = len(ring)
        if j - i <= m - (j - i):
            ring = ring[:i + 1] + ring[j + 1:]
            if owner is not None: owner = owner[:i + 1] + owner[j + 1:]
            cut += j - i
        else:
            ring = ring[i + 1:j + 1]
            if owner is not None: owner = owner[i + 1:j + 1]
            cut += m - (j - i)
    return None, None, cut

def ring_area(pts):
    s = 0
    for i in range(len(pts)):
        x1, y1 = pts[i]; x2, y2 = pts[(i + 1) % len(pts)]
        s += x1 * y2 - x2 * y1
    return s / 2

def point_in_poly(p, poly):
    x, y = p; inside = False; n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            xi = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if xi > x: inside = not inside
    return inside

def dist_to_ring(p, poly):
    best = 1e18; n = len(poly)
    for i in range(n):
        ax, ay = poly[i]; bx, by = poly[(i + 1) % n]
        dx, dy = bx - ax, by - ay
        t = 0 if dx == dy == 0 else max(0, min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy)))
        qx, qy = ax + t * dx, ay + t * dy
        best = min(best, math.hypot(p[0] - qx, p[1] - qy))
    return best

def rot(p, ang):
    c, s = math.cos(ang), math.sin(ang)
    return [p[0] * c - p[1] * s, p[0] * s + p[1] * c]

def r1(v): return round(v * 10) / 10

# A noise field along a polyline: sum of sines at three wavelengths with random phases.
def make_noise(rng, amp, wavelengths=(900, 340, 130), weights=(1.0, 0.5, 0.25)):
    phases = [rng.uniform(0, 2 * math.pi) for _ in wavelengths]
    def f(t):
        return amp * sum(w * math.sin(2 * math.pi * t / L + ph) for L, w, ph in zip(wavelengths, weights, phases)) / sum(weights)
    return f

def bump(s):
    """A cove: a semi-ellipse — a round floor and sheer sides, the way granite coves are cut."""
    return math.sqrt(max(0.0, 1 - s * s))

def spike(s):
    """A finger point: a narrower tongue with the same rounded end."""
    return math.sqrt(max(0.0, 1 - s * s)) ** 1.5 if abs(s) < 1 else 0.0

def simplify(pts, tol):
    """Douglas-Peucker on a closed ring: split at the vertex farthest from vertex 0, simplify
    both halves, and keep every vertex that matters to within `tol` units."""
    if len(pts) < 5 or tol <= 0: return pts
    def dseg(p, a, b):
        dx, dy = b[0] - a[0], b[1] - a[1]; L2 = dx * dx + dy * dy
        if L2 == 0: return math.hypot(p[0] - a[0], p[1] - a[1])
        t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2))
        return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
    def rec(lo, hi):
        if hi - lo < 2: return [lo, hi]
        a, b = pts[lo], pts[hi]; best, bi = -1, lo
        for i in range(lo + 1, hi):
            dd = dseg(pts[i], a, b)
            if dd > best: best, bi = dd, i
        if best <= tol: return [lo, hi]
        left = rec(lo, bi); right = rec(bi, hi); return left[:-1] + right
    far = max(range(len(pts)), key=lambda i: math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]))
    pts = pts + [pts[0]]                      # rec indexes the closed polyline
    idx = rec(0, far)[:-1] + rec(far, len(pts) - 1)[:-1]
    return [pts[i] for i in idx]

def union_rings(rings, cell, tol):
    """The union of polygons, for a painted tint that overlaps itself: rasterise them onto a
    `cell`-unit grid, trace the boundary of every blob with marching squares, drop holes
    (a tint does not need them) and simplify each loop to `tol`. Returns a list of rings."""
    xs = [p[0] for r in rings for p in r]; ys = [p[1] for r in rings for p in r]
    x0, y0 = min(xs) - 2 * cell, min(ys) - 2 * cell
    W = int((max(xs) - x0) / cell) + 3; H = int((max(ys) - y0) / cell) + 3
    mask = [bytearray(W) for _ in range(H)]
    for r in rings:
        n = len(r)
        jy0 = max(0, int((min(p[1] for p in r) - y0) / cell)); jy1 = min(H - 1, int((max(p[1] for p in r) - y0) / cell) + 1)
        for j in range(jy0, jy1 + 1):
            yc = y0 + (j + 0.5) * cell; cross = []
            for i in range(n):
                a, b = r[i], r[(i + 1) % n]
                if (a[1] > yc) != (b[1] > yc): cross.append(a[0] + (yc - a[1]) * (b[0] - a[0]) / (b[1] - a[1]))
            cross.sort()
            for k in range(0, len(cross) - 1, 2):
                i0 = max(0, int((cross[k] - x0) / cell + 0.5)); i1 = min(W - 1, int((cross[k + 1] - x0) / cell - 0.5))
                row = mask[j]
                for i in range(i0, i1 + 1): row[i] = 1
    # marching squares over 2x2 windows of cell centres; sides T=0 R=1 B=2 L=3
    TABLE = {1: [(3, 2)], 2: [(2, 1)], 3: [(3, 1)], 4: [(0, 1)], 5: [(0, 1), (3, 2)], 6: [(0, 2)], 7: [(0, 3)],
             8: [(0, 3)], 9: [(0, 2)], 10: [(0, 3), (2, 1)], 11: [(0, 1)], 12: [(3, 1)], 13: [(2, 1)], 14: [(3, 2)]}
    def key(i, j, side):        # a side midpoint, named so neighbouring windows share it
        return ('h', i, j) if side == 0 else ('v', i + 1, j) if side == 1 else ('h', i, j + 1) if side == 2 else ('v', i, j)
    adj = {}
    for j in range(H - 1):
        r0, r1 = mask[j], mask[j + 1]
        for i in range(W - 1):
            idx = r0[i] * 8 + r0[i + 1] * 4 + r1[i + 1] * 2 + r1[i]
            if idx == 0 or idx == 15: continue
            for sa, sb in TABLE[idx]:
                ka, kb = key(i, j, sa), key(i, j, sb)
                adj.setdefault(ka, []).append(kb); adj.setdefault(kb, []).append(ka)
    def coord(k):
        return [x0 + (k[1] + 1) * cell, y0 + (k[2] + 0.5) * cell] if k[0] == 'h' else [x0 + (k[1] + 0.5) * cell, y0 + (k[2] + 1) * cell]
    seen = set(); loops = []
    for start in adj:
        if start in seen: continue
        loop = [start]; seen.add(start); prev, cur = None, start
        while True:
            nxt = [k for k in adj[cur] if k != prev and k not in seen]
            if not nxt: break
            prev, cur = cur, nxt[0]; loop.append(cur); seen.add(cur)
        if len(loop) >= 4: loops.append([coord(k) for k in loop])
    # drop holes: a loop whose first vertex lies inside another loop
    outer = [L for L in loops if not any(M is not L and point_in_poly(L[0], M) for M in loops)]
    out = []
    for L in outer:
        L2 = simplify(L, tol)
        if ring_self_intersects(L2): L2, _, _ = untangle(L2)
        if L2 and len(L2) >= 4 and abs(ring_area(L2)) > (3 * cell) ** 2: out.append(L2)
    return out

def blob(cx, cy, rx, ry, rng, n=None, rough=0.18, ang=0.0):
    """An irregular ellipse. Its vertex count follows its size (about one vertex per 75u of
    perimeter, 6..14) unless given — the document's vertex budget is tight."""
    if n is None: n = max(6, min(8, round(2 * math.pi * math.sqrt((rx * rx + ry * ry) / 2) / 100)))
    pts = []
    ph = [rng.uniform(0, 2 * math.pi) for _ in range(3)]
    for i in range(n):
        a = 2 * math.pi * i / n
        r = 1 + rough * (0.6 * math.sin(2 * a + ph[0]) + 0.3 * math.sin(3 * a + ph[1]) + 0.25 * math.sin(5 * a + ph[2]))
        x, y = rx * r * math.cos(a), ry * r * math.sin(a)
        pts.append([cx + x * math.cos(ang) - y * math.sin(ang), cy + x * math.sin(ang) + y * math.cos(ang)])
    return pts

# ── the design, in the wind-down frame ───────────────────────────────────────
def design(scale, seed):
    rng = random.Random(seed)
    S = scale
    P = lambda x, y: [x * S, y * S]

    # The landmass: a triangle-ish peninsula with its tip at the top (upwind), the beat
    # coast on its west edge, the reach coast on its hypotenuse, attached to the mainland
    # at the bottom-right. Listed CLOCKWISE on screen (y down) starting at the tip.
    # Names in comments are the features the brief asks for.
    land_anchors = [
        P(0, -3400),        # 0  H  the headland tip
        P(700, -3000),      # 1  cove 1 (sand pocket)
        P(1550, -3320),     # 2  Q1 point
        P(2100, -2600),     # 3  cove 2
        P(3000, -2720),     # 4  Q2 point
        P(3500, -1900),     # 5  cove 3
        P(4300, -1950),     # 6  Q3 point
        P(4700, -1100),     # 7  cove 4 (sand pocket)
        P(5400, -1050),     # 8  Q4 point
        P(5750, -200),      # 9  cove 5
        P(6300, 80),        # 10 Q5 point — the coast starts to turn downwind
        P(6500, 900),       # 11
        P(6650, 1700),      # 12 the rock gate's inside channel runs past here
        P(7050, 2300),      # 13 Q6 point
        P(7350, 2850),      # 14 bay north point
        P(6800, 3050),      # 15 bay: inner shore
        P(6100, 3500),      # 16 bay head (sand) — the bay is ~1400u deep so a finish line fits
        P(6250, 4100),      # 17   with 500u of water round each mark (the first cut's marks sat
        P(6700, 4500),      # 18   on the shore and the whole fleet grounded trying to cross)
        P(7150, 4650),      # 19 bay south point
        P(7700, 4800),      # 20
        P(8200, 5300),      # 21 runs off the map to the bottom-right
        P(11000, 8000),     # 22 off-map corner (straight edges from here)
        P(-800, 8000),      # 23 off-map bottom
        P(-800, 4900),      # 24 back on the map, bottom-left of the land
        P(150, 3600),       # 25
        P(-100, 2800),      # 26 start cove
        P(300, 2250),       # 27 start cove head (sand)
        P(0, 1550),         # 28 spur base south
        P(-900, 1150),      # 29 the SPUR tip — the start's shelter
        P(-150, 800),       # 30 spur base north
        P(350, 350),        # 31 cove
        P(-200, -300),      # 32 P3 point
        P(250, -900),       # 33 cove
        P(-320, -1500),     # 34 P2 point
        P(200, -2200),      # 35 cove
        P(-260, -2900),     # 36 P1 point
    ]
    n = len(land_anchors)
    offmap_idx = set(range(20, 25))     # anchors that sit off the map (or on its very edge)
    offmap_edges = {21, 22, 23}         # edges that run wholly off the map: dead straight

    def nrm(p, q):
        L = math.hypot(q[0] - p[0], q[1] - p[1]) or 1
        return (-(q[1] - p[1]) / L, (q[0] - p[0]) / L)
    def offset_ring_var(anchors, dfn):
        """Each anchor moved along the bisector of its two edge normals by dfn(i)."""
        out = []
        for i in range(len(anchors)):
            a, b, c = anchors[i - 1], anchors[i], anchors[(i + 1) % len(anchors)]
            n1, n2 = nrm(a, b), nrm(b, c)
            nx, ny = n1[0] + n2[0], n1[1] + n2[1]; L = math.hypot(nx, ny) or 1
            out.append([b[0] + nx / L * dfn(i), b[1] + ny / L * dfn(i)])
        return out
    # which side is seaward? push the ring out by 100 and see whether it grew
    sign = 1 if abs(ring_area(offset_ring_var(land_anchors, lambda i: 100))) > abs(ring_area(land_anchors)) else -1
    def bisector_out(i):
        """Unit outward normal at anchor i (the seaward bisector — works at coves too)."""
        a, b, c = land_anchors[i - 1], land_anchors[i], land_anchors[(i + 1) % n]
        n1, n2 = nrm(a, b), nrm(b, c); nx, ny = n1[0] + n2[0], n1[1] + n2[1]; L = math.hypot(nx, ny) or 1
        return sign * nx / L, sign * ny / L
    def off_point(i, out, side=0):
        """A point `out` seaward of anchor i, shifted `side` along the coast (unscaled units)."""
        nx, ny = bisector_out(i); b = land_anchors[i]
        return [b[0] + nx * out * S - ny * side * S, b[1] + ny * out * S + nx * side * S]
    def grain(i):
        """The angle ridges off anchor i lie on: seaward along the point's own axis."""
        nx, ny = bisector_out(i); return math.atan2(ny, nx)
    edge_len = [math.hypot(land_anchors[(i + 1) % n][0] - land_anchors[i][0], land_anchors[(i + 1) % n][1] - land_anchors[i][1]) for i in range(n)]
    edge_t0 = [sum(edge_len[:i]) for i in range(n)]

    # ── THE SHORE'S CHARACTER, per anchor — an authored table, indices as in the list above ──
    # The wet-rock apron's seaward reach: far at the points, a thin rim elsewhere, hidden
    # under the granite at the beaches and along the off-map edges.
    point_idx = {0: 160, 2: 130, 4: 140, 6: 130, 8: 140, 10: 150, 13: 120, 14: 140, 19: 120, 29: 140, 32: 130, 34: 140, 36: 130}
    hidden_idx = {1, 5, 7, 9, 16, 17, 27}       # the beaches: sand meets the water, no wet rim
    def apron_d(i):
        if i in point_idx: return point_idx[i] * S
        if i in hidden_idx: return -120 * S
        if i in offmap_idx: return -120 * S
        return 35 * S                           # a thin wet lip everywhere else
    # The dry granite's width (how far the meadow stands back from the water): broad pale
    # ledges at the points, a sheer rim at the cove heads and along the sheltered shores.
    granite_w = {0: 460, 2: 400, 4: 410, 6: 400, 8: 400, 10: 430, 13: 340, 14: 400, 19: 320, 29: 400, 32: 380, 34: 400, 36: 400,
                 1: 130, 5: 140, 7: 130, 16: 110, 27: 130, 15: 150, 17: 150, 18: 160, 26: 150, 28: 160}
    def granite_d(i): return granite_w.get(i, 150 if i in offmap_idx else 220) * S
    # The forest's edge: the cypress floor is the interior, so this is how far inland it
    # starts. Deep at the tip and the points (Point Lobos's meadow flats), close to the
    # rock in the coves, the bay and the start cove (Pebble Beach, Carmel Highlands).
    forest_w = {36: 520, 0: 600, 1: 420, 2: 560, 3: 340, 4: 560, 5: 210, 6: 560, 7: 340, 8: 560, 9: 210, 10: 540, 11: 260, 12: 260,
                13: 480, 14: 440, 15: 200, 16: 240, 17: 240, 18: 210, 19: 400, 20: 320, 25: 280, 26: 240, 27: 280, 28: 290, 29: 480,
                30: 290, 31: 210, 32: 520, 33: 220, 34: 540, 35: 400}
    def forest_d(i): return forest_w.get(i, 300) * S
    # THE POINT FLATS: on top of that inset, the forest edge bows a further few hundred units
    # inland around every point anchor (a bump spanning a fraction of each neighbouring edge),
    # so each point is a broad meadow flat with the wood standing back from it — the Point
    # Lobos read — and the flat is continuous with the meadow ring rather than a blob on it.
    flats = {0: (520, 0.7), 2: (400, 0.55), 4: (400, 0.55), 6: (400, 0.55), 8: (380, 0.55), 10: (400, 0.55), 14: (300, 0.5),
             29: (340, 0.55), 32: (400, 0.55), 34: (420, 0.55), 36: (400, 0.6), 19: (260, 0.45)}

    # ── THE SCALLOPS: where each macro edge bites in (a cove) and juts out (a finger) ──
    # Generated once, in edge-parameter space, and shared by every contour so the granite,
    # the meadow, the forest and the wet rock all follow the same coves.
    gentle_edges = {14, 15, 16, 17, 25, 26}                    # the bay's inner shore, the start cove: broad shallow bights
    max_bite = {27: 100, 28: 45, 29: 45, 30: 120, 19: 140, 0: 200, 36: 200}   # the spur and the tip are narrow — never cut through
    frng = random.Random(seed * 31 + 5)
    feats = []
    for i in range(n):
        L = edge_len[i] / S
        if i in offmap_edges: feats.append([]); continue
        gentle = i in gentle_edges
        k = 1 if gentle else max(1, min(MAX_BITES, round(L / 480 + frng.uniform(-0.45, 0.45))))
        f = []
        for j in range(k):
            uc = (j + 0.5) / k + frng.uniform(-0.07, 0.07)
            hw = (0.5 / k) * frng.uniform(0.5, 0.85)
            uc = min(max(uc, hw + 0.06), 1 - hw - 0.06)      # a bite never reaches an anchor: the points keep their tips
            depth = frng.uniform(90, 280) * (0.5 if gentle else 1.0)
            depth = min(depth, max_bite.get(i, 1e9))
            f.append((uc, hw, depth * S, 'bite'))
            if not gentle and j < k - 1 and frng.random() < FINGER_P:
                f.append(((j + 1) / k + frng.uniform(-0.03, 0.03), (0.5 / k) * frng.uniform(0.22, 0.36), frng.uniform(90, 210) * S, 'finger'))
        feats.append(f)

    noise_main = make_noise(random.Random(seed * 3 + 1), 1.0, wavelengths=COAST_NOISE[0], weights=COAST_NOISE[1])
    def contour(off_fn, bite_k, finger_k, amp, step, noise=noise_main, teeth=None, anchor_flats=None):
        """A ring that follows the coast: the anchors pushed by off_fn (seaward positive),
        the shared scallops scaled by bite_k / finger_k, and a noise ribbon of amplitude
        `amp` parametrised by the COAST's arc length so every contour shares one noise and
        nests inside the next. `teeth` adds a second, shorter noise (the apron's edge)."""
        base = offset_ring_var(land_anchors, lambda i: sign * off_fn(i))
        out = []; owner = []
        for i in range(n):
            a, b = base[i], base[(i + 1) % n]
            L = math.hypot(b[0] - a[0], b[1] - a[1]) or 1
            k = 1 if i in offmap_edges else max(1, int(L / step))     # a dead-straight edge is ONE segment
            nx, ny = nrm(a, b); nx, ny = sign * nx, sign * ny
            A = 0 if i in offmap_edges else amp
            fs = min(1.0, L / edge_len[i])          # an inset edge much shorter than its macro edge gets shallower features
            for s in range(k):
                u = s / k
                d = 0.0
                for (uc, hw, mag, kind) in feats[i]:
                    if kind == 'bite': d -= min(mag * bite_k * fs, 0.45 * L) * bump((u - uc) / hw)
                    else: d += min(mag * finger_k * min(1.0, fs * 1.2), 0.6 * L) * spike((u - uc) / hw)
                if anchor_flats:        # a flat centred on anchor i (this edge's start) or i+1 (its end)
                    fa = anchor_flats.get(i); fb = anchor_flats.get((i + 1) % n)
                    if fa and u < fa[1]: d -= fa[0] * S * bump(u / fa[1])
                    if fb and (1 - u) < fb[1]: d -= fb[0] * S * bump((1 - u) / fb[1])
                if A:
                    t = edge_t0[i] + u * edge_len[i]
                    taper = 0.35 + 0.65 * math.sin(math.pi * u)
                    d += noise(t) * A * taper
                    if teeth: d += teeth[0](t) * teeth[1] * taper
                out.append([a[0] + (b[0] - a[0]) * u + nx * d, a[1] + (b[1] - a[1]) * u + ny * d]); owner.append(i)
        contour.owner = owner
        return out
    def simple_contour(name, off_fn, bite_k, finger_k, amp, step, cut_frac=0.06, **kw):
        for ra, fk in ((1.0, 1.0), (0.7, 1.0), (0.5, 0.85), (0.3, 0.7), (0, 0.5), (0, 0)):
            ring = contour(off_fn, bite_k * fk, finger_k * fk, amp * ra, step, **kw)
            si = ring_self_intersects(ring)
            if not si:
                if (ra, fk) != (1.0, 1.0): print(f"  note: {name} simplified (rough x{ra}, features x{fk})", file=sys.stderr)
                return ring
            if VERBOSE: print(f"  {name} (rough x{ra}, features x{fk}) folds on macro edges {contour.owner[si[0]]} and {contour.owner[si[1]]}", file=sys.stderr)
            fixed, own, cut = untangle(ring, contour.owner)
            if fixed is not None and cut <= cut_frac * len(ring):
                if VERBOSE: print(f"  {name}: untangled by cutting {cut} of {len(ring)} vertices (macro edges {sorted(set(contour.owner) - set(own))} lost)", file=sys.stderr)
                return fixed
        return None

    land = simple_contour("coast", lambda i: 0, 1.0, 1.0, 65 * S, 55)
    if land is None: raise SystemExit("coast: no simple ring")
    # the meadow's edge follows the scallops only loosely: a small cove is rock-walled, so the
    # granite widens at its head rather than the meadow dipping in (and the ring is cheaper)
    meadow = simple_contour("meadow", lambda i: -granite_d(i), 0.35, 0.2, 40 * S, 90)
    forest = None
    forest_noise = make_noise(random.Random(seed * 3 + 1), 1.0, wavelengths=(1500, 560), weights=(1.0, 0.5))
    for fs in (1.0, 0.85, 0.7, 0.55):
        forest = simple_contour("forest", lambda i: -forest_d(i) * fs, 0.15, 0.0, 130 * S, 150, cut_frac=0.14, noise=forest_noise, anchor_flats=flats)
        if forest: break
        print(f"  note: forest inset x{fs} folded — trying shallower", file=sys.stderr)
    # The apron is SMOOTH (no noise): the coast's own noise then decides the wet lip's width —
    # where the granite bulges out it covers the lip, where it bites in the lip widens to
    # ~100u — which is the varying waterline the photographs show, at a third of the vertices.
    apron = simple_contour("apron", apron_d, 0.9, 1.35, 0, 70)
    shelf = simple_contour("shelf", lambda i: max(260 * S, apron_d(i) + 260 * S), 0.3, 1.0, 0, 250)
    if not (meadow and forest and apron and shelf): raise SystemExit("a coast contour would not come simple")

    # Cypress clumps standing on the meadow of the points (Cypress Point, the Lone Cypress's
    # kind of ground) — forest blobs drawn over the meadow ring, between the ledge and the wood.
    def inland(i, d, side=0):
        nx, ny = bisector_out(i); b = land_anchors[i]
        return [b[0] - nx * d * S - ny * side * S, b[1] - ny * d * S + nx * side * S]
    def fit_inside(ring, container):
        """Shrink a blob about its centre until every vertex is on the land; None if it never fits."""
        for _ in range(5):
            if all(point_in_poly(q, container) for q in ring): return ring
            cx = sum(q[0] for q in ring) / len(ring); cy = sum(q[1] for q in ring) / len(ring)
            ring = [[cx + (q[0] - cx) * 0.85, cy + (q[1] - cy) * 0.85] for q in ring]
        return None
    clumps = []
    for (i, dd, sd, rx, ry) in [(0, 620, 120, 170, 120), (2, 470, -90, 150, 105), (4, 480, 110, 160, 110),
                                 (6, 430, -80, 150, 100), (8, 430, 100, 140, 100), (10, 460, -120, 170, 115),
                                 (29, 420, 60, 150, 105), (34, 430, 100, 150, 105), (36, 420, -60, 130, 95)]:
        g = fit_inside(blob(*inland(i, dd, sd), rx * S, ry * S, rng, n=5, rough=0.3, ang=rng.uniform(0, 3)), land)
        if g: clumps.append(g)
    # Clearings punched in the forest — the tan flats behind the coves and above the bay.
    clearings = [
        blob(*P(1250, -2330), 380 * S, 250 * S, rng, n=6, rough=0.3, ang=0.4),
        blob(*P(2750, -1500), 420 * S, 270 * S, rng, n=6, rough=0.3, ang=0.3),
        blob(*P(4200, -500), 360 * S, 250 * S, rng, n=6, rough=0.3, ang=0.5),
        blob(*P(650, 650), 300 * S, 230 * S, rng, n=6, rough=0.3, ang=0.2),
        blob(*P(5550, 3650), 320 * S, 230 * S, rng, n=6, rough=0.3, ang=1.3),
    ]
    clearings = [g for g in (fit_inside(c, land) for c in clearings) if g]
    # BEACHES. In every reference (Gibson Beach, China Cove, the Carmel crescent) the sand
    # fills the cove head WALL TO WALL between the rock, its shoreline is the cove's own
    # concave curve, it meets the water with no dark rim, and a smooth arc at the foot of
    # the bluff closes it. So a beach here is a LENS: its seaward edge is a run of the coast
    # itself (pushed 12u out so the sand reaches the water), its back a semi-ellipse arc.
    def beach(anchor_pt, out, half_w, depth):
        m = len(land)
        k0 = min(range(m), key=lambda k: math.hypot(land[k][0] - anchor_pt[0], land[k][1] - anchor_pt[1]))
        run = [k0]
        for step_dir in (1, -1):
            acc = 0; k = k0
            while acc < half_w * S:
                nk = (k + step_dir) % m; acc += math.hypot(land[nk][0] - land[k][0], land[nk][1] - land[k][1])
                run.append(nk) if step_dir == 1 else run.insert(0, nk); k = nk
        pts = [land[k] for k in run]
        L = [0.0]
        for a, b in zip(pts, pts[1:]): L.append(L[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
        tot = L[-1] or 1
        # each vertex moves along ITS OWN seaward normal (a bay head is a U — one shared
        # direction would slide the ends along the coast and fold the lens)
        norms = []
        for j in range(len(pts)):
            a, b = pts[max(0, j - 1)], pts[min(len(pts) - 1, j + 1)]
            nx, ny = nrm(a, b)
            if nx * out[0] + ny * out[1] < 0: nx, ny = -nx, -ny
            norms.append((nx, ny))
        front = [[p[0] + nx * 12 * S, p[1] + ny * 12 * S] for p, (nx, ny) in zip(pts, norms)]
        # the back arc is drawn from a SMOOTHED run (a 7-vertex moving average) so the coast's
        # own wiggles do not fold an inward offset, then untangled in case one still does
        def smooth(v, j):
            w = [v[max(0, min(len(v) - 1, j + t))] for t in range(-3, 4)]
            return sum(q[0] for q in w) / len(w), sum(q[1] for q in w) / len(w)
        back = []
        for j in range(len(pts)):
            px, py = smooth(pts, j); nx, ny = smooth(norms, j); nl = math.hypot(nx, ny) or 1
            dpt = depth * S * bump(2 * L[j] / tot - 1)
            back.append([px - nx / nl * dpt, py - ny / nl * dpt])
        ring = front + list(reversed(back)); clean = [ring[0]]
        for q in ring[1:]:
            if math.hypot(q[0] - clean[-1][0], q[1] - clean[-1][1]) > 3: clean.append(q)
        if math.hypot(clean[0][0] - clean[-1][0], clean[0][1] - clean[-1][1]) <= 3: clean.pop()
        fixed, _, cut = untangle(clean)
        return fixed if fixed is not None else clean
    def edge_mid(i):
        a, b = land_anchors[i], land_anchors[(i + 1) % n]; nx, ny = nrm(a, b)
        return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], (sign * nx, sign * ny)
    beach_spots = [(land_anchors[1], bisector_out(1), 300, 200),      # cove 1
                   (land_anchors[5], bisector_out(5), 240, 150),      # cove 3
                   (land_anchors[7], bisector_out(7), 320, 220),      # cove 4
                   (land_anchors[9], bisector_out(9), 220, 140),      # cove 5
                   (*edge_mid(27), 260, 170),                          # the start cove: the bight under the spur base
                   (*edge_mid(16), 720, 150)]                          # the bay head: one long crescent
    sands = [beach(pt, out, hw, dp) for pt, out, hw, dp in beach_spots]

    # ── THE WET ROCK: the apron, the point fingers, the detached reefs, the islet halos ──
    shelves = [("shelf-apron", apron)]
    # FINGERS: long thin ridges running seaward from the big points, some detached from the
    # apron by a gap of water so they read as reefs with a channel behind them
    # Every finger has a GRANITE CORE — the pale ridge is the body of the thing and the wet
    # rock its fringe (Point Lobos's fingers are pale on top, dark at the waterline). An
    # attached finger's core runs from the coast; a detached one's is a low islet.
    cores = []      # [id, ring, height] — granite, drawn right after the coast
    fingers = [(0, 520, 110, False), (2, 420, 95, True), (6, 460, 100, False), (10, 300, 90, True),
               (34, 380, 90, False), (29, 220, 90, False), (14, 340, 90, True)]
    for i, length, width, detached in fingers:
        dx, dy = bisector_out(i); b = land_anchors[i]; a = math.atan2(dy, dx)
        reach = (apron_d(i) + (260 if detached else 60) * S + length * S / 2)
        cx, cy = b[0] + dx * reach, b[1] + dy * reach
        shelves.append((f"finger-{i}", blob(cx, cy, length * S / 2, width * S / 2, rng, n=8, rough=0.3, ang=a)))
        if detached:
            cores.append((f"finger-{i}-core", blob(cx, cy, length * 0.62 * S / 2, width * 0.7 * S / 2, rng, n=7, rough=0.3, ang=a), 6))
        else:
            span = reach + length * 0.2 * S + 60 * S          # from 60u inside the coast to 70% of the way out
            cores.append((f"finger-{i}-core", blob(b[0] + dx * (span / 2 - 60 * S), b[1] + dy * (span / 2 - 60 * S), span / 2, width * 0.7 * S / 2, rng, n=7, rough=0.25, ang=a), 25))
    # DETACHED REEFS off the exposed stretches — the Point Pinos read, rocks everywhere with
    # surf on them; kept out of the gate channel and the bay mouth, which every boat must use.
    # Each has a low granite top so it reads as a rock standing in the water, not a stain.
    for i, out, rx, ry in [(36, 720, 150, 110), (4, 700, 170, 120), (8, 720, 160, 110), (13, 640, 140, 100), (32, 640, 130, 100)]:
        c = off_point(i, out); a = grain(i) + rng.uniform(-0.5, 0.5)
        shelves.append((f"reef-{i}", blob(c[0], c[1], rx * S, ry * S, rng, n=7, rough=0.3, ang=a)))
        cores.append((f"reef-{i}-top", blob(c[0], c[1], rx * 0.5 * S, ry * 0.45 * S, rng, n=5, rough=0.3, ang=a), 3))

    # ── ISLETS: dry granite. [id, centre, rx, ry, height, angle] — ridges lie on the grain
    # of the point they stand off (their long axis runs seaward), the way the Bird Island
    # ridges continue Point Lobos. The five named rocks are the course's own furniture
    # (the headland's three lines, the gate, the bay) and keep their places.
    tip_grain = math.atan2(-4470 + 3960, -1280 + 470)          # rock A -> rock B: the chain's own line
    islets = [
        ("rock-a",     P(-470, -3960), 150, 120, 8, rng.uniform(0, 3)),
        ("rock-b",     P(-1280, -4470), 250, 200, 12, rng.uniform(0, 3)),
        ("gate-1",     P(7380, 1130), 280, 220, 10, rng.uniform(0, 3)),
        ("gate-2",     P(7850, 1900), 240, 190, 9, rng.uniform(0, 3)),
        ("bay-islet",  P(7700, 3350), 210, 170, 8, rng.uniform(0, 3)),
        # the bird rocks: the chain continues beyond rock B on the same grain
        ("bird-1",     P(-1640, -4790), 170, 60, 9, tip_grain),
        ("bird-2",     P(-1930, -5010), 120, 45, 7, tip_grain + 0.15),
        # the points: a ridge outside each reef or finger and a smaller rock beside it, so
        # every point ends in a GROUP of rock of three sizes (finger or reef, ridge, stack)
        ("q1-rock",    off_point(2, 960, 70), 110, 45, 7, grain(2)),
        ("q1-stack",   off_point(2, 700, -190), 65, 35, 5, grain(2) + 0.5),
        ("q2-rock",    off_point(4, 930, 130), 130, 50, 8, grain(4)),
        ("q2-stack",   off_point(4, 640, -200), 60, 35, 5, grain(4) - 0.4),
        ("q3-rock",    off_point(6, 920, -100), 120, 50, 7, grain(6)),
        ("q3-stack",   off_point(6, 660, 180), 70, 35, 5, grain(6) + 0.3),
        ("q4-rock",    off_point(8, 940, 40), 100, 45, 6, grain(8)),
        ("q5-rock",    off_point(10, 1120, 160), 140, 55, 8, grain(10)),
        ("q5-rock-b",  off_point(10, 900, -240), 80, 40, 5, grain(10) + 0.3),
        ("p1-rock",    off_point(36, 940, -60), 110, 45, 7, grain(36)),
        ("p3-rock",    off_point(32, 880, 80), 100, 45, 6, grain(32)),
        ("gate-outer", P(8180, 1650), 90, 40, 6, 0.9),
        # a stack in the mouth of every cove
        ("c1-rock",    off_point(1, 520, 120), 90, 40, 6, grain(1) + 0.4),
        ("c3-rock",    off_point(5, 520, 80), 90, 45, 6, grain(5) + 0.2),
        ("c5-rock",    off_point(9, 470, -120), 85, 40, 5, grain(9) - 0.2),
        # the west coast: a rock off the spur, well clear of the start box
        ("spur-rock",  off_point(29, 820, -260), 100, 45, 6, grain(29)),
    ]
    # SUNKEN ROCK: awash granite, a hard hazard you cannot see from far. [id, centre, r].
    # Only ever in OPTIONAL water — the headland's inside and middle lines, beside the
    # islets, inside the coves — never in the gate, the bay mouth or the start box.
    sunken = [
        ("wash-a", P(-900, -4300), 80), ("wash-b", P(-190, -3660), 60), ("wash-bird", P(-1560, -4560), 60),   # wash A sits on rock B's side of the middle channel: the squeeze is ~230u, not 150
        ("wash-q1", off_point(2, 820, -110), 50), ("wash-q2", off_point(4, 800, -80), 55), ("wash-q3", off_point(6, 780, 60), 50),
        ("wash-q4", off_point(8, 820, 190), 50), ("wash-q5", off_point(10, 1060, -60), 55),
        ("wash-p1", off_point(36, 860, 140), 50), ("wash-p3", off_point(32, 800, -120), 50),
        ("wash-c1", off_point(1, 380, -150), 45), ("wash-c3", off_point(5, 360, -140), 45), ("wash-c4", off_point(7, 380, 120), 45),
        ("wash-w1", off_point(35, 260), 50),
        ("wash-bay-out", P(8000, 3620), 60), ("wash-spur", off_point(29, 700, 160), 50),
    ]
    # every islet of any size stands in a wet halo (the stacks make do with their stroke)
    for sid, c, rx, ry, h, a in islets:
        if rx < 150: continue
        shelves.append((f"shelf-{sid}", blob(c[0], c[1], (rx * 1.25 + 25) * S, (ry * 1.25 + 25) * S, rng, n=8, rough=0.22, ang=a)))

    # ── SHALLOWS: the turquoise. The shelf ring along the whole coast, a blob in every cove,
    # the big shelves at the headland, the gate and the bay, and a halo round every rock
    # cluster (the water over a reef is the palest in every reference).
    shallows = [
        ("shal-shelf", shelf),
        ("shal-head",  blob(*P(-800, -4200), 1500 * S, 1000 * S, rng, n=12, rough=0.15, ang=0.5)),
        ("shal-gate",  blob(*P(7500, 1500), 900 * S, 700 * S, rng, n=10, rough=0.15, ang=0.9)),
        ("shal-bay",   blob(*P(6850, 3700), 1250 * S, 950 * S, rng, n=12, rough=0.15, ang=0.6)),
        ("shal-bay-in", blob(*P(6500, 3800), 620 * S, 450 * S, rng, n=8, rough=0.2, ang=0.6)),
        ("shal-start", blob(*P(-150, 2200), 750 * S, 600 * S, rng, n=9, rough=0.2)),
    ]
    for i in (1, 5, 7, 9):                       # the reach coves (the west coast's coves get the shelf ring alone)
        c = off_point(i, 200)
        shallows.append((f"shal-cove-{i}", blob(c[0], c[1], 440 * S, 340 * S, rng, n=8, rough=0.2, ang=grain(i))))
    for i in (2, 4, 6, 8, 10, 32, 36):          # one pale halo per rock group, lying along the point's grain
        c = off_point(i, 680)
        shallows.append((f"shal-group-{i}", blob(c[0], c[1], 520 * S, 330 * S, rng, n=9, rough=0.2, ang=grain(i))))
    # UNION (Wes, 2026-09-14): the tint is one painted statement, so every blob that overlaps
    # another merges into one outline — no doubled edges where halos cross the shelf, and far
    # fewer vertices. The bay's inner blob stays separate: its overlap is the deliberate stack.
    stack = [sh for sh in shallows if sh[0] == "shal-bay-in"]
    merged = union_rings([ring for sid, ring in shallows if sid != "shal-bay-in"], 24 * S, 60 * S)
    shallows = [(f"shal-union-{k + 1}", ring) for k, ring in enumerate(merged)] + stack

    # ── KELP: many small streaks, each lying roughly along the coast / the swell, drawn as
    # individual mats by the renderer. Along the inside line of the beat (two staggered
    # rows), inside the headland's inside and middle lines, in every cove mouth, in the
    # deeper water off the reach points inshore of the direct line, the gate's inside
    # channel (the short cut's tax) and the bay islet's inner side. Nothing in the bay,
    # the start box or the gate's outer route, which every boat must use.
    kelp = [
        ("kelp-w1", blob(*P(-420, -2620), 130 * S, 330 * S, rng, n=5, rough=0.3, ang=0.1)),
        ("kelp-w1b", blob(*P(-560, -2100), 90 * S, 220 * S, rng, n=5, rough=0.3, ang=-0.1)),
        ("kelp-w2", blob(*P(-400, -1700), 120 * S, 300 * S, rng, n=5, rough=0.3, ang=0.05)),
        ("kelp-w3", blob(*P(-450, -1050), 130 * S, 360 * S, rng, n=5, rough=0.3, ang=-0.1)),
        ("kelp-w4", blob(*P(-360, -200), 110 * S, 280 * S, rng, n=6, rough=0.3)),
        ("kelp-head-in", blob(*P(-330, -3760), 150 * S, 260 * S, rng, n=5, rough=0.3, ang=0.7)),
        ("kelp-head-mid", blob(*P(-900, -4150), 170 * S, 140 * S, rng, n=5, rough=0.3, ang=0.6)),
        ("kelp-c1", blob(*off_point(1, 560, -60), 220 * S, 120 * S, rng, n=5, rough=0.3, ang=grain(1) + 1.57)),
        ("kelp-c2", blob(*off_point(3, 520, 40), 260 * S, 140 * S, rng, n=5, rough=0.3, ang=grain(3) + 1.57)),
        ("kelp-c3", blob(*off_point(5, 560, -40), 220 * S, 130 * S, rng, n=5, rough=0.3, ang=grain(5) + 1.57)),
        ("kelp-c4", blob(*off_point(7, 520, 0), 260 * S, 150 * S, rng, n=5, rough=0.3, ang=grain(7) + 1.57)),
        ("kelp-c5", blob(*off_point(9, 520, 40), 220 * S, 130 * S, rng, n=5, rough=0.3, ang=grain(9) + 1.57)),
        ("kelp-gate", blob(*P(6950, 1500), 150 * S, 270 * S, rng, n=5, rough=0.3, ang=0.35)),
        ("kelp-islet-inner", blob(*P(7440, 3060), 150 * S, 120 * S, rng, n=5, rough=0.3, ang=0.4)),
    ]

    # The arena. Water to the west and north of the land; the land runs off the map to
    # the bottom-right. The offshore lane past rock B and the finish bay both need room.
    arena = [P(-3100, -5400), P(3000, -5400), P(9400, -3200), P(9900, 2000), P(9700, 5000),
             P(6000, 5000), P(-3100, 5000)]

    # ── the course ──
    marks = [
        {"id": "sf-pin",  "name": "Pin",  "x": 0, "y": 0, "kind": "inflatable"},
        {"id": "sf-boat", "name": "Boat", "x": 0, "y": 0, "kind": "committee"},
        {"id": "mark-point", "name": "Otter Point", "x": 0, "y": 0, "kind": "inflatable"},
        {"id": "fin-a", "x": 0, "y": 0, "kind": "inflatable"},
        {"id": "fin-b", "x": 0, "y": 0, "kind": "inflatable"},
    ]
    mpos = {"sf-pin": P(-1900, 2150), "sf-boat": P(-600, 2150),
            "mark-point": P(330, -4150),
            "fin-a": P(6600, 3500), "fin-b": P(6950, 4100)}
    for m in marks: m["x"], m["y"] = mpos[m["id"]]
    lines = [{"id": "sf", "name": "Start Line", "marks": ["sf-pin", "sf-boat"]},
             # mark order sets the crossing direction: b -> a is crossed heading INTO the bay
             {"id": "finish", "name": "Finish Line", "marks": ["fin-b", "fin-a"]}]
    route = [{"kind": "line", "lineId": "sf", "dir": 1},
             {"kind": "round", "dir": 1, "pass": "through", "markId": "mark-point", "side": "starboard"},
             {"kind": "gate", "lineId": "finish", "dir": 1, "pass": "through"}]

    # ── the wind partition ──
    # A smooth coastal spine (no points, no coves) offset outward 900u gives a band that
    # never self-intersects; the band is cut into stations. Everything else is offshore.
    spine = [P(-1400, 5000), P(-450, 2400), P(-450, -1900), P(-350, -3400), P(0, -4300),
             P(1200, -4300), P(2800, -3400), P(4600, -2100), P(6100, -600), P(7050, 900),
             P(7550, 2000), P(8100, 2700), P(9000, 3100), P(9700, 3300)]
    band_w = 950 * S
    def offset_polyline(pts, d):
        out = []
        m = len(pts)
        for i in range(m):
            a = pts[i - 1] if i > 0 else pts[i]; b = pts[i]; c = pts[i + 1] if i < m - 1 else pts[i]
            vx, vy = c[0] - a[0], c[1] - a[1]; L = math.hypot(vx, vy) or 1
            nx, ny = vy / L, -vx / L        # seaward normal: the spine runs with the sea on its left (screen y down)
            out.append([b[0] + nx * d, b[1] + ny * d])
        return out
    outer = offset_polyline(spine, band_w)
    # The band's INNER edge is authored, not offset: it runs well inside the land, one point
    # per spine point, so every cove and the water round the tip are inside a station (an
    # offset edge missed the coves — the coast recedes 700u into them — and an offset deep
    # enough to reach them crosses itself round the tip). Under land the wind is moot.
    inner = [P(1000, 5000), P(900, 2400), P(900, -1900), P(500, -2900), P(350, -3150), P(1000, -2950),
             P(2300, -2200), P(3900, -1150), P(5200, 250), P(6000, 1400), P(6500, 2300), P(7600, 4700),
             P(8700, 5400), P(9700, 5600)]
    assert len(inner) == len(spine)
    # stations along the spine (indices into spine) and their wind
    stations = [
        (0, 3,  "start lane — the sheltered coast", 12.0, 0.00, 0.16, 2.0, 30),
        (3, 4,  "approach — pressure builds toward the point", 16.0, 0.10, 0.08, 1.5, 34),
        (4, 6,  "the headland — accelerated and bent round the rock", 20.5, -0.14, 0.06, 1.5, 34),
        (6, 9,  "the reach — coves in the lee of their points", 15.5, -0.04, 0.10, 1.8, 30),
        (9, 11, "bearing away — the gate", 15.5, 0.00, 0.10, 1.8, 30),
        (11, 13, "bay approach", 14.0, 0.06, 0.16, 2.2, 26),
    ]
    regions = []
    for (i0, i1, name, spd, ddir, dvar, svar, period) in stations:
        poly = inner[i0:i1 + 1] + list(reversed(outer[i0:i1 + 1]))
        regions.append({"id": f"wind-{name.split(' ')[0]}-{i0}", "name": name, "poly": poly,
                        "falloff": 520, "direction": ddir, "dirVar": dvar, "speed": spd, "speedVar": svar, "period": period})
    # the offshore polygon: the arena's seaward edge, closed along the band's outer edge
    # in FORWARD order (a reversed edge is a bow-tie)
    offshore = [outer[-1], P(9900, 2000), P(9400, -3200), P(3000, -5400), P(-2600, -5400), P(-3100, 5000), outer[0]] + outer[1:-1]
    regions.insert(0, {"id": "wind-offshore", "name": "offshore — the steady Pacific breeze", "poly": offshore,
                       "falloff": 520, "direction": 0.0, "dirVar": 0.05, "speed": 17.5, "speedVar": 1.2, "period": 44})
    # the bay: its own water, light and shifty
    bay = blob(*P(6750, 3750), 1000 * S, 820 * S, rng, n=20, rough=0.12, ang=0.6)
    regions.append({"id": "wind-bay", "name": "the finishing bay — light and shifty behind the point", "poly": bay,
                    "falloff": 420, "direction": 0.12, "dirVar": 0.26, "speed": 11.0, "speedVar": 3.0, "period": 22})

    return dict(rng=rng, land=land, meadow=meadow, forest=forest, clumps=clumps, clearings=clearings, sands=sands,
                islets=islets, sunken=sunken, shallows=shallows, kelp=kelp, shelves=shelves, cores=cores, arena=arena,
                marks=marks, lines=lines, route=route, regions=regions, land_anchors=land_anchors)

# ── planting ─────────────────────────────────────────────────────────────────
def plant(d, scale, rng):
    """Cypress on exposed granite near points, ice plant along the exposed rim, pine and oak
    in the forest, a few oaks on the meadow. Everything inside the arena plus a margin the
    camera can reach; nothing in water."""
    land, meadow, forest, clumps, arena = d["land"], d["meadow"], d["forest"], d["clumps"], d["arena"]
    S = scale
    props = []
    def on_land(p): return point_in_poly(p, land) and not any(point_in_poly(p, s) for s in d["sands"])
    def visible(p): return dist_to_ring(p, arena) < 700 or point_in_poly(p, arena)
    def in_wood(p): return (point_in_poly(p, forest) and not any(point_in_poly(p, c) for c in d["clearings"])) or any(point_in_poly(p, g) for g in clumps)
    def add(kind, p, sc, hd=None):
        props.append({"id": f"veg-{len(props) + 1}", "kind": kind, "x": r1(p[0]), "y": r1(p[1]),
                      "heading": round(rng.uniform(0, 2 * math.pi) if hd is None else hd, 3), "scale": round(sc, 3)})
    # exposure: distance to the water (the land ring) — the granite band is the first 300u
    def shore_d(p): return dist_to_ring(p, land)
    xs = [p[0] for p in land]; ys = [p[1] for p in land]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    # Poisson-ish scatter by rejection on a jittered grid, per species
    def scatter(kind, cell, keep, smin, smax, jitter=0.45):
        cx = x0
        while cx < x1:
            cy = y0
            while cy < y1:
                p = [cx + rng.uniform(-jitter, jitter) * cell, cy + rng.uniform(-jitter, jitter) * cell]
                if on_land(p) and visible(p) and keep(p): add(kind, p, rng.uniform(smin, smax))
                cy += cell
            cx += cell
    # windswept cypress: the granite rim, densest where the coast is exposed (points, the tip)
    scatter("otter-cypress-monterey", 260 * S,
            lambda p: 60 < shore_d(p) < 330 * S and rng.random() < 0.55 and not in_wood(p), 0.75, 1.15)
    # the wood: cypress, pine and oak together, pine the commonest
    scatter("otter-pine-monterey", 120 * S, lambda p: in_wood(p) and rng.random() < 0.8, 0.85, 1.25)
    scatter("otter-cypress-monterey", 210 * S, lambda p: in_wood(p) and rng.random() < 0.5, 0.8, 1.1)
    scatter("otter-oak-live", 200 * S, lambda p: in_wood(p) and rng.random() < 0.6, 0.85, 1.2)
    # lone oaks on the open meadow
    scatter("otter-oak-live", 420 * S,
            lambda p: point_in_poly(p, meadow) and not in_wood(p) and shore_d(p) > 330 * S and rng.random() < 0.5, 0.9, 1.3)
    # ice plant: the exposed rim, in clusters — the venue's accent
    scatter("otter-iceplant", 150 * S, lambda p: 25 < shore_d(p) < 260 * S and rng.random() < 0.5, 0.8, 1.5)
    # a few extra mats right on the points' tips
    for a in d["land_anchors"]:
        for _ in range(3):
            p = [a[0] + rng.uniform(-120, 120) * S, a[1] + rng.uniform(-120, 120) * S]
            if on_land(p) and visible(p) and shore_d(p) < 220 * S: add("otter-iceplant", p, rng.uniform(1.0, 1.6))
    return props

# ── assemble the document ────────────────────────────────────────────────────
def build(scale, seed, rotate_deg=-45.0, do_plant=False):
    d = design(scale, seed)
    rng = d["rng"]
    ang = math.radians(rotate_deg)
    R = lambda p: [r1(v) for v in rot(p, ang)]
    Rr = lambda ring: [R(p) for p in ring]
    shapes = []
    # VERTEX BUDGET (Wes, 2026-09-14): the whole document under ~1,500 vertices — the next
    # largest venue is 2.5k and the rest are under 1.5k. Each ring is Douglas-Peucker
    # simplified to a tolerance that keeps what the player can see (one unit is about one
    # pixel): the coast tight, the inland rings looser, the shelf tint loosest.
    def shape(sid, kind, ring, **extra):
        tol = TOL.get(sid, TOL["sand"] if kind == "buffsand" else 0)
        if tol:
            src = ring
            while tol >= 1:
                cand = simplify(src, tol)
                if not ring_self_intersects(cand): ring = cand; break
                fixed, _, cut = untangle(cand)
                if fixed is not None and cut <= 0.03 * len(cand): ring = fixed; break
                tol /= 2
        si = ring_self_intersects(ring)
        if si: raise SystemExit(f"shape {sid} self-intersects at edges {si} — lower the roughness")
        ring_r = Rr(ring)
        cx = sum(p[0] for p in ring_r) / len(ring_r); cy = sum(p[1] for p in ring_r) / len(ring_r)
        rad = max(math.hypot(p[0] - cx, p[1] - cy) for p in ring_r)
        s = {"id": sid, "kind": kind, "outer": ring_r, "c": [r1(cx), r1(cy)], "r": r1(rad)}; s.update(extra); return s
    # Z-ORDER IS DOCUMENT ORDER, back to front (compile's shapeOrder): the water first —
    # shallows, then the sunken rock (under everything that stands proud), then the kelp
    # (its tint paints over a drowned rock the way kelp grows on one) — then the wet rock
    # apron, fingers, reefs and halos, then the land stack: the granite coast, the meadow
    # ring over it, the forest over that, the point flats and clearings opened in the forest,
    # cypress clumps standing on the flats, the beaches on the shore, and the dry islets on top.
    for sid, ring in d["shallows"]: shapes.append(shape(sid, "shallows", ring))
    for sid, c, r in d["sunken"]:
        shapes.append(shape(sid, "sunkenrock", blob(c[0], c[1], r * scale, r * 0.8 * scale, rng, n=5, rough=0.2, ang=rng.uniform(0, 3))))
    for sid, ring in d["kelp"]: shapes.append(shape(sid, "kelp", ring))
    for sid, ring in d["shelves"]: shapes.append(shape(sid, "tidepool", ring, height=0))   # under the granite: the wet band
    shapes.append(shape("coast", "coastalgranite", d["land"], height=25))
    for sid, ring, h in d["cores"]: shapes.append(shape(sid, "coastalgranite", ring, height=h))   # the fingers' pale ridges, the reefs' tops
    shapes.append(shape("meadow", "coastalmeadow", d["meadow"], height=25))
    shapes.append(shape("forest", "cypressfloor", d["forest"], height=25))
    for i, g in enumerate(d["clearings"]): shapes.append(shape(f"clearing-{i + 1}", "coastalmeadow", g, height=25))
    for i, g in enumerate(d["clumps"]): shapes.append(shape(f"clump-{i + 1}", "cypressfloor", g, height=25))
    for i, s in enumerate(d["sands"]): shapes.append(shape(f"sand-{i + 1}", "buffsand", s, height=2))
    for sid, c, rx, ry, h, a in d["islets"]:
        shapes.append(shape(sid, "coastalgranite", blob(c[0], c[1], rx * scale, ry * scale, rng, rough=0.28, ang=a), height=h))

    marks = []
    for m in d["marks"]:
        mm = dict(m); mm["x"], mm["y"] = R([m["x"], m["y"]]); marks.append(mm)
    regions = []
    for r in d["regions"]:
        rr = dict(r); rr["poly"] = Rr(r["poly"]); rr["direction"] = round(r["direction"] + ang, 4); regions.append(rr)
    props = plant(d, scale, rng) if do_plant else []
    for p in props:
        p["x"], p["y"] = R([p["x"], p["y"]]); p["heading"] = round((p["heading"] + ang) % (2 * math.pi), 3)
    # Z-ORDER FOLLOWS HEIGHT (plant_cove's rule): a prop list paints in order, so the mats
    # go down first, then the oaks, the pines, and the cypress on top of everything.
    rank = {"otter-iceplant": 0, "otter-iceplant-green": 0, "otter-sage-coastal": 1, "otter-brush-coyote": 2,
            "otter-oak-live": 3, "otter-pine-monterey": 4, "otter-cypress-monterey": 5}
    props.sort(key=lambda p: rank.get(p["kind"], 9))
    for i, p in enumerate(props): p["id"] = f"veg-{i + 1}"

    doc = {
        "schema": 1,
        "venue": "otter",
        "note": ("BUILT by art/build_otter.py (2026-09-13, object layer reworked 2026-09-14) from the owner's "
                 "coastal-course brief — a one-way hook along a Monterey granite coast: sheltered start in the lee of "
                 "a spur, beat to a rock-guarded headland (inside / middle / outside), rounding mark beyond the point, "
                 "a reach down a scalloped coast of points and coves that bears away 100 -> 160 TWA, a late rock gate, "
                 "a bay finish behind an islet. Authored in a wind-down frame and rotated 45 deg so the breeze is a "
                 "northwesterly. Re-run the script to regenerate; hand edits in editor.html are yours to keep (the "
                 "script overwrites)."),
        "card": {"name": "Otter Point", "tag": "Kelp Coast",
                 "blurb": "A granite coast under a wall of fog. Kelp beds flatten the swell and grab your keel; outside them the sets roll through and the breeze builds all afternoon. Hug the rocks or go wide — the otters are watching.",
                 "conditions": "Northwest sea breeze, long Pacific swell", "hazards": "Kelp, granite & breaking surf"},
        "world": {"size": 17000, "boundary": {"poly": Rr(d["arena"]), "circle": None}},
        "shapes": shapes,
        "course": {
            "description": "Coastal hook, one lap: beat up the kelp line to Otter Point, round it to starboard through the rocks, reach and run down the coast, thread the gate, finish in the bay.",
            "marks": marks, "lines": d["lines"], "route": d["route"]},
        "wind": {"regions": regions},
        "palette": {"baseColor": "#218798", "deepColor": "#176C83", "shallowColor": "#36A7A4", "shorelineColor": "#55C3B5"},
        "swell": {"strength": 0.85, "trains": [
            {"id": "primary", "periodS": 13.0, "heightM": 2.2, "speedKt": 14.5, "fromWind": 28},
            {"id": "windsea", "periodS": 7.5, "heightM": 0.5, "speedKt": 18, "fromWind": 8, "force": 0.3}]},
        "props": props,
    }
    return doc

def write(doc):
    text = ('// GENERATED ONCE by art/export_venue_doc.js — now the SOURCE OF TRUTH.\n'
            '// Emitted as JS, not JSON: the eval harness loads over file://, where fetch is blocked.\n'
            '// Edited in editor.html.\n'
            'window.VENUE_DOC = window.VENUE_DOC || {};\n'
            f'window.VENUE_DOC[{json.dumps(doc["venue"])}] = {json.dumps(doc, indent=2, ensure_ascii=False)};\n')
    OUT.write_text(text, encoding="utf-8")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scale", type=float, default=1.0)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--plant", action="store_true", help="also scatter the vegetation props (off by default — Wes places props later)")
    ap.add_argument("--verbose", action="store_true", help="say which macro edges make a contour fold")
    a = ap.parse_args()
    global VERBOSE; VERBOSE = a.verbose
    doc = build(a.scale, a.seed, do_plant=a.plant)
    kinds = {}
    for s in doc["shapes"]: kinds[s["kind"]] = kinds.get(s["kind"], 0) + 1
    pk = {}
    for p in doc["props"]: pk[p["kind"]] = pk.get(p["kind"], 0) + 1
    verts = sum(len(s["outer"]) for s in doc["shapes"])
    vk = {}
    for s in doc["shapes"]: vk[s["kind"]] = vk.get(s["kind"], 0) + len(s["outer"])
    print(f"scale {a.scale} seed {a.seed}: {len(doc['shapes'])} shapes {kinds}; {verts} vertices {vk}; {len(doc['wind']['regions'])} wind regions; {len(doc['props'])} props {pk}")
    if verts > 1500: print(f"  WARNING: {verts} vertices — the budget is 1,500", file=sys.stderr)
    if not a.dry:
        write(doc); print(f"wrote {OUT.relative_to(ROOT.parent)}")

if __name__ == "__main__":
    main()
