import { useState } from 'react'
import { Image, Pressable, Text, View } from 'react-native'
import { EXERCISE_ART } from '../../data/exerciseArt'
import { exerciseById, worksFor } from '../../data/exercises'
import { C } from '../../theme'
import { tap } from '../ui'
import { artMotion } from '../../lib/artMotion'
import { MuscleMap } from '../MuscleMap'
import { ArtMotion } from './ArtMotion'

/** Which build's figure an exercise is shown with: the user's own, or the other when only that exists. */
function artBuild(exerciseId: string, sex?: string): 'male' | 'female' | undefined {
  const art = EXERCISE_ART[exerciseId]
  if (!art) return undefined
  const own = sex === 'female' ? 'female' : 'male'
  return art[own] ? own : art.male ? 'male' : art.female ? 'female' : undefined
}

/** The poster-style figure for an exercise: the one for this build, or the other build's when only that exists. */
export function exerciseArt(exerciseId: string, sex?: string): number | undefined {
  const build = artBuild(exerciseId, sex)
  return build && EXERCISE_ART[exerciseId][build]
}

/**
 * How an exercise is shown: a figure in the style of the charts on gym
 * equipment, a man or a woman to match the user, with the muscles doing the
 * work lit in red and the ones helping in orange. A button sets the picture
 * itself moving. Exercises that have no chart figure yet show the muscles
 * they work on the body chart instead.
 */
export function ExerciseFigure({ exerciseId, sex, height }: { exerciseId: string; sex?: string; height?: number }) {
  const art = exerciseArt(exerciseId, sex)
  const [moving, setMoving] = useState(false)
  const build = artBuild(exerciseId, sex)
  const rig = build && artMotion(exerciseId, build)
  if (!art) {
    const works = worksFor(exerciseId)
    return (
      <View style={{ backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 14, height }}>
        <MuscleMap primary={works.primary} secondary={works.secondary} gender={sex === 'female' ? 'female' : 'male'} />
      </View>
    )
  }
  return (
    // the box sets the size; left to itself the picture would be drawn at its own, larger than the screen
    <View style={{ width: '100%', aspectRatio: 1376 / 768, backgroundColor: '#fff' }}>
      {moving && rig ? <ArtMotion art={art} rig={rig} /> : <Image source={art} resizeMode="contain" accessibilityLabel={`${exerciseById(exerciseId)?.name ?? 'Exercise'}: the position, with the working muscles in red and the helping muscles in orange`}
        style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }} />}
      <View style={{ position: 'absolute', left: 12, bottom: 10, flexDirection: 'row', gap: 12 }}>
        <Key color="#E5352B" label="Working" />
        <Key color="#F08A24" label="Helping" />
      </View>
      {!!rig && <Swap label={moving ? 'Still' : 'See it move'} onPress={() => setMoving(!moving)} />}
    </View>
  )
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ fontSize: 11.5, fontWeight: '600', color: C.text2 }}>{label}</Text>
    </View>
  )
}

function Swap({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={() => { tap(); onPress() }} hitSlop={8} accessibilityRole="button"
      style={({ pressed }) => [{ position: 'absolute', right: 10, paddingHorizontal: 12, height: 30, borderRadius: 15, justifyContent: 'center', backgroundColor: C.fill }, { bottom: 8 }, pressed && { opacity: 0.6 }]}>
      <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.accent }}>{label}</Text>
    </Pressable>
  )
}
