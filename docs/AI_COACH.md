# AI coach and the daily routine — how it works, setup and cost

## The daily routine
- Every user has a **weekly routine**: for each day, either a rest day or a list of exercises with sets and a rep range (`src/lib/routine.ts`).
- The first routine is built on the phone from the onboarding profile: training days per week come from the activity level (3, 4 or 5), and the goal adjusts it (a short conditioning finisher for fat loss, an extra set on the main lifts for muscle gain).
- The **Today** view on the Fitness tab shows today's part as a checklist. An exercise is ticked once its sets are ticked on its own screen; when all are ticked the day is complete. Days are saved as sets are logged, so the week strip and the streak reflect what was done.
- The **streak** counts consecutive days the routine was kept. Planned rest days keep it going; today not being finished yet does not break it.
- **Weights are never typed in.** A first session starts from body weight (`startingWeight` in `src/lib/progress.ts`), later sessions follow double progression (`nextTarget`). The starting fractions are conservative estimates and should be reviewed by a qualified coach before launch.

## The AI coach
1. The Coach tab sends the last 16 chat messages and a compact picture of the user to the `coach` Supabase Edge Function: sex, age, height, weight, goal, activity, calculated targets, current routine, recent consistency, and the app's exercise and recipe lists. **No name, no photos, no free-text profile fields.**
2. The function calls **Claude Opus 5.5** with a strict JSON schema built per request, so the model can only name exercise and recipe ids the app actually has. It returns a reply and, when the user asked for one, a weekly routine and/or meals for the coming week.
3. The app validates every proposal again (`sanitiseRoutine`: unknown exercises dropped, 1–5 sets, at most 8 exercises a day, at least one rest day) and shows it as a card. **Nothing changes until the user taps "Use this routine" / "Use this meal plan".**
4. The model never sets weights (progression rules do) and never invents calorie numbers (the app calculates targets).

Safeguards: input size caps, per-device monthly cap (`COACH_MONTHLY_LIMIT`, default 150 messages), hashed device ids, server-side refusal fallback, nothing stored but a usage/cost row. The system prompt keeps the coach to general fitness guidance, sends health questions to a GP, refuses rapid weight loss and very low calorie plans, and points people who describe disordered eating to their GP or Beat.

Without the server configured, or when it cannot be reached, the app falls back to the **built-in rule-based coach** and says so.

## Deploy (one-off)
```bash
supabase link --project-ref YOUR-PROJECT-REF
supabase db push                                   # creates the ai_usage table (shared with food-photo)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...  # never put this in the app
supabase functions deploy coach
```
Then copy `.env.example` to `.env` with your project URL and anon key, and restart `npx expo start`.

## Cost per message (estimate — confirm with the `ai_usage` ledger)
Claude Opus 5.5 is $4 per million input tokens and $20 per million output tokens.

| Part | Tokens (approx.) | Cost |
|---|---|---|
| System prompt + schema | ~1,800 input | ~$0.007 |
| User context (profile, routine, 36 exercises, 22 recipes) | ~2,500 input | ~$0.010 |
| Conversation so far (up to 16 messages) | ~200–2,000 input | ~$0.001–0.008 |
| Reply, plus reasoning (effort `medium`) | ~300–1,500 output | ~$0.006–0.030 |
| **Per message** | | **≈ $0.02–0.06 (≈ 2–5p)** |

A reply that includes a full routine or meal plan is at the top of that range. At the default cap of 150 messages a month, a heavy user costs up to roughly $9. Set `COACH_MONTHLY_LIMIT` per tier once accounts and subscriptions exist. The system prompt and context could be prompt-cached to cut input cost on follow-up messages; that is not done yet.

## Not built yet
- **Conversation-led onboarding**: the first routine still comes from the onboarding form, not from a chat.
- **Body photos**: nothing is sent or analysed.
- **Accounts**: limits are per device until sign-in exists.
- **Evaluation**: before launch, have a qualified coach and a registered dietitian review a sample of generated routines and meal plans, including edge cases (injury, pregnancy, under-18, very low body weight).
