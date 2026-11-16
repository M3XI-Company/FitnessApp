import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import { prettyDate } from '../lib/date'
import { useStore } from '../lib/store'
import { C, T } from '../theme'
import { Button, Card, Icon, SheetHeader, tap } from '../components/ui'

/** Earlier chats: open one to carry on with it, or start a new one. */
export default function History() {
  const { state, dispatch } = useStore()
  const [editing, setEditing] = useState(false)
  const threads = state.threads ?? []
  const open = (id: string) => { tap(); dispatch({ type: 'openChat', id }); router.back() }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title="Chats" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60, gap: 10 }}>
        <Button title="New chat" icon="create-outline" onPress={() => { dispatch({ type: 'newChat' }); router.back() }} />
        {threads.length > 0 && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginHorizontal: 4 }}>
            <Text style={[T.caption, { fontWeight: '700', letterSpacing: 1 }]}>EARLIER</Text>
            <Pressable hitSlop={10} onPress={() => { tap(); setEditing(!editing) }}><Text style={{ color: C.accent, fontWeight: '600', fontSize: 15 }}>{editing ? 'Done' : 'Edit'}</Text></Pressable>
          </View>
        )}
        {threads.map((t) => (
          <Card key={t.id} tight onPress={editing ? undefined : () => open(t.id)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {editing && (
              <Pressable hitSlop={8} accessibilityLabel={`Delete chat: ${t.title}`} onPress={() => { tap(); dispatch({ type: 'deleteChat', id: t.id }) }}>
                <Icon name="remove-circle" size={24} color={C.red} />
              </Pressable>
            )}
            <View style={{ flex: 1 }}>
              <Text style={T.headline} numberOfLines={1}>{t.title}</Text>
              <Text style={T.caption}>{prettyDate(t.at.slice(0, 10))} · {t.messages.length} message{t.messages.length === 1 ? '' : 's'}</Text>
            </View>
            {!editing && <Icon name="chevron-forward" size={16} color={C.text3} />}
          </Card>
        ))}
        {!threads.length && <Text style={[T.sub, { textAlign: 'center', marginTop: 24 }]}>Chats you finish show up here.</Text>}
      </ScrollView>
    </View>
  )
}
