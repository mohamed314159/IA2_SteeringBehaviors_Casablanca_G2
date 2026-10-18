import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadExample } from "./p5-adapter.mjs";

// Étape 29 : 30 niveaux d'entraînement de plus (21 à 50).
const ex = loadExample();
const PPM = 44 / 14;
const build = (key) => new ex.Circuit(ex.TRAINING_CIRCUITS[key], { key, pixelsPerMeter: PPM });
const plain = (value) => JSON.parse(JSON.stringify(value));
const NEW = ex.trainingLevelKeys().slice(20);
const exampleDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function turns(circuit) {
  const n = circuit.center.length;
  return Array.from({ length: n }, (_, i) => {
    const a = circuit.tangents[i];
    const b = circuit.tangents[(i + 1) % n];
    return { turn: Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y), length: circuit.arc[i + 1] - circuit.arc[i] };
  });
}

function clearance(circuit) {
  const n = circuit.center.length;
  let worst = Infinity;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(ex.wrapArcDelta(circuit.arc[j] - circuit.arc[i], circuit.totalLength)) < circuit.trackWidth * 3) continue;
      worst = Math.min(worst, Math.hypot(circuit.center[i].x - circuit.center[j].x, circuit.center[i].y - circuit.center[j].y) - circuit.trackWidth);
    }
  }
  return worst;
}

test("30 niveaux de plus : niveaux 21 à 50 dans l'ordre, noms distincts, 1 tour, quart de surface", () => {
  assert.equal(NEW.length, 30);
  NEW.forEach((key, i) => {
    const level = ex.TRAINING_CIRCUITS[key];
    assert.equal(level.level, 21 + i, key);
    assert.match(level.name, new RegExp(`^Niveau ${21 + i} – `), key);
    assert.match(key, new RegExp(`^niveau-${21 + i}-`), key);
    assert.equal(level.raceLaps, 1, key);
    assert.equal(level.areaRatio, ex.TRAINING_AREA_RATIO, key);
    assert.ok(level.skill.length > 30, `${key} : compétence décrite`);
    // Épreuves finales (46 à 50) : piste de 12 m ; les autres gardent les 14 m d'une piste F1.
    assert.equal(level.trackWidthMeters, 21 + i >= 46 ? 12 : undefined, key);
  });
  const names = ex.trainingLevelKeys().map((k) => ex.TRAINING_CIRCUITS[k].name);
  assert.equal(new Set(names).size, 50, "50 noms distincts");
});

test("chaque nouveau niveau est valide : bords sans croisement, dans le canvas, virages franchissables, 20 px entre portions", () => {
  for (const key of NEW) {
    const circuit = build(key);
    assert.equal(circuit.hasSelfIntersection(), false, key);
    for (const p of [...circuit.leftEdge, ...circuit.rightEdge]) {
      assert.ok(Number.isFinite(p.x) && p.x > 0 && p.x < 1200 && p.y > 0 && p.y < 760, key);
    }
    const minRadius = Math.min(...turns(circuit).filter((t) => Math.abs(t.turn) > 1e-6).map((t) => t.length / Math.abs(t.turn)));
    assert.ok(minRadius >= 9, `${key} : rayon minimal ${minRadius.toFixed(1)} px`);
    assert.ok(clearance(circuit) >= 20, `${key} : ${clearance(circuit).toFixed(1)} px entre deux portions`);
    // Une voiture qui suit la ligne médiane boucle le tour sans s'en écarter.
    const tracker = new ex.LapTracker(circuit, circuit.center[0]);
    for (let i = 1; i <= circuit.center.length; i++) tracker.update(circuit.center[i % circuit.center.length]);
    assert.equal(tracker.laps, 1, key);
  }
});

test("variété : un tour fermé, des formes simples puis de plus en plus de virages dans les deux sens", () => {
  let complex = 0;
  for (const key of NEW) {
    const list = turns(build(key));
    const net = list.reduce((s, t) => s + t.turn, 0);
    const total = list.reduce((s, t) => s + Math.abs(t.turn), 0) / (2 * Math.PI);
    const left = list.reduce((s, t) => s + Math.max(0, -t.turn), 0) / (2 * Math.PI);
    assert.ok(Math.abs(Math.abs(net) - 2 * Math.PI) < 1e-6, `${key} : un tour`);
    assert.ok(total >= 0.99, key);
    if (total >= 2 && left / total >= 0.2) complex++;
  }
  assert.ok(complex >= 22, `${complex} niveaux sur 30 avec ≥ 2 tours de volant et ≥ 20 % à gauche`);
  // Les épreuves finales (46 à 50) font toutes tourner dans les deux sens.
  for (const key of NEW.slice(25)) {
    const list = turns(build(key));
    assert.ok(list.some((t) => t.turn > 0.01) && list.some((t) => t.turn < -0.01), key);
  }
});

test("lettres M et W : même tracé retourné haut-bas, donc les virages à droite deviennent à gauche", () => {
  const share = (key) => {
    const list = turns(build(key));
    return list.reduce((s, t) => s + Math.max(0, t.turn), 0) / list.reduce((s, t) => s + Math.abs(t.turn), 0);
  };
  const m = share("niveau-35-lettre-m");
  const w = share("niveau-36-lettre-w");
  assert.ok(Math.abs(m + w - 1) < 0.01, `droite M ${m.toFixed(2)}, droite W ${w.toFixed(2)}`);
  const copy = plain(ex.M_POINTS);
  const flipped = ex.mirrorY(ex.M_POINTS);
  assert.deepEqual(plain(ex.M_POINTS), copy, "entrée non modifiée");
  flipped.forEach(([x, y], i) => assert.deepEqual([x, y], [copy[i][0], 60 - copy[i][1]]));
});

test("aide polygonPoints : sommets sur l'ellipse, premier en haut, sens horaire", () => {
  const pentagon = ex.polygonPoints(50, 30, 20, 5, 1.5);
  assert.equal(pentagon.length, 5);
  assert.ok(Math.abs(pentagon[0][0] - 50) < 1e-9 && Math.abs(pentagon[0][1] - 10) < 1e-9);
  pentagon.forEach(([x, y]) => assert.ok(Math.abs(Math.hypot((x - 50) / 1.5, y - 30) - 20) < 1e-9));
  assert.ok(pentagon[1][0] > 50, "le deuxième sommet est à droite (sens horaire à l'écran)");
});

test("une voiture part sur chaque nouveau niveau ; ambiances connues ; le parcours « Déploiement » compte 50 niveaux", () => {
  const spec = { brand: "Ferraaa", model: "F40o", maxSpeed: 4.5, maxForce: 0.22 };
  const straight = { inputNodes: 6, predict: () => [0.5, 0.6] };
  for (const key of NEW) {
    const car = new ex.Car(build(key), spec, 0, straight);
    for (let i = 0; i < 5; i++) car.drive();
    assert.equal(car.dead, false, key);
    assert.ok(car.progress > 0, key);
    const ambiance = ex.TRAINING_CIRCUITS[key].ambiance;
    assert.ok(ambiance === undefined || ex.AMBIANCES.includes(ambiance), key);
  }
  assert.equal(new ex.Curriculum(ex.trainingLevelKeys(), ["Ferraaa F40o"]).levelKeys.length, 50);
  const sketch = fs.readFileSync(path.join(exampleDir, "sketch.js"), "utf8");
  assert.ok(sketch.includes("deployButtonHtml(trainingLevelKeys().length)"), "libellé calculé : « parcours de 50 niveaux »");
});
