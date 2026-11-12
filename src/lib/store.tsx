import { createContext, useContext, useEffect, useReducer, useState, type ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { AppState, ChatMessage, FoodEntry, Profile, SetLog, UserGoal, WaterPlan } from './types'
import { computeTargets } from './nutrition'
import { addDays, todayKey, uid } from './date'

const STORAGE_KEY = 'breeze.v1'

const defaultProfile: Profile = {
  name: 'Alex', sex: 'male', age: 29, heightCm: 178, weightKg: 82, targetWeightKg: 76,
  activity: 'moderate', goal: 'lose', onboarded: false,
}

/** Seed a couple of weeks of realistic history so every screen has something to show. */
function seed(): AppState {
  const t = todayKey()
  const sets: SetLog[] = []
  const plan: [string, number, number][] = [['bench', 70, 2.5], ['squat', 90, 2.5], ['row', 60, 2.5], ['ohp', 42.5, 1.25]]
  for (let w = 0; w < 6; w++) {
    plan.forEach(([id, base, step], i) => {
      const date = addDays(t, -(41 - w * 7) + i * 2)
      for (let s = 0; s < 3; s++) sets.push({ id: uid(), date, exerciseId: id, weight: base + step * w, reps: 8 - (s === 2 ? 1 : 0) })
    })
  }
  const weights = Array.from({ length: 6 }, (_, i) => ({ date: addDays(t, -35 + i * 7), kg: 84.5 - i * 0.5 }))
  const water: Record<string, number> = {}
  for (let i = 1; i < 10; i++) water[addDays(t, -i)] = 1750 + ((i * 370) % 1000)
  water[t] = 750
  const food: FoodEntry[] = [
    { id: uid(), date: t, meal: 'breakfast', name: 'Greek yogurt, 0%', serving: '170 g', qty: 1, kcal: 100, protein: 17, carbs: 6, fat: 0.7, emoji: '🥛', source: 'search' },
    { id: uid(), date: t, meal: 'breakfast', name: 'Blueberries', serving: '1 cup (148 g)', qty: 1, kcal: 84, protein: 1.1, carbs: 21, fat: 0.5, emoji: '🫐', source: 'search' },
    { id: uid(), date: t, meal: 'breakfast', name: 'Latte', serving: '350 ml', qty: 1, kcal: 190, protein: 10, carbs: 15, fat: 10, emoji: '☕', source: 'search' },
  ]
  for (let i = 1; i < 7; i++) {
    food.push({ id: uid(), date: addDays(t, -i), meal: 'lunch', name: 'Lemon Herb Chicken Rice Bowl', serving: '1 box', qty: 1, kcal: 560, protein: 48, carbs: 58, fat: 13, emoji: '🍗', source: 'boxed' })
    food.push({ id: uid(), date: addDays(t, -i), meal: 'dinner', name: 'Salmon, baked', serving: '150 g', qty: 1, kcal: 312, protein: 34, carbs: 0, fat: 19, emoji: '🐟', source: 'search' })
    food.push({ id: uid(), date: addDays(t, -i), meal: 'breakfast', name: 'Rolled oats', serving: '40 g', qty: 2, kcal: 300, protein: 10, carbs: 54, fat: 5.2, emoji: '🥣', source: 'search' })
    if (i % 2) food.push({ id: uid(), date: addDays(t, -i), meal: 'snack', name: 'Whey protein shake', serving: '1 scoop', qty: 2, kcal: 240, protein: 48, carbs: 6, fat: 3, emoji: '🥤', source: 'search' })
  }
  const goals: UserGoal[] = [
    { id: 'g1', title: 'Train 4× this week', metric: 'workouts_week', target: 4, createdAt: t },
    { id: 'g2', title: 'Hit protein 5 days', metric: 'protein_days', target: 5, createdAt: t },
    { id: 'g3', title: 'Reach target weight', metric: 'weight', target: 76, createdAt: t },
    { id: 'g4', title: 'Hydrate 7 days in a row', metric: 'water_days', target: 7, createdAt: t },
  ]
  return {
    profile: defaultProfile,
    targets: computeTargets(defaultProfile),
    food, water, sets, weights, goals,
    waterPlan: { startHour: 8, endHour: 21, glassMl: 250 },
    boxedPlan: { [t]: ['overnight-oats', 'chicken-bowl', 'salmon-plate'] },
    chat: [],
    buddies: [],
    blocked: [],
    reports: [],
  }
}

type Action =
  | { type: 'profile'; profile: Profile }
  | { type: 'addFood'; entry: FoodEntry }
  | { type: 'removeFood'; id: string }
  | { type: 'updateFood'; entry: FoodEntry }
  | { type: 'water'; date: string; delta: number }
  | { type: 'addSet'; set: SetLog }
  | { type: 'removeSet'; id: string }
  | { type: 'weight'; date: string; kg: number }
  | { type: 'waterPlan'; plan: WaterPlan }
  | { type: 'toggleBoxed'; date: string; mealId: string }
  | { type: 'addGoal'; goal: UserGoal }
  | { type: 'removeGoal'; id: string }
  | { type: 'chat'; messages: ChatMessage[] }
  | { type: 'toggleBuddy'; id: string }
  | { type: 'reset' }
  | { type: 'block'; id: string }
  | { type: 'report'; targetId: string; reason: string }
  | { type: 'buddySafety' }
  | { type: 'hydrate'; state: AppState }

function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'profile': return { ...s, profile: a.profile, targets: computeTargets(a.profile) }
    case 'addFood': return { ...s, food: [...s.food, a.entry] }
    case 'removeFood': return { ...s, food: s.food.filter((x) => x.id !== a.id) }
    case 'updateFood': return { ...s, food: s.food.map((x) => (x.id === a.entry.id ? a.entry : x)) }
    case 'water': return { ...s, water: { ...s.water, [a.date]: Math.max(0, (s.water[a.date] ?? 0) + a.delta) } }
    case 'addSet': return { ...s, sets: [...s.sets, a.set] }
    case 'removeSet': return { ...s, sets: s.sets.filter((x) => x.id !== a.id) }
    case 'weight': {
      const rest = s.weights.filter((w) => w.date !== a.date)
      const profile = { ...s.profile, weightKg: a.kg }
      return { ...s, weights: [...rest, { date: a.date, kg: a.kg }].sort((x, y) => x.date.localeCompare(y.date)), profile, targets: computeTargets(profile) }
    }
    case 'waterPlan': return { ...s, waterPlan: a.plan }
    case 'toggleBoxed': {
      const cur = s.boxedPlan[a.date] ?? []
      const next = cur.includes(a.mealId) ? cur.filter((x) => x !== a.mealId) : [...cur, a.mealId]
      return { ...s, boxedPlan: { ...s.boxedPlan, [a.date]: next } }
    }
    case 'addGoal': return { ...s, goals: [...s.goals, a.goal] }
    case 'removeGoal': return { ...s, goals: s.goals.filter((g) => g.id !== a.id) }
    case 'chat': return { ...s, chat: [...s.chat, ...a.messages] }
    case 'toggleBuddy': return { ...s, buddies: s.buddies.includes(a.id) ? s.buddies.filter((x) => x !== a.id) : [...s.buddies, a.id] }
    case 'reset': return seed()
    case 'block': return { ...s, blocked: [...new Set([...s.blocked, a.id])], buddies: s.buddies.filter((x) => x !== a.id) }
    case 'report': return { ...s, reports: [...s.reports, { id: uid(), targetId: a.targetId, reason: a.reason, at: new Date().toISOString() }], blocked: [...new Set([...s.blocked, a.targetId])], buddies: s.buddies.filter((x) => x !== a.targetId) }
    case 'buddySafety': return { ...s, buddySafetyAt: new Date().toISOString() }
    case 'hydrate': return a.state
  }
}

const Ctx = createContext<{ state: AppState; dispatch: (a: Action) => void; ready: boolean } | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, seed)
  const [ready, setReady] = useState(false)

  // Hydrate from device storage once, then persist every change
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => { if (raw) dispatch({ type: 'hydrate', state: { ...seed(), ...JSON.parse(raw) } }) })
      .catch(() => { /* corrupt storage: keep seed */ })
      .finally(() => setReady(true))
  }, [])
  useEffect(() => { if (ready) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {}) }, [state, ready])

  return <Ctx.Provider value={{ state, dispatch, ready }}>{children}</Ctx.Provider>
}

export function useStore() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useStore outside provider')
  return c
}
