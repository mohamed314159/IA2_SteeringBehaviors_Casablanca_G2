// Contrôleur de scène : circuit, choix des marques, entraînement, garage, menu.
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 760;
const TRACK_WIDTH = 44;            // px ≈ 14 m → voiture 17,6 x 6,3 px (5,6 x 2 m)
const PANEL_EVERY = 10;            // rafraîchissement du panneau (images)

let circuit;
let trackLayer;
let cars = [];
let generationsPlayed = 0;
let training = false;              // évolution en cours (libre ou parcours d'entraînement)
let curriculum = null;             // parcours des niveaux d'entraînement (Curriculum) ou null
let demo = false;                  // démonstration des champions entraînés (sans évolution)
let demoChampions = [];            // { spec, brain, generation } des champions en démonstration
let returnCircuitKey = "monza";    // circuit F1 affiché à la fin du parcours
let statusMessage = "";            // message d'état (circuit validé, refus d'entraînement…)
const DEMO_CAPTION = "voiture entraînée sur les circuits d'entraînement";
let garage;
let garageChoice = new Map();      // lignée → génération choisie pour reprendre (null = dernière)
let rng = createRng(Date.now());
let showRays = true;
let circuitKey = "monza";
let ui = {};
let showroom;                      // vitrine des voitures (showroom.js)
let circuitShowroom;               // vitrine des circuits (circuit-showroom.js)
let speedFactor = 1;               // accélération choisie (sim-speed.js) : 1, 2, 5… ou "max"
let obstacles = [];                // obstacles du circuit affiché (obstacle.js)
let obstacleWallList = [];         // leurs côtés, vus comme des murs par les rayons
let placing = null;                // obstacle en cours de placement { shape, rotation } ou null
let obstacleEditor;
const OBSTACLE_ROTATION_STEP = Math.PI / 12;   // touche R : +15°
const speedMeter = new SpeedMeter();

function setup() {
  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  canvas.parent("canvas-container");
  frameRate(60);
  describe("Circuit de Formule 1 vu de dessus sur de l'herbe pixelisée ; des voitures de marques parodiques, guidées par un réseau de neurones et des rayons capteurs, apprennent à faire le tour génération après génération.");
  useStoredArchitecture(safeLocalStorage());
  loadRayLength(safeLocalStorage());
  speedFactor = loadSpeedFactor(safeLocalStorage());
  garage = new Garage(safeLocalStorage());
  removeIncompatibleLineages();
  bindMenu();
  buildCircuit(circuitKey);
}

// localStorage peut être bloqué (navigation privée, fichier local) : garage en mémoire.
function safeLocalStorage() {
  try {
    const storage = window.localStorage;
    storage.getItem(GARAGE_STORAGE_KEY);
    return storage;
  } catch (error) {
    return null;
  }
}

function bindMenu() {
  ui.circuitName = document.getElementById("currentCircuit");
  ui.selectionCount = document.getElementById("selectionCount");
  ui.raysCheckbox = document.getElementById("raysCheckbox");
  ui.trainButton = document.getElementById("trainButton");
  ui.stopButton = document.getElementById("stopButton");
  ui.curriculumButton = document.getElementById("curriculumButton");
  ui.levelInfo = document.getElementById("levelInfo");
  ui.generationValue = document.getElementById("generationValue");
  ui.aliveValue = document.getElementById("aliveValue");
  ui.lineages = document.getElementById("lineages");
  ui.garageList = document.getElementById("garageList");
  ui.topology = document.getElementById("topologyValue");

  buildCircuitShowroom();

  showTopology();
  // Une modification faite dans network.html (autre onglet) arrive ici.
  window.addEventListener("storage", onStorageChange);

  buildShowroom();
  bindModelFiles();
  bindObstacles();
  renderGarage();
  bindRayLength();
  bindSpeedButtons();
  ui.raysCheckbox.checked = showRays;
  ui.raysCheckbox.addEventListener("change", () => { showRays = ui.raysCheckbox.checked; });
  ui.trainButton.addEventListener("click", startTraining);
  ui.stopButton.addEventListener("click", stopTraining);
  ui.curriculumButton.addEventListener("click", startCurriculum);
  updateButtons();
}

