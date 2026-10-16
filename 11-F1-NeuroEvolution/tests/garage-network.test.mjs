import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryStorage, loadExample } from "./p5-adapter.mjs";

const ex = loadExample();
const monza = new ex.Circuit(ex.F1_CIRCUITS.monza);
const MODEL = { brand: "Tiyoti", model: "Supraa GT" };
const KEY = "Tiyoti | Supraa GT";
// Les objets créés dans le contexte vm ont d'autres prototypes : on compare en JSON.
const plain = (value) => JSON.parse(JSON.stringify(value));

// Voiture de la lignée avec une progression imposée.
function carWithProgress(progress, generation, seed = 1) {
  const cars = ex.createTrainingPopulation(monza, [MODEL], ex.createRng(seed));
  const car = cars[0];
  car.lap.distance = progress * monza.totalLength;
  car.generation = generation;
  return car;
}

// ---------- Topologie (network-config.js) ----------

test("layerSizesFromConfig : entrées = rayons + vitesse, couches cachées, 2 sorties", () => {
  assert.deepEqual([...ex.layerSizesFromConfig({ rays: 5, rayFovDegrees: 120, hiddenLayers: [20], hiddenActivation: "sigmoid" })], [6, 20, 2]);
  assert.deepEqual([...ex.layerSizesFromConfig({ rays: 7, rayFovDegrees: 180, hiddenLayers: [16, 8], hiddenActivation: "relu" })], [8, 16, 8, 2]);
  assert.deepEqual([...ex.layerSizesFromConfig({ rays: 3, rayFovDegrees: 90, hiddenLayers: [], hiddenActivation: "tanh" })], [4, 2]);
});

test("layerSizesFromConfig : configuration invalide → message explicite", () => {
  const base = { rays: 5, rayFovDegrees: 120, hiddenLayers: [20], hiddenActivation: "sigmoid" };
  assert.throws(() => ex.layerSizesFromConfig({ ...base, rays: 0 }), /rays/);
  assert.throws(() => ex.layerSizesFromConfig({ ...base, hiddenLayers: [0] }), /hiddenLayers/);
  assert.throws(() => ex.layerSizesFromConfig({ ...base, hiddenLayers: 20 }), /hiddenLayers/);
  assert.throws(() => ex.layerSizesFromConfig({ ...base, hiddenActivation: "softmax" }), /hiddenActivation/);
  assert.throws(() => ex.layerSizesFromConfig({ ...base, rayFovDegrees: 0 }), /rayFovDegrees/);
});

test("network-config.js fourni est valide", () => {
  const nn = ex.NeuralNetwork.fromConfig(ex.NETWORK_CONFIG, ex.createRng(1));
  assert.equal(nn.inputNodes, ex.rayAnglesFromConfig(ex.NETWORK_CONFIG).length + 1);
  assert.equal(nn.outputNodes, 2);
});

test("réseau à deux couches cachées (relu/tanh) : prédiction, copie, mutation", () => {
  for (const activation of ["relu", "tanh"]) {
    const nn = new ex.NeuralNetwork([8, 16, 8, 2], ex.createRng(2), activation);
    const all = nn.activations([0, 0.2, 0.4, 0.6, 0.8, 1, 0.5, 0.3]);
    assert.deepEqual(plain(all.map((a) => a.length)), [8, 16, 8, 2]);
    for (const v of all[3]) assert.ok(v > 0 && v < 1, "sortie sigmoïde");
    if (activation === "relu") for (const v of all[1]) assert.ok(v >= 0);
    const clone = ex.NeuralNetwork.fromJSON(JSON.parse(JSON.stringify(nn)));
    assert.equal(clone.hiddenActivation, activation);
    assert.deepEqual(clone.predict(all[0]), nn.predict(all[0]));
  }
  assert.equal(new ex.NeuralNetwork([6, 20, 2]).parameterCount(), 6 * 20 + 20 + 20 * 2 + 2);
  assert.equal(new ex.NeuralNetwork([6, 20, 2]).describe(), "6 → 20 → 2 (sigmoid)");
  assert.throws(() => new ex.NeuralNetwork([6, 2], Math.random, "softmax"));
});

// ---------- Garage ----------

test("garage : le champion est sauvegardé et relu depuis le stockage", () => {
  const storage = createMemoryStorage();
  const garage = new ex.Garage(storage);
  const car = carWithProgress(0.4, 3);
  assert.equal(garage.recordChampion(car, "Monza", 1000), true);
  const reloaded = new ex.Garage(storage);
  const snap = reloaded.snapshot(KEY);
  assert.equal(snap.generation, 3);
  assert.ok(Math.abs(snap.progress - 0.4) < 1e-9);
  assert.equal(snap.circuit, "Monza");
  assert.equal(snap.savedAt, 1000);
  assert.deepEqual(plain(snap.brain), plain(car.brain.toJSON()));
});

test("garage : historique des records seulement, dernier champion toujours mis à jour", () => {
  const garage = new ex.Garage(createMemoryStorage());
  garage.recordChampion(carWithProgress(0.2, 0), "Monza", 1);
  garage.recordChampion(carWithProgress(0.5, 1), "Monza", 2);
  assert.equal(garage.recordChampion(carWithProgress(0.5, 2), "Monza", 3), false); // égalité : pas un record
  garage.recordChampion(carWithProgress(0.9, 3), "Monza", 4);
  assert.deepEqual([...garage.generations(KEY)], [0, 1, 3]);
  assert.equal(garage.snapshot(KEY).generation, 3);
  assert.equal(garage.snapshot(KEY, 1).generation, 1);
  assert.equal(garage.snapshot(KEY, 42), null);
  assert.equal(garage.best(KEY).generation, 3);
});

