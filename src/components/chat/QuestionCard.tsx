import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { answersText, type CoachQuestion } from '../../lib/questions'
import { C, T } from '../../theme'
import { Button, Card, tap } from '../ui'

/**
 * Questions from the coach with answers to tap. Nothing is sent until every
 * one has an answer and the person presses the button; what they chose then
 * goes back as their message.
 */
export function QuestionCard({ questions, onSend, busy }: { questions: CoachQuestion[]; onSend: (text: string) => void; busy?: boolean }) {
  const [picked, setPicked] = useState<Record<number, string>>({})
  const ready = questions.every((_, i) => picked[i])
  return (
    <Card style={{ gap: 4, paddingVertical: 8 }}>
      {questions.map((q, i) => (
        <View key={q.question} style={{ gap: 8, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.sep }}>
          <Text style={[T.headline, { fontSize: 17 }]}>{i + 1}. {q.question}</Text>
          {q.options.map((o) => {
            const on = picked[i] === o
            return (
              <Pressable key={o} onPress={() => { tap(); setPicked((p) => ({ ...p, [i]: o })) }} accessibilityRole="radio" accessibilityState={{ selected: on }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 40 }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? C.night : C.text3, alignItems: 'center', justifyContent: 'center' }}>
                  {on && <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: C.night }} />}
                </View>
                <Text style={[T.body, { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: on ? '600' : '400' }]}>{o}</Text>
              </Pressable>
            )
          })}
        </View>
      ))}
      <Button title={ready ? 'Send my answers' : 'Choose an answer for each'} variant="dark" disabled={!ready || busy} onPress={() => onSend(answersText(questions, picked))} style={{ marginTop: 6, marginBottom: 8 }} />
    </Card>
  )
}
