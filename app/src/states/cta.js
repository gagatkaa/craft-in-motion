gsap.registerPlugin(ScrollTrigger, TextPlugin);

// Pinned master timeline
const tl = gsap.timeline({
  scrollTrigger: {
    trigger: "#ctaStage",
    start: "top top",
    end: "+=1700",
    scrub: 0.7,
    pin: true,
    anticipatePin: 1,
    // markers: true,
  },
});

// Blobs color ramp
tl.to(
  ":root",
  {
    "--overlay-opacity": 1,
    "--overlay-blur": "2px",
    "--blob-sat": 2.4,
    "--blob-opacity": 0.7,
    duration: 0.7,
    ease: "power2.out",
  },
  0
).to(
  ":root",
  {
    "--blob-hue": "250deg",
    "--blob-bright": 1.15,
    duration: 2.0,
    ease: "none",
  },
  0.1
);

gsap.set("#ctaText", { text: "" });
tl.to(
  "#ctaText",
  { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: "power2.out" },
  0.6
)
  .to(
    "#ctaText",
    {
      text: "Are you ready to try it for yourself ?",
      duration: 1.0,
      ease: "none",
    },
    0.62
  )
  .to("#ctaBtn", { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" }, 0.85);

tl.to(
  "#ordersCaption",
  { opacity: 1, y: 0, duration: 0.35, ease: "power2.out" },
  1.05
);

const tickets = gsap.utils.toArray("#ticketsGrid .ticket");
tl.to(
  tickets,
  {
    y: 0,
    opacity: 1,
    duration: 0.9,
    ease: "power2.out",
    stagger: { each: 0.14 },
  },
  1.12
)
  .to(tickets, { y: "+=6", duration: 0.2 }, ">")
  .to(tickets, { y: "-=6", duration: 0.25 }, ">");

document
  .getElementById("ctaBtn")
  .addEventListener("click", () => alert("Proceed to interaction"));