// Longueur des rayons : curseur (réagit pendant le glissement), boutons − / +
// et « Par défaut ». La valeur est mémorisée et agit tout de suite sur les voitures.
function bindRayLength() {
  ui.rayLengthSlider = document.getElementById("rayLengthSlider");
  ui.rayLengthValue = document.getElementById("rayLengthValue");
  ui.rayLengthSlider.min = MIN_RAY_LENGTH;
  ui.rayLengthSlider.max = MAX_RAY_LENGTH;
  ui.rayLengthSlider.addEventListener("input", () => changeRayLength(ui.rayLengthSlider.value));
  document.getElementById("rayShorterButton").addEventListener("click", () => changeRayLength(currentRayLength() - RAY_LENGTH_STEP));
  document.getElementById("rayLongerButton").addEventListener("click", () => changeRayLength(currentRayLength() + RAY_LENGTH_STEP));
  document.getElementById("rayResetButton").addEventListener("click", () => changeRayLength(DEFAULT_RAY_LENGTH));
  showRayLength();
}

// Vitesse de simulation : un bouton par facteur (×1 … ×100, max) et le
// facteur effectivement atteint, mesuré sur les dernières images.
function bindSpeedButtons() {
  ui.speedButtons = document.getElementById("speedButtons");
  ui.speedEffective = document.getElementById("speedEffective");
  for (const factor of SPEED_FACTORS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "small";
    button.dataset.factor = factor;
    button.textContent = factor === "max" ? "max" : `×${factor}`;
    button.setAttribute("aria-label", factor === "max" ? "Vitesse maximale" : `Vitesse ×${factor}`);
    button.addEventListener("click", () => changeSpeedFactor(factor));
    ui.speedButtons.appendChild(button);
  }
  showSpeedFactor();
}

function changeSpeedFactor(factor) {
  speedFactor = normalizeSpeedFactor(factor);
  saveSpeedFactor(safeLocalStorage(), speedFactor);
  speedMeter.reset();
  showSpeedFactor();
}

function showSpeedFactor() {
  for (const button of ui.speedButtons.children) {
    button.setAttribute("aria-pressed", String(normalizeSpeedFactor(button.dataset.factor) === speedFactor));
  }
  showEffectiveSpeed();
}

function showEffectiveSpeed() {
  const wanted = speedFactor === "max" ? "max" : `×${speedFactor}`;
  const running = training || demo;
  const reached = speedMeter.average;
  let text = `demandé ${wanted}`;
  if (running && reached > 0) {
    text += ` · atteint ×${reached.toFixed(reached < 10 ? 1 : 0)}`;
    if (speedFactor !== "max" && reached < speedFactor * 0.9) text += " (limite de la machine)";
  }
  ui.speedEffective.textContent = text;
}

function changeRayLength(px) {
  setRayLength(px);
  saveRayLength(safeLocalStorage());
  showRayLength();
}

function showRayLength() {
  const px = currentRayLength();
  ui.rayLengthSlider.value = px;
  const meters = px / (TRACK_WIDTH / F1_TRACK_WIDTH_M);
  ui.rayLengthValue.textContent = `${px} px ≈ ${meters.toFixed(0)} m`;
}

function showTopology() {
  try {
    const source = architectureOverride ? "interface" : "network-config.js";
    ui.topology.textContent = `${NeuralNetwork.fromConfig(currentNetworkConfig()).describe()} (${source})`;
  } catch (error) {
    ui.topology.textContent = error.message;
  }
}

// Changement d'architecture dans un autre onglet : l'entraînement en cours
// utilise l'ancienne architecture, il est arrêté ; le garage (effacé) est relu.
function onStorageChange(event) {
  if (event.key === ARCHITECTURE_STORAGE_KEY) {
    stopTraining();
    useStoredArchitecture(safeLocalStorage());
    showTopology();
  }
  if (event.key === OBSTACLES_STORAGE_KEY) {
    obstacles = loadObstacles(safeLocalStorage(), circuitKey);
    refreshObstacles(false);
  }
  if (event.key === SIM_SPEED_STORAGE_KEY) {
    speedFactor = loadSpeedFactor(safeLocalStorage());
    showSpeedFactor();
  }
  if (event.key === RAY_LENGTH_STORAGE_KEY) {
    loadRayLength(safeLocalStorage());
    showRayLength();
  }
  if (event.key === ARCHITECTURE_STORAGE_KEY || event.key === GARAGE_STORAGE_KEY) {
    garage.load();
    removeIncompatibleLineages();
    garageChoice.clear();
    renderGarage();
  }
}

// Garde-fou : une lignée dont le cerveau n'a pas l'architecture courante ne
// peut pas être reprise (elle aurait pu être réécrite pendant le changement).
function removeIncompatibleLineages() {
  const config = currentNetworkConfig();
  garage.removeIncompatible(config.hiddenLayers, config.hiddenActivation);
}

