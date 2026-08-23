"""Draw the two comet colour ramps over each venue's water. Run eval/_comet_ramp.js first."""
import json
from PIL import Image, ImageDraw

OUT = "/private/tmp/claude-501/-Users-wesdyer-Desktop-wesdyer-github-io/0b98d4e5-b137-4a82-9d99-591fe88704f5/scratchpad"
d = json.load(open(f"{OUT}/_ramp.json"))
waters, pals, ktmax = d["waters"], d["palettes"], d["ktMax"]
names = list(pals.keys())
W, ROW, PAD, LBL = 1100, 46, 10, 120
H = PAD + len(waters) * len(names) * (ROW + 6) + 40
img = Image.new("RGB", (W, H), (26, 26, 30))
dr = ImageDraw.Draw(img)
y = PAD
for vname, hexc in waters.items():
    wr = tuple(int(hexc.lstrip("#")[i:i+2], 16) for i in (0, 2, 4))
    for pname in names:
        lut = pals[pname]
        dr.rectangle([LBL, y, W - 10, y + ROW], fill=wr)
        n = len(lut)
        for i in range(n):
            x0 = LBL + (W - 10 - LBL) * i / n
            x1 = LBL + (W - 10 - LBL) * (i + 1) / n
            # A comet is a thin mark, so draw it as one — a full-height block flatters any ramp.
            dr.rectangle([x0, y + ROW * 0.38, x1, y + ROW * 0.62], fill=tuple(lut[i]))
        dr.text((6, y + ROW / 2 - 6), f"{vname[:8]} {pname}", fill=(230, 230, 235))
        y += ROW + 6
for k in range(0, ktmax + 1, 5):
    x = LBL + (W - 10 - LBL) * k / ktmax
    dr.line([x, y, x, y + 6], fill=(150, 150, 160))
    dr.text((x - 6, y + 8), f"{k}", fill=(190, 190, 200))
img.save(f"{OUT}/comet-ramps.png")
print("  wrote comet-ramps.png  (thin bar = the mark's actual weight; scale 0 ->", ktmax, "kt)")
