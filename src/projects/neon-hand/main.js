import "../../shared/styles/base.css";
import { mountTopbar, setPill } from "../../shared/ui/pageShell.js";
import { fitCanvasToElement } from "../../shared/ui/canvasFit.js";
import { createHandTracker } from "../../shared/hand/handTracker.js";
import { classifyGesture } from "../../shared/hand/gestures.js";

const app = document.getElementById("app");
app.appendChild(mountTopbar({
  title: "Neon Hand Control",
  subtitle: "Point = draw • Pinch = grab stroke • Open palm = pan",
  homeHref: "/"
}));

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
  <canvas id="canvas"></canvas>
  <div style="position:absolute; inset:auto 16px 16px 16px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
    <button class="btn primary" id="startBtn">Start camera</button>
    <button class="btn danger" id="clearBtn">Clear</button>
    <span class="pill mono" id="gesturePill">gesture: none</span>
    <span class="pill mono" id="hintPill">tip: point to draw</span>
  </div>
  <div style="position:absolute; top:14px; left:16px; right:16px; display:flex; justify-content:space-between; gap:10px;">
    <div class="pill mono" id="fpsPill">fps: --</div>
    <div class="pill mono">ESC → stop</div>
  </div>
`;
app.appendChild(panel);

// Hidden video (we only need frames)
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

// Stroke storage: each stroke is { id, points:[{x,y}], colorSeed }
const strokes = [];
let activeStroke = null;

// Drag selection
let grabbedStrokeId = null;
let lastGrab = null; // {x,y}

// Pan
let lastPalm = null;

function neonStroke(points, seed){
  if(points.length < 2) return;
  const glow1 = 18;
  const glow2 = 8;

  // “neon” color variations from seed
  const hue = (seed % 360);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // outer glow
  ctx.strokeStyle = `hsla(${hue}, 100%, 70%, .18)`;
  ctx.lineWidth = glow1;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for(const p of points) ctx.lineTo(p.x, p.y);
  ctx.stroke();

  // inner glow
  ctx.strokeStyle = `hsla(${hue}, 100%, 70%, .28)`;
  ctx.lineWidth = glow2;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for(const p of points) ctx.lineTo(p.x, p.y);
  ctx.stroke();

  // core line
  ctx.strokeStyle = `hsla(${hue}, 100%, 85%, .9)`;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for(const p of points) ctx.lineTo(p.x, p.y);
  ctx.stroke();
}

function redraw(){
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // subtle background noise grid
  ctx.fillStyle = "rgba(255,255,255,.02)";
  for(let y=0; y<canvas.height; y+=28){
    for(let x=0; x<canvas.width; x+=28){
      ctx.fillRect(x, y, 1, 1);
    }
  }
  for(const s of strokes){
    neonStroke(s.points, s.colorSeed);
  }
}

function screenPoint(norm, w, h){
  // mirror horizontally (selfie view feels natural)
  return { x: (1 - norm.x) * w, y: norm.y * h };
}

function nearestStrokeToPoint(p, maxDistPx){
  let best = null;
  for(const s of strokes){
    for(const q of s.points){
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if(d <= maxDistPx && (!best || d < best.d)){
        best = { id: s.id, d };
      }
    }
  }
  return best?.id ?? null;
}

function translateStroke(strokeId, dx, dy){
  const s = strokes.find(x => x.id === strokeId);
  if(!s) return;
  for(const pt of s.points){
    pt.x += dx;
    pt.y += dy;
  }
}

function translateAll(dx, dy){
  for(const s of strokes){
    for(const pt of s.points){
      pt.x += dx;
      pt.y += dy;
    }
  }
}

let tracker = null;
let rafId = null;
let frames = 0;
let lastFpsT = performance.now();

async function start(){
  if(tracker) return;
  setPill("starting…");
  tracker = await createHandTracker({ videoEl: video, numHands: 1 });
  setPill("camera: on");

  const container = panel;
  fitCanvasToElement(canvas, container);
  redraw();

  const gesturePill = document.getElementById("gesturePill");
  const hintPill = document.getElementById("hintPill");
  const fpsPill = document.getElementById("fpsPill");

  function loop(now){
    rafId = requestAnimationFrame(loop);

    const fit = fitCanvasToElement(canvas, container);
    const result = tracker.detect(now);
    const g = classifyGesture(result?.landmarks);

    frames++;
    if(now - lastFpsT > 500){
      const fps = Math.round((frames * 1000) / (now - lastFpsT));
      fpsPill.textContent = `fps: ${fps}`;
      frames = 0;
      lastFpsT = now;
    }

    gesturePill.textContent = `gesture: ${g.name}`;
    let hint = "tip: point to draw";
    if(g.pinch) hint = "pinch: grab + move a stroke";
    else if(g.openPalm) hint = "open palm: pan everything";
    else if(g.fist) hint = "fist: (idle)";
    hintPill.textContent = hint;

    const cursor = g.cursor ? screenPoint(g.cursor, fit.width, fit.height) : null;
    redraw();

    // draw cursor
    if(cursor){
      ctx.fillStyle = "rgba(125,249,255,.9)";
      ctx.beginPath();
      ctx.arc(cursor.x, cursor.y, 6.5, 0, Math.PI*2);
      ctx.fill();
    }

    // --- gesture logic ---
    if(g.point && cursor){
      // start or continue a stroke
      if(!activeStroke){
        activeStroke = { id: crypto.randomUUID(), points: [cursor], colorSeed: Math.floor(Math.random()*360) };
        strokes.push(activeStroke);
      }else{
        const last = activeStroke.points[activeStroke.points.length - 1];
        const d = Math.hypot(cursor.x - last.x, cursor.y - last.y);
        if(d > 2){
          activeStroke.points.push(cursor);
          if(activeStroke.points.length > 600) activeStroke.points.shift();
        }
      }
      grabbedStrokeId = null;
      lastGrab = null;
      lastPalm = null;
    } else {
      activeStroke = null;
    }

    if(g.pinch && cursor){
      // lock onto nearest stroke and drag it while pinch is held
      if(!grabbedStrokeId){
        grabbedStrokeId = nearestStrokeToPoint(cursor, 18);
        lastGrab = cursor;
      }else if(lastGrab){
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

    if(g.openPalm && cursor){
      // pan entire canvas based on palm/wrist movement
      const palm = screenPoint(g.wrist, fit.width, fit.height);
      if(!lastPalm){
        lastPalm = palm;
      } else {
        const dx = palm.x - lastPalm.x;
        const dy = palm.y - lastPalm.y;
        translateAll(dx, dy);
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

function stop(){
  if(rafId) cancelAnimationFrame(rafId);
  rafId = null;
  if(tracker){
    tracker.stop();
    tracker = null;
  }
  setPill("camera: off");
}

document.getElementById("startBtn").addEventListener("click", start);
document.getElementById("clearBtn").addEventListener("click", () => {
  strokes.splice(0, strokes.length);
  activeStroke = null;
  grabbedStrokeId = null;
  redraw();
});

window.addEventListener("resize", () => fitCanvasToElement(canvas, panel));
window.addEventListener("keydown", (e) => {
  if(e.key === "Escape") stop();
});

// Small hint
const note = document.createElement("div");
note.className = "small";
note.style.marginTop = "12px";
note.innerHTML = `
  Inspired by the “pinch-to-grab” interaction idea. Keep your hand ~30–60cm from camera.
`;
app.appendChild(note);
