"""
Build the family video wishes playlist (data/wishes.json) from the folder the
family shared on Google Drive, "Family video wishes".

Download that Drive folder and put it in the project root, so the videos are in

    Family video wishes/01 - Vikky.mp4
    Family video wishes/02 - Varshu.mov
    ...

then run from the project root:

    python scripts/build_wishes.py            # incremental (skips up-to-date files)
    python scripts/build_wishes.py --force    # convert everything again

The originals are never modified. Each video is converted to a web copy that
every browser plays (MP4, H.264 + AAC, long edge <= 1920, loudness evened out
so no wish is much louder than the next) in assets/videos/wishes/, with a
poster frame, and listed in data/wishes.json. HDR phone videos (HLG / PQ,
BT.2020) are tone-mapped to ordinary colour so they don't look washed out, and
each copy is kept under MAX_MB so it can be pushed to GitHub and deployed.

Validation: a file that is empty, cannot be decoded or fails to convert is
reported and left out of the playlist. It is never replaced by anything else.

Order: the family numbered the files to set the playback order, so videos are
sorted by the number at the start of the filename (2 before 10). Files without
a number are listed after the numbered ones and reported, so nothing is
silently reordered.

Names: the text after the number becomes the caption ("01 - Vikky.mp4" ->
"Vikky"). Camera-style names (VID_2026..., IMG_1234, WhatsApp Video ...) give
no caption, because nothing on screen should be a guess.

Confirmation: the family asked to confirm the final two videos before they are
shown. They are listed with "confirmed": false and are skipped by the
presentation until that is changed to true in data/wishes.json. Re-running this
script keeps every "confirmed" value already set.

Requires: imageio-ffmpeg (pip install imageio-ffmpeg).
"""
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_DIR = "Family video wishes"
OUT_DIR = os.path.join("assets", "videos", "wishes")
PLAYLIST = os.path.join("data", "wishes.json")
VIDEO_EXT = {".mp4", ".mov", ".m4v", ".webm", ".3gp", ".mkv", ".avi"}
PENDING_LAST = 2  # the final two videos wait for the family's confirmation
MAX_MB = 95       # GitHub refuses files over 100 MB
AUDIO_KBPS = 160
HDR = re.compile(r"arib-std-b67|smpte2084|bt2020", re.I)
TONEMAP = ("zscale=t=linear:npl=203,format=gbrpf32le,zscale=p=bt709,"
           "tonemap=tonemap=mobius:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p")
SCALE = "scale='if(gte(iw,ih),min(1920,iw),-2)':'if(gte(iw,ih),-2,min(1920,ih))'"

CAMERA_NAME = re.compile(r"^(vid|img|mov|pxl|dsc|whatsapp|video|wa\d|signal|screen|rec)[\s_-]*[\w\s-]*$|^[\d\s_.-]+$", re.I)


def ffmpeg():
    try:
        import imageio_ffmpeg
    except ImportError:
        sys.exit("Install imageio-ffmpeg first:  pip install imageio-ffmpeg")
    return imageio_ffmpeg.get_ffmpeg_exe()


def order_key(name):
    m = re.match(r"\s*(\d+)", name)
    return (0, int(m.group(1)), name.lower()) if m else (1, 0, name.lower())


def caption_for(name):
    stem = os.path.splitext(name)[0]
    rest = re.sub(r"^\s*\d+\s*[-_.)\]]*\s*", "", stem).strip(" -_.")
    rest = re.sub(r"[_]+", " ", rest).strip()
    if not rest or CAMERA_NAME.match(rest):
        return ""
    return rest


def slug(name):
    stem = re.sub(r"^\s*\d+", "", os.path.splitext(name)[0])  # the playlist number is added separately
    return re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-") or "wish"


def probe(exe, path):
    """Duration, frame size, HDR and audio from ffmpeg's own report."""
    out = subprocess.run([exe, "-hide_banner", "-i", path], capture_output=True, text=True, errors="replace").stderr
    d = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", out)
    s = re.search(r"Video:.*?(\d{2,5})x(\d{2,5})", out)
    video = re.search(r"Stream #.*Video:.*", out)
    duration = round(int(d.group(1)) * 3600 + int(d.group(2)) * 60 + float(d.group(3)), 1) if d else None
    return {
        "duration": duration,
        "size": (int(s.group(1)), int(s.group(2))) if s else (None, None),
        "hdr": bool(video and HDR.search(video.group(0))),
        "audio": bool(re.search(r"Stream #.*Audio:", out)),
        "video_kbps": int(k.group(1)) if (k := re.search(r"Stream #.*Video:.*?(\d+) kb/s", out)) else None,
    }


def decodes(exe, path):
    """Can ffmpeg actually decode the first seconds of the video? (A bad download often can't.)
    Timestamp notes from the test muxer ("[null @ ...] non monotonically increasing dts", common in
    phone videos with a variable frame rate) are not decoding errors and are ignored."""
    r = subprocess.run([exe, "-hide_banner", "-v", "error", "-t", "3", "-i", path, "-map", "0:v:0", "-f", "null", "-"],
                       capture_output=True, text=True, errors="replace")
    errors = [line for line in r.stderr.strip().splitlines() if line and not line.startswith("[null @")]
    return r.returncode == 0 and not errors, errors[-1:] or [f"exit code {r.returncode}"]


