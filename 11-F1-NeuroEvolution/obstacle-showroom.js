// Vitrine des obstacles (fenêtre du menu) : obstacles de série et prototypes
// dessinés (proto_1, proto_2…). Deux modes :
//  - « place » : choisir un obstacle puis le poser au clic sur le circuit ;
//  - « random » : indiquer combien de chaque obstacle placer au hasard.
const OBSTACLE_THUMB_SIZE = 150;   // px du canevas de chaque carte
const RANDOM_COUNT_MAX = 10;       // nombre maximal par obstacle en mode hasard

// ---------- Fonctions pures (testées) ----------

// Forme du modèle dans le canevas de la carte : centrée sur sa boîte
// englobante, plus grande dimension = size × (1 − 2 × margin).
function thumbnailPoints(model, size = OBSTACLE_THUMB_SIZE, margin = 0.15) {
  const shape = normalizeShape(model.points, size * (1 - 2 * margin), 1);
  const xs = shape.map((p) => p[0]);
  const ys = shape.map((p) => p[1]);
  const dx = size / 2 - (Math.min(...xs) + Math.max(...xs)) / 2;
  const dy = size / 2 - (Math.min(...ys) + Math.max(...ys)) / 2;
  return shape.map(([x, y]) => [x + dx, y + dy]);
}

// Valeur saisie → entier entre 0 et RANDOM_COUNT_MAX.
function clampCount(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(RANDOM_COUNT_MAX, n);
}

function randomButtonLabel(total) {
  if (total === 0) return "Choisissez au moins un obstacle";
  const capped = Math.min(total, RANDOM_OBSTACLES_MAX);
  return `Placer ${capped} obstacle${capped > 1 ? "s" : ""} au hasard` +
    (total > RANDOM_OBSTACLES_MAX ? ` (${RANDOM_OBSTACLES_MAX} au maximum)` : "");
}

function obstacleCardFacts(model) {
  return `${model.builtIn ? "série" : "prototype dessiné"} · ${model.sizeMeters} m · ${model.points.length} sommets`;
}

// ---------- Interface (navigateur) ----------

class ObstacleShowroom {
  // options : { dialog, grid, hint, status, placeModeButton, randomModeButton,
  //             randomBar, randomButton, drawButton, catalog: () => modèles,
  //             onPlace(model), onRandom([{ model, count }]), onDraw(), onRemove(model) }
  constructor(options) {
    this.options = options;
    this.mode = "place";
    this.highlightId = null;
    this.counts = new Map();   // id du modèle → nombre demandé en mode hasard
    options.placeModeButton.addEventListener("click", () => this.setMode("place"));
    options.randomModeButton.addEventListener("click", () => this.setMode("random"));
    options.drawButton.addEventListener("click", () => options.onDraw());
    options.randomButton.addEventListener("click", () => {
      const requests = this.requests();
      if (requests.length === 0) return;
      this.close();
      options.onRandom(requests);
    });
  }

  open(mode = "place", highlightId = null) {
    this.mode = mode;
    this.highlightId = highlightId;
    this.showStatus("");
    this.render();
    if (!this.options.dialog.open) this.options.dialog.showModal();
  }

  close() {
    this.options.dialog.close();
  }

  setMode(mode) {
    this.mode = mode;
    this.render();
  }

  showStatus(text) {
    this.options.status.textContent = text;
  }

  setCount(id, value) {
    this.counts.set(id, clampCount(value));
    this.updateRandomButton();
  }

  // Demandes du mode hasard, dans l'ordre de la vitrine.
  requests() {
    return this.options.catalog()
      .map((model) => ({ model, count: this.counts.get(model.id) ?? 0 }))
      .filter((r) => r.count > 0);
  }

  total() {
    return this.requests().reduce((sum, r) => sum + r.count, 0);
  }

  updateRandomButton() {
    const total = this.total();
    this.options.randomButton.textContent = randomButtonLabel(total);
    this.options.randomButton.disabled = total === 0;
  }

  render() {
    const { grid, hint, randomBar, placeModeButton, randomModeButton } = this.options;
    const random = this.mode === "random";
    placeModeButton.setAttribute("aria-pressed", String(!random));
    randomModeButton.setAttribute("aria-pressed", String(random));
    randomBar.hidden = !random;
    hint.textContent = random
      ? `Indiquez combien de chaque obstacle placer (${RANDOM_OBSTACLES_MAX} au maximum). Ils sont posés sur la piste, hors zone de départ, en laissant toujours un passage d'au moins ${PASSAGE_CAR_WIDTHS} largeurs de voiture.`
      : "Choisissez un obstacle, puis cliquez sur le circuit pour le poser (R : tourner, Échap : annuler).";
    grid.replaceChildren();
    const catalog = this.options.catalog();
    for (const id of [...this.counts.keys()]) {
      if (!catalog.some((m) => m.id === id)) this.counts.delete(id); // prototype retiré
    }
    for (const model of catalog) grid.appendChild(this.buildCard(model));
    this.updateRandomButton();
  }

  buildCard(model) {
    const card = document.createElement("article");
    card.className = "obstacle-card";
    if (model.id === this.highlightId) card.classList.add("selected");
    const canvas = document.createElement("canvas");
    canvas.width = OBSTACLE_THUMB_SIZE;
    canvas.height = OBSTACLE_THUMB_SIZE;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `Forme de l'obstacle ${model.name}`);
    drawObstacleThumbnail(canvas.getContext("2d"), model);
    const title = document.createElement("h3");
    title.textContent = model.name;
    const facts = document.createElement("p");
    facts.className = "facts";
    facts.textContent = obstacleCardFacts(model);
    card.append(canvas, title, facts);
    if (this.mode === "random") card.appendChild(this.buildCountInput(model));
    else card.appendChild(this.buildPlaceButton(model));
    if (!model.builtIn) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "small";
      remove.textContent = "Retirer de la vitrine";
      remove.addEventListener("click", () => {
        this.options.onRemove(model);
        this.showStatus(`${model.name} retiré de la vitrine.`);
        this.render();
      });
      card.appendChild(remove);
    }
    return card;
  }

  buildPlaceButton(model) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "select-car";
    button.textContent = "Placer sur le circuit";
    button.addEventListener("click", () => {
      this.close();
      this.options.onPlace(model);
    });
    return button;
  }

  // Nombre à placer : réagit pendant la saisie (événement input).
  buildCountInput(model) {
    const wrapper = document.createElement("label");
    wrapper.className = "obstacle-count";
    wrapper.textContent = "Nombre : ";
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = String(RANDOM_COUNT_MAX);
    input.step = "1";
    input.value = String(this.counts.get(model.id) ?? 0);
    input.setAttribute("aria-label", `Nombre de ${model.name} à placer au hasard`);
    input.addEventListener("input", () => this.setCount(model.id, input.value));
    input.addEventListener("change", () => { input.value = String(this.counts.get(model.id) ?? 0); });
    wrapper.appendChild(input);
    return wrapper;
  }
}

// Miniature : fond de piste, obstacle rouge à bord sombre.
function drawObstacleThumbnail(ctx, model, size = OBSTACLE_THUMB_SIZE) {
  const points = thumbnailPoints(model, size);
  ctx.fillStyle = "#3e4044";
  ctx.fillRect(0, 0, size, size);
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fillStyle = "#e1281e";
  ctx.fill();
  ctx.strokeStyle = "#141414";
  ctx.lineWidth = 2;
  ctx.stroke();
}
