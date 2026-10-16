import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { createMemoryStorage, loadExample } from "./p5-adapter.mjs";

const ex = loadExample();
const monza = new ex.Circuit(ex.F1_CIRCUITS.monza);
const MODEL = { brand: "Tiyoti", model: "Supraa GT" };
const KEY = "Tiyoti | Supraa GT";
const plain = (value) => JSON.parse(JSON.stringify(value));

// Chaque test repart de l'architecture du fichier network-config.js.
beforeEach(() => ex.useStoredArchitecture(null));

// Garage contenant une lignée entraînée avec l'architecture courante.
function garageWithLineage(storage) {
  const garage = new ex.Garage(storage);
  const car = ex.createTrainingPopulation(monza, [MODEL], ex.createRng(1))[0];
  garage.recordChampion(car, "Monza");
  return garage;
}

test("sans réglage dans l'interface, l'architecture est celle de network-config.js", () => {
  assert.equal(ex.currentNetworkConfig(), ex.NETWORK_CONFIG);
  assert.deepEqual(plain(ex.architectureOf(ex.NETWORK_CONFIG)), plain({
    hiddenLayers: ex.NETWORK_CONFIG.hiddenLayers, hiddenActivation: ex.NETWORK_CONFIG.hiddenActivation
  }));
});

test("appliquer une nouvelle architecture : mémorisée et toutes les générations effacées", () => {
  const storage = createMemoryStorage();
  const garage = garageWithLineage(storage);
  const result = ex.applyArchitecture({ hiddenLayers: [16, 8], hiddenActivation: "relu" }, storage, garage);
  assert.deepEqual(plain(result), { changed: true, erased: 1 });
  assert.deepEqual(plain(garage.keys()), []);
  assert.deepEqual(plain(new ex.Garage(storage).keys()), []); // effacement persistant
  assert.deepEqual(plain(JSON.parse(storage.getItem(ex.ARCHITECTURE_STORAGE_KEY))), { hiddenLayers: [16, 8], hiddenActivation: "relu" });
  const config = ex.currentNetworkConfig();
  assert.deepEqual(plain(config.hiddenLayers), [16, 8]);
  assert.equal(config.rays, ex.NETWORK_CONFIG.rays); // les entrées ne changent pas
});

test("les nouvelles voitures utilisent l'architecture appliquée", () => {
  const storage = createMemoryStorage();
  ex.applyArchitecture({ hiddenLayers: [12, 6, 4], hiddenActivation: "tanh" }, storage, new ex.Garage(storage));
  const cars = ex.createTrainingPopulation(monza, [MODEL], ex.createRng(2));
  for (const car of cars) {
    assert.deepEqual(plain(car.brain.layers), [ex.NETWORK_CONFIG.rays + 1, 12, 6, 4, 2]);
    assert.equal(car.brain.hiddenActivation, "tanh");
  }
  const inputs = cars[0].sense();
  assert.equal(cars[0].think(inputs).mag() <= cars[0].maxForce + 1e-9, true);
});

test("ajouter puis supprimer des couches : 0 couche cachée possible", () => {
  const storage = createMemoryStorage();
  const garage = new ex.Garage(storage);
  ex.applyArchitecture({ hiddenLayers: [], hiddenActivation: "sigmoid" }, storage, garage);
  const car = new ex.Car(monza, { ...ex.createRandomSpecForModel("Tiyoti", "Supraa GT", ex.createRng(1)) });
  assert.deepEqual(plain(car.brain.layers), [ex.NETWORK_CONFIG.rays + 1, 2]);
});

test("même architecture que l'actuelle : rien n'est effacé", () => {
  const storage = createMemoryStorage();
  const garage = garageWithLineage(storage);
  const result = ex.applyArchitecture(ex.architectureOf(ex.currentNetworkConfig()), storage, garage);
  assert.deepEqual(plain(result), { changed: false, erased: 0 });
  assert.deepEqual(plain(garage.keys()), [KEY]);
});

