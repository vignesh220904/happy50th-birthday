# Happy 50th Birthday, Amma — M. Buvaneswari

A landscape, projector-first birthday presentation for **M. Buvaneswari (Buvana / Amma)**,
born 27 October 1976, celebrated on **27 October 2026** at
**Palmshore Restaurant, Ekkatuthangal, Chennai**.

Plain HTML, CSS and JavaScript modules. There's no framework and no build step.
Fonts and all media are local, so it works **offline at the venue**.
Every page sits on the same royal-blue background (deep, medium and soft blues with a little cyan light),
with ivory words and champagne-gold decorations.

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
   On every other page a few clear controls stay on screen: **Full screen / Normal screen** on the left;
   ❚❚ / ▶ (pause), **‹ Back**, the page name (click it for the list of pages) and **Next ›** on the right.
   Only the mouse pointer hides when it rests; **H** hides or shows the controls by hand.
3. When Amma is ready, press **Begin the Celebration** (or →, Space, Enter, or a presentation clicker).
   The music starts, the browser goes full screen, and the presentation runs **by itself**
   from there to the final gift: the films and the family's video wishes start on their own, one at a time,
   and when a film ends the presentation moves on. Photo slideshows move briskly (about 4½ s for a new milestone,
   3½ s for its other photos).
   **Under every video the music goes soft:** while a film or family wish plays it fades down to about 12 % of its
   normal volume and keeps playing underneath (the videos' own sound is untouched). It stays soft from one wish to the
   next and comes back up when the videos end. If you switch it off with **M**, it stays off.
4. Every video page first shows its **introduction** — the title and the film's first picture, with a golden line
   filling along the top of the screen — for **10 seconds** (Age 1 to 50 — Her Story, Our Memory Film) or about
   **7 seconds** (Messages Filled With Love). Then the video plays by itself (also when the automatic presentation is paused).
   The video fills the screen with just three buttons at the bottom: **‹ Back**, **Full screen / Normal screen** and **Next ›**
   (among the wishes, Back and Next move between the messages first, then to the previous / next page).
   The first **Esc** leaves the browser's full screen; the next **Esc** closes the video and pauses it.
5. If a browser refuses to start a film with sound by itself, the film shows **Press Play to start** and the
   presentation waits; it never skips the film or pretends it is playing. Press the large ▶ once and it continues.
   If full screen was refused, the ⛶ button in the film's bar glows: press it.
   If a video cannot be played or stays stuck loading, it is first loaded once more by itself from a fresh copy;
   if that fails too, the screen says **This video could not be played** with **Retry** and **Skip** (nothing is
   skipped silently). In the automatic presentation it also says when it will move on (after 15 s).
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
| 3 | **Age 1 to 50 — Her Story** | The family's story film of her life, from her birth to fifty (the original is named `VIDEOS/age 1 to 5 story video.mp4`; 6 min 54 s). 10 s introduction, then the film |
| 4 | **A Journey Through Time** · 1976 – 2005 | An automatic slideshow of the family's photographs, one at a time, never cropped, with the year, title and caption and a year rail |
| 5 | **Proud Moments** · 2006 – 2026 | The same slideshow for the later milestones |
| 6 | **50 Reasons We Love You** | The family's five groups of ten, each as a floating cloud of bubbles that appear one by one. All 50 reasons, word for word, each once |
| 7 | **Our Memory Film** | The family's memories film (6 min 23 s). 10 s introduction, then the film |
| 8 | **Messages Filled With Love** | About 7 s introduction, then the family's 34 video wishes, one at a time, each to its end, in their numbered order (see below) |
| 9 | **Her Life Journey** | The family's Life Journey video (`VIDEOS/updated/LIFE JOURNEY-update.mp4`, 1 min 31 s), after all the wishes; its title shows for 3 s, then it plays |
| 10 | **Happy Birthday, Amma** | The birthday cake: ivory tiers, gold bands, royal-blue swags and a golden 50; five candles light one by one. *Make a Wish* blows them out |
| Final | **A Final Gift of Love** | (not counted: the controls say *Final*, not "11 of 10") An ivory-and-gold gift in the middle of the screen floats and glows, wiggles, and its lid swings off; a golden light pours out and a golden **50** rises from the box with gold sparkles and confetti. Then the gift moves aside and the family's closing words, her name, date and venue appear. The scene stays (nothing starts over by itself). **Replay** opens the gift again; **Start Again** returns to the welcome |

Every film opens in the full-screen theatre (Back, Replay, full screen). A film whose prepared copy is missing is left out, never replaced.

**Removed at the family's request:** the separate **Age 1 to 50 – Real Journey** video (its web copy stays in
`assets/videos/family/`; to bring it back, set `"inPresentation": true` on `ageFilm` in `data/site.json`, and it plays
after the video wishes), the separate Family Photo Gallery
(its photographs stay in `Memory gallery/` and in the manifest), the "All 50 Reasons" tab, the numbered 50-gift tracker on the
last page, the photo collage and "Explore Memories" button on the welcome, the loading screen, the Childhood film and the
synthesised "Happy Birthday" tune.

**1996 (M.Com):** there is no family photograph of this year yet. The slide shows an **illustration** of a 1990s Indian college
(`assets/illustrations/college_1996.jpg`: a red-brick college with ivory arches and a clock tower, a gulmohar tree and bicycles;
no people, no names, no text), with the site's *Illustration* label, so it is never taken for a photograph of her.
**Fifty (27 October 2026):** Amma's own photographs — the approved portrait (`Age 1 to 50/46.1.jpg`) and `Age 1 to 50/49.jpg`.

---

## Media still needed from the family

