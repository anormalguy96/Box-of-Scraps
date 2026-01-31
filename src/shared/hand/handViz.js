const CONNECTIONS = [
  // thumb
  [0, 1], [1, 2], [2, 3], [3, 4],
  // index
  [0, 5], [5, 6], [6, 7], [7, 8],
  // middle
  [0, 9], [9, 10], [10, 11], [11, 12],
  // ring
  [0, 13], [13, 14], [14, 15], [15, 16],
  // pinky
  [0, 17], [17, 18], [18, 19], [19, 20],
  // palm
  [5, 9], [9, 13], [13, 17], [17, 5],
];

function toXY(p, w, h, mirrorX) {
  const x = (mirrorX ? (1 - p.x) : p.x) * w;
  const y = p.y * h;
  return { x, y };
}

export function drawHandSkeleton(ctx, allLandmarks, w, h, opts = {}) {
  if (!allLandmarks || allLandmarks.length === 0) return;
  const lm = allLandmarks[0];
  if (!lm || lm.length < 21) return;

  const mirrorX = opts.mirrorX ?? true;
  const lineW = opts.lineWidth ?? 2;
  const jointR = opts.jointRadius ?? 3.5;
  const lineColor = opts.lineColor ?? "rgba(125,249,255,.55)";
  const jointColor = opts.jointColor ?? "rgba(125,249,255,.95)";
  const glowColor = opts.glowColor ?? "rgba(125,249,255,.35)";

  // glow pass
  ctx.save();
  ctx.lineWidth = lineW + 1.5;
  ctx.strokeStyle = glowColor;
  ctx.shadowBlur = 14;
  ctx.shadowColor = glowColor;
  ctx.beginPath();
  for (const [a, b] of CONNECTIONS) {
    const A = toXY(lm[a], w, h, mirrorX);
    const B = toXY(lm[b], w, h, mirrorX);
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
  }
  ctx.stroke();
  ctx.restore();

  // main lines
  ctx.save();
  ctx.lineWidth = lineW;
  ctx.strokeStyle = lineColor;
  ctx.beginPath();
  for (const [a, b] of CONNECTIONS) {
    const A = toXY(lm[a], w, h, mirrorX);
    const B = toXY(lm[b], w, h, mirrorX);
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
  }
  ctx.stroke();
  ctx.restore();

  // joints
  ctx.save();
  ctx.fillStyle = jointColor;
  ctx.shadowBlur = 10;
  ctx.shadowColor = glowColor;
  for (let i = 0; i < 21; i++) {
    const P = toXY(lm[i], w, h, mirrorX);
    ctx.beginPath();
    ctx.arc(P.x, P.y, jointR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}