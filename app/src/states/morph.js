gsap.registerPlugin(MorphSVGPlugin);

const tlPrologue = gsap.timeline({
  paused: true,
  defaults: { ease: "power2.inOut" },
});

tlPrologue.to("#prologueCircle", {
  duration: 1.0,
  morphSVG: "#prologueShakerPath",
});

let prologueOpen = false;
const prologueSvg = document.querySelector("#prologueMorph");

if (prologueSvg) {
  prologueSvg.addEventListener("click", () => {
    prologueOpen ? tlPrologue.reverse() : tlPrologue.play(0);
    prologueOpen = !prologueOpen;
  });
}
