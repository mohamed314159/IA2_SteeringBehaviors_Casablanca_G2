import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createMemoryStorage, loadExample } from "./p5-adapter.mjs";

const ex = loadExample();
const PPM = 44 / 14;
const build = (entry) => new ex.Circuit(entry.layout, { key: entry.key, pixelsPerMeter: PPM });
const plain = (value) => JSON.parse(JSON.stringify(value));

test("la vitrine propose tous les circuits : F1 puis niveaux dans l'ordre", () => {
  const entries = ex.allCircuitEntries();
  assert.deepEqual(plain(entries.map((e) => e.key)), [
    "monza", "spa", "interlagos", "silverstone", "monaco", "montreal", "redBullRing", "hungaroring",
    "niveau-1-circulaire", "niveau-2-carre", "niveau-3-drift", "niveau-4-epingles", "niveau-5-coince",
    "niveau-6-drift-gauche", "niveau-7-drift-droite", "niveau-8-freinage", "niveau-9-virage-qui-se-referme", "niveau-10-haricot",
    "niveau-11-serpent", "niveau-12-coeur", "niveau-13-poisson", "niveau-14-chateau", "niveau-15-os",
    "niveau-16-trefle", "niveau-17-etoile", "niveau-18-montagnes", "niveau-19-croissant", "niveau-20-labyrinthe"
  ]);
  assert.deepEqual(plain([...new Set(entries.map((e) => e.group))]), ["Formule 1", "Niveaux d'entraînement"]);
  for (const entry of entries) assert.equal(ex.circuitLayout(entry.key), entry.layout);
  assert.equal(ex.circuitLayout("inconnu"), undefined);
});

test("miniature : le canvas du jeu entier tient dans la vignette", () => {
  const scale = ex.thumbnailScale(1200, 760);
  assert.equal(scale, Math.min(240 / 1200, 152 / 760));
  assert.ok(1200 * scale <= ex.CIRCUIT_THUMB_WIDTH + 1e-9);
  assert.ok(760 * scale <= ex.CIRCUIT_THUMB_HEIGHT + 1e-9);
});

test("fiche : longueur et largeur en mètres, compétence, obstacles, voitures entraînées", () => {
  const [monzaEntry] = ex.allCircuitEntries();
  const coince = ex.allCircuitEntries().find((e) => e.key === "niveau-5-coince");
  const monza = build(monzaEntry);
  const garage = new ex.Garage(createMemoryStorage());
  const car = ex.createTrainingPopulation(monza, [{ brand: "Tiyoti", model: "Supraa GT" }], ex.createRng(1))[0];
  car.lap.distance = monza.totalLength; // tour bouclé sur Monza
  garage.recordChampion(car, monza.name);

  const info = ex.circuitCardInfo(monzaEntry, monza, garage, 2);
  assert.ok(Math.abs(info.lengthMeters - monza.totalLength / PPM) < 1e-9);
  assert.ok(Math.abs(info.widthMeters - 14) < 1e-9);
  assert.equal(info.skill, null);
  assert.equal(info.obstacleCount, 2);
  assert.deepEqual(plain(info.trainedBy), ["Tiyoti | Supraa GT"]);

  const level = ex.circuitCardInfo(coince, build(coince), garage);
  assert.ok(Math.abs(level.widthMeters - 10) < 1e-9);
  assert.match(level.skill, /étroite/);
  assert.deepEqual(plain(level.trainedBy), []);
});

// Cible de dessin factice (comme un p5.Graphics) qui note les appels.
function fakeGraphics() {
  const calls = [];
  const g = { width: 240, height: 152, CLOSE: "close", calls };
  for (const name of ["push", "pop", "background", "translate", "scale", "noFill", "stroke", "strokeWeight",
    "beginShape", "vertex", "endShape", "line", "noStroke", "fill"]) {
    g[name] = (...args) => calls.push([name, ...args]);
  }
  return g;
}

test("miniature : tracé, ligne de départ et obstacles dessinés, styles isolés", () => {
  const entry = ex.allCircuitEntries()[0];
  const circuit = build(entry);
  const square = [[-10, -10], [10, -10], [10, 10], [-10, 10]];
  const g = fakeGraphics();
  ex.drawTrackThumbnail(g, circuit, ex.thumbnailScale(1200, 760), [new ex.Obstacle(300, 300, square)]);
  const count = (name) => g.calls.filter((c) => c[0] === name).length;
  assert.equal(count("push"), count("pop"));
  assert.equal(count("beginShape"), 4);     // ligne médiane, 2 bords, 1 obstacle
  assert.equal(count("line"), 1);           // ligne de départ
  assert.ok(g.calls.some((c) => c[0] === "strokeWeight" && c[1] === circuit.trackWidth)); // largeur réelle de la piste
});

test("la liste déroulante a disparu : la page utilise la vitrine des circuits", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const sketch = fs.readFileSync(new URL("../sketch.js", import.meta.url), "utf8");
  assert.equal(html.includes("circuitSelect"), false);
  assert.equal(sketch.includes("circuitSelect"), false);
  assert.ok(html.includes('id="circuitShowroomButton"'));
  assert.ok(html.includes('id="circuitDialog"'));
});
