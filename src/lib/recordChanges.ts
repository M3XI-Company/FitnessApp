/**
 * What has to be sent to keep the database's record of workouts the same as
 * the phone's: sets logged since the last send, and sets since deleted.
 * Demonstration sets are never sent.
 */
import type { SetLog } from './types'

export const RECORD_BATCH = 400

export function recordChanges(sets: SetLog[], sent: string[]): { add: SetLog[]; remove: string[] } {
  const real = sets.filter((s) => !s.demo)
  const was = new Set(sent)
  const now = new Set(real.map((s) => s.id))
  return { add: real.filter((s) => !was.has(s.id)).slice(0, RECORD_BATCH), remove: sent.filter((id) => !now.has(id)).slice(0, RECORD_BATCH) }
}

/** The list of sent ids after a send went through. */
export const afterSend = (sent: string[], change: { add: SetLog[]; remove: string[] }) => {
  const gone = new Set(change.remove)
  return [...sent.filter((id) => !gone.has(id)), ...change.add.map((s) => s.id)]
}
