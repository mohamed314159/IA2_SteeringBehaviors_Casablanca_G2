// Contrôleur de scène : circuit, choix des voitures, entraînement, menu.
// Menu : lignées en piste en haut, puis uniquement des boutons ; les messages
// s'affichent sur le circuit ou dans le résumé des lignées.
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
let obstacleShowroom;              // vitrine des obstacles (obstacle-showroom.js)
let obstacleProtos = [];           // prototypes dessinés : proto_1, proto_2… (obstacle-catalog.js)
let removingObstacle = false;      // mode « Retirer un obstacle » : clic sur l'obstacle
let canvasNotice = null;           // message temporaire sur le circuit { text, until }
const NOTICE_DURATION_MS = 4000;
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
  ui.trainButton = document.getElementById("trainButton");
  ui.stopButton = document.getElementById("stopButton");
  ui.curriculumButton = document.getElementById("curriculumButton");
  ui.lineages = document.getElementById("lineages");
  ui.summary = document.getElementById("raceSummary");
  ui.circuitButton = document.getElementById("circuitShowroomButton");
  ui.carsButton = document.getElementById("showroomButton");
  ui.networkLink = document.getElementById("networkLink");
  ui.raysButton = document.getElementById("rayEditorButton");
  ui.raysToggle = document.getElementById("raysToggleButton");

  buildCircuitShowroom();
  showTopology();
  // Une modification faite dans network.html (autre onglet) arrive ici.
  window.addEventListener("storage", onStorageChange);

  buildShowroom();
  bindModelFiles();
  bindObstacles();
  bindRayEditor();
  bindRayLength();
  bindSpeedButtons();
  ui.raysToggle.addEventListener("click", () => {
    showRays = !showRays;
    ui.raysToggle.setAttribute("aria-pressed", String(showRays));
    ui.raysToggle.textContent = `Rayons du leader : ${showRays ? "affichés" : "masqués"}`;
  });
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
  document.getElementById("rayLengthDefaultButton").addEventListener("click", () => changeRayLength(DEFAULT_RAY_LENGTH));
  showRayLength();
}

// Vitesse de simulation : un bouton par facteur (×1 … ×100, max). Le facteur
// effectivement atteint s'affiche dans le résumé des lignées.
function bindSpeedButtons() {
  ui.speedButtons = document.getElementById("speedButtons");
  for (const factor of SPEED_FACTORS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "small";
    button.dataset.factor = factor;
    button.textContent = factor === "max" ? "max" : `×${factor}`;
    button.setAttribute("aria-label", factor === "max" ? "Vitesse de simulation maximale" : `Vitesse de simulation ×${factor}`);
    button.title = button.getAttribute("aria-label");
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
}

// Vitesse atteinte (résumé des lignées) : « ×8.4 (limite de la machine) ».
function effectiveSpeedText() {
  const reached = speedMeter.average;
  if (!(training || demo) || reached <= 0) return "";
  let text = `vitesse ×${reached.toFixed(reached < 10 ? 1 : 0)}`;
  if (speedFactor !== "max" && reached < speedFactor * 0.9) text += " (limite de la machine)";
  return text;
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
  showRaysButton();
}

// Bouton « Rayons » : nombre de rayons et longueur, ouvre l'éditeur.
function showRaysButton() {
  const count = rayAnglesFromConfig(currentNetworkConfig()).length;
  ui.raysButton.textContent = `Rayons : ${count} · longueur ${currentRayLength()} px`;
}

// Éditeur de rayons (angles et longueur), ouvert par le bouton « Rayons ».
function bindRayEditor() {
  const rayEditor = new RayEditor({
    dialog: document.getElementById("rayDialog"),
    canvas: document.getElementById("rayCanvas"),
    list: document.getElementById("rayList"),
    angleInput: document.getElementById("rayAngleInput"),
    addButton: document.getElementById("rayAddButton"),
    info: document.getElementById("rayInfo"),
    status: document.getElementById("rayStatus"),
    applyButton: document.getElementById("rayApplyButton"),
    resetButton: document.getElementById("rayResetButton"),
    confirmBox: document.getElementById("rayConfirm"),
    confirmText: document.getElementById("rayConfirmText"),
    confirmButton: document.getElementById("rayConfirmButton"),
    cancelButton: document.getElementById("rayCancelButton"),
    storage: safeLocalStorage,
    garage: () => garage,
    onApplied: (result) => {
      if (!result.changed) return;
      // Nouvelle couche d'entrée : l'entraînement en cours et le garage sont périmés.
      stopTraining();
      garage.load();
      removeIncompatibleLineages();
      refreshGarageViews();
      showTopology();
    }
  });
  ui.raysButton.addEventListener("click", () => rayEditor.open());
  document.getElementById("rayDialogClose").addEventListener("click", () => rayEditor.close());
}

// Bouton « Réseau de neurones » : affiche la topologie courante.
function showTopology() {
  try {
    ui.networkLink.textContent = `Réseau de neurones : ${NeuralNetwork.fromConfig(currentNetworkConfig()).layers.join(" → ")}`;
  } catch (error) {
    ui.networkLink.textContent = "Réseau de neurones : configuration invalide";
    notify(error.message);
  }
  if (ui.raysButton) showRaysButton();
}

// Changement d'architecture dans un autre onglet : l'entraînement en cours
// utilise l'ancienne architecture, il est arrêté ; le garage (effacé) est relu.
function onStorageChange(event) {
  if (event.key === ARCHITECTURE_STORAGE_KEY) {
    stopTraining();
    useStoredArchitecture(safeLocalStorage());
    showTopology();
    showRaysButton();
  }
  if (event.key === OBSTACLE_PROTOS_STORAGE_KEY) obstacleProtos = loadProtos(safeLocalStorage());
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
    refreshGarageViews();
  }
}

