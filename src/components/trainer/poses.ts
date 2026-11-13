/**
 * Movement library for the 3D trainer.
 *
 * Angles are in degrees, in plain anatomical terms:
 *   pelvis  – forward tilt of the pelvis/trunk (a hip hinge keeps the spine neutral)
 *   lean    – extra spine flexion on top of the pelvis (keep 0 for a neutral spine)
 *   hip     – thigh flexion relative to the pelvis (forward = +)
 *   knee    – knee flexion
 *   toe     – heel raise (calf raise), applied after the foot is auto-flattened
 *   shFlex  – shoulder flexion (arm forward/up = +)
 *   shAbd   – shoulder abduction (arm out to the side = +)
 *   elbow   – elbow flexion
 *   pitch   – whole-body pitch: +90 = face down (push-up), -90 = face up (bench)
 *   lift    – extra height after grounding (jumps)
 * L / R override any limb value for one side (lunges, climbers).
 * Every exercise in the library maps to one pattern. Patterns are original choreography,
 * written to demonstrate neutral-spine, controlled technique.
 */
export interface Side { hip: number; knee: number; toe: number; shFlex: number; shAbd: number; elbow: number; hipAbd: number }
export interface Pose extends Partial<Side> {
  pelvis?: number; lean?: number; neck?: number; pitch?: number; lift?: number
  L?: Partial<Side>; R?: Partial<Side>
  /** phase label shown under the trainer while moving into this pose */
  label?: string
}
export type Ground = 'feet' | 'all' | 'hang' | 'bench' | 'seat'
export type Prop = 'bench' | 'bar' | 'seat' | 'dipbars'
export type Load = 'barbell' | 'dumbbell' | 'kettlebell' | 'none'
export interface Pattern {
  keys: Pose[]; seconds: number[]; ground: Ground; prop?: Prop; load?: Load; hangHeight?: number
  /** presses and pulls bend the elbow in the frontal plane */
  elbowPlane?: 'side'
}

const STAND: Pose = { pelvis: 0, lean: 0, hip: 0, knee: 0, toe: 0, shFlex: 0, shAbd: 8, elbow: 8, pitch: 0, lift: 0 }
const p = (pose: Pose): Pose => ({ ...STAND, ...pose })

