import assert from "node:assert/strict";
import test from "node:test";
import { loadExample } from "./p5-adapter.mjs";

const ex = loadExample();
const PPM = 44 / 14; // échelle F1 utilisée par sketch.js
const plain = (value) => JSON.parse(JSON.stringify(value));
const NEW = ["silverstone", "monaco", "montreal", "redBullRing", "hungaroring"];
const TIGHT = ["silverstone", "monaco", "montreal", "redBullRing"];
const build = (key) => new ex.Circuit(ex.F1_CIRCUITS[key], { key, pixelsPerMeter: PPM });

// Rayon de courbure de la ligne médiane en chaque point (px).
function radii(circuit) {
  const n = circuit.center.length;
  return Array.from({ length: n }, (_, i) => {
    const a = circuit.tangents[i];
    const b = circuit.tangents[(i + 1) % n];
    const turn = Math.abs(Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y));
    return turn > 1e-6 ? (circuit.arc[i + 1] - circuit.arc[i]) / turn : Infinity;
  });
}

test("8 circuits F1 : les 3 premiers puis 5 nouveaux, noms distincts", () => {
  assert.deepEqual(plain(Object.keys(ex.F1_CIRCUITS)), ["monza", "spa", "interlagos", ...NEW]);
  assert.equal(new Set(Object.values(ex.F1_CIRCUITS).map((c) => c.name)).size, 8);
});

test("nouveaux circuits valides : bords sans croisement, dans le canvas, tour assez long, place entre portions", () => {
  for (const key of NEW) {
    const circuit = build(key);
    assert.equal(circuit.hasSelfIntersection(), false, key);
    assert.ok(circuit.totalLength > 1500, key);
    for (const p of [...circuit.leftEdge, ...circuit.rightEdge]) {
      assert.ok(Number.isFinite(p.x) && p.x > 0 && p.x < 1200 && p.y > 0 && p.y < 760, key);
    }
    const n = circuit.center.length;
    let clearance = Infinity;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(ex.wrapArcDelta(circuit.arc[j] - circuit.arc[i], circuit.totalLength)) < circuit.trackWidth * 3) continue;
        clearance = Math.min(clearance, Math.hypot(circuit.center[i].x - circuit.center[j].x, circuit.center[i].y - circuit.center[j].y) - circuit.trackWidth);
      }
    }
    assert.ok(clearance >= 10, `${key} : ${clearance.toFixed(1)} px entre deux portions`);
  }
});

test("virages très serrés : rayon sous la demi-largeur de piste, bord intérieur coupé (pas de boucle)", () => {
  for (const key of TIGHT) {
    const circuit = build(key);
    const minRadius = Math.min(...radii(circuit));
    assert.ok(minRadius < circuit.trackWidth / 2, `${key} : rayon minimal ${minRadius.toFixed(1)} px`);
    // Sans la coupe, le bord intérieur se replierait : la coupe a bien ramené des points ensemble.
    const merged = [circuit.leftEdge, circuit.rightEdge].some((edge) =>
      edge.some((p, i) => { const q = edge[(i + 1) % edge.length]; return p.x === q.x && p.y === q.y; }));
    assert.ok(merged, `${key} : boucle coupée`);
  }
});

test("une voiture part sur chaque nouveau circuit ; les rayons voient les murs coupés sans valeur invalide", () => {
  const spec = { brand: "Ferraaa", model: "F40o", maxSpeed: 4.5, maxForce: 0.22 };
  const straight = { inputNodes: 6, predict: () => [0.5, 0.6] };
  for (const key of NEW) {
    const circuit = build(key);
    const car = new ex.Car(circuit, spec, 0, straight);
    for (let i = 0; i < 5; i++) car.drive();
    assert.equal(car.dead, false, key);
    assert.ok(car.progress > 0, key);
    assert.ok(car.rayDistances.every(Number.isFinite), key);
  }
});

test("une voiture qui suit la ligne médiane fait le tour des épingles serrées sans sortir de piste", () => {
  for (const key of TIGHT) {
    const circuit = build(key);
    const tracker = new ex.LapTracker(circuit, circuit.center[0]);
    for (let i = 1; i <= circuit.center.length; i++) {
      tracker.update(circuit.center[i % circuit.center.length]);
      assert.ok(tracker.offset < 1e-6, `${key} : écart à la ligne médiane`);
    }
    assert.equal(tracker.laps, 1, key);
  }
});
