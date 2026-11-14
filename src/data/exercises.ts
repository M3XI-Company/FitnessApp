import type { Slug } from 'react-native-body-highlighter'

export type Muscle = 'Chest' | 'Back' | 'Legs' | 'Shoulders' | 'Arms' | 'Core' | 'Glutes' | 'Cardio'
export type Equipment = 'Barbell' | 'Dumbbell' | 'Machine' | 'Cable' | 'Bodyweight' | 'Kettlebell'
export type Level = 'Beginner' | 'Intermediate' | 'Advanced'

/** Muscles as named on the anatomical map */
export type MuscleSlug = Extract<Slug, 'abs' | 'adductors' | 'biceps' | 'calves' | 'chest' | 'deltoids' | 'forearm' | 'gluteal' | 'hamstring' | 'lower-back' | 'obliques' | 'quadriceps' | 'tibialis' | 'trapezius' | 'triceps' | 'upper-back'>

export const MUSCLE_NAME: Record<MuscleSlug, string> = {
  abs: 'Abdominals', adductors: 'Adductors (inner thigh)', biceps: 'Biceps', calves: 'Calves', chest: 'Chest (pectorals)', deltoids: 'Shoulders (deltoids)',
  forearm: 'Forearms', gluteal: 'Glutes', hamstring: 'Hamstrings', 'lower-back': 'Lower back (erectors)', obliques: 'Obliques', quadriceps: 'Quadriceps',
  tibialis: 'Shins (tibialis)', trapezius: 'Trapezius', triceps: 'Triceps', 'upper-back': 'Upper back (lats & rhomboids)',
}

/** Primary (main movers) and secondary (assisting) muscles for each exercise */
export const WORKS: Record<string, { primary: MuscleSlug[]; secondary: MuscleSlug[] }> = {
  bench: { primary: ['chest', 'triceps'], secondary: ['deltoids'] },
  'incline-db': { primary: ['chest', 'deltoids'], secondary: ['triceps'] },
  pushup: { primary: ['chest', 'triceps'], secondary: ['deltoids', 'abs'] },
  'cable-fly': { primary: ['chest'], secondary: ['deltoids'] },
  dips: { primary: ['chest', 'triceps'], secondary: ['deltoids'] },
  deadlift: { primary: ['gluteal', 'hamstring', 'lower-back'], secondary: ['quadriceps', 'trapezius', 'upper-back', 'forearm'] },
  pullup: { primary: ['upper-back'], secondary: ['biceps', 'forearm', 'deltoids'] },
  row: { primary: ['upper-back', 'trapezius'], secondary: ['biceps', 'lower-back', 'deltoids'] },
  'lat-pulldown': { primary: ['upper-back'], secondary: ['biceps', 'forearm'] },
  'seated-row': { primary: ['upper-back', 'trapezius'], secondary: ['biceps'] },
  'db-row': { primary: ['upper-back'], secondary: ['biceps', 'trapezius'] },
  squat: { primary: ['quadriceps', 'gluteal'], secondary: ['hamstring', 'adductors', 'lower-back', 'abs'] },
  'front-squat': { primary: ['quadriceps'], secondary: ['gluteal', 'abs', 'upper-back'] },
  'leg-press': { primary: ['quadriceps', 'gluteal'], secondary: ['hamstring', 'adductors'] },
  lunge: { primary: ['quadriceps', 'gluteal'], secondary: ['hamstring', 'adductors', 'calves'] },
  'leg-curl': { primary: ['hamstring'], secondary: ['calves'] },
  'leg-ext': { primary: ['quadriceps'], secondary: [] },
  calf: { primary: ['calves'], secondary: [] },
  rdl: { primary: ['hamstring', 'gluteal'], secondary: ['lower-back'] },
  'hip-thrust': { primary: ['gluteal'], secondary: ['hamstring', 'quadriceps'] },
  'glute-bridge': { primary: ['gluteal'], secondary: ['hamstring'] },
  ohp: { primary: ['deltoids'], secondary: ['triceps', 'trapezius', 'abs'] },
  'db-shoulder': { primary: ['deltoids'], secondary: ['triceps', 'trapezius'] },
  lateral: { primary: ['deltoids'], secondary: ['trapezius'] },
  'face-pull': { primary: ['deltoids', 'trapezius'], secondary: ['upper-back'] },
  curl: { primary: ['biceps'], secondary: ['forearm'] },
  hammer: { primary: ['biceps', 'forearm'], secondary: [] },
  pushdown: { primary: ['triceps'], secondary: [] },
  skull: { primary: ['triceps'], secondary: [] },
  plank: { primary: ['abs'], secondary: ['obliques', 'deltoids', 'gluteal'] },
  'hanging-raise': { primary: ['abs'], secondary: ['obliques', 'forearm'] },
  'cable-crunch': { primary: ['abs'], secondary: ['obliques'] },
  'kb-swing': { primary: ['gluteal', 'hamstring'], secondary: ['lower-back', 'deltoids', 'abs'] },
  burpee: { primary: ['quadriceps', 'chest'], secondary: ['deltoids', 'triceps', 'abs', 'calves'] },
  goblet: { primary: ['quadriceps', 'gluteal'], secondary: ['abs', 'adductors'] },
  mountain: { primary: ['abs'], secondary: ['deltoids', 'quadriceps', 'obliques'] },
}
export const worksFor = (id: string) => WORKS[id] ?? { primary: [], secondary: [] }

