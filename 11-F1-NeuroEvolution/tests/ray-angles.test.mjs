import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { createMemoryStorage, loadExample } from "./p5-adapter.mjs";

const ex = loadExample();
const monza = new ex.Circuit(ex.F1_CIRCUITS.monza, { key: "monza" });
const MODEL = { brand: "Tiyoti", model: "Supraa GT" };
const plain = (value) => JSON.parse(JSON.stringify(value));

beforeEach(() => ex.useStoredArchitecture(null));

// ---------- Configuration ----------

test("par défaut : 5 rayons à -60, -30, 0, 30, 60° et 6 neurones d'entrée (5 rayons + vitesse)", () => {
  assert.deepEqual(plain(ex.rayAnglesFromConfig(ex.NETWORK_CONFIG)), [-60, -30, 0, 30, 60]);
  assert.equal(ex.layerSizesFromConfig(ex.NETWORK_CONFIG)[0], 6);
});

test("ancienne écriture rays + rayFovDegrees toujours comprise", () => {
  assert.deepEqual(plain(ex.rayAnglesFromConfig({ rays: 3, rayFovDegrees: 90 })), [-45, 0, 45]);
  assert.deepEqual(plain(ex.evenRayAngles(1, 120)), [0]);
});

test("un rayon de plus = un neurone d'entrée de plus", () => {
  const base = { hiddenLayers: [20], hiddenActivation: "sigmoid" };
  assert.deepEqual(plain(ex.layerSizesFromConfig({ ...base, rayAngles: [-90, -45, 0, 45, 90, 180] })), [7, 20, 2]);
  assert.deepEqual(plain(ex.layerSizesFromConfig({ ...base, rayAngles: [0] })), [2, 20, 2]);
});

test("angles invalides refusés : aucun, trop, hors bornes, en double", () => {
  assert.match(ex.validateRayAngles([]), /de 1 à 15/);
  assert.match(ex.validateRayAngles(Array.from({ length: 16 }, (_, i) => i * 10)), /de 1 à 15/);
  assert.match(ex.validateRayAngles([0, 200]), /entre -180/);
  assert.match(ex.validateRayAngles([0, NaN]), /entre -180/);
  assert.match(ex.validateRayAngles([30, 30]), /même angle/);
  assert.equal(ex.validateRayAngles([-170, 0, 12.5]), null);
  assert.throws(() => ex.layerSizesFromConfig({ rayAngles: [0, 0], hiddenLayers: [8], hiddenActivation: "sigmoid" }), /rayAngles/);
});

// ---------- Éditeur (fonctions pures) ----------

test("ajouter, modifier, supprimer un rayon ; la liste reste triée", () => {
  let r = ex.addRayAngle([-60, 0, 60], "90");
  assert.deepEqual(plain(r), { angles: [-60, 0, 60, 90], error: null });
  r = ex.addRayAngle(r.angles, -120);
  assert.deepEqual(plain(r.angles), [-120, -60, 0, 60, 90]);
  r = ex.setRayAngle(r.angles, 0, 15);
  assert.deepEqual(plain(r.angles), [-60, 0, 15, 60, 90]);
  r = ex.removeRayAngle(r.angles, 1);
  assert.deepEqual(plain(r.angles), [-60, 15, 60, 90]);
});

test("éditeur : refus avec message, liste inchangée", () => {
  assert.deepEqual(plain(ex.addRayAngle([0, 30], 30)), { angles: [0, 30], error: "deux rayons ont le même angle" });
  assert.match(ex.addRayAngle([0], 500).error, /entre -180/);
  assert.match(ex.addRayAngle(Array.from({ length: 15 }, (_, i) => i), 99).error, /de 1 à 15/);
  assert.match(ex.setRayAngle([0, 30], 0, 30).error, /même angle/);
  assert.deepEqual(plain(ex.removeRayAngle([0], 0)), { angles: [0], error: "au moins 1 rayon" });
});

test("texte de la couche d'entrée", () => {
  assert.equal(ex.inputLayerDescription([-60, -30, 0, 30, 60]), "Couche d'entrée : 5 rayons + 1 vitesse = 6 neurones");
  assert.equal(ex.inputLayerDescription([0]), "Couche d'entrée : 1 rayon + 1 vitesse = 2 neurones");
});

// ---------- Voitures ----------

