import { Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useStore } from '../lib/store'
import { todayKey } from '../lib/date'
import { C, T } from '../theme'
import { Icon, IconTile, success, tap, type IconName } from '../components/ui'

export default function QuickAdd() {
  const insets = useSafeAreaInsets()
  const { state, dispatch } = useStore()
  const go = (fn: () => void) => () => { tap(); router.back(); setTimeout(fn, 60) }
  const items: [IconName, string, () => void][] = [
    ['barcode-outline', 'Scan barcode', go(() => router.push({ pathname: '/scanner', params: { mode: 'barcode' } }))],
    ['scan-outline', 'Product scanner', go(() => router.push({ pathname: '/scanner', params: { mode: 'product' } }))],
    ['camera-outline', 'Snap your meal', go(() => router.push('/food-photo'))],
    ['search', 'Log food', go(() => router.push('/add-food'))],
    ['water', `+${state.waterPlan.glassMl} ml water`, () => { success(); dispatch({ type: 'water', date: todayKey(), delta: state.waterPlan.glassMl }); router.back() }],
    ['barbell-outline', 'Log workout', go(() => router.navigate('/fitness'))],
    ['scale-outline', 'Log weight', go(() => router.push('/weight'))],
    ['book-outline', 'Recipes', go(() => router.navigate('/recipes'))],
    ['sparkles-outline', 'Ask AI trainer', go(() => router.navigate({ pathname: '/fitness', params: { q: 'Build me a workout' } }))],
  ]
  return (
    <Pressable style={{ flex: 1, backgroundColor: 'rgba(20,18,16,.42)', justifyContent: 'flex-end' }} onPress={() => router.back()}>
      <Pressable onPress={() => {}} style={{ margin: 12, marginBottom: Math.max(12, insets.bottom) + 84, backgroundColor: C.bg, borderRadius: 28, padding: 16 }}>
        <Text style={[T.title3, { marginBottom: 12, marginLeft: 4 }]}>Quick add</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {items.map(([icon, label, fn]) => (
            <Pressable key={label} onPress={fn} style={({ pressed }) => [{ width: '48.4%', backgroundColor: '#fff', borderRadius: 18, padding: 14, gap: 10 }, pressed && { opacity: 0.75 }]}>
              <IconTile icon={icon} />
              <Text style={T.headline}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
      <View style={{ position: 'absolute', alignSelf: 'center', bottom: Math.max(12, insets.bottom) + 8 }}>
        <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: C.text, alignItems: 'center', justifyContent: 'center' }}><Icon name="close" size={28} color="#fff" /></View>
      </View>
    </Pressable>
  )
}
