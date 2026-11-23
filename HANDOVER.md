# Handover: turn my guitar practice plan into a clickable webpage

## What this is

`guitar-skill-tree.md` (in this folder) is my guitar practice plan. It has:

- 5 streams: Clean Hands, Rhythm, Fretboard Map, Harmony, Lead and Improv.
- 23 levels across those streams. Each level has a Quick (15 min) session, a Long (30–45 min) session and a "Done when" test.
- Two "Everything" routines: Quick 15 and Long 45.
- Intro sections ("How to use this", "The three rules") and a Toolkit.

The content is final. The problem is the format. As one long document it's a wall of text on my phone. I want a webpage I can click through, one small screen at a time.

## What to build

A single webpage, not an app, with a small API that saves ticks.

- One `index.html` with the CSS and JS inline. No framework, no build step, no dependencies. Apart from calls to its own ticks API, it makes no network requests.
- Put the content in one clearly marked JS data object at the top of the script, converted from the markdown, so I can edit text later without touching the layout. Keep my wording exactly. Don't rewrite, shorten or "improve" the guitar content.
- Mobile first, at a 390px-wide phone viewport. Big tap targets (at least 44px), body text at least 17px, and a dark mode that follows the system setting.
- No text inputs, apart from a password field I use once per device. The on-screen keyboard is the thing I'm trying to escape.

## Screens

Use hash routing (`#/`, `#/stream/rhythm`, `#/level/power-chords`, `#/everything/quick`) so the phone's back button and swipe-back work.

1. **Home**
   - Two big buttons at the top: "Quick 15" and "Long 45" (the Everything routines).
   - Below them, one card per stream showing the stream name, progress (e.g. "2 / 5") and the current level's name. The current level is the lowest unticked one.
   - A small "How to use" link at the bottom.
2. **Stream**
   - A short intro line, then the levels as a list.
   - Each level shows a tick if passed, and the current one is highlighted.
   - "Needs X" shows as a small tag that links to that level.
3. **Level** (the most important screen)
   - Title, plus any short intro paragraph or bullet list the level has.
   - A Quick / Long segmented toggle that shows only one session's text at a time. The choice is per practice session: it holds while I move between screens and isn't saved.
   - Any tables, rendered as small tables.
   - The "Done when" text with a large tick toggle.
   - Prev / next level buttons at the bottom.
4. **Everything routine**
   - A numbered list of steps, each showing its minutes and stream.
   - Each step that refers to "your current level" links straight to that stream's current level.
5. **How to use / Toolkit**
   - Simple text pages.

## State

- Ticked levels are the only stored state. They're saved on the server, so every device sees the same ticks.
- Anyone with the link can see the site and my ticks, so I can show it to people. Changing a tick needs my password, entered once per device. Until then the tick toggles are greyed out.
- No accounts beyond that one password, no notes, no BPM logging.

## Out of scope for v1

Leave these out, even if they'd be easy:

- Timers
- Audio
- Metronome
- Charts
- Skill-tree graphics
- PWA install
- Streaks

I'll ask for extras later if I actually use this.

## Done when

- Every level, routine and section from the markdown is reachable within 2 taps of Home. Spot-check that none of the content is missing.
- It looks right at 390px wide in both light and dark mode. Take screenshots if you can.
- Ticks survive a reload, and can't be changed without the password.
- The back button works on every screen.

Then tell me the simplest way to get it on my phone. I'd prefer Netlify, or something just as low-effort.
