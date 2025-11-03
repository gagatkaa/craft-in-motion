const tl = gsap.timeline({ delay: 0.5 });
tl.to(".text h1", {
  opacity: 1,
  y: 0,
  duration: 1.2,
  stagger: 0.4,
  ease: "power2.out",
});

// top-left group
gsap.set("#b1", { top: "10%", left: "10%" });
gsap.set("#b2", { top: "15%", left: "20%" });
gsap.set("#b3", { top: "5%", left: "25%" });

// bottom-right group
gsap.set("#b4", { bottom: "10%", right: "10%" });
gsap.set("#b5", { bottom: "15%", right: "20%" });
gsap.set("#b6", { bottom: "5%", right: "25%" });

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

gsap.to(".blobs", {
  opacity: 0.5,
  duration: 6,
  yoyo: true,
  repeat: -1,
  ease: "sine.inOut",
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
