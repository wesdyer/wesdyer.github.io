#!/usr/bin/env python3
"""Measure a music track and print its MUSIC_TRACKS row.

    python3 regatta/art/music_loop.py regatta/assets/audio/seatrials.mp3

Suno ends every track with a fade, and the game loops what it is given. `loopEnd`
is where the music actually STOPS — the last half-second still within 12 dB of the
track's peak — so the loop turns around before the fade instead of playing it and
hard-cutting back to a cold intro. `trim` normalises playback level to the set's
-17 dB mean so a cue change is not also a volume change.

    ⚠️ loopEnd is a LEVEL measurement, not a bar line, so it can land mid-bar; the
    0.6 s seam crossfade blurs that rather than clicking. If you want it exact,
    crop the file to a bar boundary in a DAW and re-run this — it will then report
    loopEnd at the file duration and the seam becomes musically clean.

Requires only macOS `afconvert` and numpy — no ffmpeg.
"""
import os, subprocess, sys, tempfile, wave
import numpy as np

SR = 22050
TARGET_DB = -17.0          # the set's mean loudness; see regatta/guidelines
PEAK_DROP = 12.0           # content this far under peak counts as fade, not music
FLOOR_WINDOW = 8.0         # seconds; the window the density floor is taken over
FLOOR_TOL = 4.0            # dB of density mismatch tolerated at the loop seam
END_KEEP = 0.6             # a two-sided search may not cut past this much of the track


def decode(path):
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as t:
        tmp = t.name
    subprocess.run(['afconvert', '-f', 'WAVE', '-d', f'LEI16@{SR}', '-c', '1', path, tmp],
                   check=True, capture_output=True)
    with wave.open(tmp) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float32) / 32768.0
    os.unlink(tmp)
    return x


def measure(path):
    x = decode(path)
    duration = len(x) / SR
    hop = SR // 2                                   # half-second frames
    frames = x[:len(x) // hop * hop].reshape(-1, hop)
    db = 20 * np.log10(np.sqrt((frames ** 2).mean(1)) + 1e-6)
    loud = np.flatnonzero(db > db.max() - PEAK_DROP)
    loop_end = round(float(loud[-1] + 1) * 0.5, 1) if len(loud) else round(duration, 1)
    loop_end = min(loop_end, round(duration, 1))

    # loopSTART, and it is not the mirror of loopEnd. A track can begin at full LEVEL
    # and still be far too sparse to loop back into — Suno likes to open a bed with a
    # bare pulse and fill the texture in over the first half-minute. Peak level cannot
    # see that, so measure DENSITY: the local floor, the 10th percentile over an 8 s
    # window. A sparse passage has a deep floor because of the silence between hits.
    # loopStart is the earliest point whose floor matches the floor at loopEnd, so the
    # seam matches in texture and not merely in volume. The game ENTERS at loopStart as
    # well as returning to it, so anything before it is unused material.
    win = int(2 * FLOOR_WINDOW)          # half-second frames
    floor = np.array([np.percentile(db[max(0, i - win // 2):i + win // 2 + 1], 10)
                      for i in range(loud[-1] + 1)]) if len(loud) else np.array([0.0])
    end_floor = float(floor[-win:].mean())
    matched = np.flatnonzero(floor > end_floor - FLOOR_TOL)
    loop_start = round(float(matched[0]) * 0.5, 1) if len(matched) else 0.0
    if loop_start > loop_end * 0.4:
        loop_start = 0.0
    seam_step = abs(float(floor[int(loop_start * 2)]) - end_floor)

    # If moving the START alone cannot match the seam, move the END too. A track that
    # builds to a big finish has no early passage as dense as its last bar, so the
    # one-sided search always fails on it — but there is usually a pair further in that
    # matches perfectly, at the cost of a few seconds off the tail nobody will miss.
    # Bounded so it trims rather than truncates.
    two_sided = False
    fade_end = loop_end
    if seam_step > FLOOR_TOL and len(floor) > win:
        lo = int(loop_end * 2 * END_KEEP)
        best = None
        for e in range(lo, len(floor)):
            for s in range(0, int(e * 0.5)):
                step = abs(float(floor[s]) - float(floor[e]))
                if best is None or step < best[0]:
                    best = (step, s, e)
        if best and best[0] < seam_step:
            seam_step, loop_start = best[0], round(best[1] * 0.5, 1)
            loop_end = round(best[2] * 0.5, 1)
            two_sided = True

    # Level is measured over the LOOPED region only. Averaging the fade in as well
    # drags the mean down and over-trims exactly the tracks with the longest fades.
    mean_db = float(db[int(loop_start * 2):int(loop_end * 2)].mean()) if len(loud) else float(db.mean())
    trim = round(10 ** ((TARGET_DB - mean_db) / 20), 2)
    return duration, loop_start, loop_end, mean_db, trim, seam_step, fade_end, two_sided


def main(paths):
    for path in paths:
        if not os.path.exists(path):
            print(f'  !! {path}: not found', file=sys.stderr)
            continue
        duration, loop_start, loop_end, mean_db, trim, seam, fade_end, two_sided = measure(path)
        key = os.path.splitext(os.path.basename(path))[0]
        rel = os.path.relpath(path, 'regatta') if 'regatta' in path else path
        fade = duration - fade_end
        print(f'\n{key}  {duration:.1f}s, mean {mean_db:.1f} dB, '
              f'{fade:.1f}s of fade trimmed, loop seam matches within {seam:.1f} dB')
        start = f'loopStart: {loop_start}, ' if loop_start else ''
        print(f"    {key}: {{ file: '{rel}', {start}loopEnd: {loop_end}, trim: {trim} }},")
        if loop_start:
            print(f'    ↻ the first {loop_start:.1f}s are too sparse to loop back into, so the'
                  f' loop returns to {loop_start:.1f}s.')
            print('      Everything before it is unused: playback enters there too.')
        if two_sided:
            print(f'    ↻ and {fade_end - loop_end:.0f}s trimmed off the tail as well: the ending'
                  ' was denser than anything it could return to.')
        if fade < 0.5:
            print('    (no outro — the ending is its own loop point)')
        elif fade > 8:
            print(f'    ⚠️ {fade:.0f}s of fade: ask Suno for "no outro" next time')
        if seam > FLOOR_TOL:
            print(f'    ⚠️ seam still steps {seam:.0f} dB — the track never settles into a'
                  ' texture it can return to. Regenerate rather than patch.')


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])