export const PATTERNS: Record<string, Pattern> = {
  backSquat: { ground: 'feet', load: 'barbell', seconds: [1.6, 1.2, 0.6],
    keys: [p({ shAbd: 70, elbow: 120, label: 'Brace and breathe' }), p({ pelvis: 42, hip: 132, knee: 120, shAbd: 70, elbow: 120, label: 'Sit down and back' }), p({ shAbd: 70, elbow: 120, label: 'Drive up through mid-foot' })] },
  frontSquat: { ground: 'feet', load: 'barbell', seconds: [1.6, 1.2, 0.6],
    keys: [p({ shFlex: 90, elbow: 150, label: 'Elbows high' }), p({ pelvis: 25, hip: 120, knee: 125, shFlex: 90, elbow: 150, label: 'Stay upright' }), p({ shFlex: 90, elbow: 150, label: 'Drive up' })] },
  gobletSquat: { ground: 'feet', load: 'kettlebell', seconds: [1.6, 1.2, 0.6],
    keys: [p({ shFlex: 25, elbow: 135, label: 'Hold bell at chest' }), p({ pelvis: 30, hip: 122, knee: 122, shFlex: 25, elbow: 135, label: 'Elbows inside knees' }), p({ shFlex: 25, elbow: 135, label: 'Stand tall' })] },
  hinge: { ground: 'feet', load: 'barbell', seconds: [1.8, 1.0, 0.6],
    keys: [p({ shFlex: 0, shAbd: 4, elbow: 0, label: 'Brace, bar close' }), p({ pelvis: 72, hip: 82, knee: 18, shFlex: 72, shAbd: 4, elbow: 0, label: 'Push hips back' }), p({ shAbd: 4, elbow: 0, label: 'Squeeze glutes to stand' })] },
  deadlift: { ground: 'feet', load: 'barbell', seconds: [0.9, 1.8, 0.6],
    keys: [p({ pelvis: 55, hip: 95, knee: 55, shFlex: 55, shAbd: 4, elbow: 0, label: 'Set: bar over mid-foot' }), p({ shAbd: 4, elbow: 0, label: 'Push the floor away' }), p({ pelvis: 55, hip: 95, knee: 55, shFlex: 55, shAbd: 4, elbow: 0, label: 'Lower with control' })] },
  kbSwing: { ground: 'feet', load: 'kettlebell', seconds: [0.55, 0.55],
    keys: [p({ pelvis: 60, hip: 75, knee: 20, shFlex: 45, shAbd: 0, elbow: 0, label: 'Hike back' }), p({ shFlex: 90, shAbd: 0, elbow: 0, label: 'Snap hips' })] },
  lunge: { ground: 'feet', load: 'dumbbell', seconds: [1.4, 1.0, 1.4, 1.0],
    keys: [p({ elbow: 0, shAbd: 6, label: 'Tall posture' }), p({ elbow: 0, shAbd: 6, L: { hip: 90, knee: 92 }, R: { hip: -12, knee: 95 }, label: 'Long step, back knee down' }),
      p({ elbow: 0, shAbd: 6, label: 'Drive through front heel' }), p({ elbow: 0, shAbd: 6, R: { hip: 90, knee: 92 }, L: { hip: -12, knee: 95 }, label: 'Switch legs' })] },
  pushup: { ground: 'all', seconds: [1.4, 0.8],
    keys: [p({ pitch: 72, shFlex: 72, shAbd: 18, elbow: 0, label: 'Straight line, hands under shoulders' }), p({ pitch: 84, shFlex: 25, shAbd: 25, elbow: 95, label: 'Chest to fist height' })] },
  plank: { ground: 'all', seconds: [2, 2],
    keys: [p({ pitch: 80, shFlex: 80, elbow: 90, shAbd: 8, label: 'Squeeze glutes, ribs down' }), p({ pitch: 80, shFlex: 80, elbow: 90, shAbd: 8, lean: 2, label: 'Breathe steadily' })] },
  bench: { ground: 'bench', prop: 'bench', load: 'barbell', seconds: [1.5, 0.9],
    keys: [p({ pitch: -90, hip: -15, knee: 75, shFlex: 92, shAbd: 12, elbow: 0, label: 'Shoulder blades back, feet planted' }), p({ pitch: -90, hip: -15, knee: 75, shFlex: 20, shAbd: 58, elbow: 95, label: 'Bar to lower chest' })] },
  inclinePress: { ground: 'bench', prop: 'bench', load: 'dumbbell', seconds: [1.5, 0.9],
    keys: [p({ pitch: -58, hip: 32, knee: 90, shFlex: 95, shAbd: 10, elbow: 0, label: 'Press up and in' }), p({ pitch: -58, hip: 32, knee: 90, shFlex: 25, shAbd: 55, elbow: 95, label: 'Lower to upper chest' })] },
  fly: { ground: 'feet', seconds: [1.5, 1.0],
    keys: [p({ shFlex: 20, shAbd: 80, elbow: 18, label: 'Soft elbows, open wide' }), p({ shFlex: 80, shAbd: 15, elbow: 18, label: 'Hug a big tree' })] },
  dips: { ground: 'hang', prop: 'dipbars', hangHeight: 1.15, seconds: [1.4, 0.8],
    keys: [p({ shFlex: 0, shAbd: 10, elbow: 0, knee: 70, label: 'Shoulders down' }), p({ shFlex: -45, shAbd: 15, elbow: 92, knee: 70, lean: 18, label: 'Lower to 90°' })] },
  ohp: { elbowPlane: 'side', ground: 'feet', load: 'barbell', seconds: [1.0, 1.3],
    keys: [p({ shAbd: 78, elbow: 135, label: 'Glutes tight, bar at collarbone' }), p({ shAbd: 172, elbow: 0, label: 'Press straight up' })] },
  lateral: { elbowPlane: 'side', ground: 'feet', load: 'dumbbell', seconds: [1.0, 1.5],
    keys: [p({ shAbd: 12, elbow: 15, label: 'Slight lean, soft elbows' }), p({ shAbd: 88, elbow: 15, label: 'Lead with elbows to shoulder height' })] },
  facePull: { elbowPlane: 'side', ground: 'feet', seconds: [1.3, 1.0],
    keys: [p({ shFlex: 90, shAbd: 0, elbow: 0, label: 'Arms long' }), p({ shFlex: 80, shAbd: 70, elbow: 115, label: 'Pull to forehead, rotate out' })] },
  bentRow: { ground: 'feet', load: 'barbell', seconds: [1.0, 1.3],
    keys: [p({ pelvis: 48, hip: 62, knee: 20, shFlex: 48, shAbd: 4, elbow: 0, label: 'Hinge to ~45°' }), p({ pelvis: 48, hip: 62, knee: 20, shFlex: -10, shAbd: 18, elbow: 100, label: 'Elbows to hips' })] },
  seatedRow: { ground: 'seat', prop: 'seat', seconds: [1.0, 1.3],
    keys: [p({ hip: 85, knee: 25, shFlex: 85, shAbd: 4, elbow: 0, label: 'Tall chest' }), p({ hip: 85, knee: 25, shFlex: -15, shAbd: 12, elbow: 105, label: 'Squeeze shoulder blades' })] },
  pullup: { elbowPlane: 'side', ground: 'hang', prop: 'bar', hangHeight: 2.25, seconds: [1.2, 1.5],
    keys: [p({ shAbd: 168, elbow: 0, knee: 20, label: 'Dead hang' }), p({ shAbd: 68, elbow: 128, knee: 20, label: 'Elbows to ribs, chin over bar' })] },
  pulldown: { elbowPlane: 'side', ground: 'seat', prop: 'seat', seconds: [1.0, 1.5],
    keys: [p({ hip: 90, knee: 90, shAbd: 165, elbow: 0, lean: -6, label: 'Arms long, slight lean back' }), p({ hip: 90, knee: 90, shAbd: 72, elbow: 125, lean: -6, label: 'Bar to upper chest' })] },
  curl: { ground: 'feet', load: 'dumbbell', seconds: [1.0, 1.5],
    keys: [p({ shAbd: 6, elbow: 2, label: 'Elbows pinned' }), p({ shAbd: 6, elbow: 140, label: 'Curl, no swing' })] },
  pushdown: { ground: 'feet', seconds: [1.0, 1.2],
    keys: [p({ lean: 8, shFlex: 5, shAbd: 6, elbow: 100, label: 'Elbows by your sides' }), p({ lean: 8, shFlex: 5, shAbd: 6, elbow: 0, label: 'Lock out fully' })] },
  skull: { ground: 'bench', prop: 'bench', load: 'barbell', seconds: [1.2, 1.0],
    keys: [p({ pitch: -90, hip: -15, knee: 75, shFlex: 100, shAbd: 8, elbow: 0, label: 'Arms over shoulders' }), p({ pitch: -90, hip: -15, knee: 75, shFlex: 110, shAbd: 8, elbow: 115, label: 'Lower to forehead' })] },
  calfRaise: { ground: 'feet', seconds: [1.0, 1.4],
    keys: [p({ shAbd: 6, label: 'Full stretch' }), p({ shAbd: 6, toe: 30, label: 'Rise and pause' })] },
  legPress: { ground: 'seat', prop: 'seat', seconds: [1.6, 1.0],
    keys: [p({ lean: -35, hip: 105, knee: 100, shAbd: 20, elbow: 20, label: 'Lower back on the pad' }), p({ lean: -35, hip: 70, knee: 12, shAbd: 20, elbow: 20, label: "Press, don't lock knees" })] },
  legExt: { ground: 'seat', prop: 'seat', seconds: [1.5, 1.0],
    keys: [p({ hip: 90, knee: 90, shAbd: 20, elbow: 20, label: 'Pad above ankles' }), p({ hip: 90, knee: 5, shAbd: 20, elbow: 20, label: 'Squeeze quads' })] },
  legCurl: { ground: 'bench', prop: 'bench', seconds: [1.5, 1.2],
    keys: [p({ pitch: 90, shFlex: 150, elbow: 30, label: 'Hips pressed down' }), p({ pitch: 90, shFlex: 150, elbow: 30, knee: 110, label: 'Curl fully, slow back' })] },
  bridge: { ground: 'all', seconds: [1.2, 1.4],
    keys: [p({ pitch: -90, hip: 45, knee: 90, shAbd: 15, label: 'Feet close, ribs down' }), p({ pitch: -110, hip: 0, knee: 110, shAbd: 15, label: 'Drive hips up, squeeze' })] },
  hangingRaise: { ground: 'hang', prop: 'bar', hangHeight: 2.25, seconds: [1.4, 1.2],
    keys: [p({ shAbd: 168, elbow: 0, label: 'Still hang' }), p({ shAbd: 168, elbow: 0, hip: 95, knee: 10, lean: 10, label: 'Curl pelvis up' })] },
  crunch: { ground: 'all', seconds: [1.3, 1.0],
    keys: [p({ hip: -5, knee: 95, toe: 0, shFlex: 165, elbow: 130, label: 'Kneel tall, rope by head' }), p({ hip: 25, knee: 95, lean: 50, shFlex: 165, elbow: 130, label: 'Crunch ribs to hips' })] },
  burpee: { ground: 'all', seconds: [0.45, 0.45, 0.45, 0.45, 0.45],
    keys: [p({ label: 'Stand' }), p({ pelvis: 45, hip: 130, knee: 120, shFlex: 60, elbow: 0, label: 'Hands down' }), p({ pitch: 72, shFlex: 72, shAbd: 18, elbow: 0, label: 'Jump back to plank' }),
      p({ pelvis: 45, hip: 130, knee: 120, shFlex: 60, elbow: 0, label: 'Feet in' }), p({ shAbd: 160, elbow: 0, lift: 0.18, label: 'Jump and reach' })] },
  climbers: { ground: 'all', seconds: [0.35, 0.35],
    keys: [p({ pitch: 72, shFlex: 72, shAbd: 15, elbow: 0, L: { hip: 95, knee: 110 }, label: 'Drive knee in' }), p({ pitch: 72, shFlex: 72, shAbd: 15, elbow: 0, R: { hip: 95, knee: 110 }, label: 'Switch, hips level' })] },
}

