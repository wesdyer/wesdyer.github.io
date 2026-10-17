#!/usr/bin/env python3
"""Write the game-size copy of every ground texture (Oct 2026 perf pass).

    python3 regatta/art/terrain_tiles.py            # (re)write any that are missing or older than their master
    python3 regatta/art/terrain_tiles.py --all      # rewrite all

The game draws a ground master into a `tile`-pixel pattern (sprites.js getLandPattern, lavaTileCanvas):
a 1024² master at 1.5 MB for a 128 or 256 px tile. Each row's (src, tile) pair in js/render/sprites.js
gets <name>.t<tile>.png beside its master, resized LANCZOS (measured against the browser's own
downscale of the master: ~2/255 mean, before the texture's blend alpha). The game asks for the
.t<tile> file and falls back to the master when it is missing, so a new ground ships without this
step — it just downloads the big file until this is run.
"""
import pathlib, re, sys
from PIL import Image

REPO = pathlib.Path(__file__).resolve().parent.parent
src = (REPO / "js" / "render" / "sprites.js").read_text()
pairs = sorted(set(re.findall(r"src:\s*'(assets/images/terrain/[^']+\.png)',\s*tile:\s*(\d+)", src)))
force = "--all" in sys.argv
n = 0
for rel, tile in pairs:
    master = REPO / rel
    out = master.with_name(f"{master.stem}.t{tile}.png")
    if not master.exists():
        print(f"  missing master {rel}"); continue
    if not force and out.exists() and out.stat().st_mtime >= master.stat().st_mtime:
        continue
    t = int(tile)
    Image.open(master).convert("RGB").resize((t, t), Image.LANCZOS).save(out, optimize=True)
    n += 1
    print(f"  {out.relative_to(REPO)}  {master.stat().st_size // 1024} KB -> {out.stat().st_size // 1024} KB")
print(f"{len(pairs)} ground textures, {n} written")
