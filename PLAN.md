# Plan: guitar practice webapp v1

Status: 0/11 steps done.

The spec is `HANDOVER.md`: screens, routes, state, the out-of-scope list and the final "Done when" checks. This file holds the decisions made on top of it and the build steps.

The source text is `~/Downloads/guitar-skill-tree.md`. It stays out of the repo: once converted, `CONTENT` in `public/index.html` is the only copy to edit.

## Decisions

### Layout and stack

- **`public/index.html`** is the whole page, with all CSS and JS inline. `public/` holds only what gets served, so the repo's markdown files are never published.
- **`src/worker.js`** is a Cloudflare Worker that serves `public/` as static assets and answers the API. Plain JS with a hand-written router, since four routes don't need Hono.
- **`migrations/`** holds the D1 schema, and **`wrangler.jsonc`** holds the Worker name, the assets directory and the D1 binding.
- No build step, framework or test suite. Wrangler is the only npm dependency (see Security). Each step's checks run in a browser or with `curl`.
- One render function per screen (`renderHome`, `renderStream`, `renderLevel`, `renderRoutine`, `renderPage`, `renderUnlock`). Each maps to an Astro page if this ever moves to the gym app's stack.

### Borrowed from the gym app

- **Design tokens and class names** from `../gym/src/styles/global.css`: surfaces, text tiers, `--space-*`, `--radius-*`, `.btn`, `.linkish`, the `.label-section` / `.label` / `.meta-line` hierarchy, and the back-link convention (top-left `← Back` to the parent screen). Gym's dark values become the dark theme, and a matching light set is added. Body text goes from 16px to 17px. Gym's tap sizes (64px buttons, 44px links) already meet the handover's 44px minimum.
- **Space Grotesk**, embedded from `../gym/src/fonts/SpaceGrotesk-Variable.woff2` as a base64 `@font-face` (22K file, about 30K encoded), so the page loads no fonts from the network.
- **Storage pattern** from `../gym/src/lib/storage.ts`, for the ticks cache: all access goes through a few named functions, reads validate and fall back to defaults, and writes sit in try/catch.
- Not borrowed: `user-scalable=no` (pinch-zoom helps on a page you read), the secret path token (the password protects writes, and the page is meant to be shown to people), Svelte, the PWA, and the gym worker's Hono, Zod, basic auth, CORS setup and offline sync queue. The page and API share one origin, so CORS doesn't come up.

### Content object

`CONTENT` sits at the top of the script. Text is copied verbatim from the markdown, and markdown syntax becomes structure.

```js
const CONTENT = {
  howToUse: [/* blocks */],
  routinesIntro: '…',
  routines: [
    {
      id: 'quick',
      title: 'Quick 15',
      steps: [{ minutes: 3, label: 'Clean Hands', streamId: 'clean-hands', text: '…' }],
    },
  ],
  streams: [
    {
      id: 'clean-hands',
      prefix: 'C',
      name: 'Clean Hands',
      intro: [/* blocks */],
      levels: [
        {
          slug: 'open-chords',
          title: 'Open chord changes',
          needs: [],
          intro: [/* blocks */],
          quick: '…',
          long: '…',
          after: [/* blocks */],
          doneWhen: '…',
        },
      ],
    },
  ],
  toolkit: [/* blocks */],
};
```

- **Blocks** are `{ type: 'heading', text }`, `{ type: 'p', text }`, `{ type: 'list', ordered, items: [{ label, text }] }` and `{ type: 'table', head, rows }`. A list item's `label` holds its bold lead-in (`**5th:**`) when it has one.
- **Order** within a block array follows the markdown. H1 needs this: paragraph, table, paragraph.
- **`after`** holds text that follows the sessions, like C1's "Tips:" paragraph. It shows under both Quick and Long.
- **`needs`** is pulled out of the text as slugs. "Needs H1." is removed from L5's paragraph and shown as a tag, and the rest of the paragraph stays as written.

### Level slugs, labels and mentions

