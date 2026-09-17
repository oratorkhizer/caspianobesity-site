#!/usr/bin/env python3
"""Draws the site illustrations as plain SVG files into /img.

Run from the repo root:  python3 tools/make-illustrations.py
Everything is text, so the files can be pushed like any other source file.
Brand tokens match style.css. No em dashes anywhere in the artwork.
"""
import math, os

NAVY, NAVY2, NAVY3 = "#0e2643", "#14375d", "#091a31"
GOLD, GOLDL, GOLDD = "#c9a227", "#e7c65a", "#8a6d12"
CREAM, INK, MUTED, LINE = "#f7f4ec", "#14202e", "#5a6b7a", "#e2e6ea"
SERIF = "Georgia, 'Times New Roman', serif"
SANS = "Inter, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

OUT = os.path.join(os.path.dirname(__file__), "..", "img")
os.makedirs(OUT, exist_ok=True)


def svg(name, w, h, title, desc, body):
    s = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" '
         f'role="img" aria-labelledby="t d">\n<title id="t">{title}</title>\n<desc id="d">{desc}</desc>\n'
         f'<defs><linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{GOLDL}"/>'
         f'<stop offset="1" stop-color="{GOLD}"/></linearGradient>'
         f'<linearGradient id="navy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{NAVY2}"/>'
         f'<stop offset="1" stop-color="{NAVY}"/></linearGradient>'
         f'<marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
         f'<path d="M0 0L10 5L0 10z" fill="{GOLD}"/></marker></defs>\n{body}\n</svg>\n')
    assert "—" not in s, name
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        f.write(s)
    print(name, len(s), "bytes")


def text(x, y, s, size=20, fill=INK, weight=400, anchor="middle", font=SANS, extra=""):
    return (f'<text x="{x:.1f}" y="{y:.1f}" font-family="{font}" font-size="{size}" font-weight="{weight}" '
            f'fill="{fill}" text-anchor="{anchor}" {extra}>{s}</text>')


def pill(cx, cy, w, h, label, size=20):
    return (f'<rect x="{cx-w/2:.1f}" y="{cy-h/2:.1f}" width="{w}" height="{h}" rx="{h/2}" fill="#fff" '
            f'stroke="{GOLD}" stroke-width="2"/>' + text(cx, cy + size * 0.35, label, size, NAVY, 600))


# ---------------------------------------------------------------- 1. root cause tree
def root_cause():
    W, H = 600, 560
    b = []
    ground = 352
    # soil
    b.append(f'<path d="M0 {ground} H{W} V{H-30} Q{W/2} {H+10} 0 {H-30}z" fill="#efe8d6"/>')
    b.append(f'<line x1="0" y1="{ground}" x2="{W}" y2="{ground}" stroke="{GOLDD}" stroke-width="2" stroke-dasharray="7 7"/>')
    b.append(text(14, ground - 12, "WHAT YOU TREAT", 14, MUTED, 700, "start", extra='letter-spacing="1.5"'))
    b.append(text(14, ground + 26, "WHAT DRIVES IT", 14, GOLDD, 700, "start", extra='letter-spacing="1.5"'))
    # branches
    top = (300, 262)
    pills = [(108, 62, "Type 2 diabetes"), (300, 34, "Hypertension"), (492, 62, "Fatty liver"),
             (150, 168, "Sleep apnoea"), (450, 168, "PCOS")]
    for (px, py, _) in pills:
        ey = py + 24
        b.append(f'<path d="M{top[0]} {top[1]} C{top[0]} {top[1]-60} {px} {ey+70} {px} {ey}" fill="none" '
                 f'stroke="{NAVY2}" stroke-width="7" stroke-linecap="round"/>')
    # trunk
    b.append(f'<path d="M282 {ground+6} C288 310 290 290 292 258 H308 C310 290 312 310 318 {ground+6}z" fill="{NAVY2}"/>')
    # leaves
    for (lx, ly, rot) in [(215, 150, -30), (372, 128, 25), (300, 120, 0), (238, 228, -50), (364, 226, 50), (180, 108, -20), (424, 110, 20)]:
        b.append(f'<ellipse cx="{lx}" cy="{ly}" rx="13" ry="7" fill="url(#gold)" transform="rotate({rot} {lx} {ly})" opacity=".9"/>')
    for (px, py, lab) in pills:
        b.append(pill(px, py, 196, 46, lab, 20))
    # roots
    for d in [f"M290 {ground} C270 390 200 380 150 430", f"M310 {ground} C330 390 400 380 450 430",
              f"M300 {ground} C300 380 300 390 300 410", f"M150 430 C120 460 90 470 60 500",
              f"M450 430 C480 460 510 470 540 500", f"M230 480 C220 510 200 520 185 540", f"M370 480 C380 510 400 520 415 540"]:
        b.append(f'<path d="{d}" fill="none" stroke="{GOLDD}" stroke-width="5" stroke-linecap="round" opacity=".75"/>')
    b.append(f'<ellipse cx="300" cy="448" rx="196" ry="52" fill="url(#gold)" stroke="{GOLDD}" stroke-width="2"/>')
    b.append(text(300, 443, "Excess visceral fat", 27, NAVY3, 700, font=SERIF))
    b.append(text(300, 470, "the shared root", 17, NAVY3, 500))
    svg("root-cause.svg", W, H, "One root, many diseases",
        "A tree. Above the ground are five branches labelled type 2 diabetes, hypertension, fatty liver, sleep apnoea and PCOS. "
        "Below the ground a single root is labelled excess visceral fat.", "\n".join(b))