test("architecture invalide : erreur explicite, rien n'est effacé ni changé", () => {
  const storage = createMemoryStorage();
  const garage = garageWithLineage(storage);
  const invalid = [
    { hiddenLayers: [0], hiddenActivation: "sigmoid" },
    { hiddenLayers: [65], hiddenActivation: "sigmoid" },
    { hiddenLayers: [2.5], hiddenActivation: "sigmoid" },
    { hiddenLayers: new Array(ex.MAX_HIDDEN_LAYERS + 1).fill(4), hiddenActivation: "sigmoid" },
    { hiddenLayers: [8], hiddenActivation: "softmax" },
    { hiddenLayers: "8", hiddenActivation: "sigmoid" },
    null
  ];
  for (const architecture of invalid) {
    assert.throws(() => ex.applyArchitecture(architecture, storage, garage), /invalide|Architecture/);
  }
  assert.deepEqual(plain(garage.keys()), [KEY]);
  assert.equal(storage.getItem(ex.ARCHITECTURE_STORAGE_KEY), null);
  assert.equal(ex.currentNetworkConfig(), ex.NETWORK_CONFIG);
});

test("revenir à network-config.js efface aussi et supprime le réglage mémorisé", () => {
  const storage = createMemoryStorage();
  const garage = new ex.Garage(storage);
  ex.applyArchitecture({ hiddenLayers: [10], hiddenActivation: "sigmoid" }, storage, garage);
  garage.recordChampion(ex.createTrainingPopulation(monza, [MODEL], ex.createRng(3))[0], "Monza");
  const result = ex.resetArchitecture(storage, garage);
  assert.deepEqual(plain(result), { changed: true, erased: 1 });
  assert.equal(storage.getItem(ex.ARCHITECTURE_STORAGE_KEY), null);
  assert.equal(ex.currentNetworkConfig(), ex.NETWORK_CONFIG);
});

test("rechargement de la page : l'architecture mémorisée est relue ; illisible → fichier", () => {
  const storage = createMemoryStorage({ [ex.ARCHITECTURE_STORAGE_KEY]: JSON.stringify({ hiddenLayers: [5, 5], hiddenActivation: "relu" }) });
  ex.useStoredArchitecture(storage);
  assert.deepEqual(plain(ex.currentNetworkConfig().hiddenLayers), [5, 5]);
  ex.useStoredArchitecture(createMemoryStorage({ [ex.ARCHITECTURE_STORAGE_KEY]: "{cassé" }));
  assert.equal(ex.currentNetworkConfig(), ex.NETWORK_CONFIG);
  ex.useStoredArchitecture(createMemoryStorage({ [ex.ARCHITECTURE_STORAGE_KEY]: JSON.stringify({ hiddenLayers: [0], hiddenActivation: "relu" }) }));
  assert.equal(ex.currentNetworkConfig(), ex.NETWORK_CONFIG);
});

test("garde-fou : les lignées d'une autre architecture sont retirées du garage", () => {
  const storage = createMemoryStorage();
  const garage = garageWithLineage(storage); // 6 → 20 → 2 sigmoid
  const other = new ex.Car(monza, { ...ex.createRandomSpecForModel("Ferraaa", "F40o", ex.createRng(1)) },
    0, new ex.NeuralNetwork([6, 16, 8, 2], ex.createRng(1), "relu"));
  garage.recordChampion(other, "Monza");
  assert.equal(garage.removeIncompatible([16, 8], "relu"), 1);
  assert.deepEqual(plain(new ex.Garage(storage).keys()), ["Ferraaa | F40o"]);
  assert.equal(garage.removeIncompatible([16, 8], "relu"), 0);
});

test("sameArchitecture compare couches et activation", () => {
  assert.equal(ex.sameArchitecture({ hiddenLayers: [8, 4], hiddenActivation: "relu" }, { hiddenLayers: [8, 4], hiddenActivation: "relu" }), true);
  assert.equal(ex.sameArchitecture({ hiddenLayers: [8, 4], hiddenActivation: "relu" }, { hiddenLayers: [8], hiddenActivation: "relu" }), false);
  assert.equal(ex.sameArchitecture({ hiddenLayers: [8], hiddenActivation: "relu" }, { hiddenLayers: [8], hiddenActivation: "tanh" }), false);
});
