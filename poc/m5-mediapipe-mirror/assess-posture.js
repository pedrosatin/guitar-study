export function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z || 0) - (b.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function angleDeg(a, b) {
  return Math.atan2(a.y - b.y, a.x - b.x) * 180 / Math.PI;
}

export function assessPosture(landmarks) {
  const handCentered =
    landmarks[0].x > 0.3 && landmarks[0].x < 0.7 &&
    landmarks[9].x > 0.3 && landmarks[9].x < 0.7;

  const dFingersTip = dist(landmarks[8], landmarks[12]);
  const dFingersBase = dist(landmarks[5], landmarks[9]);
  const fingerSpread = dFingersBase > 0 ? dFingersTip / dFingersBase : 0;
  const fingersOk = fingerSpread > 0.3;

  const thumbAngle = angleDeg(landmarks[4], landmarks[2]);
  const thumbOk = thumbAngle > -45 && thumbAngle < 45;

  return {
    handCentered,
    fingersOk,
    thumbOk,
    fingerSpread,
    thumbAngle
  };
}