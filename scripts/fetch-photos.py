"""
Fetches the food photos listed in src/data/photos.json into assets/photos and
writes src/data/photoFiles.ts, which tells the app where each one is.

The photos ship inside the app because Wikimedia does not serve pictures to
apps directly. Meals are saved about 900 px wide and ingredients as 240 px
squares. A photo already in assets/photos is left alone, so this can be run
again after adding to photos.json. It asks for one picture at a time and waits
when Wikimedia says to. Run from the project root:

    python scripts/fetch-photos.py [folder of pictures already fetched]
"""
import io
import json
import os
import re
import sys
import time
import urllib.request
from PIL import Image

UA = {'User-Agent': 'recipe-photo-finder/1.0 (build script)'}
OUT = 'assets/photos'
photos = json.load(io.open('src/data/photos.json', encoding='utf-8'))
have = sys.argv[1] if len(sys.argv) > 1 else None
os.makedirs(OUT, exist_ok=True)


def get(url):
    for attempt in range(10):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read()
        except Exception as e:
            headers = getattr(e, 'headers', None)
            wait = int((headers.get('retry-after') if headers else 0) or 0)
            time.sleep(min(30, max(wait + 1, 5)))
    return None


def sized(url, width):
    """The address of the picture at this width. A picture stored by its own address is small enough to fetch whole."""
    return re.sub(r'/\d+px-', '/%dpx-' % width, url)


names = {}
missing = []
for key, p in photos.items():
    meal = not key.startswith('cofid-')
    name = key.replace('-', '_') + '.jpg'
    path = os.path.join(OUT, name)
    names[key] = name
    if os.path.exists(path):
        continue
    raw = None
    if have and not meal:
        # a small copy already fetched while choosing the photos, named <key>.jpg
        local = os.path.join(have, key + '.jpg')
        if os.path.exists(local):
            raw = open(local, 'rb').read()
    if raw is None:
        raw = get(sized(p['url'], 960 if meal else 250))
        time.sleep(1.5)
    if raw is None:
        missing.append(key)
        del names[key]
        continue
    im = Image.open(io.BytesIO(raw)).convert('RGB')
    if meal:
        im.thumbnail((900, 900), Image.LANCZOS)
    else:
        w, h = im.size
        side = min(w, h)
        im = im.crop(((w - side) // 2, (h - side) // 2, (w + side) // 2, (h + side) // 2)).resize((240, 240), Image.LANCZOS)
    im.save(path, quality=82, optimize=True)  # saved afresh, so nothing but the picture is kept
    print(name, flush=True)

lines = ["  '%s': require('../../assets/photos/%s')," % (k, names[k]) for k in sorted(names)]
io.open('src/data/photoFiles.ts', 'w', encoding='utf-8', newline='\n').write(
    '/** Written by scripts/fetch-photos.py: the photo in the app for each recipe id and CoFID food id. Do not edit by hand. */\n'
    'export const PHOTO_FILES: Record<string, number> = {\n' + '\n'.join(lines) + '\n}\n')
print(len(names), 'photos in the app;', 'could not fetch: ' + ', '.join(missing) if missing else 'none missing')
