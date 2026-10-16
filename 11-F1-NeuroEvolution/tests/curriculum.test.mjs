import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryStorage, loadExample } from "./p5-adapter.mjs";

const ex = loadExample();
const PPM = 44 / 14; // échelle F1 utilisée par sketch.js
const build = (key) => new ex.Circuit(ex.TRAINING_CIRCUITS[key], { pixelsPerMeter: PPM });
const plain = (value) => JSON.parse(JSON.stringify(value));

// ---------- Niveaux d'entraînement ----------

test("5 niveaux ordonnés : circulaire, carré, drift, épingles, coincé", () => {
  const keys = ex.trainingLevelKeys();
  assert.deepEqual(plain(keys), [
    "niveau-1-circulaire", "niveau-2-carre", "niveau-3-drift", "niveau-4-epingles", "niveau-5-coince"
  ]);
  keys.forEach((key, i) => {
    const level = ex.TRAINING_CIRCUITS[key];
    assert.equal(level.level, i + 1);
    assert.equal(level.raceLaps, 1);
    assert.ok(level.skill.length > 10, `${key} : compétence décrite`);
  });
});

test("chaque niveau est un circuit valide qui tient dans le canvas", () => {
  for (const key of ex.trainingLevelKeys()) {
    const circuit = build(key);
    assert.equal(circuit.hasSelfIntersection(), false, key);
    for (const p of [...circuit.leftEdge, ...circuit.rightEdge]) {
      assert.ok(p.x > 0 && p.x < 1200 && p.y > 0 && p.y < 760, key);
    }
    assert.equal(circuit.raceLaps, 1);
  }
});

test("la voiture garde la taille F1 sur tous les circuits ; piste étroite de 10 m au niveau 5", () => {
  const monza = new ex.Circuit(ex.F1_CIRCUITS.monza, { pixelsPerMeter: PPM });
  for (const key of ex.trainingLevelKeys()) {
    const circuit = build(key);
    assert.equal(circuit.carLength, monza.carLength, key);
  }
  assert.ok(Math.abs(build("niveau-5-coince").trackWidth - 10 * PPM) < 1e-9);
  assert.equal(build("niveau-1-circulaire").trackWidth, 44);
  assert.equal(monza.raceLaps, null);
});

test("sur un niveau, une voiture a terminé après 1 tour (3 tours sur un circuit F1)", () => {
  const level = build("niveau-1-circulaire");
  const spec = { ...ex.createRandomSpecForModel("Tiyoti", "Supraa GT", ex.createRng(1)), confidence: 1 };
  const car = new ex.Car(level, spec);
  assert.equal(car.raceLaps, 1);
  car.vel.set(0, 0);
  car.lap.distance = level.totalLength + 1;
  car.update();
  assert.equal(car.finished, true);
  const f1 = new ex.Car(new ex.Circuit(ex.F1_CIRCUITS.monza), spec);
  assert.equal(f1.raceLaps, ex.MAX_LAPS);
});

test("runIsBetter tient compte des tours du circuit de chaque course", () => {
  assert.equal(ex.runIsBetter({ progress: 1, raceLaps: 1, framesAlive: 600 }, { progress: 1.01, raceLaps: 1, framesAlive: 900 }), true);
  assert.equal(ex.runIsBetter({ progress: 1, raceLaps: 3, framesAlive: 600 }, { progress: 1.01, raceLaps: 3, framesAlive: 900 }), false);
});

// ---------- Curriculum ----------

const A = "Tiyoti | Supraa GT";
const B = "Ferraaa | F40o";
const run = (progress, generation = 0) => ({ progress, raceLaps: 1, generation });

test("Curriculum : on reste sur le niveau tant qu'une lignée ne l'a pas validé", () => {
  const c = new ex.Curriculum(["l1", "l2"], [A, B]);
  assert.equal(c.currentLevel, "l1");
  assert.equal(c.recordGeneration(new Map([[A, run(1)], [B, run(0.6)]])), "continue");
  assert.equal(c.hasPassed(A), true);
  assert.equal(c.hasPassed(B), false);
  // A reste validée même si sa génération suivante échoue.
  assert.equal(c.recordGeneration(new Map([[A, run(0.2)], [B, run(0.99)]])), "continue");
  assert.equal(c.recordGeneration(new Map([[A, run(0.2)], [B, run(1)]])), "level-passed");
  assert.equal(c.currentLevel, "l2");
  assert.equal(c.hasPassed(A), false);
});

test("Curriculum : fin du parcours après le dernier niveau, génération notée", () => {
  const c = new ex.Curriculum(["l1", "l2"], [A]);
  assert.equal(c.recordGeneration(new Map([[A, run(1, 4)]])), "level-passed");
  assert.equal(c.recordGeneration(new Map([[A, run(1.2, 9)]])), "finished");
  assert.equal(c.finished, true);
  assert.equal(c.currentLevel, null);
  assert.equal(c.passedAt.get(A), 9);
  assert.equal(c.recordGeneration(new Map([[A, run(1)]])), "finished");
});

test("Curriculum : lignée inconnue ignorée, pas de niveau → erreur", () => {
  const c = new ex.Curriculum(["l1"], [A]);
  assert.equal(c.recordGeneration(new Map([["Inconnue | X", run(1)]])), "continue");
  assert.throws(() => new ex.Curriculum([], [A]));
});

test("changement de niveau : la génération suivante roule sur le nouveau circuit avec le cerveau du champion", () => {
  const rng = ex.createRng(3);
  const level1 = build("niveau-1-circulaire");
  const level2 = build("niveau-2-carre");
  const cars = ex.createTrainingPopulation(level1, [{ brand: "Tiyoti", model: "Supraa GT" }], rng);
  cars[3].lap.distance = 0.6 * level1.totalLength; // meilleur, sans avoir bouclé le tour
  const next = ex.nextGeneration(cars, level2, rng);
  assert.equal(next.length, cars.length);
  for (const car of next) {
    assert.equal(car.circuit, level2);
    assert.equal(car.generation, 1);
    assert.equal(car.dead, false);
  }
  assert.deepEqual(plain(next[0].brain.toJSON()), plain(cars[3].brain.toJSON()));
});

test("garage : le statut « entraînée sur les circuits d'entraînement » est conservé", () => {
  const storage = createMemoryStorage();
  const garage = new ex.Garage(storage);
  const level = build("niveau-1-circulaire");
  const car = ex.createTrainingPopulation(level, [{ brand: "Tiyoti", model: "Supraa GT" }], ex.createRng(1))[0];
  car.generation = 17;
  garage.markTrained(A, 17); // lignée absente : ignoré
  assert.equal(garage.trainedInfo(A), null);
  garage.recordChampion(car, level.name);
  garage.markTrained(A, 17, 123);
  assert.deepEqual(plain(new ex.Garage(storage).trainedInfo(A)), { generation: 17, savedAt: 123 });
  assert.equal(new ex.Garage(storage).snapshot(A).raceLaps, 1);
});
