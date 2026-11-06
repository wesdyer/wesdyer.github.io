# Usage: python3 art/audio/make_cargo_horn.py ~/Desktop/cargo-horn.wav assets/audio   (from regatta/; the source take is not in the repo)
# Cargo horn: Wes's take -> a NEAR and a FAR mono 24 kHz WAV for assets/audio.
import sys, numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, resample_poly
src, outdir = sys.argv[1], sys.argv[2]
sr, x = wavfile.read(src); x = x.astype(np.float64) / 32768
m = x.mean(axis=1)
m = resample_poly(m, 1, 2); sr = 24000            # nothing above 4 kHz worth keeping
def fade(y, a, b):
    y = y.copy(); na, nb = int(a*sr), int(b*sr)
    if na: y[:na] *= np.linspace(0, 1, na)
    if nb: y[-nb:] *= np.linspace(1, 0, nb)
    return y
def norm(y, peak_db=-3.0): return y / np.abs(y).max() * 10**(peak_db/20)
def save(name, y): wavfile.write(f"{outdir}/{name}", sr, (np.clip(y, -1, 1)*32767).astype(np.int16)); print(name, "%.2f s" % (len(y)/sr))
# trim the 0.05 s lead silence
start = int(0.04*sr); m = m[start:]
# NEAR: the take as it is, mono, headroom restored, a hair of fade so the edges never click.
save("cargo-horn-near.wav", norm(fade(m, 0.005, 0.05)))
# FAR: across the harbour. Air and distance take the top (2nd-order low-pass ~650 Hz, the
# fundamental and first harmonics survive), the onset softens, and the water and the quays
# answer: two discrete reflections plus a short diffuse tail.
far = sosfilt(butter(2, 650, 'low', fs=sr, output='sos'), m)
far = sosfilt(butter(1, 70, 'high', fs=sr, output='sos'), far)
far = fade(far, 0.12, 0.0)
tail = int(2.2*sr); y = np.concatenate([far, np.zeros(tail)])
for dly, g in [(0.19, 0.32), (0.43, 0.18)]:
    d = int(dly*sr); y[d:d+len(far)] += g*far
rng = np.random.default_rng(7); n = int(1.8*sr)
ir = rng.standard_normal(n) * np.exp(-np.arange(n)/sr * 3.8)
ir = sosfilt(butter(2, 900, 'low', fs=sr, output='sos'), ir); ir /= np.sqrt((ir**2).sum())
wet = np.convolve(np.concatenate([far, np.zeros(tail)]), ir)[:len(y)]
y = y + 0.30 * wet[:len(y)] * (np.abs(far).max()/np.abs(wet).max())
save("cargo-horn-far.wav", norm(fade(y, 0, 0.4)))
