const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const tempoVal = document.getElementById("tempoVal");

// --- sizing ---
function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
addEventListener("resize", resize);
resize();

// --- state ---
let tempoHz = 2.0; // current smoothed tempo (Hz)
let flash = 0; // chwilowy błysk/glow po nowym sygnale
let pulseScale = 0; // chwilowe powiększenie po nowym sygnale
let lastUpdate = performance.now(); // last time we got a tempo from ML
let radius = 60; // current drawn radius (px)

// ranges
const MIN_HZ = 0.3,
  MAX_HZ = 6.0; // expected wrist tempo range
const MIN_R = 40,
  MAX_R = 220; // circle radius range
const REST_HZ = 1.2; // gentle “calm” fallback when idle

// smoothing: rise slower, fall faster (feels snappy when you stop)
function smoothStep(current, target) {
  const alphaUp = 0.55; // było 0.3
  const alphaDown = 0.85; // było 0.6
  const a = target < current ? alphaDown : alphaUp;
  return current + a * (target - current);
}

// map helper
function mapRange(inMin, inMax, outMin, outMax, v) {
  const t = Math.min(Math.max((v - inMin) / (inMax - inMin), 0), 1);
  return outMin + t * (outMax - outMin);
}

// set tempo from ML
function setTempoHz(hz) {
  const clamped = Math.max(MIN_HZ, Math.min(MAX_HZ, hz || 0));
  tempoHz = smoothStep(tempoHz, clamped);
  lastUpdate = performance.now();
  if (tempoVal) tempoVal.textContent = tempoHz.toFixed(2);
  flash = Math.min(flash + 0.5, 1);
  pulseScale = Math.min(pulseScale + 0.22, 0.6);
}
window.setTempoHz = setTempoHz; // optional for manual testing

// if ML stops sending, relax back toward REST_HZ
function idleRelax() {
  const now = performance.now();
  if (now - lastUpdate > 400) {
    tempoHz = smoothStep(tempoHz, REST_HZ);
    if (tempoVal) tempoVal.textContent = tempoHz.toFixed(2);
  }
}

// listen to PoseNet iframe
window.addEventListener("message", (e) => {
  if (e?.data?.type === "ml:tempo") setTempoHz(e.data.hz);
});
// also support same-window custom event (optional)
window.addEventListener("ml:tempo", (e) => {
  if (e?.detail?.hz != null) setTempoHz(e.detail.hz);
});

// draw loop
gsap.ticker.add(() => {
  idleRelax();

  const dr = gsap.ticker.deltaRatio();

  // compute target radius & color from CURRENT tempo
  const targetRRaw = mapRange(MIN_HZ, MAX_HZ, MIN_R, MAX_R, tempoHz);
  const targetR = Math.min(MAX_R, Math.max(MIN_R, targetRRaw));

  // ease radius so it feels organic
  radius += (targetR - radius) * (0.35 * dr);
  radius = Math.max(8, radius); // clamp po aktualizacji

  // color hue: slow = blue (180), fast = red (20)
  const hue = mapRange(MIN_HZ, MAX_HZ, 180, 20, tempoHz);
  const baseFill = `hsl(${hue}, 80%, 55%)`;
  const glowBoost = flash * 0.35; // chwilowe podbicie światła
  const fill = baseFill;

  // clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // center
  const cx = canvas.width * 0.5;
  const cy = canvas.height * 0.55;

  // subtle breathing even when idle
  const pulse = Math.sin(performance.now() / 500) * 2;

  // --- safety clamps przed rysowaniem ---
  if (!Number.isFinite(radius)) radius = MIN_R; // awaryjnie, gdyby kiedyś wpadło NaN
  const safeR = Math.max(8, radius); // min 8px, żeby nie było 0/ujemnych
  const glowRadius = Math.max(8, radius + 10 + pulse); // dla glow
  const drawRadius = Math.max(8, safeR * (1 + pulseScale)); // dla „solid” z pulsem

  // draw glow
  ctx.beginPath();
  ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
  ctx.shadowBlur = 40 + glowBoost * 60; // 40..100
  ctx.shadowColor = fill;
  ctx.globalAlpha = 0.65 + glowBoost * 0.3; // 0.65..0.95
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  // draw solid circle (+ puls po nowej próbce)
  ctx.beginPath();
  ctx.arc(cx, cy, drawRadius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();

  // optional stroke that tightens with speed
  ctx.lineWidth = mapRange(MIN_HZ, MAX_HZ, 2, 8, tempoHz);
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.stroke();

  // szybkie wygaszanie błysku i pulsu, stabilne względem FPS
  flash *= Math.pow(0.35, dr);
  pulseScale *= Math.pow(0.25, dr);
});
