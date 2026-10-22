# 50 Years of Love — M. Buvaneswari

A cinematic, interactive birthday gift for **M. Buvaneswari (Buvana / Amma)**,
born 27 October 1976, celebrated on **27 October 2026** at
**Palmshore Restaurant, Ekkatuthangal, Chennai**.

Plain HTML, CSS and JavaScript modules. There's no framework and no build step to view it.
Real-time 3D uses **Three.js r160**, vendored in `js/vendor/` so the site works offline at the venue.

---

## Run it locally

**Easiest (Windows):** double-click **`Open Birthday Site.bat`**. It starts a small local server and opens the browser.
Keep that window open while viewing.

Or from a terminal in this folder:

```bash
npm start            # opens http://localhost:8080 (uses 8081, 8082 … if 8080 is busy)
```

If Node isn't installed, any static server works, for example `python -m http.server 8080`.
Double-clicking `index.html` does **not** work: browsers block the site's data when a file is opened from disk.
If someone does that, the page explains what to do instead of staying blank.

**What guests see first:** an opening title card. The years count from 1976 to 2026 while the site loads.
Then a 3D "50" turns into view with *Happy 50th Birthday, Amma*. **Begin the celebration** starts the music and confetti.
Links straight to a chapter, such as `index.html#memories`, skip the opening.

**At the venue:** press **P** (or the screen button) for presentation mode, which is full screen with no menu.
The Life Journey and Age 1 to 50 chapters each have a **Play** button for hands-free viewing.

---

## The seven chapters

| # | Chapter | What it is | 3D |
|---|---------|------------|----|
| – | **Opening** | Loading count 1976 → 2026, then *Happy 50th Birthday, Amma* and *Begin the celebration* | CSS 3D extruded "50", rising sparks |
| I | **Welcome** | "50 Years of Love" hero. *Begin Her Beautiful Journey* glides into the journey, and *Watch the Birthday Film* opens the family film | **WebGL**: a "50" made of ~4,000 light particles in a tilted wreath of real family photos, with light streaks and dust |
| II | **Her Life Journey 1976–2026** | 27 milestones with a milestone rail, previous/next, ← → Home End keys, swipe, autoplay, and the family's *Life Journey* film | **WebGL**: the camera flies along a glowing river of time past each milestone's photos (click a photo to enlarge) |
| III | **50 Reasons We Love You** | 5 chapters × 10 reasons: tabs, a reading card, number chips, and *Read all 50* | **WebGL**: a constellation of 50 selectable lights |
| IV | **Key Memories** | All 284 photos from `Memory gallery`, grouped by year, with filters and a full-screen lightbox (keyboard, swipe) | CSS depth on hover |
| V | **Family Wishes** | Theatre-style video player with playlist. Shows *"Beautiful words … are on their way."* until videos are added | – |
| VI | **Age 1 to 50** | Every photo in `Age 1 to 50`, in age order, with play/pause/replay, an age ruler, the ending card, and the family's *Age* film | CSS 3D reel: the current photo in front, other years fanned out in depth |
| VII | **The Celebration** | Open the gift; **the Birthday Film** (*Fifty & Fabulous*, 6 min 23 s); 50 configurable gift slots; final greeting; date, venue and countdown; *Replay her journey* | **WebGL**: royal-blue gift with silver ribbons and a ring of 50 small gifts |

Each chapter also works on its own page: `pages/welcome.html`, `journey.html`, `reasons.html`,
`memories.html`, `wishes.html`, `age-transition.html` and `finale.html`.

### Authentic photos vs. illustrations
Anything that is not an original photograph carries an **"Illustration"** label on the site and in the photo viewer:
the school-uniform scene, the 1997 bikes (no original photo exists), the births of Vikky and Varshu, and the MBA desk.
The Life Journey and Age films are labelled **"AI-animated family film"**. The Birthday Film is labelled **"Family film"**.

### Films
| Film | Source | Shown in |
|------|--------|----------|
| The Birthday Film | `assets/videos/happy 50th birthday.mp4` (HEVC, 283 MB) → web copy `assets/media/films/happy-50th-birthday.mp4` (H.264, 68 MB) | Welcome button, Celebration chapter |
| The Life Journey Film | `assets/videos/life journey.mp4` | Life Journey chapter |
| The Age 1 to 50 Film | `assets/videos/age.mp4` | Age 1 to 50 chapter |

Many browsers can't play HEVC, so `npm run build:media` converts films that need it. Use
`python scripts/build_media.py --films-only` to refresh just the films. It needs `pip install imageio-ffmpeg`.

---

## Editing content (no code needed)

All family-specific content lives in `data/`:

