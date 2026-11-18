"""Draws the Breeze app icon, Android adaptive icon layers, splash mark and favicon.

The mark is the orb from the app (src/components/SkyOrb.tsx): clear blue sky
with long soft streaks of wind, each coming to a fine point at both ends.

    python scripts/make-icons.py
"""
import math
from PIL import Image, ImageDraw

SS = 3  # draw large and scale down, for smooth edges
SKY = [(0x00, 0xC8, 0xFF), (0x06, 0x8A, 0xFF), (0x00, 0x60, 0xFF)]

# every streak lies along the same gentle wave of air, so they run side by side and never cross
BEND = 0.2
WAVES = 0.8  # waves across the width of the icon
PHASE = 0.9

# x, y of the trailing point, length, width, opacity (all against a 1 x 1 square)
STREAKS = [
    (0.44, 0.250, 0.36, 0.030, 0.4),
    (0.22, 0.360, 0.50, 0.064, 1.0),
    (0.12, 0.500, 0.76, 0.080, 1.0),
    (0.30, 0.640, 0.50, 0.064, 1.0),
    (0.20, 0.750, 0.34, 0.030, 0.4),
]


def sky(size):
    """The blue of the orb, light at the top left and deep at the bottom right."""
    small = Image.new('RGB', (64, 64))
    px = small.load()
    for y in range(64):
        for x in range(64):
            t = (x + y) / 126
            a, b, u = (SKY[0], SKY[1], t * 2) if t < 0.5 else (SKY[1], SKY[2], t * 2 - 1)
            px[x, y] = tuple(round(a[i] + (b[i] - a[i]) * u) for i in range(3))
    return small.resize((size, size), Image.BICUBIC)


def streak(x, y, length, width, steps=80):
    """The outline of one streak: along one side to the leading point and back along the other."""
    left, right = [], []
    for i in range(steps + 1):
        along = i / steps
        heading = BEND * math.sin(2 * math.pi * WAVES * x + PHASE)
        half = width / 2 * math.sin(math.pi * along) ** 0.7
        nx, ny = math.sin(heading) * half, math.cos(heading) * half
        left.append((x - nx, y - ny))
        right.append((x + nx, y + ny))
        x += length / steps * math.cos(heading)
        y -= length / steps * math.sin(heading)
    return left + right[::-1]


def wind(size, scale=1.0, colour=(255, 255, 255)):
    """The streaks on a clear layer, shrunk about the middle by `scale`."""
    layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    for x, y, length, width, opacity in STREAKS:
        one = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        pts = [((0.5 + (px - 0.5) * scale) * size, (0.5 + (py - 0.5) * scale) * size) for px, py in streak(x, y, length, width)]
        ImageDraw.Draw(one).polygon(pts, fill=colour + (round(255 * opacity),))
        layer = Image.alpha_composite(layer, one)
    return layer


def save(img, path, size):
    img.resize((size, size), Image.LANCZOS).save(path)
    print(path, size)


big = 1024 * SS
full = Image.alpha_composite(sky(big).convert('RGBA'), wind(big))
save(full.convert('RGB'), 'assets/icon.png', 1024)
save(full, 'assets/favicon.png', 48)

# Android draws the middle two thirds of each layer, so the mark is drawn smaller there
save(sky(big), 'assets/android-icon-background.png', 1024)
save(wind(big, 0.8), 'assets/android-icon-foreground.png', 1024)
save(wind(big, 0.8), 'assets/android-icon-monochrome.png', 1024)

# the launch screen: the orb itself, round, on the app's pale background
mask = Image.new('L', (big, big), 0)
ImageDraw.Draw(mask).ellipse((0, 0, big - 1, big - 1), fill=255)
orb = full.copy()
orb.putalpha(mask)
save(orb, 'assets/splash-icon.png', 1024)
