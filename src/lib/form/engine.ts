/**
 * On-device form feedback engine.
 *
 * Input: body landmarks from a pose model (MediaPipe Pose Landmarker, 33 points,
 * normalised image coordinates). Output: rep count, movement phase and at most one
 * cautious cue at a time.
 *
 * Safety principles (see docs/FORM_FEEDBACK_SAFETY.md):
 *  - Never counts or cues when the body isn't clearly visible (confidence gate).
 *  - A cue needs the problem to persist across several frames, then cools down.
 *  - Cues are suggestions ("try to…"), never diagnoses; the user can dismiss them.
 *  - Things a 2D camera cannot judge reliably (e.g. spinal rounding) are not cued.
 *  - Pure functions, no I/O: nothing here stores or transmits images.
 */

export interface Landmark { x: number; y: number; z?: number; visibility?: number }

/** MediaPipe Pose landmark indices */
export const LM = {
  nose: 0, lShoulder: 11, rShoulder: 12, lElbow: 13, rElbow: 14, lWrist: 15, rWrist: 16,
  lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28,
} as const

export type CueId = 'depth' | 'chest_up' | 'squat_not_hinge' | 'hip_line' | 'lockout' | 'lean_back' | 'elbows_in' | 'swing' | 'too_high' | 'stay_tall' | 'full_range'
export interface Cue { id: CueId; text: string; severity: 'tip' | 'caution' }

export interface FormUpdate {
  status: 'tracking' | 'low_confidence'
  reps: number
  phase: 'start' | 'moving' | 'end'
  /** primary joint angle in degrees (smoothed), for the UI meter */
  angle: number | null
  /** 0–1: how clearly the needed joints are visible */
  confidence: number
  cue: Cue | null
  /** seconds held (plank) */
  holdSeconds?: number
  /** guidance shown while not tracking */
  hint?: string
}

type Side = 'l' | 'r'
type Joints = { shoulder: Landmark; elbow: Landmark; wrist: Landmark; hip: Landmark; knee: Landmark; ankle: Landmark }

/** Angle ABC in degrees (at B), using image-plane coordinates */
export function angle(a: Landmark, b: Landmark, c: Landmark): number {
  const v1x = a.x - b.x, v1y = a.y - b.y, v2x = c.x - b.x, v2y = c.y - b.y
  const dot = v1x * v2x + v1y * v2y
  const m = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y)
  if (m === 0) return 180
  return (Math.acos(Math.max(-1, Math.min(1, dot / m))) * 180) / Math.PI
}

