#!/usr/bin/env python3
"""Colour-grade an accepted painting toward its animal's true local colours, without a reroll.

    python3 regatta/art/grade.py glowtide-flying-fox fox
    python3 regatta/art/grade.py glowtide-hawksbill hawk

Grades, in place, the master (the delivered original kept beside it as <name>.orig.png, so a grade is never applied
twice — it always starts from the original), every cut part in art/parts/, and every bake in the asset folder whose
name is the asset's or starts with it plus '-' (its parts). A grade is per pixel, so parts and bakes stay in register.

WHY (Oct 17 2026, Wes: "Check that the colors are right" → "Much better"): the shapes were accepted, only the colour
was off against the overhead references —
  fox:  flying-fox membranes painted warm orange-brown (#725037). That orange is the sun shining THROUGH the
        membrane in sky photos; from above, as on roosting bats, the wing is dark sooty brown, near charcoal. Everything
        but the golden mantle: darker, less saturated, a touch less red.
  hawk: the hawksbill pushed bright — shell a saturated orange (#C47C29), flipper net a bright cream-yellow (#EFC786).
        Shell less saturated, the pale net much less so, both a shade darker.
  spoon: (Oct 18, Wes: "Check the colors especially of the spoonbill") the roseate spoonbills pushed bright: the wing pink
        at HSV value 0.93 (the references' birds 0.75-0.89, and the aerial flocks in daylight pale shell-pink, saturation
        0.2-0.33, not the painted 0.35-0.48), the carmine bright scarlet (references a deeper crimson). The pinks less
        saturated and a shade darker, the carmine deeper still, the orange tail a touch muted; the white neck, the
        buff-green head, the grey bill and the legs as painted.
"""
import json
import pathlib
import sys

import numpy as np
from PIL import Image

import paths

ROOT = pathlib.Path(__file__).resolve().parent


def hls(a):
    r, g, b = [a[..., i] / 255 for i in range(3)]
    mx, mn = np.maximum(np.maximum(r, g), b), np.minimum(np.minimum(r, g), b)
    l, d = (mx + mn) / 2, mx - mn
    with np.errstate(invalid="ignore", divide="ignore"):
        s = np.where(d == 0, 0, d / np.where(l < 0.5, mx + mn, 2 - mx - mn + 1e-9))
        dd = np.where(d == 0, 1, d)
        rc, gc, bc = (mx - r) / dd, (mx - g) / dd, (mx - b) / dd
    h = np.where(r == mx, bc - gc, np.where(g == mx, 2 + rc - bc, 4 + gc - rc))
    return np.where(d > 0, (h / 6) % 1, 0), l, s


def rgb(h, l, s):
    def f(p, q, t):
        t = t % 1
        return np.where(t < 1 / 6, p + (q - p) * 6 * t, np.where(t < 1 / 2, q, np.where(t < 2 / 3, p + (q - p) * (2 / 3 - t) * 6, p)))
    q = np.where(l < 0.5, l * (1 + s), l + s - l * s)
    p = 2 * l - q
    return np.stack([f(p, q, h + 1 / 3), f(p, q, h), f(p, q, h - 1 / 3)], -1) * 255


def grade(img, preset):
    a = np.array(img.convert("RGBA")).astype(float)
    h, l, s = hls(a[..., :3])
    if preset == "fox":
        gold = (h * 360 > 18) & (h * 360 < 50) & (l > 0.38) & (s > 0.35)   # the mantle keeps its colour
        k = ~gold
        l, s, h = np.where(k, l * 0.68, l), np.where(k, s * 0.6, s * 0.85), np.where(k, (h * 360 + 4) / 360, h)
    elif preset == "hawk":
        cream = l > 0.62
        s, l = np.where(cream, s * 0.55, s * 0.82), l * 0.9
    elif preset == "spoon":
        deg = h * 360
        pink = ((deg > 300) | (deg < 12)) & (s > 0.1) & (l > 0.12)
        deep = pink & (s > 0.55) & (l < 0.62)   # the carmine shoulder, rump and leading-edge bar
        tail = (deg >= 18) & (deg < 45) & (s > 0.4)
        s = np.where(deep, s * 0.85, np.where(pink, s * 0.72, np.where(tail, s * 0.85, s)))
        l = np.where(deep, l * 0.84, np.where(pink, l * 0.95, np.where(tail, l * 0.95, l)))
    else:
        raise SystemExit(f"unknown preset {preset}")
    out = a.copy()
    out[..., :3] = np.clip(rgb(h, l, s), 0, 255)
    return Image.fromarray(out.astype(np.uint8))


def main():
    key, preset = sys.argv[1], sys.argv[2]
    m = json.loads((ROOT / "manifest.json").read_text())
    asset = {a["key"]: a for a in m["assets"]}[key]
    pref = paths.venue_prefixes(m["assets"])
    master = paths.store(ROOT / "masters", asset, pref)
    orig = master.with_name(master.stem + ".orig.png")
    if orig.exists() and not (ROOT / "graded-src" / asset["venue"]).exists():
        # (graded-src is local scratch, not committed: on a fresh clone the bakes and parts are ALREADY graded, and
        # grading them again would stack. Rebuild them from the original first — ingest and split from <name>.orig.png.)
        raise SystemExit(f"{key} is already graded and its ungraded parts are not here: re-ingest / re-split from {orig.name} first")
    if not orig.exists():
        orig.write_bytes(master.read_bytes())
    grade(Image.open(orig), preset).save(master)
    stem = paths.rel(asset, pref).name
    others = [paths.rel(a, pref).name for a in m["assets"] if a.get("venue") == asset["venue"] and a["key"] != key]
    done = [master.name]
    for d in (paths.store(ROOT / "parts", asset, pref).parent, ROOT.parent / m["profiles"][asset["class"]]["out"] / asset["venue"]):
        for f in sorted(d.glob(stem + "*.png")) if d.exists() else []:
            if f.stem != stem and not f.stem.startswith(stem + "-"):
                continue
            if any(f.stem == o or f.stem.startswith(o + "-") for o in others if len(o) > len(stem)):
                continue   # (another asset's: flying-fox-upstroke is not a part of flying-fox)
            # (a part or bake is graded from its own ungraded copy, kept in art/graded-src — local scratch — never twice)
            src = ROOT / "graded-src" / asset["venue"] / f"{d.parts[-2]}-{f.name}"
            src.parent.mkdir(parents=True, exist_ok=True)
            if not src.exists():
                src.write_bytes(f.read_bytes())
            grade(Image.open(src), preset).save(f)
            done.append(str(f.relative_to(ROOT.parent)))
    print(key, preset, "graded:", ", ".join(done))


if __name__ == "__main__":
    main()
