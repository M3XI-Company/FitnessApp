# AI Fitness Companion spec: review, gap analysis and MVP plan

*Reviews the "AI Fitness Companion — Product Specification" against the current Tide codebase, as section 10 of the spec asks.*

> **Update (Breeze by M3XI):** the decisions in §3 are made — name **Breeze**, sky-colour design (originally cream and gold) with handwritten type, UK-first, 16+ app with **18+ buddy discovery and messaging** and no adult–minor matching, community as a core feature (not a dating app). Since this review, the app has gained UK CoFID data and licence compliance, a 3D trainer, on-device camera form feedback, a food photo scanner, and buddy safety tooling (block, report, meeting guidelines). See `docs/SAFETY_AND_PRIVACY.md` and `docs/FOOD_PHOTO.md`. The risks in §4 still apply to launch, chiefly real-world accuracy (R2, R3) and moderation (R4).

---

## 1. Summary

- **About 45% of the spec's MVP surface already exists** in Tide: nutrition tracking, barcode scanning, the exercise library with set/rep progression, XP and goals, a rule-based coach and a buddy finder UI. All of it runs on the device only, with no accounts and no backend.
- **The biggest gaps** are the **3D workout companion** (none today), **accounts and backend** (none), **AI built on a real model** (the coach is rule-based), **food photo logging**, the **ingredient-based meal generator**, **real community features** with safety tooling, **monetisation**, and **health and safety disclaimers** (missing entirely; this needs fixing now).
- **Recommendation:** keep the existing app and add to it. Do not rewrite. Ship an MVP whose differentiator is a **3D exercise demonstration player built on a pre-made animation library**. **Defer camera pose estimation and automatic rep counting** to a post-MVP spike. They carry the highest technical risk and the highest safety exposure, and are the hardest to make reliable across devices.
- **Decisions needed from you** are listed in §3.

---

## 2. Gap analysis

Status: ✅ built · 🟡 partial · ❌ missing

### 2.1 Interactive 3D workout companion
| Spec item | Status | What exists | What's needed |
|---|---|---|---|
| 3D character demonstrates exercises | ❌ | Text form cues per exercise (`src/data/exercises.ts`) | 3D renderer, rigged character, reviewed animation clips |
| Rotate and inspect from different angles | ❌ | — | Orbit camera controls |
| Playback speed, steps, sets/reps, rest timers | 🟡 | Set and rep logging, next-session target (`src/app/exercise/[id].tsx`) | Playback controls, rest timer, guided step-by-step mode |
| Camera pose estimation and form cues | ❌ | — | **Post-MVP spike** (see §4) |
| Automatic rep counting with manual correction | ❌ | Manual logging only | Post-MVP, depends on the pose spike |
| Accessibility and low-impact alternatives | ❌ | Level tag on each exercise | `alternatives[]` and a low-impact flag per exercise |
| Content reviewed by professionals | ❌ | Exercises and cues were written without professional review | Review workflow and a `reviewed_by`/`reviewed_at` field |

### 2.2 Gym buddy and local community
| Spec item | Status | What exists | What's needed |
|---|---|---|---|
| Gym or area discovery with privacy controls | 🟡 | Filter UI by distance, goal, level and time (`coach.tsx`), using **sample data** | Gym directory, coarse location, visibility settings |
| Profiles (interests, goals, level, times) | 🟡 | Sample profile shape (`src/data/buddies.ts`) | Real profiles in the backend |
| Match/connect | 🟡 | Local Connect toggle and match % | Requests, accept/decline, mutual connection |
| Group workouts, weekly schedule, join requests | ❌ | — | Sessions, schedule and requests tables |
| Share routines, meal plans and progress | ❌ | — | Post-MVP (§2.5) |
| Blocking, reporting, moderation, contact controls | ❌ | — | **Required before any real social feature ships** |

