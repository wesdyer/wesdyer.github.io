"""Where an asset's files live. Shared by ingest/compose/contact so the layout
is defined once.

Persistent stores are organized by VENUE:

    art/masters/arctic/orca.png
    art/elements/arctic/penguin-emperor.png
    art/sheets/arctic/orca.png
    assets/images/props/arctic/orca.png

`art/inbox/` stays FLAT and keyed by the full manifest key (`arctic-orca.png`).
It is a staging area a human drops files into, and one unambiguous name beats a
directory to navigate.

The filename drops the venue prefix, so `arctic-orca` becomes `arctic/orca`. That
prefix is not always the venue name — the swamp venue's assets are all keyed
`bayou-*` — so it is derived from the manifest rather than assumed: a venue's
prefix is the leading token shared by every one of its assets.
"""
import pathlib


def venue_prefixes(assets):
    """venue -> the leading key token all its assets share, or None."""
    groups = {}
    for a in assets:
        v = a.get("venue")
        if v:
            groups.setdefault(v, []).append(a["key"])
    out = {}
    for v, keys in groups.items():
        # THE VENUE CARD IS NOT A PREFIX VOTE. Cards ingested since Sep 2026 carry `venue`
        # and are keyed by the bare venue name (`volcanic`, `otter`, `flats`), and a bare
        # key has no prefix to share — so it used to break unanimity and every OTHER asset
        # of that venue shipped under its full key: volcanic-basalt landed as
        # terrain/volcanic/volcanic-basalt.png where river-cobble lands as river/cobble.png.
        # The card itself is unaffected either way: its name never starts with `<v>-`, and
        # the illustration profile stores it flat regardless.
        keys = [k for k in keys if k != v]
        heads = {k.split("-", 1)[0] for k in keys if "-" in k}
        # Only strip when it is unanimous; a mixed venue keeps full keys.
        out[v] = heads.pop() if len(heads) == 1 and all("-" in k for k in keys) else None
    return out


def rel(asset, prefixes):
    """Path of this asset's file relative to a store root, without extension."""
    v = asset.get("venue")
    if not v:
        return pathlib.Path(asset["key"])
    p = prefixes.get(v)
    name = asset["key"]
    if p and name.startswith(p + "-"):
        name = name[len(p) + 1:]
    return pathlib.Path(v) / name


def store(root, asset, prefixes, ext=".png"):
    """Full path under `root`, creating the venue directory."""
    path = (root / rel(asset, prefixes)).with_suffix(ext)
    path.parent.mkdir(parents=True, exist_ok=True)
    return path
