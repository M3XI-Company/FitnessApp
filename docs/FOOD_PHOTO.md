# Snap your meal — setup, accuracy and cost

## How it works
1. The app downsizes the photo to 1024 px JPEG (~10–150 KB) and posts it to the `food-photo` Supabase Edge Function.
2. The function calls **Claude Opus 5.5** (vision) with a strict JSON schema. The model returns, per food: a name, CoFID-style search words, estimated grams, a confidence level and a note. It never returns calories.
3. The app matches each item to the bundled **UK CoFID 2021** database, shows confidence and alternatives, and lets the user fix grams before logging. Entries are stored as estimates.

Safeguards: JPEG-only input with a size cap, per-device monthly cap (`FOOD_PHOTO_MONTHLY_LIMIT`, default 30), hashed device ids, server-side refusal fallback, no image storage, usage/cost ledger.

## Deploy (one-off)
```bash
npm install -g supabase
supabase link --project-ref YOUR-PROJECT-REF
supabase db push                                   # creates the ai_usage table
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...  # never put this in the app
supabase functions deploy food-photo
```
Then copy `.env.example` to `.env` with your project URL and anon key, and restart `npx expo start`.

## Accuracy — what to expect
- Identifying common foods from a clear overhead photo is usually reliable; **portion size is the weak point** (a photo can't show depth, hidden oil or what's under other food). That's why grams are always editable and low-confidence items are flagged.
- Before launch, measure on a labelled set of ~100 UK meals (weighed portions): target top-match food ID ≥ 80% and median calorie error ≤ 25% (spec risk R3). Tune the prompt and effort level against that set.

## Cost per scan (estimate — confirm with the `ai_usage` ledger)
Claude Opus 5.5 is $4 per million input tokens and $20 per million output tokens.

| Part | Tokens (approx.) | Cost |
|---|---|---|
| 1024×768 image | ~1,050 input | ~$0.004 |
| System prompt + schema + question | ~800 input | ~$0.003 |
| Structured answer + reasoning (effort `medium`) | ~500–1,000 output | ~$0.010–0.020 |
| **Per scan** | | **≈ $0.02–0.03 (≈ 2p)** |

At the default cap of 30 scans/month, a heavy user costs up to ~$0.90/month. Suggested tiers: **free 5 scans/month, Premium 90** (set `FOOD_PHOTO_MONTHLY_LIMIT` per tier once accounts and entitlements exist). Levers if cost needs to come down: lower `effort` to `low` after checking accuracy on the test set, and keep images at 1024 px.
