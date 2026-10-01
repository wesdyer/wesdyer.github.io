#!/usr/bin/env python3
"""regatta/eval/playtest/keep.py — keep what matters from a 16 GB Screen Studio bundle.

  python3 keep.py <tests_dir> <venue_issues_dir>            # clips + archive
  python3 keep.py <tests_dir> <venue_issues_dir> --clips    # clips only (after editing clips.tsv)

Wes can't keep the raw recordings. Before one is deleted this writes, into the venue's issues folder:

- clips/<MMmSS>_<slug>.mp4 — every row of <venue>/clips.tsv (`start<TAB>end<TAB>slug<TAB>issues`, video
  mm:ss), cut from the RAW screen track + the enhanced voice track: 1536 px, 30 fps, crf 26, ~0.2 MB/s.
- archive/session_proxy.mp4 — the whole session, 1280 px, 10 fps, crf 30, with voice (~2.5 MB/min), so a
  moment nobody flagged can still be found later.
- archive/ — trajectories, transcript JSON, keystrokes, clicks, mouse moves, metadata, project.json and the
  enhanced voice track: everything align/laps/engagement read. `bundle()` accepts the archive dir too.

No export needed: the bundle's display + mic tracks share the recording clock (Sep 29 2026).
"""
import sys, os, glob, shutil, subprocess
from align import bundle, mmss
from ocr import FFMPEG

def mm(s):
    p = [float(x) for x in s.split(':')]
    return p[0] * 60 + p[1] if len(p) == 2 else p[0] * 3600 + p[1] * 60 + p[2]

def cut(video, mic, t0, t1, out, width=1536, fps=30, crf=26, ab='96k', preset='medium'):
    a = ['-ss', '%.2f' % t0, '-t', '%.2f' % (t1 - t0)]
    cmd = [FFMPEG, '-loglevel', 'error', '-y'] + a + ['-i', video]
    if mic: cmd += a + ['-i', mic, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', ab]
    cmd += ['-vf', 'scale=%d:-2,fps=%d' % (width, fps), '-c:v', 'libx264', '-crf', str(crf), '-preset', preset,
            '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out]
    subprocess.run(cmd, check=True)

def main():
    tests, vdir = sys.argv[1], sys.argv[2]
    B = bundle(tests)
    if not B['video']: sys.exit('no raw video in the bundle — nothing to cut (already archived?)')
    cpath = os.path.join(vdir, 'clips.tsv')
    rows = [l.rstrip('\n').split('\t') for l in open(cpath) if l.strip() and not l.startswith('#')] if os.path.exists(cpath) else []
    # every Screen Studio marker Wes dropped becomes a clip (−15 s / +10 s) unless a row already covers it
    for m in B['markers']:
        if not any(mm(r[0]) <= m <= mm(r[1]) for r in rows):
            r = [mmss(max(0, m - 15)), mmss(m + 10), 'marker-%s' % mmss(m).replace(':', 'm'), 'marker']
            rows.append(r); open(cpath, 'a').write('\t'.join(r) + '\n')
            print('marker at %s → clip row added' % mmss(m))
    os.makedirs(os.path.join(vdir, 'clips'), exist_ok=True)
    total = 0
    for r in rows:
        t0, t1, slug = mm(r[0]), mm(r[1]), r[2]
        out = os.path.join(vdir, 'clips', '%s_%s.mp4' % (mmss(t0).replace(':', 'm').zfill(5), slug))
        if not os.path.exists(out):
            cut(B['video'], B['mic'], t0, t1, out)
        total += os.path.getsize(out)
        print('%-45s %5.1fs %5.1f MB  %s' % (os.path.basename(out), t1 - t0, os.path.getsize(out) / 1e6, r[3] if len(r) > 3 else ''))
    print('clips: %d, %.0f MB' % (len(rows), total / 1e6))
    if '--clips' in sys.argv: return
    arc = os.path.join(vdir, 'archive'); os.makedirs(arc, exist_ok=True)
    root = B['path']; R = os.path.join(root, 'recording')
    for f in glob.glob(os.path.join(tests, 'traj_*.json')): shutil.copy2(f, arc)
    keep = [os.path.join(root, 'project.json'), os.path.join(root, 'meta.json'), os.path.join(root, 'recording-markers.json')] + glob.glob(os.path.join(root, 'transcripts', '*.json')) \
         + [os.path.join(R, n) for n in ('metadata.json', 'metadata-raw.json', 'cursors.json')] \
         + sorted(glob.glob(os.path.join(R, 'keystrokes-*.json')) + glob.glob(os.path.join(R, 'mouseclicks-*.json')) + glob.glob(os.path.join(R, 'mousemoves-*.json'))) \
         + sorted(glob.glob(os.path.join(R, 'enhanced', '*'))) \
         + ([B['mic']] if B['mic'] else [])   # a paused recording's joined voice (recording/joined/) — what the tools read
    for f in keep:
        if not os.path.exists(f): continue
        # the enhanced track may live in a stub outside the bundle — archive it where the bundle would hold it
        rel = os.path.relpath(f, root) if f.startswith(root) else os.path.join('recording', 'enhanced', os.path.basename(f))
        dst = os.path.join(arc, 'bundle', rel); os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(f, dst)
    proxy = os.path.join(arc, 'session_proxy.mp4')
    if not os.path.exists(proxy):
        dur = B['duration']
        cut(B['video'], B['mic'], 0, dur, proxy, width=1280, fps=10, crf=30, ab='48k', preset='veryfast')
    size = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(arc) for f in fs)
    print('archive: %.0f MB (proxy %.0f MB)' % (size / 1e6, os.path.getsize(proxy) / 1e6))

if __name__ == '__main__':
    main()
