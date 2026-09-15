#!/usr/bin/env python3
"""Trace the collider outline of every prop kind from its bake (a placement can be made hard in the editor).

    python3 regatta/art/prop_outlines.py            # writes js/prop_outlines.js
    python3 regatta/art/prop_outlines.py --report   # table only, writes nothing

A `contact: hard` prop used to stop a hull at a 12-gon of radius `contactR` — a circle in
the middle of a 320-unit ferry terminal, a circle bigger than the rock it stood for. The
game now stops the hull at the prop's ACTUAL BOUNDARY: this script reads each kind's bake
(the same PNG the game draws), thresholds its alpha, traces the silhouette with marching
squares, simplifies it, and writes the rings — in world units at scale 1, about the sprite's
centre, y down, exactly the frame drawSpriteBoxed draws in — to js/prop_outlines.js, which
VenueDoc.propHitRings rotates, scales and places at runtime.

A kind with a `srcBox` is traced INSIDE that box only (a dock's deck, a log without its
shadow). If the box is nearly solid (a trunk under a canopy — the box is the designer's
stand-in for a footprint the art cannot show) no outline is written and the kind keeps its
contactR circle, as designed. Soft props keep their circles too: a shoal's drag is a field.

Re-run whenever a contact kind's bake or `world` changes. The output records the `world`
each ring was traced at, so a later size change rescales rather than misplaces.
"""
import json, math, pathlib, re, sys
from PIL import Image
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "js" / "prop_outlines.js"
ALPHA = 96                 # a pixel is rock above this
TOL = 0.015                # Douglas-Peucker tolerance, as a fraction of `world`
MAX_VERTS = 32             # per ring; the tolerance rises until a ring fits
MIN_PIECE = 0.03           # a detached piece under this share of the largest is dropped
BOX_SOLID = 0.90           # a srcBox this full is a stand-in, not a silhouette

def prop_kinds():
    src = (ROOT / "js" / "venuedoc.js").read_text(encoding="utf-8")
    a = src.index("const PROP_KINDS = {"); b = src.index("\n};", a)
    kinds = {}
    # a row may run on to a second line (`parts: {...}`), so a row is everything up to the next key
    rows = re.split(r"\n(?=\s{4}'[a-z0-9-]+':\s*\{)", src[a:b])
    for row in rows:
        m = re.match(r"^\s*'([a-z0-9-]+)':\s*\{(.*)", row, re.S)
        if not m: continue
        k, body = m.group(1), m.group(2)
        g = lambda pat, cast=str: (lambda mm: cast(mm.group(1)) if mm else None)(re.search(pat, body))
        kinds[k] = dict(motion=g(r"motion: '(\w+)'"), contact=g(r"contact: '(\w+)'"), contactR=g(r"contactR:\s*([0-9.]+)", float), plane=g(r"plane: '(\w+)'"),
                        world=g(r"world:\s*([0-9.]+)", float), src=g(r"src: '([^']+)'"), wash=g(r"\bwash:\s*([0-9.]+)", float),
                        srcBox=(lambda mm: [float(v) for v in mm.group(1).split(",")] if mm else None)(re.search(r"srcBox:\s*\[([^\]]*)\]", body)),
                        trunk=g(r"parts:\s*\{[^}]*surface:\s*'([a-z0-9-]+)'"))
    return kinds

def trace(mask, cell=1.0):
    """Marching squares over a boolean grid; returns closed loops of (x, y) in pixel units."""
    H, W = mask.shape
    TABLE = {1: [(3, 2)], 2: [(2, 1)], 3: [(3, 1)], 4: [(0, 1)], 5: [(0, 1), (3, 2)], 6: [(0, 2)], 7: [(0, 3)],
             8: [(0, 3)], 9: [(0, 2)], 10: [(0, 3), (2, 1)], 11: [(0, 1)], 12: [(3, 1)], 13: [(2, 1)], 14: [(3, 2)]}
    key = lambda i, j, side: ('h', i, j) if side == 0 else ('v', i + 1, j) if side == 1 else ('h', i, j + 1) if side == 2 else ('v', i, j)
    m = np.pad(mask, 1).astype(np.uint8)
    idx = m[:-1, :-1] * 8 + m[:-1, 1:] * 4 + m[1:, 1:] * 2 + m[1:, :-1]
    adj = {}
    for j, i in zip(*np.where((idx > 0) & (idx < 15))):
        for sa, sb in TABLE[int(idx[j, i])]:
            ka, kb = key(i, j, sa), key(i, j, sb)
            adj.setdefault(ka, []).append(kb); adj.setdefault(kb, []).append(ka)
    coord = lambda k: (((k[1] + 1) - 1.0) * cell, ((k[2] + 0.5) - 1.0) * cell) if k[0] == 'h' else (((k[1] + 0.5) - 1.0) * cell, ((k[2] + 1) - 1.0) * cell)
    seen, loops = set(), []
    for start in adj:
        if start in seen: continue
        loop, prev, cur = [start], None, start; seen.add(start)
        while True:
            nxt = [k for k in adj[cur] if k != prev and k not in seen]
            if not nxt: break
            prev, cur = cur, nxt[0]; loop.append(cur); seen.add(cur)
        if len(loop) >= 4: loops.append([coord(k) for k in loop])
    return loops