### 2.3 AI meal generator
| Spec item | Status | What exists | What's needed |
|---|---|---|---|
| A. Build a meal from chosen ingredients | ❌ | — | Ingredient picker, then an LLM generates the recipe **and** nutrition is calculated from a database |
| Preferences (calories/protein, diet, budget, time) | 🟡 | Calorie and protein targets exist; boxed meals have tags and time | Diet, allergy and budget preferences |
| B. Personalised recommended meals | 🟡 | 9 boxed meals with tags (`src/data/boxedMeals.ts`) | A larger catalogue, personalised ranking |
| Save, add to plan, shopping list | 🟡 | 7-day boxed plan and a shopping list grouped by aisle (`plans.tsx`) | Saved meals; plans that hold generated meals |
| Nutrition labelled as an estimate; allergies respected | ❌ | — | "Estimate" labels, allergen filter as a hard constraint |

### 2.4 Calorie and nutrition tracking
| Spec item | Status | What exists | What's needed |
|---|---|---|---|
| Food photo logging | ❌ | — | Vision model identifies the food, a database supplies the values, the user confirms. Show uncertainty |
| Barcode scanning | ✅ | expo-camera with Open Food Facts lookup (`src/lib/products.ts`) | Check licensing (§4, R5) |
| Manual search and entry | 🟡 | 36 local foods plus manual entry | Search a real database |
| Daily calorie and macro dashboards | ✅ | Today and Food tabs | — |
| History, saved meals, recurring foods | 🟡 | History by date, "Recent" list | Saved meals, favourites |
| Edit portions, ingredients, AI estimates | 🟡 | Quantity can only be set when adding; entries can be deleted | Edit entries after logging |

### 2.5 Workout and nutrition sharing
| Spec item | Status | What's needed |
|---|---|---|
| Publish, save and copy routines and meal plans; follow creators; quality checks | ❌ | All post-MVP. Needs a backend, moderation and a review queue |

### 3. Retention
| Spec item | Status | What exists | What's needed |
|---|---|---|---|
| Customisable avatar and cosmetics | ❌ | — | Reuse the 3D character rig from §2.1 (post-MVP) |
| XP, streaks, achievements, milestones | ✅ | `src/lib/progress.ts`, `profile.tsx` | Move into the backend so it can't be faked |
| Weekly challenges, personal goals | 🟡 | Personal goals ✅; weekly challenges ❌ | A challenges table |
| Reward consistency, recognise rest days | 🟡 | XP rewards consistent logging | Rest-day credit, cap XP for excessive training |
| One assistant that explains its recommendations | 🟡 | Rule-based coach that reads real data and partly explains itself (`src/lib/coach.ts`) | Model-backed assistant with tools, structured outputs and "why" text |

### 4. Navigation
| Spec | Tide today | Gap |
|---|---|---|
| Home | Today tab: goals, calories, water, progress, shortcuts | Add a recommended workout and the next scheduled session |
| Workout | Train tab: library and progress | 3D trainer, programmes, timers |
| Nutrition | Food tab plus Plans | Meal generator, photo logging |
| Community | Inside the Coach tab | Becomes its own tab; the AI assistant moves to Home or a floating action |
| Profile | Profile sheet | Avatar, privacy settings, subscription |

### 5–7. Monetisation, platform and production requirements
| Area | Status | Notes |
|---|---|---|
| Freemium paywall and entitlements | ❌ | RevenueCat recommended for App Store and Play subscriptions |
| Accounts, auth, sync (Supabase) | ❌ | Data currently lives on the device (AsyncStorage) |
| **Health and safety disclaimers** | ❌ | **None in the app today. Add in M0.** |
| Consent, privacy and GDPR (data export, deletion) | ❌ | Required before accounts ship |
| Offline use for saved workouts | ✅ | Everything works offline today |
| Analytics | ❌ | Event plan in §8 |
| Accessibility | 🟡 | Accessibility labels on icon buttons, haptics. No captions or dynamic type audit yet |

---

## 3. Conflicts and decisions needed

1. **Visual direction.** The reference images show a **dark, purple and teal premium UI**. You originally asked for **blue, Cal AI × Apple** (light). Options: (a) keep light blue and add a dark mode, (b) switch to dark-first blue, (c) adopt the purple palette. *Recommendation: (b) dark-first in Tide blue.* The 3D trainer reads far better on dark backgrounds, and the colour stays yours.
2. **Name.** The references use "FitBuddy" and "AI Fitness Companion" as placeholders, and the spec says not to treat them as approved. Keep **Tide** unless you decide otherwise. (A trademark search is needed before you commit to either.)
3. **Wii Fit inspiration.** Take the *interaction model* (follow-along character, calm encouragement). Use an **original character and visual style**. Do not imitate Nintendo's Mii or Wii Fit trainer designs.
4. **Minimum age.** It must be set before buddy discovery is built. *Recommendation: 18+ for community features* (16+ for the solo app if you want it). This avoids most safeguarding complexity.
5. **Market.** Pricing is in GBP, so assume **UK/EU first**. That means UK GDPR, and nutrition data must cover UK products.

