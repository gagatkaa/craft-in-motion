// Particles visual that follows the SAME ML-tempo plumbing as the pulse circle:
// - listens for window.postMessage({ type:'ml:tempo', hz })
// - exposes window.setTempoHz(hz) for manual triggering
// - smoothStep + idleRelax back to REST_HZ when no new data arrives
// - uses gsap.ticker with lag smoothing disabled in index.html

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const tempoVal = document.getElementById("tempoVal");
const EMISSION_MULT = 2.0; // 1.0 default - increase for more particles
const MAX_PARTICLES = 1500; // safety cap - set higher if you want more

// --- sizing ---
function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
addEventListener("resize", resize);
resize();

// --- state ---
let tempoHz = 2.0; // smoothed tempo (Hz), matches the circle logic
let lastUpdate = performance.now();
const MIN_HZ = 0.3,
  MAX_HZ = 6.0;
const REST_HZ = 1.2; // fallback when idle (same spirit as circle)

// gentle one-sided smoothing (rise slower, fall faster)
function smoothStep(current, target) {
  const alphaUp = 0.55;
  const alphaDown = 0.85;
  const a = target < current ? alphaDown : alphaUp;
  return current + a * (target - current);
}

function mapRange(inMin, inMax, outMin, outMax, v) {
  const t = Math.min(Math.max((v - inMin) / (inMax - inMin), 0), 1);
  return outMin + t * (outMax - outMin);
}

// External setter (used by ML pipeline or manual testing)
function setTempoHz(hz) {
  const clamped = Math.max(MIN_HZ, Math.min(MAX_HZ, hz || 0));
  tempoHz = smoothStep(tempoHz, clamped);
  lastUpdate = performance.now();
  if (tempoVal) tempoVal.textContent = tempoHz.toFixed(2);
}
window.setTempoHz = setTempoHz;

// If ML goes quiet, slowly relax tempo back to REST_HZ
function idleRelax() {
  const now = performance.now();
  if (now - lastUpdate > 400) {
    tempoHz = smoothStep(tempoHz, REST_HZ);
    if (tempoVal) tempoVal.textContent = tempoHz.toFixed(2);
  }
}

// Listen for cross-window PoseNet messages (same key as circle)
addEventListener("message", (e) => {
  if (e?.data?.type === "ml:tempo" && Number.isFinite(e.data.hz)) {
    setTempoHz(e.data.hz);
  }
});
// Also support same-window custom event (optional)
addEventListener("ml:tempo", (e) => {
  if (e?.detail?.hz != null) setTempoHz(e.detail.hz);
});

// ---- particles system ----
const particles = [];
const center = { x: innerWidth * 0.5, y: innerHeight * 0.6 };

// Map ML tempo to particle params
function paramsFromTempo(tHz) {
  // clamp to expected tempo range
  const t = Math.min(Math.max(tHz, MIN_HZ), MAX_HZ);

  // emission rate in particles / second (frame-rate independent)
  const emission = mapRange(MIN_HZ, MAX_HZ, 8, 140, t) * EMISSION_MULT;

  // particle size
  const size = mapRange(MIN_HZ, MAX_HZ, 2, 6, t);

  // lifetime (seconds)
  const life = mapRange(MIN_HZ, MAX_HZ, 1.2, 0.45, t);

  // brightness 0..1 (drives color & glow)
  const brightness = mapRange(MIN_HZ, MAX_HZ, 0.5, 1.0, t);

  // base speed (px/s)
  const speed = mapRange(MIN_HZ, MAX_HZ, 60, 220, t);

  return { emission, size, life, brightness, speed };
}

function spawnParticle(par) {
  const angle = Math.random() * Math.PI * 2;
  const speed = par.speed * (0.6 + Math.random() * 0.8); // some variance
  particles.push({
    x: center.x,
    y: center.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: par.size * (0.7 + Math.random() * 0.6),
    life: par.life,
    age: 0,
    brightness: par.brightness,
  });
}

// Frame-rate independent emission using an accumulator
let emitAcc = 0;

gsap.ticker.add(() => {
  idleRelax();

  const dr = gsap.ticker.deltaRatio(); // how much slower/faster than 60fps
  const dt = dr / 60; // seconds elapsed this tick
  const par = paramsFromTempo(tempoHz);

  // emission in particles/sec -> particles this frame
  emitAcc += par.emission * dt;
  while (emitAcc >= 1) {
    if (particles.length < MAX_PARTICLES) spawnParticle(par);
    emitAcc -= 1;
  }

  // update
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += dt;
    if (p.age >= p.life) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }

  // render
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const a = 1 - p.age / p.life; // fade out

    // warm color biased by brightness
    const b = p.brightness;
    const r = Math.floor(255 * b);
    const g = Math.floor(200 * b);
    const bl = Math.floor(120 * b);

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.shadowBlur = 18 * b;
    ctx.shadowColor = `rgba(${r},${g},${bl},0.9)`;
    ctx.fillStyle = `rgba(${r},${g},${bl},${a})`;
    ctx.fill();
    ctx.shadowBlur = 0;
  }
});

// small idle bob for the emission center
gsap.to(center, {
  y: "+=4",
  duration: 1.2,
  yoyo: true,
  repeat: -1,
  ease: "sine.inOut",
});