def area(ring):
    return abs(sum(ring[i][0] * ring[(i + 1) % len(ring)][1] - ring[(i + 1) % len(ring)][0] * ring[i][1] for i in range(len(ring)))) / 2

def inside(p, poly):
    x, y = p; ok = False
    for i in range(len(poly)):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % len(poly)]
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1): ok = not ok
    return ok

def simplify(pts, tol):
    if len(pts) < 5: return pts
    def dseg(p, a, b):
        dx, dy = b[0] - a[0], b[1] - a[1]; L2 = dx * dx + dy * dy
        if L2 == 0: return math.hypot(p[0] - a[0], p[1] - a[1])
        t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2))
        return math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
    def rec(lo, hi):
        if hi - lo < 2: return [lo, hi]
        a, b = pts[lo], pts[hi]; best, bi = -1, lo
        for i in range(lo + 1, hi):
            d = dseg(pts[i], a, b)
            if d > best: best, bi = d, i
        if best <= tol: return [lo, hi]
        L = rec(lo, bi); R = rec(bi, hi); return L[:-1] + R
    far = max(range(len(pts)), key=lambda i: math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]))
    pts = pts + [pts[0]]                      # rec indexes the closed polyline
    idx = rec(0, far)[:-1] + rec(far, len(pts) - 1)[:-1]
    return [pts[i] for i in idx]

def paint_outline(kind, K):
    """The painted silhouette of the whole bake (no srcBox, no trunk substitution) — what a
    designer should see as the prop's extent in the editor. Never a collider."""
    if not K["world"]: return None
    i = kind.find("-")
    path = ROOT / (K["src"] or f"assets/images/props/{kind[:i]}/{kind[i + 1:]}.png")
    if not path.exists(): return None
    a = np.array(Image.open(path).convert("RGBA"))[..., 3] > ALPHA
    if not a.any(): return None
    H, W = a.shape; step = max(1, int(math.ceil(max(W, H) / 256)))
    loops = [L for L in trace(a[::step, ::step], cell=step) if len(L) >= 8]
    if not loops: return None
    outer = [L for L in loops if not any(M is not L and inside(L[0], M) for M in loops)]
    big = max(area(L) for L in outer); outer = [L for L in outer if area(L) >= MIN_PIECE * big]
    scale = K["world"] / W; rings = []
    for L in sorted(outer, key=area, reverse=True)[:4]:
        tol = 0.03 * W; S = simplify(L, tol)
        while len(S) > 20: tol *= 1.4; S = simplify(L, tol)
        rings.append([[round((x - W / 2) * scale, 1), round((y - H / 2) * scale, 1)] for x, y in S])
    return rings