| What | Where it goes | Then |
|------|---------------|------|
| Names for the wishes, if the family wants captions | Rename the files, e.g. `03 - Vikky.mp4` | `npm run build:wishes` |
| Any **further family wishes** | `family wishes updated video/`, named by number (`31.mp4` … or `03 - Vikky.mp4`) | `npm run build:wishes`. The page plays every confirmed wish in order after its introduction |
| A photograph for **1996 – 1997 (M.Com, first year)**, if the family has one (optional: an illustration stands in) | `Final Life Journey/` | `npm run build:media`, then put its id first in the `mcom` milestone's `media` in `data/timeline.json` (or replace the illustration) |

### The family's videos

| Folder | | Command |
|------|---|---|
| `VIDEOS/` | the films: `age 1 to 5 story video.mp4` (shown as *Age 1 to 50 — Her Story*), and the updated `updated/AGE 1 TO 50 - real video-update.mp4` and `updated/LIFE JOURNEY-update.mp4` (both left out of the presentation) | `npm run build:films` → `assets/videos/family/` |
| `family wishes updated video/` | the family's 34 wishes, numbered 1 – 30: `1.mp4` … `30.mp4`, with two files for 13 (`13`, `13(1)`), 15 (`15`, `15 a.MOV`), 16 (`16`, `16(1)`) and 17 (`17 - a`, `17 - b`), and `27-002.mp4` for 27 | `npm run build:wishes` → `assets/videos/wishes/` + `data/wishes.json` |
| `Family video wishes/` | the earlier set of wishes (no longer used; kept as the family sent it) | – |

Both scripts check that every original can be decoded and report any that can't (they are left out, never replaced).
Films that are already browser-ready are copied as they are; everything else becomes MP4 (H.264 + AAC), at most 1920 px,
each under 95 MB so it can go to GitHub. HDR phone videos are tone-mapped so they don't look washed out.
The originals are never changed.

`build:wishes` reads the folder named in `data/wishes.json` → `source`, sorts by the number in the filename (2 before 10;
for a number with two files, the plain one first: `13`, `13(1)`; `15`, `15 a`; `17 - a`, `17 - b`) and names a wish after the text
following the number ("03 - Vikky.mp4" → *From Vikky*); files without a name (e.g. "03.mp4", "13(1).mp4", "27-002.mp4")
get no caption, so nothing on screen is a guess. It reports missing numbers, duplicates, files it cannot decode and a
count that differs from the family's. `data/wishes.json` → `films` can place one of the family's films among the wishes
(empty now: Her Life Journey has its own page, step 9).

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
`assets/audio/music.mp3`: *Happy Birthday Songs – 1 Hour Non-Stop Celebration*, supplied by the family. It starts with
**Begin the Celebration** (or M) and loops, at `music.volume` (0.4) on ordinary pages. **Under every video it goes soft**:
one controller (`js/core/audio.js`) fades it down to `music.videoLevel` (0.12, i.e. 12 % of normal) while any video plays (it
listens to the videos' own play / playing / pause / ended / error events), keeps it soft from one wish to the next, and brings
it back up when the video ends or pauses, or if a video cannot be played. It keeps playing underneath (never muted or
restarted), and the videos' own sound is left as it is. M switches it off and on, and nothing else turns it back on.
The credit is shown on the final page.
To change the track, put an MP3 you have permission to use in `assets/audio/`, then set `music.src`, `music.title` and `music.credit`
in `data/site.json`. (`canon-in-d-major.mp3`, the earlier instrumental, is still in the folder but no longer used.)

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
js/sections/          one module per page (welcome, reveal, story-film (+ age-film, journey-film: switched off) → family-film → cinema,
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
npm test              # content + assets: the 50 reasons word for word, milestones (1996 illustration, Fifty photos),
                      # the films and their titles, wishes order and confirmation, file sizes, intro delays,
                      # the blue theme, the gift animation, removed features
npm run test:browser  # headless Chrome/Edge: 6 screen sizes, Begin + the automatic presentation end to end
                      # (10 s / 7 s introductions, films start once and move on, wishes one by one, cake, gift),
                      # music never heard under a playing video, blocked autoplay, keys/clicker, slideshows,
                      # reasons cloud, full-screen films, the gift opening and Replay
```

`test:browser` uses the installed Chrome or Edge (set `CHROME_PATH` if needed) and `puppeteer-core` (`npm install` once).
Set `SMOKE_SHOTS=some/folder` to save screenshots of every scene.

---

## Deploying

Upload `index.html  pages/  css/  js/  data/  assets/` to any static host. All URLs are relative, and there is no build step.
`assets/videos/happy 50th birthday.mp4` (283 MB, HEVC) is the original of the memories film and is not needed online.
The original photo folders (~935 MB), `VIDEOS/`, `family wishes updated video/` and `Family video wishes/` are source files only.

**Vercel:** framework preset "Other", no build command, output directory = the project root. `vercel.json` lets browsers keep
photos, films and music for a week (so nothing downloads twice), while the code and styles (`js/`, `css/`) are checked
for updates on every visit. The family's wishes are asked for with their fingerprint (`…mp4?v=<rev>`, from
`data/wishes.json`), so a wish replaced under the same file name is never played from an old copy in a browser's cache.
Other files replaced under the same name may show the old version until a visitor's copy expires (Ctrl + F5 fetches the new one). `.vercelignore` keeps the
source folders out of a `vercel deploy` upload. Every file the site serves is under 100 MB, so it can also deploy from GitHub
(`VIDEOS/`, `family wishes updated video/` and `Family video wishes/` are git-ignored). Online, the films stream from the start (their index is at the front),
but the venue's internet decides how smoothly they play; the local copy (`Open Birthday Site.bat`) is the safest at the venue.
