import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryStorage, loadExample } from "./p5-adapter.mjs";

const ex = loadExample();
const monza = new ex.Circuit(ex.F1_CIRCUITS.monza, { key: "monza" });
const spa = new ex.Circuit(ex.F1_CIRCUITS.spa, { key: "spa" });
const A = { brand: "Tiyoti", model: "Supraa GT" };
const B = { brand: "Ferraaa", model: "F40o" };
const KEY_A = "Tiyoti | Supraa GT";
const KEY_B = "Ferraaa | F40o";
const SECOND = 60;
const plain = (value) => JSON.parse(JSON.stringify(value));

// Voiture d'une lignée avec une course imposée sur un circuit.
function runOn(circuit, model, progress, frames = 10 * SECOND, generation = 0, seed = 1) {
  const car = ex.createTrainingPopulation(circuit, [model], ex.createRng(seed))[0];
  car.lap.distance = progress * circuit.totalLength;
  car.framesAlive = frames;
  car.generation = generation;
  return car;
}

// ---------- 1 tour max ----------

test("entraînement : jamais plus d'un tour, sur un circuit F1 comme sur un niveau", () => {
  assert.equal(ex.MAX_LAPS, 1);
  const car = runOn(monza, A, 0);
  assert.equal(car.raceLaps, 1);
  car.vel.set(0, 0);
  car.lap.distance = monza.totalLength; // tour bouclé
  car.update();
  assert.equal(car.finished, true);
  assert.equal(car.racing, false);
});

// ---------- Fiche par circuit ----------

test("fiche du circuit : meilleur pourcentage, confiance et validation, circuit par circuit", () => {
  const garage = new ex.Garage(createMemoryStorage());
  garage.recordChampion(runOn(monza, A, 0.4, 600, 0), "Monza (Italie)");
  const record = garage.circuitRecord(KEY_A, "monza");
  assert.ok(Math.abs(record.bestProgress - 0.4) < 1e-9);
  assert.equal(record.bestGeneration, 0);
  assert.equal(record.trained, null);
  assert.equal(record.confidence, 0.5); // génération suivante = 1re après le départ → 50 %
  assert.equal(record.confidenceState.runs, 1);
  assert.ok(Math.abs(record.confidenceState.lastProgress - 0.4) < 1e-9);
  assert.equal(garage.circuitRecord(KEY_A, "spa"), null); // autre circuit : rien
});

test("la génération précédente finit le circuit → confiance 100 % et voiture entraînée dans ce circuit", () => {
  const garage = new ex.Garage(createMemoryStorage());
  garage.recordChampion(runOn(monza, A, 0.5, 600, 0), "Monza (Italie)");
  assert.equal(garage.isTrainedOn(KEY_A, "monza"), false);
  garage.recordChampion(runOn(monza, A, 1, 900, 1), "Monza (Italie)", 42);
  const record = garage.circuitRecord(KEY_A, "monza");
  assert.equal(record.confidence, ex.CONFIDENCE_MAX);
  assert.equal(record.bestProgress, 1);
  assert.deepEqual(plain(record.trained), { generation: 1, savedAt: 42 });
  assert.equal(garage.isTrainedOn(KEY_A, "monza"), true);
  assert.equal(garage.isTrainedOn(KEY_A, "spa"), false);
  assert.deepEqual(plain(garage.trainedCircuits(KEY_A)), [{ circuitKey: "monza", name: "Monza (Italie)", generation: 1 }]);
});

test("le pourcentage dépend du circuit sélectionné", () => {
  const garage = new ex.Garage(createMemoryStorage());
  garage.recordChampion(runOn(monza, A, 0.8, 600, 0), "Monza (Italie)");
  garage.recordChampion(runOn(spa, A, 0.25, 600, 1), "Spa-Francorchamps (Belgique)");
  assert.ok(Math.abs(garage.circuitRecord(KEY_A, "monza").bestProgress - 0.8) < 1e-9);
  assert.ok(Math.abs(garage.circuitRecord(KEY_A, "spa").bestProgress - 0.25) < 1e-9);
  // Les états de confiance sont séparés eux aussi (la voiture porte l'état de sa génération).
  const second = runOn(monza, A, 0.9, 600, 2);
  second.spec.confidenceState = garage.circuitConfidenceState(KEY_A, "monza");
  garage.recordChampion(second, "Monza (Italie)");
  assert.equal(garage.circuitConfidenceState(KEY_A, "monza").runs, 2);
  assert.equal(garage.circuitConfidenceState(KEY_A, "spa").runs, 1);
});

