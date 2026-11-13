import { useState } from 'react'
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { useStore } from '../lib/store'
import { analysePhoto, photoScanConfigured, type PhotoError, type PhotoResult } from '../lib/foodPhoto'
import { matchCofid } from '../lib/foodDb'
import { defaultMeal, mealLabel, useMeals } from '../lib/meals'
import { SOURCES } from '../lib/sources'
import { todayKey, uid } from '../lib/date'
import { fmt, makeEntry, nutritionFor } from '../lib/nutrition'
import type { FoodItem, MealSlot } from '../lib/types'
import { C, T } from '../theme'
import { Button, Card, Icon, Pill, SheetHeader, Stepper, success, tap } from '../components/ui'

interface Row { key: string; label: string; grams: number; confidence: 'high' | 'medium' | 'low'; note: string; options: FoodItem[]; pick: number; include: boolean; open: boolean }

const ERRORS: Record<PhotoError, string> = {
  not_configured: 'Photo scanning needs the Breeze server, which isn’t connected in this build yet. Use search or the barcode scanner for now.',
  monthly_limit: 'You’ve used this month’s photo scans. Search and barcode scanning are unlimited.',
  declined: 'This photo couldn’t be analysed. Try another photo, or search for the food.',
  offline: 'Couldn’t reach Breeze. Check your connection and try again.',
  busy: 'The service is busy right now — try again in a moment.',
  failed: 'Something went wrong analysing the photo. Try again, or search for the food.',
}
const CONF = { high: { label: 'Confident', color: C.green, bg: '#E9F0E6' }, medium: { label: 'Check amount', color: C.accent, bg: C.accentSoft }, low: { label: 'Rough guess', color: C.orange, bg: '#FFEBDD' } }

