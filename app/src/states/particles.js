// src/states/particles.js

const particleCanvas = document.getElementById("particles-canvas");
if (!particleCanvas) {
  console.warn("particles-canvas not found");
} else {
  const ctx = particleCanvas.getContext("2d");
  const tempoVal = document.getElementById("tempoVal");
  const EMISSION_MULT = 2.0;
  const MAX_PARTICLES = 1500;


  const BASE_WIDTH = 640;
  const BASE_HEIGHT = 480;

  const center = { x: BASE_WIDTH * 0.5, y: BASE_HEIGHT * 0.6 };

  function resizeParticlesCanvas() {

    const wrapper = particleCanvas.parentElement;
    const rect = wrapper.getBoundingClientRect();

    let w = rect.width || BASE_WIDTH;
    let h = rect.height || BASE_HEIGHT;

    particleCanvas.width = w;
    particleCanvas.height = h;

    center.x = w * 0.5;
    center.y = h * 0.6;
  }
  function setParticleCenterNorm(nx, ny) {

    if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;

    const x = nx * particleCanvas.width;
    const y = ny * particleCanvas.height;

    center.x = x;
    center.y = y;
  }


  window.setParticleCenterNorm = setParticleCenterNorm;

  window.addEventListener("load", resizeParticlesCanvas);
  window.addEventListener("resize", resizeParticlesCanvas);
  resizeParticlesCanvas();

  let tempoHz = 2.0;
  let lastUpdate = performance.now();
  const MIN_HZ = 0.3;
  const MAX_HZ = 6.0;
  const REST_HZ = 1.2;

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

  function setTempoHz(hz) {
    const clamped = Math.max(MIN_HZ, Math.min(MAX_HZ, hz || 0));
    tempoHz = smoothStep(tempoHz, clamped);
    lastUpdate = performance.now();
    if (tempoVal) tempoVal.textContent = tempoHz.toFixed(2);
  }
  window.setTempoHz = setTempoHz;

  function idleRelax() {
    const now = performance.now();
    if (now - lastUpdate > 400) {
      tempoHz = smoothStep(tempoHz, REST_HZ);
      if (tempoVal) tempoVal.textContent = tempoHz.toFixed(2);
    }
  }

  window.addEventListener("message", (e) => {
    if (e?.data?.type === "ml:tempo" && Number.isFinite(e.data.hz)) {
      setTempoHz(e.data.hz);
    }
  });

  window.addEventListener("ml:tempo", (e) => {
    if (e?.detail?.hz != null) setTempoHz(e.detail.hz);
  });

  const particles = [];
  let emitAcc = 0;

  function paramsFromTempo(tHz) {
    const t = Math.min(Math.max(tHz, MIN_HZ), MAX_HZ);

    const emission = mapRange(MIN_HZ, MAX_HZ, 8, 140, t) * EMISSION_MULT;
    const size = mapRange(MIN_HZ, MAX_HZ, 2, 6, t);
    const life = mapRange(MIN_HZ, MAX_HZ, 1.2, 0.45, t);
    const brightness = mapRange(MIN_HZ, MAX_HZ, 0.5, 1.0, t);
    const speed = mapRange(MIN_HZ, MAX_HZ, 60, 220, t);

    return { emission, size, life, brightness, speed };
  }

  function spawnParticle(par) {
    const angle = Math.random() * Math.PI * 2;
    const speed = par.speed * (0.6 + Math.random() * 0.8);
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

  gsap.ticker.add(() => {
    idleRelax();

    const dr = gsap.ticker.deltaRatio();
    const dt = dr / 60;
    const par = paramsFromTempo(tempoHz);

    emitAcc += par.emission * dt;
    while (emitAcc >= 1) {
      if (particles.length < MAX_PARTICLES) spawnParticle(par);
      emitAcc -= 1;
    }

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

    ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const a = 1 - p.age / p.life;

      const b = p.brightness;
      const r = Math.floor(138 * b);
      const g = Math.floor(43 * b);
      const bl = Math.floor(226 * b);

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.shadowBlur = 18 * b;
      ctx.shadowColor = `rgba(${r},${g},${bl},0.9)`;
      ctx.fillStyle = `rgba(${r},${g},${bl},${a})`;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  });

  gsap.to(center, {
    y: "+=4",
    duration: 1.2,
    yoyo: true,
    repeat: -1,
    ease: "sine.inOut",
  });
}