// Vitrine : aucune voiture sélectionnée au départ ; le bouton l'ouvre, le
// compteur en dessous indique la sélection.
function buildShowroom() {
  const dialog = document.getElementById("showroomDialog");
  const confidenceDialog = document.getElementById("confidenceDialog");
  showroom = new Showroom({
    dialog,
    grid: document.getElementById("showroomGrid"),
    confidenceDialog,
    confidenceTitle: document.getElementById("confidenceTitle"),
    confidenceTable: document.getElementById("confidenceTable"),
    garage: () => garage,
    circuits: allCircuitEntries,
    pixelsPerMeter: TRACK_WIDTH / F1_TRACK_WIDTH_M,
    onSelectionChange: (count) => {
      ui.selectionCount.textContent = selectionLabel(count);
      updateButtons();
    }
  });
  document.getElementById("showroomButton").addEventListener("click", () => showroom.open());
  document.getElementById("showroomClose").addEventListener("click", () => showroom.close());
  document.getElementById("confidenceClose").addEventListener("click", () => confidenceDialog.close());
  ui.selectionCount.textContent = selectionLabel(0);
}

// Vitrine des circuits : le bouton l'ouvre ; choisir une carte arrête
// l'entraînement en cours et charge le circuit.
function buildCircuitShowroom() {
  const dialog = document.getElementById("circuitDialog");
  circuitShowroom = new CircuitShowroom({
    dialog,
    grid: document.getElementById("circuitGrid"),
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: CANVAS_HEIGHT,
    trackWidth: TRACK_WIDTH,
    pixelsPerMeter: TRACK_WIDTH / F1_TRACK_WIDTH_M,
    garage: () => garage,
    obstacles: (key) => (key === circuitKey ? obstacles : loadObstacles(safeLocalStorage(), key)),
    current: () => circuitKey,
    onChoose: (key) => {
      stopTraining();
      statusMessage = "";
      buildCircuit(key);
    }
  });
  document.getElementById("circuitShowroomButton").addEventListener("click", () => circuitShowroom.open());
  document.getElementById("circuitDialogClose").addEventListener("click", () => circuitShowroom.close());
}

function selectedModels() {
  return showroom.selectedModels();
}

function updateButtons() {
  const active = training || demo;
  ui.trainButton.disabled = active || selectedModels().length === 0;
  ui.curriculumButton.disabled = ui.trainButton.disabled;
  ui.stopButton.disabled = !active;
}

function isTrainingLevel(key) {
  return key in TRAINING_CIRCUITS;
}

// Construit le circuit et son décor (sans toucher à l'entraînement en cours).
// L'échelle est celle d'une piste F1 : la voiture garde la même taille partout.
function buildCircuit(key) {
  circuitKey = key;
  ui.circuitName.textContent = `Circuit actuel : ${circuitLayout(key).name}`;
  circuit = new Circuit(circuitLayout(key), {
    key,
    canvasWidth: CANVAS_WIDTH, canvasHeight: CANVAS_HEIGHT, trackWidth: TRACK_WIDTH,
    pixelsPerMeter: TRACK_WIDTH / F1_TRACK_WIDTH_M
  });
  if (trackLayer) trackLayer.remove();
  trackLayer = createGraphics(CANVAS_WIDTH, CANVAS_HEIGHT);
  drawTrackLayer(trackLayer, circuit, createRng(42));
  placing = null;
  obstacles = loadObstacles(safeLocalStorage(), key);
  refreshObstacles(false);
  renderGarage(); // pourcentages et validations propres à ce circuit
  updatePanel();
}

// Snapshot de reprise : génération choisie dans le garage, sinon la dernière.
function chosenSnapshot(key) {
  return garage.snapshot(key, garageChoice.has(key) ? garageChoice.get(key) : null);
}

// Confiance mémorisée de la lignée sur le circuit affiché (null : jamais roulé).
function confidenceHere(key) {
  return garage.circuitConfidence(key, circuitKey);
}

