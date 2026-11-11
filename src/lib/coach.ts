/**
 * On-device AI Trainer.
 * A deterministic intent engine that reads the user's real data (food, sets, water,
 * goals) and answers with personalised advice and generated workouts.
 * It is intentionally dependency-free so the app works offline; swap `reply()` for
 * an LLM call later and keep the same ChatMessage contract.
 */
import type { AppState, ChatMessage } from './types'
import { EXERCISES, exerciseById, type Muscle } from '../data/exercises'
import { BOXED_MEALS } from '../data/boxedMeals'
import { dayMacros, exerciseHistory, nextTarget, workoutDates, workoutsThisWeek } from './progress'
import { todayKey, uid } from './date'
import { round } from './nutrition'

const SPLITS: Record<string, Muscle[]> = {
  push: ['Chest', 'Shoulders', 'Arms'],
  pull: ['Back', 'Arms'],
  legs: ['Legs', 'Glutes', 'Core'],
  upper: ['Chest', 'Back', 'Shoulders', 'Arms'],
  lower: ['Legs', 'Glutes', 'Core'],
  full: ['Legs', 'Chest', 'Back', 'Shoulders', 'Core'],
  core: ['Core'],
  cardio: ['Cardio', 'Core'],
}

function buildWorkout(s: AppState, key: string, home: boolean) {
  const muscles = SPLITS[key] ?? SPLITS.full
  const pool = EXERCISES.filter((e) => muscles.includes(e.muscle) && (!home || ['Bodyweight', 'Dumbbell', 'Kettlebell'].includes(e.equipment)))
  const lifted = new Set(s.sets.map((x) => x.exerciseId))
  const picks: typeof pool = []
  for (const m of muscles) {
    const forMuscle = pool.filter((e) => e.muscle === m && !picks.includes(e))
      .sort((a, b) => Number(lifted.has(b.id)) - Number(lifted.has(a.id)))
    picks.push(...forMuscle.slice(0, muscles.length <= 2 ? 3 : 2))
  }
  const items = picks.slice(0, 6).map((e) => {
    const t = nextTarget(s, e.id)
    const reps = e.muscle === 'Core' && e.id === 'plank' ? '45s' : `${e.reps[0]}–${e.reps[1]}`
    return { exerciseId: e.id, sets: e.level === 'Advanced' ? 4 : 3, reps: t && t.weight ? `${reps} @ ${t.weight} kg` : reps }
  })
  const title = `${key[0].toUpperCase()}${key.slice(1)} day${home ? ' · Home' : ''}`
  return { title, items }
}

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]

