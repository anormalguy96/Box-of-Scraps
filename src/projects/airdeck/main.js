import "../../shared/styles/base.css";
import { mountTopbar, setPill } from "../../shared/ui/pageShell.js";
import { createHandTracker } from "../../shared/hand/handTracker.js";
import { classifyGesture } from "../../shared/hand/gestures.js";
import { fitCanvasToElement } from "../../shared/ui/canvasFit.js";
import { drawHandSkeleton } from "../../shared/hand/handViz.js";

const app = document.getElementById("app");
app.appendChild(
  mountTopbar({
    title: "AirDeck",
    subtitle: "Open palm swipe: prev/next • Point: laser • Pinch: highlight",
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
panel.style.height = "68vh";
panel.innerHTML = `
  <div id="slide" style="position:absolute; inset:0; padding:26px; display:flex; flex-direction:column; gap:14px;"></div>
  <canvas id="overlay" style="position:absolute; inset:0; pointer-events:none;"></canvas>

  <div style="position:absolute; inset:auto 16px 16px 16px; display:flex; gap:10px; flex-wrap:wrap; align-items:center; z-index:5;">
    <button class="btn primary" id="startBtn">Start camera</button>
    <button class="btn" id="prevBtn">Prev</button>
    <button class="btn" id="nextBtn">Next</button>
    <span class="pill mono" id="gesturePill">gesture: none</span>
    <span class="pill mono" id="slidePill">slide: 1/4</span>
  </div>

  <div style="position:absolute; top:14px; left:16px; right:16px; display:flex; justify-content:space-between; gap:10px; z-index:5;">
    <div class="pill mono">Open palm + swipe</div>
    <div class="pill mono">ESC: stop</div>
  </div>
`;
app.appendChild(panel);

const slideEl = document.getElementById("slide");
const overlay = document.getElementById("overlay");
const octx = overlay.getContext("2d");

const slides = [
  { title: "AirDeck", bullets: ["Gesture slides", "Laser pointer", "Highlight"] },
  { title: "Gestures", bullets: ["Open palm swipe: prev/next", "Point: laser", "Pinch: highlight"] },
  { title: "Notes", bullets: ["Good light helps", "Keep hand ~40–60cm away", "Fast swipe works better"] },
  { title: "Next", bullets: ["Two-hand mode", "Better swipe filter", "Per-slide notes"] },
];

let idx = 0;

function renderSlide() {
  const s = slides[idx];
  slideEl.innerHTML = `
    <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
      <div style="font-size:34px; font-weight:800; letter-spacing:.3px">${s.title}</div>
      <div class="pill mono" style="align-self:center;">AirDeck</div>
    </div>
    <div style="height:1px; background:rgba(255,255,255,.10); margin-top:4px;"></div>
    <div style="display:grid; gap:10px; margin-top:8px;">
      ${s.bullets
        .map(
          (b) => `<div style="display:flex; gap:10px; align-items:flex-start;">
            <div style="width:10px; height:10px; border-radius:99px; background:rgba(125,249,255,.9); margin-top:8px;"></div>
            <div style="font-size:18px; color:rgba(255,255,255,.82); line-height:1.35">${b}</div>
          </div>`
        )
        .join("")}
    </div>
  `;
  document.getElementById("slidePill").textContent = `slide: ${idx + 1}/${slides.length}`;
}
renderSlide();

function next() {
  idx = (idx + 1) % slides.length;
  renderSlide();
}
function prev() {
  idx = (idx - 1 + slides.length) % slides.length;
  renderSlide();
}

// hidden video
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

// resize without doing it every frame
let lastSizeKey = "";
function resizeIfNeeded() {
  const r = panel.getBoundingClientRect();
  const key = `${Math.round(r.width)}x${Math.round(r.height)}`;
  if (key === lastSizeKey) return;
  lastSizeKey = key;
  fitCanvasToElement(overlay, panel);
}

// make pointer feel normal (mirror x)
function screenPoint(norm, w, h) {
  return { x: (1 - norm.x) * w, y: norm.y * h };
}

// detection throttling (stable FPS + lower CPU)
let lastDetectAt = 0;
let lastRes = null;
function detectThrottled(now) {
  // 30 fps detection
  if (!tracker) return null;
  if (now - lastDetectAt >= 33) {
    lastRes = tracker.detect(now);
    lastDetectAt = now;
  }
  return lastRes;
}

// swipe filter (less accidental triggers)
let lastWrist = null;
let swipeAccum = 0;
let swipeCooldown = 0;

async function start() {
  if (tracker) return;

  setPill("starting");
  tracker = await createHandTracker({ videoEl: video, numHands: 1 });
  setPill("camera on");

  const gesturePill = document.getElementById("gesturePill");
  resizeIfNeeded();

  function tick(now) {
    rafId = requestAnimationFrame(tick);
    resizeIfNeeded();

    const w = overlay.width;
    const h = overlay.height;

    const res = detectThrottled(now);
    const g = classifyGesture(res?.landmarks);
    gesturePill.textContent = `gesture: ${g.name}`;

    octx.clearRect(0, 0, w, h);

    // draw skeleton first (so pointer stays on top)
    drawHandSkeleton(octx, res?.landmarks, w, h, {
      mirrorX: true,
      lineWidth: 2,
      jointRadius: 3.2,
    });

    const cursor = g.cursor ? screenPoint(g.cursor, w, h) : null;

    // laser pointer
    if (g.point && cursor) {
      octx.fillStyle = "rgba(255,77,109,.95)";
      octx.beginPath();
      octx.arc(cursor.x, cursor.y, 10, 0, Math.PI * 2);
      octx.fill();

      octx.strokeStyle = "rgba(255,77,109,.35)";
      octx.lineWidth = 2;
      octx.beginPath();
      octx.arc(cursor.x, cursor.y, 26, 0, Math.PI * 2);
      octx.stroke();
    }

    // highlight
    if (g.pinch && cursor) {
      octx.fillStyle = "rgba(180,255,159,.18)";
      octx.fillRect(cursor.x - 140, cursor.y - 40, 280, 80);
    }

    // swipe
    if (swipeCooldown > 0) swipeCooldown--;

    if (g.openPalm && g.wrist) {
      if (lastWrist) {
        const vx = g.wrist.x - lastWrist.x;

        // accumulate motion; reset if direction changes
        if (Math.sign(vx) !== Math.sign(swipeAccum)) swipeAccum = 0;
        swipeAccum += vx;

        // require “real” swipe, not tiny jitter
        const TRIGGER = 0.12;
        if (Math.abs(swipeAccum) > TRIGGER && swipeCooldown <= 0) {
          if (swipeAccum > 0) prev();
          else next();
          swipeCooldown = 18;
          swipeAccum = 0;
        }
      }
      lastWrist = g.wrist;
    } else {
      lastWrist = null;
      swipeAccum = 0;
    }
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
document.getElementById("nextBtn").addEventListener("click", next);
document.getElementById("prevBtn").addEventListener("click", prev);

window.addEventListener("resize", resizeIfNeeded);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") stop();
});