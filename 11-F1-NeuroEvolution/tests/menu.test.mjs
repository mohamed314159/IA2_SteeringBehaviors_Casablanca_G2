import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadExample } from "./p5-adapter.mjs";

const ex = loadExample();
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const menu = html.slice(html.indexOf('<aside id="menu"'), html.indexOf("</aside>"));
const position = (needle) => {
  const i = menu.indexOf(needle);
  assert.ok(i >= 0, `absent du menu : ${needle}`);
  return i;
};

test("menu : lignées en piste en haut, puis circuit et voitures, puis réseau et rayons", () => {
  const lineages = position('id="lineages"');
  const circuit = position('id="circuitShowroomButton"');
  const cars = position('id="showroomButton"');
  const network = position('id="networkLink"');
  const rays = position('id="rayEditorButton"');
  assert.ok(lineages < circuit && circuit < cars && cars < network && network < rays);
});

test("menu : plus de numéro d'étape ni de textes d'état, seulement des boutons et les lignées", () => {
  assert.equal(/Étape \d+/.test(menu), false);
  for (const removed of ["garageList", "obstacleList", "currentCircuit", "selectionCount", "topologyValue",
    "generationValue", "speedEffective", "levelInfo", "settingsBar", "rayLengthSlider", "<label", "<select"]) {
    assert.equal(menu.includes(removed), false, removed);
  }
  // Hors titres et lignées, le menu ne contient que des boutons (ou un lien en forme de bouton).
  const buttonsPart = menu.slice(menu.indexOf('class="menu-buttons"'));
  const tags = [...buttonsPart.matchAll(/<(\w+)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(tags)].sort(), ["a", "button", "div"]);
});

test("la longueur des rayons est dans l'éditeur de rayons", () => {
  const dialog = html.slice(html.indexOf('<dialog id="rayDialog"'), html.indexOf("</dialog>", html.indexOf('<dialog id="rayDialog"')));
  for (const id of ["rayLengthSlider", "rayShorterButton", "rayLongerButton", "rayLengthDefaultButton", "rayList", "rayAddButton"]) {
    assert.ok(dialog.includes(`id="${id}"`), id);
  }
});

test("le garage est dans la vitrine des voitures (charger, télécharger, repartir de zéro)", () => {
  const dialog = html.slice(html.indexOf('<dialog id="showroomDialog"'), html.indexOf("</dialog>", html.indexOf('<dialog id="showroomDialog"')));
  for (const id of ["loadModelButton", "modelFileInput", "modelConfirm", "modelFileStatus"]) {
    assert.ok(dialog.includes(`id="${id}"`), id);
  }
  const source = fs.readFileSync(new URL("../showroom.js", import.meta.url), "utf8");
  assert.ok(source.includes("Télécharger le modèle") && source.includes("Repartir de zéro"));
});

test("chaque identifiant utilisé par le contrôleur existe dans la page", () => {
  const sketch = fs.readFileSync(new URL("../sketch.js", import.meta.url), "utf8");
  const ids = [...sketch.matchAll(/getElementById\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.ok(ids.length > 20);
  for (const id of new Set(ids)) assert.ok(html.includes(`id="${id}"`), `id manquant : ${id}`);
  assert.equal(new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1])).size,
    [...html.matchAll(/id="([^"]+)"/g)].length, "identifiants en double");
});

test("retirer un obstacle : celui sous le pointeur, le plus récent d'abord", () => {
  const square = [[-10, -10], [10, -10], [10, 10], [-10, 10]];
  const a = new ex.Obstacle(100, 100, square);
  const b = new ex.Obstacle(105, 100, square); // posé après, chevauche a
  assert.equal(ex.obstacleIndexAt([a, b], { x: 103, y: 100 }), 1);
  assert.equal(ex.obstacleIndexAt([a, b], { x: 92, y: 100 }), 1);   // à 3 px du bord de b (tolérance 6 px) : le plus récent
  assert.equal(ex.obstacleIndexAt([a, b], { x: 87, y: 100 }), 0);
  assert.equal(ex.obstacleIndexAt([a, b], { x: 85, y: 100 }), 0);   // à 5 px du bord : tolérance 6 px
  assert.equal(ex.obstacleIndexAt([a, b], { x: 300, y: 300 }), -1);
  assert.equal(ex.obstacleIndexAt([], { x: 0, y: 0 }), -1);
});
