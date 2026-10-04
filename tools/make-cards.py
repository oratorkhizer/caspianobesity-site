"""Draws the link-preview cards (og-*.jpg) and the specimen certificate (certificate.jpg)
in the site palette: moss #4f5d2f and coral #e76f51.

Usage: FONT_DIR=/path/to/woff2 python3 tools/make-cards.py
FONT_DIR must hold spectral-latin-{600,700}-{normal,italic}.woff2,
public-sans-latin-{400,600}-normal.woff2 and great-vibes-latin-400-normal.woff2
(npm packages @fontsource/spectral, @fontsource/public-sans, @fontsource/great-vibes).
Needs: pip install playwright qrcode pillow; python3 -m playwright install chromium
"""
import asyncio, base64, io, os, pathlib
import qrcode
from PIL import Image
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONTS = pathlib.Path(os.environ.get("FONT_DIR", "fonts"))

MOSS, MOSS_DK, MOSS_DEEP = "#4f5d2f", "#3a4523", "#2c3419"
CORAL, CORAL_LT, SAGE, CREAM = "#e76f51", "#f39a80", "#c9d3a8", "#f7f4ec"


def font(name):
    return "data:font/woff2;base64," + base64.b64encode((FONTS / name).read_bytes()).decode()


FACES = f"""
@font-face{{font-family:Spectral;font-weight:600;src:url({font('spectral-latin-600-normal.woff2')})}}
@font-face{{font-family:Spectral;font-weight:700;src:url({font('spectral-latin-700-normal.woff2')})}}
@font-face{{font-family:Spectral;font-weight:600;font-style:italic;src:url({font('spectral-latin-600-italic.woff2')})}}
@font-face{{font-family:Public;font-weight:400;src:url({font('public-sans-latin-400-normal.woff2')})}}
@font-face{{font-family:Public;font-weight:600;src:url({font('public-sans-latin-600-normal.woff2')})}}
@font-face{{font-family:Vibes;src:url({font('great-vibes-latin-400-normal.woff2')})}}
"""

MARK = (ROOT / "favicon.svg").read_text()
MARK_URI = "data:image/svg+xml;base64," + base64.b64encode(MARK.encode()).decode()


def rays(w, h, x0, colour, n=22, opacity=.22):
    lines = "".join(
        f'<line x1="{x0}" y1="-40" x2="{x0 + (i - n / 2) * w / n * 2.4:.0f}" y2="{h + 40}" />'
        for i in range(n + 1))
    return (f'<svg width="{w}" height="{h}" style="position:absolute;inset:0" '
            f'stroke="{colour}" stroke-width="1" opacity="{opacity}">{lines}</svg>')


CARD_CSS = f"""
{FACES}
*{{box-sizing:border-box;margin:0}}
body{{width:1200px;height:630px;overflow:hidden;font-family:Public;color:#fff;
 background:radial-gradient(120% 110% at 15% 0%,{MOSS} 0%,{MOSS_DK} 55%,{MOSS_DEEP} 100%);position:relative}}
.frame{{position:absolute;inset:26px;border:1.5px solid rgba(243,154,128,.35);border-radius:6px}}
.brand{{position:absolute;left:72px;top:64px;display:flex;align-items:center;gap:16px}}
.brand img{{width:58px;height:58px;border-radius:12px}}
.brand b{{display:block;font-family:Spectral;font-weight:700;font-size:25px;letter-spacing:.2em}}
.brand span{{display:block;font-size:12.5px;letter-spacing:.24em;color:{SAGE};margin-top:3px}}
.eyebrow{{font-family:Spectral;font-style:italic;font-weight:600;font-size:26px;color:{CORAL_LT}}}
h1{{font-family:Spectral;font-weight:700;line-height:1.08;letter-spacing:-.01em}}
h1 em{{font-style:normal;color:{CORAL_LT}}}
.rule{{width:64px;height:3px;background:{CORAL};margin:18px 0 22px}}
.foot{{position:absolute;left:72px;right:72px;bottom:58px;display:flex;justify-content:space-between;align-items:baseline}}
.url{{font-weight:600;font-size:22px;color:{CORAL_LT}}}
.by{{font-size:16px;color:{SAGE}}}
.pills{{display:flex;gap:12px;margin-top:28px}}
.pill{{font-weight:600;font-size:17px;padding:9px 18px;border-radius:999px;border:1.5px solid rgba(201,211,168,.6);color:#fff}}
.pill.hot{{background:{CORAL};border-color:{CORAL};color:#2e0f06}}
p.sub{{font-size:23px;line-height:1.45;color:#e6ead7;margin-top:20px}}
p.sub b{{color:#fff}}
"""


