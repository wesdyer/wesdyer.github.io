#!/usr/bin/env python3
"""Validate a generated master and emit the game-ready asset.

    python3 regatta/art/ingest.py bayou-cypress
    python3 regatta/art/ingest.py --all            # everything sitting in inbox/
    python3 regatta/art/ingest.py bayou-cypress --check   # validate only, write nothing

Drop the generated master at regatta/art/inbox/<key>.png. This checks it against
its manifest profile, archives it to masters/, writes the game-ready bake into
assets/images/, records the computed anchor, and flips status to "art".

The anchor is seeded from the alpha bounding-box center. That is right for most
floating props and wrong for anything whose contact point is off-center (a leaning
tree, an L-shaped dock). Check it on the contact sheet — contact.py draws a
crosshair at the anchor — and correct anchorPx in the manifest by hand.
"""
import argparse
import json
import pathlib
import sys

import numpy as np
from PIL import Image, ImageFilter

import paths

ROOT = pathlib.Path(__file__).resolve().parent
REPO = ROOT.parent
MANIFEST = ROOT / "manifest.json"
INBOX = ROOT / "inbox"
MASTERS = ROOT / "masters"


ALL_ASSETS = []          # filled in main(); lets ingest report who uses an element
PREFIXES = {}            # venue -> strippable key prefix, see paths.py


class Fail(Exception):
    pass


def master_for(asset, prof, delivered):
    """Working master size, and the note explaining any move off the profile.

    Two departures from "the profile decides". First, a PER-ASSET OVERRIDE: master
    size is a per-subject question, not a per-class one, because it is really asking
    how many px of SUBJECT the biggest consumer of this asset needs. A buoy at world
    40 is finished at 1024; the cove cargo ship is drawn at world 720 and is not.
    Raising the whole profile to suit the ship would force every other world-prop to
    be regenerated to match.

    Second, THE MASTER IS NEVER UPSCALED to meet the target. A 1024 file resampled up
    to 1536 and then baked down to 1440 carries exactly the information it had at
    1024, having paid for two resamples instead of one, and it writes a master to the
    archive that claims a resolution it does not have. The declared master is a
    ceiling and a request to the generator, not a promise about files already on
    disk.
    """
    m = asset.get("master", prof["master"])
    if delivered == m:
        return m, None
    if delivered > m:
        return m, f"master is {delivered}px, target {m}px — will downsample"
    return delivered, (f"master is {delivered}px but this asset asks for {m}px — "
                       f"baking from {delivered} rather than upscaling; regenerate "
                       f"at {m}px to get the resolution the asset is sized for")


def check_master(img, prof, key, m):
    """Structural checks that are cheap now and expensive after 80 files."""
    notes = []
    if prof.get("wide"):
        # A wide profile (the clubhouse hero) states its master as [W, H]; the aspect must
        # match to within a couple of percent, and nothing else about squareness applies.
        W, H = prof["wide"]
        if abs(img.width / img.height - W / H) > 0.03:
            raise Fail(f"wrong aspect: {img.width}x{img.height}, this profile is {W}x{H}")
    elif img.width != img.height:
        raise Fail(f"not square: {img.width}x{img.height}")

    if prof["background"] == "transparent":
        if img.mode != "RGBA":
            raise Fail(f"needs alpha, got mode {img.mode}")
        alpha = img.getchannel("A")
        lo, hi = alpha.getextrema()
        if hi == 0:
            raise Fail("fully transparent")
        if lo == 255:
            raise Fail("fully opaque — background was not removed")

        # Corners must be clear, or the model painted a backdrop.
        w, h = img.size
        corners = [alpha.getpixel(p) for p in
                   ((2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3))]
        if max(corners) > 8:
            raise Fail(f"corners not transparent (alpha {corners}) — backdrop present")

        # Threshold before measuring. alpha.getbbox() counts ANY non-zero pixel, and
        # generations routinely leave residue at alpha 1-2 from a removed backdrop —
        # invisible, but it inflated the mark's measured height from 506px to 793px,
        # which then mis-sized fill normalization and mis-seeded the anchor.
        solid = alpha.point(lambda v: 255 if v > 8 else 0)
        bbox = solid.getbbox()
        if bbox is None:
            raise Fail("no pixels above alpha 8 — effectively empty")
        margin = prof.get("safeMargin", 0.0)
        if margin:
            pad = int(min(img.size) * margin)
            if (bbox[0] < pad or bbox[1] < pad
                    or bbox[2] > img.width - pad or bbox[3] > img.height - pad):
                notes.append(
                    f"content reaches within {margin:.0%} of the edge (bbox {bbox}) — "
                    "no room for rotation or a contact shadow"
                )
        # Straight alpha: a dark matte halo shows as mid-alpha pixels that are
        # much darker than their opaque neighbours.
        return bbox, notes

    if img.mode not in ("RGB", "RGBA"):
        raise Fail(f"unexpected mode {img.mode}")
    if img.mode == "RGBA" and img.getchannel("A").getextrema()[0] < 255:
        notes.append("has transparency but profile wants opaque — will flatten")
    return None, notes


