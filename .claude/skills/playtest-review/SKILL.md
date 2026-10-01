---
name: playtest-review
description: Ingest and review one venue of Wes's narrated regatta playtest (Screen Studio bundle + 6 traj_*.json) and file what it shows into ~/Desktop/regatta-issues — issues with evidence, venue impressions, and when he was engaged with the racing — then archive it so the raw recording can be deleted. Use when Wes hands over a venue's test folder ("here's <venue>", "<venue>-tests is ready", "ingest and review <venue>").
---

# Playtest review — one venue

Wes plays each venue 3× Time Trial + 3× single race, recorded in Screen Studio and narrated
live. The output lives in **`~/Desktop/regatta-issues/`** (local git, never the public repo):
`issues.md` (one cross-venue list), `<venue>/` (timeline, laps, labels, engagement, session,
evidence). Read its `README.md` for the issue entry format before filing anything.

Wes does this **together**: review → he triages priorities → fix one by one. Don't start fixing
during a review.

## Inputs

One folder per venue, **`~/Desktop/<venue>-tests/`** (or `-test`, as at Gatorgrass Bayou; match either), holding:
- the six `traj_<key>_<solo|competitive>_<ts>.json` files
- the Screen Studio **bundle**, which is optional here. If the folder has none, `bundle()` takes the one in
  `~/Desktop/regatta tests/` whose recording window covers the laps' start times.

**Wes should NOT move a bundle until Screen Studio has finished processing it.** The enhanced (voice-only) track is
written after the recording ends. When the bundle was moved first, the track landed in a same-named stub back in
`regatta tests/`: Lake's was lost, and Lagoon's was rescued. `bundle()` now falls back to such a stub and warns when it
has only the raw mic. The enhanced track matters: at Lagoon, racing measured 8.8 dB quieter on it and only 3 dB on the raw mic.

The bundle holds:
- the exact start time
- `transcripts/*.json`: Screen Studio's own Whisper transcript. **Don't trust it.** It broke at both of the
  first two venues. Transcribe locally instead (step 1).
- `recording-markers.json` (bundle root): markers Wes drops during the recording. The format is unknown until
  the first one arrives; `align.bundle()` parses defensively and warns if it can't.
- `recording/keystrokes-0.json` (every steering key, with modifiers)
- `mouseclicks-0.json`
- `recording/enhanced/*microphone*` (the voice-only track)
- `recording/channel-1-display-0.mp4`: the raw screen, 3072×2304, on the recording clock, with no webcam,
  captions or padding over the HUD.

Wes records with the browser window at the **same size every time** (2000×1500 at both of the first two venues).
The OCR crops and the layline comparisons (PT-027) depend on it; if `metadata.json`'s display `cropRect` differs, redo the crops.

**Wes no longer exports video (Sep 29 2026).** An old folder may still hold an exported `.mp4` or `.srt`;
ignore both. The `.srt` from Lighthouse Cove collapsed everything after 13:23 into one cue with backwards timing.

## Tools — `regatta/eval/playtest/` (Python 3.11, user site-packages)

