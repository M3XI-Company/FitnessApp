import { ScrollView, Text, View } from 'react-native'
import { computeTargets } from '../../lib/nutrition'
import { recipeById } from '../../lib/recipes'
import { WEEKDAYS } from '../../lib/routine'
import type { Profile, WeeklyRoutine } from '../../lib/types'
import { C, T } from '../../theme'
import { RichText } from '../chat/RichText'
import { RoutineDays } from '../coach/RoutineDays'
import { ProjectionChart, StatTile } from '../stats/ProgressCharts'
import { Card, Icon } from '../ui'

/**
 * The plan as it is first shown: what the coach made of the conversation,
 * the numbers it works to, where they lead, the week of training day by day
 * with a picture of what each day works, and the first day's meals.
 */
export function PlanPoster({ profile, routine, note, meals }: { profile: Profile; routine: WeeklyRoutine; note: string; meals?: Record<string, string[]> }) {
  const targets = computeTargets(profile)
  const training = WEEKDAYS.filter((d) => routine.days[d].items.length)
  const firstDay = meals ? Object.keys(meals).sort()[0] : undefined
  const food = firstDay ? meals![firstDay].map(recipeById).filter((r) => !!r) : []
  return (
    <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
      <View style={{ gap: 6 }}>
        <Text style={T.eyebrow}>Built from our conversation</Text>
        <Text style={T.largeTitle}>{profile.name ? `${profile.name.split(' ')[0]}’s plan` : 'Your plan'}</Text>
      </View>
      {!!note && (
        <Card style={{ backgroundColor: C.night }}>
          <RichText text={note} color={C.cloud} strong="#fff" />
        </Card>
      )}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <StatTile big={`${training.length}`} small="training days" />
        <StatTile big={`${targets.kcal}`} small="kcal a day" />
        <StatTile big={`${targets.protein} g`} small="protein a day" />
      </View>
      <ProjectionChart profile={profile} kcal={targets.kcal} />
      <Card style={{ paddingVertical: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10 }}>
          <Icon name="barbell-outline" color={C.accent} /><Text style={[T.title3, { flex: 1 }]}>Your week</Text>
        </View>
        <RoutineDays routine={routine} sex={profile.sex} />
      </Card>
      {food.length > 0 && (
        <Card style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="restaurant-outline" color={C.accent} /><Text style={[T.title3, { flex: 1 }]}>Eating, day one</Text>
          </View>
          {food.map((r) => (
            <View key={r.recipe.id} style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={[T.body, { fontSize: 16, lineHeight: 23, color: C.text3 }]}>•</Text>
              <Text style={[T.body, { flex: 1, fontSize: 16, lineHeight: 23 }]}>{r.recipe.title} <Text style={{ color: C.text2 }}>– {Math.round(r.perServing.kcal)} kcal, {Math.round(r.perServing.protein)} g protein</Text></Text>
            </View>
          ))}
          <Text style={T.caption}>A week of meals is planned to your calories. Ask Breeze to swap anything you do not like.</Text>
        </Card>
      )}
    </ScrollView>
  )
}
