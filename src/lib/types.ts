export type Sex = 'male' | 'female'
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete'
export type GoalType = 'lose' | 'maintain' | 'gain'
/** 'breakfast' | 'lunch' | 'dinner' | 'snack', or the id of a custom meal category */
export type MealSlot = string

export interface MealCategory { slot: MealSlot; label: string; emoji: string; share?: number }

export interface Profile {
  name: string
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  targetWeightKg: number
  activity: Activity
  goal: GoalType
  onboarded: boolean
  /** ISO time the user accepted the health & safety notice */
  healthNoticeAt?: string
  /** ISO time the user agreed to on-device camera form checks */
  formConsentAt?: string
  /** the gym the user trains at; gym buddies are limited to it */
  gym?: string
  /** where that gym is, when it was picked from search (an OpenStreetMap id and its position) */
  gymPlace?: { id: string; lat: number; lon: number }
  /** notes from a conversation that is still being reviewed; saved into AppState.memory when it is confirmed */
  notes?: string
  /** index into the 3D figure's skin tones */
  figureTone?: number
}

export interface Macros {
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export interface Targets extends Macros {
  waterMl: number
}

/** Where nutrition values came from — drives attribution and "estimate" labels */
export type FoodSource = 'cofid' | 'off' | 'manual' | 'ai' | 'boxed' | 'recipe'

export interface FoodItem extends Macros {
  id: string
  source?: FoodSource
  /** grams in one serving; when set, the UI lets people log by weight */
  servingG?: number
  kj?: number
  name: string
  brand?: string
  serving: string
  emoji?: string
  barcode?: string
  /** A–E grade, Nutri-Score style */
  grade?: 'A' | 'B' | 'C' | 'D' | 'E'
}

export interface FoodEntry extends Macros {
  id: string
  date: string
  meal: MealSlot
  name: string
  brand?: string
  serving: string
  qty: number
  emoji?: string
  source: 'search' | 'barcode' | 'boxed' | 'manual' | 'scan' | 'photo'
  /** nutrition database the values came from */
  dataSource?: FoodSource
  /** grams eaten, when logged by weight */
  grams?: number
  /** true when values are an estimate (e.g. from a photo) rather than a label/database */
  isEstimate?: boolean
  /** demonstration data (seeded), removable from Profile */
  demo?: boolean
}

/** How much of a food was eaten: by weight (needs item.servingG) or by servings */
export type Amount = { grams: number } | { servings: number }

/** A saved meal (from the diary) or a custom meal (built by the user) */
export interface SavedMeal {
  id: string
  name: string
  emoji: string
  kind: 'saved' | 'custom'
  items: { item: FoodItem; amount: Amount }[]
  createdAt: string
}

export interface SetLog {
  id: string
  date: string
  exerciseId: string
  weight: number
  reps: number
  demo?: boolean
}

export interface WeightLog {
  date: string
  kg: number
  demo?: boolean
}

export interface WaterPlan {
  startHour: number
  endHour: number
  glassMl: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'coach'
  text: string
  /** optional structured workout card */
  workout?: { title: string; items: { exerciseId: string; sets: number; reps: string }[] }
  /** a weekly routine the coach proposes; nothing changes until the user applies it */
  routine?: WeeklyRoutine
  /** a meal plan the coach proposes: date -> recipe ids */
  meals?: Record<string, string[]>
  /** date whose plan (workout and meals) is shown as a card under the message */
  day?: string
  /** date of a workout laid out to look through before doing it */
  preview?: string
  /** date of the workout the coach is walking the user through */
  guide?: string
  /** reminder times the coach suggests; nothing is scheduled until the user turns them on */
  reminders?: ReminderTimes
  /** questions the coach asks with answers to tap (lib/questions) */
  questions?: import('./questions').CoachQuestion[]
  /** the progress charts are shown under the message */
  progress?: boolean
  /** facts the coach added to its memory with this reply, shown under it as "Noted" */
  noted?: string[]
  /** a change to the user's details the coach suggests; nothing changes until the user applies it */
  details?: DetailsChange
  /** date of the workout this message asks about, once it is finished */
  checkin?: string
  /** how the coach judged the conversation to be going at this reply, which sets the look of the orb */
  mood?: 'calm' | 'upbeat' | 'fired_up' | 'gentle' | 'proud'
}

/** One thing Breeze remembers about the user, in the coach's own words */
export interface MemoryItem { id: string; at: string; text: string }

/** Details the coach can suggest changing from the conversation; only the fields that change are present */
export interface DetailsChange { weightKg?: number; targetWeightKg?: number; goal?: GoalType; activity?: Activity }

/** A saved conversation. The one in progress lives in AppState.chat. */
export interface ChatThread {
  id: string
  /** the first thing the user said, shortened */
  title: string
  /** ISO time of the last message */
  at: string
  messages: ChatMessage[]
}

/** When to remind, as 24-hour "HH:MM" */
export interface ReminderTimes { breakfast: string; lunch: string; dinner: string; workout: string }
export interface ReminderSettings {
  on: boolean
  /** ping again every few minutes until the app is opened */
  repeat: boolean
  /** ring and buzz like an alarm clock rather than arrive as a quiet notification; on unless switched off */
  alarm?: boolean
  times: ReminderTimes
}

/**
 * A coarse, neutral description of the user's build from a photo they chose to
 * take. The photo itself is never kept; this is all that is stored, on the device.
 */
export interface BodyScan {
  at: string
  build: 'slender' | 'average' | 'athletic' | 'sturdy' | 'fuller'
  muscle: 'early' | 'developing' | 'developed'
  posture: string[]
  focusAreas: string[]
  summary: string
  confidence: 'high' | 'medium' | 'low'
}

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export interface RoutineItem { exerciseId: string; sets: number; reps: string }
/**
 * How a training day is done. Strength: heavier weight and few reps.
 * Volume: a comfortable weight and as many clean reps as the range allows.
 */
export type TrainingStyle = 'strength' | 'volume'
/** One day of the weekly routine; a rest day has no items */
export interface RoutineDay { title: string; focus: string; items: RoutineItem[]; style?: TrainingStyle }
export interface WeeklyRoutine {
  id: string
  createdAt: string
  /** built from the onboarding profile, or proposed by the AI coach */
  source: 'profile' | 'coach'
  days: Record<Weekday, RoutineDay>
}

export interface UserGoal {
  id: string
  title: string
  metric: 'workouts_week' | 'protein_days' | 'water_days' | 'weight' | 'log_streak'
  target: number
  createdAt: string
}

export interface AppState {
  profile: Profile
  targets: Targets
  food: FoodEntry[]
  water: Record<string, number>
  sets: SetLog[]
  weights: WeightLog[]
  waterPlan: WaterPlan
  boxedPlan: Record<string, string[]> // date -> boxed meal ids
  goals: UserGoal[]
  /** the conversation in progress */
  chat: ChatMessage[]
  /** id of the conversation in progress */
  chatId?: string
  /** the day the conversation in progress began; a new one starts each day */
  chatDay?: string
  /** earlier conversations, newest first */
  threads?: ChatThread[]
  /** the small conversations kept with one exercise, meal or recipe, by topic id ("exercise:squat") */
  topicChats?: Record<string, ChatMessage[]>
  /** how hard the plan pushes (lib/intensity); steady when absent */
  intensity?: import('./intensity').Intensity
  /** what the coach remembers about the user between conversations, newest first */
  memory?: MemoryItem[]
  /** meal and workout reminders; off until the user turns them on */
  reminders?: ReminderSettings
  /** what the coach made of the person's progress, and the day it said so; asked for once a day */
  insight?: { date: string; text: string }
  /** the voice Breeze speaks with (lib/voices); the default when not chosen */
  voice?: string
  /** the plan the person is on (lib/plan); free when absent */
  subscription?: import('./plan').Subscription
  /** a free user's answer about sharing their data; absent until they are asked */
  dataChoice?: import('./plan').DataChoice
  /** the weekly workout routine in use; when absent one is built from the profile */
  routine?: WeeklyRoutine
  /** latest body scan description, if the user chose to do one */
  bodyScan?: BodyScan
  /** unused since partner matching moved to the server; kept so saved data still loads */
  buddies: string[]
  /** what the person wrote for their training-partner profile (lib/buddyRules), so the form opens filled in */
  buddy?: import('./buddyRules').BuddySetup
  blocked: string[]
  reports: { id: string; targetId: string; reason: string; at: string }[]
  /** ISO time the user accepted the meeting-safety guidelines */
  buddySafetyAt?: string
  /** targets the user set by hand (override the calculated ones) */
  customTargets?: Partial<Targets>
  favourites: FoodItem[]
  savedMeals: SavedMeal[]
  /** custom meal categories, in addition to breakfast/lunch/dinner/snacks */
  mealCategories: MealCategory[]
  /** whether demonstration data is loaded */
  demo: boolean
  /** dates whose water total came from demo data */
  demoWater?: string[]
}
