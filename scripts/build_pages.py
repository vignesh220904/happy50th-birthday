"""
Generate the short links in pages/.

The site is now one presentation (index.html). Each page here is a tiny
redirect that opens the presentation at the matching scene, so older links
such as pages/reasons.html keep working:

    python scripts/build_pages.py
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = {
    "welcome.html": ("welcome", "A Golden Beginning"),
    "story.html": ("story-film", "Age 1 to 50 — Her Story"),
    # the Real Journey and Life Journey videos left the presentation: their old links open Her Story
    "age-transition.html": ("story-film", "Age 1 to 50 — Her Story"),
    "life-journey.html": ("story-film", "Age 1 to 50 — Her Story"),
    "journey.html": ("journey", "A Journey Through Time"),
    "proud.html": ("proud", "Proud Moments"),
    "reasons.html": ("reasons", "50 Reasons We Love You"),
    "memories.html": ("memories", "Our Memory Film"),
    "wishes.html": ("wishes", "Messages Filled With Love"),
    "cake.html": ("cake", "Happy Birthday, Amma"),
    "finale.html": ("finale", "A Final Gift of Love"),
}

TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title} — Happy 50th Birthday, Amma</title>
  <meta http-equiv="refresh" content="0; url=../index.html#{scene}">
  <link rel="canonical" href="../index.html#{scene}">
  <script>location.replace('../index.html#{scene}');</script>
</head>
<body>
  <p><a href="../index.html#{scene}">Open the celebration: {title}</a></p>
</body>
</html>
"""


def main():
    os.makedirs(os.path.join(ROOT, "pages"), exist_ok=True)
    for filename, (scene, title) in PAGES.items():
        out = os.path.join(ROOT, "pages", filename)
        with open(out, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(TEMPLATE.format(scene=scene, title=title))
        print("wrote", os.path.relpath(out, ROOT))


if __name__ == "__main__":
    main()
