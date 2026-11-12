export type Sex = 'male' | 'female'
export type Activity = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete'
export type GoalType = 'lose' | 'maintain' | 'gain'
export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

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
export type FoodSource = 'cofid' | 'off' | 'manual' | 'ai' | 'boxed'

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
}

export interface SetLog {
  id: string
  date: string
  exerciseId: string
  weight: number
  reps: number
}

export interface WeightLog {
  date: string
  kg: number
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
  chat: ChatMessage[]
  buddies: string[] // connected buddy ids
  blocked: string[]
  reports: { id: string; targetId: string; reason: string; at: string }[]
  /** ISO time the user accepted the meeting-safety guidelines */
  buddySafetyAt?: string
}
