/**
 * Breeze age policy (M3XI)
 *  16+  workouts, nutrition, meal planning, moderated forum
 *  18+  gym buddy discovery and direct messaging (initially)
 * 16–17-year-olds are never matched with adults, and their profiles are private by default.
 */
export const MIN_AGE = 16
export const ADULT_AGE = 18

export const isAdult = (age: number) => age >= ADULT_AGE
export const canDiscoverBuddies = (age: number) => isAdult(age)
export const canDirectMessage = (age: number) => isAdult(age)
export const canUseForum = (age: number) => age >= MIN_AGE

/** No adult–minor matching: both people must be in the same band */
export const sameAgeBand = (a: number, b: number) => isAdult(a) === isAdult(b)
