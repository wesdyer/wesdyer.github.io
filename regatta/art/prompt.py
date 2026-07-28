#!/usr/bin/env python3
"""Assemble a generation prompt for one manifest asset.

    python3 regatta/art/prompt.py bayou-cypress
    python3 regatta/art/prompt.py --venue swamp        # every slot for a venue
    python3 regatta/art/prompt.py --all-slots

The prompt is built, never hand-written: base style (visual-style.md 11) +
class add-on + role add-on + venue palette commitment (venue-art.md) + the
per-asset subject from the manifest. Hand-writing prompts is how a library
drifts, so this is the only supported way to make one.
"""
import argparse
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
MANIFEST = ROOT / "manifest.json"

# venue-art.md palette registry. Dominant hue is a commitment, not a suggestion.
VENUES = {
    "bay":       ("coastal azure and green headlands", "red/green channel buoys, white lighthouse"),
    "lake":      ("deep lake blue and pine green", "warm cabin lights, red/green buoys"),
    "lagoon":    ("pale glowing turquoise and sand", "coral pinks and purples under water"),
    "swamp":     ("olive and yellow-green throughout", "rust roof metal, cattail brown"),
    "river":     ("whitewater teal and tan rock", "stone bridge grey, foam swirls"),
    "ocean":     ("deep open-ocean cobalt", "white cloud, whale blow"),
    "redrock":   ("orange and rust sandstone", "turquoise water"),
    "glowtide":  ("near-black indigo night", "electric cyan bioluminescence, red lit buoy, moon gold"),
    "arctic":    ("steel navy and faceted ice blue-white", "penguin yellow, orca black"),
    "seatrials": ("plain honest blue", "one orange mark"),
}

BASE = (
    "Stylized polished 2D game art for SaltyCritter Yacht Club; colorful nautical "
    "adventure; vivid saturated jewel-toned color; bold simplified shapes with crisp "
    "chunky faceted brush planes; hard two-tone shading and no soft gradients; crisp "
    "readable silhouette; storybook clarity over realism; friendly sophisticated tone; "
    "consistent directional lighting; minimal microtexture; no text; no UI; no photorealism."
)

CLASS_ADDON = {
    "world-prop": (
        "Strict TOP-DOWN ORTHOGRAPHIC game sprite viewed from directly overhead — no "
        "perspective, no horizon, no side of the object visible. Transparent background. "
        "The object alone: no water, no ground, no cast scenery, no baked drop shadow. "
        "Simplified geometric construction, strong outer silhouette, limited shading, "
        "designed to stay legible when reduced to roughly {display}px."
    ),
    "terrain": (
        "Strict top-down orthographic terrain tile, transparent background, crisp faceted "
        "edges, no baked water and no shoreline foam (the engine draws those)."
    ),
    "illustration": (
        "Square aerial-oblique venue illustration, opaque, no text or lettering, no humans. "
        "Give the eye a path through the water. One focal element; corners quiet; bottom "
        "fifth simple enough for a name scrim."
    ),
    "portrait": (
        "Anthropomorphic sailing competitor, upper-body three-quarter portrait, transparent "
        "background, expressive face, strong dark outer outline, simplified interior "
        "linework, distinctive modern life jacket with zipper and belt hardware, clean cel "
        "shading, readable at 64px, no scenery."
    ),
    "ui-icon": (
        "Flat interface icon, transparent background, heavy optical padding, one clear "
        "idea, readable at 32px over both dark navy and bright water."
    ),
}

ROLE_ADDON = {
    "hazard": (
        "This is a HAZARD the player must avoid: it needs an aggressive, spiky or heavy "
        "silhouette that telegraphs danger at a glance, and must hold strong contrast "
        "against both pale turquoise and near-black water."
    ),
    "ambient": (
        "This is AMBIENT decoration with no collision. Its silhouette must be soft, "
        "rounded or organic so it can never be mistaken for a hazard — that distinction "
        "has to survive at race scale with color removed."
    ),
    "landmark": (
        "This is a fixed LANDMARK carrying venue identity. It may be the largest and most "
        "detailed thing in the venue, but it never reads as an obstacle in the water."
    ),
    "traffic": (
        "This is a NON-RACING boat. It must be instantly distinguishable from a racing "
        "sailboat: no racing sail plan, different hull proportion, working-boat character."
    ),
    "nav": (
        "This is a NAVIGATION AID the player is meant to read. Use canonical buoyage "
        "shape and color coding; exaggerate the top shape slightly for recognition."
    ),
}

NEGATIVE = (
    "photorealistic, cinematic realism, 3D render, heavy painterly brushwork, watercolor "
    "wash, gritty, horror, military, generic vector clip art, excessive texture, excessive "
    "bloom, thin fragile details, cluttered background, drop shadow, ground plane, "
    "perspective view, isometric, text, logo, watermark"
)


def build(asset, profiles):
    prof = profiles[asset["class"]]
    display = asset.get("world", prof.get("reduceTest", 64))
    parts = [BASE, CLASS_ADDON[asset["class"]].format(display=display)]

    if asset.get("role"):
        parts.append(ROLE_ADDON[asset["role"]])

    if asset.get("venue") in VENUES:
        dominant, accent = VENUES[asset["venue"]]
        parts.append(
            f"Palette is committed to {dominant}, with {accent} as the only accent. "
            "Do not introduce hues outside that commitment."
        )

    parts.append("SUBJECT: " + asset["subject"] + ".")
    return "\n\n".join(parts)


def emit(asset, profiles):
    prof = profiles[asset["class"]]
    print("=" * 72)
    print(f"{asset['key']}  [{asset['class']}/{asset.get('role', '-')}]  "
          f"venue={asset.get('venue', '-')}  status={asset['status']}")
    print(f"master {prof['master']}x{prof['master']} {prof['background']}"
          + (f"   world {asset['world']}px   anchor {asset['anchor']}" if "world" in asset else ""))
    print("=" * 72)
    print(build(asset, profiles))
    print("\nNEGATIVE: " + NEGATIVE)
    print(f"\n-> save master as regatta/art/inbox/{asset['key']}.png, "
          f"then: python3 regatta/art/ingest.py {asset['key']}\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("keys", nargs="*")
    ap.add_argument("--venue")
    ap.add_argument("--all-slots", action="store_true")
    args = ap.parse_args()

    m = json.loads(MANIFEST.read_text())
    assets, profiles = m["assets"], m["profiles"]

    if args.venue:
        sel = [a for a in assets if a.get("venue") == args.venue]
    elif args.all_slots:
        sel = [a for a in assets if a["status"] == "slot"]
    else:
        by_key = {a["key"]: a for a in assets}
        missing = [k for k in args.keys if k not in by_key]
        if missing:
            sys.exit(f"unknown key(s): {', '.join(missing)}")
        sel = [by_key[k] for k in args.keys]

    if not sel:
        sys.exit("no assets matched")
    for a in sel:
        emit(a, profiles)


if __name__ == "__main__":
    main()
