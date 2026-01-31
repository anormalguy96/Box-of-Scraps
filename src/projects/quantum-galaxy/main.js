import "../../shared/styles/base.css";
import { mountTopbar, setPill } from "../../shared/ui/pageShell.js";
import { createHandTracker } from "../../shared/hand/handTracker.js";
import { classifyGesture } from "../../shared/hand/gestures.js";
import { fitCanvasToElement } from "../../shared/ui/canvasFit.js";
import { drawHandSkeleton } from "../../shared/hand/handViz.js";
import * as THREE from "three";

/* ---------- UI ---------- */
const app = document.getElementById("app");

app.appendChild(
  mountTopbar({
    title: "3D Quantum Galaxy",
    subtitle: "Open palm: orbit • Pinch: zoom • Fist: burst",
    homeHref: "/",
  })
);

const panel = document.createElement("div");
panel.style.marginTop = "16px";
panel.style.borderRadius = "var(--r)";
panel.style.border = "1px solid rgba(255,255,255,.10)";
panel.style.background = "rgba(255,255,255,.04)";
panel.style.boxShadow = "var(--shadow)";
panel.style.overflow = "hidden";
panel.style.position = "relative";
panel.style.height = "70vh";
panel.innerHTML = `
  <div style="position:absolute; inset:0;">
    <canvas id="gl" style="width:100%; height:100%; display:block;"></canvas>
    <canvas id="hud" style="position:absolute; inset:0; pointer-events:none;"></canvas>
  </div>

  <div style="position:absolute; inset:auto 16px 16px 16px; display:flex; gap:10px; flex-wrap:wrap; align-items:center; z-index:5;">
    <button class="btn primary" id="startBtn">Start camera</button>
    <button class="btn" id="burstBtn">Burst</button>
    <span class="pill mono" id="gesturePill">gesture: none</span>
    <span class="pill mono" id="fpsPill">fps: --</span>
  </div>

  <div style="position:absolute; top:14px; left:16px; right:16px; display:flex; justify-content:space-between; gap:10px; z-index:5;">
    <div class="pill mono">Keep hand in frame</div>
    <div class="pill mono">ESC: stop</div>
  </div>
`;
app.appendChild(panel);

const glCanvas = document.getElementById("gl");
const hudCanvas = document.getElementById("hud");
const hctx = hudCanvas.getContext("2d");
const gesturePill = document.getElementById("gesturePill");
const fpsPill = document.getElementById("fpsPill");

/* ---------- Resize (no per-frame reflow) ---------- */
let lastSizeKey = "";
function resizeIfNeeded(renderer, camera) {
  const r = panel.getBoundingClientRect();
  const key = `${Math.round(r.width)}x${Math.round(r.height)}`;
  if (key === lastSizeKey) return;
  lastSizeKey = key;

  // fit HUD canvas to panel
  fitCanvasToElement(hudCanvas, panel);

  // set GL size to match panel
  renderer.setSize(Math.floor(r.width), Math.floor(r.height), false);
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
}