---

## 4. Highest-risk unknowns (spike before committing)

| # | Risk | Why it's risky | Spike (time-boxed) | Go/no-go criteria |
|---|---|---|---|---|
| R1 | **3D character inside an Expo app** | Unity-as-a-library is heavy and has complex native builds. Three.js through `expo-gl` / React Three Fiber has unknown performance on mid-range Android | 1 week: one rigged character with 3 clips (squat, push-up, lunge) in R3F on device, plus a Unity comparison if R3F fails | ≥ 50 fps on an iPhone 12 and a Pixel 6a-class phone; under 3 s to first frame; adds under 15 MB to the app |
| R2 | **Pose estimation** (MediaPipe / MoveNet) | Needs a native frame processor (react-native-vision-camera), which rules out Expo Go. Accuracy depends on angle, lighting and clothing. Real liability risk if form cues are wrong | 2 weeks, **after the MVP**: squat-only rep counting on 10 testers | ≥ 95% rep-count accuracy front-on; cues shown only above a confidence threshold; no footage stored |
| R3 | **Food photo accuracy** | Portion size can't be read reliably from a photo, and each scan has a model cost | 1 week: vision model identifies food items → database lookup → user confirms portion | Correct top-3 food ID ≥ 80% on a 100-photo UK test set; user correction in ≤ 2 taps |
| R4 | **Community safety and moderation** | Meeting strangers in person creates safeguarding duties and ongoing moderation cost | Policy design, not code: block, report, rate limits, visibility of only an approximate gym/area | Report handled within 24 h; exact location never shown |
| R5 | **Nutrition data licensing and coverage** | Open Food Facts is ODbL (share-alike obligations). FoodData Central is US-centric | Check UK barcode hit rate on 200 products; legal review of ODbL use | ≥ 85% UK barcode hit rate; licence compatible with a closed app |
| R6 | **AI cost per user** | Chat, photo logging and meal generation scale with engagement | Instrument tokens per feature from day one (§9) | AI cost per paying user ≤ 15% of revenue |
| R7 | **Exercise content review** | The spec requires professional review; Tide's 36 exercises and cues have not been reviewed | Hire a qualified coach to review the library | Every exercise has `reviewed_at` before launch |

---

## 5. Challenged assumptions

- **"The 3D companion is the main differentiator."** Agreed, but *demonstration* and *camera feedback* are different products. Demonstration from a pre-made animation library is achievable in the MVP. Camera form feedback is a research problem with safety exposure. **Ship demonstration first; earn the right to do feedback.**
- **"Photo logging in the MVP."** Cal AI proves demand, but it is a per-scan cost and an accuracy liability. Ship it **behind the Premium limit** with clear "estimate" labelling, and keep barcode and search as the reliable free path.
- **"Social sharing and following creators."** This is a second product (content, feeds, moderation). It adds little to the solo user, and the spec's own principle says the app must work alone. **Cut from the MVP.**
- **"Avatar cosmetics as purchases."** This complicates App Store review and pricing before there's any engagement data. Unlock cosmetics through achievements only for now.
- **"Unity or Three.js."** Unity gives better tooling but doubles the native build complexity. Try R3F first and use Unity only if R1 fails.

---

## 6. Recommended MVP and milestones

**MVP is in:** accounts, onboarding with consent, nutrition (search, barcode, edit, dashboards), a reviewed exercise library with a **3D demo player** and timers, a model-backed assistant, the meal generator (ingredients → meal), buddy discovery and session requests **with block and report**, XP and streaks, the paywall.
**MVP is out:** pose estimation, automatic reps, social feed and sharing, creators, cosmetic purchases, photo logging on the free tier.

