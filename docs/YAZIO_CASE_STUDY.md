# Case study: YAZIO, and where Tide fits

> Purpose: use YAZIO, one of the best-known calorie counters, as a benchmark. What does it do well, where are the gaps, and which product decisions in Tide come from that? This is a qualitative product review. It contains no figures about YAZIO's business.

## 1. What YAZIO is

YAZIO is a calorie counter and nutrition app. You set a goal (lose, maintain or gain weight), get a daily calorie and macro budget, and log food by search, barcode or recipe. It has a free tier and a PRO subscription. PRO adds features such as intermittent-fasting plans, meal plans and recipes, and deeper analysis.

## 2. Core loop

1. **Onboarding** → goal, body data, activity level → daily calorie budget
2. **Log** meals (breakfast, lunch, dinner, snacks) by search, barcode or favourites
3. **Feedback** → calories left, macro bars, summaries
4. **Retention** → streaks, reminders, fasting timers, recipes and plans

## 3. What it does well

| Strength | Why it matters | What Tide adopted |
|---|---|---|
| Fast, guided onboarding that ends with a concrete number | The user gets value before logging anything | Six-step onboarding that ends on a "Your plan is ready" calorie ring |
| Meal-slot diary | Matches how people think about eating | Breakfast, lunch, dinner and snacks, each with a per-meal budget |
| Barcode scanning | Logging packaged food takes seconds | Native camera scanner + Open Food Facts |
| Water tracking on the home screen | A habit you can complete in one tap | Water card on Today, plus a quick-add action |
| Fasting and meal plans as premium hooks | Structure keeps people coming back | Boxed meals + a 7-day planner (free) |

## 4. Gaps and opportunities

| Gap | Effect on the user | Tide's answer |
|---|---|---|
| Nutrition first, training second | Gym-goers need a second app for sets and reps | **Train tab** with a 36-exercise library, set logging, double progression and e1RM charts |
| Scanning tells you *what* is in a food, not *whether you should eat it* | Users must interpret the numbers themselves | **Product scanner** gives a 0–100 score, A–E grade, traffic lights, pros and cons, and fit to the calories you have left |
| Meal plans and shopping are separate steps | Planning work falls on the user | **Boxed meals → Ingredients**: plan boxes for the week and get a shopping list grouped by aisle |
| Water is a counter, not a plan | Easy to fall behind by the afternoon | **Water plan** sets glass times between your start and finish hours, with Due/Done states, and counts water from food |
| Coaching is generic content | Advice isn't tied to what you actually did | **AI Trainer** reads your logs: workouts use weights from your last sessions, food advice uses today's remaining macros |
| Solo experience | Accountability depends on willpower | **Filtered Buddy**: partners matched by goal, level, time of day and distance |
| Progress is mostly a weight graph | Long plateaus feel like failure | **XP, levels, achievements and goals** reward behaviour (logging, training, hydration), not only weight |

## 5. Design principles (Cal AI × Apple, in blue)

- **One number per screen.** The Today hero answers "how many calories do I have left?" in a single large figure, the way Cal AI does.
- **Apple information density.** Large titles, grouped inset lists, 22 px card radius, SF system font, tabular numbers, hairline separators.
- **One colour.** Blue (#0A6CFF) marks actions and progress. Macros use three related blues (protein, sky, indigo). Orange and red appear only for warnings.
- **Native feel.** Haptics on every tap, iOS page sheets for modals, a floating tab bar with a central quick-add button.
- **Calm by default.** Light background (#F2F5FA), white cards, soft shadows. No ads and no upsell walls.

## 6. Feature parity checklist

| Feature | YAZIO | Tide |
|---|---|---|
| Calorie & macro budget | ✓ | ✓ |
| Food search / barcode | ✓ | ✓ |
| Product health grade | partial | ✓ (score, grade, traffic lights, fit to your day) |
| Water tracker | ✓ | ✓ + scheduled plan |
| Meal plans | PRO | ✓ boxed meals |
| Shopping list from plan | — | ✓ |
| Workout logging & progression | limited | ✓ |
| AI coach using your data | — | ✓ (on-device engine, can be swapped for an LLM) |
| Workout buddy matching | — | ✓ |
| Gamified goals / XP | streaks | ✓ XP, levels, goals, achievements |
| Intermittent fasting | ✓ | roadmap |
| Recipes database | ✓ | roadmap (boxed meals are the start) |

## 7. Roadmap ideas from this study

1. Fasting timer (a ring on Today, the same pattern as calories).
2. AI photo logging, the way Cal AI does it: snap a plate and estimate macros with a vision model on the server.
3. Weekly AI review: a one-screen recap that combines nutrition, training and hydration.
4. Real buddy backend: matching, chat, shared streaks.
5. Apple Health / Health Connect sync for steps, workouts and weight.
