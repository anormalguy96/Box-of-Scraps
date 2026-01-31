import "../../shared/styles/base.css";
import { mountTopbar, setPill } from "../../shared/ui/pageShell.js";
import { fitCanvasToElement } from "../../shared/ui/canvasFit.js";
import { createHandTracker } from "../../shared/hand/handTracker.js";
import { classifyGesture } from "../../shared/hand/gestures.js";
import { drawHandSkeleton } from "../../shared/hand/handViz.js";

const app = document.getElementById("app");

app.appendChild(
  mountTopbar({
    title: "Neon Hand Control",
    subtitle: "Point: draw • Pinch: grab • Open palm: pan",
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
  <canvas id="canvas" style="position:absolute; inset:0;"></canvas>
  <canvas id="hud" style="position:absolute; inset:0; pointer-events:none;"></canvas>

  <div style="position:absolute; inset:auto 16px 16px 16px; display:flex; gap:10px; flex-wrap:wrap; align-items:center; z-index:5;">
    <button class="btn primary" id="startBtn">Start camera</button>
    <button class="btn danger" id="clearBtn">Clear</button>
    <span class="pill mono" id="gesturePill">gesture: none</span>
    <span class="pill mono" id="hintPill">point to draw</span>
  </div>

  <div style="position:absolute; top:14px; left:16px; right:16px; display:flex; justify-content:space-between; gap:10px; z-index:5;">
    <div class="pill mono" id="fpsPill">fps: --</div>
    <div class="pill mono">ESC: stop</div>
  </div>
`;
app.appendChild(panel);

// Hidden video (frames only)
const video = document.createElement("video");
video.setAttribute("playsinline", "true");
video.style.position = "absolute";
video.style.opacity = "0";
video.style.pointerEvents = "none";
video.style.width = "1px";
video.style.height = "1px";
document.body.appendChild(video);

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const hud = document.getElementById("hud");
const hctx = hud.getContext("2d");

// Stroke storage: each stroke is { id, points:[{x,y}], colorSeed }
const strokes = [];
let activeStroke = null;

// Drag selection
let grabbedStrokeId = null;
let lastGrab = null; // {x,y}

// Pan
let lastPalm = null;

// resize without doing it every frame
let lastSizeKey = "";
function resizeIfNeeded() {
  const r = panel.getBoundingClientRect();
  const key = `${Math.round(r.width)}x${Math.round(r.height)}`;
  if (key === lastSizeKey) return { width: canvas.width, height: canvas.height };
  lastSizeKey = key;

  fitCanvasToElement(canvas, panel);
  fitCanvasToElement(hud, panel);

  return { width: canvas.width, height: canvas.height };
}

function neonStroke(points, seed) {
  if (points.length < 2) return;

  const glow1 = 18;
  const glow2 = 8;

  const hue = seed % 360;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // outer glow
  ctx.strokeStyle = `hsla(${hue}, 100%, 70%, .18)`;
  ctx.lineWidth = glow1;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const p of points) ctx.lineTo(p.x, p.y);
  ctx.stroke();

  // inner glow
  ctx.strokeStyle = `hsla(${hue}, 100%, 70%, .28)`;
  ctx.lineWidth = glow2;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const p of points) ctx.lineTo(p.x, p.y);
  ctx.stroke();

  // core
  ctx.strokeStyle = `hsla(${hue}, 100%, 85%, .9)`;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const p of points) ctx.lineTo(p.x, p.y);
  ctx.stroke();
}

function redraw(w, h) {
  ctx.clearRect(0, 0, w, h);

  // subtle background speckle
  ctx.fillStyle = "rgba(255,255,255,.02)";
  for (let y = 0; y < h; y += 28) {
    for (let x = 0; x < w; x += 28) {
      ctx.fillRect(x, y, 1, 1);
    }
  }

  for (const s of strokes) neonStroke(s.points, s.colorSeed);
}

function screenPoint(norm, w, h) {
  // selfie-style mirror
  return { x: (1 - norm.x) * w, y: norm.y * h };
}

function nearestStrokeToPoint(p, maxDistPx) {
  let best = null;
  for (const s of strokes) {
    for (const q of s.points) {
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d <= maxDistPx && (!best || d < best.d)) best = { id: s.id, d };
    }
  }
  return best?.id ?? null;
}

function translateStroke(strokeId, dx, dy) {
  const s = strokes.find((x) => x.id === strokeId);
  if (!s) return;
  for (const pt of s.points) {
    pt.x += dx;
    pt.y += dy;
  }
}

function translateAll(dx, dy) {
  for (const s of strokes) {
    for (const pt of s.points) {
      pt.x += dx;
      pt.y += dy;
    }
  }
}

/* ---------- Tracker + stable detection ---------- */
let tracker = null;
let rafId = null;

// stable 30fps detection (less jitter, less CPU spikes)
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

// fps counter
let frames = 0;
let lastFpsT = performance.now();

/* ---------- Start/Stop ---------- */
async function start() {
  if (tracker) return;

  setPill("starting");
  tracker = await createHandTracker({ videoEl: video, numHands: 1 });
  setPill("camera on");

  resizeIfNeeded();
  redraw(canvas.width, canvas.height);

  const gesturePill = document.getElementById("gesturePill");
  const hintPill = document.getElementById("hintPill");
  const fpsPill = document.getElementById("fpsPill");

  function loop(now) {
    rafId = requestAnimationFrame(loop);

    const { width: w, height: h } = resizeIfNeeded();

    const res = detectThrottled(now);
    const g = classifyGesture(res?.landmarks);

    frames++;
    if (now - lastFpsT > 500) {
      const fps = Math.round((frames * 1000) / (now - lastFpsT));
      fpsPill.textContent = `fps: ${fps}`;
      frames = 0;
      lastFpsT = now;
    }

    gesturePill.textContent = `gesture: ${g.name}`;

    let hint = "point to draw";
    if (g.pinch) hint = "pinch to grab";
    else if (g.openPalm) hint = "open palm to pan";
    hintPill.textContent = hint;

    // draw scene
    redraw(w, h);

    // HUD (hand skeleton)
    hctx.clearRect(0, 0, hud.width, hud.height);
    drawHandSkeleton(hctx, res?.landmarks, w, h, {
      mirrorX: true,
      lineWidth: 2,
      jointRadius: 3.0,
    });

    const cursor = g.cursor ? screenPoint(g.cursor, w, h) : null;

    // cursor dot
    if (cursor) {
      ctx.fillStyle = "rgba(125,249,255,.9)";
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, 6.5, 0, Math.PI * 2);
      ctx.fill();
    }

    /* -------- Gesture logic -------- */

    // draw (point)
    if (g.point && cursor) {
      if (!activeStroke) {
        activeStroke = {
          id: crypto.randomUUID(),
          points: [cursor],
          colorSeed: Math.floor(Math.random() * 360),
        };
        strokes.push(activeStroke);
      } else {
        const last = activeStroke.points[activeStroke.points.length - 1];
        const d = Math.hypot(cursor.x - last.x, cursor.y - last.y);
        // slightly higher threshold to reduce tiny jitter points
        if (d > 2.6) {
          activeStroke.points.push(cursor);
          if (activeStroke.points.length > 650) activeStroke.points.shift();
        }
      }

      grabbedStrokeId = null;
      lastGrab = null;
      lastPalm = null;
    } else {
      activeStroke = null;
    }

    // grab & move (pinch)
    if (g.pinch && cursor) {
      if (!grabbedStrokeId) {
        grabbedStrokeId = nearestStrokeToPoint(cursor, 20);
        lastGrab = cursor;
      } else if (lastGrab) {
        const dx = cursor.x - lastGrab.x;
        const dy = cursor.y - lastGrab.y;
        translateStroke(grabbedStrokeId, dx, dy);
        lastGrab = cursor;
      }

      activeStroke = null;
      lastPalm = null;
    } else {
      grabbedStrokeId = null;
      lastGrab = null;
    }

    // pan (open palm, based on wrist)
    if (g.openPalm && g.wrist) {
      const palm = screenPoint(g.wrist, w, h);

      if (!lastPalm) {
        lastPalm = palm;
      } else {
        const dx = palm.x - lastPalm.x;
        const dy = palm.y - lastPalm.y;

        // mild damping to reduce “too sensitive” pan
        translateAll(dx * 0.85, dy * 0.85);
        lastPalm = palm;
      }

      activeStroke = null;
      grabbedStrokeId = null;
      lastGrab = null;
    } else {
      lastPalm = null;
    }
  }

  rafId = requestAnimationFrame(loop);
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

/* ---------- Controls ---------- */
document.getElementById("startBtn").addEventListener("click", start);
document.getElementById("clearBtn").addEventListener("click", () => {
  strokes.splice(0, strokes.length);
  activeStroke = null;
  grabbedStrokeId = null;
  lastGrab = null;
  lastPalm = null;
  redraw(canvas.width, canvas.height);
});

window.addEventListener("resize", resizeIfNeeded);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") stop();
});

// small note (simple)
const note = document.createElement("div");
note.className = "small";
note.style.marginTop = "12px";
note.textContent = "Point to draw. Pinch to grab. Open palm to pan.";
app.appendChild(note);