// Lignées sauvegardées : reprise depuis la génération choisie ; sinon génération 0.
// Une lignée qui a déjà validé ce circuit (confiance 100 %) ne s'y entraîne plus.
function startTraining() {
  const chosen = selectedModels();
  const trained = chosen.filter((m) => garage.isTrainedOn(lineageKey(m), circuitKey));
  const models = chosen.filter((m) => !garage.isTrainedOn(lineageKey(m), circuitKey));
  statusMessage = trained.length > 0
    ? `Déjà entraînée(s) dans ${circuit.name} (100 %), non relancée(s) : ${trained.map(lineageKey).join(", ")}.`
    : "";
  if (models.length === 0) {
    updatePanel();
    return;
  }
  generationsPlayed = 0;
  lastRenderedGenerations = 0;
  cars = createTrainingPopulation(circuit, models, rng, chosenSnapshot, confidenceHere);
  training = true;
  updateButtons();
  updatePanel();
}

// Arrêt : les générations terminées sont déjà dans le garage ; la génération en
// cours (incomplète) est abandonnée.
function stopTraining() {
  training = false;
  curriculum = null;
  demo = false;
  cars = [];
  if (ui.trainButton) {
    updateButtons();
    updatePanel();
  }
}

// Parcours d'entraînement : les modèles cochés enchaînent les niveaux, du
// plus facile au plus difficile ; un niveau validé fait changer de circuit.
function startCurriculum() {
  const models = selectedModels();
  if (models.length === 0) return;
  if (!isTrainingLevel(circuitKey)) returnCircuitKey = circuitKey;
  statusMessage = "";
  curriculumModels = new Map(models.map((m) => [lineageKey(m), m]));
  curriculum = new Curriculum(trainingLevelKeys(), [...curriculumModels.keys()]);
  generationsPlayed = 0;
  lastRenderedGenerations = 0;
  training = true;
  prepareCurriculumLevel();
  updateButtons();
  updatePanel();
}

let curriculumModels = new Map();  // lignée → { brand, model } du parcours en cours

// Prépare le niveau courant : les lignées qui l'ont déjà validé (garage) le
// sautent ; si toutes l'ont validé, on passe au suivant ; après le dernier, démo.
function prepareCurriculumLevel() {
  while (!curriculum.finished) {
    buildCircuit(curriculum.currentLevel);
    for (const key of curriculum.remainingLineages()) {
      if (garage.isTrainedOn(key, circuitKey)) curriculum.markPassed(key);
    }
    const remaining = curriculum.remainingLineages();
    if (remaining.length > 0) {
      const models = remaining.map((key) => curriculumModels.get(key));
      cars = createTrainingPopulation(circuit, models, rng, chosenSnapshot, confidenceHere);
      garageChoice.clear();
      return;
    }
    curriculum.advanceIfComplete();
  }
  finishCurriculum();
}

// Fin du parcours : lignées marquées entraînées, démonstration des champions.
function finishCurriculum() {
  const champions = [];
  for (const key of curriculum.lineages) {
    const snapshot = garage.snapshot(key);
    if (!snapshot) continue;
    garage.markTrained(key, snapshot.generation);
    champions.push({ spec: snapshot.spec, brain: NeuralNetwork.fromJSON(snapshot.brain), generation: snapshot.generation });
  }
  renderGarage();
  startDemo(champions);
}

// Une image : plusieurs pas de simulation selon la vitesse choisie, puis un
// seul dessin (sim-speed.js).
function draw() {
  image(trackLayer, 0, 0);
  for (const obstacle of obstacles) obstacle.show();
  if (training || demo) {
    speedMeter.add(runSimulationSteps(simulationStep, speedFactor));
    renderGarageIfChanged();
  }
  if (demo) drawDemoCars();
  else if (training) drawTrainingCars();
  else if (!placing) drawIdleMessage();
  drawPlacementPreview();
  if (frameCount % PANEL_EVERY === 0) {
    updatePanel();
    showEffectiveSpeed();
  }
}

// Un pas de simulation (identique quelle que soit la vitesse) : chaque voiture
// perçoit, décide et avance une fois, puis les lignées arrêtées passent à leur
// génération suivante. Retourne false quand il n'y a plus rien à simuler.
function simulationStep() {
  if (demo) {
    for (const car of cars) car.drive(obstacleWallList, obstacles);
    if (cars.every((car) => !car.racing)) restartDemo();
    return true;
  }
  if (!training) return false;
  for (const car of cars) car.drive(obstacleWallList, obstacles);
  advanceLineages();
  return training || demo;
}

function drawTrainingCars() {
  const ranking = [...cars].sort(compareCars);
  for (const car of ranking.slice().reverse()) car.show(showRays && car === ranking[0]);
}

