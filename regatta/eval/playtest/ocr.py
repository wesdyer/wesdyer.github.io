#!/usr/bin/env python3
"""regatta/eval/playtest/ocr.py — read HUD text off playtest video frames (Apple Vision, on-device).

  python3 ocr.py <image> [x y w h]          # print recognised lines (optional crop, image pixels)
  from ocr import read_frame, ocr_image      # (text, confidence, box) per line; box = x, y, w, h in pixels

Video: the bundle's raw screen track (align.bundle(b)['video'], 3072x2304, browser window only).
Leaderboard crop there: (25, 280, 450, 770) — rows of name + gap.

read_frame pulls one frame at a video time with the bundled ffmpeg and OCRs a crop of it —
e.g. the leaderboard every second to measure how much it jumps (PT-006).
"""
import sys, subprocess, tempfile, os
import Vision, Quartz
from Foundation import NSURL

FFMPEG = '/Users/wesdyer/Library/Python/3.11/lib/python/site-packages/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1'

def ocr_image(path, fast=False):
    url = NSURL.fileURLWithPath_(path)
    src = Quartz.CGImageSourceCreateWithURL(url, None)
    img = Quartz.CGImageSourceCreateImageAtIndex(src, 0, None)
    W, H = Quartz.CGImageGetWidth(img), Quartz.CGImageGetHeight(img)
    req = Vision.VNRecognizeTextRequest.alloc().init()
    req.setRecognitionLevel_(1 if fast else 0)          # 0 accurate, 1 fast
    req.setUsesLanguageCorrection_(False)               # HUD text is names and numbers
    Vision.VNImageRequestHandler.alloc().initWithCGImage_options_(img, None).performRequests_error_([req], None)
    out = []
    for o in req.results() or []:
        c = o.topCandidates_(1)[0]
        b = o.boundingBox()                              # normalised, origin bottom-left
        out.append((c.string(), c.confidence(),
                    (b.origin.x * W, (1 - b.origin.y - b.size.height) * H, b.size.width * W, b.size.height * H)))
    out.sort(key=lambda r: (round(r[2][1] / 8), r[2][0]))  # reading order
    return out

def read_frame(video, t, crop=None, scale=None, fast=False):
    """OCR one frame at video time t (s). crop = (x, y, w, h) in source pixels."""
    vf = []
    if crop: vf.append('crop=%d:%d:%d:%d' % (crop[2], crop[3], crop[0], crop[1]))
    if scale: vf.append('scale=%d:-1' % scale)
    fd, png = tempfile.mkstemp(suffix='.png'); os.close(fd)
    subprocess.run([FFMPEG, '-loglevel', 'error', '-y', '-ss', '%.3f' % t, '-i', video, '-frames:v', '1']
                   + (['-vf', ','.join(vf)] if vf else []) + [png], check=True)
    try: return ocr_image(png, fast)
    finally: os.unlink(png)

if __name__ == '__main__':
    p = sys.argv[1]
    if len(sys.argv) > 5:
        x, y, w, h = map(int, sys.argv[2:6])
        fd, tmp = tempfile.mkstemp(suffix='.png'); os.close(fd)
        subprocess.run([FFMPEG, '-loglevel', 'error', '-y', '-i', p, '-vf', 'crop=%d:%d:%d:%d' % (w, h, x, y), tmp], check=True)
        p = tmp
    for s, c, b in ocr_image(p): print('%.2f  %-30s %s' % (c, s, tuple(round(v) for v in b)))
