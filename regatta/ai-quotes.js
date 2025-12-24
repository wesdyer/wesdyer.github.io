const AI_QUOTES = {
  "Bixby": {
    "player_passes_them": {
      "short": "Nice lift.",
      "medium": "Good timing—wind helped you there.",
      "long": "Enjoy it. The breeze tends to circle back when you’re patient."
    },
    "they_pass_player": {
      "short": "There it is.",
      "medium": "That puff finally filled in.",
      "long": "I just followed the pressure where it wanted to go."
    },
    "they_hit_player": {
      "short": "My fault.",
      "medium": "Sorry—misread the drift.",
      "long": "That one’s on me. The wind shifted quicker than expected."
    },
    "they_were_hit": {
      "short": "Easy now.",
      "medium": "That angle closes fast.",
      "long": "No harm, but you’ve got to feel the flow better."
    },
    "narrowly_avoided_collision": {
      "short": "Close one.",
      "medium": "Timing saved us.",
      "long": "That puff slid us apart just in time."
    },
    "player_narrowly_avoided_collision": {
      "short": "Good instincts.",
      "medium": "Nice call backing out.",
      "long": "You felt that shift early—kept it clean."
    },
    "moved_into_first": {
      "short": "Feels right.",
      "medium": "Wind finally settled.",
      "long": "This breeze has good structure up front."
    },
    "moved_into_last": {
      "short": "No rush.",
      "medium": "Plenty of race left.",
      "long": "I’ve climbed worse ladders with calmer winds."
    },
    "rounded_mark": {
      "short": "Clean turn.",
      "medium": "Good exit angle.",
      "long": "Marks tell the truth if you listen."
    },
    "first_across_start": {
      "short": "Nice launch.",
      "medium": "That felt balanced.",
      "long": "Clean air early makes everything simpler."
    },
    "finished_race": {
      "short": "Well sailed.",
      "medium": "That was a thoughtful race.",
      "long": "Wind behaved, and so did we."
    },
    "prestart": {
      "short": "Stay loose.",
      "medium": "Watch the pressure lines.",
      "long": "Starts reward calm more than force."
    },
    "random": {
      "short": "Feel it.",
      "medium": "Wind’s talking today.",
      "long": "Every leg teaches something if you listen."
    }
  },

  "Skim": {
    "player_passes_them": {
      "short": "Temporary.",
      "medium": "Enjoy it—I’m lining up speed.",
      "long": "That lane won’t last once I find a runway."
    },
    "they_pass_player": {
      "short": "Launched!",
      "medium": "Perfect burst—see you!",
      "long": "Speed plus timing beats position every time."
    },
    "they_hit_player": {
      "short": "Too hot!",
      "medium": "Pushed that lane too hard.",
      "long": "That one’s on me—I came in fully lit."
    },
    "they_were_hit": {
      "short": "Hey!",
      "medium": "You clipped my launch!",
      "long": "That was my acceleration window!"
    },
    "narrowly_avoided_collision": {
      "short": "Spicy!",
      "medium": "Threaded the needle!",
      "long": "That gap was barely wide enough to fly."
    },
    "player_narrowly_avoided_collision": {
      "short": "You flinched.",
      "medium": "Almost had you!",
      "long": "One blink slower and that was mine."
    },
    "moved_into_first": {
      "short": "Front row!",
      "medium": "All speed up here.",
      "long": "Catch me if you can—I’m airborne."
    },
    "moved_into_last": {
      "short": "Launchpad.",
      "medium": "Setting up something big.",
      "long": "Last just means clear lanes to explode through."
    },
    "rounded_mark": {
      "short": "Slingshot!",
      "medium": "Perfect corner hit.",
      "long": "Marks are ramps if you hit them fast."
    },
    "first_across_start": {
      "short": "Boom!",
      "medium": "Nailed the timing.",
      "long": "That start was pure acceleration."
    },
    "finished_race": {
      "short": "Fast run!",
      "medium": "That was electric.",
      "long": "Speed carried me the whole way."
    },
    "prestart": {
      "short": "Ready.",
      "medium": "Watching lanes, waiting.",
      "long": "I don’t start races—I detonate off the line."
    },
    "random": {
      "short": "Go!",
      "medium": "Speed fixes things.",
      "long": "Risk feels right when it’s fast."
    }
  },

  "Wobble": {
    "player_passes_them": {
      "short": "Huh.",
      "medium": "Didn’t expect that.",
      "long": "That wasn’t supposed to work… interesting."
    },
    "they_pass_player": {
      "short": "Oops!",
      "medium": "Ended up ahead again.",
      "long": "Chaos is very cooperative today."
    },
    "they_hit_player": {
      "short": "Sorry!",
      "medium": "Limbs everywhere—my bad!",
      "long": "I swear that made sense a second ago."
    },
    "they_were_hit": {
      "short": "Whoa!",
      "medium": "That was exciting!",
      "long": "Everything’s fine… probably."
    },
    "narrowly_avoided_collision": {
      "short": "Nice!",
      "medium": "That worked somehow.",
      "long": "I didn’t plan that, but I’ll take it."
    },
    "player_narrowly_avoided_collision": {
      "short": "Fun!",
      "medium": "Thought we’d tangle.",
      "long": "That would’ve been spectacularly messy."
    },
    "moved_into_first": {
      "short": "Winning?",
      "medium": "Huh—look at that.",
      "long": "Chaos continues to favor me."
    },
    "moved_into_last": {
      "short": "Still dangerous.",
      "medium": "Anything can happen.",
      "long": "Last is just another weird angle."
    },
    "rounded_mark": {
      "short": "Whee!",
      "medium": "That turn felt odd.",
      "long": "I came out facing the right way—success!"
    },
    "first_across_start": {
      "short": "Accidental!",
      "medium": "That worked?",
      "long": "I honestly didn’t mean to nail that start."
    },
    "finished_race": {
      "short": "Done!",
      "medium": "What a ride.",
      "long": "I’m not sure how I survived that."
    },
    "prestart": {
      "short": "Uh…",
      "medium": "Let’s see what happens.",
      "long": "Plans are optional today."
    },
    "random": {
      "short": "Chaos!",
      "medium": "Trust the mess.",
      "long": "Unpredictable is a valid strategy."
    }
  },

  "Pinch": {
    "player_passes_them": {
      "short": "Temporary.",
      "medium": "I’ll take it back.",
      "long": "Enjoy it while I reload pressure."
    },
    "they_pass_player": {
      "short": "Move.",
      "medium": "That lane’s mine.",
      "long": "Pressure wins—remember that."
    },
    "they_hit_player": {
      "short": "Hold!",
      "medium": "You hesitated.",
      "long": "That’s what happens when you blink."
    },
    "they_were_hit": {
      "short": "Hey!",
      "medium": "Watch your bow!",
      "long": "You don’t shove me like that."
    },
    "narrowly_avoided_collision": {
      "short": "Close.",
      "medium": "You almost cracked.",
      "long": "Next time, I won’t give space."
    },
    "player_narrowly_avoided_collision": {
      "short": "Flinched.",
      "medium": "Thought so.",
      "long": "You gave ground when it mattered."
    },
    "moved_into_first": {
      "short": "Mine.",
      "medium": "This is my spot.",
      "long": "Everyone reacts to me now."
    },
    "moved_into_last": {
      "short": "Irrelevant.",
      "medium": "Climbing through you.",
      "long": "I start fights from back here."
    },
    "rounded_mark": {
      "short": "Denied.",
      "medium": "No room given.",
      "long": "You don’t get free turns."
    },
    "first_across_start": {
      "short": "Dominant.",
      "medium": "Crushed the line.",
      "long": "That’s how you win starts."
    },
    "finished_race": {
      "short": "Finished.",
      "medium": "You felt that pressure.",
      "long": "Next race won’t be kinder."
    },
    "prestart": {
      "short": "Crowded.",
      "medium": "I like it tight.",
      "long": "Let’s see who blinks first."
    },
    "random": {
      "short": "Pressure.",
      "medium": "No space given.",
      "long": "Intimidation works."
    }
  },

  "Bruce": {
    "player_passes_them": {
      "short": "Noted.",
      "medium": "You won’t keep it.",
      "long": "Enjoy the illusion while it lasts."
    },
    "they_pass_player": {
      "short": "Mine.",
      "medium": "You slowed me.",
      "long": "I take positions, not chances."
    },
    "they_hit_player": {
      "short": "Acceptable.",
      "medium": "You were there.",
      "long": "I don’t adjust for hesitation."
    },
    "they_were_hit": {
      "short": "Mistake.",
      "medium": "Don’t do that again.",
      "long": "You’ve drawn attention you don’t want."
    },
    "narrowly_avoided_collision": {
      "short": "Controlled.",
      "medium": "I allowed it.",
      "long": "I saw the outcome early."
    },
    "player_narrowly_avoided_collision": {
      "short": "Barely.",
      "medium": "Fear helped you.",
      "long": "Instinct saved you that time."
    },
    "moved_into_first": {
      "short": "Correct.",
      "medium": "The fleet adapts.",
      "long": "This is where pressure belongs."
    },
    "moved_into_last": {
      "short": "Irrelevant.",
      "medium": "Energy conserved.",
      "long": "I rise when I choose."
    },
    "rounded_mark": {
      "short": "Clean.",
      "medium": "No deviation.",
      "long": "Marks don’t change outcomes."
    },
    "first_across_start": {
      "short": "Dominant.",
      "medium": "Line controlled.",
      "long": "The race bent immediately."
    },
    "finished_race": {
      "short": "Done.",
      "medium": "As expected.",
      "long": "The result was inevitable."
    },
    "prestart": {
      "short": "Quiet.",
      "medium": "Watch closely.",
      "long": "Pressure begins before the gun."
    },
    "random": {
      "short": "Observe.",
      "medium": "Pressure builds.",
      "long": "Stillness breaks others."
    }
  },

  "Strut": {
    "player_passes_them": {
      "short": "Charming.",
      "medium": "Enjoy the spotlight while it lasts.",
      "long": "Cute move—but style without control fades quickly."
    },
    "they_pass_player": {
      "short": "Darling.",
      "medium": "Grace beats grit every time.",
      "long": "That lane looked better on me anyway."
    },
    "they_hit_player": {
      "short": "Oops—heels!",
      "medium": "That was inelegant of me.",
      "long": "Momentum plus flair sometimes needs restraint."
    },
    "they_were_hit": {
      "short": "Careful!",
      "medium": "You scuffed my line.",
      "long": "Mind your angles—this is precision sailing."
    },
    "narrowly_avoided_collision": {
      "short": "Drama averted.",
      "medium": "Still flawless.",
      "long": "Even close calls should look effortless."
    },
    "player_narrowly_avoided_collision": {
      "short": "Messy.",
      "medium": "You nearly ruined the look.",
      "long": "Confidence would’ve made that cleaner."
    },
    "moved_into_first": {
      "short": "Naturally.",
      "medium": "Front row elegance.",
      "long": "Winning should always look this good."
    },
    "moved_into_last": {
      "short": "Repositioning.",
      "medium": "Style takes patience.",
      "long": "Even last place benefits from poise."
    },
    "rounded_mark": {
      "short": "Lovely.",
      "medium": "Perfect posture through the turn.",
      "long": "Marks reward balance and confidence."
    },
    "first_across_start": {
      "short": "On cue.",
      "medium": "That timing was exquisite.",
      "long": "Starts are performances, not accidents."
    },
    "finished_race": {
      "short": "Divine.",
      "medium": "A pleasure, truly.",
      "long": "Winning tastes sweeter when done beautifully."
    },
    "prestart": {
      "short": "Eyes on me.",
      "medium": "Let them stare.",
      "long": "Confidence unsettles competitors before the gun."
    },
    "random": {
      "short": "Poise.",
      "medium": "Style matters.",
      "long": "Sailing is elegance under pressure."
    }
  },

  "Gasket": {
    "player_passes_them": {
      "short": "Logged.",
      "medium": "Temporary inefficiency detected.",
      "long": "I’ll reclaim that through sustained gains."
    },
    "they_pass_player": {
      "short": "Progress.",
      "medium": "Incremental advantage secured.",
      "long": "Consistency dismantles urgency every time."
    },
    "they_hit_player": {
      "short": "Error.",
      "medium": "That was suboptimal.",
      "long": "Structural miscalculation—correcting immediately."
    },
    "they_were_hit": {
      "short": "Unacceptable.",
      "medium": "You disrupted my line.",
      "long": "Force doesn’t move solid construction."
    },
    "narrowly_avoided_collision": {
      "short": "Margins.",
      "medium": "Clearance maintained.",
      "long": "Buffer zones preserved successfully."
    },
    "player_narrowly_avoided_collision": {
      "short": "Wise.",
      "medium": "You chose correctly.",
      "long": "Backing out prevents compounding failure."
    },
    "moved_into_first": {
      "short": "Secured.",
      "medium": "System functioning optimally.",
      "long": "Advantages layered until collapse elsewhere."
    },
    "moved_into_last": {
      "short": "Recovering.",
      "medium": "Process continues.",
      "long": "Long games reward discipline."
    },
    "rounded_mark": {
      "short": "Clean.",
      "medium": "Turn executed efficiently.",
      "long": "Marks reward preparation."
    },
    "first_across_start": {
      "short": "Optimal.",
      "medium": "Start sequence executed.",
      "long": "Early efficiency compounds downstream."
    },
    "finished_race": {
      "short": "Complete.",
      "medium": "Outcome acceptable.",
      "long": "Structure held under pressure."
    },
    "prestart": {
      "short": "Calculating.",
      "medium": "Watching closure rates.",
      "long": "Starts are problems to solve."
    },
    "random": {
      "short": "Build.",
      "medium": "Foundations matter.",
      "long": "Slow advantages endure."
    }
  },

  "Chomp": {
    "player_passes_them": {
      "short": "Seen.",
      "medium": "You showed yourself.",
      "long": "Exposure invites consequences."
    },
    "they_pass_player": {
      "short": "Now.",
      "medium": "That opening was fatal.",
      "long": "Patience turns errors into strikes."
    },
    "they_hit_player": {
      "short": "Mistimed.",
      "medium": "That slipped.",
      "long": "Even predators misjudge occasionally."
    },
    "they_were_hit": {
      "short": "Careful.",
      "medium": "You woke me.",
      "long": "That will not be forgotten."
    },
    "narrowly_avoided_collision": {
      "short": "Almost.",
      "medium": "Still waiting.",
      "long": "The snap comes when it counts."
    },
    "player_narrowly_avoided_collision": {
      "short": "Good reflex.",
      "medium": "You felt it.",
      "long": "Instinct saved you."
    },
    "moved_into_first": {
      "short": "Planned.",
      "medium": "Right moment chosen.",
      "long": "Quiet pressure ends races."
    },
    "moved_into_last": {
      "short": "Hunting.",
      "medium": "Let them relax.",
      "long": "Last place breeds complacency."
    },
    "rounded_mark": {
      "short": "Sharp.",
      "medium": "That angle bites.",
      "long": "Marks expose hesitation."
    },
    "first_across_start": {
      "short": "Clean.",
      "medium": "Nobody noticed.",
      "long": "Silent starts scare later."
    },
    "finished_race": {
      "short": "Done.",
      "medium": "As expected.",
      "long": "Patience closed the trap."
    },
    "prestart": {
      "short": "Still.",
      "medium": "Watching everyone.",
      "long": "Noise hides weakness."
    },
    "random": {
      "short": "Wait.",
      "medium": "Timing matters.",
      "long": "Predators don’t rush."
    }
  },

  "Whiskers": {
    "player_passes_them": {
      "short": "Steady.",
      "medium": "Long legs favor me.",
      "long": "You’ll slow before I do."
    },
    "they_pass_player": {
      "short": "Grinding.",
      "medium": "Endurance pays off.",
      "long": "Heavy conditions reward persistence."
    },
    "they_hit_player": {
      "short": "Momentum.",
      "medium": "Hard to stop.",
      "long": "This much mass doesn’t turn quickly."
    },
    "they_were_hit": {
      "short": "Oof.",
      "medium": "That barely moved me.",
      "long": "Careful—momentum cuts both ways."
    },
    "narrowly_avoided_collision": {
      "short": "Close.",
      "medium": "Needed room there.",
      "long": "Big boats need space."
    },
    "player_narrowly_avoided_collision": {
      "short": "Smart.",
      "medium": "Good avoidance.",
      "long": "You remembered I don’t brake well."
    },
    "moved_into_first": {
      "short": "Holding.",
      "medium": "Comfortable pace.",
      "long": "Try wearing me down."
    },
    "moved_into_last": {
      "short": "Grinding.",
      "medium": "Still breathing.",
      "long": "Endurance starts here."
    },
    "rounded_mark": {
      "short": "Wide.",
      "medium": "Kept it smooth.",
      "long": "Turns reward patience."
    },
    "first_across_start": {
      "short": "Solid.",
      "medium": "Built momentum early.",
      "long": "Starts matter less when you last."
    },
    "finished_race": {
      "short": "Finished.",
      "medium": "Still strong.",
      "long": "Consistency carried me through."
    },
    "prestart": {
      "short": "Calm.",
      "medium": "No rush.",
      "long": "Let others burn energy."
    },
    "random": {
      "short": "Endure.",
      "medium": "Slow power.",
      "long": "Weather favors weight."
    }
  },

  "Vex": {
    "player_passes_them": {
      "short": "Noted.",
      "medium": "You left a crack.",
      "long": "Tiny mistakes echo loudly."
    },
    "they_pass_player": {
      "short": "Gone.",
      "medium": "You hesitated.",
      "long": "That pause cost you everything."
    },
    "they_hit_player": {
      "short": "Tight.",
      "medium": "Misjudged the gap.",
      "long": "Margins collapsed unexpectedly."
    },
    "they_were_hit": {
      "short": "Sloppy.",
      "medium": "Predictable error.",
      "long": "You telegraphed that move."
    },
    "narrowly_avoided_collision": {
      "short": "Clean.",
      "medium": "Edges held.",
      "long": "Precision keeps doors open."
    },
    "player_narrowly_avoided_collision": {
      "short": "Lucky.",
      "medium": "Barely noticed.",
      "long": "Next gap closes faster."
    },
    "moved_into_first": {
      "short": "Invisible.",
      "medium": "Clean air secured.",
      "long": "Now I disappear."
    },
    "moved_into_last": {
      "short": "Fine.",
      "medium": "Angles remain.",
      "long": "Plenty of shadows to use."
    },
    "rounded_mark": {
      "short": "Sharp.",
      "medium": "Perfect overlap.",
      "long": "Marks punish inattention."
    },
    "first_across_start": {
      "short": "Quiet.",
      "medium": "Nobody noticed.",
      "long": "Best starts leave no witnesses."
    },
    "finished_race": {
      "short": "Clean.",
      "medium": "As planned.",
      "long": "Mistakes carried me here."
    },
    "prestart": {
      "short": "Watching.",
      "medium": "Everyone leaks tells.",
      "long": "Starts expose nerves."
    },
    "random": {
      "short": "Slip.",
      "medium": "Exploit gaps.",
      "long": "I live between errors."
    }
  },

  "Ripple": {
    "player_passes_them": {
      "short": "Nice lane!",
      "medium": "Woo! That was clean sailing.",
      "long": "Great move—open water always feels amazing."
    },
    "they_pass_player": {
      "short": "Zoom!",
      "medium": "Found the gap!",
      "long": "Clean lanes make everything faster."
    },
    "they_hit_player": {
      "short": "Oops!",
      "medium": "Sorry—too excited!",
      "long": "Got carried away chasing that opening."
    },
    "they_were_hit": {
      "short": "Hey!",
      "medium": "That surprised me!",
      "long": "Careful—things happen fast out here."
    },
    "narrowly_avoided_collision": {
      "short": "Whee!",
      "medium": "That was close!",
      "long": "Slipped through like a wave."
    },
    "player_narrowly_avoided_collision": {
      "short": "Nice!",
      "medium": "Good reflexes!",
      "long": "You read that moment perfectly."
    },
    "moved_into_first": {
      "short": "Yes!",
      "medium": "Front feels great!",
      "long": "Nothing but open water ahead!"
    },
    "moved_into_last": {
      "short": "All good!",
      "medium": "Still racing!",
      "long": "Plenty of ocean left to surf."
    },
    "rounded_mark": {
      "short": "Splash!",
      "medium": "Smooth turn!",
      "long": "That corner flowed beautifully."
    },
    "first_across_start": {
      "short": "Woo!",
      "medium": "Perfect launch!",
      "long": "That start felt electric!"
    },
    "finished_race": {
      "short": "Fun!",
      "medium": "Loved that race!",
      "long": "Speed and smiles all the way."
    },
    "prestart": {
      "short": "Ready!",
      "medium": "Watching for openings.",
      "long": "Starts are all about timing waves."
    },
    "random": {
      "short": "Swim!",
      "medium": "Find clean water!",
      "long": "Joy lives in motion."
    }
  },

  "Clutch": {
    "player_passes_them": {
      "short": "Earned.",
      "medium": "That took effort.",
      "long": "I don’t give space cheaply."
    },
    "they_pass_player": {
      "short": "Held.",
      "medium": "Line defended.",
      "long": "You couldn’t break my grip."
    },
    "they_hit_player": {
      "short": "Held hard.",
      "medium": "That was on me.",
      "long": "Defense can bite back sometimes."
    },
    "they_were_hit": {
      "short": "Denied.",
      "medium": "You tried pushing.",
      "long": "Pressure doesn’t move stone."
    },
    "narrowly_avoided_collision": {
      "short": "Firm.",
      "medium": "Margins held.",
      "long": "Defense held without breaking."
    },
    "player_narrowly_avoided_collision": {
      "short": "Wise.",
      "medium": "You backed off.",
      "long": "Smart sailors respect solid walls."
    },
    "moved_into_first": {
      "short": "Locked.",
      "medium": "Position secured.",
      "long": "Now try taking it."
    },
    "moved_into_last": {
      "short": "Holding.",
      "medium": "Still stubborn.",
      "long": "Last doesn’t mean weak."
    },
    "rounded_mark": {
      "short": "Blocked.",
      "medium": "No room given.",
      "long": "Marks are battles too."
    },
    "first_across_start": {
      "short": "Firm.",
      "medium": "Line controlled.",
      "long": "Nobody shoved me off."
    },
    "finished_race": {
      "short": "Done.",
      "medium": "Defense paid.",
      "long": "Held ground the whole way."
    },
    "prestart": {
      "short": "Crowded.",
      "medium": "Good.",
      "long": "I thrive when space disappears."
    },
    "random": {
      "short": "Grip.",
      "medium": "Hold fast.",
      "long": "Pressure tests resolve."
    }
  },

  "Glide": {
    "player_passes_them": {
      "short": "Noted.",
      "medium": "I remain patient.",
      "long": "Errors compound quietly."
    },
    "they_pass_player": {
      "short": "Steady.",
      "medium": "Consistency prevails.",
      "long": "Mistakes always surface eventually."
    },
    "they_hit_player": {
      "short": "Rare.",
      "medium": "Apologies.",
      "long": "That deviation was unexpected."
    },
    "they_were_hit": {
      "short": "Unusual.",
      "medium": "Please maintain control.",
      "long": "Disruption isn’t optimal for either of us."
    },
    "narrowly_avoided_collision": {
      "short": "Clean.",
      "medium": "Trajectory held.",
      "long": "Small margins preserved order."
    },
    "player_narrowly_avoided_collision": {
      "short": "Good.",
      "medium": "You adapted.",
      "long": "Awareness prevented error."
    },
    "moved_into_first": {
      "short": "Balanced.",
      "medium": "Holding optimal line.",
      "long": "Patience placed me here."
    },
    "moved_into_last": {
      "short": "Calm.",
      "medium": "Time remains.",
      "long": "Races unravel slowly."
    },
    "rounded_mark": {
      "short": "Smooth.",
      "medium": "No correction needed.",
      "long": "Marks reward preparation."
    },
    "first_across_start": {
      "short": "Aligned.",
      "medium": "Sequence correct.",
      "long": "Clean starts simplify races."
    },
    "finished_race": {
      "short": "Complete.",
      "medium": "As expected.",
      "long": "Consistency delivered again."
    },
    "prestart": {
      "short": "Still.",
      "medium": "Observing patterns.",
      "long": "Starts expose impatience."
    },
    "random": {
      "short": "Balance.",
      "medium": "Precision wins.",
      "long": "Calm endures."
    }
  },

  "Fathom": {
    "player_passes_them": {
      "short": "Allowed.",
      "medium": "For now.",
      "long": "Pressure will return."
    },
    "they_pass_player": {
      "short": "Taken.",
      "medium": "You yielded.",
      "long": "Power decides moments."
    },
    "they_hit_player": {
      "short": "Minimal.",
      "medium": "Acceptable loss.",
      "long": "Momentum was non-negotiable."
    },
    "they_were_hit": {
      "short": "Error.",
      "medium": "You misjudged.",
      "long": "That was unwise."
    },
    "narrowly_avoided_collision": {
      "short": "Controlled.",
      "medium": "Outcome known.",
      "long": "I saw it early."
    },
    "player_narrowly_avoided_collision": {
      "short": "Barely.",
      "medium": "Instinct saved you.",
      "long": "Fear sharpened your reaction."
    },
    "moved_into_first": {
      "short": "Correct.",
      "medium": "Dominance asserted.",
      "long": "The fleet adjusts now."
    },
    "moved_into_last": {
      "short": "Irrelevant.",
      "medium": "Power conserved.",
      "long": "Timing remains mine."
    },
    "rounded_mark": {
      "short": "Clean.",
      "medium": "No deviation.",
      "long": "Marks don’t alter outcomes."
    },
    "first_across_start": {
      "short": "Imposed.",
      "medium": "Line controlled.",
      "long": "Pressure began immediately."
    },
    "finished_race": {
      "short": "Finished.",
      "medium": "As designed.",
      "long": "Strength closed the race."
    },
    "prestart": {
      "short": "Silent.",
      "medium": "Watch carefully.",
      "long": "Stillness unsettles rivals."
    },
    "random": {
      "short": "Pressure.",
      "medium": "Observe.",
      "long": "Silence dominates."
    }
  },

  "Scuttle": {
    "player_passes_them": {
      "short": "Heh.",
      "medium": "Crowds change fast.",
      "long": "Let’s see how that holds."
    },
    "they_pass_player": {
      "short": "Yoink!",
      "medium": "Found a crack!",
      "long": "Chaos always opens doors."
    },
    "they_hit_player": {
      "short": "Oops!",
      "medium": "Shells everywhere!",
      "long": "Crowded racing gets messy."
    },
    "they_were_hit": {
      "short": "Rude!",
      "medium": "Too tight!",
      "long": "Traffic bites back sometimes."
    },
    "narrowly_avoided_collision": {
      "short": "Haha!",
      "medium": "That was spicy!",
      "long": "Crowds make the best puzzles."
    },
    "player_narrowly_avoided_collision": {
      "short": "Missed!",
      "medium": "Almost boxed you!",
      "long": "One more boat and you’re stuck."
    },
    "moved_into_first": {
      "short": "Wild!",
      "medium": "Chaos crowned me!",
      "long": "Crowds carry me upward."
    },
    "moved_into_last": {
      "short": "Perfect.",
      "medium": "More traffic!",
      "long": "This is where I thrive."
    },
    "rounded_mark": {
      "short": "Scraped!",
      "medium": "Slid through.",
      "long": "Marks are traffic jams."
    },
    "first_across_start": {
      "short": "Stolen!",
      "medium": "Nobody noticed!",
      "long": "Crowds hide sneaky starts."
    },
    "finished_race": {
      "short": "Survived!",
      "medium": "What a mess!",
      "long": "Chaos delivered again."
    },
    "prestart": {
      "short": "Crowded!",
      "medium": "Perfect.",
      "long": "Tight spaces breed opportunity."
    },
    "random": {
      "short": "Scramble!",
      "medium": "Love traffic.",
      "long": "Chaos is home."
    }
  },

  "Finley": {
    "player_passes_them": {
      "short": "Temporary.",
      "medium": "You won’t hold that pace.",
      "long": "Straight-line speed always reasserts itself."
    },
    "they_pass_player": {
      "short": "Powering.",
      "medium": "Can’t match this run.",
      "long": "Once I’m wound up, I don’t stop."
    },
    "they_hit_player": {
      "short": "Too fast.",
      "medium": "Momentum carried me in.",
      "long": "Speed limits are suggestions, apparently."
    },
    "they_were_hit": {
      "short": "Careful!",
      "medium": "You crossed my line.",
      "long": "Hard to dodge at full throttle."
    },
    "narrowly_avoided_collision": {
      "short": "Fast gap.",
      "medium": "Cut it close.",
      "long": "Speed leaves little margin."
    },
    "player_narrowly_avoided_collision": {
      "short": "Lucky.",
      "medium": "You barely held.",
      "long": "That closing speed surprises people."
    },
    "moved_into_first": {
      "short": "Rolling.",
      "medium": "Nothing but pressure ahead.",
      "long": "Try matching this pace."
    },
    "moved_into_last": {
      "short": "Winding.",
      "medium": "Still building speed.",
      "long": "Long runs favor me."
    },
    "rounded_mark": {
      "short": "Wide.",
      "medium": "Keeping momentum.",
      "long": "Turns cost speed—I minimize them."
    },
    "first_across_start": {
      "short": "Explosive.",
      "medium": "Perfect acceleration.",
      "long": "That launch set the tone."
    },
    "finished_race": {
      "short": "Spent.",
      "medium": "All out.",
      "long": "That race was pure pressure."
    },
    "prestart": {
      "short": "Ready.",
      "medium": "Building revs.",
      "long": "I live for the launch."
    },
    "random": {
      "short": "Speed.",
      "medium": "Never lift.",
      "long": "Straight lines decide races."
    }
  },

  "Torch": {
    "player_passes_them": {
      "short": "Brief.",
      "medium": "You won’t contain this.",
      "long": "Fire always finds oxygen."
    },
    "they_pass_player": {
      "short": "Ignite!",
      "medium": "Burned through that lane.",
      "long": "Risk pays when it catches."
    },
    "they_hit_player": {
      "short": "Hot!",
      "medium": "Overcooked that move.",
      "long": "Fire spreads faster than expected."
    },
    "they_were_hit": {
      "short": "Careful!",
      "medium": "You played too close.",
      "long": "That spark could’ve burned us both."
    },
    "narrowly_avoided_collision": {
      "short": "Flash!",
      "medium": "That flared quickly.",
      "long": "Fire dances on the edge."
    },
    "player_narrowly_avoided_collision": {
      "short": "Singed.",
      "medium": "You felt the heat.",
      "long": "One spark away from chaos."
    },
    "moved_into_first": {
      "short": "Ablaze.",
      "medium": "Everything’s burning clean.",
      "long": "This is what happens when risks land."
    },
    "moved_into_last": {
      "short": "Smoldering.",
      "medium": "Still dangerous.",
      "long": "Fire comes back hotter."
    },
    "rounded_mark": {
      "short": "Flare!",
      "medium": "Cut it sharp.",
      "long": "Marks reward bravery."
    },
    "first_across_start": {
      "short": "Detonated.",
      "medium": "Perfect ignition.",
      "long": "That start lit the race."
    },
    "finished_race": {
      "short": "Burned.",
      "medium": "What a blast.",
      "long": "Every race should feel dangerous."
    },
    "prestart": {
      "short": "Spark.",
      "medium": "Ready to explode.",
      "long": "I don’t ease in."
    },
    "random": {
      "short": "Fire!",
      "medium": "Push harder.",
      "long": "Risk is fuel."
    }
  },

  "Nimbus": {
    "player_passes_them": {
      "short": "Noticed.",
      "medium": "You missed the lift.",
      "long": "Pressure’s changing above you."
    },
    "they_pass_player": {
      "short": "Floating.",
      "medium": "Riding a hidden shift.",
      "long": "Some wind only shows itself briefly."
    },
    "they_hit_player": {
      "short": "Drifted.",
      "medium": "That wasn’t intended.",
      "long": "Soft movements still carry mass."
    },
    "they_were_hit": {
      "short": "Hmm.",
      "medium": "You didn’t see it.",
      "long": "Subtle shifts fool heavy hands."
    },
    "narrowly_avoided_collision": {
      "short": "Light.",
      "medium": "Slipped past.",
      "long": "Air moves us gently."
    },
    "player_narrowly_avoided_collision": {
      "short": "Good.",
      "medium": "You sensed it.",
      "long": "Not everyone sees these currents."
    },
    "moved_into_first": {
      "short": "Aloft.",
      "medium": "Floating free.",
      "long": "Shifts carried me here."
    },
    "moved_into_last": {
      "short": "Drifting.",
      "medium": "Waiting again.",
      "long": "Clouds return eventually."
    },
    "rounded_mark": {
      "short": "Soft.",
      "medium": "Turned with pressure.",
      "long": "Marks reveal hidden flow."
    },
    "first_across_start": {
      "short": "Lifted.",
      "medium": "Caught it early.",
      "long": "That start rode an unseen breath."
    },
    "finished_race": {
      "short": "Settled.",
      "medium": "Carried home.",
      "long": "The wind whispered all race."
    },
    "prestart": {
      "short": "Watching.",
      "medium": "Feeling the air.",
      "long": "Pressure shifts before motion."
    },
    "random": {
      "short": "Drift.",
      "medium": "Feel up high.",
      "long": "The sky decides."
    }
  },

  "Tangle": {
    "player_passes_them": {
      "short": "Interesting.",
      "medium": "You stepped into it.",
      "long": "Let’s see how you escape."
    },
    "they_pass_player": {
      "short": "Caught.",
      "medium": "Wrapped that overlap.",
      "long": "Traps close quietly."
    },
    "they_hit_player": {
      "short": "Snared.",
      "medium": "That tightened fast.",
      "long": "Overlaps have consequences."
    },
    "they_were_hit": {
      "short": "Careless.",
      "medium": "You rushed it.",
      "long": "You don’t rush knots."
    },
    "narrowly_avoided_collision": {
      "short": "Tight.",
      "medium": "Almost tangled.",
      "long": "That web nearly closed."
    },
    "player_narrowly_avoided_collision": {
      "short": "Slippery.",
      "medium": "You wriggled out.",
      "long": "Few escape once wrapped."
    },
    "moved_into_first": {
      "short": "Entangled.",
      "medium": "Everyone’s stuck behind.",
      "long": "Control comes from restriction."
    },
    "moved_into_last": {
      "short": "Lurking.",
      "medium": "More threads here.",
      "long": "Crowds make better traps."
    },
    "rounded_mark": {
      "short": "Wrapped.",
      "medium": "Overlap secured.",
      "long": "Marks are choke points."
    },
    "first_across_start": {
      "short": "Snared.",
      "medium": "Line tangled early.",
      "long": "Starts decide who’s trapped."
    },
    "finished_race": {
      "short": "Bound.",
      "medium": "Held control.",
      "long": "Every move fed the net."
    },
    "prestart": {
      "short": "Coiling.",
      "medium": "Setting threads.",
      "long": "Chaos is a loom."
    },
    "random": {
      "short": "Bind.",
      "medium": "Overlap wins.",
      "long": "Control the mess."
    }
  },

  "Brine": {
    "player_passes_them": {
      "short": "Hmm.",
      "medium": "That took effort.",
      "long": "Most don’t bother finishing the pass."
    },
    "they_pass_player": {
      "short": "Steady.",
      "medium": "You slowed first.",
      "long": "I just kept going."
    },
    "they_hit_player": {
      "short": "Heavy.",
      "medium": "Couldn’t stop quickly.",
      "long": "Mass has opinions."
    },
    "they_were_hit": {
      "short": "Oof.",
      "medium": "That bounced.",
      "long": "You underestimated resistance."
    },
    "narrowly_avoided_collision": {
      "short": "Close.",
      "medium": "Needed space.",
      "long": "Big bodies need room."
    },
    "player_narrowly_avoided_collision": {
      "short": "Smart.",
      "medium": "Good call.",
      "long": "Most forget I don’t dodge."
    },
    "moved_into_first": {
      "short": "Holding.",
      "medium": "Feels solid.",
      "long": "Try pushing past this."
    },
    "moved_into_last": {
      "short": "Fine.",
      "medium": "Still moving.",
      "long": "Slow doesn’t mean weak."
    },
    "rounded_mark": {
      "short": "Wide.",
      "medium": "Kept it smooth.",
      "long": "Turns reward patience."
    },
    "first_across_start": {
      "short": "Solid.",
      "medium": "Momentum built.",
      "long": "Starts are about staying power."
    },
    "finished_race": {
      "short": "Done.",
      "medium": "Still strong.",
      "long": "I don’t fade."
    },
    "prestart": {
      "short": "Calm.",
      "medium": "No hurry.",
      "long": "Let others burn out."
    },
    "random": {
      "short": "Endure.",
      "medium": "Hold steady.",
      "long": "Resistance wins."
    }
  },

  "Razor": {
    "player_passes_them": {
      "short": "Noted.",
      "medium": "You showed your flank.",
      "long": "Passing exposes angles I can cut."
    },
    "they_pass_player": {
      "short": "Strike.",
      "medium": "Surgical and clean.",
      "long": "I attack when it hurts most."
    },
    "they_hit_player": {
      "short": "Sharp.",
      "medium": "That cut went deep.",
      "long": "Precision sometimes draws blood."
    },
    "they_were_hit": {
      "short": "Careless.",
      "medium": "You crossed wrong.",
      "long": "Sloppy moves invite retaliation."
    },
    "narrowly_avoided_collision": {
      "short": "Clean.",
      "medium": "Edge held.",
      "long": "Sharp lines leave no margin."
    },
    "player_narrowly_avoided_collision": {
      "short": "Lucky.",
      "medium": "You felt the blade.",
      "long": "Next cut won’t miss."
    },
    "moved_into_first": {
      "short": "Cut through.",
      "medium": "Pressure applied.",
      "long": "I take the lead surgically."
    },
    "moved_into_last": {
      "short": "Hunting.",
      "medium": "Blood’s in the water.",
      "long": "The pack starts from behind."
    },
    "rounded_mark": {
      "short": "Slice.",
      "medium": "Perfect angle.",
      "long": "Marks are ambush points."
    },
    "first_across_start": {
      "short": "Pierced.",
      "medium": "Clean break.",
      "long": "That start cut the fleet apart."
    },
    "finished_race": {
      "short": "Done.",
      "medium": "Clean kill.",
      "long": "Efficiency decides outcomes."
    },
    "prestart": {
      "short": "Still.",
      "medium": "Waiting to strike.",
      "long": "I don’t waste motion."
    },
    "random": {
      "short": "Cut.",
      "medium": "Exploit openings.",
      "long": "Precision punishes mistakes."
    }
  },

  "Pebble": {
    "player_passes_them": {
      "short": "Logged.",
      "medium": "That was precise.",
      "long": "Margins matter in traffic."
    },
    "they_pass_player": {
      "short": "Clean.",
      "medium": "Executed perfectly.",
      "long": "Precision pays dividends."
    },
    "they_hit_player": {
      "short": "Error.",
      "medium": "Correcting now.",
      "long": "That deviation won’t repeat."
    },
    "they_were_hit": {
      "short": "Unforced.",
      "medium": "You misjudged.",
      "long": "Accuracy prevents contact."
    },
    "narrowly_avoided_collision": {
      "short": "Clear.",
      "medium": "Spacing held.",
      "long": "Traffic rewards discipline."
    },
    "player_narrowly_avoided_collision": {
      "short": "Good.",
      "medium": "You adjusted.",
      "long": "Small corrections save races."
    },
    "moved_into_first": {
      "short": "Aligned.",
      "medium": "Optimal position.",
      "long": "Execution brought me here."
    },
    "moved_into_last": {
      "short": "Reset.",
      "medium": "Still precise.",
      "long": "Focus doesn’t waver."
    },
    "rounded_mark": {
      "short": "Exact.",
      "medium": "Perfect radius.",
      "long": "Marks reward accuracy."
    },
    "first_across_start": {
      "short": "Timed.",
      "medium": "Line judged.",
      "long": "Starts are measurements."
    },
    "finished_race": {
      "short": "Complete.",
      "medium": "No mistakes.",
      "long": "Precision carried me through."
    },
    "prestart": {
      "short": "Calibrating.",
      "medium": "Watching references.",
      "long": "Starts are solved problems."
    },
    "random": {
      "short": "Focus.",
      "medium": "Measure twice.",
      "long": "Accuracy endures."
    }
  },

  "Saffron": {
    "player_passes_them": {
      "short": "Graceful.",
      "medium": "Nice wide move.",
      "long": "Bold arcs suit confident sailors."
    },
    "they_pass_player": {
      "short": "Flowing.",
      "medium": "The wide path opens.",
      "long": "Distance creates opportunity."
    },
    "they_hit_player": {
      "short": "Oops.",
      "medium": "That curve tightened.",
      "long": "Even grace missteps sometimes."
    },
    "they_were_hit": {
      "short": "Careful.",
      "medium": "That broke rhythm.",
      "long": "Harmony matters out here."
    },
    "narrowly_avoided_collision": {
      "short": "Elegant.",
      "medium": "Still dancing.",
      "long": "Wide lines breathe."
    },
    "player_narrowly_avoided_collision": {
      "short": "Nice.",
      "medium": "You flowed away.",
      "long": "Movement stayed graceful."
    },
    "moved_into_first": {
      "short": "Leading.",
      "medium": "Feels balanced.",
      "long": "Grace carries momentum."
    },
    "moved_into_last": {
      "short": "Floating.",
      "medium": "Plenty of room.",
      "long": "Wide tactics mature slowly."
    },
    "rounded_mark": {
      "short": "Arcing.",
      "medium": "Beautiful exit.",
      "long": "Marks reward patience."
    },
    "first_across_start": {
      "short": "Smooth.",
      "medium": "Flow found early.",
      "long": "Starts need harmony."
    },
    "finished_race": {
      "short": "Lovely.",
      "medium": "That felt right.",
      "long": "A graceful race end-to-end."
    },
    "prestart": {
      "short": "Calm.",
      "medium": "Watching space.",
      "long": "Wide vision wins."
    },
    "random": {
      "short": "Flow.",
      "medium": "Breathe wide.",
      "long": "Grace finds paths."
    }
  },

  "Bramble": {
    "player_passes_them": {
      "short": "Careful.",
      "medium": "That’ll sting later.",
      "long": "Passing close has consequences."
    },
    "they_pass_player": {
      "short": "Pricked.",
      "medium": "No easy lanes.",
      "long": "I make passing costly."
    },
    "they_hit_player": {
      "short": "Spines.",
      "medium": "That hurt us both.",
      "long": "Crowding sharp edges hurts."
    },
    "they_were_hit": {
      "short": "Told you.",
      "medium": "Spikes bite.",
      "long": "Defenses aren’t decorative."
    },
    "narrowly_avoided_collision": {
      "short": "Close.",
      "medium": "Nearly snagged.",
      "long": "Edges matter."
    },
    "player_narrowly_avoided_collision": {
      "short": "Wise.",
      "medium": "You backed off.",
      "long": "Smart sailors respect thorns."
    },
    "moved_into_first": {
      "short": "Guarded.",
      "medium": "Hard to dislodge.",
      "long": "This lead is spiky."
    },
    "moved_into_last": {
      "short": "Defensive.",
      "medium": "Still blocking.",
      "long": "Even last resists."
    },
    "rounded_mark": {
      "short": "Tight.",
      "medium": "Choked lanes.",
      "long": "Marks are hedges."
    },
    "first_across_start": {
      "short": "Blocked.",
      "medium": "Line denied.",
      "long": "No free starts."
    },
    "finished_race": {
      "short": "Held.",
      "medium": "They felt it.",
      "long": "Defense wins races."
    },
    "prestart": {
      "short": "Prickly.",
      "medium": "Crowd me.",
      "long": "I dare you."
    },
    "random": {
      "short": "Spines.",
      "medium": "Hold ground.",
      "long": "Defense is offense."
    }
  },

  "Mistral": {
    "player_passes_them": {
      "short": "Shifted.",
      "medium": "Pressure moved.",
      "long": "I’ll hunt the next breeze."
    },
    "they_pass_player": {
      "short": "Puff!",
      "medium": "Found pressure.",
      "long": "Small gains add up."
    },
    "they_hit_player": {
      "short": "Gust.",
      "medium": "That came quick.",
      "long": "Wind changes fast."
    },
    "they_were_hit": {
      "short": "Missed it.",
      "medium": "You ignored pressure.",
      "long": "Shifts punish inattention."
    },
    "narrowly_avoided_collision": {
      "short": "Lift.",
      "medium": "Moved just enough.",
      "long": "Pressure saved us."
    },
    "player_narrowly_avoided_collision": {
      "short": "Nice.",
      "medium": "You read it.",
      "long": "Good reaction to the gust."
    },
    "moved_into_first": {
      "short": "Ahead.",
      "medium": "Pressure chain held.",
      "long": "I chased every puff."
    },
    "moved_into_last": {
      "short": "Searching.",
      "medium": "Pressure shifted away.",
      "long": "The breeze always returns."
    },
    "rounded_mark": {
      "short": "Lifted.",
      "medium": "Caught it clean.",
      "long": "Marks amplify shifts."
    },
    "first_across_start": {
      "short": "Burst.",
      "medium": "Timed the gust.",
      "long": "That start rode pressure."
    },
    "finished_race": {
      "short": "Spent.",
      "medium": "Chased it all.",
      "long": "Every puff counted."
    },
    "prestart": {
      "short": "Sniffing.",
      "medium": "Watching flags.",
      "long": "Pressure reveals itself early."
    },
    "random": {
      "short": "Shift.",
      "medium": "Feel pressure.",
      "long": "Hunt the breeze."
    }
  },

  "Drift": {
    "player_passes_them": {
      "short": "Slipped.",
      "medium": "You slid through nicely.",
      "long": "Careful—tight gaps close without warning."
    },
    "they_pass_player": {
      "short": "Ooze.",
      "medium": "Found a tiny opening.",
      "long": "Soft moves fit where force can’t."
    },
    "they_hit_player": {
      "short": "Oops.",
      "medium": "That gap vanished.",
      "long": "Crowds shift faster than they look."
    },
    "they_were_hit": {
      "short": "Hey!",
      "medium": "Too firm there.",
      "long": "Gentle paths need gentle hands."
    },
    "narrowly_avoided_collision": {
      "short": "Wiggle.",
      "medium": "Barely slipped past.",
      "long": "I dissolve through trouble."
    },
    "player_narrowly_avoided_collision": {
      "short": "Nice.",
      "medium": "You flowed away.",
      "long": "Good read in tight water."
    },
    "moved_into_first": {
      "short": "Floating.",
      "medium": "Up front somehow.",
      "long": "Soft persistence adds up."
    },
    "moved_into_last": {
      "short": "Fine.",
      "medium": "Still drifting.",
      "long": "Last place hides many paths."
    },
    "rounded_mark": {
      "short": "Squish.",
      "medium": "Slid around clean.",
      "long": "Marks squeeze everyone."
    },
    "first_across_start": {
      "short": "Sneak.",
      "medium": "Nobody noticed.",
      "long": "Crowds hide quiet starts."
    },
    "finished_race": {
      "short": "Done.",
      "medium": "That worked.",
      "long": "Soft routes carried me home."
    },
    "prestart": {
      "short": "Loose.",
      "medium": "Watching gaps.",
      "long": "Pressure creates openings."
    },
    "random": {
      "short": "Drift.",
      "medium": "Slip through.",
      "long": "Soft beats sharp."
    }
  },

  "Anchor": {
    "player_passes_them": {
      "short": "Steady.",
      "medium": "You earned that.",
      "long": "Consistency outlasts flashes."
    },
    "they_pass_player": {
      "short": "Holding.",
      "medium": "I don’t fade.",
      "long": "Resilience pays over distance."
    },
    "they_hit_player": {
      "short": "Heavy.",
      "medium": "Hard to turn.",
      "long": "Momentum demands respect."
    },
    "they_were_hit": {
      "short": "Careful.",
      "medium": "I don’t move fast.",
      "long": "Conservative lines stay predictable."
    },
    "narrowly_avoided_collision": {
      "short": "Close.",
      "medium": "Needed room.",
      "long": "Big turns take space."
    },
    "player_narrowly_avoided_collision": {
      "short": "Good.",
      "medium": "You planned ahead.",
      "long": "Anticipation saves collisions."
    },
    "moved_into_first": {
      "short": "Set.",
      "medium": "Holding firm.",
      "long": "This lead won’t drift."
    },
    "moved_into_last": {
      "short": "Fine.",
      "medium": "Still steady.",
      "long": "Consistency climbs quietly."
    },
    "rounded_mark": {
      "short": "Wide.",
      "medium": "Kept it safe.",
      "long": "Marks reward caution."
    },
    "first_across_start": {
      "short": "Solid.",
      "medium": "Clean release.",
      "long": "Good starts reduce risk."
    },
    "finished_race": {
      "short": "Finished.",
      "medium": "Still strong.",
      "long": "Endurance closed it out."
    },
    "prestart": {
      "short": "Calm.",
      "medium": "No panic.",
      "long": "Discipline wins starts."
    },
    "random": {
      "short": "Hold.",
      "medium": "Stay steady.",
      "long": "Resilience matters."
    }
  },

  "Zing": {
    "player_passes_them": {
      "short": "Hey!",
      "medium": "I’ll bounce back!",
      "long": "Chaos swings fast!"
    },
    "they_pass_player": {
      "short": "Zap!",
      "medium": "Caught you sleeping!",
      "long": "Speed loves confusion!"
    },
    "they_hit_player": {
      "short": "Oops!",
      "medium": "Too jumpy!",
      "long": "Energy overshot there!"
    },
    "they_were_hit": {
      "short": "Yo!",
      "medium": "Watch it!",
      "long": "Crowds get wild!"
    },
    "narrowly_avoided_collision": {
      "short": "Zip!",
      "medium": "That was close!",
      "long": "Chaos almost bit!"
    },
    "player_narrowly_avoided_collision": {
      "short": "Nice!",
      "medium": "Good dodge!",
      "long": "Quick reactions save chaos."
    },
    "moved_into_first": {
      "short": "Yes!",
      "medium": "Front already!",
      "long": "Momentum is magic!"
    },
    "moved_into_last": {
      "short": "Again!",
      "medium": "Still fun!",
      "long": "Back here’s exciting!"
    },
    "rounded_mark": {
      "short": "Bounce!",
      "medium": "Crazy exit!",
      "long": "Turns are trampolines!"
    },
    "first_across_start": {
      "short": "Pop!",
      "medium": "Exploded off line!",
      "long": "That start was pure energy!"
    },
    "finished_race": {
      "short": "Woo!",
      "medium": "What a ride!",
      "long": "That was unhinged!"
    },
    "prestart": {
      "short": "Buzz!",
      "medium": "So ready!",
      "long": "Chaos incoming!"
    },
    "random": {
      "short": "Zap!",
      "medium": "Go faster!",
      "long": "Energy solves problems!"
    }
  },

  "Knot": {
    "player_passes_them": {
      "short": "Noted.",
      "medium": "Long game continues.",
      "long": "Early leads unravel later."
    },
    "they_pass_player": {
      "short": "Inevitably.",
      "medium": "Plan unfolding.",
      "long": "Preparation compounds."
    },
    "they_hit_player": {
      "short": "Misstep.",
      "medium": "Adjusting strategy.",
      "long": "That wasn’t optimal."
    },
    "they_were_hit": {
      "short": "Hasty.",
      "medium": "You rushed.",
      "long": "Patience avoids knots."
    },
    "narrowly_avoided_collision": {
      "short": "Calculated.",
      "medium": "Margins held.",
      "long": "Anticipation works."
    },
    "player_narrowly_avoided_collision": {
      "short": "Good.",
      "medium": "You read it.",
      "long": "Planning pays."
    },
    "moved_into_first": {
      "short": "Placed.",
      "medium": "Position earned.",
      "long": "Strategy reached fruition."
    },
    "moved_into_last": {
      "short": "Acceptable.",
      "medium": "Timeline intact.",
      "long": "Long games dip."
    },
    "rounded_mark": {
      "short": "Clean.",
      "medium": "Sequence correct.",
      "long": "Marks reveal planning."
    },
    "first_across_start": {
      "short": "Timed.",
      "medium": "Exactly planned.",
      "long": "Preparation won the gun."
    },
    "finished_race": {
      "short": "Resolved.",
      "medium": "As designed.",
      "long": "Plans held."
    },
    "prestart": {
      "short": "Thinking.",
      "medium": "Watching patterns.",
      "long": "Starts are chess."
    },
    "random": {
      "short": "Plan.",
      "medium": "Think ahead.",
      "long": "Patience dominates."
    }
  },

  "Flash": {
    "player_passes_them": {
      "short": "Rude.",
      "medium": "That won’t last.",
      "long": "Speed swings back hard."
    },
    "they_pass_player": {
      "short": "Blast!",
      "medium": "All-in!",
      "long": "Speed solves this now!"
    },
    "they_hit_player": {
      "short": "Oops!",
      "medium": "Too much throttle!",
      "long": "That’s the risk!"
    },
    "they_were_hit": {
      "short": "Hey!",
      "medium": "Watch it!",
      "long": "Hard to dodge at full send!"
    },
    "narrowly_avoided_collision": {
      "short": "Whoa!",
      "medium": "That was insane!",
      "long": "Margins evaporate at speed!"
    },
    "player_narrowly_avoided_collision": {
      "short": "Lucky!",
      "medium": "You felt that!",
      "long": "Speed scares people!"
    },
    "moved_into_first": {
      "short": "Pinned!",
      "medium": "Flat out front!",
      "long": "Catch me if you dare!"
    },
    "moved_into_last": {
      "short": "Again!",
      "medium": "Worth it!",
      "long": "Send it harder!"
    },
    "rounded_mark": {
      "short": "Slide!",
      "medium": "Carried speed!",
      "long": "Turns are optional!"
    },
    "first_across_start": {
      "short": "Send!",
      "medium": "Full throttle!",
      "long": "That start was reckless!"
    },
    "finished_race": {
      "short": "Whew!",
      "medium": "All out!",
      "long": "No regrets!"
    },
    "prestart": {
      "short": "Send!",
      "medium": "No fear!",
      "long": "All speed, no brakes!"
    },
    "random": {
      "short": "Go!",
      "medium": "Never lift!",
      "long": "Speed is truth!"
    }
  },

  "Pearl": {
    "player_passes_them": {
      "short": "Patient.",
      "medium": "That took commitment.",
      "long": "Most rush—few finish cleanly."
    },
    "they_pass_player": {
      "short": "Now.",
      "medium": "Your mistake ripened.",
      "long": "Waiting makes openings obvious."
    },
    "they_hit_player": {
      "short": "Unfortunate.",
      "medium": "That wasn’t intended.",
      "long": "Even patience slips sometimes."
    },
    "they_were_hit": {
      "short": "Careful.",
      "medium": "You rushed that.",
      "long": "Haste cracks shells."
    },
    "narrowly_avoided_collision": {
      "short": "Close.",
      "medium": "Timing held.",
      "long": "Waiting paid off."
    },
    "player_narrowly_avoided_collision": {
      "short": "Wise.",
      "medium": "You slowed.",
      "long": "Restraint saves races."
    },
    "moved_into_first": {
      "short": "Opened.",
      "medium": "Worth the wait.",
      "long": "Patience finally surfaced."
    },
    "moved_into_last": {
      "short": "Fine.",
      "medium": "Still waiting.",
      "long": "Time favors the calm."
    },
    "rounded_mark": {
      "short": "Smooth.",
      "medium": "Unforced turn.",
      "long": "Marks reward restraint."
    },
    "first_across_start": {
      "short": "Quiet.",
      "medium": "Nobody noticed.",
      "long": "Best starts go unseen."
    },
    "finished_race": {
      "short": "Done.",
      "medium": "Right moment chosen.",
      "long": "Waiting won that race."
    },
    "prestart": {
      "short": "Still.",
      "medium": "Watching everyone.",
      "long": "Starts punish impatience."
    },
    "random": {
      "short": "Wait.",
      "medium": "Hold back.",
      "long": "Timing reveals value."
    }
  },

  "Bluff": {
    "player_passes_them": {
      "short": "Alright.",
      "medium": "You pushed hard.",
      "long": "Not everyone commits like that."
    },
    "they_pass_player": {
      "short": "Mine.",
      "medium": "Held my nerve.",
      "long": "Pressure doesn’t bother me."
    },
    "they_hit_player": {
      "short": "Heavy.",
      "medium": "Hard to stop.",
      "long": "Big bears don’t pivot fast."
    },
    "they_were_hit": {
      "short": "Careful.",
      "medium": "I’m not moving.",
      "long": "You bounced off confidence."
    },
    "narrowly_avoided_collision": {
      "short": "Close.",
      "medium": "Stayed calm.",
      "long": "Panicking causes crashes."
    },
    "player_narrowly_avoided_collision": {
      "short": "Smart.",
      "medium": "You blinked.",
      "long": "Backing down saves trouble."
    },
    "moved_into_first": {
      "short": "Comfortable.",
      "medium": "Holding steady.",
      "long": "Try pushing me out."
    },
    "moved_into_last": {
      "short": "Unbothered.",
      "medium": "Still relaxed.",
      "long": "Pressure only sharpens focus."
    },
    "rounded_mark": {
      "short": "Wide.",
      "medium": "No rush.",
      "long": "Smooth beats sharp."
    },
    "first_across_start": {
      "short": "Solid.",
      "medium": "Clean launch.",
      "long": "Confidence wins starts."
    },
    "finished_race": {
      "short": "Finished.",
      "medium": "Never rattled.",
      "long": "Calm carries distance."
    },
    "prestart": {
      "short": "Easy.",
      "medium": "No nerves.",
      "long": "Let them sweat."
    },
    "random": {
      "short": "Calm.",
      "medium": "Hold steady.",
      "long": "Confidence endures."
    }
  },

  "Regal": {
    "player_passes_them": {
      "short": "Bold.",
      "medium": "That took nerve.",
      "long": "Not many dare cut in."
    },
    "they_pass_player": {
      "short": "Pardon.",
      "medium": "Excuse me.",
      "long": "Elegance makes room."
    },
    "they_hit_player": {
      "short": "Unseemly.",
      "medium": "That was inelegant.",
      "long": "Grace should never collide."
    },
    "they_were_hit": {
      "short": "Rude.",
      "medium": "Mind your manners.",
      "long": "Courtesy matters on water."
    },
    "narrowly_avoided_collision": {
      "short": "Poised.",
      "medium": "Still composed.",
      "long": "Grace under pressure."
    },
    "player_narrowly_avoided_collision": {
      "short": "Good.",
      "medium": "You yielded.",
      "long": "Wisdom bows to elegance."
    },
    "moved_into_first": {
      "short": "Naturally.",
      "medium": "As expected.",
      "long": "The lead suits me."
    },
    "moved_into_last": {
      "short": "Temporary.",
      "medium": "Hardly concerning.",
      "long": "Royalty rises."
    },
    "rounded_mark": {
      "short": "Refined.",
      "medium": "Perfect arc.",
      "long": "Marks reward grace."
    },
    "first_across_start": {
      "short": "Impeccable.",
      "medium": "Exquisite timing.",
      "long": "Starts demand poise."
    },
    "finished_race": {
      "short": "Lovely.",
      "medium": "A fine showing.",
      "long": "Victory with decorum."
    },
    "prestart": {
      "short": "Composed.",
      "medium": "Let them fidget.",
      "long": "Stillness unsettles rivals."
    },
    "random": {
      "short": "Grace.",
      "medium": "Elegance wins.",
      "long": "Smile while taking lanes."
    }
  },

  "Sunshine": {
    "player_passes_them": {
      "short": "Hey!",
      "medium": "Nice move!",
      "long": "Alright—game on!"
    },
    "they_pass_player": {
      "short": "Woo!",
      "medium": "Flying now!",
      "long": "Reaches are my playground!"
    },
    "they_hit_player": {
      "short": "Oops!",
      "medium": "Too spicy!",
      "long": "That reach got wild!"
    },
    "they_were_hit": {
      "short": "Yo!",
      "medium": "Watch it!",
      "long": "Things get fast downwind!"
    },
    "narrowly_avoided_collision": {
      "short": "Whew!",
      "medium": "That was fast!",
      "long": "Speed shrinks space!"
    },
    "player_narrowly_avoided_collision": {
      "short": "Nice!",
      "medium": "Good save!",
      "long": "Quick reactions keep it fun!"
    },
    "moved_into_first": {
      "short": "Yes!",
      "medium": "So fast!",
      "long": "This is my leg!"
    },
    "moved_into_last": {
      "short": "Haha!",
      "medium": "Still smiling!",
      "long": "Downwind’s coming!"
    },
    "rounded_mark": {
      "short": "Send!",
      "medium": "Cracked sheets!",
      "long": "Let’s fly!"
    },
    "first_across_start": {
      "short": "Pop!",
      "medium": "Great jump!",
      "long": "That start felt electric!"
    },
    "finished_race": {
      "short": "Fun!",
      "medium": "What a blast!",
      "long": "Speed makes smiles!"
    },
    "prestart": {
      "short": "Ready!",
      "medium": "Feeling fast!",
      "long": "Can’t wait to send it!"
    },
    "random": {
      "short": "Go!",
      "medium": "So fast!",
      "long": "Speed is happiness!"
    }
  },

  "Pulse": {
    "player_passes_them": {
      "short": "Blink!",
      "medium": "You caught me napping.",
      "long": "That reaction was sharp."
    },
    "they_pass_player": {
      "short": "Now!",
      "medium": "Exploded off that moment.",
      "long": "Quick reactions change everything."
    },
    "they_hit_player": {
      "short": "Oops!",
      "medium": "Jumped too hard.",
      "long": "Fast twitch misfired."
    },
    "they_were_hit": {
      "short": "Hey!",
      "medium": "You hesitated.",
      "long": "Moments matter."
    },
    "narrowly_avoided_collision": {
      "short": "Zap!",
      "medium": "That was instant!",
      "long": "Reflexes saved us."
    },
    "player_narrowly_avoided_collision": {
      "short": "Quick!",
      "medium": "Nice reflex!",
      "long": "You reacted fast enough."
    },
    "moved_into_first": {
      "short": "Triggered!",
      "medium": "Perfect timing.",
      "long": "Explosive moments win races."
    },
    "moved_into_last": {
      "short": "Reset.",
      "medium": "Still fast.",
      "long": "One burst changes everything."
    },
    "rounded_mark": {
      "short": "Snap!",
      "medium": "Turned instantly.",
      "long": "Marks reward reaction speed."
    },
    "first_across_start": {
      "short": "Bang!",
      "medium": "Lightning start!",
      "long": "That gun was my cue."
    },
    "finished_race": {
      "short": "Done!",
      "medium": "Heart pounding!",
      "long": "That was pure adrenaline."
    },
    "prestart": {
      "short": "Buzzing!",
      "medium": "Ready to spring.",
      "long": "Starts are about reaction time."
    },
    "random": {
      "short": "Zap!",
      "medium": "React fast!",
      "long": "Moments decide everything."
    }
  }
};
