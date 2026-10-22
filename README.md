# Happy 50th Birthday, Amma — M. Buvaneswari

A landscape, projector-first birthday presentation for **M. Buvaneswari (Buvana / Amma)**,
born 27 October 1976, celebrated on **27 October 2026** at
**Palmshore Restaurant, Ekkatuthangal, Chennai**.

Plain HTML, CSS and JavaScript modules. There's no framework and no build step.
Fonts and all media are local, so it works **offline at the venue**.

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
2. **A Golden Beginning** appears by itself. It is the idle screen while guests arrive and needs no clicks.
   On every other page **‹ Back**, **Next ›** and **Full screen / Normal screen** stay on screen
   (only the mouse pointer hides when it rests; **H** hides or shows the controls by hand).
3. When Amma is ready, press **Begin the Celebration** (or →, Space, Enter, or a presentation clicker).
   The gentle instrumental music starts, the browser goes full screen, and the presentation runs **by itself**
   from there to the final gift: the films and the family's video wishes start on their own, one at a time,
   and when a film ends the presentation moves on. Photo slideshows move briskly (about 4½ s for a new milestone,
   3½ s for its other photos). The music fades out under every video and returns afterwards.
4. Every video page plays its video by itself when you arrive on it (also when the automatic presentation is paused).
   The video fills the screen with a bar at the bottom: **‹ Back** (previous page), **Close video**, **Replay**,
   **Full screen / Normal screen** and **Next ›** (next page); the wishes add ‹ › for the previous / next message.
   The first **Esc** leaves the browser's full screen; the next **Esc** (or **Close video**) closes the video and pauses it.
5. If a browser refuses to start a film with sound by itself, the film shows **Press Play to start** and the
   presentation waits; it never skips the film or pretends it is playing. Press the large ▶ once and it continues.
   If full screen was refused, the ⛶ button in the film's bar glows: press it.
6. Pause or resume the automatic presentation at any time with the ▶/❚❚ button or **A**.
   Next and Previous always work, by hand, photo by photo. Next never leaves the family's messages
   while one is still playing (Back or Esc first). The presentation stops on the final page; **Start Again**
   returns to the welcome.

A refresh, or opening the site again, always starts at the welcome.

| Keys | |
|------|---|
| → · Space · Enter · PageDown | Next (on the welcome: Begin the Celebration). Presentation clickers work too |
| ← · Backspace · PageUp | Previous |
| A | Pause / resume the automatic presentation |
| Esc | Close the full-screen video |
| Home / End | First / last scene |
| 1 – 9 | Jump to a scene |
| G | Section list |
| M | Music on / off |
| F | Full screen |
| H | Hide / show the controls |

Inside a playing video, the arrow keys and Space control the video. A clicker's PageDown / PageUp still move on:
between the family's video wishes while they play (but not past the last one while it plays), otherwise to the next page.

---

## The running order

