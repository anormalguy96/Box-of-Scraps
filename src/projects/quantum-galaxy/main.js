import "../../shared/styles/base.css";
import { mountTopbar, setPill } from "../../shared/ui/pageShell.js";
import { createHandTracker } from "../../shared/hand/handTracker.js";
import { classifyGesture } from "../../shared/hand/gestures.js";
import { fitCanvasToElement } from "../../shared/ui/canvasFit.js";

const app = document.getElementById("app");

app.appendChild(
  mountTopbar({
    title: "AirDeck",
    subtitle: "Open palm swipe = next/prev • Point = laser • Pinch = highlight",
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
    <div class="pill mono">Try: open palm swipe</div>
    <div class="pill mono">ESC → stop</div>
  </div>
`;
app.appendChild(panel);

const slideEl = document.getElementById("slide");
const overlay = document.getElementById("overlay");

if (!slideEl || !overlay) {
  throw new Error("AirDeck: slide or overlay element not found. Check IDs in HTML.");
}

const octx = overlay.getContext("2d");
if (!octx) {
  throw new Error("AirDeck: could not get 2D canvas context (overlay.getContext returned null).");
}

const slides = [
  {
    title: "Tony Stark Mode",
    bullets: ["Hand gestures as UI input", "Static hosting (Netlify)", "No sensors, no gloves — just a webcam"],
  },
  {
    title: "Gesture Map",
    bullets: ["Open palm + swipe → Next / Prev", "Point → Laser pointer", "Pinch → Highlight mode"],
  },
  {
    title: "Why this works",
    bullets: ["MediaPipe detects 21 hand landmarks", "We classify gestures with simple geometry", "Then map gestures → UI actions"],
  },
  {
    title: "Next upgrades",
    bullets: ["Two hands (left = control, right = action)", "Smoother swipe detection", "Add drawing/annotation per slide"],
  },
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
          (b) => `
        <div style="display:flex; gap:10px; align-items:flex-start;">
          <div style="width:10px; height:10px; border-radius:99px; background:rgba(125,249,255,.9); margin-top:8px;"></div>
          <div style="font-size:18px; color:rgba(255,255,255,.82); line-height:1.35">${b}</div>
        </div>`
        )
        .join("")}
    </div>
    <div style="margin-top:auto;" class="small">
      Tip: better lighting improves tracking.
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

// Hidden video
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

// swipe stability
let lastWrist = null;
let swipeCooldown = 0;

// resize stability
let lastSizeKey = "";

function resizeIfNeeded() {
  const rect = panel.getBoundingClientRect();
  const key = `${Math.round(rect.width)}x${Math.round(rect.height)}`;
  if (key === lastSizeKey) return;
  lastSizeKey = key;
  fitCanvasToElement(overlay, panel);
}

function screenPoint(norm, w, h) {
  // mirror horizontally for pointer visuals (feels natural)
  return { x: (1 - norm.x) * w, y: norm.y * h };
}

async function start() {
  if (tracker) return;

  setPill("starting…");
  tracker = await createHandTracker({ videoEl: video, numHands: 1 });
  setPill("camera: on");

  const gesturePill = document.getElementById("gesturePill");
  resizeIfNeeded();

  function tick(now) {
    rafId = requestAnimationFrame(tick);

    resizeIfNeeded();
    const w = overlay.width;
    const h = overlay.height;

    const res = tracker.detect(now);
    const g = classifyGesture(res?.landmarks);
    gesturePill.textContent = `gesture: ${g.name}`;

    octx.clearRect(0, 0, w, h);

    const cursor = g.cursor ? screenPoint(g.cursor, w, h) : null;

    // Laser pointer (point gesture)
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

    // Pinch → highlight mode
    if (g.pinch && cursor) {
      octx.fillStyle = "rgba(180,255,159,.18)";
      octx.fillRect(cursor.x - 140, cursor.y - 40, 280, 80);
    }

    // Swipe detection: open palm + strong horizontal wrist velocity
    if (swipeCooldown > 0) swipeCooldown -= 1;

    if (g.openPalm && g.wrist) {
      if (lastWrist && swipeCooldown <= 0) {
        const vx = g.wrist.x - lastWrist.x;

        // threshold: tune this if too sensitive / not sensitive enough
        if (Math.abs(vx) > 0.035) {
          // If direction feels reversed, swap prev/next here.
          if (vx > 0) prev();
          else next();

          swipeCooldown = 18; // frames cooldown (~300ms at 60fps)
        }
      }
      lastWrist = g.wrist;
    } else {
      lastWrist = null;
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

  setPill("camera: off");
  lastWrist = null;
  swipeCooldown = 0;
  octx.clearRect(0, 0, overlay.width, overlay.height);
}

document.getElementById("startBtn").addEventListener("click", start);
document.getElementById("nextBtn").addEventListener("click", next);
document.getElementById("prevBtn").addEventListener("click", prev);

window.addEventListener("resize", resizeIfNeeded);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") stop();
});

// Stop camera when tab is hidden (prevents “camera stuck on”)
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
});
window.addEventListener("beforeunload", stop);

const note = document.createElement("div");
note.className = "small";
note.style.marginTop = "12px";
note.textContent = "Make it yours: edit slides inside src/projects/airdeck/main.js";
app.appendChild(note);