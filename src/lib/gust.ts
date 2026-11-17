/**
 * The shape of one gust of wind at one moment, as an outline to fill.
 *
 * A gust is the mark on the app icon: a line that starts as a fine point,
 * thickens, and ends in a hook. Here it is alive rather than a fixed picture:
 * a ripple runs along it from head to tail, so the line itself bends like a
 * ribbon in the wind, and the hook curls tighter and looser as it goes. The
 * orb (components/SkyOrb.tsx) asks for the shape again every frame.
 */
export interface Gust {
  /** length of the straight part */
  length: number
  /** thickness at its thickest */
  width: number
  /** radius of the hook at the end */
  hook: number
  /** how far the hook turns, in radians: positive curls upwards, negative downwards */
  turn: number
  /** how far the line bends as the ripple passes, in radians */
  bend: number
  /** how many ripples fit along the line */
  ripples: number
  /** where in its ripple and its curl this gust starts, so no two move together */
  phase: number
}

const BODY = 16
const HOOK = 12
const CAP = 5

/**
 * The outline of the gust with its tail at (x, y), `time` seconds in.
 * Returns an SVG path: up one side, round the tip, and back down the other.
 */
export function gustPath(g: Gust, x: number, y: number, time: number): string {
  const left: string[] = []
  const right: string[] = []
  const point = (px: number, py: number) => `${px.toFixed(1)} ${py.toFixed(1)}`
  let px = x
  let py = y
  let heading = 0
  let half = 0
  const mark = () => {
    // the two edges sit either side of the middle line, at right angles to it
    const nx = Math.sin(heading) * half
    const ny = Math.cos(heading) * half
    left.push(point(px - nx, py - ny))
    right.push(point(px + nx, py + ny))
  }
  const step = g.length / BODY
  for (let i = 0; i <= BODY; i++) {
    const along = i / BODY
    // the ripple travels towards the tail, and the tail flutters more than the head
    heading = g.bend * (1 - 0.55 * along) * Math.sin(Math.PI * 2 * g.ripples * along + time * 2.6 + g.phase)
    half = Math.max(0.35, (g.width / 2) * along ** 0.85)
    mark()
    if (i < BODY) { px += step * Math.cos(heading); py -= step * Math.sin(heading) }
  }
  // the hook: it curls tighter and looser, slowly, and tightens towards its tip
  const turn = g.turn * (1 + 0.2 * Math.sin(time * 1.3 + g.phase * 1.7))
  half = g.width / 2
  for (let i = 1; i <= HOOK; i++) {
    const radius = g.hook * (1 - 0.3 * (i / HOOK))
    const by = turn / HOOK
    heading += by
    px += radius * Math.abs(by) * Math.cos(heading)
    py -= radius * Math.abs(by) * Math.sin(heading)
    mark()
  }
  // a round tip
  const tip: string[] = []
  for (let i = 1; i < CAP; i++) {
    const a = (Math.PI * i) / CAP
    const dx = -Math.sin(heading) * Math.cos(a) + Math.cos(heading) * Math.sin(a)
    const dy = -Math.cos(heading) * Math.cos(a) - Math.sin(heading) * Math.sin(a)
    tip.push(point(px + dx * half, py + dy * half))
  }
  return `M${[...left, ...tip, ...right.reverse()].join('L')}Z`
}

/** How far the gust reaches from its tail to the far side of its hook: used to start it out of sight. */
export const gustReach = (g: Gust) => g.length + g.hook * 2 + g.width