export interface Exercise {
  id: string
  name: string
  muscle: Muscle
  equipment: Equipment
  level: Level
  /** default rep range */
  reps: [number, number]
  /** kg added per progression step */
  step: number
  cues: string[]
}

const ex = (
  id: string, name: string, muscle: Muscle, equipment: Equipment, level: Level,
  reps: [number, number], step: number, cues: string[],
): Exercise => ({ id, name, muscle, equipment, level, reps, step, cues })

export const EXERCISES: Exercise[] = [
  ex('bench', 'Bench Press', 'Chest', 'Barbell', 'Intermediate', [5, 8], 2.5, ['Retract shoulder blades', 'Feet planted, slight arch', 'Bar to lower chest, press up and back']),
  ex('incline-db', 'Incline Dumbbell Press', 'Chest', 'Dumbbell', 'Beginner', [8, 12], 2, ['Bench at 30°', 'Elbows ~45° from torso', 'Squeeze at the top']),
  ex('pushup', 'Push-Up', 'Chest', 'Bodyweight', 'Beginner', [10, 20], 0, ['Body in one straight line', 'Chest to fist height', 'Lock out fully']),
  ex('cable-fly', 'Cable Fly', 'Chest', 'Cable', 'Beginner', [12, 15], 2.5, ['Soft elbows', 'Hug a big tree', 'Slow on the way back']),
  ex('dips', 'Dips', 'Chest', 'Bodyweight', 'Intermediate', [6, 12], 0, ['Lean forward for chest', 'Shoulders down', 'Go to 90° elbow']),
  ex('deadlift', 'Deadlift', 'Back', 'Barbell', 'Advanced', [3, 6], 5, ['Bar over mid-foot', 'Brace and push the floor away', 'Hips and shoulders rise together']),
  ex('pullup', 'Pull-Up', 'Back', 'Bodyweight', 'Intermediate', [5, 10], 0, ['Dead hang start', 'Drive elbows to ribs', 'Chin over bar']),
  ex('row', 'Barbell Row', 'Back', 'Barbell', 'Intermediate', [6, 10], 2.5, ['Hinge to ~45°', 'Pull to belly button', 'No torso swing']),
  ex('lat-pulldown', 'Lat Pulldown', 'Back', 'Cable', 'Beginner', [8, 12], 2.5, ['Slight lean back', 'Bar to upper chest', 'Control the return']),
  ex('seated-row', 'Seated Cable Row', 'Back', 'Cable', 'Beginner', [10, 12], 2.5, ['Tall chest', 'Squeeze shoulder blades', 'Pause 1s']),
  ex('db-row', 'One-Arm Dumbbell Row', 'Back', 'Dumbbell', 'Beginner', [8, 12], 2, ['Flat back', 'Elbow to hip', 'Full stretch at bottom']),
  ex('squat', 'Back Squat', 'Legs', 'Barbell', 'Intermediate', [5, 8], 2.5, ['Brace core', 'Knees track over toes', 'Hip crease below knee']),
  ex('front-squat', 'Front Squat', 'Legs', 'Barbell', 'Advanced', [4, 8], 2.5, ['Elbows high', 'Upright torso', 'Sit between heels']),
  ex('leg-press', 'Leg Press', 'Legs', 'Machine', 'Beginner', [10, 15], 5, ['Lower back on pad', 'Feet shoulder width', "Don't lock knees"]),
  ex('lunge', 'Walking Lunge', 'Legs', 'Dumbbell', 'Beginner', [10, 12], 2, ['Long stride', 'Back knee kisses floor', 'Drive through front heel']),
  ex('leg-curl', 'Lying Leg Curl', 'Legs', 'Machine', 'Beginner', [10, 15], 2.5, ['Hips pressed down', 'Curl fully', '3s negative']),
  ex('leg-ext', 'Leg Extension', 'Legs', 'Machine', 'Beginner', [12, 15], 2.5, ['Pad above ankles', 'Squeeze quads at top', 'Slow lowering']),
  ex('calf', 'Standing Calf Raise', 'Legs', 'Machine', 'Beginner', [12, 20], 5, ['Full stretch at bottom', 'Pause at top', 'No bouncing']),
  ex('rdl', 'Romanian Deadlift', 'Glutes', 'Barbell', 'Intermediate', [6, 10], 2.5, ['Soft knees', 'Push hips back', 'Bar close to legs']),
  ex('hip-thrust', 'Hip Thrust', 'Glutes', 'Barbell', 'Beginner', [8, 12], 5, ['Shoulders on bench', 'Chin tucked', 'Full lockout squeeze']),
  ex('glute-bridge', 'Glute Bridge', 'Glutes', 'Bodyweight', 'Beginner', [15, 20], 0, ['Feet close to glutes', 'Ribs down', 'Squeeze 2s']),
  ex('ohp', 'Overhead Press', 'Shoulders', 'Barbell', 'Intermediate', [5, 8], 1.25, ['Squeeze glutes', 'Bar path straight up', 'Head through at top']),
  ex('db-shoulder', 'Seated DB Shoulder Press', 'Shoulders', 'Dumbbell', 'Beginner', [8, 12], 2, ['Back supported', 'Wrists over elbows', "Don't clash at top"]),
  ex('lateral', 'Lateral Raise', 'Shoulders', 'Dumbbell', 'Beginner', [12, 20], 1, ['Lead with elbows', 'Stop at shoulder height', 'Slow negative']),
  ex('face-pull', 'Face Pull', 'Shoulders', 'Cable', 'Beginner', [12, 20], 2.5, ['Rope to forehead', 'Externally rotate', 'Elbows high']),
  ex('curl', 'Barbell Curl', 'Arms', 'Barbell', 'Beginner', [8, 12], 1.25, ['Elbows pinned', 'No swinging', 'Full extension']),
  ex('hammer', 'Hammer Curl', 'Arms', 'Dumbbell', 'Beginner', [10, 12], 1, ['Neutral grip', 'Controlled tempo', 'Alternate or together']),
  ex('pushdown', 'Triceps Pushdown', 'Arms', 'Cable', 'Beginner', [10, 15], 2.5, ['Elbows by sides', 'Lock out fully', 'Slow return']),
  ex('skull', 'Skull Crusher', 'Arms', 'Barbell', 'Intermediate', [8, 12], 1.25, ['Lower to forehead', 'Elbows stay narrow', 'Use EZ bar']),
  ex('plank', 'Plank', 'Core', 'Bodyweight', 'Beginner', [30, 60], 0, ['Reps = seconds', 'Squeeze glutes', 'Ribs down']),
  ex('hanging-raise', 'Hanging Leg Raise', 'Core', 'Bodyweight', 'Intermediate', [8, 15], 0, ['No swinging', 'Curl pelvis up', 'Slow lower']),
  ex('cable-crunch', 'Cable Crunch', 'Core', 'Cable', 'Beginner', [12, 15], 2.5, ['Hips stay still', 'Crunch ribs to hips', 'Exhale hard']),
  ex('kb-swing', 'Kettlebell Swing', 'Cardio', 'Kettlebell', 'Intermediate', [15, 25], 4, ['Hip hinge, not squat', 'Snap hips', 'Float to chest height']),
  ex('burpee', 'Burpee', 'Cardio', 'Bodyweight', 'Intermediate', [10, 20], 0, ['Chest to floor', 'Jump and clap overhead', 'Steady rhythm']),
  ex('goblet', 'Goblet Squat', 'Legs', 'Kettlebell', 'Beginner', [10, 15], 4, ['Bell at chest', 'Elbows inside knees', 'Upright torso']),
  ex('mountain', 'Mountain Climbers', 'Cardio', 'Bodyweight', 'Beginner', [20, 40], 0, ['Hips level', 'Drive knees fast', 'Hands under shoulders']),
]

export const MUSCLES: Muscle[] = ['Chest', 'Back', 'Legs', 'Glutes', 'Shoulders', 'Arms', 'Core', 'Cardio']
export const EQUIPMENT: Equipment[] = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Kettlebell']

export const exerciseById = (id: string) => EXERCISES.find((e) => e.id === id)

export const MUSCLE_COLOR: Record<Muscle, string> = {
  Chest: '#1F6FB2', Back: '#2B5C8F', Legs: '#0F2440', Glutes: '#4E6380',
  Shoulders: '#3E8FD6', Arms: '#5B7FA6', Core: '#5BB3EA', Cardio: '#F2765A',
}