test("fiche : le record ne régresse pas, la confiance suit la règle des générations", () => {
  const garage = new ex.Garage(createMemoryStorage());
  // La voiture porte l'état de confiance de sa génération (comme en course réelle).
  const run = (p, gen, state) => {
    const car = runOn(monza, A, p, 600, gen);
    car.spec.confidenceState = state;
    garage.recordChampion(car, "Monza");
    return garage.circuitConfidenceState(KEY_A, "monza");
  };
  let state = run(0.7, 0, ex.initialConfidenceState());
  assert.equal(state.confidence, 0.5);  // génération 1 : 50 %
  state = run(0.1, 1, state);
  assert.equal(state.confidence, 0.5);  // génération 2 : 50 %
  state = run(0.2, 2, state);           // génération 3 : gén 2 - gén 1 = +10 points → 100 %
  assert.equal(state.confidence, 1);
  state = run(0.215, 3, state);         // +1,5 point → baisse de 25 points
  assert.equal(state.confidence, 0.75);
  state = run(0.217, 4, state);         // +0,2 point → baisse de 50 points, plancher 50 %
  assert.equal(state.confidence, 0.5);
  const record = garage.circuitRecord(KEY_A, "monza");
  assert.ok(Math.abs(record.bestProgress - 0.7) < 1e-9);
  assert.equal(record.bestGeneration, 0);
});

test("fiche : à 100 %, l'arrivée la plus rapide devient le record", () => {
  const garage = new ex.Garage(createMemoryStorage());
  garage.recordChampion(runOn(monza, A, 1, 1200, 3), "Monza");
  garage.recordChampion(runOn(monza, A, 1, 900, 4), "Monza");
  const record = garage.circuitRecord(KEY_A, "monza");
  assert.equal(record.bestFrames, 900);
  assert.equal(record.trained.generation, 3); // validé à la première arrivée
});

// ---------- Génération suivante ----------

test("nextGeneration : une lignée qui a bouclé le circuit ne s'y entraîne plus", () => {
  const rng = ex.createRng(5);
  const cars = ex.createTrainingPopulation(monza, [A, B], rng);
  const groups = ex.groupByLineage(cars);
  groups.get(KEY_A)[2].lap.distance = monza.totalLength;      // A boucle le tour
  groups.get(KEY_B)[1].lap.distance = 0.5 * monza.totalLength; // B progresse
  const next = ex.nextGeneration(cars, monza, rng);
  assert.deepEqual(plain([...ex.groupByLineage(next).keys()]), [KEY_B]);
  assert.equal(next.length, groups.get(KEY_B).length);
});

test("nextGeneration : toutes les lignées ont bouclé → plus aucune voiture", () => {
  const rng = ex.createRng(6);
  const cars = ex.createTrainingPopulation(monza, [A], rng);
  cars[0].lap.distance = monza.totalLength;
  assert.equal(ex.nextGeneration(cars, monza, rng).length, 0);
});

test("reprise sur un circuit : confiance mémorisée de ce circuit", () => {
  const garage = new ex.Garage(createMemoryStorage());
  garage.recordChampion(runOn(monza, A, 0.9, 25 * SECOND, 7), "Monza");
  const expected = garage.circuitConfidence(KEY_A, "monza");
  const cars = ex.createTrainingPopulation(monza, [A], ex.createRng(2),
    (k) => garage.snapshot(k), (k) => garage.circuitConfidenceState(k, "monza"));
  for (const car of cars) {
    assert.equal(car.confidence, expected);
    assert.equal(car.generation, 8);
  }
});

// ---------- Parcours ----------

test("Curriculum : niveaux déjà validés sautés, lignées restantes", () => {
  const c = new ex.Curriculum(["l1", "l2", "l3"], [KEY_A, KEY_B]);
  c.markPassed(KEY_A);
  assert.deepEqual(plain(c.remainingLineages()), [KEY_B]);
  assert.equal(c.advanceIfComplete(), "continue");
  c.markPassed(KEY_B);
  assert.equal(c.advanceIfComplete(), "level-passed");
  assert.equal(c.currentLevel, "l2");
  c.markPassed(KEY_A);
  c.markPassed(KEY_B);
  assert.equal(c.advanceIfComplete(), "level-passed");
  c.markPassed(KEY_A, 12);
  c.markPassed(KEY_B, 15);
  assert.equal(c.advanceIfComplete(), "finished");
  assert.equal(c.passedAt.get(KEY_B), 15);
  assert.deepEqual(plain(c.remainingLineages()), []);
  c.markPassed("Inconnue | X"); // ignoré
});
