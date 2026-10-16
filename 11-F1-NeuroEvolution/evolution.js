// Algorithme génétique par lignée (une lignée = un modèle de voiture choisi).
// Génération 0 : cerveaux et paramètres aléatoires (ou reprise depuis le
// garage). Quand toutes les voitures sont arrêtées, la meilleure de chaque
// lignée sert de base à la génération suivante : élite + enfants mutés.
const TARGET_POPULATION = 60;  // voitures en piste au total (toutes lignées)
const MIN_PER_MODEL = 8;       // taille minimale d'une lignée
const MUTATION_RATE = 0.15;    // probabilité de mutation de chaque poids (9b)
const SPEC_MUTATION = 0.1;     // mutation des paramètres : ±10 % de la plage

function lineageKey(spec) {
  return spec.brand + " | " + spec.model;
}

// Fitness = progression en tours (distance parcourue dans le bon sens ; 1 = tour bouclé).
function carFitness(car) {
  return car.lap.distance / car.circuit.totalLength;
}

// Comparaison de deux courses { progress, framesAlive, raceLaps } :
// - les deux ont fini leurs tours (raceLaps, MAX_LAPS par défaut) : la plus
//   rapide (moins d'images) gagne ;
// - sinon la plus grande progression gagne ; à égalité, la plus longue survie.
function runIsBetter(a, b) {
  const aDone = a.progress >= (a.raceLaps ?? MAX_LAPS);
  const bDone = b.progress >= (b.raceLaps ?? MAX_LAPS);
  if (aDone && bDone) return a.framesAlive < b.framesAlive;
  if (a.progress !== b.progress) return a.progress > b.progress;
  return a.framesAlive > b.framesAlive;
}

function compareCars(a, b) {
  if (runIsBetter(a, b)) return -1;
  if (runIsBetter(b, a)) return 1;
  return 0;
}

function bestCar(cars) {
  return cars.reduce((best, car) => (best === null || compareCars(car, best) < 0 ? car : best), null);
}

function populationPerModel(modelCount) {
  if (modelCount <= 0) return 0;
  return Math.max(MIN_PER_MODEL, Math.floor(TARGET_POPULATION / modelCount));
}

// Décalage latéral aléatoire sur la grille de départ (la voiture reste sur la piste).
function randomStartOffset(circuit, rng) {
  const spread = circuit.trackWidth / 2 - circuit.carWidth;
  return randomBetween(rng, -spread, spread);
}

// Vrai si la course a bouclé le tour demandé : circuit validé pour la lignée.
function runFinished(run) {
  return run.progress >= (run.raceLaps ?? MAX_LAPS);
}

// Génération 0 d'une lignée : cerveaux (architecture courante) et
// paramètres tirés au hasard ; état de confiance du circuit (départ : 100 %).
function createRandomLineage(circuit, brand, model, count, rng, confidenceState = initialConfidenceState()) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const spec = {
      ...createRandomSpecForModel(brand, model, rng),
      rayAngles: rayAnglesFromConfig(currentNetworkConfig()),
      confidence: confidenceState.confidence,
      confidenceState: { ...confidenceState }
    };
    cars.push(new Car(circuit, spec, randomStartOffset(circuit, rng), null, 0, rng));
  }
  return cars;
}

// Descendance d'un parent : 1 élite (même cerveau, mêmes paramètres, même
// place sur la grille) + des enfants mutés. Toute la génération reçoit la
// confiance du circuit (confidence.js) : par défaut, l'état du parent avancé
// d'une génération selon son résultat (progrès par rapport à la génération
// d'avant, tour bouclé). `confidenceState` l'impose (reprise, autre circuit).
// parent : { spec, brain (NeuralNetwork), generation, startOffset, progress }.
function spawnFromParent(circuit, parent, count, rng, mutationRate = MUTATION_RATE, confidenceState = null) {
  const generation = parent.generation + 1;
  const state = confidenceState ?? advanceConfidence(parent.spec.confidenceState, parent.progress, runFinished(parent));
  const confidence = state.confidence;
  const cars = [new Car(circuit, { ...parent.spec, confidence, confidenceState: { ...state } }, parent.startOffset, parent.brain.copy(), generation, rng)];
  for (let i = 1; i < count; i++) {
    const brain = parent.brain.copy().mutate(mutationRate, rng);
    const spec = { ...mutateSpec(parent.spec, rng, SPEC_MUTATION), confidence, confidenceState: { ...state } };
    cars.push(new Car(circuit, spec, randomStartOffset(circuit, rng), brain, generation, rng));
  }
  return cars;
}

