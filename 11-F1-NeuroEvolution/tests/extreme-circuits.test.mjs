import assert from "node:assert/strict";
import test from "node:test";
import { loadExample } from "./p5-adapter.mjs";

// Étape 30 : deux circuits F1 extrêmes, d'une difficulté inhumaine.
const ex = loadExample();
const PPM = 44 / 14;
const EXTREME = ["inferno", "hachoir"];
const build = (key) => new ex.Circuit(ex.F1_CIRCUITS[key], { key, pixelsPerMeter: PPM });
const plain = (value) => JSON.parse(JSON.stringify(value));
const DEG = 180 / Math.PI;

// Virages : suites de points qui tournent dans le même sens (rayon < maxRadius px),
// angle total de chacun en degrés.
function corners(circuit, maxRadius) {
  const n = circuit.center.length;
  const list = Array.from({ length: n }, (_, i) => {
    const a = circuit.tangents[i];
    const b = circuit.tangents[(i + 1) % n];
    return { turn: Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y), length: circuit.arc[i + 1] - circuit.arc[i] };
  });
  let start = 0;
  list.forEach((t, i) => { if (Math.abs(t.turn) < Math.abs(list[start].turn)) start = i; });
  const result = [];
  let current = null;
  for (let k = 0; k < n; k++) {
    const { turn, length } = list[(start + k) % n];
    const sign = Math.abs(turn) / length > 1 / maxRadius ? Math.sign(turn) : 0;
    if (sign === 0) current = null;
    else if (current && current.sign === sign) current.sum += turn;
    else { current = { sign, sum: turn }; result.push(current); }
  }
  return { list, angles: result.map((c) => c.sum * DEG) };
}

test("deux circuits extrêmes après les 8 circuits F1, signalés dans leur nom et leur fiche", () => {
  assert.deepEqual(plain(Object.keys(ex.F1_CIRCUITS)).slice(-2), EXTREME);
  for (const key of EXTREME) {
    const layout = ex.F1_CIRCUITS[key];
    assert.match(layout.name, /\(circuit extrême\)$/);
    assert.match(layout.skill, /^inhumain : piste de \d m/);
    assert.equal(layout.areaRatio, undefined, `${key} : tout l'écran`);
    assert.ok(ex.AMBIANCES.includes(layout.ambiance), key);
  }
  const entry = ex.allCircuitEntries().find((e) => e.key === "inferno");
  assert.equal(entry.group, "Formule 1");
});

test("circuits valides : bords sans croisement, dans le canvas, 10 px entre portions, tour faisable en suivant la ligne médiane", () => {
  for (const key of EXTREME) {
    const circuit = build(key);
    assert.equal(circuit.hasSelfIntersection(), false, key);
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
    assert.ok(clearance >= 10, `${key} : ${clearance.toFixed(1)} px`);
    const tracker = new ex.LapTracker(circuit, circuit.center[0]);
    for (let i = 1; i <= n; i++) {
      tracker.update(circuit.center[i % n]);
      assert.ok(tracker.offset < 1e-6, key);
    }
    assert.equal(tracker.laps, 1, key);
    // Les rayons voient des murs finis partout ; une voiture part.
    const spec = { brand: "Ferraaa", model: "F40o", maxSpeed: 4.5, maxForce: 0.22 };
    const car = new ex.Car(circuit, spec, 0, { inputNodes: 6, predict: () => [0.5, 0.3] });
    for (let i = 0; i < 5; i++) car.drive();
    assert.equal(car.dead, false, key);
    assert.ok(car.rayDistances.every(Number.isFinite), key);
  }
});

test("piste très étroite : moins de 10 px de marge de chaque côté, au plus la moitié de celle de Monza", () => {
  const monza = build("monza");
  const monzaMargin = monza.trackWidth / 2 - monza.carWidth / 2;
  const widths = { inferno: 8, hachoir: 7 };
  for (const key of EXTREME) {
    const circuit = build(key);
    assert.ok(Math.abs(circuit.trackWidth - widths[key] * PPM) < 1e-9, key);
    assert.equal(circuit.carWidth, monza.carWidth, "même voiture");
    const margin = circuit.trackWidth / 2 - circuit.carWidth / 2;
    assert.ok(margin < 10 && margin <= monzaMargin / 2 + 1e-9, `${key} : marge ${margin.toFixed(1)} px (Monza ${monzaMargin.toFixed(1)})`);
  }
});

