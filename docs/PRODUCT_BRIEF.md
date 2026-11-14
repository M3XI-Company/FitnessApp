# Breeze — Product Brief

*A fitness and wellness app by M3XI.*

**One line:** a calm fitness and wellness app that brings food, training, form coaching and a safe gym community together in one place.

**For:** people who lift and watch what they eat (cutting, maintaining or building muscle) and are tired of switching between a calorie counter, a workout log and a water app.

**Design:** sky colours (dawn peach, day blue, night navy) on cloud white, with handwritten notebook-style headings and professional line icons; Cal AI–style big numbers on an Apple-style layout. No ads, no upsell walls.

**Ages:** 16+ for the app; 18+ for gym buddy discovery and messaging, with no adult–minor matching. Breeze is a fitness community, not a dating app.

## What it does

| Pillar | Features |
|---|---|
| **Eat** | Calorie and macro tracking, an editable food diary, **2,854 UK foods (CoFID)**, **barcode and product scanner** (UK Open Food Facts), and **Snap your meal** (AI photo recognition with UK nutrition data) |
| **Plan** | **Boxed meals** you can plan up to 7 days ahead, an **ingredients** shopping list grouped by aisle, a **water tracker** and a timed **water plan** |
| **Train** | 36 exercises with a **3D trainer**, **camera form check** (on-device, nothing recorded), sets and reps logging, next-session targets, PRs, rest timer |
| **Grow** | XP and levels, streaks, custom **goals**, achievements |
| **Coach** | An **AI Trainer** that reads your data, and **gym buddies (18+)** with safety guidelines, approximate distance only, block and report |

## Why it wins (vs. YAZIO)
YAZIO covers nutrition well, but training is an afterthought and its advice is generic. Breeze adds a 3D trainer, camera form feedback, full training progression, product verdicts instead of raw numbers, a meal plan that produces your shopping list, coaching based on your own logs, and social accountability. Full analysis: `docs/YAZIO_CASE_STUDY.md`.

## Status
- **Built:** Expo app for iOS and Android with everything above; typecheck, lint and unit tests pass.
- **Needs set-up:** Snap your meal needs the Supabase function deployed with an Anthropic key (`docs/FOOD_PHOTO.md`).
- **Not yet validated:** camera form accuracy and photo portion accuracy on real people and meals; exercise cues need review by a qualified coach.
- **Placeholders:** the chat AI Trainer is rule-based; buddy profiles are sample data until the community backend exists.
- **Repo:** https://github.com/M3XI-Company/FitnessApp

## Next
1. Accounts and backend (Supabase): sync, real buddy matching, moderation queue, age assurance for 18+ features
2. Moderated fitness forum (16+), group workout scheduling, sharing routines and meal plans, following
3. Device studies: form-check accuracy and photo-scan accuracy/cost against labelled test sets
4. Subscriptions (RevenueCat) and per-tier AI limits
5. EAS builds → TestFlight / Google Play internal testing