| Milestone | Scope | Acceptance criteria |
|---|---|---|
| **M0 — Hardening (now)** | Health and safety disclaimers; "estimate" labels; editable food entries; rest timer; analytics SDK; remove sample data from production builds | Disclaimer shown in onboarding and on AI and exercise screens; any food entry can be edited in ≤ 3 taps; rest timer survives the app going to the background |
| **M1 — Foundations** | Supabase auth (Apple, Google, email), schema below, migrate AsyncStorage to sync, consent screens, data export and deletion | Fresh install → account → data synced to a second device within 5 s; "Delete account" removes all rows within 30 days; RLS tests pass |
| **M2 — Nutrition MVP** | UK food database search, saved meals, favourites, allergy and diet profile | Search returns a result for ≥ 90% of a 100-item UK test list; allergens are never suggested |
| **M3 — Workout MVP + 3D player** | R1 spike → 3D player (rotate, ×0.5/×1 speed, steps), reviewed library v1 (≥ 30 exercises), programmes, timers | ≥ 50 fps on reference devices; every exercise reviewed; a programme can be started, completed and logged |
| **M4 — AI personalisation** | Assistant on a server-side LLM with tools (read goals, logs, schedule); next-workout / meal / rest-day suggestions with "why"; ingredient meal generator | Responses use structured output; every suggestion explains its reason; nutrition comes from the database (the model never invents values); p95 latency < 6 s; red-team set of 50 risky prompts passes |
| **M5 — Community MVP** | Gym/area selection, profiles, buddy requests, weekly schedule and join requests, block, report, admin queue | No exact location anywhere in the API; a blocked user can't see or contact you; a report reaches the admin queue within 1 min |
| **M6 — Monetisation + retention** | RevenueCat paywall, entitlements, 7-day trial, weekly challenges, rest-day credit | Purchase, restore and cancel work on iOS and Android sandbox; Premium features are gated on the server, not only in the app |

---

## 7. Proposed data model (Supabase / Postgres)

```
profiles(id uuid PK → auth.users, display_name, birth_year, sex, height_cm, activity,
         goal, target_weight_kg, units, diet_tags text[], allergens text[],
         visibility enum('private','gym','area'), created_at)
consents(user_id, kind enum('terms','health','location','camera','analytics'), granted_at, revoked_at)
targets(user_id PK, kcal, protein_g, carbs_g, fat_g, water_ml, updated_at)

foods(id, source enum('fdc','off','custom','ai'), external_id, name, brand, barcode,
      per100 jsonb, serving_g, grade, licence)
food_entries(id, user_id, eaten_on date, meal_slot, food_id NULL, name, qty, serving_g,
             kcal, protein_g, carbs_g, fat_g, is_estimate bool, source, created_at)
saved_meals(id, user_id, name, items jsonb)
water_logs(user_id, day, ml)  weight_logs(user_id, day, kg)

exercises(id, slug, name, muscle, equipment, level, rep_range int4range, step_kg,
          cues text[], alternatives text[], low_impact bool, animation_clip_id,
          reviewed_by, reviewed_at)
animation_clips(id, exercise_id, uri, duration_ms, version)
programmes(id, owner_id NULL, name, weeks, days jsonb, is_public, reviewed_at)
workouts(id, user_id, programme_id NULL, started_at, ended_at)
sets(id, workout_id, user_id, exercise_id, weight_kg, reps, rpe NULL, source enum('manual','pose'))

meals(id, owner_id NULL, name, tags text[], minutes, ingredients jsonb, steps text[],
      nutrition jsonb, is_estimate bool, generated bool)
meal_plans(id, user_id, day, meal_id, slot)

gyms(id, name, area_geohash5, city)              -- area precision only (~5 km)
gym_members(user_id, gym_id, visible bool)
buddy_requests(id, from_id, to_id, status enum('pending','accepted','declined'), created_at)
sessions(id, host_id, gym_id, starts_at, focus, capacity, visibility)
session_requests(session_id, user_id, status)
blocks(blocker_id, blocked_id)
reports(id, reporter_id, target_type, target_id, reason, status, created_at)

xp_events(id, user_id, kind, amount, created_at)  -- XP is calculated on the server
achievements(user_id, key, unlocked_at)
challenges(id, week, kind, target)  challenge_progress(user_id, challenge_id, value)
ai_usage(id, user_id, feature, input_tokens, output_tokens, cost_usd, created_at)
entitlements(user_id, product, status, expires_at)  -- written by the RevenueCat webhook only
```

