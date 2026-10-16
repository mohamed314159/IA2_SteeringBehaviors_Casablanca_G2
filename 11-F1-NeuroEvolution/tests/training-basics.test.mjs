import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadExample } from "./p5-adapter.mjs";

const ex = loadExample();
const PPM = 44 / 14; // échelle F1 utilisée par sketch.js
const build = (key) => new ex.Circuit(ex.TRAINING_CIRCUITS[key], { pixelsPerMeter: PPM });
const plain = (value) => JSON.parse(JSON.stringify(value));
const BASICS = ["niveau-6-drift-gauche", "niveau-7-drift-droite", "niveau-8-freinage", "niveau-9-virage-qui-se-referme", "niveau-10-haricot"];

// Rotation du cap entre deux points de la ligne médiane (+ = vers la droite à l'écran, comme les rayons).
function turns(circuit) {
  const n = circuit.center.length;
  return Array.from({ length: n }, (_, i) => {
    const a = circuit.tangents[i];
    const b = circuit.tangents[(i + 1) % n];
    return { turn: Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y), length: circuit.arc[i + 1] - circuit.arc[i], x: circuit.center[i].x };
  });
}

function turnSummary(circuit) {
  let right = 0, left = 0, net = 0;
  for (const { turn } of turns(circuit)) {
    net += turn;
    if (turn > 0) right += turn; else left -= turn;
  }
  return { net, rightShare: right / (right + left), leftShare: left / (right + left) };
}

test("5 nouveaux niveaux de base : niveaux 6 à 10, 1 tour, quart de surface, compétence décrite", () => {
  assert.deepEqual(plain(ex.trainingLevelKeys().slice(5)), BASICS);
  BASICS.forEach((key, i) => {
    const level = ex.TRAINING_CIRCUITS[key];
    assert.equal(level.level, 6 + i, key);
    assert.equal(level.raceLaps, 1, key);
    assert.equal(level.areaRatio, ex.TRAINING_AREA_RATIO, key);
    assert.ok(level.skill.length > 20, key);
    assert.match(level.name, new RegExp(`^Niveau ${6 + i} – `));
  });
  assert.equal(new Set(ex.trainingLevelKeys().map((k) => ex.TRAINING_CIRCUITS[k].name)).size, 10, "noms distincts");
});

test("nouveaux niveaux valides : bords sans croisement, dans le canvas, place entre portions, piste F1", () => {
  for (const key of BASICS) {
    const circuit = build(key);
    assert.equal(circuit.hasSelfIntersection(), false, key);
    assert.equal(circuit.trackWidth, 44, key);
    for (const p of [...circuit.leftEdge, ...circuit.rightEdge]) assert.ok(p.x > 0 && p.x < 1200 && p.y > 0 && p.y < 760, key);
    // Rayon de courbure minimal supérieur à la demi-largeur de piste (bord intérieur sans rebroussement).
    const minRadius = Math.min(...turns(circuit).filter((t) => Math.abs(t.turn) > 1e-6).map((t) => t.length / Math.abs(t.turn)));
    assert.ok(minRadius > circuit.trackWidth / 2, `${key} : rayon minimal ${minRadius.toFixed(1)} px`);
  }
});

test("drift à gauche : un tour dans le sens anti-horaire, ≥ 95 % des virages à gauche ; drift à droite : le miroir", () => {
  const left = turnSummary(build("niveau-6-drift-gauche"));
  const right = turnSummary(build("niveau-7-drift-droite"));
  assert.ok(Math.abs(left.net + 2 * Math.PI) < 1e-6, "un tour complet vers la gauche");
  assert.ok(Math.abs(right.net - 2 * Math.PI) < 1e-6, "un tour complet vers la droite");
  assert.ok(left.leftShare >= 0.95, `gauche : ${left.leftShare.toFixed(3)}`);
  assert.ok(right.rightShare >= 0.95, `droite : ${right.rightShare.toFixed(3)}`);
  // Exactement symétriques : même longueur de tour.
  assert.ok(Math.abs(build("niveau-6-drift-gauche").totalLength - build("niveau-7-drift-droite").totalLength) < 1e-6);
  assert.deepEqual(plain(ex.mirrorX([[10, 5], [70, 30]])), [[90, 5], [30, 30]]);
});