# ---------------------------------------------------------------- 2. BMI cut-offs
def cutoffs():
    W, H = 640, 520
    X = lambda bmi: 40 + (bmi - 18) * 35
    b = []
    PALE, MID = "#dfe8f1", GOLDL

    def row(y, label, ow, ob, obx=None):
        h = 46
        b.append(text(40, y - 12, label, 20, NAVY, 700, "start"))
        b.append(f'<rect x="{X(18)}" y="{y}" width="{X(ow)-X(18)}" height="{h}" fill="{PALE}"/>')
        b.append(f'<rect x="{X(ow)}" y="{y}" width="{X(ob)-X(ow)}" height="{h}" fill="{MID}"/>')
        b.append(f'<rect x="{X(ob)}" y="{y}" width="{X(34)-X(ob)}" height="{h}" fill="{NAVY}"/>')
        b.append(f'<path d="M{X(34)} {y} l18 {h/2} l-18 {h/2}z" fill="{NAVY}"/>')
        b.append(text((X(18) + X(ow)) / 2, y + 30, "Normal", 18, NAVY2, 600))
        if ob - ow >= 4:
            b.append(text((X(ow) + X(ob)) / 2, y + 30, "Overweight", 18, NAVY3, 600))
        b.append(text(obx if obx else (X(ob) + X(34)) / 2 + 6, y + 30, "Obesity", 18, "#fff", 700))

    row(60, "International (WHO)", 25, 30)
    row(214, "Asian-Indian", 23, 25, X(27.5))
    # overweight label for the narrow Indian band
    b.append(text(X(24), 214 + 46 + 22, "Overweight", 15, GOLDD, 700))
    # axis
    ay = 134
    b.append(f'<line x1="{X(18)}" y1="{ay}" x2="{X(34)}" y2="{ay}" stroke="{MUTED}" stroke-width="1.5"/>')
    for v in (23, 25, 30):
        b.append(f'<line x1="{X(v)}" y1="{ay-7}" x2="{X(v)}" y2="{ay+7}" stroke="{MUTED}" stroke-width="1.5"/>')
        b.append(text(X(v), ay + 28, str(v), 19, INK, 700))
    b.append(text(X(34) + 18, ay + 28, "BMI", 15, MUTED, 600, "end"))
    # the gap
    gy = 214
    b.append(f'<rect x="{X(25)}" y="{gy-4}" width="{X(30)-X(25)}" height="54" fill="none" stroke="{GOLD}" stroke-width="3.5" stroke-dasharray="8 5" rx="4"/>')
    b.append(f'<path d="M{X(27.5)} {gy+54} V{gy+92}" stroke="{GOLD}" stroke-width="2.5" marker-start="url(#arr)"/>')
    b.append(f'<rect x="{X(27.5)-212}" y="{gy+92}" width="424" height="64" rx="10" fill="#fff" stroke="{GOLD}" stroke-width="2"/>')
    b.append(text(X(27.5), gy + 119, "BMI 25 to 29.9: obesity in an Indian patient,", 18, NAVY, 600))
    b.append(text(X(27.5), gy + 143, "only “overweight” on the international scale", 18, NAVY, 600))
    # waist
    wy = 408
    b.append(f'<rect x="40" y="{wy}" width="560" height="70" rx="12" fill="{NAVY}"/>')
    # tape icon
    b.append(f'<circle cx="84" cy="{wy+35}" r="19" fill="none" stroke="{GOLDL}" stroke-width="3.5"/>'
             f'<circle cx="84" cy="{wy+35}" r="5" fill="{GOLDL}"/>'
             f'<path d="M84 {wy+54} H122" stroke="{GOLDL}" stroke-width="3.5" stroke-linecap="round"/>')
    b.append(text(140, wy + 30, "Waist that signals abdominal obesity", 17, "#cfdbe8", 500, "start"))
    b.append(text(140, wy + 55, "Men 90 cm or more  ·  Women 80 cm or more", 20, "#fff", 700, "start"))
    b.append(text(40, 506, "Source: Misra A, et al. Consensus statement for Asian Indians. J Assoc Physicians India 2009;57:163–70.", 12.5, MUTED, 400, "start"))
    svg("indian-cutoffs.svg", W, H, "Asian-Indian cut-offs act earlier",
        "Two BMI scales. On the WHO scale overweight starts at 25 and obesity at 30. On the Asian-Indian scale overweight starts at 23 "
        "and obesity at 25. A BMI of 25 to 29.9 is obesity in an Indian patient but only overweight on the international scale. "
        "Waist cut-offs: men 90 cm or more, women 80 cm or more.", "\n".join(b))