def brand():
    return (f'<div class="brand"><img src="{MARK_URI}"/><div><b>CASPIAN</b>'
            f'<span>OBESITY MEDICINE</span></div></div>')


def page_card(eyebrow, title):
    size = 64 if len(title) < 28 else 54
    return f"""<html><head><style>{CARD_CSS}</style></head><body>
{rays(1200, 630, 1080, CORAL_LT, opacity=.14)}<div class="frame"></div>{brand()}
<div style="position:absolute;left:72px;top:232px;right:150px">
<div class="eyebrow">{eyebrow}</div><div class="rule"></div><h1 style="font-size:{size}px">{title}</h1></div>
<div class="foot"><span class="url">caspianobesity.com</span><span class="by">Caspian Healthcare Foundation, Hyderabad</span></div>
</body></html>"""


FRAMEWORK = [("C", "Classify"), ("A", "Assess"), ("S", "Screen"), ("P", "Personalise"),
             ("I", "Intervene"), ("A", "Anchor"), ("N", "Nurture")]


def main_card():
    rows = "".join(
        f'<div style="display:flex;gap:18px;align-items:baseline;padding:4px 0;'
        f'border-top:1px solid rgba(201,211,168,.18)"><b style="font-family:Spectral;font-size:25px;'
        f'color:{CORAL_LT};width:22px">{l}</b><span style="font-size:20px;font-weight:600">{w}</span></div>'
        for l, w in FRAMEWORK)
    return f"""<html><head><style>{CARD_CSS}</style></head><body>
{rays(1200, 630, 640, CORAL_LT, opacity=.13)}{brand()}
<div style="position:absolute;left:72px;top:170px;width:660px">
<div class="eyebrow">Certificate course for physicians, Hyderabad</div>
<h1 style="font-size:60px;margin-top:14px">Treat obesity the way the <em>GLP-1 era</em> demands.</h1>
<p class="sub">India-first and case-based: <b>12 monthly modules</b>, built for Asian-Indian patients.</p>
<div class="pills"><span class="pill hot">Founding batch under way</span><span class="pill">Certificate + textbook</span></div></div>
<div style="position:absolute;right:72px;top:70px;width:330px;padding:20px 28px 12px;border-radius:16px;
 background:rgba(44,52,25,.55);border:1.5px solid rgba(243,154,128,.4)">
<div style="font-family:Spectral;font-weight:700;font-size:23px;margin-bottom:12px">The CASPIAN framework</div>{rows}</div>
<div class="foot" style="justify-content:flex-start;gap:28px"><span class="url">caspianobesity.com</span></div>
</body></html>"""


def next_card():
    return f"""<html><head><style>{CARD_CSS}</style></head><body>
{rays(1200, 630, 1080, CORAL_LT, opacity=.14)}<div class="frame"></div>{brand()}
<div style="position:absolute;left:72px;top:180px;right:120px">
<div class="eyebrow">Next batch, Hyderabad</div>
<h1 style="font-size:80px;margin-top:10px">Batch 2 begins<br/><em>January 2027</em></h1>
<p class="sub">Twelve case-based modules for practising doctors, one Sunday a month.<br/>Registration opens in December.</p></div>
<div class="foot"><span style="display:flex;gap:12px"><span class="pill hot">Certificate + textbook</span><span class="pill">Twelve modules</span></span>
<span class="url">caspianobesity.com/next</span></div>
</body></html>"""


PAGES = {
    "about": ("About the course", "About the CASPIAN Certificate in Obesity Medicine"),
    "apply": ("Course application", "Apply for the Certificate in Obesity Medicine"),
    "cancellation": ("Legal", "Cancellation Policy"),
    "contact": ("Get in touch", "Contact the course team"),
    "feedback": ("Module feedback", "How was today's session?"),
    "privacy": ("Legal", "Privacy Policy"),
    "refund": ("Legal", "Refund Policy"),
    "terms": ("Legal", "Terms &amp; Conditions"),
    "verify": ("Credential check", "Verify a CASPIAN certificate"),
}


