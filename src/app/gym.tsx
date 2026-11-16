import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, ScrollView, Text, View } from 'react-native'
import { router } from 'expo-router'
import * as Location from 'expo-location'
import { gymDistance, gymLabel, gymSearchConfigured, gymWhere, searchGyms, type Gym } from '../lib/gyms'
import { useStore } from '../lib/store'
import { C, T } from '../theme'
import { Button, Card, Icon, SearchField, SheetHeader, success, tap } from '../components/ui'

type Here = { lat: number; lon: number }

/**
 * Find your gym. Type a name, a chain, a street or a town (typos are fine),
 * or ask for the gyms near you. Picking one saves it as your home gym.
 */
export default function FindGym() {
  const { state, dispatch } = useStore()
  const p = state.profile
  const [q, setQ] = useState('')
  const [here, setHere] = useState<Here | null>(null)
  const [gyms, setGyms] = useState<Gym[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const latest = useRef(0)

  // search a moment after the user stops typing; a newer search always wins
  useEffect(() => {
    const text = q.trim()
    if (text.length < 2 && !here) return
    const id = ++latest.current
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      setBusy(true); setNote('')
      const res = await searchGyms({ ...(text.length >= 2 ? { q: text } : {}), ...(here ?? {}) }, ctrl.signal)
      if (id !== latest.current) return
      setBusy(false)
      if (res.ok) setGyms(res.gyms)
      else setNote(res.error === 'offline' ? 'Can’t reach the search. Check your connection.' : 'Gym search isn’t available right now.')
    }, text.length >= 2 ? 350 : 0)
    return () => { clearTimeout(timer); ctrl.abort() }
  }, [q, here])

  const nearMe = async () => {
    tap(); setNote('')
    try {
      const perm = await Location.requestForegroundPermissionsAsync()
      if (!perm.granted) { setNote('Location is switched off for Breeze, so search by name or town instead.'); return }
      setBusy(true)
      // a recent rough position is plenty for "which gyms are around here"
      const pos = (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 })) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }))
      setHere({ lat: pos.coords.latitude, lon: pos.coords.longitude })
    } catch {
      setBusy(false)
      setNote('Couldn’t find where you are. Search by name or town instead.')
    }
  }

  const choose = (gym: string | undefined, place?: Gym) => {
    dispatch({ type: 'profile', profile: { ...p, gym, gymPlace: place ? { id: place.id, lat: place.lat, lon: place.lon } : undefined } })
    success()
    router.back()
  }
  const typed = q.trim()

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <SheetHeader title="Find your gym" onClose={() => router.back()} />
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        <SearchField value={q} onChangeText={setQ} placeholder="Gym, chain, street or town" autoFocus />
        <Button small variant="tinted" icon="walk-outline" title={here ? 'Showing gyms near you' : 'Gyms near me'} disabled={!gymSearchConfigured()} onPress={nearMe} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60, gap: 10 }} keyboardShouldPersistTaps="handled">
        {!!p.gym && !typed && !gyms && (
          <Card tight style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icon name="checkmark-circle" size={22} color={C.green} />
            <View style={{ flex: 1 }}><Text style={T.headline}>{p.gym}</Text><Text style={T.caption}>Your home gym</Text></View>
            <Button small variant="ghost" title="Remove" onPress={() => choose(undefined)} />
          </Card>
        )}
        {busy && <ActivityIndicator color={C.sky} style={{ marginTop: 12 }} />}
        {!!note && <Text style={[T.sub, { textAlign: 'center', marginTop: 8 }]}>{note}</Text>}
        {(gyms ?? []).map((g) => (
          <Card key={g.id} tight onPress={() => choose(gymLabel(g), g)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="barbell-outline" size={20} color={C.accent} /></View>
            <View style={{ flex: 1 }}>
              <Text style={T.headline} numberOfLines={1}>{g.name}</Text>
              <Text style={T.caption} numberOfLines={1}>{gymWhere(g) || 'Address not listed'}</Text>
            </View>
            {g.km !== null && <Text style={[T.sub, T.num, { fontWeight: '700' }]}>{gymDistance(g.km)}</Text>}
          </Card>
        ))}
        {gyms && !gyms.length && !busy && <Text style={[T.sub, { textAlign: 'center', marginTop: 8 }]}>{typed ? `No gyms found for “${typed}”. Try the town or the street.` : 'No gyms found near you.'}</Text>}
        {typed.length >= 2 && !busy && (
          <Button small variant="ghost" title={`Use “${typed}” as typed`} onPress={() => choose(typed)} style={{ marginTop: 4 }} />
        )}
        <Text style={[T.caption, { textAlign: 'center', lineHeight: 17, marginTop: 10 }]}>Gym data © OpenStreetMap contributors. Your location is only used when you tap Gyms near me, and is not saved.</Text>
      </ScrollView>
    </View>
  )
}
