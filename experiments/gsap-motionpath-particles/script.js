const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
function resize() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
addEventListener("resize", resize);
resize();

const particles = [];
const center = { x: innerWidth * 0.5, y: innerHeight * 0.6 };

const tempoEl = document.getElementById("tempo");
const tempoVal = document.getElementById("tempoVal");
let mlTempoHz = parseFloat(tempoEl.value);

tempoEl.addEventListener("input", () => {
  mlTempoHz = parseFloat(tempoEl.value);
  tempoVal.textContent = mlTempoHz.toFixed(1);
  gsap.fromTo(
    tempoVal,
    { scale: 1.2 },
    { scale: 1, duration: 0.25, ease: "power2.out" }
  );
});

function mapMlToParams(tempoHz) {
  const t = gsap.utils.clamp(0.5, 5.0, tempoHz);

  const emission = gsap.utils.mapRange(0.5, 5.0, 2, 18, t);

  const size = gsap.utils.mapRange(0.5, 5.0, 2, 6, t);

  const life = gsap.utils.mapRange(0.5, 5.0, 1.2, 0.45, t);

  const brightness = gsap.utils.mapRange(0.5, 5.0, 0.5, 1.0, t);

  const speed = gsap.utils.mapRange(0.5, 5.0, 1.5, 5.0, t);

  return { emission, size, life, brightness, speed };
}

function spawnParticle(params) {
  const angle = Math.random() * Math.PI * 2;
  const speed = params.speed * (0.6 + Math.random() * 0.8);

  particles.push({
    x: center.x,
    y: center.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: params.size * (0.7 + Math.random() * 0.6),
    life: params.life,
    age: 0,
    brightness: params.brightness,
  });
}

gsap.ticker.add(() => {
  const { emission } = mapMlToParams(mlTempoHz);

  for (let i = 0; i < emission; i++) spawnParticle(mapMlToParams(mlTempoHz));

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age += gsap.ticker.deltaRatio() / 60;
    if (p.age >= p.life) {
      particles.splice(i, 1);
      continue;
    }

    p.x += p.vx;
    p.y += p.vy;

    const a = 1 - p.age / p.life;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);

    const b = p.brightness;
    ctx.fillStyle = `rgba(${Math.floor(255 * b)}, ${Math.floor(
      210 * b
    )}, ${Math.floor(120 * b)}, ${a})`;
    ctx.shadowBlur = 18 * b;

    const r = Math.floor(255 * b);
    const g = Math.floor((210 - 60 * b) * b);
    const bl = Math.floor((120 - 90 * b) * b);
    ctx.shadowColor = `rgba(${r}, ${g}, ${bl}, 0.9)`;
    ctx.fillStyle = `rgba(${r}, ${g}, ${bl}, ${a})`;
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
