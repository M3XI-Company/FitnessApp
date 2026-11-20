import { createContext, useContext, useEffect, useReducer, useState, type ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { afterStoreCheck, type Subscription } from './plan'
import { hasPlus, storeReady } from './purchases'
import type { Intensity } from './intensity'
import type { BuddySetup } from './buddyRules'
import { syncSets } from './records'
import { setSpeakingVoice } from './voice'
import type { AppState, ChatMessage, ChatThread, ReminderSettings, FoodEntry, FoodItem, MealCategory, Profile, SavedMeal, SetLog, Targets, UserGoal, WaterPlan, WeeklyRoutine, BodyScan } from './types'
import { effectiveTargets } from './nutrition'
import { addDays, todayKey, uid } from './date'
import { addMemories, forgetMemories } from './memory'

const STORAGE_KEY = 'breeze.v1'

const defaultProfile: Profile = {
  name: 'Alex', sex: 'male', age: 29, heightCm: 178, weightKg: 82, targetWeightKg: 76,
  activity: 'moderate', goal: 'lose', onboarded: false,
}

/** Development builds start with demo data so every screen has something to show; release builds start empty. */
export const DEMO_BY_DEFAULT = typeof __DEV__ !== 'undefined' ? __DEV__ : false

function emptyState(): AppState {
  return {
    profile: defaultProfile, targets: effectiveTargets(defaultProfile),
    food: [], water: {}, sets: [], weights: [], goals: [],
    waterPlan: { startHour: 8, endHour: 21, glassMl: 250 },
    boxedPlan: {}, chat: [], buddies: [], blocked: [], reports: [],
    favourites: [], savedMeals: [], mealCategories: [], demo: false,
  }
}

/** Demonstration data: two weeks of sample history. Every item is flagged demo so it can be removed. */
function demoData() {
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
    food: food.map((f) => ({ ...f, demo: true })),
    sets: sets.map((x) => ({ ...x, demo: true })),
    weights: weights.map((w) => ({ ...w, demo: true })),
    water, goals,
  }
}

function withDemo(s: AppState): AppState {
  const d = demoData()
  const water = { ...s.water }
  for (const [k, v] of Object.entries(d.water)) water[k] = (water[k] ?? 0) + v
  return {
    ...s, demo: true,
    food: [...d.food, ...s.food], sets: [...d.sets, ...s.sets],
    weights: [...d.weights, ...s.weights].sort((a, b) => a.date.localeCompare(b.date)),
    water, demoWater: Object.keys(d.water), goals: s.goals.length ? s.goals : d.goals,
  }
}

function withoutDemo(s: AppState): AppState {
  const water = { ...s.water }
  for (const k of s.demoWater ?? []) delete water[k]
  return { ...s, demo: false, demoWater: [], food: s.food.filter((f) => !f.demo), sets: s.sets.filter((x) => !x.demo), weights: s.weights.filter((w) => !w.demo), water }
}

const initialState = () => (DEMO_BY_DEFAULT ? withDemo(emptyState()) : emptyState())

/** How many earlier conversations are kept */
const MAX_THREADS = 40
/** How many exercise and meal conversations are kept, and how long each may grow */
const MAX_TOPICS = 40
const MAX_TOPIC_MESSAGES = 30