| # | Page | What it shows |
|---|------|---------------|
| 1 | **A Golden Beginning** | *Fifty Years. A Thousand Memories. One Beautiful Life.* with the approved lines *Celebrating the Beautiful Journey of Buvaneswari*, *50 Years of Love, Strength & Beautiful Memories*, 27 October 1976 – 27 October 2026, a golden "50" in a laurel wreath, and one button: **Begin the Celebration** |
| 2 | **Happy 50th Birthday** | HAPPY 50TH BIRTHDAY / AMMA / M. BUVANESWARI beside Amma's photograph in the pearl arch frame (the replacement photo the family chose: `Age 1 to 50/46.1.jpg`), with confetti |
| 3 | **Age 1 to 5: Her Story** | The family's story video (`VIDEOS/age 1 to 5 story video.mp4`, 6 min 54 s) |
| 4 | **A Journey Through Time** · 1976 – 2005 | An automatic slideshow of the family's photographs, one at a time, never cropped, with the year, title and caption and a year rail |
| 5 | **Proud Moments** · 2006 – 2026 | The same slideshow for the later milestones |
| 6 | **50 Reasons We Love You** | The family's five groups of ten, each as a floating cloud of bubbles that appear one by one. All 50 reasons, word for word, each once |
| 7 | **Our Memory Film** | The family's memories film (6 min 23 s) |
| 8 | **Messages Filled With Love** | The family's video wishes, played one at a time in their numbered order (see below) |
| 9 | **Age 1 to 50: The Real Journey** | The family's updated real video (`VIDEOS/updated/AGE 1 TO 50 - real video-update.mp4`, 1 min 2 s) |
| 10 | **Her Life Journey** | The family's updated Life Journey video (`VIDEOS/updated/LIFE JOURNEY-update.mp4`, 1 min 31 s) |
| 11 | **Happy Birthday, Amma** | The birthday cake: ivory tiers, gold bands, royal-blue swags and a golden 50; five candles light one by one. *Make a Wish* blows them out |
| 12 | **A Final Gift of Love** | The family's closing words, her name, date and venue, beside an ivory-and-gold gift that opens to a golden "50". **Start Again** returns to the welcome |

Every film opens in the full-screen theatre (Back, Replay, full screen). A film whose prepared copy is missing is left out, never replaced.

**Removed at the family's request:** the separate Family Photo Gallery (its photographs stay in `Memory gallery/` and in the manifest),
the "All 50 Reasons" tab, the numbered 50-gift tracker on the last page, the photo collage and "Explore Memories" button on the welcome,
the loading screen, the Childhood film and the synthesised "Happy Birthday" tune.
The 1996 (M.Com) milestone has no approved photograph yet: its slide is a year card marked *Photograph awaited from the family*.

---

## Media still needed from the family

| What | Where it goes | Then |
|------|---------------|------|
| Confirmation of the **final two** wishes (files `27.mp4` and `28.mp4`) | – | In `data/wishes.json`, set `"confirmed": true` on them (until then they are not shown) |
| Wishes **25** and **26**, if they exist (the folder jumps from 24 to 27) | `Family video wishes/` | `npm run build:wishes` |
| Names for the wishes, if the family wants captions | Rename the files, e.g. `03 - Vikky.mp4` | `npm run build:wishes` |
| A photograph for **1996 – 1997 (M.Com, first year)** | `Final Life Journey/` | `npm run build:media`, then add its id to the `mcom` milestone in `data/timeline.json` and remove `pendingPhoto` |

### The family's videos

| Folder | | Command |
|------|---|---|
| `VIDEOS/` | the films: `age 1 to 5 story video.mp4`, and the updated `updated/AGE 1 TO 50 - real video-update.mp4` and `updated/LIFE JOURNEY-update.mp4` | `npm run build:films` → `assets/videos/family/` |
| `Family video wishes/` | the numbered wishes `1.mp4` … `24.mp4`, `27.mp4`, `28.mp4` | `npm run build:wishes` → `assets/videos/wishes/` + `data/wishes.json` |

Both scripts check that every original can be decoded and report any that can't (they are left out, never replaced).
Films that are already browser-ready are copied as they are; everything else becomes MP4 (H.264 + AAC), at most 1920 px,
each under 95 MB so it can go to GitHub. HDR phone videos are tone-mapped so they don't look washed out.
The originals are never changed.

`build:wishes` sorts by the number in the filename (2 before 10) and names a wish after the text following the number
("03 - Vikky.mp4" → *From Vikky*); files without a name (e.g. "03.mp4") get no caption, so nothing on screen is a guess.
It reports missing numbers, duplicates, files it cannot decode and a count that differs from the family's.

The *Memory gallery* Drive folder's video (`101901_1792393489053.mp4`, 282,682,775 bytes) is byte-for-byte the film in this project
(`assets/videos/happy 50th birthday.mp4`). Its browser-ready copy, `assets/media/films/family-memories.mp4`, is **Our Memory Film**.

---

