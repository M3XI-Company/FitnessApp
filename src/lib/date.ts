export const todayKey = (d = new Date()) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const addDays = (key: string, n: number) => {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return todayKey(dt)
}

export const lastNDays = (n: number, from = todayKey()) =>
  Array.from({ length: n }, (_, i) => addDays(from, i - (n - 1)))

export const weekdayShort = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'narrow' })
}

export const prettyDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
