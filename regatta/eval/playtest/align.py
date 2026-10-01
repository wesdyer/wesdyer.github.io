#!/usr/bin/env python3
"""regatta/eval/playtest/align.py — line up a playtest session: video, narration, laps.

Wes's playtest sessions (Sep 29 2026): one Screen Studio recording per venue, 3 time
trials + 3 single races, narrated live, plus the six traj_*.json files. This puts all
three on the VIDEO clock so a remark, a frame and a trajectory sample can be found
from each other.

  python3 align.py <tests_dir> [bundle] > timeline.md   # bundle defaults to the one inside tests_dir

- session_dir holds the exported .mp4 and the traj_*.json files.
- bundle: the Screen Studio project. It gives the EXACT recording start
  (recording/metadata.json unixStartMs — the bundle's name is local time to the second and
  the video ran ~2 s later), the transcript (transcripts/*.json — use it, not the exported
  .srt: the Lighthouse Cove .srt collapsed everything after 13:23 into one backwards cue),
  keystrokes, mouse clicks, the enhanced (voice-only) mic track and the RAW screen video
  (recording/channel-1-display-0.mp4) — same clock as the export, none of its overlays.
  Wes no longer exports; the .mp4 in session_dir is optional. The export must be one
  uncut 1x slice — bundle() checks project.json.

Clocks: `started` is stamped at a lap's first sample, the filename number is Date.now()
at the finish download. Game time between them (prestart countdown + race clock) is
compared with wall time; a drift means frames were dropped or the tab stalled.
"""
import json, glob, os, sys, re
from datetime import datetime