// Générations indépendantes : une lignée dont toutes les voitures sont
// arrêtées passe tout de suite à sa génération suivante, sans attendre les
// autres types de voitures.
function advanceLineages() {
  let levelChange = false;
  cars = advanceStoppedLineages(cars, circuit, rng, (key, best) => {
    garage.recordChampion(best, circuit.name);
    garageChoice.delete(key);
    generationsPlayed++;
    if (runFinished(best)) {
      statusMessage = `Voiture entraînée dans le circuit ${circuit.name} (100 %) : ${key}.`;
    }
    if (curriculum && curriculum.recordGeneration(new Map([[key, best]])) !== "continue") levelChange = true;
  });
  if (levelChange) {
    prepareCurriculumLevel();
  } else if (!curriculum && cars.length === 0) {
    training = false;
    statusMessage = `Toutes les voitures sont entraînées dans le circuit ${circuit.name} (100 %).`;
    updateButtons();
    updatePanel();
  }
}

// Le garage n'est redessiné que lorsqu'une génération vient de se terminer.
let lastRenderedGenerations = 0;
function renderGarageIfChanged() {
  if (generationsPlayed === lastRenderedGenerations) return;
  lastRenderedGenerations = generationsPlayed;
  renderGarage();
}

// Démonstration : un champion par lignée roule sur le circuit F1 de départ,
// avec sa légende ; la course recommence quand toutes sont arrêtées.
function startDemo(champions) {
  training = false;
  curriculum = null;
  demo = true;
  buildCircuit(returnCircuitKey);
  demoChampions = champions.map((c) => ({ spec: { ...c.spec }, brain: c.brain.copy(), generation: c.generation }));
  restartDemo();
  updateButtons();
  updatePanel();
}

function restartDemo() {
  cars = demoChampions.map((c) => new Car(circuit, { ...c.spec }, 0, c.brain.copy(), c.generation, rng));
}

function drawDemoCars() {
  for (const car of cars) {
    car.show(false);
    car.showCaption(`Gén. ${car.generation} – ${DEMO_CAPTION}`);
  }
}

function drawIdleMessage() {
  push();
  fill(0, 160);
  noStroke();
  rectMode(CENTER);
  rect(width / 2, height / 2, 760, statusMessage ? 90 : 60, 6);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(18);
  text("« Choisir les voitures », sélectionnez-en, puis « Entraîner »", width / 2, height / 2 - (statusMessage ? 16 : 0));
  if (statusMessage) {
    fill(140, 230, 140);
    textSize(14);
    text(statusMessage, width / 2, height / 2 + 18, 740);
  }
  pop();
}

// Pourcentage du tour sur le circuit (jamais plus d'un tour : 0 à 100 %).
function formatProgress(progress) {
  const percent = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0)) * 100;
  return `${percent.toFixed(1)} %`;
}

// Confiance de la lignée et vitesse max effective qui en découle.
function formatConfidence(car) {
  return `confiance ${(car.confidence * 100).toFixed(0)} % → v<sub>max</sub> ${car.maxSpeed.toFixed(2)} / ${car.spec.maxSpeed.toFixed(2)} px/img`;
}

// Longueur des rayons (px) et vitesse de la voiture.
function formatSensors(car) {
  const rays = car.rayDistances.map((d) => d.toFixed(0)).join(" · ");
  return `rayons (px, max ${car.sightDistance}) : ${rays} | vitesse ${car.vel.mag().toFixed(2)} px/img (${car.speedKmh.toFixed(0)} km/h)`;
}

function updatePanel() {
  ui.generationValue.textContent = training ? generationsPlayed : "-"; // toutes lignées confondues
  ui.aliveValue.textContent = training || demo ? `${cars.filter((c) => c.racing).length} / ${cars.length}` : "-";
  ui.levelInfo.innerHTML = levelInfoHtml() + (statusMessage ? `<br><small class="saved-tag">${statusMessage}</small>` : "");
  if (demo) {
    ui.lineages.innerHTML = cars.map((car) => `<li><span class="swatch" style="background:${car.spec.color}"></span>` +
      `<strong>${car.spec.brand}</strong> ${car.spec.model} · gén. ${car.generation} – ${DEMO_CAPTION}` +
      `<br><small>${formatProgress(carFitness(car))}</small></li>`).join("");
    return;
  }
  if (!training) {
    ui.lineages.innerHTML = circuitPercentagesHtml();
    return;
  }
  const rows = [];
  for (const [key, group] of groupByLineage(cars)) {
    const best = bestCar(group);
    const record = garage.circuitRecord(key, circuitKey);
    const recordText = record && record.bestGeneration !== null
      ? `record sur ce circuit : ${formatProgress(record.bestProgress)} en ${(record.bestFrames / 60).toFixed(1)} s (gén. ${record.bestGeneration})`
      : "pas encore de record sur ce circuit";
    rows.push(`<li><span class="swatch" style="background:${best.spec.color}"></span>` +
      `<strong>${best.spec.brand}</strong> ${best.spec.model} · gén. ${best.generation}` +
      `<br><small>en piste : ${group.filter((c) => c.racing).length}/${group.length} · ${formatProgress(carFitness(best))} · survie ${best.secondsAlive.toFixed(1)} s</small>` +
      `<br><small>${formatConfidence(best)}</small>` +
      `<br><small class="sensors">${formatSensors(best)}</small>` +
      `<br><small>${recordText}</small>` +
      (curriculum ? `<br><small>${curriculum.hasPassed(key) ? "niveau validé ✓" : "niveau en cours"}</small>` : "") +
      `</li>`);
  }
  ui.lineages.innerHTML = rows.join("");
}

