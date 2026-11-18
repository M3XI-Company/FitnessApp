/**
 * The shape of one streak of wind at one moment, as an outline to fill.
 *
 * A streak is the mark on the app icon: a long, soft line of moving air that
 * comes to a fine point at both ends and is fullest in the middle, like a
 * brush stroke. It has no head and no tail, and it does not wriggle: it holds
 * a long shallow curve that slowly leans one way and then the other as it
 * blows across, the way a ribbon lies on the wind. The orb
 * (components/SkyOrb.tsx) asks for the shape again every frame.
 */
export interface Gust {
  /** length from point to point */
  length: number
  /** thickness at its fullest, in the middle */
  width: number
  /** how far the line curves along its length, in radians */
  bend: number
  /** how far the whole streak rises and falls as it flies */
  swerve: number
  /** how many shallow waves fit along the line (well under one, so it never looks like it is swimming) */
  ripples: number
  /** where in its sway this streak starts, so no two move together */
  phase: number
}

const BODY = 28
/** The steepest the line may run. */
const STEEPEST = 0.6

/**
 * The outline of the streak with its trailing point at (x, y), `time` seconds
 * in. `wild` scales how much it curves and sways: 1 is its ordinary self, less
 * is calmer, more is livelier. Returns an SVG path: along one side to the
 * leading point and back along the other.
 */
export function gustPath(g: Gust, x: number, y: number, time: number, wild = 1): string {
  const left: string[] = []
  const right: string[] = []
  const point = (px: number, py: number) => `${px.toFixed(1)} ${py.toFixed(1)}`
  let px = x
  // the whole streak rises and falls as it flies
  let py = y + wild * g.swerve * Math.sin(time * 0.9 + g.phase * 1.3)
  const bend = wild * g.bend
  // the curve leans one way and then the other, slowly
  const lean = bend * 0.5 * Math.sin(time * 0.6 + g.phase * 2.1)
  const step = g.length / BODY
  for (let i = 0; i <= BODY; i++) {
    const along = i / BODY
    // one long shallow wave drifting back along the line
    const heading = Math.max(-STEEPEST, Math.min(STEEPEST, bend * Math.sin(Math.PI * 2 * g.ripples * along - time * 0.8 + g.phase) + lean))
    // a fine point at each end, fullest in the middle
    const half = (g.width / 2) * Math.sin(Math.PI * along) ** 0.7
    const nx = Math.sin(heading) * half
    const ny = Math.cos(heading) * half
    left.push(point(px - nx, py - ny))
    right.push(point(px + nx, py + ny))
    if (i < BODY) { px += step * Math.cos(heading); py -= step * Math.sin(heading) }
  }
  return `M${[...left, ...right.reverse()].join('L')}Z`
}

/** How far the streak reaches from its trailing point: used to start it out of sight. */
export const gustReach = (g: Gust) => g.length + g.width
