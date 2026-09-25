# REFERENCE CELLS: pull chosen photos out of _refsheet.py contact sheets into one comparison
# board, so a drawing can be checked feature by feature against its best references (Wes, Sep 25
# 2026: "look closely at reference images and make sure all the wildlife match well").
#
#   REFDIR=<dir> python3 regatta/eval/_refcells.py <out.jpg> <sheet>:<row>:<col> [...]
#   e.g. ... _refcells.py /tmp/ref_bear.jpg bear6:1:1 bear6:2:3 bear7:1:0
#
# Sheets are 4 columns x 3 rows (rows 305 px apart); <sheet> is the name given to _refsheet.py.
import os, sys
from PIL import Image
REF = os.environ.get('REFDIR', '/tmp/regatta-refs')
out, cells = sys.argv[1], sys.argv[2:]
def cell(sheet, row, col):
    im = Image.open(os.path.join(REF, f'sheet_{sheet}.jpg')); W, H = im.size
    cw = (W - 8) / 4; x0 = int(4 + col * cw); y0 = int(2 + row * 305)
    return im.crop((x0, y0, int(x0 + cw - 8), y0 + 282))
rows = (len(cells) + 3) // 4
board = Image.new('RGB', (4 * 380, rows * 290), (20, 20, 24))
for i, spec in enumerate(cells):
    sheet, r, c = spec.split(':')
    im = cell(sheet, int(r), int(c)); im.thumbnail((372, 282))
    board.paste(im, ((i % 4) * 380, (i // 4) * 290))
board.save(out); print('wrote', out)