export function reply(s: AppState, input: string): ChatMessage {
  const q = input.toLowerCase()
  const msg = (text: string, workout?: ChatMessage['workout']): ChatMessage => ({ id: uid(), role: 'coach', text, workout })
  const today = dayMacros(s, todayKey())
  const t = s.targets

  // Workout generation
  const split = Object.keys(SPLITS).find((k) => new RegExp(`\\b${k}\\b`).test(q))
  if (split || /workout|routine|session/.test(q)) {
    const home = /home|no gym|bodyweight|hotel/.test(q)
    let key: string | undefined = split
    if (!key) {
      const recent = s.sets.filter((x) => workoutDates(s).slice(-2).includes(x.date)).map((x) => exerciseById(x.exerciseId)?.muscle)
      key = recent.includes('Legs') ? 'upper' : 'lower'
    }
    const w = buildWorkout(s, key, home)
    return msg(`Here's your ${w.title.toLowerCase()}. Weights are based on your last sessions using double progression — hit the top of the rep range on every set and we add load next time. Rest 2–3 min on compounds, 60–90 s on accessories.`, w)
  }

  // Specific exercise form / progression
  const ex = EXERCISES.find((e) => q.includes(e.name.toLowerCase()) || q.includes(e.id.replace('-', ' ')))
  if (ex) {
    const hist = exerciseHistory(s, ex.id)
    const nt = nextTarget(s, ex.id)
    const trend = hist.length >= 2 ? round(hist.at(-1)!.value - hist[0].value, 1) : 0
    return msg(
      `${ex.name} — key cues:\n• ${ex.cues.join('\n• ')}\n\n` +
      (hist.length ? `Your estimated 1RM went ${trend >= 0 ? 'up' : 'down'} ${Math.abs(trend)} kg over ${hist.length} sessions. ` : '') +
      (nt ? `Next session: ${nt.weight ? nt.weight + ' kg × ' : ''}${nt.reps} reps. ${nt.note}` : ''),
    )
  }

  if (/calorie|kcal|eat|food|hungry|macro|protein|diet/.test(q)) {
    const left = t.kcal - today.kcal
    const pLeft = Math.max(0, round(t.protein - today.protein))
    const idea = BOXED_MEALS.filter((m) => m.kcal <= Math.max(left, 250)).sort((a, b) => b.protein / b.kcal - a.protein / a.kcal)[0]
    return msg(
      `Today you're at ${round(today.kcal)} / ${t.kcal} kcal and ${round(today.protein)} / ${t.protein} g protein.` +
      (left > 0 ? ` You have ${round(left)} kcal left` : ` You're ${round(-left)} kcal over — keep dinner light and protein-forward`) +
      (pLeft > 0 ? ` and still need ${pLeft} g protein.` : '. Protein is covered — nice.') +
      (idea ? `\n\nSuggestion: ${idea.emoji} ${idea.name} (${idea.kcal} kcal, ${idea.protein} g protein). You'll find it under Plans → Boxed meals.` : ''),
    )
  }

  if (/water|hydrat|drink/.test(q)) {
    const ml = s.water[todayKey()] ?? 0
    const glasses = Math.ceil(Math.max(0, t.waterMl - ml) / s.waterPlan.glassMl)
    return msg(`You've had ${ml} ml of ${t.waterMl} ml. That's ${glasses} more glass${glasses === 1 ? '' : 'es'} — spread them out before ${s.waterPlan.endHour}:00 so sleep isn't interrupted.`)
  }

  if (/progress|how am i|doing|stats|week/.test(q)) {
    const w = workoutsThisWeek(s)
    const first = s.weights[0]?.kg
    const delta = first ? round(s.profile.weightKg - first, 1) : 0
    const best = ['bench', 'squat', 'deadlift', 'ohp', 'row']
      .map((id) => ({ id, h: exerciseHistory(s, id) }))
      .filter((x) => x.h.length >= 2)
      .map((x) => ({ name: exerciseById(x.id)!.name, gain: round(x.h.at(-1)!.value - x.h[0].value, 1) }))
      .sort((a, b) => b.gain - a.gain)[0]
    return msg(
      `This week: ${w} workout${w === 1 ? '' : 's'}. Body weight ${delta <= 0 ? 'down' : 'up'} ${Math.abs(delta)} kg since you started.` +
      (best ? ` Biggest strength gain: ${best.name} +${best.gain} kg e1RM.` : '') +
      `\n\n${w >= 3 ? "You're right on track — keep the rhythm." : 'Aim for at least 3 sessions this week; ask me for a workout and we will get one in.'}`,
    )
  }

  if (/tired|sore|deload|rest|sleep|recover/.test(q)) {
    return msg('Recovery is training too. If you\'re sore or sleeping badly, take a deload: same exercises, ~60% of your usual weight, 2 sets instead of 3. Prioritise 7–9 h of sleep, 2 g/kg protein and a 20-min walk.')
  }

  if (/motivat|lazy|skip|give up|hard/.test(q)) {
    return msg(pick([
      'Don\'t aim for a perfect session — aim for a started one. Do the warm-up and the first exercise; momentum handles the rest.',
      'You have a streak worth protecting. Ten minutes still counts. Want a 15-minute home workout?',
      'Progress is boring until it isn\'t. Your numbers are moving — show up today and future-you will thank you.',
    ]))
  }

  return msg('I can build workouts ("push day at home"), coach an exercise ("bench press form"), check your calories and protein, review your progress, or plan your water. What do you need?')
}

export const SUGGESTIONS = ['Build me a push workout', 'How am I doing this week?', 'What should I eat for dinner?', 'Squat form tips', 'Full body at home', 'I feel sore today']
