import { useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useStore } from '../lib/store'
import { naturalVoices, speak, stopSpeaking } from '../lib/voice'
import { PHONE_VOICE, VOICES, VOICE_SAMPLE, describeVoice, voiceOf } from '../lib/voices'
import { C, T } from '../theme'
import { Card, Icon, tap } from './ui'

/**
 * Choosing the voice Breeze speaks with. Each row plays a short sample when
 * its button is pressed and becomes the voice when the row is tapped. The
 * natural voices need the speech server; without one they are shown but only
 * the phone's own voice can be chosen.
 */
export function VoicePicker() {
  const { state, dispatch } = useStore()
  const natural = naturalVoices()
  const chosen = natural ? voiceOf(state.voice).id : PHONE_VOICE
  const [hearing, setHearing] = useState<string | null>(null)

  const hear = async (id: string) => {
    tap()
    if (hearing === id) { stopSpeaking(); setHearing(null); return }
    setHearing(id)
    await speak(VOICE_SAMPLE, id)
    setHearing((now) => (now === id ? null : now))
  }

  return (
    <View style={{ gap: 8 }}>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {VOICES.map((v, i) => {
          const usable = natural || v.id === PHONE_VOICE
          const on = v.id === chosen
          return (
            <Pressable key={v.id} disabled={!usable} accessibilityRole="radio" accessibilityState={{ selected: on, disabled: !usable }} accessibilityLabel={`${v.name}, ${describeVoice(v)}. ${v.note}`}
              onPress={() => { tap(); dispatch({ type: 'voice', id: v.id }) }}
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: C.sep, opacity: usable ? 1 : 0.45 }, pressed && { backgroundColor: C.fill }]}>
              <Icon name={on ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={on ? C.accent : C.text3} />
              <View style={{ flex: 1 }}>
                <Text style={T.headline}>{v.name}<Text style={[T.caption, { fontWeight: '500' }]}>{`  ${describeVoice(v)}`}</Text></Text>
                <Text style={T.caption}>{v.note}</Text>
              </View>
              {usable && (
                <Pressable hitSlop={8} accessibilityRole="button" accessibilityLabel={hearing === v.id ? `Stop ${v.name}` : `Hear ${v.name}`} onPress={() => hear(v.id)}
                  style={({ pressed }) => [{ width: 38, height: 38, borderRadius: 19, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.6 }]}>
                  {hearing === v.id ? <ActivityIndicator size="small" color={C.accent} /> : <Icon name="play" size={16} color={C.accent} />}
                </Pressable>
              )}
            </Pressable>
          )
        })}
      </Card>
      <Text style={[T.caption, { lineHeight: 17, paddingHorizontal: 4 }]}>{natural
        ? 'Tap a voice to use it, or the play button to hear it first. If the voice service can’t be reached, Breeze uses your phone’s voice until it can.'
        : 'The natural voices aren’t connected in this build yet, so Breeze is using your phone’s own voice.'}</Text>
    </View>
  )
}
