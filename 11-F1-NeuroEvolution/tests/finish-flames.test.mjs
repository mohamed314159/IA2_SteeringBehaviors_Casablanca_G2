import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadExample } from "./p5-adapter.mjs";

// Fonctions de dessin p5 factices : on enregistre les appels (ne prouve pas le rendu réel).
const drawn = [];
const record = (name) => (...args) => drawn.push([name, ...args]);
const ex = loadExample(undefined, {
  ADD: "add", BLEND: "blend",
  push: record("push"), pop: record("pop"), noStroke: record("noStroke"),
  blendMode: record("blendMode"), fill: record("fill"), circle: record("circle")
});
const monza = new ex.Circuit(ex.F1_CIRCUITS.monza, { key: "monza" });
const plain = (value) => JSON.parse(JSON.stringify(value));

// Distance d'un point au segment [a, b].
const distanceToLine = (p, { a, b }) => ex.projectOnSegment(p, a, b).distance;

// Fait avancer un LapTracker réel le long de la ligne médiane, `steps` points à la fois.
function driveAlongCenter(tracker, circuit, from, steps) {
  const n = circuit.center.length;
  for (let k = 1; k <= steps; k++) tracker.update(circuit.center[(((from + k) % n) + n) % n]);
}

test("ligne d'arrivée : du bord gauche au bord droit au point de départ, largeur de la piste", () => {
  const line = ex.finishLine(monza);
  const start = monza.startPose(0);
  assert.deepEqual(plain(line.a), plain(monza.leftEdge[start.index]));
  assert.deepEqual(plain(line.b), plain(monza.rightEdge[start.index]));
  assert.ok(Math.abs(Math.hypot(line.b.x - line.a.x, line.b.y - line.a.y) - monza.trackWidth) < 1e-6);
  line.a.x += 100; // copie : le circuit n'est pas modifié
  assert.notEqual(monza.leftEdge[start.index].x, line.a.x);
});

test("couleur : jaune à la naissance, rouge puis transparente à la fin ; âge hors bornes ramené", () => {
  assert.deepEqual(plain(ex.flameColor(0)), [255, 220, 90, 170]);
  assert.deepEqual(plain(ex.flameColor(0.3)), [255, 140, 20, 119]);
  assert.equal(ex.flameColor(1)[3], 0);
  assert.deepEqual(plain(ex.flameColor(-1)), plain(ex.flameColor(0)));
  assert.deepEqual(plain(ex.flameColor(5)), plain(ex.flameColor(1)));
  for (let t = 0; t < 1; t += 0.05) {
    assert.ok(ex.flameColor(t + 0.05)[3] <= ex.flameColor(t)[3], "l'opacité décroît");
    assert.ok(ex.flameColor(t + 0.05)[1] <= ex.flameColor(t)[1], "le vert décroît : jaune → rouge");
  }
});

test("détection réelle : une voiture qui boucle un tour (LapTracker) allume les flammes une seule fois", () => {
  const flames = new ex.FinishFlames(ex.createRng(1));
  const start = monza.startPose(0).index;
  const car = { lap: new ex.LapTracker(monza, monza.center[start]) };
  const n = monza.center.length;
  // Départ sur la ligne : rien.
  assert.equal(flames.detect([car], monza), 0);
  // Presque un tour : rien.
  driveAlongCenter(car.lap, monza, start, n - 2);
  assert.equal(car.lap.laps, 0);
  assert.equal(flames.detect([car], monza), 0);
  assert.equal(flames.active, false);
  // Franchissement de la ligne.
  driveAlongCenter(car.lap, monza, start + n - 2, 3);
  assert.equal(car.lap.laps, 1);
  assert.equal(flames.detect([car], monza), 1);
  assert.equal(flames.crossings, 1);
  assert.equal(flames.active, true);
  // Le même tour n'est pas recompté ; reculer puis revenir non plus.
  assert.equal(flames.detect([car], monza), 0);
  for (let k = 1; k <= 4; k++) car.lap.update(monza.center[(start + 1 - k + n) % n]); // recule de 4 points
  assert.equal(car.lap.laps, 0, "repassé derrière la ligne");
  driveAlongCenter(car.lap, monza, start - 3, 6);                                 // la refranchit
  assert.equal(car.lap.laps, 1);
  assert.equal(flames.detect([car], monza), 0);
  assert.equal(flames.crossings, 1);
});

