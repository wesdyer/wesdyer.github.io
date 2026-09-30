#!/usr/bin/env python3
"""regatta/eval/playtest/retranscribe.py — repair a looped stretch of Screen Studio's transcript.

  python3 retranscribe.py <tests_dir> <from mm:ss> <to mm:ss>

Screen Studio's Whisper can fall into a loop (Clubhouse Point: "I'm going to go back to the front line"
×100 from 19:32 to 24:53, most of R2 and R3). This re-runs Whisper LOCALLY (mlx-whisper, Apple
Silicon; the model downloads once, no audio leaves the machine) on the bundle's enhanced voice
track for that window, with condition_on_previous_text off (it's what lets a loop feed itself), and
writes transcripts/<name>.fixed.json in the bundle: the original segments outside the window, the new
ones inside, same format. align.bundle() prefers a *.fixed.json.
"""
import sys, os, json, glob, subprocess, tempfile
from align import bundle
from ocr import FFMPEG

MODEL = 'mlx-community/whisper-large-v3-turbo'

def mm(s): m, x = s.split(':'); return int(m) * 60 + float(x)

def main():
    tests, t0, t1 = sys.argv[1], mm(sys.argv[2]), mm(sys.argv[3])
    B = bundle(tests)
    src = sorted(f for f in glob.glob(os.path.join(B['path'], 'transcripts', '*.json')) if not f.endswith('.fixed.json'))[0]
    doc = json.load(open(src))
    wav = tempfile.mkstemp(suffix='.wav')[1]
    subprocess.run([FFMPEG, '-loglevel', 'error', '-y', '-ss', str(t0), '-t', str(t1 - t0), '-i', B['mic'],
                    '-ac', '1', '-ar', '16000', wav], check=True)
    import mlx_whisper, soundfile
    audio, _ = soundfile.read(wav, dtype='float32')   # an array: mlx_whisper would shell out to `ffmpeg` on PATH
    prompt = doc['json'].get('generator', {}).get('prompt') or 'Regatta sailing racing game.'
    r = mlx_whisper.transcribe(audio, path_or_hf_repo=MODEL, word_timestamps=True, language='en',
                               condition_on_previous_text=False, initial_prompt=prompt)
    os.unlink(wav)
    new = []
    for seg in r['segments']:
        for w in seg.get('words', []):
            new.append({'startMs': int((t0 + w['start']) * 1000), 'endMs': int((t0 + w['end']) * 1000), 'text': w['word']})
    old = doc['json']['transcript']
    kept = [s for s in old if not (t0 * 1000 <= s['startMs'] < t1 * 1000)]
    merged = sorted(kept + new, key=lambda s: s['startMs'])
    for i, s in enumerate(merged): s['index'] = i
    doc['json']['transcript'] = merged
    doc['json']['repaired'] = {'from_s': t0, 'to_s': t1, 'model': MODEL, 'replaced': len(old) - len(kept), 'added': len(new)}
    out = src[:-5] + '.fixed.json'
    json.dump(doc, open(out, 'w'))
    print('replaced %d segments with %d words in %s–%s → %s' % (len(old) - len(kept), len(new), sys.argv[2], sys.argv[3], os.path.basename(out)))

if __name__ == '__main__':
    main()
