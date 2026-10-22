"""
Build web-ready media + the central media manifest (data/photo_inventory.json).

Source folders are never modified. For every image found we write two WebP
renditions into assets/media/<collection>/:

    <id>-sm.webp   long edge <= 640px   (grids, thumbnails, 3D textures)
    <id>-lg.webp   long edge <= 1800px  (full-screen scenes, lightbox)

Run from the project root:

    python scripts/build_media.py            # incremental (skips up-to-date files)
    python scripts/build_media.py --force    # rebuild everything
    python scripts/build_media.py --films-only   # only films (convert + posters)

Requires: Pillow, pillow-heif (HEIC support). opencv-python is optional and
only used to extract poster frames from the family films.

Adding photos later
-------------------
* Life journey  -> drop files into "Final Life Journey" (numbered in story order),
                   then reference the new id (e.g. "lj-30") in data/timeline.json.
* Age 1 to 50   -> name files by age: "34.jpg", "34 (2).jpg", "34.1.jpg" ...
                   They appear in the age sequence automatically.
* Memory gallery-> drop files into "Memory gallery". Dates come from EXIF or the
                   filename. They appear in the gallery automatically.
Then re-run this script.
"""
import hashlib
import json
import os
import re
import sys
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime

from PIL import Image, ImageOps

try:
    import pillow_heif

    pillow_heif.register_heif_opener()
except ImportError:  # HEIC files will be reported as errors
    pillow_heif = None

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join("assets", "media")
MANIFEST = os.path.join("data", "photo_inventory.json")

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"}
SIZES = {"sm": 640, "lg": 1800}

COLLECTIONS = {
    "journey": "Final Life Journey",
    "age": "Age 1 to 50",
    "gallery": "Memory gallery",
    "illustrations": os.path.join("assets", "illustrations"),
}

# Files that are drawings / AI reconstructions rather than real photographs.
# Everything in assets/illustrations is treated as an illustration as well.
ILLUSTRATION_FILES = {
    "Final Life Journey/7.png",  # TVS 50 & Hero Honda Splendor - no original photo exists
}

# Generic video "posters" produced by an earlier version of the site. They are
# not family media, so they are not part of the manifest.
SKIP_FILES = re.compile(r"^video_thumb_", re.I)

# Phone scans of old printed photographs were taken on these dates. Their
# file dates describe when the print was scanned, not when the photo was taken.
SCAN_DATES = {"2026-10-04", "2026-10-05"}

FILMS = [
    {
        # The family's 6½-minute memories film (the video in the "Memory gallery"
        # Google Drive folder, 101901_1792393489053.mp4). The original is HEVC (H.265),
        # which many browsers cannot play, so a web copy is converted to H.264
        # (needs imageio-ffmpeg). It opens the Family Album in the presentation.
        "id": "film-memories",
        "source": "assets/videos/happy 50th birthday.mp4",
        "src": "assets/media/films/family-memories.mp4",
        "poster": "assets/media/films/memories-poster.webp",
        "posterAt": 0.03,
    },
]


def natural_key(s):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s)]


def make_id(prefix, filename, taken):
    base, ext = os.path.splitext(filename)
    slug = re.sub(r"[^a-z0-9]+", "-", base.lower()).strip("-")
    ext = ext.lower().lstrip(".")
    candidate = f"{prefix}-{slug}" if ext == "jpg" else f"{prefix}-{slug}-{ext}"
    n = 2
    unique = candidate
    while unique in taken:
        unique = f"{candidate}-{n}"
        n += 1
    taken.add(unique)
    return unique


def exif_datetime(img):
    try:
        exif = img.getexif()
        value = exif.get_ifd(0x8769).get(36867) or exif.get(36867) or exif.get(306)
        if value:
            return datetime.strptime(str(value).strip()[:19], "%Y:%m:%d %H:%M:%S")
    except Exception:
        pass
    return None


def filename_date(filename):
    m = re.search(r"(19\d\d|20[0-3]\d)[-_]?(\d\d)[-_]?(\d\d)", filename)
    if m:
        y, mo, d = map(int, m.groups())
        if 1 <= mo <= 12 and 1 <= d <= 31:
            return datetime(y, mo, d)
    return None


def safe_transpose(img):
    """exif_transpose() chokes on some malformed EXIF blocks; fall back to the raw tag."""
    try:
        return ImageOps.exif_transpose(img)
    except Exception:
        try:
            orientation = img.getexif().get(274, 1)
        except Exception:
            orientation = 1
        method = {
            2: Image.Transpose.FLIP_LEFT_RIGHT,
            3: Image.Transpose.ROTATE_180,
            4: Image.Transpose.FLIP_TOP_BOTTOM,
            5: Image.Transpose.TRANSPOSE,
            6: Image.Transpose.ROTATE_270,
            7: Image.Transpose.TRANSVERSE,
            8: Image.Transpose.ROTATE_90,
        }.get(orientation)
        return img.transpose(method) if method else img


