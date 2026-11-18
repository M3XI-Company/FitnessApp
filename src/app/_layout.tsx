import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StoreProvider } from '../lib/store'
import { C } from '../theme'
import { DeviceFrame } from '../components/DeviceFrame'

export default function RootLayout() {
  return (
    <DeviceFrame>
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.bg } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="diary" options={{ presentation: 'modal' }} />
          <Stack.Screen name="welcome" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
          <Stack.Screen name="add-food" options={{ presentation: 'modal' }} />
          <Stack.Screen name="edit-food" options={{ presentation: 'modal' }} />
          <Stack.Screen name="targets" options={{ presentation: 'modal' }} />
          <Stack.Screen name="meal-builder" options={{ presentation: 'modal' }} />
          <Stack.Screen name="food-photo" options={{ presentation: 'modal' }} />
          <Stack.Screen name="licences" options={{ presentation: 'modal' }} />
          <Stack.Screen name="form-check/[id]" options={{ presentation: 'fullScreenModal', contentStyle: { backgroundColor: '#0F2440' } }} />
          <Stack.Screen name="scanner" options={{ presentation: 'fullScreenModal', contentStyle: { backgroundColor: '#0F2440' } }} />
          <Stack.Screen name="plans" options={{ presentation: 'modal' }} />
          <Stack.Screen name="exercise/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
          <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
          <Stack.Screen name="history" options={{ presentation: 'modal' }} />
          <Stack.Screen name="memory" options={{ presentation: 'modal' }} />
          <Stack.Screen name="gym" options={{ presentation: 'modal' }} />
          <Stack.Screen name="meal/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="quick-add" options={{ presentation: 'transparentModal', animation: 'fade' }} />
          <Stack.Screen name="weight" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.5], sheetGrabberVisible: true }} />
        </Stack>
      </StoreProvider>
    </SafeAreaProvider>
    </DeviceFrame>
  )
}