# ---------------------------------------------------------------- 3. twelve-module journey
PHASES = [("Foundations", [1, 2, 3, 4], "Science, diagnosis, the consultation, causes", ("Science, diagnosis,", "the consultation, causes")),
          ("Lifestyle and behaviour", [5, 6, 7], "Nutrition, activity and sleep, psychology", ("Nutrition, activity and sleep,", "psychology")),
          ("Medicines and surgery", [8, 9, 10], "Pharmacotherapy I and II, bariatric options", ("Pharmacotherapy I and II,", "bariatric options")),
          ("Special groups and your practice", [11, 12], "Special populations, building a service", ("", ""))]
PH_FILL = [NAVY2, "#1d5c7a", GOLDD, NAVY3]


def rosette(cx, cy, r=30):
    pts = []
    for i in range(24):
        a = math.pi * 2 * i / 24
        rr = r if i % 2 == 0 else r * 0.84
        pts.append(f"{cx+rr*math.cos(a):.1f},{cy+rr*math.sin(a):.1f}")
    return (f'<path d="M{cx-14} {cy+r-8} l-8 34 l16 -9 l6 3z M{cx+14} {cy+r-8} l8 34 l-16 -9 l-6 3z" fill="{GOLDD}"/>'
            f'<polygon points="{" ".join(pts)}" fill="url(#gold)" stroke="{GOLDD}" stroke-width="1.5"/>'
            f'<circle cx="{cx}" cy="{cy}" r="{r*0.6:.1f}" fill="none" stroke="{NAVY3}" stroke-width="1.8"/>'
            f'<path d="M{cx-9} {cy} l6 7 l12 -14" fill="none" stroke="{NAVY3}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>')