def process(job):
    """Runs in a worker process. Returns metadata for one source image."""
    src, out_base, force = job
    result = {"src": src, "error": None}
    try:
        stat = os.stat(src)
        with Image.open(src) as img:
            taken = exif_datetime(img)
            if img.format == "JPEG":
                img.draft("RGB", (SIZES["lg"] * 2, SIZES["lg"] * 2))  # fast DCT downscale
            img = safe_transpose(img)
            if img.mode not in ("RGB", "RGBA"):
                img = img.convert("RGBA" if "transparency" in img.info else "RGB")
            if img.mode == "RGBA":
                bg = Image.new("RGB", img.size, (6, 20, 46))
                bg.paste(img, mask=img.split()[3])
                img = bg

            # Original (oriented) dimensions are approximated after draft(); keep the ratio.
            result["taken"] = taken.isoformat() if taken else None
            result["bytes"] = stat.st_size
            variants = {}
            for key, edge in SIZES.items():
                out = f"{out_base}-{key}.webp"
                im = img.copy()
                im.thumbnail((edge, edge), Image.Resampling.LANCZOS)
                if force or not os.path.exists(out) or os.path.getmtime(out) < stat.st_mtime:
                    im.save(out, "WEBP", quality=82 if key == "lg" else 76, method=5)
                variants[key] = {"src": out.replace("\\", "/"), "w": im.width, "h": im.height}
            result["variants"] = variants
            tiny = img.copy()
            tiny.thumbnail((1, 1), Image.Resampling.BOX)
            r, g, b = tiny.getpixel((0, 0))[:3]
            result["color"] = f"#{r:02x}{g:02x}{b:02x}"
    except Exception as exc:  # reported, never fatal
        result["error"] = f"{type(exc).__name__}: {exc}"
    return result


def scan(collection, folder):
    if not os.path.isdir(folder):
        print(f"  ! missing folder: {folder}")
        return []
    files = []
    for name in sorted(os.listdir(folder), key=natural_key):
        path = os.path.join(folder, name)
        if not os.path.isfile(path) or SKIP_FILES.search(name):
            continue
        ext = os.path.splitext(name)[1].lower()
        if ext not in IMAGE_EXT:
            print(f"  - skipped (not an image): {folder}/{name}")
            continue
        files.append(name)
    if collection == "illustrations":
        # The folder holds both .jpg and .webp copies of each drawing; keep one per name.
        seen, unique = set(), []
        for name in sorted(files, key=lambda n: (os.path.splitext(n)[0], not n.lower().endswith(".jpg"))):
            stem = os.path.splitext(name)[0]
            if stem not in seen:
                seen.add(stem)
                unique.append(name)
        files = sorted(unique, key=natural_key)
    return files


def build_entry(collection, folder, name, meta, entry_id, digests):
    rel = f"{folder}/{name}".replace("\\", "/")
    v = meta["variants"]
    entry = {
        "id": entry_id,
        "file": rel,
        "kind": "illustration" if collection == "illustrations" or rel in ILLUSTRATION_FILES else "photo",
        "width": v["lg"]["w"],
        "height": v["lg"]["h"],
        "color": meta["color"],
        "sm": v["sm"]["src"],
        "smW": v["sm"]["w"],
        "lg": v["lg"]["src"],
        "lgW": v["lg"]["w"],
    }
    stem = os.path.splitext(name)[0]

    if collection == "journey":
        m = re.match(r"^(\d+)(?:\s*\((\d+)\))?$", stem)
        entry["order"] = int(m.group(1)) if m else None

    if collection == "age":
        m = re.match(r"^(\d+)(?:\s*\((\d+)\)|\.(\d+))?$", stem)
        if m:
            entry["age"] = int(m.group(1))
            entry["variant"] = int(m.group(2) or m.group(3) or 1)
        else:
            entry["age"] = None
            print(f"  ! cannot read an age from filename: {rel}")

    if collection == "gallery":
        taken = datetime.fromisoformat(meta["taken"]) if meta.get("taken") else None
        from_name = filename_date(name)
        date, source = (taken, "exif") if taken else ((from_name, "filename") if from_name else (None, None))
        if date and date.strftime("%Y-%m-%d") in SCAN_DATES:
            entry["group"] = "album"  # scanned print: the real date is unknown
            entry["date"] = None
        elif date:
            entry["group"] = str(date.year)
            entry["date"] = date.strftime("%Y-%m-%d")
            entry["dateSource"] = source
        else:
            entry["group"] = "undated"
            entry["date"] = None
        digest = digests.get(rel)
        entry["sha1"] = digest
    return entry


