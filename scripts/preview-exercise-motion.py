"""
Previews how an exercise picture bends when it is animated in the app.

The app moves the poster figures by bending the picture itself at its joints
(src/components/trainer/ArtMotion.tsx), following src/data/exerciseMotion.json.
This draws the same bend for a few moments of the movement, side by side, so a
rig can be tuned without opening the app. Run from the project root:

    python scripts/preview-exercise-motion.py <name, e.g. squat_male> <output.png> [--joints] [--times 0,0.5,1]
"""
import json
import math
import sys
import cv2
import numpy as np
from PIL import Image, ImageDraw

name, out = sys.argv[1], sys.argv[2]
rig = json.load(open('src/data/exerciseMotion.json', encoding='utf-8'))[name]
im = Image.open('assets/exercise/%s.jpg' % name).convert('RGB')
W, H = im.size
src = np.asarray(im).astype(np.float32)
STILL = 0.02  # the pull of the picture's own place, so everything far from the body stays put
CORE = 0.25   # a point this close to a bone (1 on it, 0 far away) is part of the limb, not the space around it
SHARP = 3     # how cleanly a point goes to its nearest bone, so a limb turns at its joint instead of bowing
TOP = int(H * (1 / rig['zoom'] - 1)) + 8  # room above the picture for a figure that stands up out of it


def knee(r, e, l1, l2, side):
    """The middle joint of a limb of two lengths between its two ends, bent to the given side."""
    dx, dy = e[0] - r[0], e[1] - r[1]
    d = max(math.hypot(dx, dy), 1e-6)
    ux, uy = dx / d, dy / d
    if d >= l1 + l2 or d <= abs(l1 - l2):
        return [r[0] + ux * d * l1 / (l1 + l2), r[1] + uy * d * l1 / (l1 + l2)]
    a = (l1 * l1 - l2 * l2 + d * d) / (2 * d)
    h = math.sqrt(max(l1 * l1 - a * a, 0)) * side
    return [r[0] + ux * a - uy * h, r[1] + uy * a + ux * h]


def side_of(r, e, m):
    """Which side of the line between a limb's ends its middle joint is on: 1, -1, or 0 when the limb is straight."""
    across = ((e[0] - r[0]) * (m[1] - r[1]) - (e[1] - r[1]) * (m[0] - r[0])) / max(dist(r, e), 1e-6)
    return 0 if abs(across) < 0.01 else (1 if across > 0 else -1)


def dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def pose(t):
    """Where every joint is at time t (0 = as drawn, 1 = the other end of the movement)."""
    J = rig['joints']
    at = {k: j['at'] for k, j in J.items()}
    end, now = {}, {}
    for k, j in J.items():
        a = j['at']
        if 'with' in j:
            o = j['with']
            end[k] = [a[0] + end[o][0] - at[o][0], a[1] + end[o][1] - at[o][1]]
            now[k] = [a[0] + now[o][0] - at[o][0], a[1] + now[o][1] - at[o][1]]
        elif 'toward' in j:
            # stays its drawn distance from one joint, on the line to another: a cable's clip between hand and pulley
            f, g = j['toward']
            far = dist(a, at[f])
            for pos in (end, now):
                k_ = far / max(dist(pos[f], pos[g]), 1e-6)
                pos[k] = [pos[f][0] + (pos[g][0] - pos[f][0]) * k_, pos[f][1] + (pos[g][1] - pos[f][1]) * k_]
        elif 'ik' in j:
            r, e = j['ik']
            l1, l2, s0 = dist(a, at[r]), dist(a, at[e]), side_of(at[r], at[e], a)
            if 'to' in j:
                end[k] = j['to']
                m1, m2, s1 = dist(j['to'], end[r]), dist(j['to'], end[e]), side_of(end[r], end[e], j['to'])
            else:
                m1, m2, s1 = l1, l2, s0
                end[k] = knee(end[r], end[e], l1, l2, s0)
            # a limb drawn straight bends to the side it ends on; one that ends on the other side passes through straight
            s0, s1 = s0 or s1, s1 or s0
            now[k] = knee(now[r], now[e], l1 + (m1 - l1) * t, l2 + (m2 - l2) * t, s0 + (s1 - s0) * t)
        elif 'around' in j:
            c = j['around']
            end[k] = j['to']
            v0 = [a[0] - at[c][0], a[1] - at[c][1]]
            v1 = [end[k][0] - end[c][0], end[k][1] - end[c][1]]
            a0, a1 = math.atan2(v0[1], v0[0]), math.atan2(v1[1], v1[0])
            da = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
            ang, rad = a0 + da * t, math.hypot(*v0) + (math.hypot(*v1) - math.hypot(*v0)) * t
            now[k] = [now[c][0] + rad * math.cos(ang), now[c][1] + rad * math.sin(ang)]
        else:
            end[k] = j.get('to', a)
            now[k] = [a[0] + (end[k][0] - a[0]) * t, a[1] + (end[k][1] - a[1]) * t]
    return now