test("un écart de 10 px (3 m) vers la droite élimine la voiture sur les circuits extrêmes, pas à Monza", () => {
  const spec = { brand: "Ferraaa", model: "F40o", maxSpeed: 4.5, maxForce: 0.22 };
  const outcome = (key) => {
    const circuit = build(key);
    const car = new ex.Car(circuit, spec, 0, { inputNodes: 6, predict: () => [0.5, 0.5] });
    const t = circuit.tangents[(circuit.startPose(0).index + 1) % circuit.center.length];
    const c = circuit.center[(circuit.startPose(0).index + 1) % circuit.center.length];
    // Droite de la voiture à l'écran (y vers le bas) : normale (-ty, tx).
    car.pos.set(c.x - t.y * 10, c.y + t.x * 10);
    car.vel.set(0, 0);
    car.update();
    return car.dead;
  };
  assert.equal(outcome("monza"), false);
  assert.equal(outcome("inferno"), true);
  assert.equal(outcome("hachoir"), true);
});

test("difficulté inhumaine : virages plus serrés que la demi-largeur, Inferno > 100 angles droits, Hachoir ≥ 18 épingles aiguës", () => {
  for (const key of EXTREME) {
    const circuit = build(key);
    const { list } = corners(circuit, 250);
    const minRadius = Math.min(...list.filter((t) => Math.abs(t.turn) > 1e-6).map((t) => t.length / Math.abs(t.turn)));
    assert.ok(minRadius < circuit.trackWidth / 2, `${key} : rayon minimal ${minRadius.toFixed(1)} px`);
    const total = list.reduce((s, t) => s + Math.abs(t.turn), 0) / (2 * Math.PI);
    assert.ok(total >= 9, `${key} : ${total.toFixed(1)} tours de volant (Monaco : 3,6)`);
  }
  const right = corners(build("inferno"), 60).angles.filter((a) => Math.abs(Math.abs(a) - 90) < 25);
  assert.ok(right.length > 100, `Inferno : ${right.length} angles droits`);
  assert.ok(right.filter((a) => a > 0).length > 40 && right.filter((a) => a < 0).length > 40, "à droite et à gauche");
  const hairpins = corners(build("hachoir"), 250).angles.filter((a) => Math.abs(a) > 120);
  assert.ok(hairpins.length >= 18, `Hachoir : ${hairpins.length} épingles`);
  assert.ok(hairpins.some((a) => a > 0) && hairpins.some((a) => a < 0), "dans les deux sens");
});

test("aides de tracé : crenelPoints (angles droits) et sawPoints (dents de scie)", () => {
  const crenels = ex.crenelPoints(0, 24, 5, 3, 6);
  assert.deepEqual(plain(crenels), [[0, 5], [6, 5], [6, 8], [12, 8], [12, 5], [18, 5], [18, 8], [24, 8]]);
  const back = ex.crenelPoints(24, 0, 5, 3, 6);
  assert.deepEqual(plain(back[0]), [24, 5]);
  assert.deepEqual(plain(back[back.length - 1]), [0, 8]);
  // Chaque segment est horizontal ou vertical : angles droits.
  for (let i = 1; i < crenels.length; i++) {
    const [ax, ay] = crenels[i - 1];
    const [bx, by] = crenels[i];
    assert.ok(ax === bx || ay === by);
  }
  assert.deepEqual(plain(ex.sawPoints(0, 16, 3, 26, 8)), [[0, 3], [8, 26], [16, 3]]);
  assert.deepEqual(plain(ex.sawPoints(16, 0, 57, 34, 8)), [[16, 57], [8, 34], [0, 57]]);
});
