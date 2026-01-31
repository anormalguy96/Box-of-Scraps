let pinchOn = false;

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function isFingerOpen(lm, tip, pip) {
  // y axis is top→down in video coords
  return (lm[tip].y + 0.01) < lm[pip].y;
}

export function classifyGesture(allLandmarks) {
  if (!allLandmarks || allLandmarks.length === 0) {
    return {
      name: "none",
      point: false,
      pinch: false,
      openPalm: false,
      wrist: null,
      cursor: null,
    };
  }

  const lm = allLandmarks[0];
  if (!lm || lm.length < 21) {
    return {
      name: "none",
      point: false,
      pinch: false,
      openPalm: false,
      wrist: null,
      cursor: null,
    };
  }

  const wrist = lm[0];
  const indexTip = lm[8];
  const thumbTip = lm[4];

  // scale distances by palm size (more stable across hands)
  const palmSize = Math.max(0.0001, dist(lm[0], lm[9]));
  const pinchRatio = dist(thumbTip, indexTip) / palmSize;

  const indexOpen = isFingerOpen(lm, 8, 6);
  const middleOpen = isFingerOpen(lm, 12, 10);
  const ringOpen = isFingerOpen(lm, 16, 14);
  const pinkyOpen = isFingerOpen(lm, 20, 18);

  // point = index open, others mostly closed
  const point = indexOpen && !middleOpen && !ringOpen && !pinkyOpen;

  // open palm = four fingers open (thumb optional)
  const openPalm = indexOpen && middleOpen && ringOpen && pinkyOpen;

  // pinch hysteresis
  const PINCH_ON = 0.22;
  const PINCH_OFF = 0.30;
  if (!pinchOn && pinchRatio < PINCH_ON) pinchOn = true;
  else if (pinchOn && pinchRatio > PINCH_OFF) pinchOn = false;

  const pinch = pinchOn;

  let name = "none";
  if (pinch) name = "pinch";
  else if (point) name = "point";
  else if (openPalm) name = "open_palm";

  return {
    name,
    point,
    pinch,
    openPalm,
    wrist,
    cursor: indexTip,
  };
}