def wrap_resize(img, m):
    """Resample a TILING texture without breaking its wrap.

    A plain resize clamps at the border, so the filter reads the edge pixels against
    themselves and the two edges stop matching — a seam appears at every tile boundary
    in game, which is the one failure mode this asset class has. Tiling 3x3 first hands
    the filter the neighbours it will actually have on screen.
    """
    w = img.width
    big = Image.new(img.mode, (w * 3, w * 3))
    for i in range(3):
        for j in range(3):
            big.paste(img, (i * w, j * w))
    return big.resize((m * 3, m * 3), Image.LANCZOS).crop((m, m, m * 2, m * 2))


def hole_fraction(img, bbox):
    """Enclosed transparency as a fraction of crown area — the see-through a canopy actually has."""
    from PIL import ImageDraw
    probe = img.getchannel("A").point(lambda v: 255 if v > 128 else 0)
    ImageDraw.floodfill(probe, (0, 0), 128)              # corners are already checked clear
    a = np.asarray(probe)[bbox[1]:bbox[3], bbox[0]:bbox[2]]
    crown = int(((a == 255) | (a == 0)).sum())
    return int((a == 0).sum()) / max(1, crown)


def punch_holes(img, luma_max, open_px, feather=1.0):
    """Move the canopy's painted openings out of RGB and into alpha.

    Two rounds of prompting could not get a generator to cut holes through a crown — 0.0%,
    2.5% and 1.1% see-through against a 6% target — and the reason is the same prior that
    fights the camera: aerial photographs of woodland show shadowed depth between crowns,
    essentially never sky. "Cut through to the background" is not a thing the training data
    has much of.

    It does not need to. The openings ARE in the delivered art, painted near-black: inside a
    crown the darkest few percent sit at luma 5-16 against a median of 100-125, which is a
    cleanly separable phase. So this moves information that is already on disk from one
    channel to another, rather than asking for it again.

    KEYED AS BLOBS, NOT PIXELS. A plain luma threshold turns every dark line between two
    leaves into a pinhole and the crown comes out as lace. A morphological OPEN — erode, then
    dilate — drops anything thinner than the kernel and keeps only openings with real area,
    which is what the subject asks for: "six to ten small ragged openings", not a mesh.

    The MASTER IS ARCHIVED BEFORE THIS RUNS, so masters/ keeps exactly what was delivered and
    this is always one manifest key away from being undone.
    """
    a = np.asarray(img.convert("RGBA")).astype(np.float64)
    rgb, al = a[..., :3], a[..., 3]
    lum = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    dark = (((lum < luma_max) & (al > 128)).astype(np.uint8)) * 255
    m = Image.fromarray(dark, "L")
    k = open_px * 2 + 1
    m = m.filter(ImageFilter.MinFilter(k)).filter(ImageFilter.MaxFilter(k))
    if feather:
        m = m.filter(ImageFilter.GaussianBlur(feather))
    hole = np.asarray(m).astype(np.float64) / 255.0
    return Image.fromarray(np.dstack([rgb, al * (1 - hole)]).astype(np.uint8), "RGBA")


def key_colors(kh):
    """The key colours an asset declares: `color` (one) or `colors` (a name -> RGB dict)."""
    if kh.get("colors"):
        return dict(kh["colors"])
    return {"hole": kh.get("color", [255, 0, 255])}


def key_like(rgb, color, thresh, hue_min=15):
    """Which pixels ARE the key: within `thresh` of it in summed RGB, OR carrying its hue.

    The hue test is what catches the wide soft fringe a generator paints where a channel
    runs out at the sprite's edge — cyan fading into dark rock over twenty pixels, every one
    of them a dark teal 300+ from pure cyan. A key is two channels high and one low; a pixel
    whose two high channels both clear the low one by `hue_min` has the key's hue at any
    brightness. 15 is safe on basalt, whose channels spread by ten at most and the wrong
    way for magenta; the lit lips are warm and never trip either key.
    """
    k = np.array(color, dtype=float)
    d = np.abs(rgb - k).sum(-1)
    like = d <= thresh
    hi = [i for i in range(3) if k[i] > 127]
    lo = [i for i in range(3) if k[i] <= 127]
    if len(hi) == 2 and len(lo) == 1:
        like |= (np.minimum(rgb[..., hi[0]], rgb[..., hi[1]]) - rgb[..., lo[0]]) > hue_min
    return like


