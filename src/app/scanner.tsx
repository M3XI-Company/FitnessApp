import { useRef, useState } from 'react'
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useStore } from '../lib/store'
import { SAMPLE_CODES, analyze, lookupBarcode, type Product } from '../lib/products'
import { SOURCES } from '../lib/sources'
import { MEALS, defaultMeal } from '../lib/meals'
import { todayKey, uid } from '../lib/date'
import { fmt, kcalToKj, makeEntry, nutritionFor } from '../lib/nutrition'
import { dayMacros } from '../lib/progress'
import type { MealSlot } from '../lib/types'
import { C, GRADE_COLOR, T, F } from '../theme'
import { Bar, Button, Grade, Icon, IconButton, Stepper, success, tap } from '../components/ui'

type Mode = 'barcode' | 'product'
const LIGHT = { low: C.green, medium: C.orange, high: C.red }

export default function Scanner() {
  const params = useLocalSearchParams<{ mode?: Mode; meal?: MealSlot }>()
  const insets = useSafeAreaInsets()
  const { state, dispatch } = useStore()
  const [mode, setMode] = useState<Mode>(params.mode ?? 'barcode')
  const [permission, requestPermission] = useCameraPermissions()
  const [loading, setLoading] = useState(false)
  const [product, setProduct] = useState<Product | null>(null)
  const [notFound, setNotFound] = useState<{ code: string; reason: 'not_found' | 'offline' } | null>(null)
  const [manual, setManual] = useState('')
  const [qty, setQty] = useState(1)
  const [torch, setTorch] = useState(false)
  const lock = useRef(false)
  const meal = params.meal ?? defaultMeal()

  const lookup = async (code: string) => {
    if (lock.current) return
    lock.current = true
    tap()
    setLoading(true); setNotFound(null)
    const res = await lookupBarcode(code)
    setLoading(false)
    if (res.ok) { success(); setProduct(res.product); setQty(1) } else { setNotFound({ code, reason: res.reason }); lock.current = false }
  }
  const onScan = (r: BarcodeScanningResult) => { if (!product) lookup(r.data) }
  const reset = () => { setProduct(null); setNotFound(null); lock.current = false }

  const add = () => {
    if (!product) return
    dispatch({ type: 'addFood', entry: makeEntry(product, { servings: qty }, { id: uid(), date: todayKey(), meal, source: mode === 'barcode' ? 'barcode' : 'scan', dataSource: 'off' }) })
    success()
    router.dismissAll()
    router.navigate('/food')
  }

  const cameraReady = permission?.granted && Platform.OS !== 'web'

  return (
    <View style={{ flex: 1, backgroundColor: '#141210' }}>
      {cameraReady && !product && (
        <CameraView style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} onBarcodeScanned={loading ? undefined : onScan}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] }} />
      )}

      {/* Top bar */}
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 2 }}>
        <IconButton icon="close" onPress={() => router.back()} label="Close" />
        <View style={st.modeSwitch}>
          {(['barcode', 'product'] as const).map((m) => (
            <Pressable key={m} onPress={() => { tap(); setMode(m) }} style={[st.modeBtn, mode === m && { backgroundColor: '#fff' }]}>
              <Text style={{ fontWeight: '700', fontSize: 13, color: mode === m ? C.text : '#fff' }}>{m === 'barcode' ? 'Barcode' : 'Product'}</Text>
            </Pressable>
          ))}
        </View>
        <IconButton icon={torch ? 'flash' : 'flash-outline'} onPress={() => setTorch(!torch)} label="Torch" />
      </View>

      {!product && (
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 20 }} keyboardShouldPersistTaps="handled">
          {/* Viewfinder */}
          <View style={st.frameWrap}>
            <View style={st.frame}>
              {(['tl', 'tr', 'bl', 'br'] as const).map((c) => <View key={c} style={[st.corner, st[c]]} />)}
              {loading ? <ActivityIndicator color="#fff" size="large" /> : <Icon name={mode === 'barcode' ? 'barcode-outline' : 'scan-outline'} size={64} color="rgba(255,255,255,.35)" />}
            </View>
            <Text style={st.hint}>{loading ? 'Looking up product…' : mode === 'barcode' ? 'Point at a barcode to log it instantly' : 'Scan a product to get its health grade'}</Text>
            {!permission?.granted && Platform.OS !== 'web' && (
              <Button title="Enable camera" icon="camera" onPress={requestPermission} style={{ marginTop: 16, alignSelf: 'center' }} />
            )}
          </View>

          {notFound && (
            <View style={st.notice}><Icon name="alert-circle" color={C.orange} /><Text style={{ color: '#fff', flex: 1 }}>{notFound.reason === 'offline' ? "Couldn't reach the product database. Check your connection and try again." : `${notFound.code} isn't in Open Food Facts yet. Search the food instead, or add it manually.`}</Text></View>
          )}

          {/* Manual + demo */}
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            <View style={st.manual}>
              <TextInput value={manual} onChangeText={setManual} placeholder="Type barcode number" placeholderTextColor="rgba(255,255,255,.45)" keyboardType="number-pad"
                style={{ flex: 1, color: '#fff', fontSize: 16 }} onSubmitEditing={() => manual && lookup(manual)} />
              <Pressable onPress={() => manual && lookup(manual)} style={st.go}><Icon name="arrow-forward" color="#fff" size={18} /></Pressable>
            </View>
            <Text style={{ color: 'rgba(255,255,255,.5)', fontSize: 12, fontWeight: '700', letterSpacing: 0.8 }}>TRY A SAMPLE</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SAMPLE_CODES.map((d) => (
                <Pressable key={d.code} onPress={() => lookup(d.code)} style={st.sample}><Text style={{ color: '#fff', fontWeight: '600' }}>{d.emoji} {d.name}</Text></Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
      )}

      {product && <ProductResult product={product} mode={mode} qty={qty} setQty={setQty} onAdd={add} onRescan={reset} meal={meal} kcalLeft={state.targets.kcal - dayMacros(state, todayKey()).kcal} bottom={insets.bottom} />}
    </View>
  )
}

