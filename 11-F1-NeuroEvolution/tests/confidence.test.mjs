import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryStorage, loadExample } from "./p5-adapter.mjs";

const ex = loadExample();
const monza = new ex.Circuit(ex.F1_CIRCUITS.monza, { key: "monza" });
const MODEL = { brand: "Ferraaa", model: "F40o" };
const KEY = "Ferraaa | F40o";
const plain = (value) => JSON.parse(JSON.stringify(value));

// Enchaîne des générations sur un circuit : progress = meilleur % (0..1) de chacune.
function confidences(progressList, finishedAt = -1) {
  let state = ex.initialConfidenceState();
  const result = [state.confidence];
  progressList.forEach((p, i) => {
    state = ex.advanceConfidence(state, p, i === finishedAt);
    result.push(state.confidence);
  });
  return result;
}

// ---------- Règle de confiance ----------

test("départ à 100 %, puis générations 1 et 2 à 50 %", () => {
  assert.equal(ex.CONFIDENCE_START, 1);
  assert.equal(ex.CONFIDENCE_MIN, 0.5);
  assert.deepEqual(confidences([0.10, 0.30]), [1, 0.5, 0.5]);
  // Même avec un gros progrès, les générations 1 et 2 restent à 50 %.
  assert.deepEqual(confidences([0.10, 0.90]), [1, 0.5, 0.5]);
});

test("paliers : progrès < 1, < 2, < 4 points → baisse de 50, 25, 12,5 points ; ≥ 4 → 100 %", () => {
  assert.equal(ex.confidenceFromProgress(1, 0.5), 0.5);
  assert.equal(ex.confidenceFromProgress(1, 1.5), 0.75);
  assert.equal(ex.confidenceFromProgress(1, 3.9), 0.875);
  assert.equal(ex.confidenceFromProgress(0.5, 4), 1);
  assert.equal(ex.confidenceFromProgress(0.5, 25), 1);
  // Seuils exacts : 1 point n'est pas « inférieur à 1 ».
  assert.equal(ex.confidenceFromProgress(1, 1), 0.75);
  assert.equal(ex.confidenceFromProgress(1, 2), 0.875);
  // Un recul compte comme un progrès inférieur à 1 point.
  assert.equal(ex.confidenceFromProgress(1, -10), 0.5);
});

test("jamais en dessous de 50 %", () => {
  assert.equal(ex.confidenceFromProgress(0.5, 0), 0.5);
  assert.equal(ex.confidenceFromProgress(0.6, 0), 0.5);
  assert.equal(ex.confidenceFromProgress(0.55, 3), 0.5);
  assert.equal(ex.confidenceFromProgress(NaN, 1.5), 0.75); // confiance invalide → départ 100 %
});

test("à partir de la génération 3 : comparaison des 2 générations précédentes", () => {
  // Meilleurs % : gén 0 = 10, gén 1 = 30, gén 2 = 40, gén 3 = 42, gén 4 = 43,5, gén 5 = 43,6.
  // Gén 3 : 40 - 30 = +10 → 100 % ; gén 4 : +2 → 87,5 % ; gén 5 : +1,5 → 62,5 % ; gén 6 : +0,1 → 50 %.
  const c = confidences([0.10, 0.30, 0.40, 0.42, 0.435, 0.436]);
  assert.deepEqual(c.slice(0, 4), [1, 0.5, 0.5, 1]);
  assert.ok(Math.abs(c[4] - 0.875) < 1e-12);
  assert.ok(Math.abs(c[5] - 0.625) < 1e-12);
  assert.equal(c[6], 0.5);
});

test("circuit complété : 100 %, même pendant les premières générations", () => {
  assert.deepEqual(confidences([0.2, 1], 1), [1, 0.5, 1]);
  assert.deepEqual(confidences([1], 0), [1, 1]);
});