def key_mask(img, color, thresh, dilate=2, feather=1.0):
    """An alpha mask of every pixel within `thresh` of `color`: the region the game paints
    lava into under the rock sprite. DILATED a couple of pixels so the lava reaches under the
    antialiased fringe the opening leaves in the rock (otherwise that fringe shows as a dark
    outline over nothing), then feathered so the cut is not an aliased line."""
    a = np.asarray(img.convert("RGBA")).astype(int)
    mask = key_like(a[..., :3].astype(float), color, thresh) & (a[..., 3] > 0)
    m = Image.fromarray((mask * 255).astype(np.uint8), "L")
    if dilate:
        m = m.filter(ImageFilter.MaxFilter(2 * dilate + 1))
    if feather > 0:
        m = m.filter(ImageFilter.GaussianBlur(feather))
    return m


def _box_sum(x, r):
    """Sum over a (2r+1)^2 window, by integral image. Zero-padded at the border."""
    p = np.pad(x, ((r + 1, r), (r + 1, r)), mode="constant")
    c = p.cumsum(0).cumsum(1)
    return c[2 * r + 1:, 2 * r + 1:] - c[:-2 * r - 1, 2 * r + 1:] - c[2 * r + 1:, :-2 * r - 1] + c[:-2 * r - 1, :-2 * r - 1]


def despill(img, colors, thresh, reach, radius=3):
    """Repaint the antialiased FRINGE between a key region and the rock from its rock
    neighbours. A generator blends the key into the surrounding paint over a pixel or two;
    the pixels inside `thresh` open to alpha, but the ones between `thresh` and `reach`
    stay opaque with a magenta or cyan cast and draw as a hairline round every crater and
    channel. Each is replaced by the mean of the clean pixels in a (2*radius+1) window —
    a neighbourhood inpaint, no colour model needed. Returns the image and the fringe count."""
    a = np.asarray(img.convert("RGBA")).astype(float)
    rgb, alpha = a[..., :3], a[..., 3]
    dmin = None
    keyed = np.zeros(rgb.shape[:2], dtype=bool)
    for rgbk in colors.values():
        d = np.abs(rgb - np.array(rgbk, dtype=float)).sum(-1)
        dmin = d if dmin is None else np.minimum(dmin, d)
        # Anything that IS the key by distance or by hue (key_like) is the opening, and
        # the opening is key_holes' business; what is left for the despill is the thin
        # blended band just outside it.
        keyed |= key_like(rgb, rgbk, thresh)
    fringe = (dmin <= reach) & ~keyed & (alpha > 0)
    good = (alpha > 0) & ~keyed & ~fringe
    w = good.astype(float)
    out = a.copy()
    # Two windows: the tight one first, then a wide one for fringe with no clean neighbour
    # nearby — a channel mouth, where key meets the transparent background and the nearest
    # rock is several pixels off. Whatever is left after both is key-adjacent edge with no
    # rock to borrow from, and it simply goes transparent: it was the key's own antialiasing.
    done = np.zeros_like(fringe)
    for r in (radius, radius * 3):
        den = _box_sum(w, r)
        todo = fringe & ~done & (den > 0)
        for c in range(3):
            num = _box_sum(rgb[..., c] * w, r)
            out[..., c] = np.where(todo, num / np.maximum(den, 1e-9), out[..., c])
        done |= todo
    out[..., 3] = np.where(fringe & ~done, 0, out[..., 3])
    return Image.fromarray(out.clip(0, 255).astype(np.uint8), "RGBA"), int(fringe.sum())


def rock_fix(img, src_hex, dst_hex, colors, thresh):
    """A colour post-fix for the rock body: per-channel gain taking `src` to `dst`, applied to
    the COOL opaque pixels only (blue >= red), so the warm lit lips keep their colour. This is
    the library's 'a dE miss is a Lab post-fix, not a reroll' rule made mechanical, for a body
    that came back tinted by key spill."""
    d = [int(dst_hex[i:i + 2], 16) for i in (1, 3, 5)]
    a = np.asarray(img.convert("RGBA")).astype(float)
    rgb, alpha = a[..., :3], a[..., 3]
    dmin = None
    for rgbk in colors.values():
        dd = np.abs(rgb - np.array(rgbk, dtype=float)).sum(-1)
        dmin = dd if dmin is None else np.minimum(dmin, dd)
    cool = (alpha > 0) & (dmin > thresh) & (rgb[..., 2] >= rgb[..., 0]) \
           & ~np.any([key_like(rgb, c, thresh) for c in colors.values()], axis=0)
    # The gain is measured off the pixels it will touch, not the whole body: gaining the cool
    # faces by a whole-rock ratio (which the lit faces and lips had pulled warm) took a
    # violet body to green-grey on the first try. `from` overrides it when given.
    s = ([int(src_hex[i:i + 2], 16) for i in (1, 3, 5)] if src_hex
         else rgb[cool].mean(0).tolist())
    gain = np.array([d[i] / max(1.0, s[i]) for i in range(3)])
    out = a.copy()
    out[..., :3] = np.where(cool[..., None], rgb * gain, rgb)
    return Image.fromarray(out.clip(0, 255).astype(np.uint8), "RGBA"), int(cool.sum())


