// Vitrine des circuits : chaque circuit (F1 puis niveaux d'entraînement) est
// présenté par une miniature du tracé et sa fiche ; « Choisir ce circuit »
// le charge. Remplace l'ancienne liste déroulante.
const CIRCUIT_THUMB_WIDTH = 240;
const CIRCUIT_THUMB_HEIGHT = 152;

// ---------- Fonctions pures (testées) ----------

// Tous les circuits, dans l'ordre d'affichage : [{ key, name, group, layout }].
function allCircuitEntries() {
  return [
    ...Object.keys(F1_CIRCUITS).map((key) => ({ key, name: F1_CIRCUITS[key].name, group: "Formule 1", layout: F1_CIRCUITS[key] })),
    ...trainingLevelKeys().map((key) => ({ key, name: TRAINING_CIRCUITS[key].name, group: "Niveaux d'entraînement", layout: TRAINING_CIRCUITS[key] }))
  ];
}

function circuitLayout(key) {
  return F1_CIRCUITS[key] || TRAINING_CIRCUITS[key];
}

// Échelle d'une miniature : le canvas du jeu entier tient dans la vignette.
function thumbnailScale(canvasWidth, canvasHeight, thumbWidth = CIRCUIT_THUMB_WIDTH, thumbHeight = CIRCUIT_THUMB_HEIGHT) {
  return Math.min(thumbWidth / canvasWidth, thumbHeight / canvasHeight);
}

// Fiche d'un circuit : longueur et largeur en mètres (échelle du jeu),
// compétence pour un niveau, obstacles posés, voitures du garage qui l'ont validé.
function circuitCardInfo(entry, circuit, garage, obstacleCount = 0) {
  const trainedBy = garage.keys().filter((key) => garage.isTrainedOn(key, entry.key));
  return {
    key: entry.key,
    name: entry.name,
    group: entry.group,
    lengthMeters: circuit.totalLength / circuit.pixelsPerMeter,
    widthMeters: circuit.trackWidth / circuit.pixelsPerMeter,
    skill: entry.layout.skill ?? null,
    obstacleCount,
    trainedBy
  };
}

// ---------- Interface (navigateur) ----------

class CircuitShowroom {
  // options : { dialog, grid, canvasWidth, canvasHeight, trackWidth, pixelsPerMeter,
  //             garage: () => Garage, obstacles: (key) => Obstacle[],
  //             current: () => key, onChoose(key) }
  constructor(options) {
    this.options = options;
    this.cards = new Map();
    this.circuits = new Map();
    let group = null;
    for (const entry of allCircuitEntries()) {
      if (entry.group !== group) {
        group = entry.group;
        const title = document.createElement("h3");
        title.className = "circuit-group";
        title.textContent = group;
        options.grid.appendChild(title);
      }
      this.circuits.set(entry.key, new Circuit(entry.layout, {
        key: entry.key,
        canvasWidth: options.canvasWidth, canvasHeight: options.canvasHeight,
        trackWidth: options.trackWidth, pixelsPerMeter: options.pixelsPerMeter
      }));
      this.buildCard(entry);
    }
  }

  open() {
    this.refresh();
    this.options.dialog.showModal();
  }

  close() {
    this.options.dialog.close();
  }

  buildCard(entry) {
    const card = document.createElement("article");
    card.className = "circuit-card";
    const g = createGraphics(CIRCUIT_THUMB_WIDTH, CIRCUIT_THUMB_HEIGHT);
    g.elt.style.display = "block";
    g.elt.setAttribute("role", "img");
    g.elt.setAttribute("aria-label", `Tracé du circuit ${entry.name}`);
    const title = document.createElement("h3");
    title.textContent = entry.name;
    const facts = document.createElement("p");
    facts.className = "facts";
    const choose = document.createElement("button");
    choose.type = "button";
    choose.className = "select-car";
    choose.addEventListener("click", () => {
      this.options.onChoose(entry.key);
      this.close();
    });
    card.append(g.elt, title, facts, choose);
    this.options.grid.appendChild(card);
    this.cards.set(entry.key, { card, g, facts, choose, entry });
  }

  // Miniatures (avec les obstacles du moment), fiches et circuit actuel.
  refresh() {
    const garage = this.options.garage();
    const current = this.options.current();
    for (const [key, { card, g, facts, choose, entry }] of this.cards) {
      const circuit = this.circuits.get(key);
      const obstacles = this.options.obstacles(key);
      drawTrackThumbnail(g, circuit, thumbnailScale(this.options.canvasWidth, this.options.canvasHeight), obstacles,
        this.options.canvasWidth, this.options.canvasHeight);
      const info = circuitCardInfo(entry, circuit, garage, obstacles.length);
      facts.innerHTML =
        `longueur ≈ ${Math.round(info.lengthMeters)} m · largeur ${Math.round(info.widthMeters)} m` +
        (info.skill ? `<br>compétence : ${info.skill}` : "") +
        `<br>${info.obstacleCount} obstacle(s)` +
        `<br>${info.trainedBy.length > 0 ? `voiture(s) entraînée(s) ici : ${info.trainedBy.join(", ")}` : "aucune voiture entraînée ici"}`;
      const isCurrent = key === current;
      card.classList.toggle("selected", isCurrent);
      choose.textContent = isCurrent ? "Circuit actuel ✓" : "Choisir ce circuit";
      choose.setAttribute("aria-pressed", String(isCurrent));
    }
  }
}
