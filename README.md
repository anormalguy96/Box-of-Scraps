## Box of Scraps

A small collection of **hand-gesture controlled web demos**, built as experiments and playground projects.
Everything is designed to run as a **static site on Netlify** and work directly in the browser.

### Included demos

* **Neon Hand Control**
  Draw strokes with your finger, grab them with a pinch, move the scene with an open palm.

* **3D Quantum Galaxy**
  A particle galaxy controlled by hand movement (orbit, zoom, burst).

* **HoloSynth**
  A browser-based audio synth controlled by hand position and gestures.

* **AirDeck**
  A minimal slide deck navigated with hand gestures (swipe, laser pointer, highlight).

---

## Project routes

After build or deployment:

* `/` — index
* `/projects/neon-hand/`
* `/projects/quantum-galaxy/`
* `/projects/holo-synth/`
* `/projects/airdeck/`

---

## Model and WASM

Hand tracking uses **MediaPipe Tasks Vision (HandLandmarker)** loaded via CDN together with a hosted `.task` model file.

If you want to bundle the model locally, place it here:

```
public/models/hand_landmarker.task
```

and update `MODEL_URL` in:

```
src/shared/hand/handTracker.js
```

---

## License

MIT — see `LICENSE`.
