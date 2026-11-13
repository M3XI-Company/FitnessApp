# Breeze: food-first audit and proposal

*Response to the "Breeze Master Product & Development Specification". This is for review before substantial implementation starts.*

**Direction:** Understand your food → Discover your meals → Track your progress. Food becomes the centre; fitness and community support it. The Breeze identity (cream, warm white, black, champagne gold, handwritten headings) stays.

---

## 1. Audit of the current app

**Architecture today:** Expo SDK 58 (React Native, TypeScript) with Expo Router. All data is stored on the phone (AsyncStorage, one reducer store). There are no accounts and no backend, apart from one Supabase Edge Function for photo recognition. There are no payments.

**Navigation today:** Today · Food · ⊕ Quick add · Train · Coach. Plans, Profile, Scanner, Add/Edit food, the photo scanner and the form check are modal screens.

### Keep as it is
| Area | Why |
|---|---|
| Design system (`src/theme.ts`, `src/components/ui.tsx`) | Already matches the brand brief |
| UK food database: CoFID 2021, 2,854 foods, Open Government Licence | Identifiable, licensed source; logging by grams |
| Barcode/product scanner (UK Open Food Facts) | Real lookups, UK warning, attribution |
| Food photo (Claude vision → CoFID) | AI gives names and grams only; nutrition comes from the database; marked as an estimate |
| Editable diary entries, meal slots, calorie/macro rings | Core of Priority 1 |
| Licences screen, health notice, age policy, buddy safety | Spec §10 is largely in place |
| Fitness: 3D trainer, form check, progression | Moves to a supporting Fitness tab |

### Needs improvement
| Area | Issue |
|---|---|
| **Nutrition maths in several places** | Totals are summed in `progress.ts`, recalculated in screens, and scaled differently in Add food, Edit food, the scanner and the photo scanner. **One shared, tested nutrition module** is needed so totals always agree (spec §12). |
| Targets | Calculated (Mifflin–St Jeor), but you can't edit them, and the assumptions behind them aren't shown. |
| **Boxed meals** (9 recipes) | Calories and macros were **typed in by hand**, not calculated from the ingredients, and nothing is per serving. They are not trustworthy enough for "Add to diary". |
| Demo data | Two weeks of sample history are **seeded into every install**, and the buddies are sample profiles. These must be clearly labelled as demonstration data and switched off in production builds (spec §12). |
| Home screen | Mixes water, XP and shortcuts; food isn't the clear priority. |
| Imagery | Emoji only, with no food photography. |

### Needs adding
- Saved meals, favourite foods, custom meals, custom meal categories, and a "copy yesterday" option.
- **Recipe library**: searchable by nutritional need, with servings, prep/cook time, allergens, dietary labels, cost estimates and **Add to food diary**.
- **Ready-meal marketplace**: a provider catalogue, listings, nutrition filters, macro-aware ranking with reasons, external ordering and affiliate links, and labelling of sponsored listings.
- Social around food: sharing meals and recipes, following, food challenges (on top of buddies).
- Premium and affiliate plumbing (later).

### Needs architectural change
1. **Single nutrition engine** (`src/lib/nutrition/`): scale by grams or servings, recipe totals from ingredients, daily totals, rounding rules. Every screen uses it, backed by unit tests.
2. **Recipes calculated from ingredients:** every ingredient points to a CoFID food (or a licensed product) with grams. Calories and macros per serving are **calculated, never typed in**; allergens and dietary labels come from the ingredients.
3. **Catalogue data that is versioned and remote-ready:** recipes and provider listings live as typed JSON content now (bundled), with the same shape the Supabase tables will use later. Adding a provider means adding data, not rewriting code.
4. **Accounts and backend (Supabase)** before social sharing, the marketplace's live content and premium. The current spec review (M1) already covers the schema and security rules.
5. **Fixtures kept apart from real data:** demo history, sample buddies and any placeholder listings go behind a "Demo data" switch that is off in production builds.

---

## 2. Proposed architecture (food side)

```
Food (CoFID | Open Food Facts | user) ─┐
                                       ├─ nutrition engine ─► diary entries ─► daily totals ─► dashboard
Recipe ── ingredients (food + grams) ──┘        ▲
  servings, times, steps, labels, cost          │
                                                │ "Add to diary" (servings × per-serving values)
Provider ── ProviderMeal (label nutrition,      │
  price, allergens, availability, link) ────────┘ "I ate this"
        └─ Listing (organic | sponsored, ranking explanation)
```

