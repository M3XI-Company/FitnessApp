import { useState } from 'react'
import { ActivityIndicator, Platform, Text, View } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { ADULT_AGE, isAdult } from '../../lib/age'
import { BUILD_LABEL, MUSCLE_LABEL, bodyScanConfigured, scanBody, type BodyScanError } from '../../lib/bodyScan'
import { useStore } from '../../lib/store'
import { C, T } from '../../theme'
import { Button, Card, Icon, Pill, success, type IconName } from '../ui'

const ERRORS: Record<BodyScanError, string> = {
  not_configured: 'Body scanning isn’t available in this build. You can skip this step; your plan is still built from your answers.',
  monthly_limit: 'You’ve used this month’s body scans. You can scan again next month.',
  declined: 'That photo couldn’t be analysed. Try another one in gym clothes, or skip this step.',
  offline: 'Couldn’t reach Breeze. Check your connection and try again, or skip this step.',
  busy: 'The service is busy right now. Try again in a moment, or skip this step.',
  failed: 'Something went wrong with that photo. Try again, or skip this step.',
  unusable: 'That photo wasn’t clear enough. Stand back so you’re in frame from head to knees, in good light.',
}

const PROMISES: [IconName, string][] = [
  ['shield-checkmark-outline', 'Your photo is looked at once and then discarded. It is never stored or shared.'],
  ['eye-outline', 'The coach notes your build, muscle development and posture, like a trainer at a first session.'],
  ['ban-outline', 'No weight, body-fat or health guesses, and no judgement. Every starting point works.'],
]

/**
 * Optional step: one photo so the coach can see the user's starting point.
 * Adults only. Only a short description is kept, on this device.
 */
export function BodyScanStep({ age }: { age: number }) {
  const { state, dispatch } = useStore()
  const scan = state.bodyScan
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ kind: BodyScanError; reason?: string } | null>(null)

  const choose = async (source: 'camera' | 'library') => {
    setError(null)
    if (source === 'camera' && Platform.OS !== 'web') {
      const perm = await ImagePicker.requestCameraPermissionsAsync()
      if (!perm.granted) { setError({ kind: 'failed', reason: 'Breeze needs camera access to take the photo. You can allow it in Settings, or choose a photo instead.' }); return }
    }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: false }
    const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts)
    if (res.canceled || !res.assets?.[0]) return
    setBusy(true)
    try {
      // downscale to 1024 px on the long side and re-encode as JPEG; the file is not kept
      const asset = res.assets[0]
      const size = asset.height >= asset.width ? { height: 1024 } : { width: 1024 }
      const ref = await ImageManipulator.manipulate(asset.uri).resize(size).renderAsync()
      const out = await ref.saveAsync({ base64: true, compress: 0.72, format: SaveFormat.JPEG })
      const r = await scanBody(out.base64 ?? '')
      if (!r.ok) { setError({ kind: r.error, reason: r.reason }); return }
      dispatch({ type: 'bodyScan', scan: r.scan })
      success()
    } catch {
      setError({ kind: 'failed' })
    } finally {
      setBusy(false)
    }
  }

  if (!isAdult(age)) {
    return (
      <View style={{ gap: 14 }}>
        <Text style={T.title1}>Body scan</Text>
        <Card style={{ gap: 6 }}>
          <Text style={T.headline}>Available from age {ADULT_AGE}</Text>
          <Text style={[T.sub, { lineHeight: 20 }]}>Your plan is built from your answers and your chat with the coach. Tap Continue.</Text>
        </Card>
      </View>
    )
  }

  return (
    <View style={{ gap: 14 }}>
      <Text style={T.title1}>Show the coach your starting point</Text>
      <Text style={[T.sub, { marginTop: -6, lineHeight: 20 }]}>Optional. One photo in gym clothes, standing, from head to knees. It helps the coach choose where to put the emphasis.</Text>

      {scan ? (
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="checkmark-circle" size={22} color={C.green} />
            <Text style={[T.headline, { flex: 1 }]}>Scan complete</Text>
            {scan.confidence !== 'high' && <Pill color={C.text2} bg={C.fill}>{scan.confidence === 'medium' ? 'Fairly sure' : 'Rough read'}</Pill>}
          </View>
          <Text style={[T.body, { lineHeight: 22 }]}>{scan.summary}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <Pill>{BUILD_LABEL[scan.build]}</Pill>
            <Pill>{MUSCLE_LABEL[scan.muscle]}</Pill>
          </View>
          {scan.focusAreas.length > 0 && (
            <View style={{ gap: 4 }}>
              <Text style={T.eyebrow}>Training emphasis</Text>
              <Text style={T.body}>{scan.focusAreas.join(' · ')}</Text>
            </View>
          )}
          {scan.posture.length > 0 && (
            <View style={{ gap: 4 }}>
              <Text style={T.eyebrow}>Posture to work on</Text>
              {scan.posture.map((p) => <Text key={p} style={T.body}>• {p}</Text>)}
            </View>
          )}
          <Text style={T.caption}>A trainer&apos;s first look, not a measurement or medical assessment. Only this description is saved, on your phone.</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Retake" icon="camera-outline" variant="tinted" small onPress={() => choose('camera')} style={{ flex: 1 }} />
            <Button title="Delete" icon="trash-outline" variant="ghost" small onPress={() => dispatch({ type: 'bodyScan' })} style={{ flex: 1 }} />
          </View>
        </Card>
      ) : (
        <>
          <Card style={{ gap: 14 }}>
            {PROMISES.map(([icon, text]) => (
              <View key={text} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <Icon name={icon} size={22} color={C.accent} />
                <Text style={[T.sub, { flex: 1, lineHeight: 20, color: C.text }]}>{text}</Text>
              </View>
            ))}
          </Card>
          {busy ? (
            <Card style={{ alignItems: 'center', gap: 10, paddingVertical: 26 }}>
              <ActivityIndicator color={C.accent} />
              <Text style={T.headline}>Looking at your photo…</Text>
              <Text style={T.caption}>This takes about 15 seconds.</Text>
            </Card>
          ) : (
            <View style={{ gap: 10 }}>
              <Button title="Take a photo" icon="camera" onPress={() => choose('camera')} disabled={!bodyScanConfigured()} />
              <Button title="Choose a photo" icon="images-outline" variant="tinted" onPress={() => choose('library')} disabled={!bodyScanConfigured()} />
            </View>
          )}
          {!bodyScanConfigured() && <Text style={[T.caption, { textAlign: 'center' }]}>{ERRORS.not_configured}</Text>}
        </>
      )}

      {error && (
        <Card tight style={{ flexDirection: 'row', gap: 10, backgroundColor: '#FFF1E6' }}>
          <Icon name="alert-circle-outline" size={20} color={C.orange} />
          <Text style={[T.sub, { flex: 1, lineHeight: 19, color: C.text }]}>{error.reason || ERRORS[error.kind]}</Text>
        </Card>
      )}
      {!scan && !busy && <Text style={[T.caption, { textAlign: 'center' }]}>Prefer not to? Tap Skip. You can do this later from your profile.</Text>}
    </View>
  )
}
