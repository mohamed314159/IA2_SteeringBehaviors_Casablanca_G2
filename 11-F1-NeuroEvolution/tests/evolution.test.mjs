import assert from "node:assert/strict";
import test from "node:test";
import { loadExample } from "./p5-adapter.mjs";

const ex = loadExample();
const monza = new ex.Circuit(ex.F1_CIRCUITS.monza);
const MODELS = [
  { brand: "Tiyoti", model: "Supraa GT" },
  { brand: "Ferraaa", model: "F40o" },
  { brand: "Limbargana", model: "Huracano" }
];

// ---------- Réseau de neurones ----------

test("NeuralNetwork : sorties dans ]0, 1[, déterministe avec la même graine", () => {
  const a = new ex.NeuralNetwork([6, 20, 2], ex.createRng(3));
  const b = new ex.NeuralNetwork([6, 20, 2], ex.createRng(3));
  const out = a.predict([1, 0, 0.5, 0.2, 0, 0.7]);
  assert.equal(out.length, 2);
  for (const v of out) assert.ok(v > 0 && v < 1);
  assert.deepEqual(out, b.predict([1, 0, 0.5, 0.2, 0, 0.7]));
});

test("NeuralNetwork : nombre d'entrées invalide → erreur", () => {
  const nn = new ex.NeuralNetwork([6, 20, 2], ex.createRng(3));
  assert.throws(() => nn.predict([1, 2]));
});

test("NeuralNetwork.copy : copie profonde indépendante", () => {
  const nn = new ex.NeuralNetwork([6, 20, 2], ex.createRng(3));
  const clone = nn.copy();
  assert.deepEqual(clone.toJSON(), nn.toJSON());
  clone.mutate(1, ex.createRng(9));
  assert.notDeepEqual(clone.toJSON(), nn.toJSON());
  assert.deepEqual(nn.toJSON(), new ex.NeuralNetwork([6, 20, 2], ex.createRng(3)).toJSON());
});

test("mutate : taux 0 → aucun changement ; taux 0,15 → une partie des poids", () => {
  const nn = new ex.NeuralNetwork([6, 20, 2], ex.createRng(4));
  const before = JSON.stringify(nn.toJSON());
  nn.mutate(0, ex.createRng(1));
  assert.equal(JSON.stringify(nn.toJSON()), before);
  const flat = (j) => [...j.weights.flat(2), ...j.biases.flat()];
  const w0 = flat(nn.toJSON());
  const w1 = flat(nn.copy().mutate(0.15, ex.createRng(2)).toJSON());
  const changed = w0.filter((w, i) => w !== w1[i]).length / w0.length;
  assert.ok(changed > 0.05 && changed < 0.3, `part mutée ${changed}`);
});

test("toJSON / fromJSON : aller-retour JSON sans perte", () => {
  const nn = new ex.NeuralNetwork([6, 20, 2], ex.createRng(8));
  const back = ex.NeuralNetwork.fromJSON(JSON.parse(JSON.stringify(nn)));
  assert.deepEqual(back.predict([0, 1, 0, 1, 0, 1]), nn.predict([0, 1, 0, 1, 0, 1]));
});

test("gaussian : moyenne et écart-type cohérents", () => {
  const rng = ex.createRng(21);
  const xs = Array.from({ length: 20000 }, () => ex.gaussian(rng, 0, 0.1));
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
  assert.ok(Math.abs(mean) < 0.005);
  assert.ok(Math.abs(sd - 0.1) < 0.005);
});

// ---------- Paramètres des modèles ----------

test("mutateSpec : copie, valeurs bornées dans la plage du modèle", () => {
  const rng = ex.createRng(5);
  const spec = ex.createRandomSpecForModel("Ferraaa", "F40o", rng);
  const { model } = ex.findModel("Ferraaa", "F40o");
  let current = spec;
  for (let i = 0; i < 500; i++) {
    current = ex.mutateSpec(current, rng, 0.5);
    assert.ok(current.maxSpeed >= model.speed[0] && current.maxSpeed <= model.speed[1]);
    assert.ok(current.maxForce >= model.grip[0] && current.maxForce <= model.grip[1]);
  }
  assert.notEqual(current, spec);
  assert.equal(current.brand, "Ferraaa");
  assert.throws(() => ex.findModel("Ferraaa", "Inconnu"));
});

