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
   The controls fade away when the mouse rests and come back as soon as it moves.
3. When Amma is ready, press **Begin the Celebration** (or →, Space, Enter, or a presentation clicker).
   The gentle instrumental music starts, and the presentation moves on **by itself**:
   the photo slideshows and the 50 reasons advance at a comfortable pace.
4. **Films and video wishes never start by themselves.** On a film page, press the large ▶ in the middle of the screen
   (or Next / the clicker once). The film opens in full screen with **Back** and **Replay** at the bottom;
   **Esc** or **Back** returns to the page. The music fades out while a video plays and returns afterwards.
   After the film, the presentation continues on its own (or press **Continue**).
5. Pause or resume the automatic presentation at any time with the ▶/❚❚ button or **A**.
   Next and Previous always work, by hand, photo by photo.

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
between the family's video wishes while they play, otherwise to the next page.

---

## The running order

| # | Page | What it shows |
|---|------|---------------|
| 1 | **A Golden Beginning** | *Fifty Years. A Thousand Memories. One Beautiful Life.* with the approved lines *Celebrating the Beautiful Journey of Buvaneswari*, *50 Years of Love, Strength & Beautiful Memories*, 27 October 1976 – 27 October 2026, a golden "50" in a laurel wreath, and one button: **Begin the Celebration** |
| 2 | **Happy 50th Birthday** | HAPPY 50TH BIRTHDAY / AMMA / M. BUVANESWARI beside Amma's photograph in the pearl arch frame (the replacement photo the family chose: `Age 1 to 50/46.1.jpg`), with confetti |
| – | **Her Life Journey Film** | Only once the family's own Life Journey video is added (see below). Left out until then |
| 3 | **A Journey Through Time** · 1976 – 2005 | An automatic slideshow of the family's photographs, one at a time, never cropped, with the year, title and caption and a year rail |
| 4 | **Proud Moments** · 2006 – 2026 | The same slideshow for the later milestones |
| 5 | **50 Reasons We Love You** | The family's five groups of ten, each as a floating cloud of bubbles that appear one by one. All 50 reasons, word for word, each once |
| 6 | **Our Memory Film** | The family's memories film (6 min 23 s), one central ▶, full screen with Back and Replay |
| 7 | **Messages Filled With Love** | The family's video wishes, played one after another in their numbered order (see below) |
| 8 | **A Final Gift of Love** | The family's closing words, her name, date and venue, beside an ivory-and-gold gift that opens to a golden "50" |

**Removed at the family's request:** the separate Family Photo Gallery (its photographs stay in `Memory gallery/` and in the manifest),
the "All 50 Reasons" tab, the numbered 50-gift tracker on the last page, the photo collage and "Explore Memories" button on the welcome,
the loading screen, and the developer-generated films (the earlier Life Journey and Age 1 to 50 films; their files are in `VIDEOS/`, not used by the site).
The 1996 (M.Com) milestone has no approved photograph yet: its slide is a year card marked *Photograph awaited from the family*.

---

## Media still needed from the family

| What | Where it goes | Then |
|------|---------------|------|
| The **Family video wishes** Drive folder (about 24 videos, numbered in playback order) | Download it into the project root as `Family video wishes/`, keeping the filenames | `npm run build:wishes` (converts the videos, keeps the order, writes `data/wishes.json`) |
| Confirmation of the **final two** wishes | – | In `data/wishes.json`, set `"confirmed": true` on them (until then they are not shown) |
| Their **Life Journey** video, if they want that page | `assets/videos/family/life-journey.mp4` (MP4, H.264 + AAC) | Set `videos.lifeJourney.src` in `data/site.json` to that path |
| A photograph for **1996 – 1997 (M.Com, first year)** | `Final Life Journey/` | `npm run build:media`, then add its id to the `mcom` milestone in `data/timeline.json` and remove `pendingPhoto` |

`build:wishes` names a wish after the text following the number in its filename ("03 - Vikky.mp4" → *From Vikky*).
Files without a name (e.g. "03.mp4", "VID_2026…") get no caption, so nothing on screen is a guess.
It reports missing numbers, duplicates and a count that differs from the family's.

The *Memory gallery* Drive folder's video (`101901_1792393489053.mp4`, 282,682,775 bytes) is byte-for-byte the film in this project
(`assets/videos/happy 50th birthday.mp4`). Its browser-ready copy, `assets/media/films/family-memories.mp4`, is **Our Memory Film**.

---

## Editing content (no code needed)

All family-specific content lives in `data/`:

| File | Contents |
|------|----------|
| `site.json` | Name, dates, venue; welcome and birthday text; Amma's photo (`reveal.photo`); film paths; final words; music |
| `timeline.json` | Milestones (year, title, caption, photo ids, alt text) and the two slideshows' year ranges (`chapters`) |
| `reasons.json` | The 50 reasons, exactly as written, the 5 groups and the closing line |
| `wishes.json` | The video wishes, in order (**generated** by `npm run build:wishes`; edit only `confirmed`) |
| `photo_inventory.json` | **Generated** media manifest. Don't edit by hand |

### Music
`assets/audio/canon-in-d-major.mp3`: *Canon in D Major* by Kevin MacLeod (incompetech.com), a gentle instrumental
licensed under Creative Commons: By Attribution 3.0 (via Wikimedia Commons). The credit is shown on the final page.
It starts only with **Begin the Celebration** (or the ♫ button / M), plays softly, and steps aside for every video.
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
js/sections/          one module per page (welcome, reveal, journey-film, journey + proud → timeline-show,
                      reasons, memories + wishes → cinema, finale)
assets/media/         web images + the memories film
assets/videos/        the family's Life Journey video (family/) and converted video wishes (wishes/)
assets/audio/         background music
assets/fonts/         Cormorant Garamond + Manrope (SIL Open Font License)
scripts/              build_media.py · build_wishes.py · build_pages.py · serve.mjs · verify.mjs · smoke.mjs
```

Layout: the design is a 16:9 frame (1920 × 1080). All sizes use a unit, `--u`, equal to 1% of the largest 16:9 frame that fits the screen,
so 1920 × 1080, 1600 × 900, 1366 × 768 and 1280 × 720 all show the same composition. Content keeps inside safe margins against projector overscan.
Phones and portrait screens get a stacked layout that scrolls within each scene.

---

## Tests

```bash
npm test              # content + assets: the 50 reasons word for word, milestones, photos, wishes order, removed features
npm run test:browser  # headless Chrome/Edge: 6 screen sizes, Begin + automatic playback, keys/clicker, slideshows,
                      # reasons cloud, full-screen films, music, the final page
```

`test:browser` uses the installed Chrome or Edge (set `CHROME_PATH` if needed) and `puppeteer-core` (`npm install` once).
Set `SMOKE_SHOTS=some/folder` to save screenshots of every scene.

---

## Deploying

Upload `index.html  pages/  css/  js/  data/  assets/` to any static host. All URLs are relative.
`assets/videos/happy 50th birthday.mp4` (283 MB, HEVC) is the original of the memories film and is not needed online.
The original photo folders (~935 MB) are source files only.
