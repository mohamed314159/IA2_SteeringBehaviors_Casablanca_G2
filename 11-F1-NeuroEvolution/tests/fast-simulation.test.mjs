// Étape 26 : optimisations du pas de simulation. Elles doivent donner
// exactement les mêmes résultats que le calcul direct.
import assert from "node:assert/strict";
import test from "node:test";
import { loadExample } from "./p5-adapter.mjs";

const ex = loadExample();
const PPM = 44 / 14;
const monza = new ex.Circuit(ex.F1_CIRCUITS.monza, { pixelsPerMeter: PPM });
const labyrinth = new ex.Circuit(ex.TRAINING_CIRCUITS["niveau-20-labyrinthe"], { pixelsPerMeter: PPM });

// Points de test répartis sur le canvas (graine fixe), dont certains loin de la piste.
function samplePoints(count, seed) {
  const rng = ex.createRng(seed);
  return Array.from({ length: count }, () => ({ x: rng() * 1200, y: rng() * 760 }));
}

// Référence : chaque segment de la ligne médiane projeté avec projectOnSegment.
function bruteProjection(circuit, pos, indices) {
  const n = circuit.center.length;
  let best = { index: 0, t: 0, distance: Infinity };
  for (const i of indices) {
    const r = ex.projectOnSegment(pos, circuit.center[i], circuit.center[(i + 1) % n]);
    if (r.distance < best.distance) best = { index: i, t: r.t, distance: r.distance };
  }
  return best;
}

test("projection sur la ligne médiane : même segment, même t et même distance que projectOnSegment", () => {
  for (const circuit of [monza, labyrinth]) {
    const n = circuit.center.length;
    for (const pos of samplePoints(300, 4)) {
      const fast = circuit.project(pos);
      const ref = bruteProjection(circuit, pos, Array.from({ length: n }, (_, i) => i));
      assert.equal(fast.index, ref.index);
      assert.equal(fast.t, ref.t);
      assert.equal(fast.distance, ref.distance);
      assert.equal(fast.s, circuit.arc[ref.index] + ref.t * (circuit.arc[ref.index + 1] - circuit.arc[ref.index]));
      // Recherche locale (±25 segments autour d'un indice), y compris à cheval sur la fin du tracé.
      for (const hint of [0, 3, n - 2, Math.floor(n / 2)]) {
        const local = circuit.project(pos, hint);
        const window = Array.from({ length: 51 }, (_, k) => (((hint - 25 + k) % n) + n) % n);
        const refLocal = bruteProjection(circuit, pos, window);
        assert.equal(local.index, refLocal.index);
        assert.equal(local.distance, refLocal.distance);
      }
    }
  }
  // Point exactement sur un sommet : distance nulle.
  const p = monza.center[10];
  assert.equal(monza.project({ x: p.x, y: p.y }).distance, 0);
});

test("murs proches mémorisés : même liste pour la même fenêtre, tous les murs à portée présents", () => {
  const circuit = new ex.Circuit(ex.F1_CIRCUITS.spa, { pixelsPerMeter: PPM });
  for (const pos of samplePoints(80, 7)) {
    const first = circuit.wallsNear(pos, 160);
    assert.equal(circuit.wallsNear(pos, 160), first, "même tableau, sans recalcul");
    assert.equal(new Set(first).size, first.length, "sans doublon");
    // Tout mur qui passe à moins de 160 px est dans la liste.
    for (const wall of circuit.walls) {
      const d = ex.projectOnSegment(pos, wall.a, wall.b).distance;
      if (d <= 160) assert.ok(first.includes(wall));
    }
  }
  // Très longue portée : tous les murs du circuit.
  assert.equal(circuit.wallsNear({ x: 600, y: 380 }, 5000), circuit.walls);
});

test("murs à portée : mêmes distances de rayons qu'avec tous les murs proches, entrée non modifiée", () => {
  const ray = new ex.Ray(0);
  const rng = ex.createRng(12);
  for (const pos of samplePoints(60, 9)) {
    for (const reach of [40, 160, 600]) {
      const near = monza.wallsNear(pos, reach);
      const before = near.slice();
      const inReach = ex.wallsWithinReach(near, pos, reach);
      assert.deepEqual(near, before, "liste partagée intacte");
      assert.ok(inReach.length <= near.length);
      for (let k = 0; k < 8; k++) {
        ray.setPos(pos.x, pos.y);
        ray.setDir(rng() * Math.PI * 2);
        assert.equal(ray.castAll(inReach, reach), ray.castAll(near, reach));
      }
    }
  }
  assert.equal(ex.wallsWithinReach([], { x: 0, y: 0 }, 100).length, 0);
  // Mur réduit à un point : gardé seulement s'il est à portée.
  const dot = { a: { x: 10, y: 0 }, b: { x: 10, y: 0 } };
  assert.equal(ex.wallsWithinReach([dot], { x: 0, y: 0 }, 20).length, 1);
  assert.equal(ex.wallsWithinReach([dot], { x: 0, y: 0 }, 5).length, 0);
});

test("une course complète est identique avec les murs à portée et avec tous les murs proches", () => {
  const run = (filter) => {
    const circuit = new ex.Circuit(ex.TRAINING_CIRCUITS["niveau-14-chateau"], { pixelsPerMeter: PPM });
    const rng = ex.createRng(21);
    let cars = ex.createTrainingPopulation(circuit, [{ brand: "Ferraaa", model: ex.CAR_BRANDS[1].models[0].name }], rng);
    for (const car of cars) {
      // Référence : perception d'avant l'étape 26 (tous les murs proches, sans filtre).
      if (!filter) car.sense = function (extra = []) {
        const walls = this.circuit.wallsNear(this.pos, this.sightDistance).concat(extra);
        const inputs = [];
        for (let i = 0; i < this.rayCount; i++) {
          this.rays[i].setPos(this.pos.x, this.pos.y);
          this.rays[i].setDir(this.rayAngle(i));
          this.rayDistances[i] = this.rays[i].castAll(walls, this.sightDistance);
          inputs.push(1 - this.rayDistances[i] / this.sightDistance);
        }
        inputs.push(this.vel.mag() / this.maxSpeed);
        return inputs;
      };
    }
    for (let s = 0; s < 400; s++) for (const car of cars) car.drive();
    return cars.map((c) => [c.pos.x, c.pos.y, c.lap.distance, c.dead]);
  };
  assert.deepEqual(run(true), run(false));
});
