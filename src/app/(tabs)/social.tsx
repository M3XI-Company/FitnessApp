import { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { C, T } from '../../theme'
import { Card, Icon, Screen, Segmented, type IconName } from '../../components/ui'
import { BuddyFinder } from '../../components/social/BuddyFinder'

const COMING: [IconName, string, string][] = [
  ['restaurant-outline', 'Share meals & recipes', 'Post what you cooked, with its nutrition attached, so friends can save or log it.'],
  ['trophy-outline', 'Food challenges', 'Weekly challenges like “30 g protein at breakfast” with friends or your gym.'],
  ['chatbubbles-outline', 'Nutrition discussion (16+)', 'A moderated forum for food and training questions.'],
  ['person-add-outline', 'Follow friends', 'See progress and meals from people you choose. Private by default.'],
]

export default function Social() {
  const [tab, setTab] = useState<'buddies' | 'community'>('buddies')
  return (
    <Screen title="Social" scroll={false}>
      <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
        <Segmented value={tab} onChange={setTab} options={[{ value: 'buddies', label: 'Gym buddies' }, { value: 'community', label: 'Community' }]} />
      </View>
      {tab === 'buddies' ? (
        <>
          <Text style={[T.caption, { marginHorizontal: 20, marginBottom: 6 }]}>Preview: these are sample profiles, not real people, until Breeze accounts launch.</Text>
          <BuddyFinder />
        </>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 130, gap: 10 }}>
          <Text style={[T.sub, { lineHeight: 19, marginHorizontal: 4 }]}>Community features arrive with Breeze accounts. Food stays at the centre, and you control who sees what.</Text>
          {COMING.map(([icon, title, text]) => (
            <Card key={title} style={{ flexDirection: 'row', gap: 12 }}>
              <Icon name={icon} size={24} color={C.accent} />
              <View style={{ flex: 1, gap: 2 }}><Text style={T.headline}>{title}</Text><Text style={[T.sub, { lineHeight: 18 }]}>{text}</Text></View>
            </Card>
          ))}
        </ScrollView>
      )}
    </Screen>
  )
}