```
S=~/Desktop/<venue>-tests; D=~/Desktop/regatta-issues/<venue>
python3 transcribe.py $S                      # local mlx-whisper, whole session (~47 s for 27 min) → *.local.json
python3 align.py $S > $D/timeline.md          # narration on the video clock, split by lap; drift check
python3 laps.py  $S > $D/laps.md              # splits, hits, fleet at gun, gaps, roundings, speeds
python3 engagement.py $S $D/labels.tsv --init # rows to label
python3 engagement.py $S $D/labels.tsv > $D/engagement.md
python3 fps.py $S > $D/fps.md                 # distinct frames/s mid-lap from the raw video (needs the bundle)
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

0. **Ingest the laps (Wes wants it with every review).** Follow the trajectory intake (memory: regatta-trajectory-intake):
   - copy the six files into `regatta/eval/rl/traj/` and run `node regatta/eval/traj_audit.js`
   - **add** them to the venue's set; don't replace older laps
   - target = mean of ALL Time Trial laps on the current course × 1.1, rounded up to 5 s
     (`node regatta/eval/set_venue_targets.js` dry). Hand-edit `records.provisional`, never `--write`: it deletes
     Flats' hand-set 3:15.
   - `node regatta/eval/freeze_venues.js --add <venue>`
   - by-key diff from the laps' doc to the frozen doc, then an ADJUDICATED entry in `eval/rl/_traj_fp.js`
   - check `_traj_fp.js <venue>` shows every new lap valid
   - old laps stay in `traj/`, marked stale
   - commit on `master` when Wes says so
1. **Transcribe and align.** If the review starts right after the recording, the enhanced voice track may still be
   being written ("moov atom not found"; Redrock). Wait until ffmpeg opens it and it hasn't changed for 20 s (a background
   `until` loop) rather than fall back to the raw mic. Whisper still invents text in silences; transcribe.py drops it with
   `hallucination_silence_threshold` plus a lone-"thank you" filter (Bluewater). Read the timeline for leftover repeats.
   Then: Run transcribe.py, then align.py, and read the WHOLE timeline. Note every remark
   that is a problem, a question, an idea or praise. If a venue was already labelled on Screen Studio's
   transcript, repair only the bad stretch with `retranscribe.py $S <from> <to>`, which writes a `.fixed.json`,
   so the labels keep their times. If `bundle()` found markers, read around each one first: Wes flagged it.
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
7. **File** into `issues.md`. **FIRST, and again before every later edit of `issues.md` (clip embeds included):** run `git -C ~/Desktop/regatta-issues status --short`. If `issues.md` is modified, that's Wes's triage in progress: commit it alone ("Wes's triage: …") before touching the file. Gatorgrass Bayou's triage got folded into a clip-embed commit because only the first edit was checked. A repeat of an existing issue gets this venue's evidence added and
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
   `keep.py` adds a clip row for every marker Wes dropped that no row already covers (−15 s / +10 s).
   Check that `align/laps/engagement` run from `$D/archive` give the same output; only the title line should
   differ. Embed each clip in its issues under "🎬 Clips:" as `![mm:ss · slug|560](<venue>/clips/<file>.mp4)`.
   Then tell Wes the bundle can go. Lighthouse Cove took about 370 MB and 8 minutes of encoding.
9. **Commit** in the issues repo, then report the headline findings and ask Wes for triage. **Run `git diff`
   first:** Wes triages in Obsidian by editing the Pri column, and a blind `git add -A` once swept up his
   half-finished triage. He added **P0** (most urgent, ahead of P1). New issues arrive as `P?→Pn`.
10. **Clean up when Wes says so.**
    - md5 every trajectory against `archive/` and `eval/rl/traj/`
    - md5 every small bundle file (project, meta, markers, transcripts including .local/.fixed, metadata,
      keystrokes, clicks, mouse moves, cursors, enhanced mic) against `archive/bundle/`. **A missing file is a
      finding, not a skip.** Lagoon's enhanced track was absent from the bundle and the first check skipped it silently.
    - check `~/Desktop/regatta tests/` for a stub of this session; copy anything the archive lacks, then delete the stub
    - confirm the clips, proxy and leaderboard.tsv exist
    - only then `rm -rf ~/Desktop/<venue>-tests` AND the session's bundle in `~/Desktop/regatta tests/` (its path is
      `align.bundle(S)['path']`; from Sep 30 Wes leaves bundles there), and report the space freed. Keep the `regatta tests` folder itself.

    Each venue freed 15–20 GB. **Use LITERAL absolute paths in the `rm -rf`.** Claude Code's safety check refuses a
    removal whose target comes from a variable or command substitution (Sockeye Run). Print the bundle path first,
    then paste it quoted into the rm.
    Clip sizes vary: whitewater and foam compress badly (Sockeye: 24 clips = 424 MB, proxy 239 MB).

## Gotchas

- **A paused recording has several sessions** (Spoonbill Flats, Sep 30: display-0/1, microphone-0/1, keystrokes-0/1 …).
  `align.bundle()` joins them back to back into `recording/joined/` (video by stream copy, ~4 GB, deleted with the bundle) and
  `B['clock'](wall)` maps wall time onto that joined clock, pauses cut. Pass `B['clock']` to `load_laps`, never `B['rec0']`.
  Screen Studio may write an enhanced track for session 0 only; the later session then uses its raw mic (dB not comparable
  across the pause, a warning says so). The cleanup md5 list includes every `*-N.json` and every enhanced track.
- **A banner on screen isn't proof of the state.** At the Flats the "AGROUND" banner stayed up 54 s after refloating (PT-086);
  check the trajectory (`spd`) before believing a HUD message in a still.
- **Gate courses** (Clubhouse Point) have null `legRounds`. `engagement.progress_fn` aims each leg at the nearest
  point of its gate; before Sep 29 it aimed every leg at the finish, and places jumped. `laps.py` times the
  165 u zone around the gate line.
- The `spd` columns are units per FRAME at 60 fps: seconds = units / (60 × spd).
- The `rivals` tack flag at running angles is not a reliable read of who had rights. Check a frame before
  saying who was wrong in an encounter.

## Don'ts

- Don't send video, audio or frames to any external service.
- Don't propose again what memory says Wes already rejected. Flag the conflict instead.