test("freinage : au moins la moitié du tour en ligne droite, puis des demi-tours (épingles)", () => {
  const circuit = build("niveau-8-freinage");
  const list = turns(circuit);
  const straight = list.filter((t) => Math.abs(t.turn) / t.length < 0.002).reduce((s, t) => s + t.length, 0);
  assert.ok(straight / circuit.totalLength >= 0.5, `${(100 * straight / circuit.totalLength).toFixed(0)} % de ligne droite`);
  // Chaque moitié du canvas contient un demi-tour (≈ 180°) dans le même sens.
  for (const side of [(x) => x < 600, (x) => x >= 600]) {
    const turned = list.filter((t) => side(t.x)).reduce((s, t) => s + t.turn, 0);
    assert.ok(Math.abs(Math.abs(turned) - Math.PI) < 0.15, `demi-tour : ${(turned * 180 / Math.PI).toFixed(0)}°`);
  }
});

test("virage qui se referme : le rayon de la fin du virage est nettement plus petit que celui de l'entrée", () => {
  const circuit = build("niveau-9-virage-qui-se-referme");
  // Virage de droite du tracé (la spirale) : points à droite du centre du tracé qui tournent.
  const cx = (Math.min(...circuit.center.map((p) => p.x)) + Math.max(...circuit.center.map((p) => p.x))) / 2;
  const corner = turns(circuit).filter((t) => t.x > cx + 60 && Math.abs(t.turn) > 1e-4);
  const total = corner.reduce((s, t) => s + t.turn, 0);
  assert.ok(Math.abs(total - Math.PI) < 0.3, `demi-tour à droite : ${(total * 180 / Math.PI).toFixed(0)}°`);
  // Rayon moyen (longueur / angle) sur le premier et le dernier tiers de l'angle tourné.
  const radiusOver = (from, to) => {
    let angle = 0, length = 0, seen = 0;
    for (const t of corner) {
      if (seen >= from * total && seen < to * total) { angle += t.turn; length += t.length; }
      seen += t.turn;
    }
    return length / angle;
  };
  const entry = radiusOver(0, 1 / 3);
  const exit = radiusOver(2 / 3, 1);
  assert.ok(entry > exit * 1.4, `entrée ${entry.toFixed(0)} px, sortie ${exit.toFixed(0)} px`);
  // Les points de la spirale ont bien un rayon décroissant.
  const spiral = ex.spiralPoints(0, 0, 24, 12, -90, 90, 10);
  const radii = spiral.map(([x, y]) => Math.hypot(x, y));
  for (let i = 1; i < radii.length; i++) assert.ok(radii[i] < radii[i - 1]);
});

test("haricot : surtout à droite, mais une vraie part de virage à gauche (les creux)", () => {
  const summary = turnSummary(build("niveau-10-haricot"));
  assert.ok(Math.abs(summary.net - 2 * Math.PI) < 1e-6);
  assert.ok(summary.leftShare >= 0.1 && summary.leftShare <= 0.35, `gauche : ${summary.leftShare.toFixed(3)}`);
  // Les niveaux « tout à droite » n'ont presque pas de gauche : le haricot est bien différent.
  assert.ok(turnSummary(build("niveau-1-circulaire")).leftShare < 0.02);
});

test("une voiture part sur chaque nouveau niveau ; le parcours compte 10 niveaux (libellé du bouton)", () => {
  const spec = { brand: "Ferraaa", model: "F40o", maxSpeed: 4.5, maxForce: 0.22 };
  const straight = { inputNodes: 6, predict: () => [0.5, 0.6] };
  for (const key of BASICS) {
    const car = new ex.Car(build(key), spec, 0, straight);
    for (let i = 0; i < 5; i++) car.drive();
    assert.equal(car.dead, false, key);
    assert.ok(car.progress > 0, key);
  }
  const curriculum = new ex.Curriculum(ex.trainingLevelKeys(), ["Ferraaa F40o"]);
  assert.equal(curriculum.levelKeys.length, 10);
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(html.includes("Parcours d'entraînement (10 niveaux)"));
  const sketch = fs.readFileSync(new URL("../sketch.js", import.meta.url), "utf8");
  assert.ok(sketch.includes("Parcours d'entraînement (${trainingLevelKeys().length} niveaux)"), "libellé calculé");
});