/* ---------- Three.js scene ---------- */
const renderer = new THREE.WebGLRenderer({
  canvas: glCanvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
camera.position.set(0, 0, 18);

const group = new THREE.Group();
scene.add(group);

// Soft fog for depth
scene.fog = new THREE.FogExp2(0x000000, 0.035);

// lights (subtle)
const amb = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(amb);

const dir = new THREE.DirectionalLight(0xffffff, 0.6);
dir.position.set(8, 10, 12);
scene.add(dir);

/* ---------- Galaxy particles ---------- */
const STAR_COUNT = 14000;

const positions = new Float32Array(STAR_COUNT * 3);
const colors = new Float32Array(STAR_COUNT * 3);
const base = new Float32Array(STAR_COUNT * 3);
const velocities = new Float32Array(STAR_COUNT * 3);

function randn() {
  // Box-Muller
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function buildGalaxy() {
  for (let i = 0; i < STAR_COUNT; i++) {
    const idx = i * 3;

    // spiral-ish: radius + arm angle
    const r = Math.pow(Math.random(), 0.55) * 10.0;
    const arm = (Math.random() < 0.5 ? -1 : 1) * (0.8 + Math.random() * 0.7);
    const angle = r * 0.55 * arm + randn() * 0.06;

    const x = Math.cos(angle) * r + randn() * 0.18;
    const y = randn() * 0.35;
    const z = Math.sin(angle) * r + randn() * 0.18;

    positions[idx + 0] = x;
    positions[idx + 1] = y;
    positions[idx + 2] = z;

    base[idx + 0] = x;
    base[idx + 1] = y;
    base[idx + 2] = z;

    // gentle core tint → outer tint
    const t = Math.min(1, r / 10);
    const c1 = new THREE.Color(0x7df9ff);
    const c2 = new THREE.Color(0xff4d6d);
    const c = c1.clone().lerp(c2, t * 0.55);
    colors[idx + 0] = c.r;
    colors[idx + 1] = c.g;
    colors[idx + 2] = c.b;

    velocities[idx + 0] = 0;
    velocities[idx + 1] = 0;
    velocities[idx + 2] = 0;
  }
}

buildGalaxy();

const geom = new THREE.BufferGeometry();
geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));

const mat = new THREE.PointsMaterial({
  size: 0.045,
  vertexColors: true,
  transparent: true,
  opacity: 0.95,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

const points = new THREE.Points(geom, mat);
group.add(points);

// faint core glow sphere
const core = new THREE.Mesh(
  new THREE.SphereGeometry(0.85, 24, 24),
  new THREE.MeshBasicMaterial({
    color: 0x7df9ff,
    transparent: true,
    opacity: 0.06,
  })
);
group.add(core);

/* ---------- Gesture / camera ---------- */
const video = document.createElement("video");
video.setAttribute("playsinline", "true");
video.style.position = "absolute";
video.style.opacity = "0";
video.style.pointerEvents = "none";
video.style.width = "1px";
video.style.height = "1px";
document.body.appendChild(video);

let tracker = null;
let rafId = null;

/* throttled detection (stable) */
let lastDetectAt = 0;
let lastRes = null;
function detectThrottled(now) {
  if (!tracker) return null;
  if (now - lastDetectAt >= 33) {
    lastRes = tracker.detect(now);
    lastDetectAt = now;
  }
  return lastRes;
}

/* orbit + zoom controls */
let yaw = 0;
let pitch = 0;
let targetYaw = 0;
let targetPitch = 0;

let zoom = 18;
let targetZoom = 18;

let lastWrist = null;

/* simple fist check (more forgiving) */
function isFingerOpen(lm, tip, pip) {
  return (lm[tip].y + 0.01) < lm[pip].y;
}
function isFist(res, g) {
  const lm = res?.landmarks?.[0];
  if (!lm || lm.length < 21) return false;
  if (g.pinch || g.openPalm || g.point) return false;

  const indexOpen = isFingerOpen(lm, 8, 6);
  const middleOpen = isFingerOpen(lm, 12, 10);
  const ringOpen = isFingerOpen(lm, 16, 14);
  const pinkyOpen = isFingerOpen(lm, 20, 18);

  return !indexOpen && !middleOpen && !ringOpen && !pinkyOpen;
}

/* burst */
let burstCooldown = 0;
function burst() {
  // kick particles outward briefly
  for (let i = 0; i < STAR_COUNT; i++) {
    const idx = i * 3;
    const x = positions[idx + 0];
    const y = positions[idx + 1];
    const z = positions[idx + 2];

    const len = Math.max(0.001, Math.hypot(x, y, z));
    const k = 0.08 + Math.random() * 0.10;

    velocities[idx + 0] += (x / len) * k;
    velocities[idx + 1] += (y / len) * (k * 0.45);
    velocities[idx + 2] += (z / len) * k;
  }
  burstCooldown = 28;
}

/* fps counter */
let fpsLast = performance.now();
let fpsFrames = 0;
let fpsValue = 0;

async function start() {
  if (tracker) return;

  setPill("starting");
  tracker = await createHandTracker({ videoEl: video, numHands: 1 });
  setPill("camera on");

  function tick(now) {
    rafId = requestAnimationFrame(tick);

    resizeIfNeeded(renderer, camera);

    // fps
    fpsFrames++;
    if (now - fpsLast > 500) {
      fpsValue = Math.round((fpsFrames * 1000) / (now - fpsLast));
      fpsFrames = 0;
      fpsLast = now;
      fpsPill.textContent = `fps: ${fpsValue}`;
    }

    // detection
    const res = detectThrottled(now);
    const g = classifyGesture(res?.landmarks);
    gesturePill.textContent = `gesture: ${g.name}`;

    // HUD
    hctx.clearRect(0, 0, hudCanvas.width, hudCanvas.height);
    drawHandSkeleton(hctx, res?.landmarks, hudCanvas.width, hudCanvas.height, {
      mirrorX: true,
      lineWidth: 2,
      jointRadius: 3.1,
    });

    // orbit control (open palm)
    if (g.openPalm && g.wrist) {
      if (lastWrist) {
        const dx = g.wrist.x - lastWrist.x;
        const dy = g.wrist.y - lastWrist.y;

        // mirror x for natural feel
        targetYaw += (-dx) * 3.2;
        targetPitch += (dy) * 2.6;

        // clamp pitch
        targetPitch = Math.max(-1.0, Math.min(1.0, targetPitch));
      }
      lastWrist = g.wrist;
    } else {
      lastWrist = null;
    }

    // zoom (pinch)
    if (g.pinch && g.cursor) {
      // cursor.y: 0 top → 1 bottom
      // map upward hand to zoom in
      const zWant = 12 + (g.cursor.y * 12);
      targetZoom = Math.max(9.5, Math.min(24, zWant));
    } else {
      // ease back a bit
      targetZoom = Math.max(11, Math.min(22, targetZoom));
    }

    // fist burst (with cooldown)
    if (burstCooldown > 0) burstCooldown--;
    const fist = isFist(res, g);
    if (fist && burstCooldown <= 0) burst();

    // smooth camera & group
    yaw += (targetYaw - yaw) * 0.08;
    pitch += (targetPitch - pitch) * 0.08;
    zoom += (targetZoom - zoom) * 0.08;

    camera.position.set(
      Math.sin(yaw) * zoom * Math.cos(pitch),
      Math.sin(pitch) * zoom,
      Math.cos(yaw) * zoom * Math.cos(pitch)
    );
    camera.lookAt(0, 0, 0);

    // rotate galaxy slightly
    group.rotation.y += 0.0012;
    group.rotation.x += 0.0006;

    // particle spring back + velocity damping
    const pos = geom.attributes.position.array;
    for (let i = 0; i < STAR_COUNT; i++) {
      const idx = i * 3;

      // velocity
      velocities[idx + 0] *= 0.92;
      velocities[idx + 1] *= 0.92;
      velocities[idx + 2] *= 0.92;

      // spring to base
      const sx = (base[idx + 0] - pos[idx + 0]) * 0.006;
      const sy = (base[idx + 1] - pos[idx + 1]) * 0.006;
      const sz = (base[idx + 2] - pos[idx + 2]) * 0.006;

      velocities[idx + 0] += sx;
      velocities[idx + 1] += sy;
      velocities[idx + 2] += sz;

      pos[idx + 0] += velocities[idx + 0];
      pos[idx + 1] += velocities[idx + 1];
      pos[idx + 2] += velocities[idx + 2];
    }
    geom.attributes.position.needsUpdate = true;

    renderer.render(scene, camera);
  }

  rafId = requestAnimationFrame(tick);
}

function stop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;

  if (tracker) {
    tracker.stop();
    tracker = null;
  }

  setPill("camera off");
}

document.getElementById("startBtn").addEventListener("click", start);
document.getElementById("burstBtn").addEventListener("click", burst);

window.addEventListener("resize", () => resizeIfNeeded(renderer, camera));
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") stop();
});

// initial size
resizeIfNeeded(renderer, camera);
renderer.render(scene, camera);