test("advanceConfidence ne modifie pas l'état reçu ; progression bornée à [0, 1]", () => {
  const state = { confidence: 0.75, runs: 4, lastProgress: 0.3 };
  const next = ex.advanceConfidence(state, 1.4, false);
  assert.deepEqual(plain(state), { confidence: 0.75, runs: 4, lastProgress: 0.3 });
  assert.equal(next.runs, 5);
  assert.equal(next.lastProgress, 1);
  assert.equal(next.confidence, 1); // +70 points
  assert.equal(ex.advanceConfidence(null, -0.2, false).lastProgress, 0);
  assert.equal(ex.advanceConfidence(undefined, NaN, false).confidence, 0.5);
});

test("toConfidenceState : état, nombre seul ou rien", () => {
  assert.deepEqual(plain(ex.toConfidenceState(null)), { confidence: 1, runs: 0, lastProgress: null });
  assert.deepEqual(plain(ex.toConfidenceState(0.75)), { confidence: 0.75, runs: 0, lastProgress: null });
  assert.deepEqual(plain(ex.toConfidenceState({ confidence: 0.5, runs: 3, lastProgress: 0.2 })), { confidence: 0.5, runs: 3, lastProgress: 0.2 });
});

// ---------- Voitures et générations ----------

test("Car : vitesse max effective = vitesse du modèle x confiance, jamais dépassée", () => {
  const spec = { ...ex.createRandomSpecForModel(MODEL.brand, MODEL.model, ex.createRng(1)), confidence: 0.5 };
  const car = new ex.Car(monza, spec, 0, null, 0, ex.createRng(2));
  assert.equal(car.maxSpeed, spec.maxSpeed * 0.5);
  for (let i = 0; i < 400 && car.racing; i++) {
    car.drive();
    assert.ok(car.vel.mag() <= car.maxSpeed + 1e-9);
  }
});

test("génération 0 sur un circuit : toute la lignée à 100 %", () => {
  const cars = ex.createTrainingPopulation(monza, [MODEL], ex.createRng(3));
  for (const car of cars) {
    assert.equal(car.confidence, 1);
    assert.equal(car.maxSpeed, car.spec.maxSpeed);
    assert.equal(car.spec.confidenceState.runs, 0);
  }
});

test("les générations suivantes héritent de l'état du parent : 100 %, 50 %, 50 %, puis la règle", () => {
  const rng = ex.createRng(4);
  let cars = ex.createTrainingPopulation(monza, [MODEL], rng);
  const seen = [cars[0].confidence];
  const progress = [0.10, 0.30, 0.40, 0.405];
  for (const p of progress) {
    cars[3].lap.distance = p * monza.totalLength; // meilleur de la génération
    cars = ex.nextGeneration(cars, monza, rng);
    assert.equal(new Set(cars.map((c) => c.confidence)).size, 1); // même confiance pour toute la génération
    seen.push(cars[0].confidence);
  }
  // 30 → 40 % : +10 points → 100 % ; 40 → 40,5 % : +0,5 point → 50 %.
  assert.deepEqual(seen, [1, 0.5, 0.5, 1, 0.5]);
});

test("garage : l'état de confiance du circuit est mémorisé et sert à la reprise", () => {
  const garage = new ex.Garage(createMemoryStorage());
  let cars = ex.createTrainingPopulation(monza, [MODEL], ex.createRng(5));
  for (const [i, p] of [0.1, 0.3, 0.4].entries()) {
    const best = cars[0];
    best.lap.distance = p * monza.totalLength;
    best.generation = i;
    garage.recordChampion(best, "Monza");
    cars = ex.nextGeneration(cars, monza, ex.createRng(10 + i));
  }
  const state = garage.circuitConfidenceState(KEY, "monza");
  assert.equal(state.confidence, 1);
  assert.equal(state.runs, 3);
  assert.ok(Math.abs(state.lastProgress - 0.4) < 1e-9);
  const resumed = ex.createTrainingPopulation(monza, [MODEL], ex.createRng(6),
    (k) => garage.snapshot(k), (k) => garage.circuitConfidenceState(k, "monza"));
  for (const car of resumed) assert.equal(car.confidence, 1);
  assert.deepEqual(plain(resumed[0].spec.confidenceState), plain(state));
  // Un autre circuit repart de zéro : 100 %, génération 0 du circuit.
  assert.equal(garage.circuitConfidenceState(KEY, "spa"), null);
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