**Key types:**
- `Recipe {id, title, photo, description, servings, prepMin, cookMin, ingredients[{foodId, grams, display}], steps[], categories[], dietLabels (derived), allergens (derived), costPerServing?, source}`
- `Provider {id, name, website, affiliateProgram?, status: 'prospective' | 'partner'}`
- `ProviderMeal {id, providerId, name, photo, price, nutrition (from the provider's label), ingredients, allergens, dietLabels, availability?, orderUrl, lastVerifiedAt}`
- `Listing {mealId, sponsored: boolean, campaignId?}`
- `SavedMeal`, `FavouriteFood`, `MealCategory {id, name, order}`

**Recommendations:** score each recipe or meal against the **remaining** targets, not calories alone. Fit to calories left, protein per 100 kcal against the protein you still need, carbs and fat within what's left, and the user's preferences and allergens as hard filters. Each card shows **why**, for example "32 g protein, fills 60% of the protein you have left, 480 kcal fits your remaining 650". Sponsored items are marked *Sponsored* and never change the organic ranking.

---

## 3. Navigation and screen changes

| Tab | Content |
|---|---|
| **Home** | Calories remaining (hero) with protein/carbs/fat; *Log food* row (search, barcode, photo); **Meals that fit your day** (recipes plus ready meals ranked for your remaining macros); recent meals; a small fitness and community strip |
| **Food** | Diary by meal (custom categories), saved meals and favourites, copy previous day, editable targets with the assumptions shown, water |
| **Recipes** | Search, plus filters (high protein, muscle building, weight management, pre-/post-workout, under 15 min, budget, vegetarian, vegan), sorting by fit; recipe page with servings stepper, **Ingredients / Method** tabs, timers, allergens, cost, and **Add to diary** |
| **Fitness** | Existing Train tab: library, 3D trainer, form check, progress, AI trainer |
| **Social** | Gym buddies (18+, existing safety features), shared meals and recipes, following, food challenges |

Ready meals: either a *Ready meals* segment at the top of Recipes ("Cook | Order"), or a section in Food. See decision 1.

**Recipe page** (following your reference): hero photo → title and author → servings stepper → time, kcal, protein, cost chips → *Ingredients / Method* switch → checklist ingredients → numbered steps with optional timers → sticky **Add to diary** button (choose meal and servings, values calculated automatically).

---

## 4. Build plan (your priority order)

| Phase | Deliverable | Done when |
|---|---|---|
| **P1 Core food** | Nutrition engine and tests; editable targets with assumptions; saved meals, favourites, custom meals and categories; copy day; new Home; demo-data switch | Unit tests prove totals match everywhere (diary, dashboard, recipe, scanner, photo) to 0.1 g / 1 kcal |
| **P2 Recipes** | Recipe model calculated from CoFID ingredients; library of ~30 launch recipes; filters and fit ranking; recipe page; Add to diary | Adding 1.5 servings logs exactly 1.5 × per-serving values; allergens derived from the ingredients |
| **P3 Ready meals** | Provider and listing model; catalogue screens; filters; macro-aware ranking with reasons; external order links; sponsored labelling | A new provider is added by data only; no price or availability is shown unless it comes from that provider's data |
| **P4 Social** | Accounts (Supabase), sharing meals and recipes, following, challenges, plus existing buddies | Private by default; block and report covers shared content |
| **P5 Commercial** | Premium (RevenueCat), affiliate tracking, sponsored placements | Only after agreements exist |

**UK providers (MuscleFood, Prep Kitchen, Frive):** treated as **prospective**. In P3 I'll check their public affiliate programmes and whether they publish nutrition data. Until there's an agreement or permission, Breeze will **not** show their prices, photos or availability. Their names won't appear as partners, and order buttons will only link to their public websites.

---

## 5. Decisions needed before building

1. **Where ready meals live:** a "Cook | Order" switch inside a **Recipes** tab (keeps five tabs as you proposed), or its own **Discover** tab.
2. **Food photography:** your own shoot, licensed stock (for example Adobe Stock or a royalty-free library with commercial terms), or neutral typographic cards until photos exist. I won't use images found online without a licence.
3. **Recipe content:** who writes and checks recipes. Nutrition will be calculated from CoFID automatically, but a nutritionist should review the launch set.
4. **Ready meals before partnerships:** launch the section with clearly labelled *demo listings* in test builds only, or hide it in production until the first provider agrees.