function ProductResult({ product, mode, qty, setQty, onAdd, onRescan, meal, kcalLeft, bottom }: {
  product: Product; mode: Mode; qty: number; setQty: (n: number) => void; onAdd: () => void; onRescan: () => void; meal: MealSlot; kcalLeft: number; bottom: number
}) {
  const a = analyze(product)
  const n = nutritionFor(product, { servings: qty })
  const kcal = n.kcal
  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: 16 }} contentContainerStyle={{ padding: 18, paddingBottom: bottom + 24, gap: 14 }}>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
        {product.image ? <Image source={{ uri: product.image }} style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: '#fff' }} /> : <View style={{ width: 64, height: 64, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 34 }}>{product.emoji}</Text></View>}
        <View style={{ flex: 1 }}>
          <Text style={T.title3} numberOfLines={2}>{product.name}</Text>
          <Text style={T.sub}>{product.brand ?? 'Unknown brand'} · {product.barcode}</Text>
        </View>
      </View>
      {!product.ukListed && (
        <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: 14, backgroundColor: '#F8EBD8' }}>
          <Icon name="information-circle" color={C.orange} />
          <Text style={[T.sub, { flex: 1, color: C.text }]}>Not listed as sold in the UK. UK recipes can differ — check the pack label matches.</Text>
        </View>
      )}

      {/* Grade card (Product scanner) */}
      {mode === 'product' && (
        <View style={{ backgroundColor: '#fff', borderRadius: 22, padding: 18, gap: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 6, borderColor: GRADE_COLOR[a.grade], alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 32, fontFamily: F.hand, color: C.text, lineHeight: 34 }}>{a.score}</Text>
              <Text style={{ fontSize: 10, fontWeight: '700', color: C.text3, marginTop: -2 }}>/100</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={T.title3}>{a.verdict}</Text>
              <Text style={T.caption}>{product.gradeSource === 'nutriscore' ? 'Grade: Nutri-Score via Open Food Facts · score: Breeze' : 'Grade and score calculated by Breeze'}</Text>
              <View style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>
                {(['A', 'B', 'C', 'D', 'E'] as const).map((g) => <View key={g} style={{ opacity: g === a.grade ? 1 : 0.25 }}><Grade g={g} size={g === a.grade ? 30 : 24} /></View>)}
              </View>
            </View>
          </View>
          <View style={{ gap: 10 }}>
            {a.lights.map((l) => (
              <View key={l.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: LIGHT[l.level] }} />
                <Text style={[T.body, { flex: 1 }]}>{l.label}</Text>
                <Text style={[T.sub, T.num]}>{l.value}</Text>
                <Text style={[T.caption, { width: 56, textAlign: 'right', color: LIGHT[l.level], fontWeight: '700' }]}>{l.level.toUpperCase()}</Text>
              </View>
            ))}
          </View>
          {a.pros.length > 0 && <View style={{ gap: 4 }}>{a.pros.slice(0, 3).map((p) => <Text key={p} style={T.body}><Text style={{ color: C.green }}>✓ </Text>{p}</Text>)}</View>}
          {a.cons.length > 0 && <View style={{ gap: 4 }}>{a.cons.slice(0, 4).map((p) => <Text key={p} style={T.body}><Text style={{ color: C.red }}>✕ </Text>{p}</Text>)}</View>}
          {product.allergens.length > 0 && <Text style={T.sub}>Allergens: {product.allergens.join(', ')}</Text>}
        </View>
      )}

      {/* Nutrition */}
      <View style={{ backgroundColor: '#fff', borderRadius: 22, padding: 18, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View><Text style={T.headline}>Servings</Text><Text style={T.sub}>{product.serving} each</Text></View>
          <Stepper value={qty} step={0.5} min={0.5} onChange={setQty} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {([['Calories', fmt.kcal(n.kcal), '', C.text], ['Protein', fmt.g(n.protein), 'g', C.protein], ['Carbs', fmt.g(n.carbs), 'g', C.carbs], ['Fat', fmt.g(n.fat), 'g', C.fat]] as const).map(([l, v, u, c]) => (
            <View key={l} style={{ alignItems: 'center' }}><Text style={[T.title2, T.num, { color: c }]}>{v}{u}</Text><Text style={T.caption}>{l}</Text></View>
          ))}
        </View>
        <View style={{ gap: 6 }}>
          <Text style={T.caption}>{Math.round(kcalToKj(n.kcal))} kJ · values per serving from the pack data · traffic lights per 100 g (FSA thresholds)</Text>
          <Text style={T.sub}>{kcal <= kcalLeft ? `Fits your day — ${Math.round(kcalLeft - kcal)} kcal left after this` : `${Math.round(kcal - kcalLeft)} kcal over your remaining budget`}</Text>
          <Bar pct={kcalLeft > 0 ? kcal / kcalLeft : 1} color={kcal <= kcalLeft ? C.accent : C.orange} />
        </View>
      </View>

      <Text style={[T.caption, { lineHeight: 16 }]}>{SOURCES.off.attribution}</Text>
      <Button title={`Add to ${MEALS.find((m) => m.slot === meal)!.label}`} icon="add" onPress={onAdd} />
      <Button title="Scan another" variant="ghost" icon="scan" onPress={onRescan} />
    </ScrollView>
  )
}

const st = StyleSheet.create({
  modeSwitch: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,.16)', borderRadius: 99, padding: 3 },
  modeBtn: { paddingHorizontal: 16, height: 32, borderRadius: 99, justifyContent: 'center' },
  frameWrap: { alignItems: 'center', paddingTop: 40, paddingBottom: 28 },
  frame: { width: 270, height: 190, alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', width: 44, height: 44, borderColor: '#fff' },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 22 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 22 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 22 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 22 },
  hint: { color: '#fff', fontWeight: '600', fontSize: 15, marginTop: 22, textAlign: 'center' },
  notice: { flexDirection: 'row', gap: 10, alignItems: 'center', marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 16, backgroundColor: 'rgba(255,255,255,.1)' },
  manual: { flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: 16, backgroundColor: 'rgba(255,255,255,.12)', paddingLeft: 16, paddingRight: 6 },
  go: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  sample: { paddingHorizontal: 14, height: 38, borderRadius: 99, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.12)' },
})
