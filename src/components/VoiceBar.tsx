import { Pressable, TextInput, View } from 'react-native'
import { C, shadow } from '../theme'
import { Icon, tap, type IconName } from './ui'

/**
 * The controls under a spoken conversation, kept to three: a box to type in
 * instead of speaking, the microphone, and a button to leave. The microphone
 * is shown only where the phone can listen.
 */
export function VoiceBar({ text, onChangeText, onSend, placeholder, editable = true, mic, onMic, onClose, closeIcon = 'close', closeLabel = 'End conversation' }: {
  text: string
  onChangeText: (t: string) => void
  onSend: () => void
  placeholder: string
  editable?: boolean
  /** 'listening' while the phone is listening, 'ready' when tapping would start listening, 'off' when it cannot listen */
  mic: 'listening' | 'ready' | 'busy' | 'off'
  onMic: () => void
  onClose: () => void
  closeIcon?: IconName
  closeLabel?: string
}) {
  const canSend = editable && !!text.trim()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', height: 56, paddingLeft: 18, paddingRight: 6, backgroundColor: '#fff', borderRadius: 28, ...shadow }}>
        <TextInput value={text} onChangeText={onChangeText} editable={editable} placeholder={placeholder} placeholderTextColor={C.text3} onSubmitEditing={onSend} returnKeyType="send" submitBehavior="submit"
          style={{ flex: 1, fontSize: 17, color: C.text, minHeight: 44 }} />
        {canSend && (
          <Pressable accessibilityLabel="Send" onPress={onSend} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.night, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="arrow-up" size={20} color={C.cloud} />
          </Pressable>
        )}
      </View>
      {mic !== 'off' && (
        <Pressable accessibilityLabel={mic === 'listening' ? 'Done speaking' : 'Speak'} disabled={mic === 'busy'} onPress={() => { tap(); onMic() }}
          style={({ pressed }) => [{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: mic === 'listening' ? C.accent : '#fff', opacity: mic === 'busy' ? 0.45 : 1, ...shadow }, pressed && { opacity: 0.7 }]}>
          <Icon name="mic" size={24} color={mic === 'listening' ? '#fff' : C.night} />
        </Pressable>
      )}
      <Pressable accessibilityLabel={closeLabel} onPress={() => { tap(); onClose() }}
        style={({ pressed }) => [{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: C.night }, pressed && { opacity: 0.7 }]}>
        <Icon name={closeIcon} size={24} color="#fff" />
      </Pressable>
    </View>
  )
}
