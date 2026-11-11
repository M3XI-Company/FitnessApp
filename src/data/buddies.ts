export interface Buddy {
  id: string
  name: string
  age: number
  avatar: string
  goal: 'Lose fat' | 'Build muscle' | 'Get fit' | 'Run'
  level: 'Beginner' | 'Intermediate' | 'Advanced'
  times: ('Morning' | 'Lunch' | 'Evening')[]
  km: number
  gym: string
  streak: number
  bio: string
}

export const BUDDIES: Buddy[] = [
  { id: 'b1', name: 'Maya', age: 27, avatar: '🧘‍♀️', goal: 'Get fit', level: 'Beginner', times: ['Morning'], km: 0.8, gym: 'Harbor Fitness', streak: 12, bio: 'Morning person. Looking for someone to keep me honest at 6:30am.' },
  { id: 'b2', name: 'Jordan', age: 31, avatar: '🏋️', goal: 'Build muscle', level: 'Advanced', times: ['Evening'], km: 1.6, gym: 'Iron District', streak: 48, bio: 'PPL split, happy to spot and share programming.' },
  { id: 'b3', name: 'Sam', age: 24, avatar: '🏃', goal: 'Run', level: 'Intermediate', times: ['Morning', 'Evening'], km: 2.4, gym: 'Riverside track', streak: 21, bio: 'Training for a half marathon in spring.' },
  { id: 'b4', name: 'Priya', age: 29, avatar: '💪', goal: 'Lose fat', level: 'Intermediate', times: ['Lunch'], km: 0.5, gym: 'Harbor Fitness', streak: 9, bio: 'Lunchtime lifts + walks. Down 6 kg so far!' },
  { id: 'b5', name: 'Leo', age: 35, avatar: '🚴', goal: 'Get fit', level: 'Beginner', times: ['Evening'], km: 3.9, gym: 'Bay Cycle Club', streak: 4, bio: 'Getting back into shape after a long break.' },
  { id: 'b6', name: 'Ava', age: 22, avatar: '🤸‍♀️', goal: 'Build muscle', level: 'Beginner', times: ['Morning', 'Lunch'], km: 1.1, gym: 'Iron District', streak: 16, bio: 'New to lifting, would love a patient partner.' },
  { id: 'b7', name: 'Marcus', age: 40, avatar: '🥊', goal: 'Lose fat', level: 'Advanced', times: ['Morning'], km: 4.7, gym: 'Southside Boxing', streak: 63, bio: 'Boxing conditioning 4x/week. Come sweat.' },
  { id: 'b8', name: 'Noor', age: 26, avatar: '🏊‍♀️', goal: 'Get fit', level: 'Intermediate', times: ['Lunch', 'Evening'], km: 2.0, gym: 'Aquatic Centre', streak: 30, bio: 'Swim + strength. Looking for accountability.' },
]
