import { useEffect, useState } from 'react'
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { COMPARE, PLUS, billingLine, isPlus, sharesData } from '../lib/plan'
import { MANAGE_URL, STORE, buy, hasPlus, offers, storeReady, type Offer } from '../lib/purchases'
import { useStore } from '../lib/store'
import { C, T } from '../theme'
import { SkyOrb } from '../components/SkyOrb'
import { Button, Card, Icon, SheetHeader, success, tap } from '../components/ui'

const WHY: Record<string, string> = {
  voice: 'Talking to Breeze out loud is part of Breeze Plus.',
}

/**
 * The plans. Breeze's own mark and name lead the page, so there is no doubt
 * what is being paid for, and the line under the button says who takes the
 * money, what it is called on a statement and how to stop it. The store's
 * own sheet does the charging; nothing is bought by tapping here alone.
 */
export default function Subscribe() {
  const { why } = useLocalSearchParams<{ why?: string }>()
  const { state, dispatch } = useStore()
  const plus = isPlus(state)
  const [period, setPeriod] = useState<Offer['period']>('yearly')
  const [onSale, setOnSale] = useState<{ monthly?: Offer; yearly?: Offer }>({})
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const ready = storeReady()

  useEffect(() => { let live = true; offers().then((o) => { if (live) setOnSale(o) }); return () => { live = false } }, [])

  const offer = onSale[period]
  const price = { monthly: onSale.monthly?.price ?? PLUS.monthly, yearly: onSale.yearly?.price ?? PLUS.yearly }
  const start = (via: 'store' | 'preview') => { dispatch({ type: 'subscription', subscription: { tier: 'plus', since: new Date().toISOString(), via } }); success() }

  const purchase = async () => {
    if (!offer) { setNote('Breeze Plus can’t be bought in this build yet. It goes on sale with the App Store and Google Play release.'); return }
    setBusy(true); setNote('')
    const res = await buy(offer)
    setBusy(false)
    if (res.ok) start('store')
    else if (res.reason !== 'cancelled') setNote('The purchase didn’t go through and you have not been charged. Try again in a moment.')
  }
  const restore = async () => {
    setBusy(true); setNote('')
    const has = await hasPlus(true)
    setBusy(false)
    if (has) start('store')
    else setNote(has === null ? 'Couldn’t reach the store to check. Try again in a moment.' : 'No Breeze Plus subscription was found on this store account.')
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title="" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 14, paddingBottom: 48 }}>
        <View style={{ alignItems: 'center', gap: 10 }}>
          <SkyOrb size={76} mood={plus ? 'proud' : 'calm'} />
          <View style={{ alignItems: 'center' }}>
            <Text style={[T.title2, { fontSize: 26 }]}>{PLUS.name}</Text>
            <Text style={T.caption}>by M3XI</Text>
          </View>
          <Text style={[T.body, { color: C.text2, textAlign: 'center', maxWidth: 320 }]}>{plus ? 'You’re on Breeze Plus. Everything is unlocked and your data stays private.' : WHY[why ?? ''] ?? 'Talk to your coach out loud, get pushed harder, and keep everything private.'}</Text>
        </View>

        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: C.fill }}>
            <Text style={[T.eyebrow, { flex: 1.1 }]}> </Text>
            <Text style={[T.eyebrow, { flex: 1 }]}>Free</Text>
            <Text style={[T.eyebrow, { flex: 1.3, color: C.accent }]}>Plus</Text>
          </View>
          {COMPARE.map((row) => (
            <View key={row.title} style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: 1, borderTopColor: C.sep }}>
              <Text style={[T.sub, { flex: 1.1, color: C.text, fontWeight: '700' }]}>{row.title}</Text>
              <Text style={[T.caption, { flex: 1, lineHeight: 17 }]}>{row.free}</Text>
              <Text style={[T.caption, { flex: 1.3, lineHeight: 17, color: C.text, fontWeight: '600' }]}>{row.plus}</Text>
            </View>
          ))}
        </Card>

        {plus ? (
          <Card style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="checkmark-circle" size={20} color={C.green} /><Text style={T.headline}>{state.subscription?.via === 'preview' ? 'Breeze Plus, switched on to try it' : 'Breeze Plus is active'}</Text></View>
            {state.subscription?.via === 'preview'
              ? <Button small variant="ghost" title="Go back to the free plan" onPress={() => dispatch({ type: 'subscription' })} />
              : (
                <>
                  <Text style={[T.caption, { lineHeight: 17 }]}>{billingLine(STORE)}</Text>
                  <Button small variant="tinted" icon="open-outline" title="Manage or cancel" onPress={() => { Linking.openURL(MANAGE_URL).catch(() => {}) }} />
                </>
              )}
          </Card>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {(['yearly', 'monthly'] as const).map((p) => {
                const on = p === period
                return (
                  <Pressable key={p} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => { tap(); setPeriod(p) }}
                    style={{ flex: 1, backgroundColor: '#fff', borderRadius: 20, padding: 14, gap: 4, borderWidth: 2, borderColor: on ? C.accent : 'transparent' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={T.eyebrow}>{p === 'yearly' ? 'Yearly' : 'Monthly'}</Text>
                      {p === 'yearly' && <View style={{ paddingHorizontal: 7, height: 18, borderRadius: 9, justifyContent: 'center', backgroundColor: C.accentSoft }}><Text style={{ color: C.accent, fontSize: 10.5, fontWeight: '800' }}>SAVE {PLUS.yearlySaving}</Text></View>}
                    </View>
                    <Text style={[T.title2, T.num]}>{price[p]}</Text>
                    <Text style={T.caption}>{p === 'yearly' ? 'a year' : 'a month'}</Text>
                  </Pressable>
                )
              })}
            </View>
            {busy
              ? <View style={{ height: 52, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.accent} /></View>
              : <Button variant="dark" title={offer?.trialDays ? `Try ${offer.trialDays} days free` : `Get ${PLUS.name}`} onPress={purchase} disabled={!ready} />}
            {!ready && <Text style={[T.caption, { textAlign: 'center', lineHeight: 17 }]}>Not on sale in this build yet. The prices shown are the planned ones.</Text>}
            {!!note && <Text style={[T.sub, { textAlign: 'center', color: C.text, lineHeight: 19 }]}>{note}</Text>}
            <Text style={[T.caption, { textAlign: 'center', lineHeight: 17 }]}>{billingLine(STORE)}</Text>
            {ready && <Button small variant="ghost" title="I already subscribed. Restore it" onPress={restore} />}
            {__DEV__ && <Button small variant="tinted" icon="sparkles-outline" title="Development: switch Plus on to try it" onPress={() => start('preview')} />}

            <Card style={{ gap: 8 }}>
              <Text style={T.headline}>Your data on the free plan</Text>
              <Text style={[T.sub, { lineHeight: 19 }]}>On the free plan you can let M3XI keep a copy of your training and food records, without your name or email, to improve Breeze and to share or sell to partners such as researchers and fitness companies. It is your choice, it is off until you say yes, and you can change it here or in Settings at any time. On Breeze Plus nothing is ever recorded.</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button small variant={sharesData(state) ? 'dark' : 'tinted'} icon={sharesData(state) ? 'checkmark' : undefined} title={sharesData(state) ? 'Sharing is on' : 'Yes, share my data'} style={{ flex: 1 }} onPress={() => dispatch({ type: 'dataChoice', share: true })} />
                <Button small variant={state.dataChoice && !state.dataChoice.share ? 'dark' : 'ghost'} icon={state.dataChoice && !state.dataChoice.share ? 'checkmark' : undefined} title={state.dataChoice && !state.dataChoice.share ? 'Not sharing' : 'No thanks'} style={{ flex: 1 }} onPress={() => dispatch({ type: 'dataChoice', share: false })} />
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  )
}