// Au repos : pourcentage de chaque lignée du garage SUR LE CIRCUIT AFFICHÉ
// (changer de circuit change les pourcentages), confiance et validation.
function circuitPercentagesHtml() {
  const keys = garage.keys();
  if (keys.length === 0) return "<li><small>Aucune voiture au garage.</small></li>";
  return keys.map((key) => {
    const latest = garage.snapshot(key);
    const record = garage.circuitRecord(key, circuitKey);
    const head = `<span class="swatch" style="background:${latest.spec.color}"></span><strong>${latest.spec.brand}</strong> ${latest.spec.model}`;
    if (!record) return `<li>${head}<br><small>${circuit.name} : 0.0 % (jamais entraînée ici)</small></li>`;
    const trained = record.trained
      ? `<br><small class="saved-tag">voiture entraînée dans le circuit ${circuit.name} ✓ (gén. ${record.trained.generation})</small>`
      : "";
    return `<li>${head}<br><small>${circuit.name} : ${formatProgress(record.bestProgress)} · confiance ${(record.confidence * 100).toFixed(0)} %</small>${trained}</li>`;
  }).join("");
}

// Niveau courant du parcours, ou compétence du niveau choisi à la main.
function levelInfoHtml() {
  if (demo) return `Parcours terminé : démonstration sur ${circuit.name}.`;
  if (curriculum) {
    const total = curriculum.levelKeys.length;
    return `Parcours : niveau ${curriculum.index + 1}/${total} – ${circuit.name}<br><small>compétence : ${circuit.skill}</small>`;
  }
  if (circuit && circuit.skill) return `<small>Compétence : ${circuit.skill}</small>`;
  return "";
}

// ---------- Obstacles (obstacle.js, obstacle-editor.js) ----------

function bindObstacles() {
  ui.obstacleList = document.getElementById("obstacleList");
  ui.obstacleStatus = document.getElementById("obstacleStatus");
  const dialog = document.getElementById("obstacleDialog");
  obstacleEditor = new ObstacleEditor({
    dialog,
    canvas: document.getElementById("obstacleCanvas"),
    sizeSlider: document.getElementById("obstacleSize"),
    sizeValue: document.getElementById("obstacleSizeValue"),
    status: document.getElementById("obstacleEditorStatus"),
    placeButton: document.getElementById("obstaclePlaceButton"),
    presets: document.getElementById("obstaclePresets"),
    onPlace: (points, sizeMeters) => {
      startPlacing(normalizeShape(points, sizeMeters, TRACK_WIDTH / F1_TRACK_WIDTH_M));
      obstacleEditor.close();
    }
  });
  document.getElementById("drawObstacleButton").addEventListener("click", () => obstacleEditor.open());
  document.getElementById("obstacleEditorClose").addEventListener("click", () => obstacleEditor.close());
  document.getElementById("obstacleUndo").addEventListener("click", () => obstacleEditor.undo());
  document.getElementById("obstacleClear").addEventListener("click", () => obstacleEditor.clear());
  document.getElementById("clearObstaclesButton").addEventListener("click", () => {
    obstacles = [];
    refreshObstacles();
  });
  // Placement : clic sur le circuit ; R tourne, Échap annule.
  document.querySelector("#canvas-container canvas").addEventListener("pointerdown", onCanvasPointerDown);
  document.addEventListener("keydown", onPlacementKey);
}

function startPlacing(shape) {
  placing = { shape, rotation: 0 };
  ui.obstacleStatus.textContent = "Cliquez sur le circuit pour poser l'obstacle · R : tourner · Échap : annuler.";
}