def transcode_films():
    """Convert films whose source browsers can't play (e.g. HEVC) into H.264 web copies."""
    for film in FILMS:
        source = film.get("source")
        if not source or not os.path.exists(source):
            continue
        if os.path.exists(film["src"]) and os.path.getmtime(film["src"]) >= os.path.getmtime(source):
            continue
        try:
            import subprocess
            import imageio_ffmpeg
        except ImportError:
            print(f"  ! install imageio-ffmpeg to convert {source}")
            continue
        os.makedirs(os.path.dirname(film["src"]), exist_ok=True)
        print(f"  converting {source} -> {film['src']} (takes a few minutes) ...")
        subprocess.run([
            imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-i", source,
            "-c:v", "libx264", "-preset", "medium", "-crf", "23", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", film["src"],
        ], check=True)


def extract_posters():
    try:
        import cv2
    except ImportError:
        print("  - opencv not installed; skipping film posters")
        return
    os.makedirs(os.path.join(OUT_DIR, "films"), exist_ok=True)
    for film in FILMS:
        if not os.path.exists(film["src"]):
            print(f"  ! film missing: {film['src']}")
            continue
        cap = cv2.VideoCapture(film["src"])
        frames = cap.get(cv2.CAP_PROP_FRAME_COUNT)
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(frames * film["posterAt"]))
        ok, frame = cap.read()
        film["duration"] = round(frames / (cap.get(cv2.CAP_PROP_FPS) or 30), 1)
        film["width"] = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        film["height"] = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        cap.release()
        if ok:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            Image.fromarray(rgb).save(film["poster"], "WEBP", quality=82)


def films_only():
    """Refresh just the films in an existing manifest."""
    with open(MANIFEST, encoding="utf-8") as fh:
        manifest = json.load(fh)
    transcode_films()
    extract_posters()
    manifest["films"] = [{k: v for k, v in f.items() if k not in ("posterAt", "source")} for f in FILMS if os.path.exists(f["src"])]
    with open(MANIFEST, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=1, ensure_ascii=False)
    print(f"Films updated: {[f['id'] for f in manifest['films']]}")


def main():
    os.chdir(ROOT)
    if "--films-only" in sys.argv:
        return films_only()
    force = "--force" in sys.argv
    jobs, plan = [], []
    for collection, folder in COLLECTIONS.items():
        print(f"Scanning {folder} ...")
        os.makedirs(os.path.join(OUT_DIR, collection), exist_ok=True)
        taken = set()
        prefix = {"journey": "lj", "age": "age", "gallery": "mg", "illustrations": "ill"}[collection]
        for name in scan(collection, folder):
            entry_id = make_id(prefix, name, taken)
            src = os.path.join(folder, name)
            out_base = os.path.join(OUT_DIR, collection, entry_id)
            jobs.append((src, out_base, force))
            plan.append((collection, folder, name, entry_id))

    digests = {}
    for collection, folder, name, _ in plan:
        if collection == "gallery":
            with open(os.path.join(folder, name), "rb") as fh:
                digests[f"{folder}/{name}".replace("\\", "/")] = hashlib.sha1(fh.read()).hexdigest()

    print(f"Processing {len(jobs)} images ...")
    with ProcessPoolExecutor() as pool:
        results = list(pool.map(process, jobs, chunksize=4))

    manifest = {
        "version": 2,
        "generatedBy": "scripts/build_media.py",
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "collections": {c: [] for c in COLLECTIONS},
        "films": [],
        "errors": [],
    }
    seen_digest = {}
    for (collection, folder, name, entry_id), meta in zip(plan, results):
        if meta["error"]:
            print(f"  ! {meta['src']}: {meta['error']}")
            manifest["errors"].append({"file": f"{folder}/{name}", "error": meta["error"]})
            continue
        entry = build_entry(collection, folder, name, meta, entry_id, digests)
        if collection == "gallery":
            if entry["sha1"] in seen_digest:
                print(f"  - duplicate of {seen_digest[entry['sha1']]}: {name}")
                continue
            seen_digest[entry["sha1"]] = name
            del entry["sha1"]
        manifest["collections"][collection].append(entry)

    transcode_films()
    extract_posters()
    for film in FILMS:
        if os.path.exists(film["src"]):
            manifest["films"].append({k: v for k, v in film.items() if k not in ("posterAt", "source")})

    with open(MANIFEST, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=1, ensure_ascii=False)
    counts = {k: len(v) for k, v in manifest["collections"].items()}
    print(f"Done. {counts}, films={len(manifest['films'])}, errors={len(manifest['errors'])}")
    print(f"Manifest written to {MANIFEST}")


if __name__ == "__main__":
    main()
