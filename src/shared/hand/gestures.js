// Very lightweight, “good enough for demos” gesture heuristics over 21 hand landmarks.
// Landmarks are normalized coordinates (x,y in [0..1]), y increases downward.

function dist(a,b){
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function fingerExtended(lm, tip, pip){
  return lm[tip].y < lm[pip].y;
}

function thumbExtended(lm){
  // crude: thumb tip farther from index MCP than thumb IP is
  return dist(lm[4], lm[5]) > dist(lm[3], lm[5]) * 1.05;
}

export function classifyGesture(landmarks){
  if(!landmarks || landmarks.length === 0) return { name: "none" };
  const lm = landmarks[0];

  const idx = fingerExtended(lm, 8, 6);
  const mid = fingerExtended(lm, 12, 10);
  const ring = fingerExtended(lm, 16, 14);
  const pink = fingerExtended(lm, 20, 18);
  const th = thumbExtended(lm);

  const pinch = dist(lm[4], lm[8]) < 0.055; // tune for your camera
  const openPalm = th && idx && mid && ring && pink;
  const point = idx && !mid && !ring && !pink;
  const fist = !idx && !mid && !ring && !pink && !th;

  // Useful “cursor”: index tip (8) or pinch midpoint
  const pinchPoint = { x: (lm[4].x + lm[8].x)/2, y: (lm[4].y + lm[8].y)/2 };

  let name = "unknown";
  if(pinch) name = "pinch";
  else if(openPalm) name = "open_palm";
  else if(point) name = "point";
  else if(fist) name = "fist";

  return {
    name,
    pinch,
    openPalm,
    point,
    fist,
    fingers: { thumb: th, index: idx, middle: mid, ring, pinky: pink },
    cursor: pinch ? pinchPoint : { x: lm[8].x, y: lm[8].y },
    wrist: { x: lm[0].x, y: lm[0].y },
  };
}
