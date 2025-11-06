gsap.registerPlugin(Flip);
const grid = document.getElementById("grid");

function hydrate(el) {
  const t = el.dataset.title;
  const d = el.dataset.text;
  const g = (el.dataset.grade || "B").toUpperCase();
  el.innerHTML = `
        <div class="preview" aria-hidden="false">
          <div class="title">${t}</div>
          <div class="grade ${g}" aria-label="grade ${g}">${g}</div>
        </div>
        <div class="details" aria-hidden="true">
          <div class="head">
            <span class="chip ${g}" aria-label="grade ${g}">${g}</span>
            <div class="ttl">${t}</div>
          </div>
          <p class="desc">${d}</p>
        </div>
      `;
}
[...grid.children].forEach(hydrate);

let active = null;

function flipWith(mut) {
  const tiles = [...grid.children];
  const state = Flip.getState(tiles);
  mut();
  Flip.from(state, {
    duration: 0.45,
    ease: "power2.inOut",
    absolute: true,
    scale: false,
    stagger: 0.012,
  });
}

function openTile(tile) {
  if (active === tile) {
    closeActive();
    return;
  }
  flipWith(() => {
    if (active) active.classList.remove("is-localwide", "show-details");
    tile.classList.add("is-localwide");
  });

  gsap.delayedCall(0.46, () => tile.classList.add("show-details"));
  active = tile;
}

function closeActive() {
  if (!active) return;
  const t = active;
  flipWith(() => t.classList.remove("is-localwide", "show-details"));
  active = null;
}

grid.addEventListener("click", (e) => {
  const t = e.target.closest(".tile");
  if (!t) return;
  openTile(t);
});

grid.addEventListener("keydown", (e) => {
  const t = e.target.closest(".tile");
  if (!t) return;
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    openTile(t);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeActive();
});
