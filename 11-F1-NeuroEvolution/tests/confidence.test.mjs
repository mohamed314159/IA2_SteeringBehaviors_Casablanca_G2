import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryStorage, loadExample } from "./p5-adapter.mjs";

const ex = loadExample();
const monza = new ex.Circuit(ex.F1_CIRCUITS.monza);
const MODEL = { brand: "Ferraaa", model: "F40o" };
const KEY = "Ferraaa | F40o";
const SECOND = 60; // images

test("score de performance : 0 sans résultat, 1 au plafond, pondération 70/30", () => {
  assert.equal(ex.performanceScore(0, 0), 0);
  assert.equal(ex.performanceScore(1, ex.CONFIDENCE_FULL_SECONDS * SECOND), 1);
  assert.equal(ex.performanceScore(5, 1e9), 1);
  assert.ok(Math.abs(ex.performanceScore(0.5, 0) - 0.35) < 1e-12);
  assert.ok(Math.abs(ex.performanceScore(0, 15 * SECOND) - 0.15) < 1e-12);
});

test("score : progression négative ou valeurs non finies comptent pour 0", () => {
  assert.equal(ex.performanceScore(-0.3, -10), 0);
  assert.equal(ex.performanceScore(NaN, Infinity), 0);
  assert.equal(ex.performanceScore(undefined, undefined), 0);
});

test("génération peu performante → confiance (donc vitesse) plus basse que la précédente", () => {
  const next = ex.nextConfidence(0.8, 0.05, 2 * SECOND);
  assert.ok(next < 0.8);
  assert.ok(next >= ex.CONFIDENCE_MIN);
});

test("génération performante → la confiance monte, sans dépasser 1", () => {
  assert.ok(ex.nextConfidence(0.6, 1, 30 * SECOND) > 0.6);
  assert.equal(ex.nextConfidence(1, 3, 60 * SECOND), ex.CONFIDENCE_MAX);
  // Inertie : la moitié de l'écart à la cible est comblée à chaque génération.
  assert.ok(Math.abs(ex.nextConfidence(0.6, 1, 30 * SECOND) - 0.8) < 1e-12);
});

test("plus de progression ou de survie → confiance au moins aussi grande", () => {
  let previous = -Infinity;
  for (let p = 0; p <= 1.2; p += 0.1) {
    const c = ex.nextConfidence(0.6, p, 10 * SECOND);
    assert.ok(c >= previous - 1e-12);
    previous = c;
  }
  assert.ok(ex.nextConfidence(0.6, 0.2, 20 * SECOND) > ex.nextConfidence(0.6, 0.2, 5 * SECOND));
});

test("confiance précédente invalide ou hors bornes → départ ou bornage", () => {
  assert.equal(ex.nextConfidence(NaN, 0, 0), ex.CONFIDENCE_START + ex.CONFIDENCE_INERTIA * (ex.CONFIDENCE_MIN - ex.CONFIDENCE_START));
  assert.equal(ex.nextConfidence(5, 3, 1e9), ex.CONFIDENCE_MAX);
  assert.equal(ex.nextConfidence(-1, 0, 0), ex.CONFIDENCE_MIN);
});

test("plusieurs générations ratées : la confiance converge vers le minimum sans le franchir", () => {
  let c = ex.CONFIDENCE_START;
  for (let i = 0; i < 30; i++) c = ex.nextConfidence(c, 0, 0);
  assert.ok(c >= ex.CONFIDENCE_MIN && c - ex.CONFIDENCE_MIN < 1e-6);
});

test("Car : vitesse max effective = vitesse du modèle x confiance, jamais dépassée", () => {
  const spec = { ...ex.createRandomSpecForModel(MODEL.brand, MODEL.model, ex.createRng(1)), confidence: 0.5 };
  const car = new ex.Car(monza, spec, 0, null, 0, ex.createRng(2));
  assert.equal(car.confidence, 0.5);
  assert.equal(car.maxSpeed, spec.maxSpeed * 0.5);
  for (let i = 0; i < 400 && car.racing; i++) {
    car.drive();
    assert.ok(car.vel.mag() <= car.maxSpeed + 1e-9);
  }
  const noConfidence = new ex.Car(monza, { ...spec, confidence: undefined });
  assert.equal(noConfidence.maxSpeed, spec.maxSpeed);
});

test("génération 0 : confiance de départ pour toute la lignée", () => {
  const cars = ex.createTrainingPopulation(monza, [MODEL], ex.createRng(3));
  for (const car of cars) {
    assert.equal(car.confidence, ex.CONFIDENCE_START);
    assert.ok(car.maxSpeed < car.spec.maxSpeed);
  }
});

