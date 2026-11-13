import { Redirect } from 'expo-router'
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs'
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Icon, type IconName } from '../../components/icons'
import { useStore } from '../../lib/store'
import { C } from '../../theme'
import { tap } from '../../components/ui'

const TABS: Record<string, { label: string; icon: IconName; iconOn: IconName }> = {
  index: { label: 'Home', icon: 'home-outline', iconOn: 'home' },
  food: { label: 'Food', icon: 'restaurant-outline', iconOn: 'restaurant' },
  recipes: { label: 'Recipes', icon: 'book-outline', iconOn: 'book' },
  fitness: { label: 'Fitness', icon: 'barbell-outline', iconOn: 'barbell' },
  social: { label: 'Social', icon: 'people-outline', iconOn: 'people' },
}

function FloatingTabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const item = (index: number) => {
    const route = state.routes[index]
    const meta = TABS[route.name]
    const on = state.index === index
    return (
      <Pressable key={route.key} accessibilityRole="tab" accessibilityLabel={meta.label} style={st.tab}
        onPress={() => { tap(); if (!on) navigateToTab(route.key) }}>
        <Icon name={on ? meta.iconOn : meta.icon} size={23} color={on ? C.accent : C.text3} strokeWidth={on ? 2.3 : 1.8} />
        <Text style={[st.label, { color: on ? C.accent : C.text3 }]}>{meta.label}</Text>
        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: on ? C.sky : 'transparent' }} />
      </Pressable>
    )
  }
  return (
    <View style={[st.bar, { bottom: Math.max(12, insets.bottom) }]}>
      {state.routes.map((_, i) => item(i))}
    </View>
  )
}

export default function TabsLayout() {
  const { state, ready } = useStore()
  if (!ready) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}><ActivityIndicator color={C.sky} /></View>
  if (!state.profile.onboarded) return <Redirect href="/onboarding" />
  return (
    <Tabs tabBar={(p) => <FloatingTabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: C.bg } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="food" />
      <Tabs.Screen name="recipes" />
      <Tabs.Screen name="fitness" />
      <Tabs.Screen name="social" />
    </Tabs>
  )
}

const st = StyleSheet.create({
  bar: {
    position: 'absolute', left: 12, right: 12, height: 70, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.94)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(15,36,64,0.06)',
    ...Platform.select({
      ios: { shadowColor: '#3B2F1E', shadowOpacity: 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
      android: { elevation: 12 },
      default: { boxShadow: '0 10px 40px rgba(15,36,64,.14)' },
    }),
  },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  label: { fontSize: 10.5, fontWeight: '600' },
})
