"""Reprint CASPIAN-Prospectus.pdf from src/prospectus.html.

    python3 tools/print-prospectus.py

Chromium is the renderer, as it was for the original file, and the page asks for
Liberation Serif and Liberation Sans because that is what the shipped PDF
embedded. On a machine without those two the text will still set, but the line
breaks will move and the pages will no longer match.
"""

import pathlib
import sys

from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "src" / "prospectus.html"
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "CASPIAN-Prospectus.pdf"

if not SRC.exists():
    sys.exit("missing %s" % SRC)

with sync_playwright() as pw:
    browser = pw.chromium.launch()
    page = browser.new_page()
    # file:// so the two <img> tags resolve against the repo root.
    page.goto(SRC.as_uri(), wait_until="networkidle")
    page.pdf(
        path=str(OUT),
        format="A4",
        print_background=True,
        margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
    )
    browser.close()

print("wrote %s" % OUT)
