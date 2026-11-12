#!/usr/bin/env python3
"""
Build src/data/cofid.json from McCance and Widdowson's Composition of Foods
Integrated Dataset (CoFID) 2021 — the UK's official food composition data.

Source:  https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid
Licence: Open Government Licence v3.0 (attribution required — shown in-app under
         Profile → Data sources & licences).

Usage:   pip install openpyxl
         python3 scripts/import_cofid.py path/to/McCance_Widdowsons_..._2021.xlsx
"""
import json, sys
from pathlib import Path
import openpyxl

OUT = Path(__file__).resolve().parent.parent / 'src' / 'data' / 'cofid.json'

# Emoji by keyword in the food name (purely cosmetic); first match wins
EMOJI = [
    (('porridge', 'muesli', 'cornflakes', 'cereal', 'granola', 'bran flakes', 'weetabix'), '🥣'),
    (('bread', 'roll', 'bagel', 'baguette', 'toast', 'crumpet', 'muffin'), '🍞'), (('croissant',), '🥐'),
    (('cake', 'gateau', 'sponge', 'brownie'), '🍰'), (('biscuit', 'cookie', 'cracker'), '🍪'), (('pie', 'pastry', 'tart'), '🥧'),
    (('pasta', 'spaghetti', 'macaroni', 'noodle', 'lasagne'), '🍝'), (('rice', 'risotto'), '🍚'), (('pizza',), '🍕'),
    (('milk',), '🥛'), (('yogurt', 'yoghurt', 'fromage'), '🥛'), (('cheese',), '🧀'), (('ice cream',), '🍦'), (('egg',), '🥚'),
    (('butter', 'margarine', 'spread', 'oil'), '🧈'), (('salmon', 'tuna', 'cod', 'haddock', 'fish', 'mackerel', 'sardine', 'prawn', 'crab'), '🐟'),
    (('chicken', 'turkey', 'duck'), '🍗'), (('beef', 'steak', 'lamb', 'pork', 'ham', 'bacon', 'sausage', 'mince', 'burger'), '🥩'),
    (('potato', 'chips', 'crisps'), '🥔'), (('beans', 'lentil', 'chickpea'), '🫘'), (('tomato',), '🍅'), (('carrot',), '🥕'),
    (('broccoli', 'cabbage', 'kale', 'spinach', 'sprouts', 'peas', 'lettuce', 'salad', 'cucumber', 'pepper', 'courgette'), '🥦'),
    (('apple',), '🍎'), (('banana',), '🍌'), (('orange', 'satsuma', 'clementine'), '🍊'), (('grape',), '🍇'), (('strawberr', 'raspberr'), '🍓'),
    (('blueberr',), '🫐'), (('pear',), '🍐'), (('peach', 'nectarine', 'apricot'), '🍑'), (('avocado',), '🥑'), (('lemon', 'lime'), '🍋'),
    (('nut', 'almond', 'peanut', 'cashew', 'walnut', 'seed'), '🥜'), (('chocolate',), '🍫'), (('sugar', 'sweets', 'jam', 'honey', 'syrup'), '🍯'),
    (('soup',), '🍲'), (('curry',), '🍛'), (('coffee',), '☕'), (('tea',), '🍵'), (('juice', 'smoothie'), '🧃'),
    (('beer', 'lager', 'cider', 'wine', 'spirit', 'gin', 'vodka', 'whisky'), '🍷'), (('water',), '💧'),
]

def emoji_for(name):
    n = name.lower()
    for words, e in EMOJI:
        if any(w in n for w in words):
            return e
    return '🍽️'

def num(v):
    """CoFID uses 'Tr' for trace, 'N' for not determined, '' for missing."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip()
    if s.lower() in ('tr', 'trace'):
        return 0.0
    try:
        return float(s.replace('(', '').replace(')', ''))
    except ValueError:
        return None

def rows(ws):
    header = None
    for i, r in enumerate(ws.iter_rows(values_only=True)):
        if i == 1:
            header = {c: j for j, c in enumerate(r) if c}
        if i >= 3 and r[0]:
            yield header, r

def main(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    sodium = {}
    for h, r in rows(wb['1.4 Inorganics']):
        sodium[r[0]] = num(r[h['NA']])
    foods = []
    for h, r in rows(wb['1.3 Proximates']):
        code, name, group = r[0], str(r[1]).strip(), (r[3] or '')
        kcal = num(r[h['KCALS']])
        if kcal is None:
            continue
        na_mg = sodium.get(code)
        emoji = emoji_for(name)
        foods.append({
            'id': f'cofid-{code}',
            'name': name,
            'emoji': emoji,
            'group': group,
            'kcal': round(kcal),
            'kj': round(num(r[h['KJ']]) or kcal * 4.184),
            'protein': num(r[h['PROT']]),
            'carbs': num(r[h['CHO']]),
            'fat': num(r[h['FAT']]),
            'sugar': num(r[h['TOTSUG']]),
            'fiber': num(r[h['AOACFIB']]),
            'satFat': num(r[h['SATFOD']]),
            # UK labels salt, not sodium: salt (g) = sodium (mg) × 2.5 / 1000
            'salt': round(na_mg * 2.5 / 1000, 2) if na_mg is not None else None,
        })
    foods.sort(key=lambda f: f['name'].lower())
    OUT.write_text(json.dumps({
        'source': "McCance and Widdowson's Composition of Foods Integrated Dataset 2021 (CoFID)",
        'publisher': 'Office for Health Improvement and Disparities / Public Health England',
        'licence': 'Open Government Licence v3.0',
        'per': '100 g edible portion',
        'foods': foods,
    }, separators=(',', ':'), ensure_ascii=False))
    print(f'Wrote {len(foods)} foods to {OUT}')

if __name__ == '__main__':
    main(sys.argv[1])