def resize_rgba(img, size):
    """Resample an RGBA image PREMULTIPLIED, so transparent pixels contribute nothing.

    PIL's resize works on straight alpha: a pixel with alpha 0 still lends its RGB to the
    neighbours it is averaged with. On a keyed sprite that is exactly wrong — key_holes
    zeroes the alpha of a magenta or cyan region but leaves the key colour underneath — so
    every bake grew a key-hued rim along every opening, thousands of pixels, that no despill
    on the master could touch because it was born in the resize. Premultiply, resample the
    four planes as floats, divide back.
    """
    if img.mode != "RGBA":
        return img.resize(size, Image.LANCZOS)
    a = np.asarray(img).astype(np.float32) / 255.0
    al = a[..., 3:4]
    pre = np.concatenate([a[..., :3] * al, al], axis=-1)
    planes = [Image.fromarray(pre[..., i], "F").resize(size, Image.LANCZOS) for i in range(4)]
    out = np.stack([np.asarray(p, dtype=np.float32) for p in planes], axis=-1)
    oa = np.clip(out[..., 3:4], 0.0, 1.0)
    rgb = np.where(oa > 1e-4, out[..., :3] / np.maximum(oa, 1e-4), 0.0)
    res = np.concatenate([np.clip(rgb, 0.0, 1.0), oa], axis=-1)
    return Image.fromarray((res * 255.0 + 0.5).astype(np.uint8), "RGBA")


def key_holes(img, color, thresh, feather=1.0):
    """Open every pixel within `thresh` of `color` to alpha 0 — ENCLOSED regions included.

    The one thing dekey.py cannot do: its flood fill starts at the border, so a key-coloured
    crater floor ringed by rock is exactly the region it protects. This keys by colour alone,
    wherever the colour is, which is what an asset means when its subject says "paint this
    opening flat magenta and the engine removes it": the volcano props open their craters and
    lava channels this way so a `magma` or `lava` shape placed under the prop shows through.
    `thresh` is the summed RGB distance (a clean flat magenta sits at 0; an antialiased
    fringe blending toward dark rock climbs fast), `feather` blurs the mask edge so the
    opening does not land on a hard aliased line. Returns the image and the keyed fraction.
    """
    a = np.asarray(img.convert("RGBA")).astype(int)
    mask = key_like(a[..., :3].astype(float), color, thresh)
    out = a.copy()
    # ⚠️ THE KEY COLOUR MUST GO FROM THE RGB TOO, not only from the alpha. The feathered
    # edge of the opening leaves a ring of pixels at partial alpha, and those pixels kept
    # their magenta or cyan underneath — drawn over lava they read as a bright key-hued
    # rim round every crater and channel, and no despill on the master could see them,
    # because on the master they are plain key. So every keyed pixel takes the colour of
    # the nearest clean rock first (a box-window inpaint, tight then wide, body colour as
    # the last resort), and only then does the alpha come off.
    good = (~mask) & (a[..., 3] > 0)
    w = good.astype(float)
    done = np.zeros_like(mask)
    for r in (4, 12):
        den = _box_sum(w, r)
        todo = mask & ~done & (den > 0)
        for c in range(3):
            num = _box_sum(a[..., c] * w, r)
            out[..., c] = np.where(todo, (num / np.maximum(den, 1e-9)).round(), out[..., c])
        done |= todo
    for c, v in enumerate((0x30, 0x33, 0x3A)):
        out[..., c] = np.where(mask & ~done, v, out[..., c])
    m = Image.fromarray((mask * 255).astype(np.uint8), "L")
    if feather > 0:
        m = m.filter(ImageFilter.GaussianBlur(feather))
    keep = 255 - np.asarray(m).astype(int)
    out[..., 3] = np.minimum(out[..., 3], keep)
    return Image.fromarray(out.clip(0, 255).astype(np.uint8), "RGBA"), float(mask.mean())