// Position du pointeur dans le repère du canvas (taille affichée ≠ taille réelle possible).
function canvasPoint(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: ((event.clientX - rect.left) / rect.width) * width, y: ((event.clientY - rect.top) / rect.height) * height };
}

function onCanvasPointerDown(event) {
  if (!placing) return;
  const { x, y } = canvasPoint(event);
  obstacles.push(new Obstacle(x, y, placing.shape, placing.rotation));
  placing = null;
  refreshObstacles();
  ui.obstacleStatus.textContent = `Obstacle posé sur ${circuit.name}. Les rayons le voient et une voiture qui le touche est éliminée.`;
}

function onPlacementKey(event) {
  if (!placing) return;
  if (event.key === "Escape") {
    placing = null;
    ui.obstacleStatus.textContent = "Placement annulé.";
  } else if (event.key === "r" || event.key === "R") {
    placing.rotation += OBSTACLE_ROTATION_STEP;
  }
}

// Aperçu de l'obstacle sous le pointeur pendant le placement.
function drawPlacementPreview() {
  if (!placing || mouseX < 0 || mouseY < 0 || mouseX > width || mouseY > height) return;
  new Obstacle(mouseX, mouseY, placing.shape, placing.rotation).show(true);
}

// Recalcule les murs, la liste du menu et (par défaut) mémorise les obstacles.
function refreshObstacles(save = true) {
  obstacleWallList = obstacleWalls(obstacles);
  if (save) saveObstacles(safeLocalStorage(), circuitKey, obstacles);
  renderObstacleList();
}

function renderObstacleList() {
  ui.obstacleList.innerHTML = "";
  if (obstacles.length === 0) {
    ui.obstacleList.innerHTML = `<li><small>Aucun obstacle sur ${circuit.name}.</small></li>`;
    return;
  }
  const ppm = TRACK_WIDTH / F1_TRACK_WIDTH_M;
  obstacles.forEach((obstacle, i) => {
    const xs = obstacle.points.map((p) => p[0]);
    const ys = obstacle.points.map((p) => p[1]);
    const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / ppm;
    const item = document.createElement("li");
    item.append(`Obstacle ${i + 1} · ${obstacle.points.length} côtés · ${size.toFixed(1)} m `);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "small";
    remove.textContent = "Supprimer";
    remove.setAttribute("aria-label", `Supprimer l'obstacle ${i + 1}`);
    remove.addEventListener("click", () => {
      obstacles.splice(i, 1);
      refreshObstacles();
    });
    item.appendChild(remove);
    ui.obstacleList.appendChild(item);
  });
}

// ---------- Modèles en fichier (model-file.js) ----------

// Téléchargement d'un modèle : fichier JSON nommé marque_modele_genN.json.
function downloadModel(key, generation) {
  try {
    const data = exportModelFile(garage, key, generation);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = modelFileName(data);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0); // libère le fichier temporaire
    showModelStatus(`Modèle ${key} génération ${data.generation} téléchargé (${link.download}).`);
  } catch (error) {
    showModelStatus(error.message, true);
  }
}

function bindModelFiles() {
  ui.modelFileInput = document.getElementById("modelFileInput");
  ui.modelStatus = document.getElementById("modelFileStatus");
  ui.modelConfirm = document.getElementById("modelConfirm");
  ui.modelConfirmText = document.getElementById("modelConfirmText");
  document.getElementById("loadModelButton").addEventListener("click", () => ui.modelFileInput.click());
  ui.modelFileInput.addEventListener("change", async () => {
    const file = ui.modelFileInput.files[0];
    ui.modelFileInput.value = ""; // permet de recharger le même fichier
    if (file) loadModelText(await file.text(), file.name);
  });
  document.getElementById("modelConfirmButton").addEventListener("click", () => {
    if (pendingModel) importModel(pendingModel);
  });
  document.getElementById("modelCancelButton").addEventListener("click", () => {
    pendingModel = null;
    ui.modelConfirm.hidden = true;
    showModelStatus("Chargement annulé.");
  });
}

let pendingModel = null;           // modèle lu, en attente de confirmation de remplacement