// Garde-fou : une lignée dont le cerveau n'a pas l'architecture courante ne
// peut pas être reprise (elle aurait pu être réécrite pendant le changement).
function removeIncompatibleLineages() {
  const config = currentNetworkConfig();
  garage.removeIncompatible(config.hiddenLayers, config.hiddenActivation, rayAnglesFromConfig(config).length + 1);
}

// Vitrine : aucune voiture sélectionnée au départ ; le bouton l'ouvre et
// affiche la sélection. Les actions du garage sont sur chaque carte.
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
      showCarsButton(count);
      updateButtons();
    },
    onDownload: (key) => downloadModel(key),
    onReset: (key) => {
      garage.remove(key);
      refreshGarageViews();
      showModelStatus(`${key} repart de zéro : sa prochaine génération sera la génération 0.`);
    }
  });
  document.getElementById("showroomButton").addEventListener("click", () => showroom.open());
  document.getElementById("showroomClose").addEventListener("click", () => showroom.close());
  document.getElementById("confidenceClose").addEventListener("click", () => confidenceDialog.close());
  showCarsButton(0);
}

function showCarsButton(count) {
  ui.carsButton.textContent = carsButtonLabel(count);
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
  ui.circuitButton.textContent = `Circuit : ${circuitLayout(key).name}`;
  circuit = new Circuit(circuitLayout(key), {
    key,
    canvasWidth: CANVAS_WIDTH, canvasHeight: CANVAS_HEIGHT, trackWidth: TRACK_WIDTH,
    pixelsPerMeter: TRACK_WIDTH / F1_TRACK_WIDTH_M
  });
  if (trackLayer) trackLayer.remove();
  trackLayer = createGraphics(CANVAS_WIDTH, CANVAS_HEIGHT);
  drawTrackLayer(trackLayer, circuit, createRng(42));
  placing = null;
  removingObstacle = false;
  obstacles = loadObstacles(safeLocalStorage(), key);
  refreshObstacles(false);
  refreshGarageViews(); // pourcentages et validations propres à ce circuit
  updatePanel();
}

// Snapshot de reprise : dernier champion de la lignée au garage.
function chosenSnapshot(key) {
  return garage.snapshot(key);
}

// État de confiance de la lignée sur le circuit affiché (null : jamais roulé,
// départ à 100 %).
function confidenceHere(key) {
  return garage.circuitConfidenceState(key, circuitKey);
}

// Lignées sauvegardées : reprise depuis leur dernière génération ; sinon génération 0.
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
  refreshGarageViews();
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
  else if (!placing && !removingObstacle) drawIdleMessage();
  drawPlacementPreview();
  drawCanvasNotice();
  if (frameCount % PANEL_EVERY === 0) updatePanel();
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
  refreshGarageViews();
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
  text("Choisissez des voitures, puis « Entraîner sur ce circuit »", width / 2, height / 2 - (statusMessage ? 16 : 0));
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

// Résumé au-dessus des lignées : générations, voitures en piste, vitesse
// atteinte, niveau du parcours et dernier message.
function summaryHtml() {
  const parts = [];
  if (training) parts.push(`${generationsPlayed} génération(s) terminée(s)`);
  if (training || demo) parts.push(`en piste ${cars.filter((c) => c.racing).length}/${cars.length}`);
  const speed = effectiveSpeedText();
  if (speed) parts.push(speed);
  let html = parts.join(" · ");
  const level = levelInfoHtml();
  if (level) html += (html ? "<br>" : "") + level;
  if (statusMessage) html += (html ? "<br>" : "") + `<span class="saved-tag">${statusMessage}</span>`;
  if (garage.lastError) html += `<br>Sauvegarde impossible : ${garage.lastError.message}`;
  return html;
}