REST = pose(0)


def seg_dist(px, py, s):
    x1, y1, x2, y2 = s[:4]
    dx, dy = x2 - x1, y2 - y1
    u = np.clip(((px - x1) * dx + (py - y1) * dy) / max(dx * dx + dy * dy, 1e-6), 0, 1)
    return np.hypot(px - (x1 + u * dx), py - (y1 + u * dy))


def weights(px, py):
    """How much each point follows each bone, and how far in front it lies when parts of the picture cross."""
    raw, core = [], []
    for b in rig['bones']:
        w, c = np.zeros_like(px), np.zeros_like(px)
        for s in b.get('shapes') or [REST[b['a']] + REST[b['b']] + [b.get('r', 30)]]:
            near = np.exp(-2 * (seg_dist(px, py, s) / s[4]) ** 2)
            w = np.maximum(w, (s[5] if len(s) > 5 else 1) * near)
            c = np.maximum(c, near)
        raw.append(w)
        core.append(np.clip((c - CORE) / 0.1 + 0.5, 0, 1))
    total = sum(raw)
    follow = total / (total + STILL)
    sharp = [w ** SHARP for w in raw]
    share = sum(sharp) + 1e-30
    ws = [follow * w / share for w in sharp]
    # the limb itself lies at its bone's level; the empty picture around it lies behind everything
    depth = sum(w * (b.get('z', 1) * c - 0.2 * (1 - c)) for b, w, c in zip(rig['bones'], ws, core))
    return ws, depth


def moved(px, py, t):
    """Where each point of the picture goes at time t."""
    ws, depth = weights(px, py)
    now = pose(t)
    rest = 1 - sum(ws)
    ox, oy = px * rest, py * rest
    for b, w in zip(rig['bones'], ws):
        a0, b0, a1, b1 = REST[b['a']], REST[b['b']], now[b['a']], now[b['b']]
        # the bone turns, and stretches along its own length only
        l0, l1 = dist(a0, b0), dist(a1, b1)
        e0 = [(b0[0] - a0[0]) / l0, (b0[1] - a0[1]) / l0]
        e1 = [(b1[0] - a1[0]) / l1, (b1[1] - a1[1]) / l1] if l1 > 1e-6 else e0
        u = ((px - a0[0]) * e0[0] + (py - a0[1]) * e0[1]) * (l1 / l0)
        v = -(px - a0[0]) * e0[1] + (py - a0[1]) * e0[0]
        ox += w * (a1[0] + u * e1[0] - v * e1[1]); oy += w * (a1[1] + u * e1[1] + v * e1[0])
    return ox, oy, depth


def frame(t):
    """The picture at time t: every point of it is carried to where the app's net would put it."""
    ys, xs = np.mgrid[-TOP:H:0.5, 0:W:0.5].astype(np.float32)
    mx, my, depth = moved(xs, ys, t)
    # nearer parts are drawn last, so they cover what they pass in front of
    order = np.argsort(depth, axis=None, kind='stable')
    xs, ys, mx, my = (a.ravel()[order] for a in (xs, ys, mx, my))
    colour = src[np.clip(np.rint(ys), 0, H - 1).astype(int), np.clip(np.rint(xs), 0, W - 1).astype(int)]
    tx, ty = np.rint(mx).astype(int), np.rint(my).astype(int) + TOP
    ok = (tx >= 0) & (tx < W) & (ty >= 0) & (ty < H + TOP)
    out = np.zeros((H + TOP, W, 3), np.uint8)
    hit = np.zeros((H + TOP, W), np.uint8)
    out[ty[ok], tx[ok]] = colour[ok].astype(np.uint8)
    hit[ty[ok], tx[ok]] = 1
    # where the picture is stretched thin a few pixels are missed: fill them from their neighbours
    out = cv2.inpaint(out, 1 - hit, 2, cv2.INPAINT_NS)
    return Image.fromarray(out)


times = [0, 0.5, 1]
if '--times' in sys.argv:
    times = [float(x) for x in sys.argv[sys.argv.index('--times') + 1].split(',')]
frames = [frame(t) for t in times]
if '--joints' in sys.argv:
    for f, t in zip(frames, times):
        d = ImageDraw.Draw(f)
        now = pose(t)
        for b in rig['bones']:
            p, q = now[b['a']], now[b['b']]
            d.line([p[0], p[1] + TOP, q[0], q[1] + TOP], fill=(0, 160, 0), width=3)
        for p in now.values():
            d.ellipse([p[0] - 4, p[1] + TOP - 4, p[0] + 4, p[1] + TOP + 4], fill=(200, 0, 200))
sheet = Image.new('RGB', (sum(f.width for f in frames), frames[0].height), 'white')
x = 0
for f in frames:
    sheet.paste(f, (x, 0)); x += f.width
sheet.thumbnail((2400, 2400))
sheet.save(out)
print('saved', out)
