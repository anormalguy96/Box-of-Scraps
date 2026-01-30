# AxtarGet “Box of Scraps” Lab 

A small, Netlify-friendly set of **hand-gesture-controlled web demos** inspired by AxtarGet’s subdomain projects:
- **Neon Hand Control — Precise Picking** (draw + pinch-grab strokes)
- **3D Quantum Galaxy** (gesture-controlled 3D particle galaxy)

Plus two extra “Tony Stark in a cave” demos:
- **HoloSynth** (gesture-controlled WebAudio synth)
- **AirDeck** (gesture-controlled mini slide deck + laser pointer)

> Note on “Python”: real-time webcam hand tracking in the browser must run **client-side** (JavaScript/WebAssembly) for good latency and to work on Netlify.
> This repo includes a **Python lab** folder for local OpenCV experiments, but the **published demos are web-first**.

---

## 1) Run locally

**Requirements:** Node.js 20+ recommended.

```bash
npm install
npm run dev
```

Vite will print a local URL (usually `http://localhost:5173`).

---

## 2) Build for Netlify

```bash
npm run build
```

Output goes to `dist/`.

---

## 3) Deploy to Netlify

- Build command: `npm run build`
- Publish directory: `dist`

`netlify.toml` is already included.

---

## Project URLs (after build)

- Home: `/`
- Neon Hand: `/projects/neon-hand/`
- Quantum Galaxy: `/projects/quantum-galaxy/`
- HoloSynth: `/projects/holo-synth/`
- AirDeck: `/projects/airdeck/`

---

## Model + WASM

The demos use **MediaPipe Tasks Vision (HandLandmarker)** loaded via CDN WASM and a hosted `.task` model file.

If you ever want to bundle the model locally, you can place it in `public/models/hand_landmarker.task` and switch `MODEL_URL` inside:
`src/shared/hand/handTracker.js`

---

## Python lab (optional)

`python-lab/` contains a small OpenCV + MediaPipe hands demo for local experiments:

```bash
cd python-lab
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python neon_hand.py
```

---

## License

MIT (see `LICENSE`)