def ingest(asset, profiles, check_only=False):
    key = asset["key"]
    prof = profiles[asset["class"]]
    src = INBOX / f"{key}.png"
    if not src.exists():
        raise Fail(f"no master at {src.relative_to(REPO.parent)}")

    img = Image.open(src)
    m, size_note = master_for(asset, prof, img.width)
    bbox, notes = check_master(img, prof, key, m)
    if size_note:
        notes.insert(0, size_note)

    # ── IS IT ACTUALLY ORTHOGRAPHIC? ────────────────────────────────────────
    # The one failure this library cannot talk a generator out of. Straight-down imagery is
    # thin on the ground in training data, so the default is a three-quarter hero shot, and
    # a prompt saying "strict top-down orthographic, no side visible" gets ignored politely
    # — the 2026-08-09 tree batch came back at 17-56 degrees off vertical against exactly
    # that wording.
    #
    # It is, however, MEASURABLE, and that is what this does. A round subject photographed
    # from straight above is round; tilt the camera by t and its outline squashes to cos(t)
    # in one axis. So for any asset that declares itself round in plan, the content bbox
    # ratio reports the camera angle directly and the reviewer stops having to judge it by
    # eye. Opt-in via `planRound`, because plenty of props are honestly elongated (a leaning
    # palm, a cargo ship) and a blanket check would be pure noise.
    if bbox and asset.get("planRound"):
        bw, bh = bbox[2] - bbox[0], bbox[3] - bbox[1]
        ratio = max(bw, bh) / max(1, min(bw, bh))
        if ratio > 1.12:
            import math
            tilt = math.degrees(math.acos(min(1.0, 1.0 / ratio)))
            notes.append(
                f"NOT ORTHOGRAPHIC: content is {ratio:.2f}x longer on one axis ({bw}x{bh}). "
                f"A subject that is round in plan implies the camera sat ~{tilt:.0f} degrees "
                f"off vertical. Usable, but regenerate when you can")

    # ── DID THE OPENINGS COME BACK AS HOLES? ────────────────────────────────
    # A canopy is asked for with "ragged openings where the canopy thins", and the 2026-08-09
    # batch delivered them as DARK GREEN PATCHES — interior alpha holes measured 0.0%, 0.0%
    # and 0.4% across the three crowns. They look like gaps and occlude like a solid disc,
    # which is the whole difference: the engine draws these over the fleet, so a painted gap
    # hides a boat exactly as well as a painted leaf does.
    #
    # Cheap to check and impossible to eyeball, so the manifest states the floor and this
    # measures it. Interior holes only — flood the transparent region inward from the border
    # and whatever transparency survives is enclosed by the crown.
    #
    # MEASURED ON WHAT SHIPS, NOT ON WHAT ARRIVED. When `punchHoles` is set the delivered
    # file legitimately has none — the openings are painted and get keyed out below — so
    # checking the master would report a failure on an asset that ships correct, and train
    # the reader to ignore the one warning that matters.
    if bbox and asset.get("minHoles"):
        ph0 = asset.get("punchHoles")
        probe_img = (punch_holes(img, ph0.get("luma", 32), ph0.get("open", 5),
                                 ph0.get("feather", 1.0)) if ph0 else img)
        frac = hole_fraction(probe_img, bbox)
        if frac < asset["minHoles"]:
            notes.append(
                f"NO REAL OPENINGS: {frac:.1%} of the crown is see-through, asked for "
                f"{asset['minHoles']:.0%}. The gaps were painted as dark patches rather than "
                f"cut through the alpha, so this occludes like a solid disc"
                + (" — and punchHoles could not recover them either" if ph0 else ""))

    # ── DID THE OPENINGS COME BACK AS KEY COLOUR? ───────────────────────────
    # A `keyHoles` asset asks the generator to paint its openings flat magenta. Measured
    # on arrival so a crater that came back painted as black rock, or as a glowing pool,
    # is caught here rather than in the venue with a magma shape shining on nothing.
    # TWO KEYS SINCE THE VOLCANO REWORK (2026-09-07): `colors` names one colour per
    # behaviour — magma (a churning lake) and lava (a running channel) — and each is
    # reported on its own, because a master that painted both as one colour has lost the
    # distinction the game paints from. `min` is the floor for the keys added together.
    kh = asset.get("keyHoles")
    if kh:
        cols = key_colors(kh)
        total = 0.0
        for name, rgb in cols.items():
            _, frac = key_holes(img, rgb, kh.get("thresh", 120), 0)   # key_like inside: distance or hue
            total += frac
            print(f"    keyed {name}: {frac:.2%} of the frame")
        floor = kh.get("min", 0.004)
        if total < floor:
            notes.append(
                f"NO KEYED OPENING: {total:.2%} of the frame is any key colour, asked for at least "
                f"{floor:.1%}. The crater or channel came back painted (or transparent) rather "
                f"than keyed — the game will have no region to paint lava into")

    for n in notes:
        print(f"    warn: {n}")

    if check_only:
        print(f"    ok (check only, nothing written)")
        return None

    # Normalize the bbox against the size it was MEASURED at, before any resample.
    # Dividing by the profile master instead silently corrupts the anchor whenever
    # the delivered master is a different size (a 2048px file lands the anchor at 1.0).
    src_w = img.width
    if prof.get("wide"):
        W, H = prof["wide"]
        if img.size != (W, H):
            img = img.resize((W, H), Image.LANCZOS)
    elif img.size != (m, m):
        img = (wrap_resize(img, m) if prof.get("tileWorld")
               else resize_rgba(img, (m, m)))

    MASTERS.mkdir(exist_ok=True)
    img.save(paths.store(MASTERS, asset, PREFIXES))

    # After the archive, before the bake: masters/ keeps the delivered file untouched.
    ph = asset.get("punchHoles")
    if ph:
        img = punch_holes(img, ph.get("luma", 32), ph.get("open", 5), ph.get("feather", 1.0))
        print(f"    punched openings: luma<{ph.get('luma', 32)}, open {ph.get('open', 5)}px")
    key_masks = {}
    if kh:
        # Every key opens to alpha in the rock sprite, and every key ALSO becomes a mask
        # file beside the bake (<name>-<key>.png), taken BEFORE the opening while the colour
        # is still there, and pushed through the very same fill normalisation and bake
        # resize as the sprite below so the two register to the pixel. drawPropLava paints
        # the lava into the mask under the rock.
        for name, rgb in key_colors(kh).items():
            key_masks[name] = key_mask(img, rgb, kh.get("thresh", 120),
                                       kh.get("dilate", 2), kh.get("feather", 1.0))
        if kh.get("despill"):
            img, n_fr = despill(img, key_colors(kh), kh.get("thresh", 120), kh["despill"],
                                kh.get("despillRadius", 3))
            print(f"    despilled fringe: {n_fr} px repainted from their rock neighbours")
        rf = asset.get("rockFix")
        if rf:
            img, n_cool = rock_fix(img, rf.get("from"), rf["to"], key_colors(kh), kh.get("thresh", 120))
            print(f"    rock fix: cool body -> {rf['to']} on {n_cool} px (from {rf.get('from', 'the measured cool mean')}), warm lips untouched")
        for name, rgb in key_colors(kh).items():
            img, frac = key_holes(img, rgb, kh.get("thresh", 120), kh.get("feather", 1.0))
            print(f"    keyed {name}: {frac:.2%} of the frame opened to alpha")

    outdir = REPO / prof["out"]
    dest = paths.store(outdir, asset, PREFIXES)
    if prof.get("flat"):
        # Venue cards are loaded by the game as <out>/<key>.png and <out>/thumbs/<key>.png,
        # not nested under a venue folder like props. Found Sep 2026 on the first card to go
        # through ingest (otter): paths.rel() nested it as venues/otter/otter.png.
        dest = outdir / (asset["key"] + ".png")
    shown = dest.relative_to(REPO)

    if prof["track"] == "element":
        # No bake and no anchor: compose.py scales the element into the group, and
        # the anchor belongs to the composed sprite, not to its parts.
        #
        # NORMALIZE THE FILL. Elements are interchangeable by design — compose.py
        # scales them all by the same fraction — so a member that happens to sit at
        # 77% of its frame scatters 20% smaller than one at 96%. That difference is
        # an authoring accident, not intent, so it is removed here rather than left
        # for every compose block to compensate for. Species size differences belong
        # in the group's `scale` range, where they are visible and deliberate.
        # Per-asset override, because the safe fill depends on the SHAPE. compose.py
        # rotates with expand=False, so content only survives rotation if it fits its
        # own inscribed circle. A penguin is roughly round and lives happily at 88%; a
        # rectangular hut at 88% loses its corners past ~15deg, and a clipped corner on
        # a building is unmissable. Oblong elements that get rotated declare a lower
        # elementFill; the group's `scale` range compensates.
        fill_before = max(bbox[2] - bbox[0], bbox[3] - bbox[1]) / src_w if bbox else 0
        target = asset.get("elementFill", prof.get("elementFill", 0.88))
        if bbox:
            k = src_w / m
            crop = img.crop(tuple(int(v / k) for v in bbox))
            f = target * m / max(crop.size)
            crop = crop.resize((max(1, round(crop.width * f)),
                                max(1, round(crop.height * f))), Image.LANCZOS)
            img = Image.new("RGBA", (m, m), (0, 0, 0, 0))
            img.alpha_composite(crop, ((m - crop.width) // 2, (m - crop.height) // 2))
        img.save(dest)
        print(f"    -> {shown}  ({m}px master, unbaked)")
        print(f"    fill normalized {fill_before:.0%} -> {target:.0%}, recentred")
        used = [g["key"] for g in ALL_ASSETS if g.get("compose", {}).get("from") == key]
        print(f"    used by: {', '.join(used) if used else 'NOTHING — no group composes this'}")

        # `ships: true` — an element the ENGINE scatters at runtime rather than
        # compose.py scattering at bake time. That was assumed impossible ("a
        # single penguin is 4-7px"), but the figure is the animal's TRUE size:
        # the accepted groups already draw each bird at 11-19px, so a lone
        # element is perfectly legible at the size it was always drawn. Runtime
        # scatter is what lets a bird waddle, dive and surface on its own —
        # a baked group is one image and can never animate a member.
        if asset.get("ships"):
            wp = profiles["world-prop"]
            bake = asset["world"] * wp["bake"]
            sdest = paths.store(REPO / wp["out"], asset, PREFIXES)
            img.resize((bake, bake), Image.LANCZOS).save(sdest)
            print(f"    -> {sdest.relative_to(REPO)}  ({bake}px bake for "
                  f"{asset['world']}px display, runtime scatter)")
    elif prof["track"] == "sprite":
        # Optional fill normalization. A generation that centres a small shape in a big
        # frame makes `world` a lie — the mark came back filling 55% of its master, so
        # world:60 drew a 33px object. fillTo rescales the content to occupy the size it
        # declares.
        #
        # Fitted on the BOUNDING BOX, not the circumscribed circle. Engine rotation goes
        # through ctx.rotate() + drawImage, which transforms the coordinate system rather
        # than sampling a fixed frame, so nothing clips at any angle and padding buys
        # nothing. (The 8% margin the prompts ask for is for BAKED rotation — compose.py
        # rotates with expand=False, where corners genuinely can be lost.)
        if asset.get("fillTo") and bbox:
            k = m / src_w
            box = tuple(int(v * k) for v in bbox)
            crop = img.crop(box)
            f = asset["fillTo"] * m / max(crop.size)
            crop = resize_rgba(crop, (max(1, round(crop.width * f)), max(1, round(crop.height * f))))
            img = Image.new("RGBA", (m, m), (0, 0, 0, 0))
            img.alpha_composite(crop, ((m - crop.width) // 2, (m - crop.height) // 2))
            # The masks take the identical crop, scale and centring, or they drift off the rock.
            for name in list(key_masks):
                mc = key_masks[name].crop(box).resize(crop.size, Image.LANCZOS)
                mm = Image.new("L", (m, m), 0)
                mm.paste(mc, ((m - crop.width) // 2, (m - crop.height) // 2))
                key_masks[name] = mm
            bbox = img.getchannel("A").getbbox(); src_w = m
            fw, fh = (bbox[2] - bbox[0]) / m, (bbox[3] - bbox[1]) / m
            print(f"    fill normalized to {asset['fillTo']:.0%} — content {fw:.0%}x{fh:.0%} "
                  f"of frame, visible at {round(asset['world']*fw)}x{round(asset['world']*fh)}px")
        # Per-asset bake override. The profile's 4x is oversampling for device pixel
        # ratio plus margin — the camera is 1:1 and nothing zooms — and at small
        # `world` it is free. It stops being free at the top of the size range: the
        # master holds `master * fillTo` px of content and no more, so a bake of
        # `world * 4` starts UPSCALING the master once world passes master/4, and
        # every px past that is invented. The cove cargo ship is the first asset to
        # want a world larger than that ceiling (a container ship 4x a racing hull is
        # simply the wrong size for the subject), so it trades zoom headroom it was
        # never going to spend for length it visibly needs. Lower this rather than
        # raising `world` past master/bake and quietly shipping a soft sprite.
        bake = asset.get("bake", prof["bake"])
        size = round(asset["world"] * bake)
        game = resize_rgba(img, (size, size))
        game.save(dest)
        if key_masks:
            regions = {}
            for name, mm in key_masks.items():
                mk = mm.resize((size, size), Image.LANCZOS)
                if not mk.getbbox():
                    # A key the master does not use (a crater-only cone has no channels):
                    # no file, no region, and the kind's row simply carries no entry for it.
                    print(f"    ({name}: no pixels — no mask written)")
                    continue
                out_m = Image.new("RGBA", (size, size), (255, 255, 255, 0))
                out_m.putalpha(mk)
                mpath = dest.with_name(f"{dest.stem}-{name}.png")
                out_m.save(mpath)
                arr = np.asarray(mk).astype(float) / 255.0
                tot = arr.sum()
                if tot > 0:
                    yy, xx = np.indices(arr.shape)
                    cx, cy = (xx * arr).sum() / tot, (yy * arr).sum() / tot
                    regions[name] = {"cx": round(cx / size, 4), "cy": round(cy / size, 4),
                                     "r": round(float(np.sqrt(tot / np.pi)) / size, 4)}
                print(f"    -> {mpath.relative_to(REPO)}  ({name} mask, {tot / (size * size):.2%} of the frame"
                      + (f", centre {regions[name]['cx']},{regions[name]['cy']} r {regions[name]['r']} of the frame)" if name in regions else ")"))
            # Carried on the asset like anchorPx, and copied onto the PROP_KINDS row by hand:
            # the runtime cannot read the mask's pixels back, so where each region sits and
            # how big it is are numbers measured here.
            asset["keyRegions"] = regions
        content = size * (asset.get("fillTo") or 1.0)
        have = src_w * (asset.get("fillTo") or 1.0)
        print(f"    -> {shown}  ({size}px bake at {bake}x for {asset['world']}px display)")
        print(f"    resolution: {content:.0f}px of ship from a {have:.0f}px master "
              f"= {content / have:.2f}x" + ("  UPSCALED" if content > have * 1.02 else ""))
        if bbox:
            anchor = [round((bbox[0] + bbox[2]) / 2 / src_w, 4),
                      round((bbox[1] + bbox[3]) / 2 / src_w, 4)]
            if "anchorPx" not in asset:
                asset["anchorPx"] = anchor
                print(f"    anchor seeded at {anchor} (bbox center) — verify on the contact sheet")
            else:
                print(f"    anchor kept at {asset['anchorPx']} (bbox center would be {anchor})")
    else:
        out = img.convert("RGB") if prof["background"] == "opaque" else img
        out.save(dest)
        print(f"    -> {shown}")
        if prof.get("thumb"):
            t = prof["thumb"]
            thumb = dest.parent / "thumbs" / dest.name
            thumb.parent.mkdir(parents=True, exist_ok=True)
            out.resize((t, t), Image.LANCZOS).save(thumb)
            print(f"    -> {thumb.relative_to(REPO)}  ({t}px)")
        if prof.get("jpeg"):
            # What the PAGE loads. A 2528px opaque PNG is 5 MB; the same picture as a JPEG at
            # this quality is under a tenth of that, and the hub is the first screen.
            jpg = dest.with_suffix(".jpg")
            out.convert("RGB").save(jpg, quality=int(prof["jpeg"]), optimize=True, progressive=True)
            print(f"    -> {jpg.relative_to(REPO)}  (jpeg q{prof['jpeg']})")
        if prof.get("thumbMid"):
            # The tile's Retina/large size: a JPEG, since a card has no alpha and a 640px PNG
            # of painted water runs ~500 KB where the JPEG is ~100. The picker, route strip
            # and series draw pick it through srcset (screens.js venueThumb) when a tile is
            # drawn wider than the 256 thumb can fill sharply.
            m = prof["thumbMid"]
            mid = dest.parent / "thumbs" / f"{dest.stem}-{m}.jpg"
            out.convert("RGB").resize((m, m), Image.LANCZOS).save(mid, quality=86, optimize=True, progressive=True)
            print(f"    -> {mid.relative_to(REPO)}  ({m}px jpeg)")

    asset["status"] = "art"
    return asset


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("keys", nargs="*")
    ap.add_argument("--all", action="store_true", help="ingest every master in inbox/")
    ap.add_argument("--check", action="store_true", help="validate only")
    args = ap.parse_args()

    m = json.loads(MANIFEST.read_text())
    ALL_ASSETS[:] = m["assets"]
    PREFIXES.update(paths.venue_prefixes(m["assets"]))
    by_key = {a["key"]: a for a in m["assets"]}

    if args.all:
        INBOX.mkdir(exist_ok=True)
        keys = sorted(p.stem for p in INBOX.glob("*.png"))
        unknown = [k for k in keys if k not in by_key]
        for k in unknown:
            print(f"{k}: skipped — not in manifest (declare the slot first)")
        keys = [k for k in keys if k in by_key]
    else:
        keys = args.keys
        unknown = [k for k in keys if k not in by_key]
        if unknown:
            sys.exit(f"unknown key(s): {', '.join(unknown)}")

    if not keys:
        sys.exit("nothing to ingest (inbox is empty)")

    changed = False
    failed = 0
    for k in keys:
        print(f"{k}:")
        try:
            if ingest(by_key[k], m["profiles"], args.check):
                changed = True
        except Fail as e:
            print(f"    FAIL: {e}")
            failed += 1

    if changed:
        # ensure_ascii=False, or json escapes every em-dash in the file to a \\uXXXX
        # sequence and one status flip lands as a ~350-line diff nobody can review.
        MANIFEST.write_text(json.dumps(m, indent=2, ensure_ascii=False) + "\n")
        print("\nmanifest updated")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
