/**
 * Form advice fitted to the person. The same exercise does not look the same
 * on every body: long legs change a squat, a wider pelvis changes where the
 * knees go, long arms change a bench press. These are the adjustments a
 * coach would make on sight, chosen from what the app knows: sex, height,
 * age, and the build and posture from the optional body scan.
 *
 * They are general coaching cues, not a measurement of the user's limbs, so
 * each one says what to try and is worded as a starting point.
 */
import { exerciseById } from '../data/exercises'
import type { BodyScan, Profile } from './types'

type Body = { tall: boolean; short: boolean; female: boolean; older: boolean; broad: boolean; slight: boolean; rounded: boolean; arched: boolean }

function bodyOf(p: Profile, scan?: BodyScan): Body {
  const posture = (scan?.posture ?? []).join(' ').toLowerCase()
  return {
    tall: p.heightCm >= (p.sex === 'female' ? 175 : 186),
    short: p.heightCm > 0 && p.heightCm <= (p.sex === 'female' ? 158 : 168),
    female: p.sex === 'female',
    older: p.age >= 55,
    broad: scan?.build === 'sturdy' || scan?.build === 'fuller',
    slight: scan?.build === 'slender',
    rounded: /round|forward (head|shoulder)|slouch|hunch|kypho/.test(posture),
    arched: /arch|pelvic tilt|lordo|sway/.test(posture),
  }
}

/** Which family of movement an exercise belongs to, since the advice goes with the movement. */
const FAMILY: Record<string, 'squat' | 'hinge' | 'press' | 'overhead' | 'pull' | 'row' | 'lunge' | 'curl' | 'thrust' | 'core'> = {
  squat: 'squat', 'front-squat': 'squat', goblet: 'squat', 'leg-press': 'squat',
  deadlift: 'hinge', rdl: 'hinge', 'kb-swing': 'hinge',
  bench: 'press', 'incline-db': 'press', pushup: 'press', dips: 'press', 'cable-fly': 'press',
  ohp: 'overhead', 'db-shoulder': 'overhead', lateral: 'overhead',
  pullup: 'pull', 'lat-pulldown': 'pull',
  row: 'row', 'seated-row': 'row', 'db-row': 'row', 'face-pull': 'row',
  lunge: 'lunge',
  curl: 'curl', hammer: 'curl', pushdown: 'curl', skull: 'curl',
  'hip-thrust': 'thrust', 'glute-bridge': 'thrust',
  plank: 'core', 'hanging-raise': 'core', 'cable-crunch': 'core',
}

/** For each movement, what changes for which body, most useful first. */
const ADVICE: Record<string, [keyof Body, string][]> = {
  squat: [
    ['tall', 'With long legs, stand a little wider with your toes turned out more, and expect to lean forward more than shorter lifters do. That is normal for your frame.'],
    ['female', 'A wider pelvis usually suits a stance just outside the hips with the toes turned out slightly. Push your knees out in line with your toes so they do not cave in.'],
    ['broad', 'Take a wider stance so your hips have room to sit down between your legs.'],
    ['short', 'A hip-width stance usually works well for your frame, and you can stay more upright.'],
    ['arched', 'Pull your ribs down before each rep so your lower back does not over-arch at the top.'],
    ['older', 'Go only as deep as your knees and hips are comfortable with, and take three seconds on the way down.'],
  ],
  hinge: [
    ['tall', 'With long legs your hips will start higher and your back flatter to the floor. Keep the weight close to your shins rather than trying to sit lower.'],
    ['short', 'You can start with your hips a little lower and your chest more upright.'],
    ['rounded', 'Before you lift, pull your shoulders back and down as if squeezing a towel under each arm, and keep them there.'],
    ['arched', 'Stop when your hips are level at the top. Do not lean back.'],
    ['older', 'Keep a soft bend in the knees and stop when you feel the stretch in the back of your thighs.'],
  ],
  press: [
    ['tall', 'Long arms mean a longer way to go. Grip a little wider than shoulder width and stop just above the chest if your shoulders feel pinched at the bottom.'],
    ['female', 'A grip just outside shoulder width usually suits narrower shoulders. Keep your wrists stacked over your elbows.'],
    ['rounded', 'Pull your shoulder blades back and down into the bench before every set. It protects the front of the shoulder.'],
    ['short', 'A shoulder-width grip keeps your forearms upright at the bottom.'],
    ['slight', 'Lower slowly for three seconds. Control matters more than load for you right now.'],
  ],
  overhead: [
    ['arched', 'Squeeze your glutes and keep your ribs down so your lower back does not arch as the weight goes up.'],
    ['rounded', 'If your shoulders feel tight overhead, press slightly in front of your head rather than straight up, and stop where it stays comfortable.'],
    ['tall', 'Take the weight from a height that lets you start with your forearms upright, not flared out.'],
    ['older', 'Use a range that stays pain free. Stopping at eye level is fine.'],
  ],
  pull: [
    ['rounded', 'Lift your chest first, then pull. Think of putting your elbows into your back pockets.'],
    ['tall', 'Take a slightly wider grip and let your arms straighten fully at the top for the whole stretch.'],
    ['female', 'A grip just wider than your shoulders is plenty. Wider than that shortens the movement.'],
  ],
  row: [
    ['rounded', 'Pause for a second with your shoulder blades squeezed together. That is the part that helps your posture.'],
    ['arched', 'Brace your stomach and keep your back flat. Do not lean back to move the weight.'],
    ['tall', 'Pull to your lower ribs rather than your chest so your elbows stay close.'],
  ],
  lunge: [
    ['tall', 'Take a longer step than feels natural so your front knee stays over your foot.'],
    ['female', 'Keep your front knee pointing the same way as your toes. Do not let it drift inwards.'],
    ['short', 'A shorter step is right for you. Your back knee should come down under your hip.'],
    ['older', 'Hold on to something steady at first, or step backwards instead of forwards, which is easier on the knees.'],
  ],
  curl: [
    ['tall', 'Long forearms make this harder at the same weight. Keep your elbows by your sides and do not swing.'],
    ['rounded', 'Stand tall with your shoulders back so they do not roll forward as you tire.'],
  ],
  thrust: [
    ['arched', 'Tuck your chin and tilt your hips under at the top. Finish with your glutes, not your lower back.'],
    ['tall', 'Set your feet a little further away so your shins are upright at the top.'],
    ['female', 'Feet hip width with toes turned out slightly usually lets you feel it most in the glutes.'],
  ],
  core: [
    ['arched', 'Tilt your hips under and pull your ribs down. If you feel it in your lower back, shorten the set.'],
    ['broad', 'Break it into shorter holds or sets with good form rather than one long one.'],
  ],
}

/**
 * Up to two form tips for this exercise that fit this person. Empty when the
 * exercise is unknown or nothing about the person calls for a change.
 */
export function formTips(exerciseId: string, profile: Profile, scan?: BodyScan): string[] {
  const family = exerciseById(exerciseId) ? FAMILY[exerciseId] : undefined
  if (!family) return []
  const body = bodyOf(profile, scan)
  return ADVICE[family].filter(([trait]) => body[trait]).map(([, tip]) => tip).slice(0, 2)
}
