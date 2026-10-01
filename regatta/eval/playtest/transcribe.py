#!/usr/bin/env python3
"""regatta/eval/playtest/transcribe.py — transcribe a playtest session locally (the default since Sep 29 2026).

  python3 transcribe.py <tests_dir>            # whole session → transcripts/microphone-session-0.local.json

Screen Studio's own transcript failed at both of the first two venues: Lighthouse Cove's timing
collapsed after 13:23, and Clubhouse Point looped one phrase ×72 across 4½ minutes. This runs mlx-whisper
(large-v3-turbo, Apple Silicon, on-device — the model downloads once, no audio leaves the machine) on the
bundle's enhanced voice track, with condition_on_previous_text OFF (that's what lets a loop feed itself),
and writes word-level segments in Screen Studio's format. align.bundle() prefers *.local.json, then
*.fixed.json (retranscribe.py), then Screen Studio's. About 70 s for a 27-minute session.

Don't run it on a venue that's already labelled (labels.tsv is keyed to the phrase times it was built on).
"""
import sys, os, json, glob, subprocess, tempfile

MODEL = 'mlx-community/whisper-large-v3-turbo'
PROMPT = ('Regatta sailing racing game. SaltyCritter Yacht Club. Sailing terminology: tack, jibe, gybe, '
          'layline, starboard, port, spinnaker, planing, VMG, windward, leeward, gate, mark, ghost, fleet.')

def whisper_words(mic, t0=0.0, t1=None, prompt=PROMPT):
    """Word segments [{startMs, endMs, text}] on the recording clock for mic[t0:t1]."""
    from ocr import FFMPEG
    import mlx_whisper, soundfile
    wav = tempfile.mkstemp(suffix='.wav')[1]
    cut = ['-ss', str(t0)] + (['-t', str(t1 - t0)] if t1 else [])
    subprocess.run([FFMPEG, '-loglevel', 'error', '-y'] + cut + ['-i', mic, '-ac', '1', '-ar', '16000', wav], check=True)
    audio, _ = soundfile.read(wav, dtype='float32')   # an array: mlx_whisper would shell out to `ffmpeg` on PATH
    os.unlink(wav)
    r = mlx_whisper.transcribe(audio, path_or_hf_repo=MODEL, word_timestamps=True, language='en',
                               condition_on_previous_text=False, initial_prompt=prompt,
                               # drop text Whisper invents in silent gaps ("Thank you.", "I'm going to do the same" ×N —
                               # Bluewater Bonanza, Sep 30); needs word_timestamps, which we already ask for
                               hallucination_silence_threshold=2.0)
    words = [{'startMs': int((t0 + w['start']) * 1000), 'endMs': int((t0 + w['end']) * 1000), 'text': w['word']}
             for seg in r['segments'] for w in seg.get('words', [])]
    # Whisper's silence filler: a lone "Thank you." with >= 2 s of nothing either side (six at Bluewater Bonanza)
    out, i = [], 0
    while i < len(words):
        pair = ' '.join(w['text'].strip().lower().strip('.,!') for w in words[i:i + 2])
        before = words[i]['startMs'] - (words[i - 1]['endMs'] if i else -10**9)
        after = (words[i + 2]['startMs'] if i + 2 < len(words) else 10**12) - words[min(i + 1, len(words) - 1)]['endMs']
        if pair == 'thank you' and before >= 2000 and after >= 2000:
            i += 2; continue
        out.append(words[i]); i += 1
    return out

def main():
    from align import bundle
    B = bundle(sys.argv[1])
    if not B['mic']: sys.exit('no voice track in the bundle')
    words = whisper_words(B['mic'])
    for i, w in enumerate(words): w['index'] = i
    out = os.path.join(B['path'], 'transcripts', 'microphone-session-0.local.json')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump({'json': {'transcript': words, 'generator': {'type': 'mlx-whisper', 'model': MODEL, 'prompt': PROMPT}}}, open(out, 'w'))
    print('%d words → %s' % (len(words), out))

if __name__ == '__main__':
    main()