test("détection : plusieurs voitures au même pas comptées ensemble ; un deuxième tour rallume", () => {
  const flames = new ex.FinishFlames(ex.createRng(1));
  const cars = [{ lap: { laps: 1 } }, { lap: { laps: 1 } }, { lap: { laps: 0 } }];
  assert.equal(flames.detect(cars, monza), 2);
  assert.equal(flames.crossings, 2);
  cars[0].lap.laps = 2;
  assert.equal(flames.detect(cars, monza), 1);
  assert.equal(flames.crossings, 3);
  assert.equal(flames.detect([], monza), 0);
});

test("émission : particules sur la ligne, montant vers le haut, pendant FLAME_EMIT_FRAMES images puis extinction", () => {
  const flames = new ex.FinishFlames(ex.createRng(3));
  flames.update();
  assert.equal(flames.particles.length, 0, "rien sans passage");
  flames.ignite(monza);
  const line = ex.finishLine(monza);
  flames.emit(50);
  for (const p of flames.particles) {
    assert.ok(distanceToLine(p, line) < 1e-9, "née sur la ligne");
    assert.ok(p.vy <= -ex.FLAME_RISE_MIN && p.vy >= -ex.FLAME_RISE_MAX);
    assert.ok(p.life >= ex.FLAME_LIFE_MIN && p.life <= ex.FLAME_LIFE_MAX);
  }
  flames.clear();
  flames.ignite(monza);
  flames.update();
  assert.equal(flames.particles.length, ex.FLAME_PER_FRAME);
  const before = flames.particles.map((p) => p.y);
  flames.update();
  assert.ok(flames.particles.slice(0, before.length).every((p, i) => p.y < before[i]), "elles montent");
  let frames = 2;
  while (flames.active && frames < 1000) { flames.update(); frames++; }
  assert.equal(flames.active, false);
  assert.ok(frames <= ex.FLAME_EMIT_FRAMES + ex.FLAME_LIFE_MAX + 1, `éteintes après ${frames} images`);
});

test("plafond de particules (passages rapprochés en accéléré) et changement de circuit", () => {
  const flames = new ex.FinishFlames(ex.createRng(5));
  for (let i = 0; i < 200; i++) {
    flames.ignite(monza);
    flames.emit(20);
  }
  assert.equal(flames.particles.length, ex.FLAME_MAX_PARTICLES);
  flames.clear();
  assert.equal(flames.active, false);
  flames.update();
  assert.equal(flames.particles.length, 0, "clear arrête aussi l'émission");
});

test("même graine → mêmes flammes", () => {
  const run = (seed) => {
    const flames = new ex.FinishFlames(ex.createRng(seed));
    flames.ignite(monza);
    for (let i = 0; i < 10; i++) flames.update();
    return plain(flames.particles);
  };
  assert.deepEqual(run(9), run(9));
  assert.notDeepEqual(run(9), run(10));
});

test("dessin : rien sans particule ; sinon mode additif rétabli et push/pop équilibrés", () => {
  const flames = new ex.FinishFlames(ex.createRng(2));
  drawn.length = 0;
  flames.show();
  assert.equal(drawn.length, 0);
  flames.ignite(monza);
  flames.update();
  flames.show();
  const names = drawn.map((c) => c[0]);
  assert.equal(names[0], "push");
  assert.equal(names.at(-1), "pop");
  assert.deepEqual(drawn.filter((c) => c[0] === "blendMode").map((c) => c[1]), ["add", "blend"]);
  assert.equal(names.filter((n) => n === "circle").length, ex.FLAME_PER_FRAME);
});

test("contrôleur : détection à chaque pas avant le remplacement des lignées, animation une fois par image", () => {
  const sketch = fs.readFileSync(new URL("../sketch.js", import.meta.url), "utf8");
  const step = sketch.slice(sketch.indexOf("function simulationStep()"), sketch.indexOf("function drawTrainingCars()"));
  assert.ok(step.indexOf("finishFlames.detect(cars, circuit)") < step.indexOf("advanceLineages()"));
  assert.equal((step.match(/finishFlames\.detect/g) || []).length, 2, "entraînement et démonstration");
  const draw = sketch.slice(sketch.indexOf("function draw()"), sketch.indexOf("function simulationStep()"));
  assert.ok(draw.includes("finishFlames.update();") && draw.includes("finishFlames.show();"));
  assert.ok(draw.indexOf("finishFlames.update()") > draw.indexOf("runSimulationSteps"), "après la simulation de l'image");
});