function updatePanel() {
  ui.summary.innerHTML = summaryHtml();
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
  if (keys.length === 0) return "";
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

// ---------- Obstacles (obstacle.js, obstacle-editor.js, vitrine des obstacles) ----------

function bindObstacles() {
  const pixelsPerMeter = TRACK_WIDTH / F1_TRACK_WIDTH_M;
  obstacleProtos = loadProtos(safeLocalStorage());
  obstacleShowroom = new ObstacleShowroom({
    dialog: document.getElementById("obstacleShowroomDialog"),
    grid: document.getElementById("obstacleGrid"),
    hint: document.getElementById("obstacleShowroomHint"),
    status: document.getElementById("obstacleShowroomStatus"),
    placeModeButton: document.getElementById("obstacleModePlace"),
    randomModeButton: document.getElementById("obstacleModeRandom"),
    randomBar: document.getElementById("obstacleRandomBar"),
    randomButton: document.getElementById("obstacleRandomButton"),
    drawButton: document.getElementById("obstacleDrawButton"),
    catalog: () => obstacleCatalog(obstacleProtos),
    onPlace: (model) => startPlacing(obstacleShape(model, pixelsPerMeter)),
    onRandom: placeObstaclesAtRandom,
    onDraw: () => {
      obstacleShowroom.close();
      obstacleEditor.open();
    },
    onRemove: (model) => {
      obstacleProtos = obstacleProtos.filter((p) => p.id !== model.id);
      saveProtos(safeLocalStorage(), obstacleProtos);
    }
  });
  // Le dessin devient un prototype de la vitrine, qui s'ouvre sur lui.
  obstacleEditor = new ObstacleEditor({
    dialog: document.getElementById("obstacleDialog"),
    canvas: document.getElementById("obstacleCanvas"),
    sizeSlider: document.getElementById("obstacleSize"),
    sizeValue: document.getElementById("obstacleSizeValue"),
    status: document.getElementById("obstacleEditorStatus"),
    saveButton: document.getElementById("obstacleSaveButton"),
    presets: document.getElementById("obstaclePresets"),
    nextName: () => nextProtoName(obstacleProtos),
    onSave: (points, sizeMeters) => {
      let proto;
      try {
        proto = createProto(obstacleProtos, points, sizeMeters);
      } catch (error) {
        document.getElementById("obstacleEditorStatus").textContent = error.message;
        return;
      }
      obstacleProtos.push(proto);
      saveProtos(safeLocalStorage(), obstacleProtos);
      obstacleEditor.clear();
      obstacleEditor.close();
      obstacleShowroom.open("place", proto.id);
      obstacleShowroom.showStatus(`${proto.name} ajouté à la vitrine.`);
    }
  });
  document.getElementById("obstacleShowroomButton").addEventListener("click", () => obstacleShowroom.open("place"));
  document.getElementById("randomObstaclesButton").addEventListener("click", () => obstacleShowroom.open("random"));
  document.getElementById("obstacleShowroomClose").addEventListener("click", () => obstacleShowroom.close());
  document.getElementById("obstacleEditorClose").addEventListener("click", () => obstacleEditor.close());
  document.getElementById("obstacleUndo").addEventListener("click", () => obstacleEditor.undo());
  document.getElementById("obstacleClear").addEventListener("click", () => obstacleEditor.clear());
  document.getElementById("clearObstaclesButton").addEventListener("click", () => {
    obstacles = [];
    refreshObstacles();
    notify(`Tous les obstacles de ${circuit.name} sont retirés.`);
  });
  document.getElementById("removeObstacleButton").addEventListener("click", () => {
    placing = null;
    removingObstacle = obstacles.length > 0;
    if (!removingObstacle) notify(`Aucun obstacle sur ${circuit.name}.`);
  });
  // Placement : clic sur le circuit ; R tourne, Échap annule.
  document.querySelector("#canvas-container canvas").addEventListener("pointerdown", onCanvasPointerDown);
  document.addEventListener("keydown", onPlacementKey);
}

// Placement aléatoire demandé dans la vitrine : ajoute aux obstacles actuels.
function placeObstaclesAtRandom(requests) {
  const result = placeRandomObstacles(circuit, requests, obstacles, rng, TRACK_WIDTH / F1_TRACK_WIDTH_M);
  placing = null;
  removingObstacle = false;
  obstacles.push(...result.placed);
  refreshObstacles();
  notify(result.missing === 0
    ? `${result.placed.length} obstacle(s) placé(s) au hasard sur ${circuit.name}.`
    : `${result.placed.length} obstacle(s) sur ${result.requested} placé(s) : plus assez de place libre sur ${circuit.name}.`);
}

function startPlacing(shape) {
  placing = { shape, rotation: 0 };
  removingObstacle = false;
}

// Position du pointeur dans le repère du canvas (taille affichée ≠ taille réelle possible).
function canvasPoint(event) {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: ((event.clientX - rect.left) / rect.width) * width, y: ((event.clientY - rect.top) / rect.height) * height };
}