export default function FoodPhoto() {
  const params = useLocalSearchParams<{ meal?: MealSlot }>()
  const { dispatch } = useStore()
  const meals = useMeals()
  const [meal, setMeal] = useState<MealSlot>(params.meal ?? defaultMeal())
  const [photo, setPhoto] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<PhotoError | null>(null)
  const [result, setResult] = useState<PhotoResult | null>(null)
  const [rows, setRows] = useState<Row[]>([])

  const choose = async (source: 'camera' | 'library') => {
    setError(null); setResult(null)
    if (source === 'camera' && Platform.OS !== 'web') {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      if (!perm.granted) { setError('failed'); return }
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: false }
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts)
    if (res.canceled || !res.assets?.[0]) return
    setBusy(true)
    try {
      // downscale to 1024 px (enough detail, ~4× fewer image tokens) and re-encode as JPEG
      const ref = await ImageManipulator.manipulate(res.assets[0].uri).resize({ width: 1024 }).renderAsync()
      const out = await ref.saveAsync({ base64: true, compress: 0.72, format: SaveFormat.JPEG })
      setPhoto(out.uri)
      const r = await analysePhoto(out.base64 ?? '')
      if (!r.ok) { setError(r.error); return }
      setResult(r.result)
      setRows(r.result.items.map((it, i) => ({
        key: `${i}-${it.name}`, label: it.name, grams: it.grams, confidence: it.confidence, note: it.note,
        options: matchCofid(it.cofid_query), pick: 0, include: true, open: false,
      })))
      success()
    } catch {
      setError('failed')
    } finally {
      setBusy(false)
    }
  }

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const valueOf = (r: Row) => {
    const f = r.options[r.pick]
    if (!f) return null
    return { ...nutritionFor(f, { grams: r.grams }), food: f }
  }
  const chosen = rows.filter((r) => r.include && r.options[r.pick])
  const total = chosen.reduce((a, r) => a + (valueOf(r)?.kcal ?? 0), 0)

  const log = () => {
    for (const r of chosen) {
      dispatch({ type: 'addFood', entry: makeEntry(r.options[r.pick], { grams: r.grams }, { id: uid(), date: todayKey(), meal, source: 'photo', dataSource: 'ai', isEstimate: true }) })
    }
    success()
    router.dismissAll()
    router.navigate('/food')
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title="Snap your meal" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        {!result && !busy && (
          <>
            <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 26 }}>
              <Icon name="camera-outline" size={44} color={C.accent} />
              <Text style={[T.title3, { textAlign: 'center' }]}>Take a photo from above</Text>
              <Text style={[T.sub, { textAlign: 'center', lineHeight: 19 }]}>Good light, the whole plate in frame, and a fork or hand nearby for scale helps the estimate.</Text>
            </Card>
            <Button title="Take photo" icon="camera" onPress={() => choose('camera')} disabled={!photoScanConfigured()} />
            <Button title="Choose from photos" variant="tinted" icon="images-outline" onPress={() => choose('library')} disabled={!photoScanConfigured()} />
            {!photoScanConfigured() && <Card tight style={{ backgroundColor: C.accentSoft }}><Text style={[T.sub, { color: C.text, lineHeight: 19 }]}>{ERRORS.not_configured}</Text></Card>}
            <Text style={[T.caption, { lineHeight: 16 }]}>Your photo is sent securely to Breeze to identify the food, then discarded — it isn’t stored. Calories come from the UK CoFID database, not the AI. Amounts are estimates: check them before saving.</Text>
          </>
        )}

        {photo && <Image source={{ uri: photo }} style={{ width: '100%', height: 220, borderRadius: 22, backgroundColor: C.fill }} resizeMode="cover" />}
        {busy && <Card style={{ alignItems: 'center', gap: 10 }}><ActivityIndicator color={C.sky} /><Text style={T.headline}>Identifying your food…</Text><Text style={T.caption}>This usually takes a few seconds.</Text></Card>}
        {error && (
          <Card style={{ gap: 10 }}>
            <Text style={[T.body, { lineHeight: 21 }]}>{ERRORS[error]}</Text>
            <Button title="Search instead" variant="ghost" icon="search" onPress={() => { router.back(); router.push({ pathname: '/add-food', params: { meal } }) }} />
          </Card>
        )}

        {result && !result.is_food && <Card><Text style={T.body}>I couldn’t see any food in this photo. Try again with the plate in the middle of the frame.</Text></Card>}
        {result && result.advice ? <Card tight style={{ flexDirection: 'row', gap: 10, backgroundColor: C.accentSoft }}><Icon name="bulb-outline" color={C.accent} /><Text style={[T.sub, { flex: 1, color: C.text }]}>{result.advice}</Text></Card> : null}

        {rows.length > 0 && (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {meals.map((m) => (
                <Pressable key={m.slot} onPress={() => { tap(); setMeal(m.slot) }} style={{ paddingHorizontal: 14, height: 34, borderRadius: 99, justifyContent: 'center', backgroundColor: meal === m.slot ? C.night : C.card }}>
                  <Text style={{ fontWeight: '600', color: meal === m.slot ? C.skyLight : C.text2 }}>{m.emoji} {m.label}</Text>
                </Pressable>
              ))}
            </View>
            {rows.map((r) => {
              const v = valueOf(r)
              return (
                <Card key={r.key} style={{ gap: 10, opacity: r.include ? 1 : 0.5 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Pressable onPress={() => { tap(); update(r.key, { include: !r.include }) }} accessibilityRole="checkbox" accessibilityState={{ checked: r.include }}>
                      <Icon name={r.include ? 'checkbox' : 'square-outline'} size={24} color={r.include ? C.night : C.text3} />
                    </Pressable>
                    <View style={{ flex: 1 }}>
                      <Text style={T.headline}>{r.label}</Text>
                      <Text style={T.caption} numberOfLines={1}>{v ? `Matched: ${v.food.name}` : 'No match in the UK database — search for it instead'}</Text>
                    </View>
                    <Pill color={CONF[r.confidence].color} bg={CONF[r.confidence].bg}>{CONF[r.confidence].label}</Pill>
                  </View>
                  {r.note ? <Text style={[T.sub, { lineHeight: 18 }]}>{r.note}</Text> : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={[T.title3]}>{v ? `${fmt.kcal(v.kcal)} kcal` : '—'}</Text>
                    <Stepper value={r.grams} step={10} min={5} suffix="g" onChange={(g) => update(r.key, { grams: g })} />
                  </View>
                  {r.options.length > 1 && (
                    <Pressable onPress={() => update(r.key, { open: !r.open })}><Text style={{ color: C.accent, fontWeight: '600' }}>{r.open ? 'Hide alternatives' : 'Not right? Choose another match'}</Text></Pressable>
                  )}
                  {r.open && r.options.map((o, i) => (
                    <Pressable key={o.id} onPress={() => { tap(); update(r.key, { pick: i, open: false }) }} style={{ flexDirection: 'row', gap: 10, padding: 10, borderRadius: 12, backgroundColor: i === r.pick ? C.accentSoft : C.fill }}>
                      <Text>{o.emoji}</Text><Text style={[T.body, { flex: 1 }]} numberOfLines={2}>{o.name}</Text><Text style={T.sub}>{o.kcal} kcal/100 g</Text>
                    </Pressable>
                  ))}
                </Card>
              )
            })}
            <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={T.headline}>Estimated total</Text><Text style={T.title2}>{fmt.kcal(total)} kcal</Text>
            </Card>
            <Button title={`Log ${chosen.length} item${chosen.length === 1 ? '' : 's'} to ${mealLabel(meal, meals)}`} disabled={!chosen.length} onPress={log} />
            <Button title="Retake" variant="ghost" icon="camera-reverse-outline" onPress={() => { setResult(null); setRows([]); setPhoto(null) }} />
            <Text style={[T.caption, { lineHeight: 16 }]}>{SOURCES.ai.attribution} {SOURCES.cofid.attribution} {result ? `${result.remaining} photo scans left this month.` : ''}</Text>
          </>
        )}
      </ScrollView>
    </View>
  )
}