/** Exercise id → pattern */
export const EXERCISE_PATTERN: Record<string, keyof typeof PATTERNS> = {
  bench: 'bench', 'incline-db': 'inclinePress', pushup: 'pushup', 'cable-fly': 'fly', dips: 'dips',
  deadlift: 'deadlift', pullup: 'pullup', row: 'bentRow', 'lat-pulldown': 'pulldown', 'seated-row': 'seatedRow', 'db-row': 'bentRow',
  squat: 'backSquat', 'front-squat': 'frontSquat', 'leg-press': 'legPress', lunge: 'lunge', 'leg-curl': 'legCurl', 'leg-ext': 'legExt', calf: 'calfRaise',
  rdl: 'hinge', 'hip-thrust': 'bridge', 'glute-bridge': 'bridge',
  ohp: 'ohp', 'db-shoulder': 'ohp', lateral: 'lateral', 'face-pull': 'facePull',
  curl: 'curl', hammer: 'curl', pushdown: 'pushdown', skull: 'skull',
  plank: 'plank', 'hanging-raise': 'hangingRaise', 'cable-crunch': 'crunch',
  'kb-swing': 'kbSwing', burpee: 'burpee', goblet: 'gobletSquat', mountain: 'climbers',
}

export const patternFor = (exerciseId: string): Pattern => PATTERNS[EXERCISE_PATTERN[exerciseId] ?? 'backSquat']

