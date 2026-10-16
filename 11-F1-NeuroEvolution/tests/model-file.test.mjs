import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryStorage, loadExample } from "./p5-adapter.mjs";

const ex = loadExample();
const monza = new ex.Circuit(ex.F1_CIRCUITS.monza, { key: "monza" });
const MODEL = { brand: "Limbargana", model: "Aventadoro" };
const KEY = "Limbargana | Aventadoro";
const plain = (value) => JSON.parse(JSON.stringify(value));

// Garage avec une lignée entraînée sur deux générations ; la 1re boucle Monza.
function trainedGarage(storage = createMemoryStorage()) {
  const garage = new ex.Garage(storage);
  const cars = ex.createTrainingPopulation(monza, [MODEL], ex.createRng(1));
  const first = cars[0];
  first.lap.distance = 0.5 * monza.totalLength;
  first.framesAlive = 600;
  first.generation = 11;
  garage.recordChampion(first, "Monza (Italie)", 1);
  const second = cars[1];
  second.lap.distance = monza.totalLength;
  second.framesAlive = 900;
  second.generation = 12;
  garage.recordChampion(second, "Monza (Italie)", 2);
  return { garage, first, second };
}

// Fichier exporté puis relu, comme après un téléchargement.
const roundTrip = (data) => ex.parseModelFile(JSON.stringify(data, null, 2));

test("export : génération choisie, cerveau, paramètres, fiches par circuit et architecture", () => {
  const { garage, first, second } = trainedGarage();
  const data = ex.exportModelFile(garage, KEY, 11, 1234);
  assert.equal(data.format, ex.MODEL_FILE_FORMAT);
  assert.equal(data.version, ex.MODEL_FILE_VERSION);
  assert.equal(data.exportedAt, 1234);
  assert.equal(data.brand, "Limbargana");
  assert.equal(data.model, "Aventadoro");
  assert.equal(data.generation, 11);
  assert.deepEqual(plain(data.snapshot.brain), plain(first.brain.toJSON()));
  assert.deepEqual(plain(data.architecture.layers), plain(first.brain.layers));
  assert.equal(data.circuits.monza.trained.generation, 12);
  // Sans génération précisée : le dernier champion.
  assert.equal(ex.exportModelFile(garage, KEY).generation, second.generation);
  assert.throws(() => ex.exportModelFile(garage, KEY, 99), /Aucun modèle/);
  assert.throws(() => ex.exportModelFile(garage, "Inconnue | X"), /Aucun modèle/);
});

test("nom de fichier lisible avec le numéro de génération", () => {
  assert.equal(ex.modelFileName({ brand: "Limbargana", model: "Aventadoro", generation: 12 }), "Limbargana_Aventadoro_gen12.json");
  assert.equal(ex.modelFileName({ brand: "Porshe", model: "911 Turbu", generation: 0 }), "Porshe_911-Turbu_gen0.json");
  assert.equal(ex.modelFileName({ brand: "Tiyoti", model: "Corolo Sprint", generation: 3 }), "Tiyoti_Corolo-Sprint_gen3.json");
});

test("aller-retour fichier : le modèle rechargé conduit exactement pareil", () => {
  const { garage, first } = trainedGarage();
  const data = roundTrip(ex.exportModelFile(garage, KEY, 11));
  const brain = ex.NeuralNetwork.fromJSON(data.snapshot.brain);
  const inputs = [0.1, 0.9, 0.3, 0, 0.5, 0.7];
  assert.deepEqual(plain(brain.predict(inputs)), plain(first.brain.predict(inputs)));
});

