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
  /** date of the workout the coach is walking the user through */
  guide?: string
  /** reminder times the coach suggests; nothing is scheduled until the user turns them on */
  reminders?: ReminderTimes
}

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
/** One day of the weekly routine; a rest day has no items */
export interface RoutineDay { title: string; focus: string; items: RoutineItem[] }
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
  /** earlier conversations, newest first */
  threads?: ChatThread[]
  /** meal and workout reminders; off until the user turns them on */
  reminders?: ReminderSettings
  /** the weekly workout routine in use; when absent one is built from the profile */
  routine?: WeeklyRoutine
  /** latest body scan description, if the user chose to do one */
  bodyScan?: BodyScan
  buddies: string[] // connected buddy ids
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