def iso(s): return datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp()
def mmss(s): s = max(0, s); return '%d:%02d' % (s // 60, s % 60)

SS_HOME = os.path.expanduser('~/Desktop/regatta tests')   # where Screen Studio saves recordings

def _sessions(meta):
    """The display recorder's sessions, in order. A PAUSED recording has several (Spoonbill Flats, Sep 30:
    20:24, a 4-minute pause, then 4:22) — each with its own display-N, microphone-N, keystrokes-N … files."""
    return [s for r in meta['recorders'] if r['type'] == 'display' for s in r['sessions']]

def _joined(R, sess, FFMPEG):
    """Several sessions → one video and one voice track, back to back (Screen Studio's own timeline: the pause is
    cut out). Stream copy, so the frames are the originals. Cached in recording/joined/ (keep.py doesn't archive it).
    Each session's voice is its enhanced track if Screen Studio wrote one, else its raw mic (said so)."""
    import subprocess
    J = os.path.join(R, 'joined'); os.makedirs(J, exist_ok=True)
    video, mic = os.path.join(J, 'display.mp4'), os.path.join(J, 'microphone-voice.m4a')
    def concat(parts, out, extra):
        if os.path.exists(out) and os.path.getmtime(out) >= max(os.path.getmtime(x) for x in parts): return
        lst = out + '.txt'
        open(lst, 'w').write(''.join("file '%s'\n" % x.replace("'", "'\\''") for x in parts))
        subprocess.run([FFMPEG, '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst] + extra + [out], check=True)
        os.unlink(lst)
    vids = [os.path.join(R, 'channel-1-display-%d.mp4' % i) for i in range(len(sess))]
    if all(os.path.exists(v) for v in vids): concat(vids, video, ['-c', 'copy'])
    else: video = None
    voices = []
    for i in range(len(sess)):
        e = glob.glob(os.path.join(R, 'enhanced', '*microphone-%d-enhanced*' % i))
        if not e: print('⚠️  session %d has no enhanced voice track — its raw mic is used (dB not comparable across the pause)' % i, file=sys.stderr)
        voices.append(e[0] if e else os.path.join(R, 'channel-2-microphone-%d.m4a' % i))
    # re-encode the audio: the enhanced and raw tracks differ in format, and a concat of AAC needs one
    concat(voices, mic, ['-ac', '1', '-c:a', 'aac', '-b:a', '96k'])
    return video, mic

def _covers(b, tests_dir):
    """Does bundle b's recording window contain every lap in tests_dir?"""
    try:
        m = json.load(open(os.path.join(b, 'recording', 'metadata.json')))
        ss = _sessions(m)   # a paused recording spans its first session's start to its last one's end
        t0, t1 = ss[0]['unixStartMs'] / 1000, ss[-1]['unixStartMs'] / 1000 + ss[-1]['durationMs'] / 1000
        laps = [iso(json.load(open(f))['started']) for f in glob.glob(os.path.join(tests_dir, 'traj_*.json'))]
        return bool(laps) and all(t0 <= t <= t1 for t in laps)
    except Exception:
        return False

def bundle(path):
    """Everything a Screen Studio bundle knows, on one clock (seconds from recording start).
    `path` may be the bundle or the venue's test folder holding it (Wes keeps them together)."""
    if os.path.isdir(os.path.join(path, 'bundle', 'recording')):   # a keep.py archive (raw video deleted)
        path = os.path.join(path, 'bundle')
    if not os.path.isdir(os.path.join(path, 'recording')):
        found = sorted(glob.glob(os.path.join(path, '*.screenstudio')))
        if not found:
            # Wes can leave the bundle where Screen Studio saved it: pick the one in ~/Desktop/regatta tests whose
            # recording window covers the laps' start times (moving it early split the audio, Sep 29)
            found = [b for b in glob.glob(os.path.join(SS_HOME, '*.screenstudio')) if _covers(b, path)]
        if len(found) != 1: sys.exit('expected one .screenstudio bundle in %s (or covering its laps in %s), found %d' % (path, SS_HOME, len(found)))
        path = found[0]
    R = os.path.join(path, 'recording')
    meta = json.load(open(os.path.join(R, 'metadata.json')))
    sess = _sessions(meta)
    rec0 = sess[0]['unixStartMs'] / 1000
    # THE VIDEO CLOCK across a pause: session k's wall time maps to (wall − its start) + the durations before it.
    # Wall times inside a pause clamp to the cut. One session → wall − rec0, exactly as before.
    spans, acc = [], 0.0
    for s in sess:
        spans.append((s['unixStartMs'] / 1000, s['unixEndMs'] / 1000 if 'unixEndMs' in s else s['unixStartMs'] / 1000 + s['durationMs'] / 1000, acc))
        acc += s['durationMs'] / 1000
    def clock(w):
        for a, b, off in reversed(spans):
            if w >= a: return off + min(w, b) - a
        return w - rec0
    if len(sess) > 1:
        print('note: %d recording sessions (paused); the video clock joins them back to back, pauses cut' % len(sess), file=sys.stderr)
    proj = json.load(open(os.path.join(path, 'project.json')))['json']
    sl = [x for sc in proj['scenes'] for x in sc['slices']]
    # Only an EXPORT can be cut; the raw track we read is always on the recording clock.
    cut = bool(sl) and not (len(sl) == 1 and sl[0]['timeScale'] == 1 and sl[0]['sourceStartMs'] == 0)
    if cut: print('note: the Screen Studio edit has %d slices — an exported .mp4 would not match; the raw track does' % len(sl), file=sys.stderr)
    # a retranscribe.py repair first (it's a patch ON the best source), then the local transcript, then Screen Studio's
    rank = lambda f: 0 if f.endswith('.fixed.json') else 1 if f.endswith('.local.json') else 2
    tr = sorted(glob.glob(os.path.join(path, 'transcripts', '*.json')), key=rank)
    keys = [k for i in range(len(sess)) if os.path.exists(os.path.join(R, 'keystrokes-%d.json' % i))
            for k in json.load(open(os.path.join(R, 'keystrokes-%d.json' % i)))]
    mic = (glob.glob(os.path.join(R, 'enhanced', '*microphone*')) or glob.glob(os.path.join(R, '*microphone*.m4a')) or [None])[0]
    if mic and '/enhanced/' not in mic:
        # Screen Studio finishes the enhanced (voice-only) track AFTER recording; if the bundle was moved first it
        # lands in a same-named stub back in SS_HOME (Pearl Lagoon, Sep 29). Use it if it's there.
        stub = glob.glob(os.path.join(SS_HOME, os.path.basename(path.rstrip('/')), 'recording', 'enhanced', '*microphone*'))
        if stub: mic = stub[0]
        else: print('⚠️  no enhanced voice track — using the raw mic (dB is then comparable only within this venue)', file=sys.stderr)
    video = os.path.join(R, 'channel-1-display-0.mp4')   # raw screen: no webcam/captions/padding, 3072x2304
    dur = sum(s['durationMs'] for s in sess) / 1000
    if len(sess) > 1:
        from ocr import FFMPEG
        if os.path.exists(video) or os.path.isdir(os.path.join(R, 'joined')):
            jv, jm = _joined(R, sess, FFMPEG) if os.path.exists(video) else (None, os.path.join(R, 'joined', 'microphone-voice.m4a'))
            video = jv or video
            if os.path.exists(jm): mic = jm
    if tr:   # Whisper loops: one phrase over and over (Clubhouse Point, 19:32-24:53) — repair with retranscribe.py
        segs = json.load(open(tr[0]))['json']['transcript']
        from collections import Counter
        words = ' '.join(s['text'] for s in segs).split()
        grams = Counter(' '.join(words[i:i + 8]) for i in range(len(words) - 8))
        g, n = grams.most_common(1)[0] if grams else ('', 0)
        if n > 8: print('⚠️  transcript loops: "%s" ×%d — run retranscribe.py on that stretch' % (g, n), file=sys.stderr)
    # Screen Studio markers (Wes drops one when something should be kept). The format isn't known yet —
    # both Sep 29 files were empty — so take any time-like number and say so if nothing parses.
    markers, mf = [], os.path.join(path, 'recording-markers.json')
    if os.path.exists(mf):
        def walk(o):
            if isinstance(o, dict):
                ks = [k for k in o if isinstance(o[k], (int, float)) and any(w in k.lower() for w in ('ms', 'time', 'at', 'start'))]
                if ks:
                    v = float(o[ks[0]])
                    markers.append(clock(v / 1000) if v > 1e12 else v / 1000 if 'ms' in ks[0].lower() or v > 1e5 else v)
                for x in o.values(): walk(x)
            elif isinstance(o, list):
                for x in o: walk(x)
        raw = json.load(open(mf)); walk(raw)
        if raw and raw != {'json': []} and not markers:
            print('⚠️  recording-markers.json has content but no time field was recognised: %s' % json.dumps(raw)[:200], file=sys.stderr)
    return dict(path=path, markers=sorted(markers), markers_file=mf if os.path.exists(mf) else None, duration=dur, rec0=rec0, clock=clock, sessions=len(sess), cut=cut, video=video if os.path.exists(video) else None, transcript=json.load(open(tr[0]))['json']['transcript'] if tr else [],
                keys=sorted([dict(k, t=clock(k['unixTimeMs'] / 1000)) for k in keys], key=lambda k: k['t']), mic=mic)

def load_laps(d, rec0):
    """rec0: the bundle's clock (B['clock'], which handles a paused recording) or a bare start time."""
    clock = rec0 if callable(rec0) else (lambda w: w - rec0)
    laps = []
    for f in sorted(glob.glob(os.path.join(d, 'traj_*.json'))):
        j = json.load(open(f))
        F = {k: i for i, k in enumerate(j['format'])}
        S = j['samples']
        t0 = iso(j['started'])
        end_wall = int(re.findall(r'_(\d{13})\.json$', f)[0]) / 1000
        pre = S[0][F['t']] if S[0][F['phase']] == 0 else 0
        # elapsed = the last sample's race clock, NOT finishTime: a "+15 s at finish" penalty is added to
        # finishTime (Sockeye Run R1 read −14.9 s drift until this), and a race that never finished has none
        game = pre + (S[-1][F['t']] if S[-1][F['phase']] == 1 else 0)
        laps.append(dict(file=os.path.basename(f), j=j, F=F, S=S, mode=j['mode'],
                         v0=clock(t0), v1=clock(end_wall), pre=pre, game=game,
                         drift=(end_wall - t0) - game))
    laps.sort(key=lambda L: L['v0'])
    n = {'solo': 0, 'competitive': 0}
    for L in laps:
        n[L['mode']] += 1
        L['name'] = ('TT' if L['mode'] == 'solo' else 'R') + str(n[L['mode']])
    return laps

def sample_video_t(L, s):
    """Video seconds for one sample (prestart counts down, racing counts up)."""
    F = L['F']
    el = (L['pre'] - s[F['t']]) if s[F['phase']] == 0 else L['pre'] + s[F['t']]
    return L['v0'] + el

def phrases(tj):
    """Whisper segments -> sentences, broken on terminal punctuation or 1.2 s gaps."""
    out, cur, st, last = [], '', None, None
    # Whisper sometimes stamps a segment with the session's end time (Lighthouse
    # Cove: 13:26 came out as 38:54) — clamp anything that leaps past its neighbour.
    tj = [dict(s) for s in tj]
    for i in range(len(tj)):
        ahead = [x['startMs'] for x in tj[i + 1:i + 40]]
        if ahead and tj[i]['startMs'] > min(ahead) + 1000:
            tj[i]['startMs'] = tj[i - 1]['endMs'] if i else 0
            tj[i]['endMs'] = max(tj[i]['startMs'], min(ahead))
    for seg in tj:
        if cur and last is not None and seg['startMs'] - last > 1200:
            out.append((st, cur.strip())); cur, st = '', None
        if st is None: st = seg['startMs']
        cur += seg['text']; last = seg['endMs']
        if re.search(r'[.?!]["\')]?$', seg['text'].strip()) and len(cur) > 40:
            out.append((st, cur.strip())); cur, st = '', None
    if cur: out.append((st, cur.strip()))
    return [(ms / 1000, txt) for ms, txt in out]

def main():
    d = sys.argv[1]; B = bundle(sys.argv[2] if len(sys.argv) > 2 else d)
    rec0 = B['rec0']
    laps = load_laps(d, B['clock'])
    print('# Timeline — %s\n' % os.path.basename(os.path.abspath(d)))
    print('Video clock = wall clock − %s (bundle metadata). Drift = wall duration − game duration (≈0 is good).\n'
          % datetime.utcfromtimestamp(rec0).isoformat(timespec='milliseconds')
          + ('' if B['sessions'] == 1 else ' **%d sessions (paused): the clock joins them back to back with each pause cut, as Screen Studio\'s own timeline does.** Within a lap the clocks still agree (drift).\n' % B['sessions']))
    print('| lap | file | video in | video out | result | drift s |')
    print('|---|---|---|---|---|---|')
    for L in laps:
        print('| %s | %s | %s | %s | %s | %+.1f |' % (L['name'], L['file'], mmss(L['v0']), mmss(L['v1']),
              mmss(L['j']['finishTime']) if L['j'].get('finishTime') else 'DNF', L['drift']))
    if B['transcript']:
        tj = B['transcript']
        cur = None
        print()
        for t, txt in phrases(tj):
            where = 'between'
            for L in laps:
                if L['v0'] - 1 <= t <= L['v1'] + 1:
                    where = L['name']
                    if L['pre'] and t < L['v0'] + L['pre']: where += ' prestart'
            head = where if where != 'between' else 'menus / between laps'
            if head != cur:
                print('\n## %s\n' % head); cur = head
            print('- `%s` %s' % (mmss(t), txt))

if __name__ == '__main__':
    main()
