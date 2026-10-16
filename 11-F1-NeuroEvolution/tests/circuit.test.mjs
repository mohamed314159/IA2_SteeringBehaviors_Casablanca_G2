import assert from "node:assert/strict";
import test from "node:test";
import { loadExample } from "./p5-adapter.mjs";

const ex = loadExample();
const monza = new ex.Circuit(ex.F1_CIRCUITS.monza);

test("chaque circuit F1 est valide : bords sans croisement", () => {
  for (const key of Object.keys(ex.F1_CIRCUITS)) {
    const circuit = new ex.Circuit(ex.F1_CIRCUITS[key]);
    assert.equal(circuit.hasSelfIntersection(), false, key);
    assert.ok(circuit.totalLength > 1500, `${key} trop court`);
  }
});

test("le circuit tient dans le canvas, bords compris", () => {
  for (const key of Object.keys(ex.F1_CIRCUITS)) {
    const circuit = new ex.Circuit(ex.F1_CIRCUITS[key], { canvasWidth: 1200, canvasHeight: 760 });
    for (const p of [...circuit.leftEdge, ...circuit.rightEdge]) {
      assert.ok(p.x > 0 && p.x < 1200 && p.y > 0 && p.y < 760, key);
    }
  }
});

test("proportions F1 : voiture 5,6 x 2 m pour une piste de 14 m", () => {
  const c = new ex.Circuit(ex.F1_CIRCUITS.spa, { trackWidth: 56 });
  assert.equal(c.pixelsPerMeter, 4);
  assert.ok(Math.abs(c.carLength - 22.4) < 1e-9);
  assert.ok(Math.abs(c.carWidth - 8) < 1e-9);
  assert.ok(Math.abs(c.carLength / c.trackWidth - 0.4) < 1e-9);
});

test("Catmull-Rom passe par les points de contrôle", () => {
  const pts = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const curve = ex.catmullRomClosed(pts, 4);
  assert.equal(curve.length, 16);
  assert.deepEqual({ ...curve[0] }, { x: 0, y: 0 });
  assert.deepEqual({ ...curve[4] }, { x: 10, y: 0 });
});

test("ré-échantillonnage : espacement constant et boucle fermée", () => {
  const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
  const pts = ex.resampleClosed(square, 10);
  assert.equal(pts.length, 40);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    assert.ok(Math.abs(Math.hypot(b.x - a.x, b.y - a.y) - 10) < 1e-6);
  }
});

test("projection : point sur la ligne médiane → distance nulle, abscisse croissante", () => {
  const p = monza.project(monza.center[50]);
  assert.ok(p.distance < 1e-6);
  assert.ok(Math.abs(p.s - monza.arc[50]) < 1e-6);
  const local = monza.project(monza.center[52], 50, 5);
  assert.ok(local.s > p.s);
});

test("wrapArcDelta gère le passage de la ligne d'arrivée", () => {
  assert.equal(ex.wrapArcDelta(-990, 1000), 10);
  assert.equal(ex.wrapArcDelta(990, 1000), -10);
  assert.equal(ex.wrapArcDelta(15, 1000), 15);
});

test("LapTracker : tours et pourcentage sans checkpoints", () => {
  const tracker = new ex.LapTracker(monza, monza.center[0]);
  const n = monza.center.length;
  // On avance point par point sur 1,5 tour.
  for (let k = 1; k <= Math.round(n * 1.5); k++) tracker.update(monza.center[k % n]);
  assert.equal(tracker.laps, 1);
  assert.ok(Math.abs(tracker.lapPercent - 50) < 1, `obtenu ${tracker.lapPercent}`);
  assert.ok(Math.abs(tracker.progress - 1.5) < 0.01);
});

test("LapTracker : rouler à l'envers donne une progression négative, 0 tour", () => {
  const n = monza.center.length;
  const tracker = new ex.LapTracker(monza, monza.center[10]);
  for (let k = 9; k >= -20; k--) tracker.update(monza.center[(k + n) % n]);
  assert.ok(tracker.progress < 0);
  assert.equal(tracker.laps, 0);
  assert.equal(tracker.lapPercent, 0);
});

test("wallsNear ne renvoie que des murs proches mais tous ceux à portée", () => {
  const pos = monza.center[100];
  const near = monza.wallsNear(pos, 150);
  assert.ok(near.length > 0 && near.length < monza.walls.length);
  for (const wall of monza.walls) {
    const d = ex.projectOnSegment(pos, wall.a, wall.b).distance;
    if (d < 150) assert.ok(near.includes(wall), "mur à portée manquant");
  }
});