def journey_wide():
    W, H = 1100, 250
    b = []
    step, x0, y = 78, 60, 86
    xs = {n: x0 + (n - 1) * step for n in range(1, 13)}
    b.append(f'<line x1="{xs[1]}" y1="{y}" x2="{xs[12]+96}" y2="{y}" stroke="{GOLD}" stroke-width="4" stroke-dasharray="2 9" stroke-linecap="round"/>')
    for pi, (name, mods, sub, two) in enumerate(PHASES):
        xa, xb = xs[mods[0]] - 30, xs[mods[-1]] + 30
        b.append(f'<rect x="{xa}" y="{y-38}" width="{xb-xa}" height="76" rx="38" fill="{PH_FILL[pi]}" opacity=".1"/>')
        for n in mods:
            b.append(f'<circle cx="{xs[n]}" cy="{y}" r="25" fill="{PH_FILL[pi]}"/>')
            b.append(text(xs[n], y + 7, f"{n:02d}", 19, "#fff", 700))
        mid = (xa + xb) / 2
        b.append(f'<path d="M{xa+10} {y+50} v8 H{xb-10} v-8" fill="none" stroke="{PH_FILL[pi]}" stroke-width="2"/>')
        if pi < 3:
            b.append(text(mid, y + 86, name, 17, NAVY, 700))
            b.append(text(mid, y + 108, two[0], 13.5, MUTED))
            b.append(text(mid, y + 126, two[1], 13.5, MUTED))
        else:
            b.append(text(mid, y + 86, "Special groups", 17, NAVY, 700))
            b.append(text(mid, y + 106, "and your practice", 17, NAVY, 700))
    cx = xs[12] + 120
    b.append(rosette(cx, y - 4, 32))
    b.append(text(cx, y + 86, "Final exam", 17, NAVY, 700))
    b.append(text(cx, y + 106, "and certificate", 17, NAVY, 700))
    b.append(text(60 - 25, 28, "ONE SUNDAY A MONTH, THREE HOURS EACH", 13.5, GOLDD, 700, "start", extra='letter-spacing="1.6"'))
    svg("journey-wide.svg", W, H, "The twelve-module journey",
        "Twelve numbered modules in four phases: Foundations (1 to 4), Lifestyle and behaviour (5 to 7), Medicines and surgery (8 to 10), "
        "Special groups and your practice (11 and 12), ending in the final exam and certificate.", "\n".join(b))


def journey_tall():
    W, H = 420, 672
    b = []
    b.append(text(20, 30, "ONE SUNDAY A MONTH, THREE HOURS EACH", 14, GOLDD, 700, "start", extra='letter-spacing="1.2"'))
    lx = 46
    b.append(f'<line x1="{lx}" y1="70" x2="{lx}" y2="560" stroke="{GOLD}" stroke-width="4" stroke-dasharray="2 9" stroke-linecap="round"/>')
    y = 60
    for pi, (name, mods, sub, two) in enumerate(PHASES):
        b.append(f'<circle cx="{lx}" cy="{y+26}" r="11" fill="{PH_FILL[pi]}"/>')
        b.append(text(76, y + 20, name, 20, NAVY, 700, "start"))
        b.append(text(76, y + 42, sub, 14, MUTED, 400, "start"))
        for i, n in enumerate(mods):
            cx = 100 + i * 62
            b.append(f'<circle cx="{cx}" cy="{y+82}" r="24" fill="{PH_FILL[pi]}"/>')
            b.append(text(cx, y + 89, f"{n:02d}", 19, "#fff", 700))
        y += 128
    b.append(rosette(lx + 6, y + 30, 30))
    b.append(text(104, y + 28, "Final exam and certificate", 20, NAVY, 700, "start"))
    b.append(text(104, y + 50, "60 questions, pass mark 60%", 14, MUTED, 400, "start"))
    svg("journey-tall.svg", W, H, "The twelve-module journey",
        "Twelve numbered modules in four phases, ending in the final exam and certificate.", "\n".join(b))


