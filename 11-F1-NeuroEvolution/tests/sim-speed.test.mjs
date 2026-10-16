import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryStorage, loadExample } from "./p5-adapter.mjs";

const ex = loadExample();
const monza = new ex.Circuit(ex.F1_CIRCUITS.monza, { key: "monza" });

// Horloge factice : chaque appel avance de `tick` ms.
function fakeClock(tick) {
  let t = 0;
  return () => (t += tick);
}

test("facteurs proposés : ×1 à ×100 et max ; valeur inconnue → ×1", () => {
  assert.deepEqual([...ex.SPEED_FACTORS], [1, 2, 5, 10, 20, 50, 100, "max"]);
  assert.equal(ex.normalizeSpeedFactor("10"), 10);
  assert.equal(ex.normalizeSpeedFactor(5), 5);
  assert.equal(ex.normalizeSpeedFactor("max"), "max");
  for (const bad of [3, "abc", null, undefined, -1, 1000]) assert.equal(ex.normalizeSpeedFactor(bad), 1);
});

test("machine rapide : exactement N pas par image à ×N", () => {
  for (const factor of [1, 2, 5, 10, 100]) {
    let steps = 0;
    const done = ex.runSimulationSteps(() => { steps++; return true; }, factor, fakeClock(0));
    assert.equal(done, factor);
    assert.equal(steps, factor);
  }
});

test("machine lente : le budget de temps limite les pas (au moins 1)", () => {
  // Chaque pas coûte 5 ms, budget 12 ms → 3 pas au lieu de 100.
  assert.equal(ex.runSimulationSteps(() => true, 100, fakeClock(5), 12), 3);
  // Un seul pas dépasse déjà le budget : la simulation avance quand même d'un pas.
  assert.equal(ex.runSimulationSteps(() => true, 50, fakeClock(100), 12), 1);
});

test("mode max : autant que le budget le permet, plafonné", () => {
  assert.equal(ex.runSimulationSteps(() => true, "max", fakeClock(0)), ex.SIM_MAX_STEPS);
  assert.equal(ex.runSimulationSteps(() => true, "max", fakeClock(1), 10), 10);
});

test("plus rien à simuler : on s'arrête tout de suite", () => {
  let steps = 0;
  const done = ex.runSimulationSteps(() => ++steps < 3, 20, fakeClock(0));
  assert.equal(done, 3);
});

test("vitesse atteinte : moyenne glissante, remise à zéro", () => {
  const meter = new ex.SpeedMeter(3);
  assert.equal(meter.average, 0);
  for (const n of [10, 20, 30, 40]) meter.add(n);
  assert.equal(meter.average, 30); // 20, 30, 40
  meter.reset();
  assert.equal(meter.average, 0);
});

test("le facteur choisi est mémorisé ; stockage absent, illisible ou bloqué → ×1", () => {
  const storage = createMemoryStorage();
  ex.saveSpeedFactor(storage, 20);
  assert.equal(storage.getItem(ex.SIM_SPEED_STORAGE_KEY), "20");
  assert.equal(ex.loadSpeedFactor(storage), 20);
  ex.saveSpeedFactor(storage, "max");
  assert.equal(ex.loadSpeedFactor(storage), "max");
  assert.equal(ex.loadSpeedFactor(null), 1);
  assert.equal(ex.loadSpeedFactor(createMemoryStorage({ [ex.SIM_SPEED_STORAGE_KEY]: "7" })), 1);
  const blocked = { getItem() { throw new Error("bloqué"); }, setItem() { throw new Error("bloqué"); } };
  assert.equal(ex.loadSpeedFactor(blocked), 1);
  assert.doesNotThrow(() => ex.saveSpeedFactor(blocked, 5));
});

// Simulation complète avec la même graine, à ×1 ou ×factor : même pas, même état.
function simulate(factor, totalSteps) {
  const rng = ex.createRng(21);
  let cars = ex.createTrainingPopulation(monza, [{ brand: "Tiyoti", model: "Supraa GT" }, { brand: "Ferraaa", model: "F40o" }], rng);
  let done = 0;
  const step = () => {
    for (const car of cars) car.drive();
    cars = ex.advanceStoppedLineages(cars, monza, rng);
    done++;
    return done < totalSteps;
  };
  while (done < totalSteps) ex.runSimulationSteps(step, factor, () => 0);
  return cars.map((c) => [c.spec.model, c.generation, c.pos.x, c.pos.y, c.dead, c.framesAlive]);
}

test("déterminisme : ×1, ×5 et ×20 donnent exactement la même simulation", () => {
  const reference = simulate(1, 600);
  assert.deepEqual(simulate(5, 600), reference);
  assert.deepEqual(simulate(20, 600), reference);
  assert.ok(reference.some(([, generation]) => generation > 0), "au moins une génération terminée");
});
