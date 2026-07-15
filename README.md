# newtxb

🏚 A minimal, self-contained new tab page → **[newtxb.github.io](https://newtxb.github.io)**

No framework, no build step, no tracking. One HTML file, one stylesheet, one script — served from GitHub Pages and cached by a service worker so it opens instantly, even offline.

## Features

### 🔍 Search
- **Type anywhere** to start searching — the input grabs focus automatically (paste works too).
- **Google autocomplete** suggestions with favicons, keyboard navigation (`↑`/`↓`), and bolded completions.
- **URL detection**: type something that looks like a URL and it navigates directly instead of searching.
- **Ask ChatGPT** instead: `Tab` to the ChatGPT button (or click it), then `Enter`.
- `Shift`/`⌘` + `Enter` opens results in a new tab; `Esc` cancels and clears.

### 🕐 Clock & calendar
- Large clock with a personalized greeting (set your name in settings, or enjoy the daily teddy bear `ʕ•ᴥ•ʔ`).
- Hover the clock to reveal seconds; hover the seconds to reveal milliseconds.
- Hover the date (bottom left) for a month calendar with navigation and **French public holidays** highlighted.

### 🌤 Weather
- Current conditions, detailed metrics (rain, humidity, wind, UV, sunrise/sunset, moon phase), and a 3-day forecast with temperature curves — hover the weather (bottom right).
- Powered by [wttr.in](https://wttr.in), auto-located by IP or pinned to a custom location in settings.
- Forecasts are cached for 15 minutes in `localStorage` and refreshed automatically while the tab stays open (the previous forecast is kept on screen until a refresh succeeds).

### 💬 Quote of the day
- A short quote from the [dwyl/quotes](https://github.com/dwyl/quotes) collection, refreshed every 12 hours (even while the tab stays open). Hover to reveal the author.

### 🖼 Backgrounds
- **Default**: an animated radial gradient that slowly cycles through hues, with floating particles.
- **Unsplash mode** (optional): a new photo every day, picked from your own comma-separated search keywords. The photo's average color becomes the page theme color, image details are shown behind the ✨ button (with a link back to Unsplash and a "reload today's photo" action), and recently shown photos are blacklisted (last 30) to avoid repeats.

### ⚙️ Settings
Click the gear (top right) to toggle the date / quote / weather rows, set your username and weather location, and manage Unsplash mode. Everything is stored locally in `localStorage`.

### 📦 Offline & updates
- A service worker precaches the app shell (cache-first), so new tabs open instantly with no network.
- The current Unsplash photo is also cached for offline use (only one image kept at a time).
- On load and every 30 minutes while the tab is open, the app compares the deployed version in [`github.json`](github.json) (filled by Jekyll with the GitHub Pages build revision) against the local one; when it changes, caches are refreshed and an update notification appears.

## Project layout

```
├── index.html          # All markup: search, clock, settings modal, notification, panels
├── assets/
│   ├── main.js         # All logic, organized as independent IIFE modules
│   ├── main.css        # All styles
│   └── favicon.png
├── service-worker.js   # Precache app shell + daily Unsplash image cache
└── github.json         # Jekyll template → exposes the Pages build revision as version
```

`main.js` is intentionally a single file split into self-contained sections, each an async IIFE:

| Module | Role |
|---|---|
| Utilities | Color math (hex/HSL/luma), keyword parsing, `CryptoUtils` (AES-GCM decrypt) |
| PhotoBlacklist | Rolling list of the last 30 shown Unsplash photo IDs |
| UnsplashBg | Daily photo fetch, preload, theme-color extraction, caching |
| Updater | Version check against `github.json`, cache refresh, update toast |
| Settings | Modal, persistence, and `settings:*` events other modules listen to |
| Background | Animated gradient loop ↔ Unsplash mode switching |
| Unsplash badge | The ✨ image-details panel |
| Particles | Floating background particles (gradient mode only) |
| Clock & date | Clock, greeting, calendar with French holidays (computed, incl. Easter-based ones) |
| Search | Focus handling, Google JSONP suggestions, URL detection, ChatGPT hand-off |
| Weather | wttr.in fetch, normalization, forecast panel rendering |
| Quote | Quote of the day fetch & cache |

Modules communicate via `document` custom events (`settings:usernameChanged`, `unsplash:modeChanged`, …) and a single read-only accessor `window.homeSettings.get()` — there is no shared mutable state.

## Storage

Everything lives in `localStorage` (plus the two service-worker caches `precache-v1` and `unsplash-daily-v1`):

| Key | Content | Lifetime |
|---|---|---|
| `home-settings` | All user settings (incl. unlocked Unsplash access key) | Permanent |
| `current-version` | Last seen deploy revision | Permanent |
| `quote-of-the-day` | Cached quote | 12 h |
| `weather-forecast-v2:<location>` | Cached forecast per location | 15 min |
| `unsplash-bg-<date>` | Today's photo URL, info & theme color | 1 day (older entries purged) |
| `unsplash-photo-blacklist` | Last 30 photo IDs | Rolling |
| `unsplash-theme-color` | Last extracted theme color (applied instantly on load) | Permanent |

## External services

The page itself is fully static; at runtime it may talk to:

- `www.google.com` — search form target, autocomplete suggestions (JSONP), favicons (`s2/favicons`)
- `chatgpt.com` — only when you explicitly ask ChatGPT
- `wttr.in` — weather (geolocated by IP unless a location is set)
- `raw.githubusercontent.com` — quote list
- `api.unsplash.com` / `images.unsplash.com` — only when Unsplash mode is unlocked and enabled

No analytics, no cookies, `referrer: no-referrer`.

## Development

There is no build step. Serve the folder and open it:

```sh
python3 -m http.server 8000
# → http://localhost:8000
```

The service worker deliberately does **not** register on `localhost`, so you always get fresh files while developing.

Notes:
- `github.json` contains Jekyll front matter and is only rendered on GitHub Pages; locally the update check just fails silently.
- Unsplash mode requires unlocking the encrypted credentials with the password (settings → "Use Unsplash backgrounds").

## Deployment

Push to `master`. GitHub Pages builds the site with Jekyll, which stamps `site.github.build_revision` into `github.json`; already-open clients detect the new revision, refresh their caches, and show the update toast.