## Editing content (no code needed)

All family-specific content lives in `data/`:

| File | Contents |
|------|----------|
| `site.json` | Name, dates, venue; welcome and birthday text; Amma's photo (`reveal.photo`); the films' paths and titles; the cake's words; final words; music |
| `timeline.json` | Milestones (year, title, caption, photo ids, alt text) and the two slideshows' year ranges (`chapters`) |
| `reasons.json` | The 50 reasons, exactly as written, the 5 groups and the closing line |
| `wishes.json` | The video wishes, in order (**generated** by `npm run build:wishes`; edit only `confirmed`) |
| `photo_inventory.json` | **Generated** media manifest. Don't edit by hand |

### Music
`assets/audio/canon-in-d-major.mp3`: *Canon in D Major* by Kevin MacLeod (incompetech.com), a gentle instrumental
licensed under Creative Commons: By Attribution 3.0 (via Wikimedia Commons). The credit is shown on the final page.
It starts only with **Begin the Celebration** (or the ♫ button / M), plays softly, and steps aside for every video
(it stays down between two wishes, and between two films that follow each other).
To change the track, put an MP3 you have permission to use in `assets/audio/`, then set `music.src`, `music.title` and `music.credit`
in `data/site.json`. `music.volume` (0–1) sets the level; it is 0.3.

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
js/core/deck.js       the presentation controller: scene registry, Next/Previous, keys, menu, idle controls,
                      and the one timer behind the automatic presentation
js/core/              data, audio, player, confetti, particles, utilities
js/sections/          one module per page (welcome, reveal, story-film + age-film + journey-film → family-film → cinema,
                      journey + proud → timeline-show, reasons, memories + wishes → cinema, cake, finale)
assets/media/         web images + the memories film
assets/videos/        the family's three films (family/) and converted video wishes (wishes/)
assets/audio/         background music
assets/fonts/         Cormorant Garamond + Manrope (SIL Open Font License)
scripts/              build_media.py · build_films.py · build_wishes.py · build_pages.py · serve.mjs · verify.mjs · smoke.mjs
```

Layout: the design is a 16:9 frame (1920 × 1080). All sizes use a unit, `--u`, equal to 1% of the largest 16:9 frame that fits the screen,
so 1920 × 1080, 1600 × 900, 1366 × 768 and 1280 × 720 all show the same composition. Content keeps inside safe margins against projector overscan.
Phones and portrait screens get a stacked layout that scrolls within each scene.

---

## Tests

```bash
npm test              # content + assets: the 50 reasons word for word, milestones, photos, the three films,
                      # wishes order and confirmation, file sizes, slideshow timings, removed features
npm run test:browser  # headless Chrome/Edge: 6 screen sizes, Begin + the automatic presentation end to end
                      # (films start and move on, wishes one by one, cake, gift), blocked autoplay,
                      # keys/clicker, slideshows, reasons cloud, full-screen films, music, the final page
```

`test:browser` uses the installed Chrome or Edge (set `CHROME_PATH` if needed) and `puppeteer-core` (`npm install` once).
Set `SMOKE_SHOTS=some/folder` to save screenshots of every scene.

---

## Deploying

Upload `index.html  pages/  css/  js/  data/  assets/` to any static host. All URLs are relative, and there is no build step.
`assets/videos/happy 50th birthday.mp4` (283 MB, HEVC) is the original of the memories film and is not needed online.
The original photo folders (~935 MB), `VIDEOS/` and `Family video wishes/` are source files only.

**Vercel:** framework preset "Other", no build command, output directory = the project root. `.vercelignore` keeps the
source folders out of a `vercel deploy` upload. Every file the site serves is under 100 MB, so it can also deploy from GitHub
(`VIDEOS/` and `Family video wishes/` are git-ignored). Online, the films stream from the start (their index is at the front),
but the venue's internet decides how smoothly they play; the local copy (`Open Birthday Site.bat`) is the safest at the venue.
