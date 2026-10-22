"""
Generate the standalone chapter pages in pages/ from index.html.

Each page is a thin shell: the same <head>, navigation and footer as index.html,
with a single chapter <section>. All content is rendered by the shared modules in
js/, so there is nothing to keep in sync by hand — re-run this after editing the
<head> or footer of index.html:

    python scripts/build_pages.py
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = {
    "welcome": ("welcome.html", "Welcome"),
    "journey": ("journey.html", "Her Life Journey"),
    "reasons": ("reasons.html", "50 Reasons We Love You"),
    "memories": ("memories.html", "Key Memories"),
    "wishes": ("wishes.html", "Family Wishes"),
    "age": ("age-transition.html", "Age 1 to 50"),
    "finale": ("finale.html", "The Celebration"),
}


def main():
    with open(os.path.join(ROOT, "index.html"), encoding="utf-8") as fh:
        index = fh.read()
    sections = {sid: block for block, sid in re.findall(r'(\s*<section id="([a-z]+)"[^>]*></section>)', index)}
    main_block = re.search(r"(<main id=\"main\">)(.*?)(\s*</main>)", index, re.S)
    for sid, (filename, title) in PAGES.items():
        page = index.replace(main_block.group(0), main_block.group(1) + sections[sid] + main_block.group(3))
        if sid != "welcome":  # the opening title card belongs to the welcome only
            page = re.sub(r"\s*<!-- intro -->.*?<!-- /intro -->", "", page, flags=re.S)
        page = page.replace('data-base=""', 'data-base="../"')
        page = page.replace('data-page="home"', f'data-page="{sid}"')
        page = re.sub(r"<title>.*?</title>", f"<title>{title} — 50 Years of Love · M. Buvaneswari</title>", page)
        # project-relative asset links → one level up
        page = re.sub(r'(href|src|content)="(css/|js/|assets/)', r'\1="../\2', page)
        out = os.path.join(ROOT, "pages", filename)
        with open(out, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(page)
        print("wrote", os.path.relpath(out, ROOT))


if __name__ == "__main__":
    main()
