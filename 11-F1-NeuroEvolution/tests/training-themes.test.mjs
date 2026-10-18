import assert from "node:assert/strict";
import test from "node:test";
import { loadExample } from "./p5-adapter.mjs";

const ex = loadExample();
const PPM = 44 / 14; // échelle F1 utilisée par sketch.js
const build = (key) => new ex.Circuit(ex.TRAINING_CIRCUITS[key], { pixelsPerMeter: PPM });
const plain = (value) => JSON.parse(JSON.stringify(value));
const THEMES = [
  "niveau-11-serpent", "niveau-12-coeur", "niveau-13-poisson", "niveau-14-chateau", "niveau-15-os",
  "niveau-16-trefle", "niveau-17-etoile", "niveau-18-montagnes", "niveau-19-croissant", "niveau-20-labyrinthe"
];
const DEG = 180 / Math.PI;

// Rotation du cap entre deux points de la ligne médiane (+ = vers la droite à l'écran).
function turns(circuit) {
  const n = circuit.center.length;
  return Array.from({ length: n }, (_, i) => {
    const a = circuit.tangents[i];
    const b = circuit.tangents[(i + 1) % n];
    return { turn: Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y), length: circuit.arc[i + 1] - circuit.arc[i] };
  });
}

// Virages successifs : suites de points qui tournent dans le même sens (rayon < 250 px),
// en partant du point qui tourne le moins. Retourne l'angle total de chaque virage (degrés).
function corners(circuit) {
  const list = turns(circuit);
  let start = 0;
  list.forEach((t, i) => { if (Math.abs(t.turn) < Math.abs(list[start].turn)) start = i; });
  const result = [];
  let current = null;
  for (let k = 0; k < list.length; k++) {
    const { turn, length } = list[(start + k) % list.length];
    const sign = Math.abs(turn) / length > 1 / 250 ? Math.sign(turn) : 0;
    if (sign === 0) current = null;
    else if (current && current.sign === sign) current.sum += turn;
    else { current = { sign, sum: turn }; result.push(current); }
  }
  return result.map((c) => c.sum * DEG);
}

// Le tracé est-il symétrique gauche-droite (miroir autour du milieu du canvas) ?
function mirrorGap(circuit) {
  let worst = 0;
  for (const p of circuit.center) {
    let best = Infinity;
    for (const q of circuit.center) best = Math.min(best, Math.hypot(1200 - p.x - q.x, p.y - q.y));
    worst = Math.max(worst, best);
  }
  return worst;
}

test("10 niveaux à thèmes : niveaux 11 à 20, 1 tour, quart de surface, compétence décrite", () => {
  assert.deepEqual(plain(ex.trainingLevelKeys().slice(10, 20)), THEMES);
  THEMES.forEach((key, i) => {
    const level = ex.TRAINING_CIRCUITS[key];
    assert.equal(level.level, 11 + i, key);
    assert.equal(level.raceLaps, 1, key);
    assert.equal(level.areaRatio, ex.TRAINING_AREA_RATIO, key);
    assert.equal(level.trackWidthMeters, undefined, `${key} : piste F1 de 14 m`);
    assert.ok(level.skill.length > 30, key);
    assert.match(level.name, new RegExp(`^Niveau ${11 + i} – Le |^Niveau ${11 + i} – L'|^Niveau ${11 + i} – Les `));
  });
  assert.equal(ex.trainingLevelKeys().length, 50, "30 niveaux de plus à l'étape 29");
});

test("niveaux à thèmes valides : bords sans croisement, dans le canvas, virages franchissables", () => {
  for (const key of THEMES) {
    const circuit = build(key);
    assert.equal(circuit.hasSelfIntersection(), false, key);
    assert.equal(circuit.trackWidth, 44, key);
    for (const p of [...circuit.leftEdge, ...circuit.rightEdge]) assert.ok(p.x > 0 && p.x < 1200 && p.y > 0 && p.y < 760, key);
    // Les pointes (cœur, étoile, croissant…) peuvent être plus serrées que la demi-largeur
    // (boucle du bord intérieur coupée, comme les épingles F1), mais jamais un angle vif.
    const minRadius = Math.min(...turns(circuit).filter((t) => Math.abs(t.turn) > 1e-6).map((t) => t.length / Math.abs(t.turn)));
    assert.ok(minRadius >= 9, `${key} : rayon minimal ${minRadius.toFixed(1)} px`);
  }
});

test("niveaux complexes : bien plus de virages qu'un cercle, et dans les deux sens", () => {
  const totalTurn = (circuit) => turns(circuit).reduce((s, t) => s + Math.abs(t.turn), 0) / (2 * Math.PI);
  assert.ok(Math.abs(totalTurn(build("niveau-1-circulaire")) - 1) < 0.02, "le cercle : 1 tour de volant");
  for (const key of THEMES) {
    const list = turns(build(key));
    const net = list.reduce((s, t) => s + t.turn, 0);
    const left = list.reduce((s, t) => s + Math.max(0, -t.turn), 0);
    const total = list.reduce((s, t) => s + Math.abs(t.turn), 0);
    assert.ok(Math.abs(net - 2 * Math.PI) < 1e-6, `${key} : un tour dans le sens horaire`);
    assert.ok(total / (2 * Math.PI) >= 1.5, `${key} : ${(total / (2 * Math.PI)).toFixed(2)} tours de volant`);
    assert.ok(left / total >= 0.15, `${key} : ${(100 * left / total).toFixed(0)} % de virages à gauche`);
  }
});

