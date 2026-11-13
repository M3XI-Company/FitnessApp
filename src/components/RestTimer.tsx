import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { C, F, T } from '../theme'
import { Bar, Button, Card, success } from './ui'

/** Rest countdown based on an end timestamp, so it stays correct if the app is backgrounded. */
export function RestTimer({ endsAt, total, onChange, onDone }: { endsAt: number; total: number; onChange: (endsAt: number, total: number) => void; onDone: () => void }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000))
  useEffect(() => {
    if (left === 0) { success(); const t = setTimeout(onDone, 1200); return () => clearTimeout(t) }
  }, [left]) // eslint-disable-line react-hooks/exhaustive-deps
  const mm = Math.floor(left / 60), ss = String(left % 60).padStart(2, '0')
  return (
    <Card style={{ gap: 10, backgroundColor: C.night }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={[T.eyebrow, { color: C.skyLight }]}>Rest</Text>
          <Text style={{ fontFamily: F.hand, fontSize: 52, color: C.cloud, lineHeight: 56 }}>{left === 0 ? 'Go!' : `${mm}:${ss}`}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button small variant="tinted" title="−15s" onPress={() => onChange(endsAt - 15000, Math.max(15, total - 15))} />
          <Button small variant="tinted" title="+15s" onPress={() => onChange(endsAt + 15000, total + 15)} />
          <Button small variant="tinted" title="Skip" onPress={onDone} />
        </View>
      </View>
      <Bar pct={1 - left / total} color={C.sky} track="rgba(255,255,255,.14)" />
    </Card>
  )
}
