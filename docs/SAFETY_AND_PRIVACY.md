# Breeze — safety, privacy and age policy

Breeze is a fitness app with a community, **not a dating app**. This document records how the app protects people, and where the remaining work is.

## Age policy

| Feature | Minimum age | In the app today |
|---|---|---|
| Workouts, exercise library, 3D trainer, camera form check | 16+ | Onboarding won't accept an age under 16 |
| Nutrition, meal planning, scanners | 16+ | ✓ |
| Moderated fitness forum | 16+ | Planned (needs backend) |
| Gym buddy discovery | 18+ | Locked under 18 (`src/lib/age.ts`) |
| Direct messaging | 18+ | Planned; `canDirectMessage()` already gates it |

- **No adult–minor matching.** `sameAgeBand()` filters every buddy list, so adults never see 16–17-year-olds and vice versa.
- 16–17-year-olds: private profile by default, no discovery, no messaging (see roadmap for the forum's extra controls).
- *Gap:* age is self-declared. Before public launch, buddy discovery needs age assurance (for example an ID/age-estimation provider) to meet UK Online Safety Act expectations.

## Meeting people from the gym (18+)

Before anyone sees a buddy list they must accept **Train safely** guidelines:
meet at a busy, staffed place (never at home), tell a friend, keep personal details private, keep chat in Breeze, report anything inappropriate — and that Breeze is for training partners, not dating.

A permanent banner on the buddy screen repeats: *meet in public at the gym and tell a friend*.

Built-in protections:
- **Approximate distance only** ("about 2 km"); exact location is never shown.
- **No photos of people** — emoji avatars only, no appearance details; profiles are about goals, level and training times.
- **Block** — instant; the blocked person disappears and can't contact you.
- **Report** with reasons including *romantic or sexual contact*, *harassment or threats*, *fake profile*, *seems under 18*, *unsafe behaviour*. Reporting also blocks.
- Buttons say "Ask to train together", not "connect" or "like".

Still needed for launch (milestone M5, backend): a moderation queue with a 24-hour response target, rate limits on requests, server-side enforcement of blocks and age bands, and escalation for under-18 reports.

## Camera form feedback

How it stays safe and private:
- **On-device.** MediaPipe Pose runs on the phone (WebView on iOS/Android, sandboxed iframe on web). The app receives only body-landmark coordinates. **Video is never recorded, stored or uploaded.**
- **Explicit consent** first, explaining limits; withdrawable in Profile → Privacy & safety.
- **Confidence gate.** No reps or cues unless every joint the rule needs is clearly visible and inside the frame; otherwise "I can't see you clearly".
- **Cautious cues.** A problem must persist for several frames before a cue appears, cues cool down, are worded as suggestions ("Try to…"), and can be dismissed for the session.
- **Honest scope.** Exercises a 2D camera can't track reliably (machines, hanging moves) don't offer it. Things a camera can't judge (spinal rounding) are never cued.
- **Human in the loop.** The rep count is reviewed and corrected before it's saved.
- Tested by `npm test` (13 tests: counting, partial reps, poor visibility, out-of-frame, jitter, sagging hips, dismissal, manual correction).
- *Not yet validated on real people.* Accuracy targets in `docs/SPEC_REVIEW.md` §4 (R2) need a device study before claiming accuracy publicly, and the cue rules should be reviewed by a qualified coach.

## Food photo scanning

- The photo is sent over HTTPS to Breeze's own server function, analysed, and **not stored**. The AI key lives only on the server.
- The AI returns **names and estimated grams only**; calories come from the UK CoFID database. Every item can be swapped, resized or removed before logging, and entries stay marked as **estimates**.
- Per-device monthly cap; device ids are stored only as SHA-256 hashes; each call is logged (tokens, cost, outcome) in `ai_usage`, which clients can't read.

## Health notices

- Onboarding requires accepting a health & safety notice (not medical advice; stop if in pain; see a professional for conditions).
- The 3D trainer and camera screens repeat "stop if you feel pain".
- The exercise library and cues still need review by a qualified coach (spec risk R7).
