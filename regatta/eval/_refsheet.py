# REFERENCE RESEARCH for drawn animals (Wes, Sep 25 2026: "find reference images from above,
# ideally orthographic drone views, several of them, and check each subject looks right").
# Pulls the stock-photo PREVIEWS for a search into one contact sheet to look at — study only;
# nothing fetched here is ever shipped. Pair it with eval/_wildlife_bench.js.
#
#   python3 regatta/eval/_refsheet.py <name> <istock-slug> [must-contain words, a|b = either]
#   e.g.  python3 regatta/eval/_refsheet.py loon common-loon-from-above loon
#
# Writes $REFDIR/sheet_<name>.jpg (default /tmp/regatta-refs).
import sys, re, html, urllib.request, io, os
from PIL import Image, ImageDraw
name, slug = sys.argv[1], sys.argv[2]
must = [w.lower() for w in sys.argv[3:]]
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
D = os.environ.get('REFDIR', '/tmp/regatta-refs'); os.makedirs(D, exist_ok=True)
import subprocess
def get(u):
    return subprocess.run(['curl', '-sL', '--max-time', '30', '-A', UA, u], capture_output=True).stdout
s = get('https://www.istockphoto.com/photos/' + slug).decode('utf8', 'ignore')
items = re.findall(r'<img[^>]*?alt="([^"]*)"[^>]*?src="(https://media\.istockphoto\.com/id/[^"]+)"', s)
items += [(a, u) for u, a in re.findall(r'<img[^>]*?src="(https://media\.istockphoto\.com/id/[^"]+)"[^>]*?alt="([^"]*)"', s)]
seen, pick = set(), []
for alt, url in items:
    a = html.unescape(alt).lower(); u = html.unescape(url)
    if u in seen: continue
    if must and not all(any(m2 in a for m2 in m.split('|')) for m in must): continue
    seen.add(u); pick.append((a[:60], u))
pick = pick[:12]
ims = []
for a, u in pick:
    try: ims.append((a, Image.open(io.BytesIO(get(u))).convert('RGB')))
    except Exception as e: print('skip', e)
W = 4; cw = 380
rows = (len(ims) + W - 1) // W
sheet = Image.new('RGB', (W * cw, max(1, rows) * (cw * 3 // 4 + 20)), (20, 20, 24))
dr = ImageDraw.Draw(sheet)
for k, (a, im) in enumerate(ims):
    im.thumbnail((cw - 8, cw * 3 // 4 - 4))
    x, y = (k % W) * cw + 4, (k // W) * (cw * 3 // 4 + 20) + 2
    sheet.paste(im, (x, y)); dr.text((x, y + cw * 3 // 4 - 2), a[:52], fill=(220, 220, 220))
out = f'{D}/sheet_{name}.jpg'; sheet.save(out, quality=85)
print(out, len(ims), 'images')
for a, u in pick: print(' -', a)