function onCanvasPointerDown(event) {
  const point = canvasPoint(event);
  if (placing) {
    obstacles.push(new Obstacle(point.x, point.y, placing.shape, placing.rotation));
    placing = null;
    refreshObstacles();
    notify("Obstacle posé : les rayons le voient, une voiture qui le touche est éliminée.");
  } else if (removingObstacle) {
    const index = obstacleIndexAt(obstacles, point);
    if (index === -1) {
      notify("Aucun obstacle ici : cliquez sur un obstacle, ou Échap pour annuler.");
      return;
    }
    obstacles.splice(index, 1);
    removingObstacle = false;
    refreshObstacles();
    notify("Obstacle retiré.");
  }
}

function onPlacementKey(event) {
  if (event.key === "Escape" && (placing || removingObstacle)) {
    placing = null;
    removingObstacle = false;
    notify("Annulé.");
  } else if (placing && (event.key === "r" || event.key === "R")) {
    placing.rotation += OBSTACLE_ROTATION_STEP;
  }
}

// Message temporaire affiché en haut du circuit.
function notify(text) {
  canvasNotice = { text, until: millis() + NOTICE_DURATION_MS };
}

// Bandeau en haut du circuit : consigne du mode en cours, sinon dernier message.
function drawCanvasNotice() {
  let message = null;
  if (placing) message = "Cliquez sur le circuit pour poser l'obstacle · R : tourner · Échap : annuler";
  else if (removingObstacle) message = "Cliquez sur l'obstacle à retirer · Échap : annuler";
  else if (canvasNotice && millis() < canvasNotice.until) message = canvasNotice.text;
  if (!message) return;
  push();
  noStroke();
  fill(0, 180);
  rectMode(CORNER);
  rect(0, 0, width, 34);
  fill(255, 230, 0);
  textAlign(CENTER, CENTER);
  textSize(15);
  text(message, width / 2, 17);
  pop();
}

// Aperçu de l'obstacle sous le pointeur pendant le placement.
function drawPlacementPreview() {
  if (!placing || mouseX < 0 || mouseY < 0 || mouseX > width || mouseY > height) return;
  new Obstacle(mouseX, mouseY, placing.shape, placing.rotation).show(true);
}

// Recalcule les murs et (par défaut) mémorise les obstacles.
function refreshObstacles(save = true) {
  obstacleWallList = obstacleWalls(obstacles);
  if (save) saveObstacles(safeLocalStorage(), circuitKey, obstacles);
}

// ---------- Modèles en fichier (model-file.js) ----------

// Téléchargement d'un modèle : fichier JSON nommé marque_modele_genN.json.
function downloadModel(key) {
  try {
    const data = exportModelFile(garage, key);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = modelFileName(data);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0); // libère le fichier temporaire
    showModelStatus(`${key} génération ${data.generation} téléchargée (${link.download}).`);
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
      `(${NeuralNetwork.fromConfig(currentNetworkConfig()).describe()}). Appliquez d'abord ce réseau et ces rayons (« Réseau de neurones », « Rayons »).`, true);
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
  refreshGarageViews();
  showModelStatus(`${key} génération ${data.generation} ${replaced ? "a remplacé la lignée du garage" : "est au garage"} : sélectionnez-la puis « Entraîner » pour reprendre à la génération ${data.generation + 1}.`);
}

function showModelStatus(message, isError = false) {
  ui.modelStatus.textContent = message;
  ui.modelStatus.classList.toggle("error", isError);
}

// Après un changement du garage : vitrine des voitures (si ouverte) et
// lignées affichées au repos (pourcentages sur le circuit actuel).
function refreshGarageViews() {
  if (showroom && showroom.options.dialog.open) showroom.refresh();
  if (ui.summary) updatePanel();
}
