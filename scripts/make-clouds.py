"""
Draws the cloud texture used by the sky orb (assets/clouds.png).

Soft white clouds on a transparent background, made from layered, blurred
noise. The image wraps left to right without a seam, so the app can slide it
sideways forever. Run from the project root:  python scripts/make-clouds.py
"""
import numpy as np
from PIL import Image, ImageFilter

W, H = 1024, 512
rng = np.random.default_rng(7)


def wrapped_noise(cells_x, cells_y):
    """Smooth value noise that tiles horizontally."""
    grid = rng.random((cells_y + 1, cells_x))
    grid = np.concatenate([grid, grid[:, :1]], axis=1)  # wrap the right edge onto the left
    xs = np.linspace(0, cells_x, W, endpoint=False)
    ys = np.linspace(0, cells_y, H, endpoint=False)
    x0 = np.floor(xs).astype(int); y0 = np.floor(ys).astype(int)
    fx = xs - x0; fy = ys - y0
    sx = fx * fx * (3 - 2 * fx); sy = fy * fy * (3 - 2 * fy)
    a = grid[y0][:, x0]; b = grid[y0][:, x0 + 1]
    c = grid[y0 + 1][:, x0]; d = grid[y0 + 1][:, x0 + 1]
    top = a + (b - a) * sx
    bottom = c + (d - c) * sx
    return top + (bottom - top) * sy[:, None]


# fractal noise: big billows with finer detail on top
n = sum(wrapped_noise(6 * 2 ** o, 3 * 2 ** o) / 1.8 ** o for o in range(6))
n = (n - n.min()) / (n.max() - n.min())

# clouds sit in a band across the middle and thin out above and below
y = np.linspace(-1, 1, H)[:, None]
band = np.exp(-(y / 0.5) ** 2)
density = np.clip((n * band - 0.2) / 0.42, 0, 1) ** 1.2

alpha = (density * 255).astype(np.uint8)
# a touch of blue-grey shade underneath each cloud, white on top
shade = 1 - 0.14 * density * np.clip(y + 0.2, 0, 1)
rgb = np.stack([shade * 248, shade * 251, np.minimum(255, shade * 255 + 6)], axis=-1).astype(np.uint8)
img = Image.fromarray(np.dstack([np.broadcast_to(rgb, (H, W, 3)), alpha]), 'RGBA')

# soften, wrapping the edges so the blur does not leave a seam
wide = Image.new('RGBA', (W * 3, H))
for i in range(3):
    wide.paste(img, (i * W, 0))
wide = wide.filter(ImageFilter.GaussianBlur(3))
img = wide.crop((W, 0, W * 2, H))
img.save('assets/clouds.png', optimize=True)
print('assets/clouds.png', img.size)