// Population d'entraînement pour les modèles cochés ([{ brand, model }]).
// findSnapshot(key) retourne un snapshot du garage pour reprendre une lignée
// à partir de la génération choisie, ou null pour repartir de la génération 0.
// findConfidence(key) retourne l'état de confiance mémorisé sur CE circuit
// (null : jamais roulé dessus → départ à 100 %, génération 0 du circuit).
function createTrainingPopulation(circuit, models, rng, findSnapshot = () => null, findConfidence = () => null) {
  const perModel = populationPerModel(models.length);
  const cars = [];
  for (const { brand, model } of models) {
    const key = lineageKey({ brand, model });
    const snapshot = findSnapshot(key);
    const confidenceState = toConfidenceState(findConfidence(key));
    if (snapshot) {
      const parent = {
        spec: snapshot.spec,
        brain: NeuralNetwork.fromJSON(snapshot.brain),
        generation: snapshot.generation,
        startOffset: snapshot.startOffset ?? 0,
        progress: snapshot.progress,
        framesAlive: snapshot.framesAlive
      };
      cars.push(...spawnFromParent(circuit, parent, perModel, rng, MUTATION_RATE, confidenceState));
    } else {
      cars.push(...createRandomLineage(circuit, brand, model, perModel, rng, confidenceState));
    }
  }
  return cars;
}

function createInitialPopulation(circuit, models, rng) {
  return createTrainingPopulation(circuit, models, rng);
}

// Regroupe les voitures par lignée en conservant l'ordre d'apparition.
function groupByLineage(cars) {
  const groups = new Map();
  for (const car of cars) {
    const key = lineageKey(car.spec);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(car);
  }
  return groups;
}

// Génération suivante d'UNE lignée (toutes ses voitures sont arrêtées) : même
// effectif, construite sur le meilleur. Si le meilleur a bouclé le tour, la
// lignée a validé le circuit (confiance 100 %) : elle ne s'y entraîne plus et
// le tableau retourné est vide.
function nextLineageGeneration(group, circuit, rng, mutationRate = MUTATION_RATE) {
  const parent = bestCar(group);
  if (runFinished(parent)) return [];
  return spawnFromParent(circuit, parent, group.length, rng, mutationRate);
}

// Nouvelle génération pour toutes les lignées (sur le même circuit). Le
// tableau retourné peut être vide (toutes les lignées ont validé le circuit).
function nextGeneration(cars, circuit, rng, mutationRate = MUTATION_RATE) {
  const next = [];
  for (const group of groupByLineage(cars).values()) {
    next.push(...nextLineageGeneration(group, circuit, rng, mutationRate));
  }
  return next;
}

// Générations indépendantes par type de voiture : dès que toutes les voitures
// d'une lignée sont arrêtées, cette lignée passe à sa génération suivante, sans
// attendre les autres. onLineageEnd(key, best, group) est appelé avant (sauvegarde).
// Les lignées encore en course sont conservées telles quelles.
function advanceStoppedLineages(cars, circuit, rng, onLineageEnd = () => {}, mutationRate = MUTATION_RATE) {
  const result = [];
  for (const [key, group] of groupByLineage(cars)) {
    if (group.some((car) => car.racing)) {
      result.push(...group);
      continue;
    }
    onLineageEnd(key, bestCar(group), group);
    result.push(...nextLineageGeneration(group, circuit, rng, mutationRate));
  }
  return result;
}
