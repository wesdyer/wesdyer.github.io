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
    "flats":     ("warm amber-gold drying sandbars", "deep saturated slate-blue channel water, rust-red withy markers"),
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
        "perspective, no horizon, no side of the object visible. THE TEST: only the TOP surface of the subject may appear. If any part of its front, face or side shows — a creature's eyes, its chest, the side of a hull — the camera angle is wrong. A head seen from above is the back of a skull, with the nose or beak foreshortened and pointing away, never a face looking at the viewer. {bg} "
        "The object alone: no water, no ground, no cast scenery, no baked drop shadow. "
        "Anything with a front faces the TOP of the frame — the engine rotates these and "
        "treats sprite-up as zero heading. Leave a clear margin of at least 8% of the "
        "image on all four sides so the sprite has room to rotate; the subject must not "
        "touch or approach any edge. Simplified geometric construction, strong outer "
        "silhouette, limited shading, designed to stay legible when reduced to roughly "
        "{display}px."
    ),
    "element": (
        "Strict TOP-DOWN ORTHOGRAPHIC sprite viewed from directly overhead — no "
        "perspective, no horizon, no side of the subject visible. THE TEST: only the TOP "
        "surface may appear. If any part of the subject's front, face or side shows — a "
        "creature's eyes, its chest — the camera angle is wrong. A head seen from above is "
        "the back of a skull, with the nose or beak foreshortened and pointing away, never "
        "a face looking at the viewer. {bg} "
        "EXACTLY ONE subject, alone, centred, filling most of the frame, facing the TOP. "
        "No second copy, no group, no companion, no reflection. Nothing else in frame: no "
        "ground, no scenery, no cast shadow. This art gets scaled down and scattered into "
        "groups by code, so it must read as a single clean silhouette from any rotation, "
        "and it will finally be drawn at roughly {display}px."
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

# Arrangement negatives, added after two penguin huddles came back as rosettes. They are
# about how MULTIPLE objects are laid out, not about an object's own form — a racing mark
# is deliberately three-fold symmetric, and forbidding symmetry would make the prompt
# argue with itself. Suppress with "allowSymmetry": true on the asset.
ARRANGEMENT_NEGATIVE = (
    ", mandala, kaleidoscope, radial symmetry, symmetrical arrangement, circular "
    "arrangement, ring formation, evenly spaced, rosette, compass rose, snowflake "
    "pattern, tiled pattern"
)

# How to ask for the background, per generator. Some models cannot produce real
# alpha and instead PAINT a transparency checkerboard into the pixels — asking
# them harder yields more checkerboards, so ask for a flat key color and remove
# it with dekey.py. Never key on white: too many props carry near-white markings.
BACKGROUNDS = {
    "transparent": (
        "Transparent background — a real alpha channel, not a drawn checkerboard "
        "pattern."
    ),
    # Gemini's subject quality measurably drops on a magenta field, and a proper
    # background remover has no trouble with white — the leak risk was specific to
    # dekey.py's flood fill. Cost: cutting against white leaves a light edge fringe
    # (measured 1.7x the body luminance on arctic-orca-calf), so check the edge on
    # the contact sheet over dark water.
    "white": (
        "Place the subject on a completely flat, uniform pure white background "
        "(hex #FFFFFF), edge to edge, with no gradient, vignette, texture, shadow "
        "or checkerboard. Keep a crisp, clean silhouette edge against the white — "
        "no soft glow, feathering or light halo around the subject."
    ),
    "magenta": (
        "Place the subject on a completely flat, uniform pure magenta background "
        "(hex #FF00FF), edge to edge, with no gradient, vignette, texture, shadow "
        "or checkerboard. The magenta is a chroma key that will be removed — no "
        "part of the subject may be magenta or pink."
    ),
    "green": (
        "Place the subject on a completely flat, uniform pure green background "
        "(hex #00FF00), edge to edge, with no gradient, vignette, texture, shadow "
        "or checkerboard. The green is a chroma key that will be removed — no part "
        "of the subject may be green."
    ),
}


def build(asset, profiles, bg="transparent"):
    prof = profiles[asset["class"]]
    display = asset.get("world", prof.get("reduceTest", 64))
    parts = [BASE, CLASS_ADDON[asset["class"]].format(
        display=display, bg=BACKGROUNDS[bg])]

    if asset.get("role"):
        parts.append(ROLE_ADDON[asset["role"]])

    if asset.get("venue") in VENUES:
        dominant, accent = VENUES[asset["venue"]]
        if asset["class"] == "illustration":
            # Venue cards DO commit — that is what venue-art.md's registry is for.
            parts.append(
                f"Palette is committed to {dominant}, with {accent} as the only accent. "
                "Do not introduce hues outside that commitment."
            )
        else:
            # A prop is an OBJECT IN a venue, not a picture OF one. Telling it to
            # commit to the venue's dominant hue makes it out of the venue's colour,
            # which is how three orcas came back navy instead of black and a snow
            # petrel came back with navy wings.
            parts.append(
                f"VENUE CONTEXT, NOT A COLOUR INSTRUCTION: this will be seen against "
                f"{dominant}, and the venue's signature accents are {accent}. That is "
                "the world it has to belong to — avoid hues that would look alien in "
                "it, like neon, hot pink or tropical green. But the subject is NOT "
                "made of the venue's colours and must NOT be tinted toward them. "
                "Render it in its own correct local colour. Any colour that carries "
                "real information — a species' true plumage or hide, a beak, a "
                "navigation aid's canonical coding, a painted hull — is always right "
                "even if that colour appears nowhere else in the venue, and must not "
                "be shifted toward the venue palette."
            )

    parts.append("SUBJECT: " + asset["subject"] + ".")
    return "\n\n".join(parts)


def emit(asset, profiles, bg="transparent"):
    prof = profiles[asset["class"]]
    print("=" * 72)
    print(f"{asset['key']}  [{asset['class']}/{asset.get('role', '-')}]  "
          f"venue={asset.get('venue', '-')}  status={asset['status']}  bg={bg}")
    line = f"master {prof['master']}x{prof['master']} {prof['background']}"
    if "world" in asset:
        line += f"   world {asset['world']}px"
    if "anchor" in asset:          # elements carry no anchor; they are composed, not placed
        line += f"   anchor {asset['anchor']}"
    if "compose" in asset:
        line += f"   COMPOSED {asset['compose']['count']} x {asset['compose']['from']}"
    print(line)
    print("=" * 72)
    print(build(asset, profiles, bg))
    neg = NEGATIVE if asset.get("allowSymmetry") else NEGATIVE + ARRANGEMENT_NEGATIVE
    print("\nNEGATIVE: " + neg)
    key = asset["key"]
    if bg == "transparent":
        print(f"\n-> save master as regatta/art/inbox/{key}.png, "
              f"then: python3 regatta/art/ingest.py {key}\n")
    else:
        print(f"\n-> save the raw file anywhere, then:"
              f"\n   python3 regatta/art/dekey.py <file> {key}"
              f"\n   python3 regatta/art/ingest.py {key}\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("keys", nargs="*")
    ap.add_argument("--venue")
    ap.add_argument("--all-slots", action="store_true")
    ap.add_argument("--bg", choices=sorted(BACKGROUNDS), default="transparent",
                    help="how to ask for the background. 'transparent' for models "
                         "with real alpha (OpenAI); 'magenta'/'green' for models "
                         "that paint a fake checkerboard (Gemini) — then run dekey.py")
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
        emit(a, profiles, args.bg)


if __name__ == "__main__":
    main()
