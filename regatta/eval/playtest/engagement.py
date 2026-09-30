#!/usr/bin/env python3
"""regatta/eval/playtest/engagement.py — when was Wes racing, and what was the race doing then?

  python3 engagement.py <tests_dir> <labels.tsv> [--init] > engagement.md   # bundle found inside tests_dir

Wes narrates feedback while he plays. When a moment grips him the narration turns into racing
talk ("come on wind", "I'm catching up") or stops. Those moments are the signal that the game is
working, so this lines them up with the race state.

labels.tsv: one row per phrase said inside a lap — `mm:ss<TAB>label<TAB>text`. Labels, hand-set by
Claude on reading, corrected by Wes:
  R racing talk (tactics, self-talk, excitement about the race itself)
  F feedback / design commentary (talking ABOUT the game)
  P praise of the experience while sailing
--init writes the rows with an empty label for a new venue.

Per 10 s bin: talk (R/F/P, `·` = silent ≥ 6 s of the bin), leg type (beat/reach/run by mean TWA),
speed, the nearest contest (TT: seconds to the ghost = the previous best lap; race: place and
units (1 u = 10 cm) to the nearest boat by course progress), near a mark.
"""
import json, math, sys, os
from align import load_laps, sample_video_t, iso, mmss, phrases, bundle

def mm(s): m, x = s.split(':'); return int(m) * 60 + int(x)

