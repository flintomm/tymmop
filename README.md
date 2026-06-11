# between the spaces — tymmo p

Single-page audio-visual site. Looping driving clips crossfade behind an
illustrated car interior; a custom audio player sits in the dashboard radio
on desktop and docks as a bottom bar on phones.

Plain HTML/CSS/JS — no framework, no build step.

## Run locally

```
python3 -m http.server
```

Then open <http://localhost:8000>. Serving over HTTP matters: the page
fetches `config/player.json`, which `file://` blocks in most browsers.

## Tests

```
npm install   # once
npm test
```

The suite (node `--test` + jsdom) boots the real page and covers: every
referenced asset exists, meta/social/analytics wiring, playlist stepping
and wrap-around, play/pause state, seek bar fill, resume-from-last-visit,
umami event dedupe, media session handlers, mobile dock behavior, and
config fallbacks. Run it before pushing.

## Editing content — `config/player.json`

The config file is the single source of truth; adding a song never means
touching JavaScript.

| Key | What it does |
| --- | --- |
| `playlist` | Array of `{ src, title, artist }`. Audio streams from `media.tymmop.com`. |
| `videoSequence` | Background clip order. Repeat a file to make it play more often. |
| `links` | Array of `{ label, url }` rendered as a corner nav (new tab). Empty array hides the nav. |
| `desktop` | Player/overlay geometry for the dashboard bezel (percentages of the overlay image). |

### Aligning the player with the radio bezel (desktop)

Open the browser console and use the built-in helpers:

```js
playerGeometryTools.set({ playerLeftPct: 48.2, playerTopPct: 51.1 });
playerGeometryTools.log(); // copy the values back into config/player.json
```

The background road video can be lifted or zoomed the same way:

```js
playerGeometryTools.set({ videoOffsetYPct: -10, videoScale: 1.2 });
```

Negative `videoOffsetYPct` raises the road in the windshield. Keep
`videoScale >= 1 + |videoOffsetYPct| / 50` so the shifted video still
covers the screen edges.

## Player controls

- Space / Enter: play–pause; `←` / `→`: seek ±5 s; `n` / `p`: next/previous
- Click or drag the thin bar above the buttons to seek
- Lock-screen / headphone controls work via the Media Session API
- Playback position is remembered locally and resumes on the next visit

## Share links

Every song has a stable link that opens the site cued to it:
`https://tymmop.com/?track=<slug>` where the slug is the title lowercased
with non-alphanumerics turned into dashes. Current slugs:
`sand-drive`, `international-desert-drive`, `99-to-infinity`,
`rooftop-fireworks`, `things-just-r`.

The address bar always tracks the current song, so copying the URL (or
using the browser's share button on a phone) shares the right track.

## Analytics (Umami Cloud)

Page views, visitors, and referrers are automatic. Custom events:

| Event | Fires when | Properties |
| --- | --- | --- |
| `track-play` | a song starts (once per song; resumes don't double-count) | `title` |
| `track-complete` | a song plays to the end | `title` |
| `track-skip` | the listener jumps away mid-song | `title`, `at` (seconds) |
| `track-link-open` | a visitor arrives via a share link (once per session) | `title` |
| `link-click` | a corner-nav artist link is clicked | `label` |

In the Umami dashboard, open an event and view its property breakdown
(e.g. `title`) to see per-song numbers — plays vs completes vs skips is
effectively a per-song retention report.

## Deploying

Cloudflare Pages builds from this repo: pushes to `main` deploy
production, other branches get preview URLs (no build command — the repo
root is served as-is).

Current state of the takeover:

- `tymmop.com` still points at the previous deployment; switch it to this
  Pages project in the Cloudflare dashboard when ready.
- Audio streams from the `media.tymmop.com` R2 bucket.