test("la voiture lance ses rayons aux angles choisis, même dissymétriques", () => {
  const spec = { ...ex.createRandomSpecForModel("Tiyoti", "Supraa GT", ex.createRng(1)), rayAngles: [-90, 0, 45, 180] };
  const car = new ex.Car(monza, spec, 0, new ex.NeuralNetwork([5, 8, 2], ex.createRng(2)));
  assert.equal(car.rayCount, 4);
  const expected = [-90, 0, 45, 180].map((a) => car.heading + (a * Math.PI) / 180);
  expected.forEach((angle, i) => assert.ok(Math.abs(car.rayAngle(i) - angle) < 1e-12));
  const inputs = car.sense();
  assert.equal(inputs.length, 5);
  // Rayon à -90° : mur de bord de piste à environ une demi-largeur.
  assert.ok(car.rayDistances[0] < monza.trackWidth);
});

test("angles incompatibles avec le cerveau → répartition régulière (anciens modèles)", () => {
  const spec = { ...ex.createRandomSpecForModel("Tiyoti", "Supraa GT", ex.createRng(1)), rayAngles: [0, 10], rayFovDegrees: 90 };
  const car = new ex.Car(monza, spec, 0, new ex.NeuralNetwork([4, 2], ex.createRng(2)));
  assert.equal(car.rayCount, 3);
  assert.ok(Math.abs(car.rayAngle(0) - (car.heading - Math.PI / 4)) < 1e-12);
});

// ---------- Appliquer de nouveaux rayons ----------

test("appliquer de nouveaux rayons : couche d'entrée agrandie, générations effacées", () => {
  const storage = createMemoryStorage();
  const garage = new ex.Garage(storage);
  garage.recordChampion(ex.createTrainingPopulation(monza, [MODEL], ex.createRng(1))[0], "Monza");
  const angles = [-90, -60, -30, 0, 30, 60, 90];
  const result = ex.applyArchitecture({ ...ex.architectureOf(ex.currentNetworkConfig()), rayAngles: angles }, storage, garage);
  assert.deepEqual(plain(result), { changed: true, erased: 1 });
  assert.deepEqual(plain(ex.rayAnglesFromConfig(ex.currentNetworkConfig())), angles);
  const cars = ex.createTrainingPopulation(monza, [MODEL], ex.createRng(2));
  for (const car of cars) {
    assert.equal(car.brain.inputNodes, 8);
    assert.deepEqual(plain(car.spec.rayAngles), angles);
  }
  // Mémorisé : relu au chargement de la page.
  ex.useStoredArchitecture(storage);
  assert.deepEqual(plain(ex.rayAnglesFromConfig(ex.currentNetworkConfig())), angles);
});

test("même nombre de rayons mais angles différents : c'est un changement (efface aussi)", () => {
  const storage = createMemoryStorage();
  const garage = new ex.Garage(storage);
  garage.recordChampion(ex.createTrainingPopulation(monza, [MODEL], ex.createRng(1))[0], "Monza");
  const result = ex.applyArchitecture({ ...ex.architectureOf(ex.NETWORK_CONFIG), rayAngles: [-80, -40, 0, 40, 80] }, storage, garage);
  assert.equal(result.changed, true);
  assert.equal(garage.keys().length, 0);
  assert.equal(ex.applyArchitecture({ ...ex.architectureOf(ex.currentNetworkConfig()) }, storage, garage).changed, false);
});

test("garde-fous : modèle du garage ou fichier avec une autre couche d'entrée", () => {
  const garage = new ex.Garage(createMemoryStorage());
  garage.recordChampion(ex.createTrainingPopulation(monza, [MODEL], ex.createRng(1))[0], "Monza"); // 6 entrées
  assert.equal(garage.removeIncompatible([20], "sigmoid", 6), 0);
  assert.equal(garage.removeIncompatible([20], "sigmoid", 8), 1);

  const other = new ex.Garage(createMemoryStorage());
  other.recordChampion(ex.createTrainingPopulation(monza, [MODEL], ex.createRng(1))[0], "Monza");
  const data = ex.parseModelFile(JSON.stringify(ex.exportModelFile(other, "Tiyoti | Supraa GT")));
  assert.equal(ex.modelMatchesArchitecture(data, ex.NETWORK_CONFIG), true);
  assert.equal(ex.modelMatchesArchitecture(data, { ...ex.NETWORK_CONFIG, rayAngles: [-45, 0, 45] }), false);
});

test("libellés du réseau avec les angles choisis", () => {
  const labels = ex.networkLabels([4, 8, 2], [-90, 15, 180]);
  assert.deepEqual(plain(labels.inputs), ["rayon 1 (-90°)", "rayon 2 (+15°)", "rayon 3 (+180°)", "vitesse"]);
  assert.deepEqual(plain(ex.networkLabels([4, 2], 90).inputs), ["rayon 1 (-45°)", "rayon 2 (+0°)", "rayon 3 (+45°)", "vitesse"]);
});