def outline(kind, K):
    # EVERY kind with a bake gets rings, not only the kinds whose row says hard: the editor
    # lets a designer flip one PLACEMENT to `contact: hard` (Otter's anemone pool and surfgrass
    # channel are rocks with life on them, placed hard on the shore), and without a traced
    # outline that placement fell back to the contactR circle — r97 round a 180-unit slab.
    # The rock defines the edge, whichever row or placement made it solid.
    if not K["world"]: return None, "no world"
    if K.get("motion") == "drift": return None, "drifts — never solid"
    # A composite tree (`parts`) draws a crown over a trunk; the hull hits the TRUNK PART, so
    # its outline is that part's, traced inside that part's srcBox, scaled to this kind's world.
    if K.get("trunk"):
        T = KINDS.get(K["trunk"])
        if not T or not T["world"]: return None, f"parts trunk {K['trunk']} unknown"
        rings, why = outline(K["trunk"], T)
        if not rings: return None, f"trunk: {why}"
        f = K["world"] / T["world"]
        return [[[round(x * f, 1), round(y * f, 1)] for x, y in r] for r in rings], f"trunk {K['trunk']}: {why}"
    # A canopy is a picture of the crown; the thing a hull hits is the trunk under it, and the
    # designer's contactR is the only measurement of that. Never trace a crown.
    if K["plane"] == "canopy": return None, "canopy — keeps contactR (the trunk)"
    i = kind.find("-")
    path = ROOT / (K["src"] or f"assets/images/props/{kind[:i]}/{kind[i + 1:]}.png")
    if not path.exists(): return None, "no bake"
    im = Image.open(path).convert("RGBA")
    a = np.array(im)[..., 3] > ALPHA
    H, W = a.shape
    if K["srcBox"]:
        bx, by, bw, bh = K["srcBox"]
        box = np.zeros_like(a); x0, y0, x1, y1 = int(bx * W), int(by * H), int((bx + bw) * W), int((by + bh) * H)
        box[y0:y1, x0:x1] = True
        cover = a[y0:y1, x0:x1].mean() if (y1 > y0 and x1 > x0) else 0
        if cover > BOX_SOLID: return None, f"srcBox {cover:.0%} solid — keeps contactR"
        a = a & box
    if not a.any(): return None, "empty alpha"
    # trace at <= 512px for speed; the tolerance is far coarser than the downsample
    step = max(1, int(math.ceil(max(W, H) / 512)))
    m = a[::step, ::step]
    loops = trace(m, cell=step)
    loops = [L for L in loops if len(L) >= 8]
    if not loops: return None, "no loop"
    # outer loops only, big enough to matter
    outer = [L for L in loops if not any(M is not L and inside(L[0], M) for M in loops)]
    big = max(area(L) for L in outer)
    outer = [L for L in outer if area(L) >= MIN_PIECE * big]
    scale = K["world"] / W           # px -> world units (drawSpriteBoxed maps the image width to `world`)
    rings = []
    for L in sorted(outer, key=area, reverse=True):
        tol = TOL * W
        S = simplify(L, tol)
        while len(S) > MAX_VERTS:
            tol *= 1.4; S = simplify(L, tol)
        rings.append([[round((x - W / 2) * scale, 1), round((y - H / 2) * scale, 1)] for x, y in S])
    return rings, f"{len(rings)} ring(s), {sum(len(r) for r in rings)} verts"

KINDS = {}

def main():
    global KINDS
    report = "--report" in sys.argv
    kinds = prop_kinds(); KINDS = kinds
    out, rows = {}, []
    for k, K in sorted(kinds.items()):
        paint = paint_outline(k, K)
        if paint: out[k] = {"world": K["world"], "paint": paint}
        rings, why = outline(k, K)
        if rings:
            out.setdefault(k, {"world": K["world"]})["rings"] = rings
            xs = [p[0] for r in rings for p in r]; ys = [p[1] for r in rings for p in r]
            ext = f"{min(xs):.0f}..{max(xs):.0f} x {min(ys):.0f}..{max(ys):.0f}"
            circ = math.pi * (K["contactR"] or 0) ** 2; ar = sum(area(r) for r in rings)
            rows.append((k, K["contact"], K["contactR"], K["world"], why, ext, f"area {ar / circ:.2f}x the circle" if circ else ""))
        else:
            rows.append((k, K["contact"], K["contactR"], K["world"], why, "", ""))
    w = max(len(r[0]) for r in rows)
    for r in rows: print(f"{r[0]:{w}s} {r[1]:5s} r{r[2] or 0:<5.0f} world {r[3] or 0:<4.0f} {r[4]:38s} {r[5]:24s} {r[6]}")
    print(f"{sum(1 for v in out.values() if v.get('rings'))} kinds carry rings, {len(out)} a paint silhouette, of {len(rows)} kinds")
    if report: return
    text = ("// GENERATED by art/prop_outlines.py — DO NOT EDIT. Per prop kind: `rings`, the COLLIDER\n"
            "// outline of a hard prop (traced from its bake, inside its srcBox, or its trunk part), and\n"
            "// `paint`, the painted silhouette of the whole sprite for every kind (the editor's picture of\n"
            "// the prop's extent — never a collider). World units at scale 1, about the sprite's centre,\n"
            "// y down. VenueDoc.propHitRings rotates, scales and places `rings`. Re-run the script when\n"
            "// a kind's bake or `world` changes.\n"
            "window.PROP_OUTLINES = " + json.dumps(out, separators=(",", ":")) + ";\n")
    OUT.write_text(text, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT.parent)} ({len(text) // 1024} KB)")

if __name__ == "__main__":
    main()
