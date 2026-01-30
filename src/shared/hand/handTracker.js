import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

const DEFAULT_WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

const DEFAULT_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";

export async function createHandTracker({
  videoEl,
  numHands = 1,
  wasmRoot = DEFAULT_WASM_ROOT,
  modelUrl = DEFAULT_MODEL_URL,
  minHandDetectionConfidence = 0.5,
  minHandPresenceConfidence = 0.5,
  minTrackingConfidence = 0.5,
}){
  const vision = await FilesetResolver.forVisionTasks(wasmRoot);
  const landmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: modelUrl },
    runningMode: "VIDEO",
    numHands,
    minHandDetectionConfidence,
    minHandPresenceConfidence,
    minTrackingConfidence,
  });

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
  videoEl.srcObject = stream;
  await videoEl.play();

  let lastTs = -1;

  function detect(nowMs){
    if(videoEl.readyState < 2) return null;
    if(nowMs === lastTs) return null;
    lastTs = nowMs;
    return landmarker.detectForVideo(videoEl, nowMs);
  }

  function stop(){
    stream.getTracks().forEach(t => t.stop());
    landmarker.close();
  }

  return { detect, stop, videoEl, landmarker };
}
