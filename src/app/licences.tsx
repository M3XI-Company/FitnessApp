import { Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { SOURCES } from '../lib/sources'
import { cofidCount } from '../lib/foodDb'
import { photoCredits } from '../lib/photos'
import { C, T } from '../theme'
import { Card, Icon, SheetHeader } from '../components/ui'

const ORDER = ['cofid', 'off', 'recipe', 'ai', 'manual'] as const

export default function Licences() {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title="Data sources & licences" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <Text style={[T.sub, { lineHeight: 19 }]}>
          Breeze uses UK nutrition data first. Generic foods come from the UK government&apos;s official dataset ({cofidCount.toLocaleString()} foods, per 100 g). Packaged products are looked up by barcode on Open Food Facts, preferring UK listings. Salt is shown as salt (not sodium), and traffic lights use the UK Food Standards Agency front-of-pack thresholds.
        </Text>
        {ORDER.map((k) => {
          const s = SOURCES[k]
          return (
            <Card key={k} style={{ gap: 6 }}>
              <Text style={T.title3}>{s.short}</Text>
              <Text style={T.headline}>{s.name}</Text>
              <Text style={T.sub}>Licence: {s.licence}</Text>
              <Text style={[T.body, { lineHeight: 21 }]}>{s.attribution}</Text>
              {s.url && (
                <Pressable onPress={() => Linking.openURL(s.url!)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Icon name="open-outline" size={16} color={C.accent} /><Text style={{ color: C.accent, fontWeight: '600' }}>View source</Text>
                </Pressable>
              )}
            </Card>
          )
        })}
        <Card style={{ gap: 6 }}>
          <Text style={T.title3}>Exercise guidance</Text>
          <Text style={T.headline}>NHS Live Well: Exercise</Text>
          <Text style={T.sub}>Licence: Open Government Licence v3.0</Text>
          <Text style={[T.body, { lineHeight: 21 }]}>The coach&apos;s advice on how much activity to do, how hard, warming up and when to see a GP follows the NHS physical activity guidelines for England, summarised in our own words. Breeze is not run or endorsed by the NHS.</Text>
          <Pressable onPress={() => Linking.openURL('https://www.nhs.uk/live-well/exercise/')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Icon name="open-outline" size={16} color={C.accent} /><Text style={{ color: C.accent, fontWeight: '600' }}>View source</Text>
          </Pressable>
        </Card>
        <Card style={{ gap: 6 }}>
          <Text style={T.title3}>Software and artwork</Text>
          <Text style={[T.body, { lineHeight: 21 }]}>Icons: Lucide (ISC licence). Muscle maps: react-native-body-highlighter (MIT). Pose detection: Google MediaPipe (Apache 2.0). 3D: three.js and React Three Fiber (MIT).</Text>
        </Card>
        <Card style={{ gap: 6 }}>
          <Text style={T.title3}>Food photographs</Text>
          <Text style={T.headline}>Wikimedia Commons</Text>
          <Text style={[T.body, { lineHeight: 21 }]}>The photos of meals and ingredients are openly licensed pictures from Wikimedia Commons, shown cropped and resized to fit. They show the kind of dish or ingredient, not this exact recipe. Tap one to see its author and full licence.</Text>
          {photoCredits().map((p) => (
            <Pressable key={p.page} onPress={() => Linking.openURL(p.page)} accessibilityRole="link" style={{ paddingTop: 8, borderTopWidth: 1, borderTopColor: C.sep }}>
              <Text style={[T.sub, { color: C.text }]} numberOfLines={1}>{p.title}</Text>
              <Text style={T.caption} numberOfLines={1}>{p.by || 'Unknown author'} · {p.licence}</Text>
            </Pressable>
          ))}
        </Card>
        <Card style={{ gap: 6, backgroundColor: C.accentSoft }}>
          <Text style={T.headline}>Nutrition values are estimates</Text>
          <Text style={[T.body, { lineHeight: 21 }]}>Food composition varies between brands, batches and recipes. Always check the pack label, and correct any entry by tapping it in your diary.</Text>
        </Card>
      </ScrollView>
    </View>
  )
}