- **Slug** is a level's permanent ID. Ticks, routes (`#/level/muting`) and `needs` all use it.
- **Label** ("C3") is worked out from the stream's `prefix` and the level's position in `levels`. Inserting, removing or moving a level renumbers the labels, and ticks stay with their levels.
- **Mentions:** any text field can contain `[[slug]]`, which renders as that level's current label, linked to the level. Every typed label in the markdown's prose becomes a mention, so the rendered wording is unchanged:
  - H3 Long: "the borrowed ones from H2"
  - H4 Long: "take any H2 progression"
  - Lead and Improv intro: "Later (L6)"
  - Toolkit, Tone: "(C1, C2)" and "(C3, R3)"
  - Toolkit, Your last two lessons: "(C2, C3)" and "(L2)"
- **Needs tags** use the same rendering: "Needs" plus the current label, linked.
- **Rendering** splits text on the mention pattern and builds text nodes and links, with no `innerHTML`. An unknown slug renders as its raw `[[slug]]`, so a typo is visible.
- **Slugs:**
  - Clean Hands: `open-chords`, `barre-chords`, `muting`, `sus-and-triads`
  - Rhythm: `lock-to-click`, `strumming`, `power-chords`, `looper`, `dynamics`
  - Fretboard Map: `e-and-a-strings`, `octaves`, `intervals`, `caged`
  - Harmony: `major-scale-chords`, `progressions`, `ear`, `tension`
  - Lead and Improv: `pentatonic-box-1`, `bends-and-slides`, `phrasing`, `pentatonic-box-2`, `major-keys`, `playing-the-changes`

### Ticks and the password

- **Access:** anyone with the link can read every screen, ticks included. Changing a tick needs the owner cookie.
- **Password:** one Worker secret, `OWNER_PASSWORD`, set with `pnpm exec wrangler secret put`. It isn't stored in D1, because a secret is encrypted, never appears in a database export, and needs no table or hashing code. It's generated (`openssl rand -base64 24`) and kept in a password manager, which makes guessing it hopeless without any rate limiting.
- **Unlock screen:** an "Unlock" link at the bottom of Home, shown only while locked, opens `#/unlock`. It has one password field (`autocomplete="current-password"`, with a hidden fixed username so password managers save it) and a button. This is the app's only text input, and it's used once per device.
- **Owner cookie:** `POST /api/unlock` checks the password with a constant-time compare, then sets `__Host-owner` with `HttpOnly; Secure; SameSite=Strict; Path=/` and a one-year `Max-Age`. Its value is an HMAC of a fixed string, keyed with the password, so the cookie doesn't contain the password and changing the secret signs out every device. A server-set cookie isn't affected by Safari's 7-day clearing of script-written storage.
- **Data:** a D1 table, `ticks (level_slug TEXT PRIMARY KEY, ticked_at INTEGER NOT NULL)`, one row per ticked level. `ticked_at` isn't shown in v1, but it can't be filled in after the fact.
- **API:**
  - `GET /api/ticks` returns `{ ticks: ["muting", "looper"], canEdit: true }`. `canEdit` is how the page learns it's unlocked, since its JS can't read an `HttpOnly` cookie.
  - `PUT /api/ticks/:slug` ticks a level (`INSERT OR IGNORE`) and `DELETE /api/ticks/:slug` unticks it. Both return 204, or 401 without a valid cookie.
  - `POST /api/unlock` returns 204 with the cookie, or 401.
  - A slug that doesn't match `^[a-z0-9-]{1,40}$` gets a 404. Only the owner can write, so this is a sanity check rather than a defence. The page ignores slugs it doesn't know, such as a deleted level's leftover row.
  - Every API response sets `X-Robots-Tag: noindex` itself, since `_headers` only covers static files.
- **Page:** `guitar:ticks` in localStorage caches the last `GET /api/ticks` response, so screens draw instantly, and a fresh fetch on load replaces it. While locked, tick toggles show their state but are greyed out and inert. While unlocked, a tap updates the screen at once and calls the API. If the call fails, the tick reverts and a short message says it didn't save. There's no offline queue.
- **Quick/Long** isn't stored. It's chosen per practice session: it defaults to Quick when the page loads and holds while moving between screens.

### Security

