# Tide — Product Brief

**One line:** a calm, blue fitness app that combines calorie tracking, strength training and an AI coach, so you don't need three separate apps.

**For:** people who lift and watch what they eat (cutting, maintaining or building muscle) and are tired of switching between a calorie counter, a workout log and a water app.

**Design:** Cal AI–style big numbers and Apple-style layout (large titles, grouped cards, rings, native sheets, haptics), in one blue colour. No ads, no upsell walls.

## What it does

| Pillar | Features |
|---|---|
| **Eat** | Calorie and macro tracking with a "calories left" hero, a food diary by meal, food search and manual entry, a **barcode scanner** (Open Food Facts) and a **product scanner** (0–100 score, A–E grade, traffic lights, fit to your remaining calories) |
| **Plan** | **Boxed meals** you can plan up to 7 days ahead, an **ingredients** shopping list grouped by aisle, a **water tracker** and a timed **water plan** |
| **Train** | A library of 36 exercises with filters, **sets and reps logging**, a suggested weight and reps for next session, PR detection, estimated 1-rep-max trends, body weight |
| **Grow** | XP and levels, streaks, custom **goals**, achievements |
| **Coach** | An **AI Trainer** that reads your data (workouts with weights from your history, macro advice, progress reviews) and a **Filtered Buddy** finder (goal, level, time of day, distance, match %) |

## Why it wins (vs. YAZIO)
YAZIO covers nutrition well, but training is an afterthought and its advice is generic. Tide adds full training progression, product verdicts instead of raw numbers, a meal plan that produces your shopping list, coaching based on your own logs, and social accountability. Full analysis: `docs/YAZIO_CASE_STUDY.md`.

## Status
- **Built:** an Expo (React Native + TypeScript) app for iOS and Android. All features above work, data is saved on the device, and typecheck and lint pass.
- **Placeholders:** the AI Trainer is a rule-based engine on the device that is ready to be swapped for a model (LLM) on a server. Buddy profiles are sample data.
- **Repo:** https://github.com/M3XI-Company/FitnessApp

## Next
1. Accounts and a backend (cloud sync, real buddy matching and chat)
2. LLM coach + AI photo meal logging
3. Apple Health / Health Connect sync
4. Fasting timer and recipes
5. EAS builds → TestFlight / Play internal testing