const SIDE_KEYS: (keyof Side)[] = ['hip', 'knee', 'toe', 'shFlex', 'shAbd', 'elbow', 'hipAbd']
export interface Resolved { pelvis: number; lean: number; neck: number; pitch: number; lift: number; L: Side; R: Side }

export function resolve(pose: Pose): Resolved {
  const side = (o?: Partial<Side>): Side => {
    const s = {} as Side
    for (const k of SIDE_KEYS) s[k] = o?.[k] ?? pose[k] ?? 0
    return s
  }
  return { pelvis: pose.pelvis ?? 0, lean: pose.lean ?? 0, neck: pose.neck ?? 0, pitch: pose.pitch ?? 0, lift: pose.lift ?? 0, L: side(pose.L), R: side(pose.R) }
}

const ease = (t: number) => t * t * (3 - 2 * t)
export function lerpPose(a: Resolved, b: Resolved, t: number): Resolved {
  const e = ease(t)
  const m = (x: number, y: number) => x + (y - x) * e
  const side = (s: Side, u: Side): Side => ({ hip: m(s.hip, u.hip), knee: m(s.knee, u.knee), toe: m(s.toe, u.toe), shFlex: m(s.shFlex, u.shFlex), shAbd: m(s.shAbd, u.shAbd), elbow: m(s.elbow, u.elbow), hipAbd: m(s.hipAbd, u.hipAbd) })
  return { pelvis: m(a.pelvis, b.pelvis), lean: m(a.lean, b.lean), neck: m(a.neck, b.neck), pitch: m(a.pitch, b.pitch), lift: m(a.lift, b.lift), L: side(a.L, b.L), R: side(a.R, b.R) }
}

/** Position in the loop → interpolated pose and the label of the phase being entered */
export function sample(pattern: Pattern, time: number): { pose: Resolved; label: string; phase: number } {
  const total = pattern.seconds.reduce((a, b) => a + b, 0)
  let t = ((time % total) + total) % total
  const n = pattern.keys.length
  for (let i = 0; i < n; i++) {
    const d = pattern.seconds[i]
    if (t <= d || i === n - 1) {
      const from = resolve(pattern.keys[i])
      const to = resolve(pattern.keys[(i + 1) % n])
      return { pose: lerpPose(from, to, Math.min(1, t / d)), label: pattern.keys[(i + 1) % n].label ?? '', phase: (i + 1) % n }
    }
    t -= d
  }
  return { pose: resolve(pattern.keys[0]), label: pattern.keys[0].label ?? '', phase: 0 }
}