# ---------------------------------------------------------------- 4. inside a session
STOPS = [("9:30", "Registration", "Sign in and find a seat", "reg"),
         ("10:00", "Live pre-test", "Five questions on your phone", "phone"),
         ("", "Case-based teaching", "Real Indian-practice cases", "case"),
         ("", "Post-test and feedback", "Watch your own score move", "chart"),
         ("1:00 pm", "Lunch with the cohort", "Every session ends with lunch", "lunch")]


def icon(kind, cx, cy, c="#fff"):
    s = f'fill="none" stroke="{c}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"'
    if kind == "reg":
        return f'<path d="M{cx-10} {cy-12} h20 v26 h-20z M{cx-5} {cy-15} h10 v6 h-10z M{cx-5} {cy} h10 M{cx-5} {cy+7} h10" {s}/>'
    if kind == "phone":
        return f'<rect x="{cx-9}" y="{cy-15}" width="18" height="30" rx="3.5" {s}/><path d="M{cx-3} {cy+10} h6" {s}/>'
    if kind == "case":
        return (f'<circle cx="{cx-6}" cy="{cy-7}" r="5" {s}/><path d="M{cx-15} {cy+13} c0 -12 18 -12 18 0" {s}/>'
                f'<path d="M{cx+5} {cy-13} h11 v12 h-6 l-4 4 v-4" {s}/>')
    if kind == "chart":
        return f'<path d="M{cx-14} {cy+12} l8 -9 l7 5 l12 -17 M{cx+6} {cy-9} h7 v7" {s}/>'
    return (f'<circle cx="{cx+2}" cy="{cy}" r="11" {s}/><circle cx="{cx+2}" cy="{cy}" r="4.5" {s}/>'
            f'<path d="M{cx-16} {cy-12} v24 M{cx-19} {cy-12} v7 c0 4 6 4 6 0 v-7" {s}/>')


def session_wide():
    W, H = 1100, 230
    b = []
    xs = [90, 290, 530, 770, 1000]
    y = 86
    b.append(f'<line x1="{xs[0]}" y1="{y}" x2="{xs[-1]}" y2="{y}" stroke="{LINE}" stroke-width="10" stroke-linecap="round"/>')
    b.append(f'<line x1="{xs[1]}" y1="{y}" x2="{xs[-1]}" y2="{y}" stroke="{GOLD}" stroke-width="10" stroke-linecap="round"/>')
    b.append(text((xs[1] + xs[4]) / 2, 22, "THE THREE TEACHING HOURS", 13.5, GOLDD, 700, extra='letter-spacing="1.6"'))
    b.append(f'<path d="M{xs[1]} 46 v-12 H{xs[4]} v12" fill="none" stroke="{GOLD}" stroke-width="2"/>')
    for i, (t, name, sub, k) in enumerate(STOPS):
        x = xs[i]
        r = 34 if k == "case" else 29
        b.append(f'<circle cx="{x}" cy="{y}" r="{r}" fill="url(#navy)" stroke="{GOLD}" stroke-width="3"/>')
        b.append(icon(k, x, y, GOLDL))
        b.append(text(x, y + 66, name, 18, NAVY, 700))
        b.append(text(x, y + 88, sub, 14, MUTED))
        if t:
            b.append(f'<rect x="{x-44}" y="{y+100}" width="88" height="28" rx="14" fill="{CREAM}" stroke="{GOLD}" stroke-width="1.5"/>')
            b.append(text(x, y + 120, t, 15.5, GOLDD, 700))
    svg("session-wide.svg", W, H, "Inside a session",
        "A timeline of a course Sunday: registration from 9:30, live pre-test at 10:00, case-based teaching, post-test and feedback, "
        "and lunch with the cohort at 1:00 pm.", "\n".join(b))


