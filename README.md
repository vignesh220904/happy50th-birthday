# Happy 50th Birthday, Amma — M. Buvaneswari

A landscape, projector-first birthday presentation for **M. Buvaneswari (Buvana / Amma)**,
born 27 October 1976, celebrated on **27 October 2026** at
**Palmshore Restaurant, Ekkatuthangal, Chennai**.

Plain HTML, CSS and JavaScript modules. There's no framework and no build step.
Fonts, Three.js (r160) and all media are local, so it works **offline at the venue**.

---

## Run it

**Easiest (Windows):** double-click **`Open Birthday Site.bat`**. It starts a small local server and opens the browser.
Keep that window open while presenting.

Or from a terminal in this folder:

```bash
npm start            # opens http://localhost:8080 (uses 8081, 8082 … if 8080 is busy)
```

If Node isn't installed, any static server works, for example `python -m http.server 8080`.
Double-clicking `index.html` does **not** work (browsers block the site's data from `file://`); the page explains this.

---

## At the venue

1. Connect the laptop to the projector and open the site. Press **F** (or the ⛶ button) for full screen.
2. The **Welcome** screen appears by itself. It is the idle screen while guests arrive and needs no clicks.
   The controls fade away when the mouse rests and come back as soon as it moves.
3. When Amma is ready, press **→**, **Space**, or **Next** (or a presentation clicker) for the **birthday reveal**.
4. Press the **♫** button (or **M**) whenever you want the music. It never starts by itself.
   It fades out while a video plays and returns afterwards.

A refresh, or opening the site again, always starts at the Welcome screen.

| Keys | |
|------|---|
| → · Space · Enter · PageDown | Next (presentation clickers work too) |
| ← · Backspace · PageUp | Previous |
| Home / End | First / last scene |
| 1 – 9 | Jump to a scene |
| G | Section list |
| M | Music on / off |
| F | Full screen |
| H | Hide / show the controls |

Inside a video player, the arrow keys and Space control the video, so the presentation never moves by accident.
Press **Esc** to leave the player and then → to continue. A clicker's PageDown still moves on.
When a film ends, a **Continue** button appears on the screen. Nothing advances on its own.

---

## The running order

| # | Scene | What it shows |
|---|-------|---------------|
| 1 | **Welcome** (default) | *Celebrating the Beautiful Journey of Buvaneswari*, *50 Years of Love, Strength & Beautiful Memories*, 27 October 1976 – 27 October 2026, beside a layered 3D composition of real family photographs and a silver-blue "50" |
| 2 | **Birthday reveal** | HAPPY 50TH BIRTHDAY / AMMA / M. BUVANESWARI, beside Amma's photograph in a pearl arch frame (confetti on entry) |
| 3 | **Life Journey film** | The family's Life Journey video (placeholder until it is added; see below) |
| 4 | **Her Life Journey** | 27 milestones on 6 landscape era pages. Next moves through the eras; tap a card for its photos |
| 5 | **50 Reasons We Love You** | Pick a category and all ten reasons appear together. Next moves through the five categories, then **All 50 Reasons** |
| 6 | **Family Memories film** | The family's memories film (6 min 23 s), with a button to the photographs when it ends |
| 7 | **Family Photo Gallery** | 222 dated photographs by year, a page at a time, with a full-screen **Slideshow** |
| 8 | **Family Wishes** | The family members' wishes video (placeholder until it is added) |
| 9 | **50 Gifts Celebration** | The final greeting, her name, the date and venue, a 3D gift in a ring of 50 gifts, and the gift-distribution tracker |

**Gift tracker:** tap a gift to mark it as given (tap again to undo). The counter shows *N / 50 gifts given*.
**Mark all given** and **Reset** ask for a second click to confirm.
Marks are remembered on this computer, so a refresh during the event keeps them.
Nothing shows as given unless the host marks it. Gift names from `data/gifts.json` appear when filled in.

**What was removed at the family's request:** the opening title card, the *Watch the Birthday Film* button and card,
the internally generated Life Journey film, and the unfinished *Age 1 to 50* transformation film.
Their files remain in git history. The `Age 1 to 50` photo folder is untouched.

**Undated photographs:** the gallery shows only photos whose date is recorded in the photo itself
(camera data, or the camera's own file name). The 51 scanned prints and 11 photos without a recorded date
stay in `Memory gallery/` but are not shown, so no date on screen is a guess.

---

## Media still needed from the family

| File to add | Shown in | Configured in |
|-------------|----------|---------------|
| `assets/videos/family/life-journey.mp4` | Scene 3, Life Journey film | `data/site.json` → `videos.lifeJourney.src` |
| `assets/videos/family/family-wishes.mp4` | Scene 8, Family Wishes | `data/wishes.json` → `videos[0].src` |

Save the file with exactly that name and it replaces the placeholder automatically. No code changes are needed.
Use MP4 (H.264 video, AAC audio). Phone videos (HEVC) may need converting; see `assets/videos/family/README.txt`.

The shared *Life Journey* Google Drive folder contains only photographs (the `Final Life Journey` images and the year-labelled originals),
so no Life Journey video could be integrated yet.

The *Memory gallery* Drive folder's video (`101901_1792393489053.mp4`, 282,682,775 bytes) is byte-for-byte the film already in this project
(`assets/videos/happy 50th birthday.mp4`). Its browser-ready copy, `assets/media/films/family-memories.mp4`, opens the Family Album.

---

## Editing content (no code needed)

All family-specific content lives in `data/`:

| File | Contents |
|------|----------|
| `site.json` | Name, dates, venue; welcome and reveal text; Amma's reveal photo (`reveal.photo`); welcome photos; video paths; final greeting; music |
| `timeline.json` | Life-journey milestones: year, title, caption, photo ids and alt text |
| `reasons.json` | The 50 reasons, exactly as written, the 5 categories and the closing line |
| `gifts.json` | 50 gift slots: fill in `name` / `from` / `note` if you want names on the gifts |
| `wishes.json` | Family wishes videos and the placeholder line |
| `photo_inventory.json` | **Generated** media manifest. Don't edit by hand |

### Music
`assets/audio/canon-in-d-major.mp3`: *Canon in D Major* by Kevin MacLeod (incompetech.com),
licensed under Creative Commons: By Attribution 3.0 (via Wikimedia Commons). The credit is shown on the final scene.
To change the track, put an MP3 in `assets/audio/`, then set `music.src`, `music.title` and `music.credit` in `data/site.json`.
`music.volume` (0–1) sets the level. The default is 0.4.

### Adding photos
1. Drop photos into `Final Life Journey/`, `Age 1 to 50/` (named by age: `34.jpg`, `34 (2).jpg` …) or `Memory gallery/`.
2. Run `npm run build:media` (Python with `pip install pillow pillow-heif opencv-python imageio-ffmpeg`).
   This writes web-sized WebP copies to `assets/media/` and refreshes the manifest. Originals are never changed.

---

## Project structure

```text
index.html            the presentation: one <section class="scene"> per screen
pages/                short links (pages/reasons.html → index.html#reasons)
css/                  fonts · variables (palette, 16:9 sizing) · global · deck · components · scenes
js/app.js             loads data, mounts the scenes in running order
js/core/deck.js       the presentation controller: scene registry, Next/Previous, keys, menu, idle controls
js/core/              data, audio, player, lightbox, confetti, particles, utilities
js/sections/          one module per scene (welcome, reveal, journey-film, journey, reasons, memories, gallery, wishes, finale)
js/three/             WebGL stage + the 3D gift scene
assets/media/         web images + the memories film
assets/videos/family/ the family's Life Journey and Wishes videos go here
assets/audio/         background music
assets/fonts/         Cormorant Garamond + Manrope (SIL Open Font License)
scripts/              build_media.py · build_pages.py · serve.mjs · verify.mjs · smoke.mjs
```

Layout: the design is a 16:9 frame (1920 × 1080). All sizes use a unit, `--u`, equal to 1% of the largest 16:9 frame that fits the screen,
so 1920 × 1080, 1600 × 900, 1366 × 768 and 1280 × 720 all show the same composition. Content keeps inside safe margins against projector overscan.
Phones and portrait screens get a stacked layout that scrolls within each scene.

---

## Tests

```bash
npm test              # content + assets: the 50 reasons word for word, milestones, files, removed features
npm run test:browser  # headless Chrome/Edge: 6 screen sizes, navigation, reasons, gallery, videos, gifts, music
```

`test:browser` uses the installed Chrome or Edge (set `CHROME_PATH` if needed) and `puppeteer-core` (`npm install` once).
Set `SMOKE_SHOTS=some/folder` to save screenshots of every scene.

---

## Deploying

Upload `index.html  pages/  css/  js/  data/  assets/` to any static host. All URLs are relative.
`assets/videos/happy 50th birthday.mp4` (283 MB, HEVC) is the original of the memories film and is not needed online.
The original photo folders (~935 MB) are source files only.