**RLS rules (summary)**
- Personal tables (`food_entries`, `sets`, `water_logs`, etc.): `user_id = auth.uid()` for every operation.
- `profiles`: the owner has full access. Others can read only a **public view** (display name, goal, level, preferred times, gym), and only if `visibility != 'private'` and no block exists in either direction.
- `buddy_requests`, `sessions`, `session_requests`: visible to the participants and blocked as above. Rate limit: 20 requests per day.
- `xp_events`, `achievements`, `entitlements`, `ai_usage`: **read-only for clients**. Only server functions or webhooks write to them.
- `exercises`, `animation_clips`, reviewed `programmes` and `meals`: public read; writes by admins only.

## 8. API boundaries

| Path | Where | Why |
|---|---|---|
| CRUD on personal data | Client → Supabase directly (RLS) | Simple; RLS enforces ownership |
| `POST /assistant` | Edge function → LLM with tools | API key stays on the server; tool calls read user data; structured output; usage and cost logged |
| `POST /meal-generate` | Edge function | LLM proposes a recipe → server calculates nutrition from `foods` → returns it marked `is_estimate` |
| `POST /food-photo` | Edge function | Vision model returns food labels → database match → candidates for the user to confirm; the image is discarded after processing |
| `GET /barcode/:code` | Edge function (cached) | Hides the provider, caches results, respects licensing |
| `POST /xp` | Database trigger / function | Prevents faked XP and streaks |
| RevenueCat webhook | Edge function | Single source of truth for `entitlements` |
| Pose estimation (later) | **On the device only** | No video leaves the phone |

## 9. Analytics events

`onboarding_step_completed{step}` · `account_created{method}` · `consent_changed{kind,granted}` · `food_logged{source,meal_slot,is_estimate}` · `food_entry_edited{field}` · `barcode_scanned{found}` · `photo_log_attempted{accepted,edited}` · `workout_started{programme?}` · `set_logged{exercise,source}` · `workout_completed{duration,sets}` · `demo_3d_viewed{exercise,rotated,speed}` · `assistant_message{intent,latency_ms,tokens}` · `meal_generated{ingredients_n,saved}` · `buddy_request_sent` · `buddy_request_accepted` · `session_joined` · `user_blocked` · `report_submitted{type}` · `paywall_viewed{trigger}` · `trial_started` · `subscription_started{plan}` · `subscription_cancelled`

**North-star metrics:** weekly active loggers (≥ 3 days of logs per week), workout completion rate, Week-4 retention, trial → paid conversion, AI cost per paying user.

## 10. Cost model (assumptions — validate against current vendor pricing)

Monthly AI cost per user = Σ over features of (uses per month × tokens or images per use × unit price).

| Feature | Assumed use per active user / month (free · premium) | Control |
|---|---|---|
| Assistant chat | 10 · 60 messages | Small model for routing and simple Q&A; larger model only for plan generation; cache user context |
| Meal generation | 4 · 30 | Cache popular ingredient combinations |
| Photo logging | 5 · 90 images | Hard monthly cap; downscale images before upload |
| Barcode lookups | unlimited | Cached; effectively free |

At £7.99/month, after app-store fees (15% under the small-business programme, otherwise 30%) and VAT, net revenue per paying user is roughly £4.65–5.65 (£6.66 ex-VAT × 70–85%). **Target total AI + infrastructure cost ≤ £0.80 per paying user per month**, and **≤ £0.05 per free user**. Feature caps for each tier are set from the M4 measurements in `ai_usage`.

---

## 11. Immediate next steps

1. You decide the four items in §3 (theme, name, age gate, market).
2. Ship **M0 hardening** in the current app (disclaimers, estimate labels, editable entries, rest timer). This is low risk and can start immediately.
3. Run spike **R1 (3D in Expo)** in parallel, because it decides the workout architecture.
4. Set up Supabase (M1) with the schema and RLS above.