def progress_fn(course):
    L, lr, mk = course['legLens'], course['legRounds'], course['marks']
    def target(leg):
        if leg < len(lr) and lr[leg]: return lr[leg]['x'], lr[leg]['y']
        a, b = mk[-2], mk[-1]; return (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
    def prog(leg, x, y):
        if leg <= 0: return 0.0
        tx, ty = target(leg)
        ll = L[leg] if leg < len(L) else 0
        return sum(L[:leg]) + max(0.0, ll - math.hypot(x - tx, y - ty))
    return prog, target

def lap_bins(L, ghost=None):
    F, S = L['F'], L['S']
    prog, target = progress_fn(L['j']['course'])
    race = [s for s in S if s[F['phase']] == 1]
    gp = None
    if ghost:   # ghost progress by time, from the previous best lap
        G = ghost['F']; gr = [s for s in ghost['S'] if s[G['phase']] == 1]
        gp = [(s[G['t']], prog(s[G['leg']], s[G['x']], s[G['y']])) for s in gr]
    bins = {}
    for s in race:
        vt = sample_video_t(L, s); b = int(vt // 10) * 10
        B = bins.setdefault(b, dict(twa=[], spd=[], gap=[], place=[], near=[], mark=0, n=0))
        B['n'] += 1
        twa = abs(math.atan2(math.sin(s[F['hdg']] - s[F['windDir']]), math.cos(s[F['hdg']] - s[F['windDir']])))
        B['twa'].append(math.degrees(twa)); B['spd'].append(s[F['spd']])
        me = prog(s[F['leg']], s[F['x']], s[F['y']])
        tx, ty = target(s[F['leg']])
        if math.hypot(s[F['x']] - tx, s[F['y']] - ty) < 400: B['mark'] += 1
        if gp:   # seconds: + = ahead of the ghost
            t = s[F['t']]
            gt = next((a for a, p in gp if p >= me), None)
            if gt is not None: B['gap'].append(gt - t)
        if L['mode'] == 'competitive':
            ps = [prog(x[1], r[0], r[1]) for r, x in zip(s[F['rivals']], s[F['rivalsX']])]
            fin = len(L['j']['fleet']) - len(ps)
            B['place'].append(1 + fin + sum(1 for p in ps if p > me))
            if ps: B['near'].append(min(abs(p - me) for p in ps))
    return bins

def main():
    d, lpath = sys.argv[1], sys.argv[2]; BU = bundle(d)
    rec0 = BU['rec0']
    laps = load_laps(d, rec0)
    tj = BU['transcript']
    downs = [(k['t'], 'shift' in k['activeModifiers']) for k in BU['keys'] if k['type'] == 'keyDown' and not k['isARepeat']]
    loud = None
    if BU['mic'] and '--init' not in sys.argv:
        import numpy as np, librosa, subprocess, tempfile
        from ocr import FFMPEG   # decode the .m4a ourselves — librosa's audioread fallback is deprecated
        wav = tempfile.mkstemp(suffix='.wav')[1]
        subprocess.run([FFMPEG, '-loglevel', 'error', '-y', '-i', BU['mic'], '-ac', '1', '-ar', '16000', wav], check=True)
        y, sr = librosa.load(wav, sr=16000); os.unlink(wav)
        rms = librosa.feature.rms(y=y, hop_length=512)[0]
        loud = (librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=512), rms)
    def voice(b):
        w = sum(len(x['text'].split()) for x in tj if b <= x['startMs'] / 1000 < b + 10) / 10
        db = None
        if loud:
            import numpy as np
            sel = (loud[0] >= b) & (loud[0] < b + 10)
            if sel.any(): db = 20 * np.log10(np.percentile(loud[1][sel], 95) + 1e-9)
        ks = [sh for t, sh in downs if b <= t < b + 10]
        return w, db, len(ks) / 10, (sum(ks) / len(ks) if ks else 0)
    ph = phrases(tj)
    inlap = lambda t: next((L for L in laps if L['v0'] <= t <= L['v1']), None)
    if '--init' in sys.argv:
        with open(lpath, 'w') as f:
            for t, txt in ph:
                if inlap(t): f.write('%s\t\t%s\n' % (mmss(t), txt))
        return
    lab = {}
    for line in open(lpath):
        p = line.rstrip('\n').split('\t')
        if len(p) >= 2 and p[1]: lab[mm(p[0])] = p[1]
    # talk per bin: label of phrases starting in the bin, silence from segment gaps
    talk = {}
    for t, txt in ph:
        l = lab.get(int(t)) or lab.get(int(t) - 1) or lab.get(int(t) + 1)
        if l: talk.setdefault(int(t // 10) * 10, []).append(l)
    spoken = [(s['startMs'] / 1000, s['endMs'] / 1000) for s in tj]
    def silent(b):
        cov = sum(max(0, min(e, b + 10) - max(a, b)) for a, e in spoken)
        return cov < 4
    best = None; agg = {'R': [], 'F': [], 'P': [], 'mix': [], '·': []}
    print('# Engagement — %s\n' % os.path.basename(os.path.abspath(d)))
    print('Talk: R racing · F feedback · P praise · `·` silent. TT gap = s vs ghost (+ ahead). Race: place, units (1 u = 10 cm) to the nearest boat by course progress.\n')
    for L in laps:
        ghost = best if L['mode'] == 'solo' else None
        bins = lap_bins(L, ghost)
        print('## %s (%s)\n' % (L['name'], mmss(L['j']['finishTime'])))
        print('| video | talk | leg | kn-ish | contest | mark | words/s | dB | keys/s | shift |')
        print('|---|---|---|---|---|---|---|---|---|---|')
        for b in sorted(bins):
            B = bins[b]
            tw = sum(B['twa']) / len(B['twa'])
            leg = 'beat' if tw < 70 else 'run' if tw > 125 else 'reach'
            ls = talk.get(b, [])
            # dominant talk; a tie is 'mix' (max over a set picked a tie at random — hash order)
            cnt = sorted(((ls.count(k), k) for k in 'RFP' if k in ls), reverse=True)
            dom = ('mix' if len(cnt) > 1 and cnt[0][0] == cnt[1][0] else cnt[0][1]) if cnt else ('·' if silent(b) else '')
            if L['mode'] == 'solo':
                c = ('%+.1fs' % (sum(B['gap']) / len(B['gap']))) if B['gap'] else '—'
                cv = abs(sum(B['gap']) / len(B['gap'])) if B['gap'] else None
            else:
                pl = round(sum(B['place']) / len(B['place'])); nr = sum(B['near']) / len(B['near']) if B['near'] else 0
                c = 'P%d, %.0fu' % (pl, nr); cv = nr
            w, db, kps, sh = voice(b)
            print('| %s | %s | %s | %.2f | %s | %s | %.1f | %s | %.1f | %s |' % (mmss(b), ''.join(ls) or dom, leg, sum(B['spd']) / len(B['spd']), c,
                  '●' if B['mark'] > B['n'] / 3 else '', w, '%.0f' % db if db is not None else '—', kps, '%d%%' % (100 * sh) if kps else ''))
            if dom: agg[dom].append((L['mode'], cv, leg, sum(B['spd']) / len(B['spd']), B['mark'] > B['n'] / 3, w, db, kps, sh))
        print()
        if L['mode'] == 'solo' and (best is None or L['j']['finishTime'] < best['j']['finishTime']): best = L
    print('## Summary by dominant talk\n')
    print('| talk | bins | TT |gap to ghost| s | race gap to nearest (u) | beat/reach/run % | mean speed | near mark % | words/s | dB | keys/s | shift % |')
    print('|---|---|---|---|---|---|---|---|---|---|---|')
    for k, rows in agg.items():
        if not rows: continue
        tt = [c for m, c, *_ in rows if m == 'solo' and c is not None]
        rc = [c for m, c, *_ in rows if m == 'competitive' and c is not None]
        lg = [r[2] for r in rows]
        print(('| %s | %d | %s | %s | %d/%d/%d | %.2f | %d |' % (k, len(rows),
              '%.1f (n=%d)' % (sum(tt) / len(tt), len(tt)) if tt else '—',
              '%.0f (n=%d)' % (sum(rc) / len(rc), len(rc)) if rc else '—',
              100 * lg.count('beat') / len(lg), 100 * lg.count('reach') / len(lg), 100 * lg.count('run') / len(lg),
              sum(r[3] for r in rows) / len(rows), 100 * sum(1 for r in rows if r[4]) / len(rows))
              + ' %.1f | %s | %.2f | %.0f |' % (sum(r[5] for r in rows) / len(rows),
              '%.1f' % (sum(r[6] for r in rows if r[6] is not None) / max(1, sum(1 for r in rows if r[6] is not None))) if loud else '—',
              sum(r[7] for r in rows) / len(rows), 100 * sum(r[8] for r in rows) / len(rows))))

if __name__ == '__main__':
    main()
