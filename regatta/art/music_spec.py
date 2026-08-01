#!/usr/bin/env python3
"""Compare candidate tracks on the things the brief actually asks for.

    python3 regatta/art/music_spec.py "regatta/assets/audio/arctic.mp3:15:137.5" ...

The companion to `music_loop.py`, which answers "where does this track loop?".
This answers "should we ship it at all?" — it is the measurement that picked
Glacier Sound's track between two candidates and judged Lighthouse Cove's
replacement against the incumbent.

Pass `path:loopStart:loopEnd` so every number is taken over the LOOP BODY, which
is the only part of the file the game ever plays. Measuring the whole file mixes
in the intro and the fade and quietly flatters a track.

What it reports, and why each one is here:

  wind band 900-6.5k   the share of energy in the band `WIND_SOUND` highpasses
                       the bed into. LOWER IS BETTER — this is the music arguing
                       with the weather. ⚠️ This inverted in July 2026: bright
                       used to be good, when the bed sat on the low-mid.
  centroid             where the track's weight sits. Corroborates the above.
  dynamics             95th - 5th percentile of the half-second RMS. Race music
                       wants this narrowish; a track that swings 19 dB has a
                       passage that vanishes under the bed.
  key / third / fifth  a brief asking for "open fifths with no third" is asking
                       for a LOW third/fifth ratio, and that ratio is what chose
                       between the two Glacier candidates (0.31 vs 0.62).
                       ⚠️ The key estimate is a correlation, not a transcription.
                       Two readings within ~0.02 of each other (Lighthouse Cove:
                       D minor 0.721, D major 0.717) mean the third is AMBIGUOUS,
                       not that the track is minor. Check the chroma before
                       claiming Suno ignored the key.
  chroma flux          how much the harmony moves. "Texture not melody" briefs
                       want this low; a race track with a hook measures high.
  tempo                autocorrelation of the onset envelope; octave errors are
                       normal, so read it as a sanity check on the brief.

⚠️ Weighting is by MAGNITUDE, not power. Power weighting buries everything under
the bass — it reports Glacier Sound at 0.2% in the wind band where the number on
record is 5.4% — and nothing measured that way is comparable to the numbers in
[[regatta-music]] or in guidelines/music.md.

⚠️ None of this identifies an INSTRUMENT, so none of it can decide venue fit.
That call is made by ear against the registry in guidelines/music.md §6; these
numbers only say whether a track can survive the mix it has to live in.

Requires only macOS `afconvert` and numpy — no ffmpeg.
"""
import os, subprocess, sys, tempfile, wave
import numpy as np

SR = 22050
WIND_LO, WIND_HI = 900.0, 6500.0
PITCHES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
# Krumhansl-Schmuckler profiles
MAJ = np.array([6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88])
MIN = np.array([6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17])


def decode(path):
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as t:
        tmp = t.name
    subprocess.run(['afconvert', '-f', 'WAVE', '-d', f'LEI16@{SR}', '-c', '1', path, tmp],
                   check=True, capture_output=True)
    with wave.open(tmp) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float32) / 32768.0
    os.unlink(tmp)
    return x


def analyse(path, lo=None, hi=None):
    x = decode(path)
    dur = len(x) / SR
    a = int((lo or 0) * SR)
    b = int(hi * SR) if hi else len(x)
    body = x[a:b]

    N, HOP = 2048, 512
    nfr = (len(body) - N) // HOP
    win = np.hanning(N)
    frames = np.stack([body[i * HOP:i * HOP + N] * win for i in range(nfr)])
    S = np.abs(np.fft.rfft(frames, axis=1))
    freqs = np.fft.rfftfreq(N, 1 / SR)
    # MAGNITUDE-weighted, matching the earlier pass (and librosa's centroid).
    # Power weighting buries everything under the bass and is not comparable to
    # the numbers on record.
    P = S

    tot = P.sum() + 1e-12
    wind_share = P[:, (freqs >= WIND_LO) & (freqs <= WIND_HI)].sum() / tot
    hi2k = P[:, freqs >= 2000].sum() / tot
    centroid = (P * freqs).sum() / tot

    # loudness envelope over half-second frames -> dynamic range
    hop = SR // 2
    fr = body[:len(body) // hop * hop].reshape(-1, hop)
    db = 20 * np.log10(np.sqrt((fr ** 2).mean(1)) + 1e-6)
    mean_db = 20 * np.log10(np.sqrt((body ** 2).mean()) + 1e-12)
    dyn = float(np.percentile(db, 95) - np.percentile(db, 5))

    # chroma: fold spectral peaks onto 12 pitch classes
    ok = freqs > 55
    pc = np.round(12 * np.log2(freqs[ok] / 440.0) + 69).astype(int) % 12
    C = np.zeros((nfr, 12))
    for k in range(12):
        C[:, k] = S[:, ok][:, pc == k].sum(1)
    C /= (C.sum(1, keepdims=True) + 1e-12)
    flux = float(np.abs(np.diff(C, axis=0)).sum(1).mean())
    prof = C.mean(0)

    best = max(((np.corrcoef(np.roll(MAJ, r), prof)[0, 1], f'{PITCHES[r]} major', r, 1)
                for r in range(12)),
               key=lambda t: t[0])
    bestm = max(((np.corrcoef(np.roll(MIN, r), prof)[0, 1], f'{PITCHES[r]} minor', r, 0)
                 for r in range(12)), key=lambda t: t[0])
    key = best if best[0] >= bestm[0] else bestm
    root = key[2]
    third = prof[(root + (4 if key[3] else 3)) % 12]
    fifth = prof[(root + 7) % 12]

    # tempo: autocorrelation of the onset envelope
    env = np.maximum(0, np.diff(np.sqrt(P.sum(1))))
    env -= env.mean()
    ac = np.correlate(env, env, 'full')[len(env) - 1:]
    fps = SR / HOP
    lagmin, lagmax = int(fps * 60 / 180), int(fps * 60 / 60)
    bpm = 60 * fps / (lagmin + int(np.argmax(ac[lagmin:lagmax])))

    print(f'{os.path.basename(path):<26} body {len(body)/SR:6.1f}s of {dur:6.1f}s')
    print(f'  wind band 900-6.5k  {wind_share*100:5.1f}%      above 2 kHz {hi2k*100:5.1f}%')
    print(f'  centroid  {centroid:6.0f} Hz     mean {mean_db:6.1f} dB   dynamics {dyn:5.1f} dB')
    print(f'  key ~{key[1]:<9} (r={key[0]:.2f})  third {third:.3f} / fifth {fifth:.3f}'
          f' = {third/(fifth+1e-9):.2f}')
    print(f'  chroma flux {flux:.3f}          tempo ~{bpm:.0f} BPM')


for arg in sys.argv[1:]:
    parts = arg.rsplit(':', 2)
    if len(parts) == 3 and parts[1].replace('.', '').isdigit():
        analyse(parts[0], float(parts[1]), float(parts[2]))
    else:
        analyse(arg)
    print()