def qr_uri(url):
    img = qrcode.make(url, border=1, box_size=10)
    buf = io.BytesIO(); img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def certificate():
    cid = "CASP-OM-2026-0001"
    logo = "data:image/png;base64," + base64.b64encode((ROOT / "chf-logo.png").read_bytes()).decode()
    qr = qr_uri(f"https://caspianobesity.com/verify?id={cid}")
    return f"""<html><head><style>{FACES}
*{{box-sizing:border-box;margin:0}}
body{{width:1640px;height:1160px;overflow:hidden;background:{CREAM};font-family:Public;color:#22281a;position:relative}}
.o{{position:absolute;inset:30px;border:14px solid {MOSS}}}
.i{{position:absolute;inset:56px;border:1.5px solid {CORAL}}}
.i2{{position:absolute;inset:62px;border:1px solid rgba(231,111,81,.45)}}
.c{{position:absolute;left:0;right:0;text-align:center}}
.small{{font-size:15px;letter-spacing:.32em;color:#6b7a48}}
.sig{{position:absolute;bottom:150px;width:360px;text-align:center}}
.sig .line{{border-top:1.5px solid {MOSS};margin:6px 30px 10px}}
.sig b{{font-size:18px;font-weight:600;color:{MOSS_DEEP}}} .sig span{{display:block;font-size:15px;color:#5a6b4a;margin-top:3px}}
</style></head><body><div class="o"></div><div class="i"></div><div class="i2"></div>
<div class="c" style="top:118px"><img src="{MARK_URI}" style="width:84px;height:84px;border-radius:18px"/></div>
<div class="c" style="top:216px;font-family:Spectral;font-weight:700;font-size:30px;letter-spacing:.3em;color:{MOSS}">CASPIAN</div>
<div class="c small" style="top:258px">OBESITY MEDICINE</div>
<div class="c" style="top:306px;font-family:Spectral;font-weight:700;font-size:62px;color:{MOSS}">Certificate in Obesity Medicine</div>
<div class="c small" style="top:412px;color:{CORAL}">CERTIFICATE OF COMPLETION</div>
<div class="c" style="top:470px;font-family:Spectral;font-style:italic;font-weight:600;font-size:26px;color:#5a6b4a">This is to certify that</div>
<div class="c" style="top:516px"><span style="display:inline-block;font-family:Spectral;font-weight:600;font-size:64px;color:{MOSS_DEEP};
 padding:0 60px 8px;border-bottom:1.5px solid {CORAL}">Dr. Participant Name</span></div>
<div class="c" style="top:640px;left:260px;right:260px;font-size:20px;line-height:1.65;color:#3a4523">
has successfully completed the twelve-module <b>CASPIAN Certificate in Obesity Medicine</b>, meeting the attendance requirements
and passing the final examination, and is recognised as having demonstrated competence in the practical,
India-first management of obesity in the GLP-1 era.</div>
<div class="sig" style="left:150px"><div style="font-family:Vibes;font-size:54px;color:{MOSS_DEEP};line-height:1">K. Junaidy</div>
<div class="line"></div><b>Dr Khizer Hussain Junaidy, MD</b><span>Course Director</span></div>
<div class="sig" style="left:640px"><img src="{logo}" style="height:92px"/><div class="line" style="margin-top:12px"></div>
<span style="letter-spacing:.22em;font-size:13px">ISSUING BODY</span></div>
<div class="sig" style="right:150px"><img src="{qr}" style="width:118px;height:118px;padding:6px;background:#fff;border:1.5px solid {MOSS}"/>
<span style="letter-spacing:.22em;font-size:13px;margin-top:10px">SCAN TO VERIFY</span></div>
<div class="c" style="bottom:88px;font-size:14px;color:#5a6b4a">Credential ID <b style="color:{CORAL}">{cid}</b>
&nbsp;·&nbsp; Verify at <b style="color:{MOSS}">caspianobesity.com/verify</b> &nbsp;·&nbsp; Issued by Caspian Healthcare Foundation, Hyderabad</div>
</body></html>"""


async def render(page, html, out, w, h, quality=88):
    await page.set_viewport_size({"width": w, "height": h})
    await page.set_content(html, wait_until="load")
    await page.evaluate("document.fonts.ready")
    await page.wait_for_timeout(250)
    png = await page.screenshot()
    Image.open(io.BytesIO(png)).convert("RGB").save(ROOT / out, quality=quality, optimize=True, progressive=True)
    print("wrote", out)


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page()
        await render(pg, main_card(), "og-image.jpg", 1200, 630)
        await render(pg, next_card(), "og-next.jpg", 1200, 630)
        for slug, (eb, t) in PAGES.items():
            await render(pg, page_card(eb, t), f"og-{slug}.jpg", 1200, 630)
        await render(pg, certificate(), "certificate.jpg", 1640, 1160, quality=90)
        await b.close()

asyncio.run(main())
