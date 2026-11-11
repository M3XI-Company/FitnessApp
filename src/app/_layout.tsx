import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StoreProvider } from '../lib/store'
import { C } from '../theme'

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="add-food" options={{ presentation: 'modal' }} />
          <Stack.Screen name="scanner" options={{ presentation: 'fullScreenModal', contentStyle: { backgroundColor: '#050B18' } }} />
          <Stack.Screen name="plans" options={{ presentation: 'modal' }} />
          <Stack.Screen name="exercise/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
          <Stack.Screen name="quick-add" options={{ presentation: 'transparentModal', animation: 'fade' }} />
          <Stack.Screen name="weight" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.5], sheetGrabberVisible: true }} />
        </Stack>
      </StoreProvider>
    </SafeAreaProvider>
  )
}
