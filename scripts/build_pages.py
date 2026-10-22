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
    "welcome.html": ("welcome", "Welcome"),
    "journey.html": ("journey", "Her Life Journey"),
    "reasons.html": ("reasons", "50 Reasons We Love You"),
    "memories.html": ("memories", "Family Memories"),
    "wishes.html": ("wishes", "Family Wishes"),
    "finale.html": ("finale", "50 Gifts Celebration"),
    # The "Age 1 to 50" film was removed from the presentation at the family's request.
    "age-transition.html": ("welcome", "Welcome"),
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
