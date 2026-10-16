import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createMemoryStorage, loadExample } from "./p5-adapter.mjs";

const ex = loadExample();
const monza = new ex.Circuit(ex.F1_CIRCUITS.monza, { key: "monza" });
const spec = { brand: "Ferraaa", model: "F40o", maxSpeed: 4.5, maxForce: 0.22 };

test.afterEach(() => {
  ex.setMaxRayLength(undefined);
  ex.setRayLength(ex.DEFAULT_RAY_LENGTH);
});

test("le maximum est la largeur de l'écran, bien au-delà des anciens 300 px", () => {
  assert.equal(ex.setMaxRayLength(1920), 1920);
  assert.equal(ex.currentMaxRayLength(), 1920);
  assert.equal(ex.setRayLength(1920), 1920);
  assert.equal(ex.setRayLength(5000), 1920, "borné à la largeur de l'écran");
  assert.equal(ex.setRayLength(1000), 1000);
  assert.equal(ex.setRayLength(10), ex.MIN_RAY_LENGTH);
  assert.equal(ex.setMaxRayLength(2560.4), 2560, "arrondi au pixel");
});

test("écran inconnu ou invalide → largeur du canvas ; jamais sous la longueur par défaut", () => {
  for (const bad of [undefined, null, NaN, 0, -100, "abc"]) {
    assert.equal(ex.setMaxRayLength(bad), ex.MAX_RAY_LENGTH, String(bad));
  }
  assert.equal(ex.MAX_RAY_LENGTH, 1200);
  assert.equal(ex.setMaxRayLength(100), ex.DEFAULT_RAY_LENGTH);
});

test("écran plus petit : la longueur actuelle est ramenée au nouveau maximum", () => {
  ex.setMaxRayLength(1920);
  ex.setRayLength(1800);
  ex.setMaxRayLength(1366);
  assert.equal(ex.currentRayLength(), 1366);
});

test("longueur mémorisée relue dans la plage de l'écran", () => {
  ex.setMaxRayLength(1920);
  assert.equal(ex.loadRayLength(createMemoryStorage({ [ex.RAY_LENGTH_STORAGE_KEY]: "1700" })), 1700);
  assert.equal(ex.loadRayLength(createMemoryStorage({ [ex.RAY_LENGTH_STORAGE_KEY]: "9999" })), 1920);
  const storage = createMemoryStorage();
  ex.setRayLength(1500);
  ex.saveRayLength(storage);
  assert.equal(storage.data[ex.RAY_LENGTH_STORAGE_KEY], "1500");
});

test("un rayon de 1 900 px voit un mur lointain ; entrées du réseau toujours dans [0, 1]", () => {
  const car = new ex.Car(monza, spec, 0, null, 0, ex.createRng(1));
  car.pos.set(600, 380); // centre du canvas, dans l'herbe : les bords de piste sont loin
  ex.setMaxRayLength(1920);
  ex.setRayLength(300);
  car.sense();
  const short = [...car.rayDistances];
  ex.setRayLength(1900);
  const inputs = car.sense();
  assert.ok(short.every((d) => d <= 300));
  assert.ok(Math.max(...car.rayDistances) > 300, `${Math.max(...car.rayDistances).toFixed(0)} px`);
  assert.ok(car.rayDistances.every((d, i) => d >= short[i] - 1e-9 && d <= 1900));
  assert.ok(inputs.every((v) => v >= 0 && v <= 1));
});

test("recherche des murs bornée aux cases occupées : mêmes murs qu'un parcours complet", () => {
  // Parcours de référence : toutes les cases, sans bornes (comportement d'avant l'étape 23).
  const reference = (pos, radius) => {
    const found = new Set();
    const s = monza.cellSize;
    for (let cx = Math.floor((pos.x - radius) / s); cx <= Math.floor((pos.x + radius) / s); cx++) {
      for (let cy = Math.floor((pos.y - radius) / s); cy <= Math.floor((pos.y + radius) / s); cy++) {
        for (const wall of monza.wallGrid.get(cx + "," + cy) || []) found.add(wall);
      }
    }
    return found;
  };
  for (const [pos, radius] of [[{ x: 600, y: 380 }, 160], [{ x: 100, y: 700 }, 300], [{ x: 600, y: 380 }, 1900], [{ x: 0, y: 0 }, 50]]) {
    const got = new Set(monza.wallsNear(pos, radius));
    const want = reference(pos, radius);
    assert.equal(got.size, want.size, `${radius} px`);
    for (const wall of want) assert.ok(got.has(wall));
  }
  // Rayon couvrant tout : la liste complète des murs, directement.
  assert.equal(monza.wallsNear({ x: 600, y: 380 }, 1900), monza.walls);
});

test("éditeur de rayons : curseur et bouton « Largeur de l'écran » reliés au maximum", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(html.includes('id="rayLengthMaxButton"'));
  const sketch = fs.readFileSync(new URL("../sketch.js", import.meta.url), "utf8");
  assert.ok(sketch.includes("setMaxRayLength(window.screen && window.screen.width)"));
  assert.ok(sketch.indexOf("setMaxRayLength(") < sketch.indexOf("loadRayLength(safeLocalStorage());"), "maximum fixé avant de relire la longueur");
  assert.ok(sketch.includes("ui.rayLengthSlider.max = currentMaxRayLength();"));
});
