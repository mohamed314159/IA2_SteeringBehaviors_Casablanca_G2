import assert from "node:assert/strict";
import test from "node:test";
import { loadExample } from "./p5-adapter.mjs";

const ex = loadExample();
const PPM = 44 / 14; // échelle F1 utilisée par sketch.js
const build = (layout) => new ex.Circuit(layout, { pixelsPerMeter: PPM });

// Boîte englobante de la ligne médiane (px).
function bbox(circuit) {
  const xs = circuit.center.map((p) => p.x);
  const ys = circuit.center.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return { area: (maxX - minX) * (maxY - minY), cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

// Surface (boîte englobante, px²) des niveaux avant l'étape 19, mesurée sur les anciens tracés.
const SURFACE_BEFORE_STEP_19 = {
  "niveau-1-circulaire": 632371,
  "niveau-2-carre": 700240,
  "niveau-3-drift": 509176,
  "niveau-4-epingles": 397432,
  "niveau-5-coince": 684907
};

test("chaque niveau d'entraînement occupe 1/4 de la surface", () => {
  assert.equal(ex.TRAINING_AREA_RATIO, 1 / 4);
  for (const key of ex.trainingLevelKeys()) {
    const layout = ex.TRAINING_CIRCUITS[key];
    assert.equal(layout.areaRatio, ex.TRAINING_AREA_RATIO, key);
    const small = build(layout);
    const full = build({ ...layout, areaRatio: 1 });
    assert.equal(small.areaRatio, 0.25);
    const ratio = bbox(small).area / bbox(full).area;
    assert.ok(Math.abs(ratio - 0.25) < 0.01, `${key} : ${ratio.toFixed(3)} de la taille pleine`);
  }
});

test("surface divisée par 4 par rapport aux niveaux d'avant (tracés redessinés compris, ±10 %)", () => {
  for (const key of ex.trainingLevelKeys()) {
    const ratio = bbox(build(ex.TRAINING_CIRCUITS[key])).area / SURFACE_BEFORE_STEP_19[key];
    assert.ok(ratio > 0.225 && ratio < 0.275, `${key} : ${ratio.toFixed(3)}`);
  }
});

test("niveaux réduits : centrés, valides, assez de place entre deux portions du tracé", () => {
  for (const key of ex.trainingLevelKeys()) {
    const circuit = build(ex.TRAINING_CIRCUITS[key]);
    const box = bbox(circuit);
    assert.ok(Math.abs(box.cx - 600) < 1 && Math.abs(box.cy - 380) < 1, `${key} centré`);
    assert.equal(circuit.hasSelfIntersection(), false, key);
    // Bord à bord entre deux portions éloignées du tracé (le long de la piste) : au moins 20 px.
    const n = circuit.center.length;
    let clearance = Infinity;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(ex.wrapArcDelta(circuit.arc[j] - circuit.arc[i], circuit.totalLength)) < circuit.trackWidth * 3) continue;
        const d = Math.hypot(circuit.center[i].x - circuit.center[j].x, circuit.center[i].y - circuit.center[j].y);
        clearance = Math.min(clearance, d - circuit.trackWidth);
      }
    }
    assert.ok(clearance >= 20, `${key} : ${clearance.toFixed(1)} px entre deux portions`);
  }
});

test("même piste et même voiture : seule la longueur du tracé change", () => {
  const monza = build(ex.F1_CIRCUITS.monza);
  for (const key of ex.trainingLevelKeys()) {
    const layout = ex.TRAINING_CIRCUITS[key];
    const small = build(layout);
    const full = build({ ...layout, areaRatio: 1 });
    assert.equal(small.trackWidth, full.trackWidth, key);
    assert.equal(small.carLength, monza.carLength, key);
    assert.ok(Math.abs(small.totalLength / full.totalLength - 0.5) < 0.03, `${key} : tour 2 fois plus court`);
  }
});

test("les circuits F1 gardent toute la place ; areaRatio absent ou invalide → 1", () => {
  for (const key of Object.keys(ex.F1_CIRCUITS)) {
    assert.equal(build(ex.F1_CIRCUITS[key]).areaRatio, 1, key);
  }
  for (const bad of [undefined, null, 0, -0.5, 1.5, NaN, "0.25"]) assert.equal(ex.Circuit.validAreaRatio(bad), 1, String(bad));
  assert.equal(ex.Circuit.validAreaRatio(0.25), 0.25);
  assert.equal(ex.Circuit.validAreaRatio(1), 1);
});

test("fitToCanvas : facteur linéaire autour du centre du canvas", () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const full = ex.Circuit.fitToCanvas(square, 1000, 600, 50);
  const half = ex.Circuit.fitToCanvas(square, 1000, 600, 50, 0.5);
  const side = (pts) => pts[1][0] - pts[0][0];
  assert.equal(side(full), 500);
  assert.equal(side(half), 250);
  const center = (pts) => [(pts[0][0] + pts[2][0]) / 2, (pts[0][1] + pts[2][1]) / 2];
  assert.deepEqual(JSON.parse(JSON.stringify(center(half))), [500, 300]);
  assert.deepEqual(JSON.parse(JSON.stringify(center(full))), [500, 300]);
});

test("une voiture part bien sur chaque niveau réduit (sur la piste, ni morte ni bloquée au départ)", () => {
  const spec = { brand: "Ferraaa", model: "F40o", maxSpeed: 4.5, maxForce: 0.22 };
  const straight = { inputNodes: 6, predict: () => [0.5, 0.6] };
  for (const key of ex.trainingLevelKeys()) {
    const circuit = build(ex.TRAINING_CIRCUITS[key]);
    const car = new ex.Car(circuit, spec, 0, straight);
    for (let i = 0; i < 5; i++) car.drive();
    assert.equal(car.dead, false, key);
    assert.ok(car.progress > 0, `${key} : la voiture avance`);
  }
});