- **Pinned wrangler:** `package.json` pins wrangler to an exact version, `pnpm-lock.yaml` is committed, and installs go through pnpm. Only `esbuild` and `workerd` may run install scripts, as in `../gym/worker/package.json`. Wrangler holds the Cloudflare login, which also reaches the gym app's database, and a bare `npx wrangler` runs whatever version is cached or newest on npm.
- **Origin check:** POST, PUT and DELETE get a 403 unless `Origin` matches the request's own origin. A missing `Origin` counts as a mismatch, since browsers always send it on these methods. This backs up `SameSite=Strict` instead of relying on browser behaviour alone.
- **Bound parameters:** every D1 query uses `prepare().bind()`, so a slug never becomes part of the SQL text.
- **No caching:** API responses send `Cache-Control: no-store`, since the ticks response changes with the cookie.
- **CSP and framing:** `public/_headers` sends `Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`. Inline scripts have to be allowed, because a hash-based policy would change with every content edit. The policy still stops anything loading from elsewhere and stops other sites framing the page.

### Behaviour the handover leaves open

- **Current level** is the lowest unticked level, ignoring "Needs". Needs are a visible tag, not a lock. A stream with every level ticked shows "Complete" on its Home card.
- **Routine links:** every routine step tied to a stream links to that stream's current level, following the markdown's "Each slot uses your current level in that stream". "Jam" maps to Lead and Improv. The Long 45 warm-up has no link.
- **Prev / next** stays within the stream. On the first or last level, that slot links back to the stream instead.
- **Home** has "How to use" and "Toolkit" links at the bottom, so each is one tap away, plus "Unlock" while locked.
- **Toggles** (Quick/Long and the tick) never change the URL, so the back button always goes to the previous screen.
- **Wide tables** scroll inside their own box, never the page.

### Hosting

- **Cloudflare Workers with static assets**, which Cloudflare's Pages docs now point new projects to. `pnpm exec wrangler deploy` publishes to `<worker-name>.<account>.workers.dev`. The name can be plain, since the password protects writes, not the URL.
- **No indexing:** `<meta name="robots" content="noindex, nofollow">` in the page, `public/_headers` sending `X-Robots-Tag: noindex` for static files, and the API's own header.
- The README stays vendor-neutral, and the specifics go in an uncommitted `DEPLOYMENT.md`.

## Gotchas

- **Slugs never change.** Renaming a slug orphans its tick. Titles, labels and order can change freely.
- **Mention, don't type, a label.** Prose that refers to a level must use `[[slug]]`. A typed "C3" goes stale the next time levels move.
- **Keep the password generated.** A memorable one would need rate limiting on `/api/unlock`, which v1 doesn't have.
- **Opening the file directly:** `public/index.html` opened from disk has no API, so it shows cached ticks and stays locked. Run `pnpm exec wrangler dev` instead.
- **Signing out:** there's no lock button. Clearing a device's site data signs that device out, and changing `OWNER_PASSWORD` signs out all of them.

## Steps

Each step is one commit, except step 11, which deploys and has nothing to commit.

### 1. App shell

- `public/index.html` with the light and dark tokens, the embedded font and the hash router. Every route renders a placeholder that names it.
- Checks:
  - Each route in the handover renders its placeholder, and the back button walks back through the visited routes.
  - At 390px, the theme follows the system setting.
  - DevTools shows no network requests beyond the page itself.
- Commit: `feat: app shell with theme tokens and hash router`

### 2. Content and Home

- The full `CONTENT` (23 levels with the slugs above, mentions converted, both routines, How to use, Toolkit), labels worked out from position, and the Home screen reading ticks from the localStorage cache.
- Checks:
  - A throwaway script in the scratchpad confirms every sentence of the markdown appears in `CONTENT` once mentions are expanded to their labels, and that every mention and `needs` entry names a real slug.
  - Each Home card shows 0 / N and the stream's first level.
  - Home at 390px in light and dark, screenshotted.
- Commit: `feat: skill tree content and home screen`

### 3. Stream screen

- Block and mention rendering, and the Stream screen: intro, level list with ticks from the cache, the current level highlighted, and Needs tags.
- Checks:
  - The Lead and Improv intro's mention and each Needs tag show the right label and open the level they name.
  - A tick added to the cache by hand shows in the list and moves the highlight.
  - Stream at 390px in light and dark, screenshotted.
- Commit: `feat: stream screen`

### 4. Level screen

- The Level screen as specified in `HANDOVER.md`: intro blocks and tables, the Quick/Long toggle, `after` text, "Done when" with the tick toggle, and prev / next. Until step 8, ticks save to the localStorage cache only, and the toggle is always enabled.
- Checks:
  - Ticks survive a reload, and Home and Stream progress update to match.
  - Quick/Long holds across screens and resets to Quick on reload.
  - Inserting a dummy level mid-stream renumbers labels, mentions and Needs tags, and existing ticks stay on their levels. The dummy is removed afterwards.
  - The back button goes Level → Stream → Home.
  - The H1 and H2 tables fit at 390px without page scroll.
  - Level in light and dark, screenshotted.