/** The saved conversations with the one in progress put away at the front. An empty conversation is not kept. */
function shelve(s: AppState): ChatThread[] {
  const threads = s.threads ?? []
  if (!s.chat.length) return threads
  const first = s.chat.find((m) => m.role === 'user')?.text ?? s.chat[0].text
  const title = first.trim().replace(/\s+/g, ' ').slice(0, 48) || 'Conversation'
  const id = s.chatId ?? uid()
  return [{ id, title, at: new Date().toISOString(), messages: s.chat }, ...threads.filter((t) => t.id !== id)].slice(0, MAX_THREADS)
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
  | { type: 'newChat' }
  | { type: 'openChat'; id: string }
  | { type: 'deleteChat'; id: string }
  | { type: 'topicChat'; id: string; messages: ChatMessage[] }
  | { type: 'clearTopicChat'; id: string }
  | { type: 'intensity'; level: Intensity }
  | { type: 'insight'; text: string }
  | { type: 'reminders'; reminders: ReminderSettings }
  | { type: 'voice'; id: string }
  | { type: 'subscription'; subscription?: Subscription }
  | { type: 'storeCheck'; paid: boolean }
  | { type: 'dataChoice'; share: boolean }
  | { type: 'remember'; texts: string[] }
  | { type: 'forget'; ids: string[] }
  | { type: 'clearMemory' }
  | { type: 'routine'; routine: WeeklyRoutine }
  | { type: 'bodyScan'; scan?: BodyScan }
  | { type: 'mealPlan'; days: Record<string, string[]> }
  | { type: 'buddy'; setup: BuddySetup }
  | { type: 'restoreSets'; sets: SetLog[] }
  | { type: 'reset' }
  | { type: 'setTargets'; custom?: Partial<Targets> }
  | { type: 'toggleFavourite'; item: FoodItem }
  | { type: 'saveMeal'; meal: SavedMeal }
  | { type: 'deleteSavedMeal'; id: string }
  | { type: 'logEntries'; entries: FoodEntry[] }
  | { type: 'addCategory'; category: MealCategory }
  | { type: 'removeCategory'; slot: string }
  | { type: 'demo'; on: boolean }
  | { type: 'block'; id: string }
  | { type: 'report'; targetId: string; reason: string }
  | { type: 'buddySafety' }
  | { type: 'hydrate'; state: AppState }

function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'profile': return { ...s, profile: a.profile, targets: effectiveTargets(a.profile, s.customTargets) }
    case 'addFood': return { ...s, food: [...s.food, a.entry] }
    case 'removeFood': return { ...s, food: s.food.filter((x) => x.id !== a.id) }
    case 'updateFood': return { ...s, food: s.food.map((x) => (x.id === a.entry.id ? a.entry : x)) }
    case 'water': return { ...s, water: { ...s.water, [a.date]: Math.max(0, (s.water[a.date] ?? 0) + a.delta) } }
    case 'addSet': return { ...s, sets: [...s.sets, a.set] }
    case 'removeSet': return { ...s, sets: s.sets.filter((x) => x.id !== a.id) }
    case 'weight': {
      const rest = s.weights.filter((w) => w.date !== a.date)
      const profile = { ...s.profile, weightKg: a.kg }
      return { ...s, weights: [...rest, { date: a.date, kg: a.kg }].sort((x, y) => x.date.localeCompare(y.date)), profile, targets: effectiveTargets(profile, s.customTargets) }
    }
    case 'waterPlan': return { ...s, waterPlan: a.plan }
    case 'toggleBoxed': {
      const cur = s.boxedPlan[a.date] ?? []
      const next = cur.includes(a.mealId) ? cur.filter((x) => x !== a.mealId) : [...cur, a.mealId]
      return { ...s, boxedPlan: { ...s.boxedPlan, [a.date]: next } }
    }
    case 'addGoal': return { ...s, goals: [...s.goals, a.goal] }
    case 'removeGoal': return { ...s, goals: s.goals.filter((g) => g.id !== a.id) }
    case 'chat': return { ...s, chat: [...s.chat, ...a.messages], chatId: s.chatId ?? uid(), chatDay: s.chat.length ? s.chatDay ?? todayKey() : todayKey() }
    case 'newChat': return { ...s, chat: [], chatId: uid(), chatDay: undefined, threads: shelve(s) }
    case 'openChat': {
      const target = (s.threads ?? []).find((t) => t.id === a.id)
      if (!target) return s
      return { ...s, chat: target.messages, chatId: target.id, threads: shelve(s).filter((t) => t.id !== a.id) }
    }
    case 'deleteChat': return { ...s, threads: (s.threads ?? []).filter((t) => t.id !== a.id) }
    case 'topicChat': {
      // the topic just spoken in goes to the end, so when there are too many the ones left longest are let go
      const { [a.id]: mine = [], ...others } = s.topicChats ?? {}
      const kept = Object.entries(others).slice(-(MAX_TOPICS - 1))
      return { ...s, topicChats: { ...Object.fromEntries(kept), [a.id]: [...mine, ...a.messages].slice(-MAX_TOPIC_MESSAGES) } }
    }
    case 'clearTopicChat': { const { [a.id]: _gone, ...others } = s.topicChats ?? {}; return { ...s, topicChats: others } }
    case 'intensity': return { ...s, intensity: a.level }
    case 'insight': return { ...s, insight: { date: todayKey(), text: a.text } }
    case 'reminders': return { ...s, reminders: a.reminders }
    case 'voice': return { ...s, voice: a.id }
    case 'subscription': return { ...s, subscription: a.subscription }
    case 'storeCheck': return { ...s, subscription: afterStoreCheck(s.subscription, a.paid) }
    case 'dataChoice': return { ...s, dataChoice: { share: a.share, at: new Date().toISOString() } }
    case 'remember': return { ...s, memory: addMemories(s.memory ?? [], a.texts) }
    case 'forget': return { ...s, memory: forgetMemories(s.memory ?? [], a.ids) }
    case 'clearMemory': return { ...s, memory: [] }
    case 'routine': return { ...s, routine: a.routine }
    case 'bodyScan': return { ...s, bodyScan: a.scan }
    case 'mealPlan': return { ...s, boxedPlan: { ...s.boxedPlan, ...a.days } }
    case 'buddy': return { ...s, buddy: a.setup }
    case 'restoreSets': {
      // sets brought back from the database join what is on the phone; nothing already here is replaced
      const have = new Set(s.sets.map((x) => x.id))
      return { ...s, sets: [...s.sets, ...a.sets.filter((x) => !have.has(x.id))].sort((x, y) => x.date.localeCompare(y.date)) }
    }
    case 'reset': return initialState()
    case 'setTargets': return { ...s, customTargets: a.custom, targets: effectiveTargets(s.profile, a.custom) }
    case 'toggleFavourite': {
      const key = (i: FoodItem) => `${i.name}|${i.servingG ?? i.serving}`
      const has = s.favourites.some((f) => key(f) === key(a.item))
      return { ...s, favourites: has ? s.favourites.filter((f) => key(f) !== key(a.item)) : [{ ...a.item }, ...s.favourites] }
    }
    case 'saveMeal': return { ...s, savedMeals: [a.meal, ...s.savedMeals.filter((m) => m.id !== a.meal.id)] }
    case 'deleteSavedMeal': return { ...s, savedMeals: s.savedMeals.filter((m) => m.id !== a.id) }
    case 'logEntries': return { ...s, food: [...s.food, ...a.entries] }
    case 'addCategory': return { ...s, mealCategories: [...s.mealCategories, a.category] }
    case 'removeCategory': return {
      ...s, mealCategories: s.mealCategories.filter((c) => c.slot !== a.slot),
      // nothing is lost: entries in a removed category move to Snacks
      food: s.food.map((f) => (f.meal === a.slot ? { ...f, meal: 'snack' } : f)),
    }
    case 'demo': return a.on ? (s.demo ? s : withDemo(s)) : withoutDemo(s)
    case 'block': return { ...s, blocked: [...new Set([...s.blocked, a.id])], buddies: s.buddies.filter((x) => x !== a.id) }
    case 'report': return { ...s, reports: [...s.reports, { id: uid(), targetId: a.targetId, reason: a.reason, at: new Date().toISOString() }], blocked: [...new Set([...s.blocked, a.targetId])], buddies: s.buddies.filter((x) => x !== a.targetId) }
    case 'buddySafety': return { ...s, buddySafetyAt: new Date().toISOString() }
    case 'hydrate': return a.state
  }
}