def convert(exe, source, target, poster, info, force):
    if not force and os.path.exists(target) and os.path.getmtime(target) >= os.path.getmtime(source):
        return
    print(f"  converting {source}{' (HDR, tone-mapped)' if info['hdr'] else ''} ...")
    vf = f"{TONEMAP},{SCALE}" if info["hdr"] else SCALE
    # a bitrate ceiling: never (much) more than the original, and under MAX_MB for a long video
    ceilings = [int(MAX_MB * 8000 / info["duration"]) - AUDIO_KBPS] if info["duration"] else []
    if info["video_kbps"]:
        ceilings.append(max(600, int(info["video_kbps"] * 1.15)))
    cap = []
    if ceilings and min(ceilings) < 8000:
        video_kbps = min(ceilings)
        cap = ["-maxrate", f"{video_kbps}k", "-bufsize", f"{video_kbps * 2}k"]
    audio = ["-map", "0:a:0", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", f"{AUDIO_KBPS}k", "-ar", "48000"] if info["audio"] else ["-an"]
    subprocess.run([
        exe, "-hide_banner", "-loglevel", "error", "-y", "-i", source, "-map", "0:v:0",
        "-vf", vf, "-c:v", "libx264", "-preset", "medium", "-crf", "22", *cap, "-pix_fmt", "yuv420p",
        "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
        *audio, "-movflags", "+faststart", target,
    ], check=True)
    subprocess.run([exe, "-hide_banner", "-loglevel", "error", "-y", "-ss", "1", "-i", target,
                    "-frames:v", "1", "-q:v", "3", poster], check=False)


def main():
    os.chdir(ROOT)
    force = "--force" in sys.argv
    with open(PLAYLIST, encoding="utf-8") as fh:
        playlist = json.load(fh)
    if not os.path.isdir(SOURCE_DIR):
        sys.exit(f'Folder "{SOURCE_DIR}" not found. Download the family\'s Drive folder into the project root first.')

    files = sorted((f for f in os.listdir(SOURCE_DIR) if os.path.splitext(f)[1].lower() in VIDEO_EXT), key=order_key)
    if not files:
        sys.exit(f'No videos found in "{SOURCE_DIR}".')
    unnumbered = [f for f in files if order_key(f)[0]]
    numbers = [order_key(f)[1] for f in files if not order_key(f)[0]]
    duplicates = sorted({n for n in numbers if numbers.count(n) > 1})
    gaps = sorted(set(range(1, max(numbers) + 1)) - set(numbers)) if numbers else []

    exe = ffmpeg()
    os.makedirs(OUT_DIR, exist_ok=True)
    previous = {v.get("file"): v for v in playlist.get("videos", [])}
    videos, invalid = [], []
    for name in files:
        source = f"{SOURCE_DIR}/{name}"
        info = probe(exe, source)
        ok, why = decodes(exe, source) if os.path.getsize(source) else (False, ["empty file (0 bytes)"])
        if not ok or not info["duration"]:
            invalid.append(f"{name}: {why[0] if why else 'no duration'}")
            continue
        number = order_key(name)[1] if not order_key(name)[0] else None
        # named after the family's own number, so "27.mp4" stays 27 even with gaps before it
        base = f"{number:02d}-{slug(name)}" if number is not None else f"x-{slug(name)}"
        target = f"{OUT_DIR}/{base}.mp4".replace(os.sep, "/")
        poster = f"{OUT_DIR}/{base}.jpg".replace(os.sep, "/")
        try:
            convert(exe, source, target, poster, info, force)
        except subprocess.CalledProcessError as err:
            invalid.append(f"{name}: conversion failed ({err})")
            continue
        out = probe(exe, target)
        if not out["duration"]:
            invalid.append(f"{name}: the converted copy has no duration")
            continue
        w, h = out["size"]
        videos.append({
            "n": len(videos) + 1,
            "number": number,
            "file": source,
            "src": target,
            "poster": poster if os.path.exists(poster) else "",
            "from": caption_for(name),
            "duration": out["duration"],
            "width": w,
            "height": h,
            "mb": round(os.path.getsize(target) / 1e6, 1),
        })

    # the final two (in the family's order) wait for confirmation; a value already set is kept
    for i, entry in enumerate(videos):
        pending = i >= len(videos) - PENDING_LAST
        entry["confirmed"] = previous.get(entry["file"], {}).get("confirmed", not pending)
        if pending and not entry["confirmed"]:
            entry["_note"] = "One of the final two videos: waiting for the family's confirmation. Set confirmed to true to include it."

    playlist["videos"] = videos
    with open(PLAYLIST, "w", encoding="utf-8") as fh:
        json.dump(playlist, fh, indent=2, ensure_ascii=False)
        fh.write("\n")

    shown = [v for v in videos if v["confirmed"]]
    print(f"\n{len(videos)} videos listed in {PLAYLIST}; {len(shown)} will play, in this order:")
    for v in videos:
        print(f"  {v['n']:>2}. {v['file']} ({v['mb']} MB){'  (' + v['from'] + ')' if v['from'] else ''}{'' if v['confirmed'] else '  [waiting for confirmation]'}")
    expected = playlist.get("expected")
    if expected and len(videos) != expected:
        print(f"\n! The family mentioned about {expected} videos; {len(videos)} were found. Please check the folder is complete.")
    if gaps:
        print(f"! Numbers missing from the sequence: {', '.join(map(str, gaps))}")
    if duplicates:
        print(f"! The same number is used twice: {', '.join(map(str, duplicates))}. Check the intended order with the family.")
    if unnumbered:
        print(f"! Not numbered (placed at the end): {', '.join(unnumbered)}")
    if invalid:
        print("! Could not be used (left out; please ask the family for a fresh copy):")
        for line in invalid:
            print(f"    {line}")
    too_big = [v["src"] for v in videos if v["mb"] > 100]
    if too_big:
        print(f"! Over 100 MB (GitHub refuses these): {', '.join(too_big)}")


if __name__ == "__main__":
    main()
