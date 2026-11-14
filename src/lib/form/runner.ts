/**
 * Builds the self-contained pose-runner page used by the camera form check.
 * It opens the camera, runs MediaPipe Pose Landmarker *inside the page*, draws a
 * skeleton over the preview, and posts ONLY landmark coordinates to the app.
 * Video frames are never recorded, stored or sent anywhere.
 */
export const MEDIAPIPE_VERSION = '1.2.3'
export const CDN_BUNDLE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/vision_bundle.mjs`
export const CDN_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`
export const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

export interface RunnerAssets { bundle: string; wasm: string; model: string; fallbackModel?: string }

/** Skeleton connections drawn on the preview (MediaPipe indices) */
const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]]

export function runnerHtml(a: RunnerAssets, facing: 'user' | 'environment') {
  const mirror = facing === 'user'
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>html,body{margin:0;height:100%;background:#141210;overflow:hidden}video,canvas{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}${mirror ? 'video,canvas{transform:scaleX(-1)}' : ''}</style></head>
<body><video id="v" playsinline muted autoplay></video><canvas id="c"></canvas>
<script type="module">
const send = (m) => { const s = JSON.stringify(m); if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s); else window.parent.postMessage(s, '*') };
const BONES = ${JSON.stringify(BONES)};
let stream = null;
const stop = () => { if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null };
window.addEventListener('message', (e) => { if (e.data === 'stop') stop() });
document.addEventListener('message', (e) => { if (e.data === 'stop') stop() });
window.addEventListener('pagehide', stop);
try {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('camera_unavailable');
  stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: '${facing}', width: { ideal: 640 }, height: { ideal: 480 } } });
  const v = document.getElementById('v'); v.srcObject = stream; await v.play();
  send({ type: 'camera' });
  const { FilesetResolver, PoseLandmarker } = await import('${a.bundle}');
  const files = await FilesetResolver.forVisionTasks('${a.wasm}');
  const make = (model, delegate) => PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: model, delegate }, runningMode: 'VIDEO', numPoses: 1, minPoseDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
  let pose = null;
  for (const [m, d] of [['${a.model}', 'GPU'], ['${a.model}', 'CPU'], ${a.fallbackModel ? `['${a.fallbackModel}', 'CPU']` : ''}]) { try { pose = await make(m, d); break } catch (e) {} }
  if (!pose) throw new Error('model_failed');
  send({ type: 'ready' });
  const c = document.getElementById('c'); const ctx = c.getContext('2d');
  let lastTime = -1, lastSent = 0;
  const loop = () => {
    if (!stream) return;
    if (v.readyState >= 2 && v.currentTime !== lastTime) {
      lastTime = v.currentTime;
      const t = performance.now();
      const r = pose.detectForVideo(v, t);
      const pts = r.landmarks && r.landmarks[0] ? r.landmarks[0] : null;
      c.width = v.videoWidth; c.height = v.videoHeight; ctx.clearRect(0, 0, c.width, c.height);
      if (pts) {
        ctx.lineWidth = Math.max(3, c.width / 160); ctx.lineCap = 'round';
        for (const [i, j] of BONES) { const p = pts[i], q = pts[j]; if ((p.visibility ?? 1) < 0.5 || (q.visibility ?? 1) < 0.5) continue; ctx.strokeStyle = 'rgba(227,203,151,0.95)'; ctx.beginPath(); ctx.moveTo(p.x * c.width, p.y * c.height); ctx.lineTo(q.x * c.width, q.y * c.height); ctx.stroke() }
        ctx.fillStyle = '#EEF6FC'; for (const k of [11,12,13,14,15,16,23,24,25,26,27,28]) { const p = pts[k]; if ((p.visibility ?? 1) < 0.5) continue; ctx.beginPath(); ctx.arc(p.x * c.width, p.y * c.height, Math.max(4, c.width / 110), 0, 7); ctx.fill() }
      }
      if (t - lastSent > 33) { lastSent = t; send({ type: 'pose', t, lm: pts ? pts.map((p) => [Math.round(p.x * 1e4) / 1e4, Math.round(p.y * 1e4) / 1e4, Math.round((p.visibility ?? 0) * 1e3) / 1e3]) : null }) }
    }
    requestAnimationFrame(loop);
  };
  loop();
} catch (e) {
  const msg = String((e && (e.name === 'NotAllowedError' ? 'permission_denied' : e.message)) || e);
  send({ type: 'error', message: msg });
}
</script></body></html>`
}

export type RunnerMessage =
  | { type: 'camera' } | { type: 'ready' } | { type: 'error'; message: string }
  | { type: 'pose'; t: number; lm: [number, number, number][] | null }