def session_tall():
    W, H = 420, 560
    b = []
    lx = 56
    ys = [60, 165, 270, 375, 480]
    b.append(f'<line x1="{lx}" y1="{ys[0]}" x2="{lx}" y2="{ys[-1]}" stroke="{LINE}" stroke-width="10" stroke-linecap="round"/>')
    b.append(f'<line x1="{lx}" y1="{ys[1]}" x2="{lx}" y2="{ys[-1]}" stroke="{GOLD}" stroke-width="10" stroke-linecap="round"/>')
    for i, (t, name, sub, k) in enumerate(STOPS):
        y = ys[i]
        b.append(f'<circle cx="{lx}" cy="{y}" r="30" fill="url(#navy)" stroke="{GOLD}" stroke-width="3"/>')
        b.append(icon(k, lx, y, GOLDL))
        b.append(text(106, y - 2, name, 21, NAVY, 700, "start"))
        b.append(text(106, y + 22, sub, 15.5, MUTED, 400, "start"))
        if t:
            b.append(text(106, y - 28, t, 15, GOLDD, 700, "start", extra='letter-spacing="1"'))
    svg("session-tall.svg", W, H, "Inside a session",
        "A timeline of a course Sunday from registration at 9:30 to lunch at 1:00 pm.", "\n".join(b))


# ---------------------------------------------------------------- 5. framework wheel
STEPS = [("C", "Classify", "Stage the disease"), ("A", "Assess", "Waist, risk, root causes"),
         ("S", "Screen", "Complications"), ("P", "Personalise", "Plan to patient"),
         ("I", "Intervene", "Diet, drugs, devices, surgery"), ("A", "Anchor", "Hold the loss"),
         ("N", "Nurture", "Long-term, stigma-free care")]


def wheel():
    W, H = 820, 640
    cx, cy, R = 410, 320, 178
    b = []
    b.append(f'<circle cx="{cx}" cy="{cy}" r="{R}" fill="none" stroke="{LINE}" stroke-width="16"/>')
    n = len(STEPS)
    ang = [-90 + i * 360 / n for i in range(n)]
    # arrows between consecutive steps (not closing the loop)
    for i in range(n - 1):
        a0, a1 = math.radians(ang[i] + 14), math.radians(ang[i + 1] - 15)
        x0, y0 = cx + R * math.cos(a0), cy + R * math.sin(a0)
        x1, y1 = cx + R * math.cos(a1), cy + R * math.sin(a1)
        b.append(f'<path d="M{x0:.1f} {y0:.1f} A{R} {R} 0 0 1 {x1:.1f} {y1:.1f}" fill="none" stroke="{GOLD}" stroke-width="4" marker-end="url(#arr)"/>')
    b.append(f'<circle cx="{cx}" cy="{cy}" r="112" fill="url(#navy)"/>')
    b.append(text(cx, cy - 14, "One system", 22, "#fff", 700, font=SERIF))
    b.append(text(cx, cy + 14, "for every patient", 22, "#fff", 700, font=SERIF))
    b.append(text(cx, cy + 46, "who walks in", 17, GOLDL, 600))
    for i, (L, name, sub) in enumerate(STEPS):
        a = math.radians(ang[i])
        x, y = cx + R * math.cos(a), cy + R * math.sin(a)
        b.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="34" fill="url(#gold)" stroke="#fff" stroke-width="4"/>')
        b.append(text(x, y + 11, L, 32, NAVY3, 700, font=SERIF))
        c = math.cos(a)
        if abs(c) < 0.2:
            b.append(text(x, y - 66, name, 23, NAVY, 700))
            b.append(text(x, y - 44, sub, 15.5, MUTED))
        else:
            anchor = "start" if c > 0 else "end"
            lx = x + (48 if c > 0 else -48)
            b.append(text(lx, y - 1, name, 23, NAVY, 700, anchor))
            b.append(text(lx, y + 21, sub, 15.5, MUTED, 400, anchor))
    svg("caspian-framework.svg", W, H, "The CASPIAN framework",
        "Seven steps arranged around a circle in order: Classify, Assess, Screen, Personalise, Intervene, Anchor, Nurture. "
        "In the centre: one system for every patient who walks in.", "\n".join(b))


for f in (root_cause, cutoffs, journey_wide, journey_tall, session_wide, session_tall, wheel):
    f()
