
import "../../shared/styles/base.css";
import { mountTopbar, setPill } from "../../shared/ui/pageShell.js";
import { createHandTracker } from "../../shared/hand/handTracker.js";
import { classifyGesture } from "../../shared/hand/gestures.js";
import { fitCanvasToElement } from "../../shared/ui/canvasFit.js";

const app = document.getElementById("app");
app.appendChild(
  mountTopbar({
    title: "AirDeck",
    subtitle: "Açıq ovuc swipe = növbəti/əvvəlki • Point = lazer • Pinch = vurğula",
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
  <canvas id="overlay" style="position:absolute; inset:0;"></canvas>
  <div style="position:absolute; inset:auto 16px 16px 16px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
    <button class="btn primary" id="startBtn">Kameranı aç</button>
    <button class="btn" id="prevBtn">Əvvəlki</button>
    <button class="btn" id="nextBtn">Növbəti</button>
    <span class="pill mono" id="gesturePill">jest: yoxdur</span>
    <span class="pill mono" id="slidePill">slayd: 1/4</span>
  </div>
  <div style="position:absolute; top:14px; left:16px; right:16px; display:flex; justify-content:space-between; gap:10px;">
    <div class="pill mono">Sına: açıq ovucla swipe</div>
    <div class="pill mono">ESC → dayandır</div>
  </div>
`;
app.appendChild(panel);

const slideEl = document.getElementById("slide");
const overlay = document.getElementById("overlay");
const octx = overlay.getContext("2d");

const slides = [
  {
    title: "Tony Stark modu",
    bullets: ["UI idarəsi üçün jestlər", "Kamera ilə işləyən "],
  },
  {
    title: "Jest xəritəsi",
    bullets: ["Açıq ovuc + swipe → Növbəti / Əvvəlki", "Point → Lazer göstərici", "Pinch → Vurğulama"],
  },
  {
    title: "Niyə işləyir",
    bullets: ["MediaPipe əl üçün 21 nöqtə çıxarır", "Jestləri sadə həndəsə ilə tanıyırıq", "Sonra jest → UI hərəkəti kimi xəritələyirik"],
  },
  {
    title: "Növbəti addımlar",
    bullets: ["İki əl (sol = idarə, sağ = əməl)", "Daha stabil swipe", "Slayda qeyd/çəkmə əlavə etmək"],
  },
];

let idx = 0;
let highlight = false;

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
    <div style="margin-top:auto;" class="small">
    </div>
  `;
  document.getElementById("slidePill").textContent = `slayd: ${idx + 1}/${slides.length}`;
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
let lastWrist = null;
let swipeCooldown = 0;

function resize() {
  fitCanvasToElement(overlay, panel);
}

function screenPoint(norm, w, h) {
  return { x: (1 - norm.x) * w, y: norm.y * h };
}

async function start() {
  if (tracker) return;
  setPill("hazırlanır…");
  tracker = await createHandTracker({ videoEl: video, numHands: 1 });
  setPill("kamera açıq");
  resize();

  const gesturePill = document.getElementById("gesturePill");

  function tick(now) {
    rafId = requestAnimationFrame(tick);
    resize();
    const w = overlay.width,
      h = overlay.height;

    const res = tracker.detect(now);
    const g = classifyGesture(res?.landmarks);
    gesturePill.textContent = `jest: ${g.name}`;

    octx.clearRect(0, 0, w, h);

    const cursor = g.cursor ? screenPoint(g.cursor, w, h) : null;

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
    highlight = g.pinch;
    if (highlight && cursor) {
      octx.fillStyle = "rgba(180,255,159,.18)";
      octx.fillRect(cursor.x - 140, cursor.y - 40, 280, 80);
    }

    // Swipe detection: open palm + strong horizontal wrist velocity
    if (swipeCooldown > 0) swipeCooldown -= 1;

    if (g.openPalm) {
      if (lastWrist) {
        const vx = g.wrist.x - lastWrist.x;
        // mirrored x, so invert direction for intuitive swipe
        if (Math.abs(vx) > 0.035 && swipeCooldown <= 0) {
          if (vx > 0) prev();
          else next();
          swipeCooldown = 18;
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
  setPill("kamera bağlı");
}

document.getElementById("startBtn").addEventListener("click", start);
document.getElementById("nextBtn").addEventListener("click", next);
document.getElementById("prevBtn").addEventListener("click", prev);

window.addEventListener("resize", resize);
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") stop();
});

const note = document.createElement("div");
note.className = "small";
note.style.marginTop = "12px";
note.innerHTML = `Özünə uyğunlaşdır: slayd mətnlərini <span class="mono">src/projects/airdeck/main.js</span> içində dəyiş.`;
app.appendChild(note);
