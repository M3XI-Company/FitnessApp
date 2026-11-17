"""
Draws Breeze's icon artwork from one description of the mark (the orb in the
app draws the same gusts live, in src/lib/gust.ts):

  assets/icon.png                      the app icon: three gusts of wind on blue
  assets/android-icon-*.png            the same, split into layers for Android
  assets/splash-icon.png, favicon.png  the icon with rounded corners, and small

A gust is a line that starts as a fine point, thickens, and ends in a hook.
Run from the project root:  python scripts/make-brand.py
"""
import math
import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

S = 2  # everything is drawn at twice the size and scaled down, for smooth edges
BLUE = [(0, 200, 255), (6, 138, 255), (0, 96, 255)]  # top left to bottom right


def gust(x, y, run, radius, turn, width, dip=0.0, step=0.75):
    """
    Points along one gust as (x, y, thickness). It runs right for `run`, then
    hooks round a circle of `radius` through `turn` degrees: positive hooks
    upwards, negative downwards. `dip` leans it the other way first, which
    makes the hook a fuller loop.
    """
    pts = []
    n = max(2, int(run / step))
    for i in range(n):
        t = i / (n - 1)
        pts.append((x + run * t, y, max(0.5, width * t ** 0.85)))
    px, py = pts[-1][0], pts[-1][1]
    heading = 0.0
    sign = 1 if turn > 0 else -1

    def arc(r, degrees, direction):
        nonlocal px, py, heading
        for _ in range(int(math.radians(degrees) * r / step)):
            heading += direction * step / r
            px += step * math.cos(heading); py -= step * math.sin(heading)
            pts.append((px, py, width))

    if dip:
        arc(radius * 1.6, dip, -sign)
    arc(radius, abs(turn) + dip, sign)
    return pts


def stamp(size, gusts, wrap=0):
    """The gusts as a white-on-black mask of `size`, drawn once more a width either side when they wrap."""
    w, h = size
    mask = Image.new('L', (w * S, h * S), 0)
    d = ImageDraw.Draw(mask)
    for pts in gusts:
        for x, y, t in pts:
            for shift in ((-wrap, 0, wrap) if wrap else (0,)):
                cx, cy, r = (x + shift) * S, y * S, t * S / 2
                d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
    return mask.resize((w, h), Image.LANCZOS)


def gradient(n):
    yy, xx = np.mgrid[0:n, 0:n]
    t = ((xx + yy) / (2 * (n - 1)))[..., None]
    a, b, c = (np.array(v, float) for v in BLUE)
    rgb = np.where(t < 0.5, a + (b - a) * t * 2, b + (c - b) * (t - 0.5) * 2)
    return Image.fromarray(rgb.astype('uint8'), 'RGB')


def mark(n, scale=1.0):
    """The three gusts of the icon on an n by n square; `scale` shrinks them about the centre."""
    def u(v): return (0.5 + (v - 0.5) * scale) * n
    k = n * scale
    return [
        gust(u(0.155), u(0.405), 0.43 * k, 0.068 * k, 245, 0.046 * k),
        gust(u(0.105), u(0.500), 0.575 * k, 0.074 * k, 250, 0.046 * k, dip=32),
        gust(u(0.115), u(0.595), 0.455 * k, 0.064 * k, -245, 0.046 * k),
    ]


def white(mask):
    return Image.merge('RGBA', (*Image.new('RGB', mask.size, (255, 255, 255)).split(), mask))


def icon(n=1024):
    base = gradient(n).convert('RGBA')
    m = stamp((n, n), mark(n))
    # a soft shadow under the gusts lifts them off the blue
    shadow = ImageChops.offset(m, 0, int(n * 0.012)).filter(ImageFilter.GaussianBlur(n * 0.014)).point(lambda v: int(v * 0.3))
    base.alpha_composite(Image.merge('RGBA', (*Image.new('RGB', (n, n), (0, 60, 190)).split(), shadow)))
    base.alpha_composite(white(m))
    return base


def rounded(im, radius):
    mask = Image.new('L', (im.width * S, im.height * S), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, mask.width, mask.height), radius * S, fill=255)
    out = im.copy(); out.putalpha(mask.resize(im.size, Image.LANCZOS))
    return out


full = icon()
full.convert('RGB').save('assets/icon.png', optimize=True)
gradient(1024).save('assets/android-icon-background.png', optimize=True)
# Android crops the outer third of the foreground, so the mark is drawn smaller
small = stamp((1024, 1024), mark(1024, 0.6))
white(small).save('assets/android-icon-foreground.png', optimize=True)
white(small).save('assets/android-icon-monochrome.png', optimize=True)
rounded(full, 230).save('assets/splash-icon.png', optimize=True)
rounded(full, 230).resize((48, 48), Image.LANCZOS).save('assets/favicon.png', optimize=True)
print('icon, android layers, splash, favicon written to assets/')
