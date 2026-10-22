"""
Prepare the family's three films (the files they supplied in VIDEOS/) for the
presentation:

    VIDEOS/age 1 to 5 story video.mp4    -> assets/videos/family/age-1-to-5-story.mp4
    VIDEOS/AGE 1 TO 50 - real video.mp4  -> assets/videos/family/age-1-to-50.mp4
    VIDEOS/LIFE JOURNEY.mp4              -> assets/videos/family/life-journey.mp4

Run from the project root:

    python scripts/build_films.py            # incremental (skips up-to-date files)
    python scripts/build_films.py --force    # prepare everything again

The originals are never modified, and nothing else is ever used in their place.
A film that is already browser-ready (MP4, H.264 + AAC, at most 1920 px and
under MAX_MB) is copied as it is, only with its index moved to the front so it
starts playing straight away online. Anything else (the 2880 x 2160, 1.4 GB
story video) gets a web copy: long edge 1920 at most, H.264 + AAC, kept under
MAX_MB so it can be pushed to GitHub and deployed. Each film also gets a
poster frame (.jpg) next to it.

A missing or undecodable original is reported, and the script exits with an
error so it is never silently left out.

Requires: imageio-ffmpeg (pip install imageio-ffmpeg).
"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = "assets/videos/family"
FILMS = [
    ("VIDEOS/age 1 to 5 story video.mp4", f"{OUT_DIR}/age-1-to-5-story.mp4"),
    ("VIDEOS/AGE 1 TO 50 - real video.mp4", f"{OUT_DIR}/age-1-to-50.mp4"),
    ("VIDEOS/LIFE JOURNEY.mp4", f"{OUT_DIR}/life-journey.mp4"),
]
MAX_MB = 95       # GitHub refuses files over 100 MB
AUDIO_KBPS = 160
POSTER_AT = 2     # seconds in


def ffmpeg():
    try:
        import imageio_ffmpeg
    except ImportError:
        sys.exit("Install imageio-ffmpeg first:  pip install imageio-ffmpeg")
    return imageio_ffmpeg.get_ffmpeg_exe()


def probe(exe, path):
    out = subprocess.run([exe, "-hide_banner", "-i", path], capture_output=True, text=True, errors="replace").stderr
    d = re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)", out)
    s = re.search(r"Video:.*?(\d{2,5})x(\d{2,5})", out)
    video = re.search(r"Stream #.*Video: (\w+).*", out)
    audio = re.search(r"Stream #.*Audio: (\w+)", out)
    return {
        "duration": int(d.group(1)) * 3600 + int(d.group(2)) * 60 + float(d.group(3)) if d else None,
        "size": (int(s.group(1)), int(s.group(2))) if s else (0, 0),
        "vcodec": video.group(1) if video else "",
        "yuv420p": bool(video and re.search(r"\byuv420p[(,]", video.group(0))),
        "acodec": audio.group(1) if audio else "",
    }


def browser_ready(info, path):
    w, h = info["size"]
    return (info["vcodec"] == "h264" and info["yuv420p"] and info["acodec"] in ("aac", "")
            and w <= 1920 and h <= 1080 and os.path.getsize(path) <= MAX_MB * 1e6)


def prepare(exe, source, target, info):
    if browser_ready(info, source):
        print(f"  {source}: already browser-ready, copying as it is")
        cmd = [exe, "-hide_banner", "-loglevel", "error", "-y", "-i", source, "-map", "0:v:0", "-map", "0:a:0?",
               "-c", "copy", "-movflags", "+faststart", target]
    else:
        w, h = info["size"]
        print(f"  {source}: {info['vcodec']} {w}x{h}, making a web copy (this can take a while) ...")
        video_kbps = int(MAX_MB * 8000 / info["duration"]) - AUDIO_KBPS
        cmd = [exe, "-hide_banner", "-loglevel", "error", "-y", "-i", source, "-map", "0:v:0", "-map", "0:a:0?",
               # fits 1920 x 1080 without changing the shape (2880 x 2160 -> 1440 x 1080)
               "-vf", "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
               "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-maxrate", f"{video_kbps}k", "-bufsize", f"{video_kbps * 2}k",
               "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", f"{AUDIO_KBPS}k", "-movflags", "+faststart", target]
    subprocess.run(cmd, check=True)


def main():
    os.chdir(ROOT)
    force = "--force" in sys.argv
    exe = ffmpeg()
    os.makedirs(OUT_DIR, exist_ok=True)
    problems = []
    for source, target in FILMS:
        if not os.path.isfile(source) or not os.path.getsize(source):
            problems.append(f"{source}: not found (or empty)")
            continue
        info = probe(exe, source)
        if not info["duration"] or not info["vcodec"]:
            problems.append(f"{source}: could not be read as a video")
            continue
        poster = os.path.splitext(target)[0] + ".jpg"
        if force or not os.path.exists(target) or os.path.getmtime(target) < os.path.getmtime(source):
            try:
                prepare(exe, source, target, info)
            except subprocess.CalledProcessError as err:
                problems.append(f"{source}: could not be prepared ({err})")
                continue
            subprocess.run([exe, "-hide_banner", "-loglevel", "error", "-y", "-ss", str(POSTER_AT), "-i", target,
                            "-frames:v", "1", "-q:v", "3", poster], check=False)
        out = probe(exe, target)
        w, h = out["size"]
        print(f"  {target}: {w}x{h}, {out['duration']:.1f} s, {os.path.getsize(target) / 1e6:.1f} MB")

    if problems:
        print("\n! These films could not be used:")
        for p in problems:
            print(f"    {p}")
        sys.exit(1)


if __name__ == "__main__":
    main()
