#!/usr/bin/env python3
"""regatta/eval/playtest/leaderboard.py — read the race leaderboard off the raw video once a second.

  python3 leaderboard.py <tests_dir> <out.tsv>

Needs the RAW video (run before the bundle is deleted); writes `video_s  lap  race_s  rank  name  gap`
rows so PT-006 (the leaderboard jumps around) can be measured later without the recording:
rank changes per minute, gap jumps between consecutive seconds vs the boats' true course progress.
Leaderboard crop on the 3072x2304 raw track: (25, 280, 450, 770).
"""
import sys, re
from align import bundle, load_laps
from ocr import read_frame

def main():
    tests, out = sys.argv[1], sys.argv[2]
    B = bundle(tests)
    laps = [L for L in load_laps(tests, B['clock']) if L['mode'] == 'competitive']
    with open(out, 'w') as f:
        f.write('video_s\tlap\trace_s\trank\tname\tgap\n')
        for L in laps:
            gun = L['v0'] + L['pre']
            t = int(gun) + 1
            while t < L['v1']:
                lines = read_frame(B['video'], t, crop=(25, 280, 450, 770), fast=False)
                # rows: group by y; each row has a name (letters) and optionally a gap (+123m / LEADER)
                rows = {}
                for s, c, (x, y, w, h) in lines:
                    rows.setdefault(round((y + h / 2 - 111) / 67), []).append((x, s))   # rows 67 px apart, first at y≈111
                rank = 0
                for k in sorted(rows):
                    cells = [s for x, s in sorted(rows[k])]
                    name = next((s for s in cells if re.fullmatch(r"[A-Z][A-Z' ]{2,}", s) and s not in ('LEG', 'LEADER')), None)
                    if not name: continue
                    rank += 1
                    gap = next((s for s in cells if re.fullmatch(r'\+\d+m', s) or s == 'LEADER' or re.fullmatch(r'\d:\d\d(\.\d+)?', s)), '')
                    f.write('%d\t%s\t%d\t%d\t%s\t%s\n' % (t, L['name'], t - gun, rank, name, gap))
                f.flush()
                t += 1
            print(L['name'], 'done', file=sys.stderr)

if __name__ == '__main__':
    main()
