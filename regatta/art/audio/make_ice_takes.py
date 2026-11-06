# Usage: python3 art/audio/make_ice_takes.py assets/audio   (from regatta/)
# Ice contact takes, synthesized: a fibreglass hull meeting floe ice.
# HARD: hull thump + brittle crack + crunch grains + grinding scrape + slosh.
# SOFT: a muffled knock, a few grains, a brush of scrape.
import sys, numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt
SR = 32000; OUT = sys.argv[1]
def t_(d): return np.arange(int(d*SR))/SR
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def mode(f, tau, d, rng, f_end=None):
    t = t_(d); fe = f if f_end is None else f_end
    ph = 2*np.pi*np.cumsum(f + (fe-f)*(1-np.exp(-t/0.08)))/SR
    return np.sin(ph + rng.uniform(0, 6.28)) * np.exp(-t/tau)
def grains(d, rate0, rate_tau, lo, hi, amp_tau, rng, glen=(0.001, 0.004)):
    n = int(d*SR); y = np.zeros(n); t = 0.0
    while t < d:
        rate = rate0*np.exp(-t/rate_tau) + 4
        t += rng.exponential(1/rate)
        if t >= d: break
        L = int(rng.uniform(*glen)*SR); i = int(t*SR)
        g = rng.standard_normal(L) * np.hanning(L) * rng.exponential(1.0) * np.exp(-t/amp_tau)
        f0 = np.exp(rng.uniform(np.log(lo), np.log(hi)))
        g = bp(np.concatenate([g, np.zeros(64)]), f0*0.7, min(f0*1.4, SR/2-100), 1)
        j = min(n, i+len(g)); y[i:j] += g[:j-i]
    return y
def env(d, att, tau):
    t = t_(d); return np.minimum(1, t/att) * np.exp(-t/tau)
def fit(x, n): return np.pad(x, (0, max(0, n-len(x))))[:n]
def norm(y, db=-3): y = y - y.mean(); y = y/np.abs(y).max()*10**(db/20); f=int(0.01*SR); y[-f:] *= np.linspace(1,0,f); return y
def hard(seed):
    rng = np.random.default_rng(seed); D = 1.3; n = int(D*SR)
    f0 = rng.uniform(78, 105)
    thump = 0.9*mode(f0*1.35, 0.10, D, rng, f0) + 0.35*mode(f0*2.3, 0.05, D, rng)
    thump *= np.minimum(1, t_(D)/0.002)
    click = hp(rng.standard_normal(int(0.006*SR)) * np.exp(-t_(0.006)/0.0015), 1200)
    crack = sum(a*mode(f*rng.uniform(0.9, 1.1), tau, D, rng) for f, tau, a in
                [(1450, 0.05, 0.25), (2350, 0.035, 0.22), (3700, 0.025, 0.18), (5300, 0.018, 0.12)])
    crack *= np.exp(-t_(D)/0.04)
    crunch = grains(0.7, rng.uniform(260, 380), 0.12, 1500, 9000, 0.17, rng)
    am = 0.6 + 0.4*np.sin(2*np.pi*np.cumsum(rng.uniform(14, 28, n))/SR)
    scrape = bp(rng.standard_normal(n), 450, 1900) * env(D, 0.03, 0.28) * am
    slosh = lp(rng.standard_normal(n), 500) * env(D, 0.04, 0.3)
    y = (thump + fit(click, n)*0.7 + crack + fit(crunch, n)/max(1e-9, np.abs(crunch).max())*0.55
         + scrape/np.abs(scrape).max()*0.22 + slosh/np.abs(slosh).max()*0.14)
    return norm(lp(y, 11000))
def soft(seed):
    rng = np.random.default_rng(seed); D = 0.7; n = int(D*SR)
    f0 = rng.uniform(120, 150)
    knock = 0.8*mode(f0*1.2, 0.05, D, rng, f0) + 0.2*mode(f0*2.6, 0.03, D, rng)
    knock *= np.minimum(1, t_(D)/0.004)
    crunch = grains(0.35, rng.uniform(70, 110), 0.07, 1000, 4500, 0.08, rng, (0.002, 0.005))
    brush = bp(rng.standard_normal(n), 350, 1400) * env(D, 0.02, 0.13)
    y = knock + fit(crunch, n)/max(1e-9, np.abs(crunch).max())*0.3 + brush/np.abs(brush).max()*0.2
    return norm(lp(y, 5000))
for i, s in enumerate([11, 23, 37], 1):
    for kind, fn in (('hard', hard), ('soft', soft)):
        y = fn(s + (0 if kind == 'hard' else 100))
        wavfile.write(f'{OUT}/ice-{kind}-{i}.wav', SR, (y*32767).astype(np.int16))
print('ok')
