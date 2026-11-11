import type { ReactNode } from 'react'
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native'

/**
 * Web-only: on wide screens, render the app inside an iPhone-sized frame so the
 * browser preview looks and behaves like a phone. Native builds are unaffected.
 */
export function DeviceFrame({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions()
  if (Platform.OS !== 'web' || width < 600) return <>{children}</>
  const scale = Math.min(1, (height - 48) / 884)
  const now = new Date()
  return (
    <View style={st.stage}>
      <View style={[st.phone, { transform: [{ scale }] }]}>
        <View style={st.screen}>
          <View style={st.statusBar}>
            <Text style={st.time}>{now.getHours()}:{String(now.getMinutes()).padStart(2, '0')}</Text>
            <View style={st.island} />
            <Text style={[st.time, { textAlign: 'right' }]}>100%</Text>
          </View>
          <View style={{ flex: 1 }}>{children}</View>
          <View style={st.home} />
        </View>
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DCE6F5' },
  phone: { width: 413, height: 884, borderRadius: 64, padding: 12, backgroundColor: '#0B1220', boxShadow: '0 40px 90px rgba(10,40,100,.35)' },
  screen: { flex: 1, borderRadius: 52, overflow: 'hidden', backgroundColor: '#F2F5FA' },
  statusBar: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 30, paddingTop: 6 },
  time: { fontSize: 15, fontWeight: '600', color: '#0B1220', width: 70 },
  island: { width: 122, height: 34, borderRadius: 20, backgroundColor: '#000' },
  home: { position: 'absolute', bottom: 8, alignSelf: 'center', width: 134, height: 5, borderRadius: 3, backgroundColor: '#0B1220', opacity: 0.85 },
})
