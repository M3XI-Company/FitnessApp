import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { prettyDate } from '../lib/date'
import { MEMORY_GROUPS, memoryGroup, memoryOf } from '../lib/memory'
import { useStore } from '../lib/store'
import { C, T } from '../theme'
import { Button, Card, Icon, SheetHeader, tap } from '../components/ui'

/** Everything Breeze remembers about the user. They can delete any of it, or all of it. */
export default function Memory() {
  const { state, dispatch } = useStore()
  const [clearing, setClearing] = useState(false)
  const items = memoryOf(state)

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title="What Breeze remembers" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60, gap: 10 }}>
        <Text style={[T.sub, { lineHeight: 20, marginHorizontal: 4 }]}>
          Breeze keeps short notes from your conversations so it does not ask twice and can plan around your life. They stay on this phone and are sent to the coach with your messages, never with your name.
        </Text>
        {/* set out by what each note is about, so it reads as what Breeze knows about you, not a log */}
        {MEMORY_GROUPS.map((group) => {
          const notes = items.filter((m) => memoryGroup(m.text) === group.id)
          return (
            <View key={group.id} style={{ gap: 8, marginTop: 8 }}>
              <Text style={[T.title3, { marginHorizontal: 4 }]}>{group.title}</Text>
              {!notes.length && <Text style={[T.sub, { marginHorizontal: 4, lineHeight: 19 }]}>Nothing yet. {group.empty}</Text>}
              {notes.map((m) => (
                <Card key={m.id} tight style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[T.body, { fontSize: 16, lineHeight: 23 }]}>{m.text}</Text>
                    <Text style={T.caption}>{prettyDate(m.at.slice(0, 10))}</Text>
                  </View>
                  <Pressable hitSlop={10} accessibilityLabel={`Forget: ${m.text}`} onPress={() => { tap(); dispatch({ type: 'forget', ids: [m.id] }) }}>
                    <Icon name="close" size={20} color={C.text3} />
                  </Pressable>
                </Card>
              ))}
            </View>
          )
        })}
        <Button small variant="tinted" icon="sparkles-outline" title="Tell Breeze more about you" style={{ marginTop: 10 }} onPress={() => router.push('/welcome')} />
        {items.length > 0 && (clearing ? (
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <Button small variant="ghost" title="Cancel" style={{ flex: 1 }} onPress={() => setClearing(false)} />
            <Button small variant="dark" icon="trash-outline" title="Forget everything" style={{ flex: 1 }} onPress={() => { dispatch({ type: 'clearMemory' }); setClearing(false) }} />
          </View>
        ) : (
          <Button small variant="ghost" icon="trash-outline" title="Forget everything" style={{ marginTop: 10 }} onPress={() => setClearing(true)} />
        ))}
      </ScrollView>
    </View>
  )
}
