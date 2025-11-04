gsap.registerPlugin(ScrollTrigger);

gsap.timeline({ delay: 0.3 }).to(".intro h1", {
  opacity: 1,
  y: 0,
  duration: 1.2,
  stagger: 0.45,
  ease: "power2.out",
});

// --- STARTING POSITIONS ---
// top-left group
gsap.set("#b1", { top: "10%", left: "10%" });
gsap.set("#b2", { top: "15%", left: "20%" });
gsap.set("#b3", { top: "5%", left: "25%" });

// bottom-right group
gsap.set("#b4", { bottom: "10%", right: "10%" });
gsap.set("#b5", { bottom: "15%", right: "20%" });
gsap.set("#b6", { bottom: "5%", right: "25%" });

// --- blob drifting animation ---
gsap.to("#b1", {
  x: 400,
  y: 300,
  duration: 10,
  repeat: -1,
  yoyo: true,
  ease: "sine.inOut",
});
gsap.to("#b2", {
  x: 200,
  y: 400,
  duration: 12,
  repeat: -1,
  yoyo: true,
  ease: "sine.inOut",
});
gsap.to("#b3", {
  x: 600,
  y: 500,
  duration: 14,
  repeat: -1,
  yoyo: true,
  ease: "sine.inOut",
});

gsap.to("#b4", {
  x: -200,
  y: -300,
  duration: 10,
  repeat: -1,
  yoyo: true,
  ease: "sine.inOut",
});
gsap.to("#b5", {
  x: -300,
  y: -400,
  duration: 12,
  repeat: -1,
  yoyo: true,
  ease: "sine.inOut",
});
gsap.to("#b6", {
  x: -400,
  y: -500,
  duration: 14,
  repeat: -1,
  yoyo: true,
  ease: "sine.inOut",
});

gsap.to(".bg", {
  opacity: 0.7,
  duration: 6,
  yoyo: true,
  repeat: -1,
  ease: "sine.inOut",
});

const steps = gsap.utils.toArray(".step");
steps.forEach((el) => {
  const from = el.dataset.from || "left";
  const vars = { opacity: 0 };
  if (from === "left") vars.x = -220;
  if (from === "right") vars.x = 220;
  if (from === "bottom") vars.y = 120;

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: el,
      start: "top 85%",
      end: "top 50%",
      scrub: 0.8,
      // markers: true,
    },
  });

  tl.fromTo(el, vars, { x: 0, y: 0, opacity: 1, ease: "none" });
});

gsap.to(".intro", {
  yPercent: -8,
  ease: "none",
  scrollTrigger: {
    trigger: ".hero",
    start: "top top",
    end: "bottom top",
    scrub: true,
  },
});
const sound = new Audio("src/audio/bar-sounds.mp3");
sound.loop = true;
const btn = document.getElementById("soundButton");

btn.addEventListener("click", () => {
  if (sound.paused) {
    sound.play();
    btn.textContent = "Pause Sound";
  } else {
    sound.pause();
    btn.textContent = "Play Sound";
  }
});