/** Angle of segment a→b away from vertical, in degrees (0 = vertical) */
export function fromVertical(a: Landmark, b: Landmark): number {
  return (Math.atan2(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * 180) / Math.PI
}

const vis = (p?: Landmark) => (p ? (p.visibility ?? 1) * (p.x > -0.05 && p.x < 1.05 && p.y > -0.05 && p.y < 1.05 ? 1 : 0) : 0)

function side(lm: Landmark[], s: Side): Joints {
  const i = s === 'l' ? { sh: LM.lShoulder, el: LM.lElbow, wr: LM.lWrist, hip: LM.lHip, kn: LM.lKnee, an: LM.lAnkle } : { sh: LM.rShoulder, el: LM.rElbow, wr: LM.rWrist, hip: LM.rHip, kn: LM.rKnee, an: LM.rAnkle }
  return { shoulder: lm[i.sh], elbow: lm[i.el], wrist: lm[i.wr], hip: lm[i.hip], knee: lm[i.kn], ankle: lm[i.an] }
}

type JointName = keyof Joints

interface Rule {
  /** joints that must be visible */
  needs: JointName[]
  /** primary angle that drives the rep counter */
  primary: (j: Joints) => number
  /** rep thresholds on the primary angle (with hysteresis) */
  start: number
  end: number
  /** true when the movement goes from a large angle (start) to a small one (end) */
  decreasing: boolean
  /** cues evaluated every frame (persisting conditions) */
  live?: (j: Joints, primary: number) => CueId | null
  /** cues evaluated once per completed rep, with the rep's extreme primary angle */
  perRep?: (extreme: number, rep: RepStats) => CueId | null
  /** static hold (plank) instead of reps */
  hold?: boolean
  camera: 'side' | 'front'
}
interface RepStats { maxTorsoChange: number }

const torso = (j: Joints) => fromVertical(j.hip, j.shoulder)

const SQUAT: Rule = {
  needs: ['shoulder', 'hip', 'knee', 'ankle'], camera: 'side', decreasing: true, start: 160, end: 110,
  primary: (j) => angle(j.hip, j.knee, j.ankle),
  live: (j, k) => (k < 120 && torso(j) > 55 ? 'chest_up' : null),
  perRep: (min) => (min > 100 ? 'depth' : null),
}
const HINGE: Rule = {
  needs: ['shoulder', 'hip', 'knee', 'ankle'], camera: 'side', decreasing: true, start: 160, end: 125,
  primary: (j) => angle(j.shoulder, j.hip, j.knee),
  live: (j, h) => (h < 130 && angle(j.hip, j.knee, j.ankle) < 105 ? 'squat_not_hinge' : null),
}
const PUSHUP: Rule = {
  needs: ['shoulder', 'elbow', 'wrist', 'hip', 'ankle'], camera: 'side', decreasing: true, start: 150, end: 100,
  primary: (j) => angle(j.shoulder, j.elbow, j.wrist),
  live: (j) => (angle(j.shoulder, j.hip, j.ankle) < 155 ? 'hip_line' : null),
  perRep: (min) => (min > 110 ? 'full_range' : null),
}
const PLANK: Rule = {
  needs: ['shoulder', 'hip', 'ankle'], camera: 'side', decreasing: true, start: 0, end: 0, hold: true,
  primary: (j) => angle(j.shoulder, j.hip, j.ankle),
  live: (_, line) => (line < 160 ? 'hip_line' : null),
}
const LUNGE: Rule = {
  needs: ['shoulder', 'hip', 'knee', 'ankle'], camera: 'side', decreasing: true, start: 160, end: 115,
  primary: (j) => angle(j.hip, j.knee, j.ankle),
  live: (j, k) => (k < 130 && torso(j) > 30 ? 'stay_tall' : null),
}
const PRESS: Rule = {
  needs: ['shoulder', 'elbow', 'wrist', 'hip'], camera: 'front', decreasing: false, start: 100, end: 150,
  primary: (j) => angle(j.shoulder, j.elbow, j.wrist),
  live: (j) => (torso(j) > 20 ? 'lean_back' : null),
  perRep: (max) => (max < 160 ? 'lockout' : null),
}
const CURL: Rule = {
  needs: ['shoulder', 'elbow', 'wrist', 'hip'], camera: 'side', decreasing: true, start: 140, end: 70,
  primary: (j) => angle(j.shoulder, j.elbow, j.wrist),
  live: (j) => (fromVertical(j.shoulder, j.elbow) > 35 ? 'elbows_in' : null),
  perRep: (_, rep) => (rep.maxTorsoChange > 15 ? 'swing' : null),
}
const LATERAL: Rule = {
  needs: ['shoulder', 'elbow', 'hip'], camera: 'front', decreasing: false, start: 35, end: 70,
  primary: (j) => angle(j.hip, j.shoulder, j.elbow),
  live: (_, a) => (a > 115 ? 'too_high' : null),
}
const BRIDGE: Rule = {
  needs: ['shoulder', 'hip', 'knee'], camera: 'side', decreasing: false, start: 145, end: 165,
  primary: (j) => angle(j.shoulder, j.hip, j.knee),
}

/** Which exercises have camera feedback. Machines and bar-hanging moves are left to manual logging. */
export const FORM_RULES: Record<string, Rule> = {
  squat: SQUAT, 'front-squat': SQUAT, goblet: SQUAT,
  deadlift: HINGE, rdl: HINGE, 'kb-swing': HINGE,
  pushup: PUSHUP, plank: PLANK, lunge: LUNGE,
  ohp: PRESS, 'db-shoulder': PRESS,
  curl: CURL, hammer: CURL, lateral: LATERAL,
  'glute-bridge': BRIDGE, 'hip-thrust': BRIDGE,
}
export const supportsForm = (exerciseId: string) => exerciseId in FORM_RULES
export const cameraAdvice = (exerciseId: string) =>
  FORM_RULES[exerciseId]?.camera === 'front' ? 'Face the camera, about 2–3 m away, whole body in frame.' : 'Turn side-on to the camera, about 2–3 m away, whole body in frame.'

export const CUES: Record<CueId, Cue> = {
  depth: { id: 'depth', text: 'If it feels comfortable, try sitting a little deeper.', severity: 'tip' },
  chest_up: { id: 'chest_up', text: 'Try to keep your chest up as you go down.', severity: 'caution' },
  squat_not_hinge: { id: 'squat_not_hinge', text: 'Try pushing your hips back more and bending your knees less.', severity: 'tip' },
  hip_line: { id: 'hip_line', text: 'Try to keep your hips in line with your shoulders and ankles.', severity: 'caution' },
  full_range: { id: 'full_range', text: 'Try lowering your chest a little further, if comfortable.', severity: 'tip' },
  lockout: { id: 'lockout', text: 'Try pressing all the way up to straight arms.', severity: 'tip' },
  lean_back: { id: 'lean_back', text: 'Try squeezing your glutes so you don’t lean back.', severity: 'caution' },
  elbows_in: { id: 'elbows_in', text: 'Try to keep your elbows by your sides.', severity: 'tip' },
  swing: { id: 'swing', text: 'Try a lighter weight so your body doesn’t swing.', severity: 'tip' },
  too_high: { id: 'too_high', text: 'Try stopping around shoulder height.', severity: 'tip' },
  stay_tall: { id: 'stay_tall', text: 'Try to keep your upper body tall.', severity: 'tip' },
}

export interface SessionOptions {
  /** minimum landmark visibility to track (0–1) */
  minConfidence?: number
  /** frames a live problem must persist before cueing */
  persistFrames?: number
  /** ms before the same cue can show again */
  cueCooldownMs?: number
  /** smoothing factor for the primary angle (0–1, higher = more responsive) */
  smoothing?: number
  /** fastest / slowest plausible rep in ms */
  minRepMs?: number
  maxRepMs?: number
}

export class FormSession {
  private rule: Rule
  private opt: Required<SessionOptions>
  private reps = 0
  private inRep = false
  private repStart = 0
  private extreme = 0
  private torsoAtStart = 0
  private maxTorsoChange = 0
  private smooth: number | null = null
  private streak: Partial<Record<CueId, number>> = {}
  private lastShown: Partial<Record<CueId, number>> = {}
  private current: { cue: Cue; until: number } | null = null
  private dismissed = new Set<CueId>()
  private holdMs = 0
  private lastT: number | null = null
  private sideChoice: Side | null = null

  constructor(exerciseId: string, options: SessionOptions = {}) {
    const rule = FORM_RULES[exerciseId]
    if (!rule) throw new Error(`No form rules for ${exerciseId}`)
    this.rule = rule
    this.opt = { minConfidence: 0.6, persistFrames: 6, cueCooldownMs: 5000, smoothing: 0.45, minRepMs: 600, maxRepMs: 12000, ...options }
  }

  /** Hide a cue for the rest of this session (the user said it doesn't apply). */
  dismiss(id: CueId) { this.dismissed.add(id); if (this.current?.cue.id === id) this.current = null }
  /** Manual correction of the counter. */
  setReps(n: number) { this.reps = Math.max(0, Math.round(n)) }

  push(landmarks: Landmark[] | null, t: number): FormUpdate {
    const dt = this.lastT === null ? 0 : Math.min(500, t - this.lastT)
    this.lastT = t
    const base = { reps: this.reps, phase: this.inRep ? 'moving' : 'start', holdSeconds: this.rule.hold ? Math.floor(this.holdMs / 1000) : undefined } as const

    if (!landmarks || landmarks.length < 29) return { ...base, status: 'low_confidence', angle: null, confidence: 0, cue: null, hint: 'Step into view so your whole body is visible.' }

    // use the side of the body facing the camera (more visible), keep it stable once chosen
    const conf = (s: Side) => { const j = side(landmarks, s); return Math.min(...this.rule.needs.map((n) => vis(j[n]))) }
    const cl = conf('l'), cr = conf('r')
    if (this.sideChoice === null || Math.max(cl, cr) - (this.sideChoice === 'l' ? cl : cr) > 0.25) this.sideChoice = cl >= cr ? 'l' : 'r'
    const confidence = this.sideChoice === 'l' ? cl : cr
    if (confidence < this.opt.minConfidence) {
      this.streak = {}
      return { ...base, status: 'low_confidence', angle: this.smooth, confidence, cue: null, hint: 'I can’t see you clearly — check lighting and fit your whole body in frame.' }
    }

    const j = side(landmarks, this.sideChoice)
    const raw = this.rule.primary(j)
    this.smooth = this.smooth === null ? raw : this.smooth + (raw - this.smooth) * this.opt.smoothing
    const a = this.smooth
    const now = t

    // reps (or hold time)
    let completedRep = false
    if (this.rule.hold) {
      if (a >= 150) this.holdMs += dt
    } else {
      const atStart = this.rule.decreasing ? a >= this.rule.start : a <= this.rule.start
      if (!this.inRep && !atStart && (this.rule.decreasing ? a < this.rule.start : a > this.rule.start)) {
        this.inRep = true; this.repStart = now; this.extreme = a; this.torsoAtStart = torso(j); this.maxTorsoChange = 0
      }
      if (this.inRep) {
        this.extreme = this.rule.decreasing ? Math.min(this.extreme, a) : Math.max(this.extreme, a)
        this.maxTorsoChange = Math.max(this.maxTorsoChange, Math.abs(torso(j) - this.torsoAtStart))
        if (atStart) {
          const duration = now - this.repStart
          const reachedEnd = this.rule.decreasing ? this.extreme <= this.rule.end : this.extreme >= this.rule.end
          if (reachedEnd && duration >= this.opt.minRepMs && duration <= this.opt.maxRepMs) { this.reps++; completedRep = true }
          else if (!reachedEnd && duration >= this.opt.minRepMs) completedRep = true // partial rep: no count, may cue
          this.inRep = false
        }
      }
    }

    // cues
    let candidate: CueId | null = null
    const liveId = this.rule.live?.(j, a) ?? null
    for (const id of Object.keys(this.streak) as CueId[]) if (id !== liveId) this.streak[id] = 0
    if (liveId) {
      this.streak[liveId] = (this.streak[liveId] ?? 0) + 1
      if ((this.streak[liveId] ?? 0) >= this.opt.persistFrames) candidate = liveId
    }
    if (!candidate && completedRep && this.rule.perRep) candidate = this.rule.perRep(this.extreme, { maxTorsoChange: this.maxTorsoChange })
    if (candidate && !this.dismissed.has(candidate) && now - (this.lastShown[candidate] ?? -Infinity) > this.opt.cueCooldownMs && (!this.current || this.current.until < now)) {
      this.current = { cue: CUES[candidate], until: now + 3500 }
      this.lastShown[candidate] = now
    }
    if (this.current && this.current.until < now) this.current = null

    return {
      status: 'tracking', reps: this.reps, angle: a, confidence,
      phase: this.inRep ? 'moving' : 'start', cue: this.current?.cue ?? null,
      holdSeconds: this.rule.hold ? Math.floor(this.holdMs / 1000) : undefined,
    }
  }
}