test("Serpent : 5 épingles qui alternent ; Château : 7 demi-tours des créneaux qui alternent", () => {
  const hairpins = (key) => corners(build(key)).filter((a) => Math.abs(Math.abs(a) - 180) < 20);
  for (const [key, count] of [["niveau-11-serpent", 5], ["niveau-14-chateau", 7]]) {
    const list = hairpins(key);
    assert.equal(list.length, count, `${key} : ${list.map(Math.round)}`);
    for (let i = 1; i < list.length; i++) assert.ok(Math.sign(list[i]) !== Math.sign(list[i - 1]), `${key} : sens alterné`);
  }
});

test("Labyrinthe : 14 angles droits, au moins 4 de chaque côté", () => {
  const list = corners(build("niveau-20-labyrinthe"));
  const right = list.filter((a) => Math.abs(a - 90) < 12).length;
  const left = list.filter((a) => Math.abs(a + 90) < 12).length;
  assert.equal(right + left, 14, `${list.map(Math.round)}`);
  assert.ok(right >= 4 && left >= 4, `droite ${right}, gauche ${left}`);
});

test("formes symétriques : cœur, os, trèfle et étoile sont leur propre miroir gauche-droite", () => {
  for (const key of ["niveau-12-coeur", "niveau-15-os", "niveau-16-trefle", "niveau-17-etoile"]) {
    const gap = mirrorGap(build(key));
    assert.ok(gap < 4, `${key} : écart au miroir ${gap.toFixed(1)} px`);
  }
  // Le poisson ne l'est pas : la tête est d'un côté, la queue de l'autre.
  assert.ok(mirrorGap(build("niveau-13-poisson")) > 50);
});

test("aides de tracé : roundCorners, densify, starPoints et lobePoints", () => {
  const square = [[0, 0], [20, 0], [20, 20], [0, 20]];
  const copy = plain(square);
  const rounded = ex.roundCorners(square, 5, 4);
  assert.deepEqual(plain(square), copy, "entrée non modifiée");
  assert.equal(rounded.length, 4 * 5);
  assert.deepEqual(plain(rounded[0]), [0, 5]);
  assert.deepEqual(plain(rounded[4]), [5, 0]);
  // Le coin est coupé : le point le plus proche du coin (0, 0) en est à plus de 1.
  assert.ok(Math.min(...rounded.map(([x, y]) => Math.hypot(x, y))) > 1);
  // La coupe ne dépasse jamais 45 % d'un côté court.
  assert.deepEqual(plain(ex.roundCorners([[0, 0], [4, 0], [4, 4], [0, 4]], 10, 1)[0]), [0, 1.8]);

  const dense = ex.densify(square, 3);
  for (let i = 0; i < dense.length; i++) {
    const [ax, ay] = dense[i];
    const [bx, by] = dense[(i + 1) % dense.length];
    assert.ok(Math.hypot(bx - ax, by - ay) <= 3 + 1e-9);
  }
  for (const p of square) assert.ok(dense.some((q) => q[0] === p[0] && q[1] === p[1]), "sommets conservés");

  const star = ex.starPoints(0, 0, 30, 18, 5);
  assert.equal(star.length, 10);
  star.forEach(([x, y], i) => assert.ok(Math.abs(Math.hypot(x, y) - (i % 2 === 0 ? 30 : 18)) < 1e-9));
  assert.ok(Math.abs(star[0][0]) < 1e-9 && star[0][1] === -30, "première pointe en haut");

  const lobes = ex.lobePoints(0, 0, 22, 6, 4, 48);
  const radii = lobes.map(([x, y]) => Math.hypot(x, y));
  assert.ok(Math.abs(Math.max(...radii) - 28) < 1e-9 && Math.abs(Math.min(...radii) - 16) < 1e-9);
});

test("une voiture part sur chaque niveau à thème ; le parcours compte tous les niveaux (50)", () => {
  const spec = { brand: "Ferraaa", model: "F40o", maxSpeed: 4.5, maxForce: 0.22 };
  const straight = { inputNodes: 6, predict: () => [0.5, 0.6] };
  for (const key of THEMES) {
    const car = new ex.Car(build(key), spec, 0, straight);
    for (let i = 0; i < 5; i++) car.drive();
    assert.equal(car.dead, false, key);
    assert.ok(car.progress > 0, key);
  }
  assert.equal(new ex.Curriculum(ex.trainingLevelKeys(), ["Ferraaa F40o"]).levelKeys.length, 50);
});
