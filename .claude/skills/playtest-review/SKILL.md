---
name: playtest-review
description: Review one venue of Wes's narrated regatta playtest (Screen Studio video + transcript + 6 traj_*.json) and file what it shows into ~/Desktop/regatta-issues — issues with evidence, venue impressions, and when he was engaged with the racing. Use when Wes hands over a venue's test folder ("here's <venue>", "<venue>-tests is ready", "review the video").
---

# Playtest review — one venue

Wes plays each venue 3× Time Trial + 3× single race, recorded in Screen Studio and narrated
live. The output lives in **`~/Desktop/regatta-issues/`** (local git, never the public repo):
`issues.md` (one cross-venue list), `<venue>/` (timeline, laps, labels, engagement, session,
evidence). Read its `README.md` for the issue entry format before filing anything.

Wes does this **together**: review → he triages priorities → fix one by one. Don't start fixing
during a review.

## Inputs

One folder per venue, **`~/Desktop/<venue>-tests/`**, holding:
- the six `traj_<key>_<solo|competitive>_<ts>.json` files
- the Screen Studio **bundle** `Google Chrome <date>.screenstudio`, which Wes moves in with the laps. The tools
  find it there. To confirm it's the right bundle, `recording/metadata.json` `unixStartMs` must come before the
  first lap's `started`.

The bundle holds:
- the exact start time
- `transcripts/*.json` (Whisper, per-phrase timing)
- `recording/keystrokes-0.json` (every steering key, with modifiers)
- `mouseclicks-0.json`
- `recording/enhanced/*microphone*` (the voice-only track)
- `recording/channel-1-display-0.mp4`: the raw screen, 3072×2304, on the recording clock, with no webcam,
  captions or padding over the HUD.

**Wes no longer exports video (Sep 29 2026).** An old folder may still hold an exported `.mp4` or `.srt`;
ignore both. The `.srt` from Lighthouse Cove collapsed everything after 13:23 into one cue with backwards timing.

## Tools — `regatta/eval/playtest/` (Python 3.11, user site-packages)

```
S=~/Desktop/<venue>-tests; D=~/Desktop/regatta-issues/<venue>
python3 align.py $S > $D/timeline.md          # narration on the video clock, split by lap; drift check
python3 laps.py  $S > $D/laps.md              # splits, hits, fleet at gun, gaps, roundings, speeds
python3 engagement.py $S $D/labels.tsv --init # rows to label
python3 engagement.py $S $D/labels.tsv > $D/engagement.md
```

- `align.bundle(tests_dir)` finds the bundle and returns the exact start, transcript, keys, mic and the raw
  `video`. Lap drift of about +0.1 s means the clocks agree.
- `ocr.py`: Apple Vision OCR, on-device, about 0.7 s per frame. `read_frame(video, t, crop=(x,y,w,h))`
  reads HUD text, e.g. the leaderboard at 1 fps, to measure jitter. On the raw 3072×2304 track the
  leaderboard crop is `(25, 280, 450, 770)`.
- Frames: the bundled ffmpeg is at `ocr.FFMPEG`. Use
  `-ss T -i <raw video> -frames:v 1 -vf scale=1200:-1 -q:v 5` (no crop is needed on the raw track), and name each still
  `<MMmSS>_<slug>.jpg`. To look at several, tile them on a contact sheet (PIL) rather than
  reading them one by one.
- Installed Sep 29 2026: opencv-python-headless, pyobjc-framework-Vision/Quartz, librosa,
  soundfile. Voice **pitch** (pyin) failed on this mic because it pins at its floor, so don't use it.
  Loudness, words/s and keys/s work.

## Steps

1. **Align.** Run align.py and read the WHOLE timeline. Note every remark that is a problem, a
   question, an idea or praise.
2. **Test the testable.** Check each remark against laps.md or an ad-hoc probe, and say when the data
   disagrees with Wes. At Lighthouse Cove "they all start on port" was true of the approach
   (7/9 at −15 s) but not of the gun (0–4/9). "The AI is faster" was true boat for boat, while
   the fleet still lost on tactics.
3. **Look.** Pull a still for every visual remark and look at each one. Drop any that don't
   show the thing, and re-grab a second or two either side.
4. **Find what he didn't say.** Look for hits in laps.md and errors on the results screens in
   the frames. At Lighthouse Cove "Collisions 0, a clean run" appeared after a traffic hit,
   and Dart's award card had no portrait.
5. **Label engagement.** For each in-lap phrase in labels.tsv write R (racing talk: tactics,
   self-talk, excitement about the race itself), F (talking ABOUT the game) or P (praise while
   sailing). Run engagement.py. Read it per lap: what was at stake when he was racing, and
   when he wasn't? The label-free columns (quieter voice, fewer words/s, more keys/s) should
   agree with the labels. Say so if they don't.
6. **Write `session.md`** in this order:
   - **Venue impressions** in his words: how it felt, what he liked, what he didn't.
   - Results table.
   - Engagement: a table per lap and what works and what goes slack.
   - What was filed.
   - Praise to keep.
   - Asked but not an issue.
7. **File** into `issues.md`. A repeat of an existing issue gets this venue's evidence added and
   its "Seen at" updated, not a new entry. Evidence is quotes with `venue @ MM:SS`, data,
   stills and 🔎 things Claude observed. Stills are EMBEDDED, not named: `![MM:SS · slug|560](<venue>/evidence/<file>.jpg)`
   on its own line, indented under a list item (Wes reads the folder in Obsidian). A cause is either verified with file:line or marked
   *unverified*, and settled design decisions are flagged (check memory). Mark priorities
   `P?→` for Wes. Add a row to the cross-venue Engagement table.
8. **Keep, before Wes deletes the 16 GB bundle.** Write `<venue>/clips.tsv` (`start	end	slug	issues`, video
   mm:ss). It needs one clip per issue moment, plus the engagement peaks and each results screen. Then run:
   ```
   python3 keep.py $S $D                              # clips/ (1536 px + voice) + archive/ (1280 px 10 fps session
                                                      # proxy, trajectories, transcript, keys, clicks, voice track)
   python3 leaderboard.py $S $D/archive/leaderboard.tsv   # leaderboard OCR at 1 fps, races only (~10 min)
   ```
   Check that `align/laps/engagement` run from `$D/archive` give the same output; only the title line should
   differ. Embed each clip in its issues under "🎬 Clips:" as `![mm:ss · slug|560](<venue>/clips/<file>.mp4)`.
   Then tell Wes the bundle can go. Lighthouse Cove took about 370 MB and 8 minutes of encoding.
9. **Commit** in the issues repo (`git add -A && git commit`), then report the headline
   findings and ask Wes for triage.

## Don'ts

- Don't ingest these laps into `eval/rl/traj/`. That's the separate trajectory intake; ask first.
- Don't send video, audio or frames to any external service.
- Don't propose again what memory says Wes already rejected. Flag the conflict instead.