test("chargement dans un autre garage : reprise à la génération suivante, même cerveau", () => {
  const { garage, second } = trainedGarage();
  const data = roundTrip(ex.exportModelFile(garage, KEY));
  const storage = createMemoryStorage();
  const other = new ex.Garage(storage);
  const result = ex.Garage.prototype.importLineage.call(other, data, 77);
  assert.deepEqual(plain(result), { key: KEY, replaced: false });
  const reloaded = new ex.Garage(storage); // persisté
  assert.equal(reloaded.snapshot(KEY).generation, 12);
  assert.equal(reloaded.isTrainedOn(KEY, "monza"), true);
  assert.equal(reloaded.circuitConfidence(KEY, "monza"), 1);
  const cars = ex.createTrainingPopulation(monza, [MODEL], ex.createRng(2),
    (k) => reloaded.snapshot(k), (k) => reloaded.circuitConfidence(k, "monza"));
  for (const car of cars) assert.equal(car.generation, 13);
  assert.deepEqual(plain(cars[0].brain.toJSON()), plain(second.brain.toJSON()));
  assert.equal(cars[0].spec.maxSpeed, second.spec.maxSpeed);
});

test("chargement d'une génération plus ancienne : elle remplace la lignée existante", () => {
  const { garage } = trainedGarage();
  const old = roundTrip(ex.exportModelFile(garage, KEY, 11));
  const result = garage.importLineage(old);
  assert.equal(result.replaced, true);
  assert.equal(garage.snapshot(KEY).generation, 11);
  assert.deepEqual(plain(garage.generations(KEY)), [11]);
});

test("fichiers refusés avec un message clair", () => {
  const { garage } = trainedGarage();
  const good = ex.exportModelFile(garage, KEY);
  const variant = (change) => { const d = plain(good); change(d); return JSON.stringify(d); };
  const cases = [
    ["pas du json", /illisible/],
    [JSON.stringify({ hello: 1 }), /pas un modèle/],
    [variant((d) => { d.version = 99; }), /Version/],
    [variant((d) => { d.generation = -1; }), /génération invalide/],
    [variant((d) => { d.generation = 2.5; }), /génération invalide/],
    [variant((d) => { d.model = "Inexistant"; d.snapshot.spec.model = "Inexistant"; }), /Modèle inconnu/],
    [variant((d) => { d.brand = "Tiyoti"; d.model = "Supraa GT"; }), /incohérent/],
    [variant((d) => { d.generation = 3; }), /incohérent/],
    [variant((d) => { d.snapshot.brain.weights[0].pop(); }), /Cerveau invalide/],
    [variant((d) => { d.snapshot.brain.weights[0][0][0] = "x"; }), /Cerveau invalide/],
    [variant((d) => { d.snapshot.brain.hiddenActivation = "softmax"; }), /Cerveau invalide/],
    [variant((d) => { d.snapshot.spec.maxSpeed = null; }), /Paramètres/]
  ];
  for (const [text, message] of cases) assert.throws(() => ex.parseModelFile(text), message);
  assert.doesNotThrow(() => ex.parseModelFile(JSON.stringify(good)));
});

test("architecture : un modèle d'une autre architecture est détecté", () => {
  const { garage } = trainedGarage();
  const data = roundTrip(ex.exportModelFile(garage, KEY));
  assert.equal(ex.modelMatchesArchitecture(data, ex.NETWORK_CONFIG), true);
  assert.equal(ex.modelMatchesArchitecture(data, { ...ex.NETWORK_CONFIG, hiddenLayers: [16, 8] }), false);
  assert.equal(ex.modelMatchesArchitecture(data, { ...ex.NETWORK_CONFIG, hiddenActivation: "relu" }), false);
  assert.equal(ex.describeModelArchitecture(data), "6 → 20 → 2 (sigmoid)");
});

test("validateBrainData accepte un vrai cerveau, à 0 ou 2 couches cachées", () => {
  for (const layers of [[6, 2], [6, 16, 8, 2]]) {
    const brain = new ex.NeuralNetwork(layers, ex.createRng(1));
    assert.equal(ex.validateBrainData(plain(brain.toJSON())), null);
  }
  assert.ok(ex.validateBrainData(null));
});