// ---------- Population et générations ----------

test("population initiale : seulement les modèles cochés, génération 0, effectif réparti", () => {
  const cars = ex.createInitialPopulation(monza, MODELS, ex.createRng(1));
  const per = ex.populationPerModel(3);
  assert.equal(per, Math.floor(ex.TARGET_POPULATION / 3));
  assert.equal(cars.length, per * 3);
  const groups = ex.groupByLineage(cars);
  assert.deepEqual([...groups.keys()], MODELS.map((m) => `${m.brand} | ${m.model}`));
  for (const car of cars) assert.equal(car.generation, 0);
  // Paramètres aléatoires : pas deux voitures identiques dans une lignée.
  const speeds = new Set(groups.get("Tiyoti | Supraa GT").map((c) => c.maxSpeed));
  assert.equal(speeds.size, per);
});

test("populationPerModel : minimum garanti, 0 modèle → 0 voiture", () => {
  assert.equal(ex.populationPerModel(0), 0);
  assert.equal(ex.populationPerModel(100), ex.MIN_PER_MODEL);
});

test("bestCar : la plus grande progression, puis la plus longue survie", () => {
  const cars = ex.createInitialPopulation(monza, MODELS.slice(0, 1), ex.createRng(2));
  cars[3].lap.distance = 500;
  cars[5].lap.distance = 500;
  cars[5].framesAlive = 900;
  cars[3].framesAlive = 100;
  assert.equal(ex.bestCar(cars), cars[5]);
  cars[1].lap.distance = 501;
  assert.equal(ex.bestCar(cars), cars[1]);
});

test("nextGeneration : la meilleure de chaque lignée sert de base", () => {
  const rng = ex.createRng(3);
  const cars = ex.createInitialPopulation(monza, MODELS, rng);
  const groups = ex.groupByLineage(cars);
  const champions = new Map();
  for (const [key, group] of groups) {
    group[2].lap.distance = 300; // champion de la lignée
    champions.set(key, group[2]);
  }
  const next = ex.nextGeneration(cars, monza, rng);
  assert.equal(next.length, cars.length);
  for (const [key, group] of ex.groupByLineage(next)) {
    const parent = champions.get(key);
    assert.equal(group.length, groups.get(key).length);
    for (const child of group) {
      assert.equal(child.generation, 1);
      assert.equal(child.spec.brand, parent.spec.brand);
      assert.notEqual(child.brain, parent.brain); // copie, pas partage
      assert.equal(child.dead, false);
      assert.ok(Math.abs(child.lap.distance) < 1); // nouvelle course
    }
    // Élite : cerveau et paramètres identiques au champion.
    assert.deepEqual(group[0].brain.toJSON(), parent.brain.toJSON());
    assert.equal(group[0].spec.maxSpeed, parent.spec.maxSpeed);
    // Confiance : la même pour toute la génération, calculée sur le parent.
    const expected = ex.nextConfidence(parent.confidence, parent.progress, parent.framesAlive);
    for (const child of group) assert.equal(child.confidence, expected);
    // Les autres sont des mutations du champion (proches mais différentes).
    assert.notDeepEqual(group[1].brain.toJSON(), parent.brain.toJSON());
  }
});

test("évolution réelle : la vitesse de chaque génération suit les résultats de la précédente", () => {
  const rng = ex.createRng(77);
  let cars = ex.createInitialPopulation(monza, MODELS.slice(0, 1), rng);
  assert.equal(cars[0].confidence, ex.CONFIDENCE_START);
  for (let gen = 0; gen < 4; gen++) {
    for (let f = 0; f < 1200 && cars.some((c) => c.racing); f++) {
      for (const car of cars) car.drive();
    }
    const best = ex.bestCar(cars);
    const next = ex.nextGeneration(cars, monza, rng);
    const expected = ex.nextConfidence(best.confidence, best.progress, best.framesAlive);
    for (const child of next) {
      assert.equal(child.confidence, expected);
      assert.ok(Math.abs(child.maxSpeed - child.spec.maxSpeed * expected) < 1e-12);
    }
    // Génération ratée (moins d'un quart de tour, moins de 5 s) → plus lente.
    if (best.progress < 0.25 && best.secondsAlive < 5) assert.ok(expected < best.confidence);
    cars = next;
  }
});
