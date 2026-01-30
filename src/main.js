import "./shared/styles/base.css";
import { mountTopbar } from "./shared/ui/pageShell.js";

const app = document.getElementById("app");

app.appendChild(mountTopbar({
  title: "Box of Scraps by <a href='https://github.com/anormalguy96'>ANormalGuy</a>",
  subtitle: "Hand-gesture projects",
  homeHref: "/"
}));

const grid = document.createElement("div");
grid.className = "grid";
grid.innerHTML = `
  <div class="card">
    <h2>Neon Hand Control</h2>
    <div class="btnrow">
      <a class="btn primary" href="/projects/neon-hand/">Open demo</a>
    </div>
    <div class="small">Gestures: <span class="mono">point</span>, <span class="mono">pinch</span>, <span class="mono">open_palm</span></div>
  </div>

  <div class="card">
    <h2>3D Quantum Galaxy</h2>
    <div class="btnrow">
      <a class="btn primary" href="/projects/quantum-galaxy/">Open demo</a>
    </div>
    <div class="small">Tech: <span class="mono">three</span> + <span class="mono">MediaPipe HandLandmarker</span></div>
  </div>

  <div class="card">
    <h2>HoloSynth</h2>
    <div class="btnrow">
      <a class="btn primary" href="/projects/holo-synth/">Open demo</a>
    </div>
    <div class="small">No hardware: browser only.</div>
  </div>

  <div class="card">
    <h2>AirDeck</h2>
    <div class="btnrow">
      <a class="btn primary" href="/projects/airdeck/">Open demo</a>
    </div>
  </div>
`;
app.appendChild(grid);

const footer = document.createElement("div");
footer.style.marginTop = "16px";
footer.className = "small";
footer.innerHTML = `
   2026 <a href="https://www.linkedin.com/in/elmaddin-mohubbatov/">ANormalGuy</a> © All rights reserved.
`;
app.appendChild(footer);
