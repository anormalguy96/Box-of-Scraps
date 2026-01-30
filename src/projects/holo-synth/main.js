import "../../shared/styles/base.css";
import { mountTopbar, setPill } from "../../shared/ui/pageShell.js";
import { createHandTracker } from "../../shared/hand/handTracker.js";
import { classifyGesture } from "../../shared/hand/gestures.js";
import { fitCanvasToElement } from "../../shared/ui/canvasFit.js";

const app = document.getElementById("app");
app.appendChild(mountTopbar({
  title: "HoloSynth",
  subtitle: "X = pitch • Y = volume • Pinch = hold • Fist = bass drop",
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
panel.style.height = "62vh";
panel.innerHTML = `
  <canvas id="viz"></canvas>
  <div style="position:absolute; inset:auto 16px 16px 16px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
    <button class="btn primary" id="startBtn">Start</button>
    <button class="btn" id="muteBtn">Mute</button>
    <span class="pill mono" id="gesturePill">gesture: none</span>
    <span class="pill mono" id="notePill">note: --</span>
  </div>
  <div style="position:absolute; top:14px; left:16px; right:16px; display:flex; justify-content:space-between; gap:10px;">
    <div class="pill mono" id="levelPill">lvl: --</div>
    <div class="pill mono">ESC → stop</div>
  </div>
`;
app.appendChild(panel);

const canvas = document.getElementById("viz");
const ctx = canvas.getContext("2d");

// Hidden video
const video = document.createElement("video");
video.setAttribute("playsinline", "true");
video.style.position = "absolute";
video.style.opacity = "0";
video.style.pointerEvents = "none";
video.style.width = "1px";
video.style.height = "1px";
document.body.appendChild(video);

// WebAudio
let audio = null;
let osc = null;
let gain = null;
let filter = null;
let analyser = null;
let data = null;

function setupAudio(){
  audio = new (window.AudioContext || window.webkitAudioContext)();
  osc = audio.createOscillator();
  gain = audio.createGain();
  filter = audio.createBiquadFilter();
  analyser = audio.createAnalyser();
  analyser.fftSize = 1024;
  data = new Uint8Array(analyser.frequencyBinCount);

  osc.type = "sawtooth";
  filter.type = "lowpass";
  filter.frequency.value = 1200;

  gain.gain.value = 0.0;
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(analyser);
  analyser.connect(audio.destination);
  osc.start();
}

let tracker = null;
let rafId = null;
let hold = false;
let fistLatch = false;
let muted = false;

function midiToFreq(m){
  return 440 * Math.pow(2, (m - 69)/12);
}

function drawViz(level, cursor, fit){
  ctx.clearRect(0,0,fit.width,fit.height);

  // background
  ctx.fillStyle = "rgba(255,255,255,.03)";
  ctx.fillRect(0,0,fit.width,fit.height);

  // waveform bars
  analyser.getByteFrequencyData(data);
  const bars = 90;
  const step = Math.floor(data.length / bars);
  for(let i=0; i<bars; i++){
    const v = data[i*step] / 255;
    const x = (i / bars) * fit.width;
    const h = v * fit.height * 0.65;
    ctx.fillStyle = `rgba(125,249,255,${0.15 + v*0.55})`;
    ctx.fillRect(x, fit.height - h, fit.width / bars - 2, h);
  }

  // cursor
  if(cursor){
    ctx.fillStyle = "rgba(180,255,159,.9)";
    ctx.beginPath();
    ctx.arc(cursor.x, cursor.y, 10, 0, Math.PI*2);
    ctx.fill();
  }

  // level meter
  ctx.fillStyle = "rgba(255,255,255,.10)";
  ctx.fillRect(16,16,14,fit.height-32);
  ctx.fillStyle = "rgba(255,77,109,.65)";
  ctx.fillRect(16, 16 + (1-level)*(fit.height-32), 14, level*(fit.height-32));
}

function screenPoint(norm, w, h){
  return { x: (1 - norm.x) * w, y: norm.y * h };
}

async function start(){
  if(tracker) return;

  setPill("starting…");
  setupAudio();
  tracker = await createHandTracker({ videoEl: video, numHands: 1 });
  setPill("running");

  const gesturePill = document.getElementById("gesturePill");
  const notePill = document.getElementById("notePill");
  const levelPill = document.getElementById("levelPill");

  function tick(now){
    rafId = requestAnimationFrame(tick);
    const fit = fitCanvasToElement(canvas, panel);

    const res = tracker.detect(now);
    const g = classifyGesture(res?.landmarks);
    gesturePill.textContent = `gesture: ${g.name}`;

    const cursor = g.cursor ? screenPoint(g.cursor, fit.width, fit.height) : null;

    // map cursor to synth
    if(cursor){
      const xN = cursor.x / fit.width;
      const yN = cursor.y / fit.height;

      // Pitch: 48..84 (C3..C6)
      const midi = Math.round(48 + xN * 36);
      const freq = midiToFreq(midi);

      // Volume: 0..0.7
      const level = Math.max(0, Math.min(1, 1 - yN));
      const vol = muted ? 0 : (hold ? 0.35 : level * 0.7);

      if(!hold) osc.frequency.setTargetAtTime(freq, audio.currentTime, 0.03);
      filter.frequency.setTargetAtTime(300 + level*2600, audio.currentTime, 0.04);
      gain.gain.setTargetAtTime(vol, audio.currentTime, 0.05);

      notePill.textContent = `note: ${midi} → ${Math.round(freq)}Hz`;
      levelPill.textContent = `lvl: ${level.toFixed(2)} ${hold ? "(hold)" : ""}`;

      drawViz(level, cursor, fit);
    } else {
      // decay
      gain.gain.setTargetAtTime(0, audio.currentTime, 0.07);
      drawViz(0, null, fit);
      notePill.textContent = "note: --";
      levelPill.textContent = "lvl: --";
    }

    // pinch toggles hold (edge-trigger)
    if(g.pinch && !hold){
      hold = true;
    } else if(!g.pinch && hold){
      hold = false;
    }

    // fist triggers bass drop (edge-trigger)
    if(g.fist && !fistLatch){
      fistLatch = true;
      // quick sweep filter + boost
      filter.frequency.setTargetAtTime(120, audio.currentTime, 0.01);
      gain.gain.setTargetAtTime(muted ? 0 : 0.65, audio.currentTime, 0.02);
      setTimeout(() => {
        if(!audio) return;
        filter.frequency.setTargetAtTime(1400, audio.currentTime, 0.18);
      }, 120);
    }
    if(!g.fist) fistLatch = false;
  }

  rafId = requestAnimationFrame(tick);
}

function stop(){
  if(rafId) cancelAnimationFrame(rafId);
  rafId = null;
  if(tracker){
    tracker.stop();
    tracker = null;
  }
  if(audio){
    audio.close();
    audio = null;
  }
  setPill("stopped");
}

document.getElementById("startBtn").addEventListener("click", async () => {
  // Audio contexts require a user gesture
  await start();
});
document.getElementById("muteBtn").addEventListener("click", () => {
  muted = !muted;
  document.getElementById("muteBtn").textContent = muted ? "Unmute" : "Mute";
});

window.addEventListener("resize", () => fitCanvasToElement(canvas, panel));
window.addEventListener("keydown", (e) => {
  if(e.key === "Escape") stop();
});

const note = document.createElement("div");
note.className = "small";
note.style.marginTop = "12px";
note.textContent = "If audio doesn’t play, click Start again and ensure your browser allows sound.";
app.appendChild(note);