test("garage : l'historique est borné à GARAGE_HISTORY_LIMIT", () => {
  const garage = new ex.Garage(createMemoryStorage());
  const car = carWithProgress(0, 0);
  for (let g = 0; g < ex.GARAGE_HISTORY_LIMIT + 5; g++) {
    car.generation = g;
    car.lap.distance = (g + 1) * 10;
    garage.recordChampion(car, "Monza", g);
  }
  assert.equal(garage.lineages[KEY].history.length, ex.GARAGE_HISTORY_LIMIT);
  assert.equal(garage.lineages[KEY].history[0].generation, 5);
});

test("garage : données corrompues ou stockage absent → garage vide, sans erreur", () => {
  const broken = new ex.Garage(createMemoryStorage({ [ex.GARAGE_STORAGE_KEY]: "{pas du json" }));
  assert.deepEqual(broken.keys(), []);
  assert.ok(broken.lastError);
  const memory = new ex.Garage(null);
  memory.recordChampion(carWithProgress(0.3, 0), "Monza");
  assert.deepEqual(memory.keys(), [KEY]);
});

test("garage : quota dépassé → erreur mémorisée, la page continue", () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error("quota"); } };
  const garage = new ex.Garage(storage);
  garage.recordChampion(carWithProgress(0.3, 0), "Monza");
  assert.equal(garage.lastError.message, "quota");
  assert.equal(garage.snapshot(KEY).generation, 0);
});

test("garage : supprimer une lignée permet de repartir de zéro", () => {
  const garage = new ex.Garage(createMemoryStorage());
  garage.recordChampion(carWithProgress(0.3, 4), "Monza");
  garage.remove(KEY);
  assert.equal(garage.has(KEY), false);
  const cars = ex.createTrainingPopulation(monza, [MODEL], ex.createRng(1), (k) => garage.snapshot(k));
  for (const car of cars) assert.equal(car.generation, 0);
});

// ---------- Reprise de l'entraînement ----------

test("reprise : la génération x du garage sert de parent, numérotation continue", () => {
  const garage = new ex.Garage(createMemoryStorage());
  const champion = carWithProgress(0.7, 12, 5);
  garage.recordChampion(champion, "Monza");
  const reloaded = new ex.Garage(garage.storage);
  const cars = ex.createTrainingPopulation(monza, [MODEL, { brand: "Ferraaa", model: "F40o" }],
    ex.createRng(2), (key) => reloaded.snapshot(key));
  const groups = ex.groupByLineage(cars);
  for (const car of groups.get(KEY)) assert.equal(car.generation, 13);
  for (const car of groups.get("Ferraaa | F40o")) assert.equal(car.generation, 0);
  const elite = groups.get(KEY)[0];
  assert.deepEqual(plain(elite.brain.toJSON()), plain(champion.brain.toJSON()));
  assert.equal(elite.startOffset, champion.startOffset);
  assert.equal(elite.spec.maxSpeed, champion.spec.maxSpeed);
  // Sans fiche de confiance fournie pour ce circuit : confiance de départ.
  assert.equal(elite.confidence, ex.CONFIDENCE_START);
});

test("reprise : un modèle sauvegardé garde sa topologie même si la configuration change", () => {
  const garage = new ex.Garage(createMemoryStorage());
  const car = new ex.Car(monza, { ...ex.createRandomSpecForModel("Tiyoti", "Supraa GT", ex.createRng(1)), rayFovDegrees: 90 },
    0, new ex.NeuralNetwork([4, 6, 6, 2], ex.createRng(3), "tanh"), 7);
  garage.recordChampion(car, "Monza");
  const cars = ex.createTrainingPopulation(monza, [MODEL], ex.createRng(2), (k) => garage.snapshot(k));
  for (const child of cars) {
    assert.deepEqual([...child.brain.layers], [4, 6, 6, 2]);
    assert.equal(child.brain.hiddenActivation, "tanh");
    assert.equal(child.rayCount, 3);
    assert.ok(Math.abs(child.rayFov - Math.PI / 2) < 1e-12);
  }
});

// ---------- Visualisation ----------

test("networkLayout : une colonne par couche, neurones dans le canvas", () => {
  const layout = ex.networkLayout([6, 20, 8, 2], 900, 620, 120);
  assert.deepEqual(layout.map((c) => c.length), [6, 20, 8, 2]);
  assert.equal(layout[0][0].x, 120);
  assert.equal(layout[3][0].x, 780);
  for (const column of layout) {
    for (const p of column) assert.ok(p.y > 0 && p.y < 620);
    for (let i = 1; i < column.length; i++) assert.ok(column[i].y > column[i - 1].y);
  }
});

test("networkLabels : angles des rayons, vitesse et sorties", () => {
  const labels = ex.networkLabels([6, 20, 2], 120);
  assert.deepEqual([...labels.inputs], ["rayon 1 (-60°)", "rayon 2 (-30°)", "rayon 3 (+0°)", "rayon 4 (+30°)", "rayon 5 (+60°)", "vitesse"]);
  assert.deepEqual([...labels.outputs], ["direction", "accélérateur"]);
  assert.deepEqual([...ex.networkLabels([2, 2], 120).inputs], ["rayon 1 (+0°)", "vitesse"]);
});
