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
                       ⚠️ It needs HARMONIC content. On a percussion-led track
                       (Emberfall Isle) struck metal and drums smear energy over all
                       twelve pitch classes, the chroma comes back nearly uniform,
                       and the mode reading is noise however confident r looks —
                       check the profile is peaked before believing it.
                       ⚠️ The key estimate is a correlation, not a transcription.
                       Two readings within ~0.02 of each other (Lighthouse Cove:
                       D minor 0.721, D major 0.717) mean the third is AMBIGUOUS,
                       not that the track is minor. Check the chroma before
                       claiming Suno ignored the key.
  chroma flux          how much the harmony moves. "Texture not melody" briefs
                       want this low; a race track with a hook measures high.
  tempo                autocorrelation of the onset envelope. Reported as the
                       PEAK FAMILY plus a resolved pulse, because the strongest
                       peak is usually the fastest thing moving, not the beat:
                       Bluewater Bonanza's sixteenth-note surface peaks at 172
                       over an 86 BPM pulse, and a search clamped to 60-180 (as
                       this was) reports 172 and hides the 86.
                       ⚠️ Still a sanity check. It cannot see a tempo the onsets
                       do not state, and a track with a double-time section
                       (Pearl Lagoon) defeats autocorrelation outright.

⚠️ Weighting is by MAGNITUDE, not power. Power weighting buries everything under
the bass — it reports Glacier Sound at 0.2% in the wind band where the number on
record is 5.4% — and nothing measured that way is comparable to the numbers in
[[regatta-music]] or in guidelines/music.md.

⚠️ None of this identifies an INSTRUMENT, so none of it can decide venue fit.
That call is made by ear against the registry in guidelines/music.md §10; these
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

    # tempo: autocorrelation of the onset envelope, over a range wide enough to
    # SEE the octave rather than clamp it away. The strongest peak is whatever
    # moves fastest, so report the family and resolve a pulse out of it.
    env = np.maximum(0, np.diff(np.sqrt(P.sum(1))))
    env -= env.mean()
    ac = np.correlate(env, env, 'full')[len(env) - 1:]
    fps = SR / HOP
    lagmin, lagmax = int(fps * 60 / 320), int(fps * 60 / 40)
    seg = ac[lagmin:lagmax]
    seg = seg / (seg.max() + 1e-12)
    peaks = sorted(((seg[i], 60 * fps / (lagmin + i))
                    for i in range(1, len(seg) - 1)
                    if seg[i] > seg[i - 1] and seg[i] > seg[i + 1] and seg[i] > 0.25),
                   reverse=True)
    fam, strength = [], {}
    for s, b in peaks:                      # dedupe near-identical lags
        if not any(abs(b - x) < 3 for x in fam):
            fam.append(b)
            strength[b] = s
    bpm = fam[0] if fam else 0.0
    # The pulse is the family member that EXPLAINS the most of the family — the
    # beat every other peak is a multiple or subdivision of — not the strongest
    # peak. Clubhouse Point is why: its peaks are 66/50/199/99 against a 100 BPM
    # brief, and 66 is both the strongest and a triplet artifact of 199, while 99
    # accounts for all four. Strength alone would report 66 and call the brief missed.
    #   ⚠️ OCTAVES ONLY. Admitting 3/2 and 2/3 relations lets spurious peaks vote:
    #   with those allowed, 66 explains MORE of Clubhouse Point's family than 99
    #   does (3.72 vs 3.41) and still wins. A pulse relates to its own subdivisions
    #   by powers of two; the 1.5x neighbours are the artifacts being screened out.
    RATIOS = (0.25, 0.5, 1.0, 2.0, 4.0)

    def explains(b):
        return sum(strength[o] for o in fam
                   if any(abs(o - b * r) <= 0.05 * o for r in RATIOS))

    inrange = [b for b in fam if 60 <= b <= 140]
    pulse = max(inrange, key=lambda b: (round(explains(b), 3), strength[b])) if inrange else bpm

    print(f'{os.path.basename(path):<26} body {len(body)/SR:6.1f}s of {dur:6.1f}s')
    print(f'  wind band 900-6.5k  {wind_share*100:5.1f}%      above 2 kHz {hi2k*100:5.1f}%')
    print(f'  centroid  {centroid:6.0f} Hz     mean {mean_db:6.1f} dB   dynamics {dyn:5.1f} dB')
    print(f'  key ~{key[1]:<9} (r={key[0]:.2f})  third {third:.3f} / fifth {fifth:.3f}'
          f' = {third/(fifth+1e-9):.2f}')
    fams = '/'.join(f'{b:.0f}' for b in fam[:4])
    print(f'  chroma flux {flux:.3f}          tempo peaks {fams} -> pulse ~{pulse:.0f} BPM')


for arg in sys.argv[1:]:
    parts = arg.rsplit(':', 2)
    if len(parts) == 3 and parts[1].replace('.', '').isdigit():
        analyse(parts[0], float(parts[1]), float(parts[2]))
    else:
        analyse(arg)
    print()
