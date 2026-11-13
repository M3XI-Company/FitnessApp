import { useMemo } from 'react'
import { WebView } from 'react-native-webview'
import { runnerHtml, CDN_BUNDLE, CDN_WASM, MODEL_URL, type RunnerMessage } from '../../lib/form/runner'

/**
 * iOS / Android: the runner page in a WebView. MediaPipe runs inside the WebView on the
 * device; the pinned runtime and model are fetched over HTTPS, frames never leave the phone.
 * The app must already hold camera permission (requested by the screen before mounting this).
 */
export function PoseCamera({ facing, onMessage }: { facing: 'user' | 'environment'; onMessage: (m: RunnerMessage) => void }) {
  const html = useMemo(() => runnerHtml({ bundle: CDN_BUNDLE, wasm: CDN_WASM, model: MODEL_URL }, facing), [facing])
  return (
    <WebView
      key={facing}
      source={{ html, baseUrl: 'https://localhost' }}
      originWhitelist={['https://*']}
      javaScriptEnabled
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      mediaCapturePermissionGrantType="grant"
      onMessage={(e) => { try { onMessage(JSON.parse(e.nativeEvent.data)) } catch { /* ignore */ } }}
      style={{ flex: 1, backgroundColor: '#141210' }}
      setSupportMultipleWindows={false}
      allowFileAccess={false}
      incognito
    />
  )
}
