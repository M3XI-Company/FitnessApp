"""
Puts exercise figures into the app.

Takes a folder of pictures named <exercise id>-<male|female>.png (the
poster-style anatomy figures made in ForgeGUI), saves each as a 1000 px wide
JPEG in assets/exercise, and writes src/data/exerciseArt.ts, which tells the
app which exercises have a figure for which build. Pictures already in
assets/exercise are kept, so figures can be added a few at a time. Only
pictures that have been looked at and show the exercise correctly should be
put in the folder. Run from the project root:

    python scripts/add-exercise-art.py <folder of pictures>
"""
import io
import os
import re
import sys
from PIL import Image

OUT = 'assets/exercise'
os.makedirs(OUT, exist_ok=True)
exercises = set(re.findall(r"ex\('([a-z0-9-]+)'", io.open('src/data/exercises.ts', encoding='utf-8').read()))

for name in sorted(os.listdir(sys.argv[1]) if len(sys.argv) > 1 else []):
    m = re.match(r'^([a-z0-9-]+)-(male|female)\.png$', name)
    if not m or m.group(1) not in exercises:
        continue
    im = Image.open(os.path.join(sys.argv[1], name)).convert('RGB')
    im.thumbnail((1000, 1000), Image.LANCZOS)
    im.save(os.path.join(OUT, '%s_%s.jpg' % (m.group(1).replace('-', '_'), m.group(2))), quality=84, optimize=True)

art = {}
for name in sorted(os.listdir(OUT)):
    m = re.match(r'^([a-z0-9_]+)_(male|female)\.jpg$', name)
    if m and m.group(1).replace('_', '-') in exercises:
        art.setdefault(m.group(1).replace('_', '-'), {})[m.group(2)] = name
lines = ["  '%s': { %s }," % (k, ', '.join("%s: require('../../assets/exercise/%s')" % (sex, f) for sex, f in sorted(v.items()))) for k, v in sorted(art.items())]
io.open('src/data/exerciseArt.ts', 'w', encoding='utf-8', newline='\n').write(
    '/** Written by scripts/add-exercise-art.py: the poster-style figure for each exercise, by build. Do not edit by hand. */\n'
    'export const EXERCISE_ART: Record<string, { male?: number; female?: number }> = {\n' + '\n'.join(lines) + '\n}\n')
print(len(art), 'exercises have a figure;', sum(len(v) for v in art.values()), 'pictures')