// Lit un fichier de modèle : vérifications, puis import (ou confirmation si
// la lignée existe déjà au garage).
function loadModelText(text, fileName) {
  ui.modelConfirm.hidden = true;
  pendingModel = null;
  if (training || demo) {
    showModelStatus("Arrêtez l'entraînement avant de charger un modèle.", true);
    return;
  }
  let data;
  try {
    data = parseModelFile(text);
  } catch (error) {
    showModelStatus(`${fileName} : ${error.message}`, true);
    return;
  }
  if (!modelMatchesArchitecture(data, currentNetworkConfig())) {
    showModelStatus(`${fileName} : réseau ${describeModelArchitecture(data)}, différent de l'architecture actuelle ` +
      `(${NeuralNetwork.fromConfig(currentNetworkConfig()).describe()}). Appliquez d'abord cette architecture dans « Voir / modifier le réseau ».`, true);
    return;
  }
  const key = lineageKey({ brand: data.brand, model: data.model });
  if (garage.has(key)) {
    pendingModel = data;
    ui.modelConfirmText.textContent = `Remplacer ${key} du garage (gén. ${garage.snapshot(key).generation}) par le fichier (gén. ${data.generation}) ?`;
    ui.modelConfirm.hidden = false;
    return;
  }
  importModel(data);
}

function importModel(data) {
  const { key, replaced } = garage.importLineage(data);
  pendingModel = null;
  ui.modelConfirm.hidden = true;
  garageChoice.delete(key);
  renderGarage();
  updatePanel();
  showModelStatus(`${key} génération ${data.generation} ${replaced ? "a remplacé la lignée du garage" : "est au garage"} : sélectionnez-la puis « Entraîner » pour reprendre à la génération ${data.generation + 1}.`);
}

function showModelStatus(message, isError = false) {
  ui.modelStatus.textContent = message;
  ui.modelStatus.classList.toggle("error", isError);
}

// Garage : une ligne par lignée sauvegardée, choix de la génération de reprise.
function renderGarage() {
  ui.garageList.innerHTML = "";
  const keys = garage.keys();
  if (keys.length === 0) {
    ui.garageList.innerHTML = "<li><small>Vide : les champions y sont rangés à chaque fin de génération.</small></li>";
  }
  for (const key of keys) {
    const latest = garage.snapshot(key);
    const item = document.createElement("li");
    const title = document.createElement("div");
    title.innerHTML = `<span class="swatch" style="background:${latest.spec.color}"></span><strong>${latest.spec.brand}</strong> ${latest.spec.model}` +
      ` <small>${NeuralNetwork.fromJSON(latest.brain).describe()}</small>` +
      (garage.trainedInfo(key) ? `<br><small class="saved-tag">entraînée sur les circuits d'entraînement (gén. ${garage.trainedInfo(key).generation})</small>` : "") +
      garage.trainedCircuits(key).map((c) => `<br><small class="saved-tag">entraînée dans le circuit ${c.name} ✓ (gén. ${c.generation})</small>`).join("");

    const select = document.createElement("select");
    select.setAttribute("aria-label", `Génération de reprise pour ${key}`);
    for (const gen of garage.generations(key).reverse()) {
      const snap = garage.snapshot(key, gen);
      const option = document.createElement("option");
      option.value = gen;
      const confidence = snap.spec.confidence !== undefined ? ` · roulée à ${(snap.spec.confidence * 100).toFixed(0)} % de confiance` : "";
      option.textContent = `gén. ${gen} — ${formatProgress(snap.progress)} sur ${snap.circuit}${confidence}${gen === latest.generation ? " (dernière)" : ""}`;
      select.appendChild(option);
    }
    select.value = garageChoice.has(key) ? garageChoice.get(key) : latest.generation;
    select.addEventListener("change", () => {
      const gen = parseInt(select.value, 10);
      if (gen === latest.generation) garageChoice.delete(key);
      else garageChoice.set(key, gen);
    });

    // Télécharge la génération choisie dans la liste ci-dessus.
    const download = document.createElement("button");
    download.type = "button";
    download.className = "small";
    download.textContent = "Télécharger (.json)";
    download.setAttribute("aria-label", `Télécharger le modèle ${key} à la génération choisie`);
    download.addEventListener("click", () => downloadModel(key, parseInt(select.value, 10)));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "small";
    remove.textContent = "Repartir de zéro";
    remove.addEventListener("click", () => {
      garage.remove(key);
      garageChoice.delete(key);
      renderGarage();
    });

    item.append(title, select, download, remove);
    ui.garageList.appendChild(item);
  }
  if (showroom && showroom.options.dialog.open) showroom.refresh();
  if (garage.lastError) {
    const warn = document.createElement("li");
    warn.innerHTML = `<small>Sauvegarde impossible : ${garage.lastError.message}</small>`;
    ui.garageList.appendChild(warn);
  }
}
