#!/usr/bin/env python3
"""regatta/eval/playtest/fps.py — how many distinct frames the game drew, per lap, from the raw video.

  python3 fps.py <tests_dir> > <venue>/fps.md

The raw screen track is 60 fps. Repeated frames mean the game didn't render a new one, so ffmpeg's
mpdecimate (which drops near-duplicates) counts distinct frames over a 10-s window in the middle of each lap.
Glowtide Strait (Oct 1 2026) read 38–46 when Wes called it "jerky and slow". Measure every venue so there's
a baseline: a static menu reads low by construction, so only compare race windows.
"""
import sys, re, subprocess
from align import bundle, load_laps, mmss
from ocr import FFMPEG

def distinct_fps(video, t, secs=10):
    r = subprocess.run([FFMPEG, '-hide_banner', '-ss', str(t), '-t', str(secs), '-i', video,
                        '-vf', 'scale=768:-1,mpdecimate=hi=64*4:lo=64*2:frac=0.1', '-f', 'null', '-'],
                       capture_output=True, text=True)
    m = re.findall(r'frame=\s*(\d+)', r.stderr)
    return int(m[-1]) / secs if m else float('nan')

def main():
    S = sys.argv[1]; B = bundle(S)
    print('# Frame rate — distinct frames/s in a 10-s window mid-lap (raw track is 60 fps)\n')
    print('| lap | window | fps |\n|---|---|---|')
    for L in load_laps(S, B['clock']):
        mid = (L['v0'] + L['pre'] + L['v1']) / 2
        print('| %s | %s | %.1f |' % (L['name'], mmss(mid), distinct_fps(B['video'], mid)))

if __name__ == '__main__':
    main()