| File | Contents |
|------|----------|
| `site.json` | Name, dates, venue, welcome text, final greeting, film titles, music setting, hero photos |
| `timeline.json` | Life-journey milestones: year, title, caption, photo ids and alt text |
| `reasons.json` | The 50 reasons, exactly as written, plus the 5 chapter groupings and the closing line |
| `gifts.json` | 50 gift slots. Fill in `name` / `from` / `note`, and set `given: true` only once a gift has been given |
| `wishes.json` | Family wishes videos (empty for now) |
| `photo_inventory.json` | **Generated** media manifest. Don't edit by hand |

### Adding photos
1. Drop photos into the source folder:
   - **Age 1 to 50**: name files by age: `34.jpg`, `34 (2).jpg`, `34.1.jpg` …
   - **Memory gallery**: any name. Dates come from the camera data or the filename.
   - **Final Life Journey**: numbered in story order. Then add the new id (for example `lj-30`) to a milestone in `timeline.json`.
2. Run `npm run build:media` (Python with `pip install pillow pillow-heif opencv-python`).
   This writes web-sized WebP copies to `assets/media/` and refreshes the manifest. Originals are never changed.
   HEIC photos are converted automatically.

### Adding family wishes videos
Put MP4 files (H.264 / AAC) in `assets/videos/wishes/` and add entries to `data/wishes.json`:

```json
{ "id": "wish-1", "title": "From Vikky", "from": "Vikky",
  "src": "assets/videos/wishes/vikky.mp4", "poster": "assets/videos/wishes/vikky.jpg", "captions": "" }
```

`poster` (an image) and `captions` (a `.vtt` file) are optional. With two or more videos, a playlist appears.

### Music
The site plays a soft music box generated in the browser: Happy Birthday, then a gentle loop.
It starts only after someone presses *Begin*, and the ♫ button toggles it.
To use a real track, put an MP3 in `assets/audio/` and set `music.src` in `site.json`.

---

## Project structure

```text
index.html            all seven chapters
pages/                standalone chapter pages (generated: npm run build:pages)
css/                  variables · global · components · chapters · animations
js/app.js             entry point: loads data, mounts chapters
js/core/              data, nav, audio, confetti, lightbox, player, utilities
js/sections/          one module per chapter
js/three/             stage lifecycle + hero, constellation and gift scenes
js/vendor/            three.module.min.js (r160, MIT)
data/                 content (see above)
assets/media/         generated web images + film posters
assets/videos/        the family films (life journey.mp4, age.mp4); wishes videos go in wishes/
assets/illustrations/ illustrations (source files)
Final Life Journey/ · Age 1 to 50/ · Memory gallery/   original photos (never modified)
scripts/              build_media.py · build_pages.py · serve.mjs · verify.mjs · smoke.mjs
tests/fixtures/       the 50 reasons, word for word, used by the tests
```

Performance: Three.js loads only when a 3D chapter approaches the screen. Render loops pause off-screen and in background tabs.
Pixel ratio is capped and particle counts drop on phones. Images are lazy-loaded WebP at two sizes.
Full-size photos load only in the viewer. With *reduce motion* turned on, all drifting, parallax and confetti stop.
Without WebGL, every chapter falls back to a CSS version.

---

## Tests

```bash
npm test              # content + assets: 50 reasons word for word, milestones, every file reference
npm run test:browser  # headless Chrome/Edge: 5 screen sizes, all interactions, reduced motion, no-WebGL
```

`test:browser` uses the installed Chrome or Edge (set `CHROME_PATH` if needed) and `puppeteer-core`
(`npm install` once). Set `SMOKE_SHOTS=some/folder` to save screenshots.

---

## Deploying

Upload these to any static host (Netlify, Vercel, GitHub Pages, S3 …), about 205 MB:

```
index.html  pages/  css/  js/  data/  assets/media/  assets/videos/age.mp4  assets/videos/life journey.mp4
```

`assets/videos/happy 50th birthday.mp4` (283 MB) is the HEVC original. The site plays the converted copy in `assets/media/films/`.

The original photo folders (~935 MB) and `assets/illustrations/` are **source files only**. The site never loads them.
All URLs are relative, so the site works from any sub-folder.

---

## Still needed from the family

- **Family wishes videos.** See *Adding family wishes videos*.
- **Gift names** for the 50 gifts (optional), in `data/gifts.json`.
- **Photos for the missing ages.** 26 of 50 ages have photos: 1, 5, 10, 15, 17, 21, 22, 28–30, 34–49.
- **Please confirm the wording** of three milestones that came from short family labels:
  "Dilli 50th Birthday" (2021), "DB 25th wedding anniversary" (2022), "VK seemandham" (2026).
  The `needsConfirmation` notes in `timeline.json` point to them.
- Optional: a music track (see *Music*).