- Commit: `feat: level screen with quick/long toggle and ticks`

### 5. Everything routines

- `#/everything/quick` and `#/everything/long`: numbered steps with minutes and stream, linking to each stream's current level.
- Checks:
  - Each link opens its stream's current level, and moves on when that level is ticked.
  - The Long 45 warm-up has no link.
  - Both routines in light and dark, screenshotted.
- Commit: `feat: everything routines`

### 6. How to use and Toolkit

- `#/how-to-use` and `#/toolkit`, linked from the bottom of Home.
- Checks:
  - The Toolkit's mentions open their levels.
  - The handover's full "Done when" list passes, except the password check.
  - Both pages in light and dark, screenshotted.
- Commit: `feat: how to use and toolkit pages`

### 7. Serve with wrangler

- `package.json` and `pnpm-lock.yaml` with wrangler pinned, `wrangler.jsonc` serving `public/` as static assets with no Worker script yet, and `public/_headers` with the CSP and `X-Robots-Tag`. `.gitignore` covers `node_modules/` and `.wrangler/`.
- Confirm where pnpm 11 reads the install-scripts allowlist.
- Checks, under `pnpm exec wrangler dev`:
  - The page works as before.
  - `curl -I` shows the CSP and `X-Robots-Tag`, and the console shows no CSP violations, with the font still loading. If `wrangler dev` doesn't apply `_headers`, these checks move to step 11.
- Commit: `chore: serve with pinned wrangler and security headers`

### 8. Ticks API

- `migrations/0001_create_ticks.sql`, `src/worker.js` with `GET`, `PUT` and `DELETE` on `/api/ticks`, the D1 binding in `wrangler.jsonc`, and the page loading from and writing to the API, reverting a failed tap with a message.
- Writes are open to anyone until step 9. That's safe because nothing is deployed before step 11.
- Create the D1 database (`pnpm exec wrangler d1 create guitar`) for its ID, and migrate the local copy (`pnpm exec wrangler d1 migrations apply guitar --local`).
- Checks, under `pnpm exec wrangler dev`:
  - A tick shows up as a row in local D1 and still shows after clearing localStorage and reloading.
  - A malformed slug gets a 404, and API responses carry `X-Robots-Tag` and `Cache-Control: no-store`.
  - With the dev server stopped, a tap reverts and shows the message.
- Commit: `feat: save ticks to d1`

### 9. Password unlock

- `POST /api/unlock` and the owner cookie, the Origin check, 401s on writes without the cookie, `canEdit` in `GET /api/ticks`, the Unlock screen and its Home link, and greyed-out toggles while locked. `.dev.vars` holds a local `OWNER_PASSWORD`, and `.gitignore` covers it.
- Checks, under `pnpm exec wrangler dev`:
  - Locked, the toggles are greyed out.
  - A `curl -X PUT` on a tick with the right `Origin` but no cookie gets a 401. One with a foreign `Origin` gets a 403, even with the cookie.
  - A wrong password shows an error. The right one unlocks, and the cookie has `HttpOnly`, `Secure` and `SameSite=Strict`.
- Commit: `feat: password unlock for changing ticks`

### 10. README

- What it is, how to edit the text (`CONTENT` in `public/index.html`) and how to run it locally. `.gitignore` gains `DEPLOYMENT.md`.
- Check: the README's local steps work from a fresh clone.
- Commit: `docs: add readme`

### 11. Deploy

- Confirm the Cloudflare account has 2FA.
- Generate the production password, different from the one in `.dev.vars` so the real one never sits in a file. Set it with `pnpm exec wrangler secret put OWNER_PASSWORD`, typed at the prompt, because piping it in with `echo` saves it in shell history.
- Apply the migration with `--remote` and deploy. `DEPLOYMENT.md` records the Worker name, the commands and both password habits.
- Checks:
  - Unlock on the phone, tick a level, and see it on the laptop.
  - In a private window, the ticks show but are greyed out.
  - `curl -I` on the page shows `X-Robots-Tag` and the CSP.
- Nothing to commit, since `DEPLOYMENT.md` is gitignored.
