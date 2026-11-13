import { createElement, useEffect, useMemo } from 'react'
import { View } from 'react-native'
import { runnerHtml, MODEL_URL, type RunnerMessage } from '../../lib/form/runner'

/** Web: the runner page in a sandboxed iframe using the self-hosted MediaPipe files in /mediapipe. */
export function PoseCamera({ facing, onMessage }: { facing: 'user' | 'environment'; onMessage: (m: RunnerMessage) => void }) {
  const html = useMemo(() => {
    const origin = window.location.origin
    return runnerHtml({ bundle: `${origin}/mediapipe/vision_bundle.mjs`, wasm: `${origin}/mediapipe/wasm`, model: `${origin}/mediapipe/pose_landmarker_lite.task`, fallbackModel: MODEL_URL }, facing)
  }, [facing])
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (typeof e.data !== 'string') return
      try { onMessage(JSON.parse(e.data)) } catch { /* not ours */ }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [onMessage])
  return (
    <View style={{ flex: 1 }}>
      {createElement('iframe', {
        key: facing, srcDoc: html, allow: 'camera', sandbox: 'allow-scripts allow-same-origin',
        title: 'Camera form check', style: { border: 0, width: '100%', height: '100%', background: '#0F2440' },
      })}
    </View>
  )
}
