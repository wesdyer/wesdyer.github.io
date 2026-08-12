# NOVICE LAPS — KEPT, BUT NEVER A BASELINE

These ten recordings are the owner's son's, collected 2026-08-12. He has not
played the game much, so they represent an **average player**, not the skilled
reference every ratio in this campaign is measured against. Owner, verbatim:

> "I also collected 10 other trajectories from my son who has not played the game
> much. So they are not like mine which represent a skilled player. I think we
> should keep them, but not use them as a baseline for comparison."

## WHY THEY LIVE IN A SUBDIRECTORY
Every probe that reads the human corpus does

    fs.readdirSync('traj').filter(x => x.startsWith('traj_'))

so a subdirectory is excluded **by construction, everywhere at once**, with no
probe changes and no allow-list to keep in sync. `novice` does not start with
`traj_`, so no existing tool can pick these up by accident.

## WHY THIS MATTERS — THEY HAD ALREADY MOVED THE REFERENCE
They were ingested with the owner's own new laps and silently entered the human
median before he flagged them. Their effect on the fingerprint-verified medians:

| venue | with novice | owner only | the novice lap |
|---|---|---|---|
| swamp | 251.1 | **219.5** | 347.8 s |
| ocean | 188.7 | **177.9** | 239.2 s |
| lagoon | 176.3 | **164.9** | 242.4 s |
| redrock | 218.2 | 218.2 | 318.3 s |
| arctic | 212.4 | 212.4 | 260.4 s |

Swamp's ratio would have read 1.37x instead of 1.56x on one contaminated lap.
**A human reference is only a reference if it is the same human** — the
fingerprint check (rule 23) guarantees the same DOCUMENT, and nothing guaranteed
the same SAILOR until now.

## IF YOU WANT TO USE THEM
They are a legitimate second population and worth something in their own right —
an average-player band to bracket the AI against, or a check on whether a venue is
hard for everyone or only for the bots. Point a probe at `traj/novice/` explicitly
and label the column. Never merge them into the reference median.