test("reprise depuis le garage : confiance mémorisée pour CE circuit", () => {
  const garage = new ex.Garage(createMemoryStorage());
  const parent = ex.createTrainingPopulation(monza, [MODEL], ex.createRng(4))[0];
  parent.lap.distance = 0.9 * monza.totalLength;
  parent.framesAlive = 25 * SECOND;
  parent.generation = 9;
  garage.recordChampion(parent, "Monza");
  const expected = ex.nextConfidence(ex.CONFIDENCE_START, 0.9, 25 * SECOND);
  assert.ok(expected > ex.CONFIDENCE_START);
  assert.equal(garage.circuitConfidence(KEY, monza.key), expected);
  const children = ex.createTrainingPopulation(monza, [MODEL], ex.createRng(5),
    (k) => garage.snapshot(k), (k) => garage.circuitConfidence(k, monza.key));
  for (const child of children) {
    assert.equal(child.generation, 10);
    assert.equal(child.confidence, expected);
  }
});

test("chaque circuit a sa confiance : un autre circuit repart de la confiance de départ", () => {
  const garage = new ex.Garage(createMemoryStorage());
  const spa = new ex.Circuit(ex.F1_CIRCUITS.spa);
  const parent = ex.createTrainingPopulation(monza, [MODEL], ex.createRng(6))[0];
  parent.lap.distance = 0.8 * monza.totalLength;
  parent.framesAlive = 20 * SECOND;
  garage.recordChampion(parent, "Monza");
  assert.equal(garage.circuitConfidence(KEY, spa.key), null);
  const onSpa = ex.createTrainingPopulation(spa, [MODEL], ex.createRng(7),
    (k) => garage.snapshot(k), (k) => garage.circuitConfidence(k, spa.key));
  for (const car of onSpa) assert.equal(car.confidence, ex.CONFIDENCE_START);
  // Même cerveau (reprise), mais confiance propre à Spa.
  assert.equal(onSpa[0].generation, parent.generation + 1);
});

test("confidenceAfterRun : circuit bouclé → 100 %, sinon calcul progressif", () => {
  assert.equal(ex.confidenceAfterRun(0.5, 1, 10, 1), ex.CONFIDENCE_MAX);
  assert.equal(ex.confidenceAfterRun(0.5, 1.2, 10, 1), ex.CONFIDENCE_MAX);
  assert.equal(ex.confidenceAfterRun(0.5, 0.4, 600, 1), ex.nextConfidence(0.5, 0.4, 600));
  assert.equal(ex.confidenceAfterRun(0.5, NaN, 600, 1), ex.nextConfidence(0.5, NaN, 600));
});

test("runIsBetter : à l'arrivée la plus rapide gagne ; sinon la plus loin, puis la plus longue survie", () => {
  const L = ex.MAX_LAPS;
  assert.equal(L, 1); // jamais plus d'un tour à l'entraînement
  assert.equal(ex.runIsBetter({ progress: L, framesAlive: 1500 }, { progress: L + 0.01, framesAlive: 2400 }), true);
  assert.equal(ex.runIsBetter({ progress: L, framesAlive: 2400 }, { progress: L, framesAlive: 1500 }), false);
  assert.equal(ex.runIsBetter({ progress: L, framesAlive: 9000 }, { progress: L - 0.01, framesAlive: 100 }), true);
  assert.equal(ex.runIsBetter({ progress: 0.5, framesAlive: 100 }, { progress: 0.4, framesAlive: 900 }), true);
  assert.equal(ex.runIsBetter({ progress: 0.5, framesAlive: 900 }, { progress: 0.5, framesAlive: 100 }), true);
  assert.equal(ex.runIsBetter({ progress: 0.5, framesAlive: 100 }, { progress: 0.5, framesAlive: 100 }), false);
});

test("bestCar : parmi les voitures arrivées, la plus rapide sert de parent", () => {
  const cars = ex.createTrainingPopulation(monza, [MODEL], ex.createRng(8));
  for (const [i, frames] of [[2, 3000], [4, 1800], [6, 2500]]) {
    cars[i].lap.distance = ex.MAX_LAPS * monza.totalLength;
    cars[i].finished = true;
    cars[i].framesAlive = frames;
  }
  assert.equal(ex.bestCar(cars), cars[4]);
});

test("garage : une arrivée plus rapide est un nouveau record", () => {
  const garage = new ex.Garage(createMemoryStorage());
  const car = ex.createTrainingPopulation(monza, [MODEL], ex.createRng(9))[0];
  car.lap.distance = ex.MAX_LAPS * monza.totalLength;
  car.framesAlive = 3000;
  assert.equal(garage.recordChampion(car, "Monza"), true);
  car.framesAlive = 3200;
  car.generation = 1;
  assert.equal(garage.recordChampion(car, "Monza"), false);
  car.framesAlive = 2000;
  car.generation = 2;
  assert.equal(garage.recordChampion(car, "Monza"), true);
  assert.equal(garage.best("Ferraaa | F40o").framesAlive, 2000);
});
