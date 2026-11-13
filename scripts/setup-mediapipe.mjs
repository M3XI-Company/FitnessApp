#!/usr/bin/env node
/**
 * Self-host MediaPipe for the web build (no third-party CDN at runtime):
 *   public/mediapipe/vision_bundle.mjs     ← @mediapipe/tasks-vision (Apache-2.0)
 *   public/mediapipe/wasm/*                ← WebAssembly runtime
 *   public/mediapipe/pose_landmarker_lite.task ← Google pose model (Apache-2.0)
 * Runs on `npm install` (postinstall). Safe to re-run; skips files that exist.
 * iOS/Android load the same pinned version over HTTPS inside the camera WebView (see src/lib/form/runner.ts).
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = join(root, 'node_modules', '@mediapipe', 'tasks-vision')
const out = join(root, 'public', 'mediapipe')
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

if (!existsSync(pkg)) { console.log('[mediapipe] package not installed yet, skipping'); process.exit(0) }
mkdirSync(join(out, 'wasm'), { recursive: true })
copyFileSync(join(pkg, 'vision_bundle.mjs'), join(out, 'vision_bundle.mjs'))
for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']) copyFileSync(join(pkg, 'wasm', f), join(out, 'wasm', f))

const model = join(out, 'pose_landmarker_lite.task')
if (existsSync(model)) { console.log('[mediapipe] ready'); process.exit(0) }
try {
  const res = await fetch(MODEL_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  writeFileSync(model, Buffer.from(await res.arrayBuffer()))
  console.log('[mediapipe] ready (model downloaded)')
} catch (e) {
  console.warn(`[mediapipe] could not download the pose model (${e.message}). Camera form check on web will fall back to ${MODEL_URL}`)
}