const Ctx = createContext<{ state: AppState; dispatch: (a: Action) => void; ready: boolean } | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState)
  const [ready, setReady] = useState(false)

  // Hydrate from device storage once, then persist every change
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => { if (raw) { const saved = JSON.parse(raw); dispatch({ type: 'hydrate', state: { ...emptyState(), demo: !!saved.demo, ...saved } }) } })
      .catch(() => { /* corrupt storage: keep seed */ })
      .finally(() => setReady(true))
  }, [])
  useEffect(() => { if (ready) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {}) }, [state, ready])
  // each time the app opens the store is asked whether Plus is still paid for
  useEffect(() => {
    if (!ready || !storeReady()) return
    hasPlus().then((paid) => { if (paid !== null) dispatch({ type: 'storeCheck', paid }) }).catch(() => {})
  }, [ready])
  // the record of workouts is kept in the app's database as well: sent a moment after sets change
  useEffect(() => {
    if (!ready) return
    const timer = setTimeout(() => { syncSets(state.sets).catch(() => {}) }, 2500)
    return () => clearTimeout(timer)
  }, [state.sets, ready])
  // Breeze speaks in the voice the user chose, wherever in the app it speaks
  useEffect(() => { setSpeakingVoice(state.voice) }, [state.voice])

  return <Ctx.Provider value={{ state, dispatch, ready }}>{children}</Ctx.Provider>
}

export function useStore() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useStore outside provider')
  return c
}
