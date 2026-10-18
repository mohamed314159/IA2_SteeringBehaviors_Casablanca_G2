import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadExample, SCRIPTS } from "./p5-adapter.mjs";

// Étape 31 : décor posé sur l'herbe (scenery.js) ; étape 28 : voitures plus jolies (car-design.js).
// Constantes et color() de p5 utilisées par drawTrackLayer (adaptateur minimal).
const ex = loadExample(SCRIPTS, { ROUND: "round", SQUARE: "square", CLOSE: "close", color: (...args) => args });
const PPM = 44 / 14;
const build = (key) => new ex.Circuit(ex.circuitLayout(key), { key, pixelsPerMeter: PPM });
const plain = (value) => JSON.parse(JSON.stringify(value));
const SAMPLE = ["monza", "monaco", "inferno", "hachoir", "niveau-1-circulaire", "niveau-31-sapin", "niveau-50-dedale"];
const exampleDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const plans = new Map(SAMPLE.map((key) => [key, ex.planScenery(build(key), ex.createRng(7))]));

// Faux p5 qui enregistre les appels (ne prouve pas le rendu réel).
function recordingGraphics() {
  const calls = [];
  const g = new Proxy({ calls, CENTER: "center", CLOSE: "close", HALF_PI: Math.PI / 2, BOLD: "bold" }, {
    get: (target, key) => {
      if (key in target) return target[key];
      if (key === "color") return (value) => ({ value, setAlpha() {} });
      return (...args) => calls.push([key, ...args]);
    }
  });
  return g;
}

test("aucun objet sur la piste ni dans le dégagement, tous entiers dans le canvas", () => {
  for (const [key, items] of plans) {
    const circuit = build(key);
    assert.ok(items.length > 300, `${key} : ${items.length} objets`);
    for (const item of items) {
      const points = item.type === "tribune"
        ? ex.grandstandPerimeter(item)
        : Array.from({ length: 12 }, (_, k) => ({ x: item.x + Math.cos(k * Math.PI / 6) * item.r, y: item.y + Math.sin(k * Math.PI / 6) * item.r }));
      const gap = item.type === "pneus" ? ex.TYRE_TRACK_GAP : ex.SCENERY_TRACK_GAP;
      for (const p of points) {
        assert.ok(circuit.project(p).distance - circuit.trackWidth / 2 >= gap - 0.6, `${key} : ${item.type} trop près de la piste`);
        assert.ok(p.x >= 0 && p.y >= 0 && p.x <= 1200 && p.y <= 760, `${key} : ${item.type} hors du canvas`);
      }
    }
  }
});

test("les objets ne se chevauchent pas", () => {
  for (const [key, items] of plans) {
    for (let i = 0; i < items.length; i++) {
      if (items[i].type === "tribune") continue;
      for (let j = 0; j < items.length; j++) {
        if (i === j) continue;
        assert.ok(ex.sceneryDistance(items[j], items[i].x, items[i].y) >= items[i].r + ex.SCENERY_SPACING - 1e-9,
          `${key} : ${items[i].type} chevauche ${items[j].type}`);
      }
    }
  }
});

test("pas d'herbe vide : loin de la piste, chaque point est à moins de 30 px d'un objet", () => {
  for (const [key, items] of plans) {
    const circuit = build(key);
    let grass = 0;
    let empty = 0;
    for (let y = 5; y < 760; y += 10) {
      for (let x = 5; x < 1200; x += 10) {
        if (ex.distanceToTrack(circuit, x, y) < ex.SCENERY_TRACK_GAP + 12) continue;   // dégagement
        grass++;
        if (Math.min(...items.map((item) => ex.sceneryDistance(item, x, y))) > 30) empty++;
      }
    }
    assert.ok(grass > 1000, key);
    assert.ok(empty / grass < 0.005, `${key} : ${empty} points d'herbe vide sur ${grass}`);
  }
});

test("variété : arbres, sapins, buissons, rochers, fleurs, tentes, étangs ; pneus aux virages ; tribunes le long des lignes droites", () => {
  const types = new Set(plans.get("monza").map((i) => i.type));
  for (const type of ["arbre", "sapin", "buisson", "rocher", "fleurs", "tente", "etang", "pneus", "tribune"]) assert.ok(types.has(type), type);
  // Tribunes : sur les 8 circuits F1 ; parallèles à la piste la plus proche.
  for (const key of ["monza", "spa", "interlagos", "silverstone", "monaco", "montreal", "redBullRing", "hungaroring"]) {
    const circuit = build(key);
    const stands = ex.planScenery(circuit, ex.createRng(7)).filter((i) => i.type === "tribune");
    assert.ok(stands.length >= 1, `${key} : tribune`);
    for (const stand of stands) {
      const p = circuit.project(stand);
      const t = circuit.tangents[p.index];
      assert.ok(Math.abs(Math.sin(stand.angle - Math.atan2(t.y, t.x))) < 0.15, `${key} : tribune le long de la piste`);
    }
  }
  // Pneus : à l'extérieur des virages, près du bord (barrière).
  const monaco = build("monaco");
  for (const tyre of plans.get("monaco").filter((i) => i.type === "pneus")) {
    const d = ex.distanceToTrack(monaco, tyre.x, tyre.y);
    assert.ok(d >= ex.TYRE_TRACK_GAP + ex.TYRE_RADIUS - 0.6 && d < ex.TYRE_TRACK_GAP + ex.TYRE_RADIUS + 3, `${d}`);
  }
  assert.ok(plans.get("inferno").filter((i) => i.type === "pneus").length > 50, "Inferno : pneus à ses nombreux angles");
});

test("même graine, même décor ; autre graine, autre décor ; lignes droites triées", () => {
  const circuit = build("monza");
  assert.deepEqual(plain(ex.planScenery(circuit, ex.createRng(7))), plain(plans.get("monza")));
  assert.notDeepEqual(plain(ex.planScenery(circuit, ex.createRng(8))), plain(plans.get("monza")));
  const runs = ex.straightRuns(circuit);
  for (let i = 1; i < runs.length; i++) assert.ok(runs[i - 1].count >= runs[i].count);
  // Cercle : aucune ligne droite, donc aucune tribune.
  assert.equal(plans.get("niveau-1-circulaire").filter((i) => i.type === "tribune").length, 0);
});

test("distance à un objet : disque et rectangle orienté (négative à l'intérieur)", () => {
  assert.equal(ex.sceneryDistance({ type: "arbre", x: 0, y: 0, r: 5 }, 8, 0), 3);
  assert.equal(ex.sceneryDistance({ type: "arbre", x: 0, y: 0, r: 5 }, 0, 0), -5);
  const stand = { type: "tribune", x: 100, y: 100, angle: Math.PI / 2, length: 40, depth: 10 };
  assert.ok(Math.abs(ex.sceneryDistance(stand, 100, 100 + 25) - 5) < 1e-9, "le long de l'axe tourné");
  assert.ok(Math.abs(ex.sceneryDistance(stand, 100 + 8, 100) - 3) < 1e-9, "sur le côté");
  assert.equal(ex.sceneryDistance(stand, 100, 100), -5);
  assert.ok(ex.grandstandPerimeter(stand).every((p) => Math.abs(ex.sceneryDistance(stand, p.x, p.y)) < 1e-9));
});

test("dessin : chaque type d'objet, styles isolés ; décor pré-rendu avec les objets avant la piste", () => {
  const g = recordingGraphics();
  ex.drawScenery(g, plans.get("monza"));
  const count = (name) => g.calls.filter((c) => c[0] === name).length;
  assert.equal(count("push"), count("pop"));
  assert.ok(count("ellipse") > 500);
  // drawTrackLayer : le fond, puis les objets, puis la piste.
  const layer = recordingGraphics();
  layer.width = 1200;
  layer.height = 760;
  const circuit = build("monza");
  ex.drawTrackLayer(layer, circuit, ex.createRng(42), ex.DECOR_LIGHT, plans.get("monza"));
  const names = layer.calls.map((c) => c[0]);
  const firstTree = layer.calls.findIndex((c) => c[0] === "fill" && c[1] === "#2f6b2a");
  const asphalt = layer.calls.findIndex((c) => c[0] === "strokeWeight" && c[1] === circuit.trackWidth);
  assert.ok(names[0] === "background" && firstTree > 0 && asphalt > firstTree, "fond, objets, puis asphalte");
  const sketch = fs.readFileSync(path.join(exampleDir, "sketch.js"), "utf8");
  assert.ok(sketch.includes("scenery = planScenery(circuit, createRng(SCENERY_SEED), CANVAS_WIDTH, CANVAS_HEIGHT);"), "un plan par circuit");
  assert.ok(sketch.includes("drawTrackLayer(trackLayer, circuit, createRng(42), decor, scenery);"));
});

// ---------- Étape 28 : voitures plus jolies ----------

test("silhouette de F1 : symétrique, nez pointu vers +x, pontons plus larges que le nez, dans la longueur", () => {
  const L = 17.6;
  const W = 6.3;
  const outline = ex.chassisOutline(L, W);
  const n = outline.length;
  for (let i = 0; i < n / 2; i++) {
    const [x1, y1] = outline[i];
    const [x2, y2] = outline[n - 1 - i];
    assert.ok(Math.abs(x1 - x2) < 1e-9 && Math.abs(y1 + y2) < 1e-9, "symétrie gauche-droite");
  }
  const xs = outline.map((p) => p[0]);
  assert.ok(Math.max(...xs) === L * 0.5 && Math.min(...xs) >= -L * 0.5);
  const widthAt = (x) => Math.max(...outline.filter((p) => Math.abs(p[0] - x) < L * 0.06).map((p) => Math.abs(p[1])));
  assert.ok(widthAt(0) > 3 * widthAt(L * 0.45), "pontons bien plus larges que le nez");
  assert.ok(outline.every(([, y]) => Math.abs(y) <= W / 2));
});

test("reflets et ombres de carrosserie : couleur éclaircie ou assombrie, bornée", () => {
  assert.deepEqual(plain(ex.shadeColor("#000000", 0.5)), [128, 128, 128]);
  assert.deepEqual(plain(ex.shadeColor("#ffffff", -0.5)), [128, 128, 128]);
  assert.deepEqual(plain(ex.shadeColor("#d81e2a", 0)), [216, 30, 42]);
  assert.deepEqual(plain(ex.shadeColor("#d81e2a", 2)), [255, 255, 255]);
  assert.deepEqual(plain(ex.shadeColor("#d81e2a", -1)), [0, 0, 0]);
});

test("dessin de la voiture : ombre portée, coque en silhouette, casque coloré ; pas d'ombre pour une voiture éliminée", () => {
  const spec = { color: "#d81e2a", accent: "#ffffff", livery: "bande", number: 7 };
  const g = recordingGraphics();
  ex.drawCarDesign(g, spec, 17.6, 6.3);
  const shadow = g.calls.findIndex((c) => c[0] === "fill" && c[1] === 0 && c[4] === 70);
  const shapes = g.calls.filter((c) => c[0] === "beginShape").length;
  assert.ok(shadow >= 0, "ombre");
  assert.equal(shapes, 2, "ombre + coque");
  assert.equal(g.calls.filter((c) => c[0] === "push").length, g.calls.filter((c) => c[0] === "pop").length);
  const dead = recordingGraphics();
  ex.drawCarDesign(dead, spec, 17.6, 6.3, { dead: true });
  assert.equal(dead.calls.findIndex((c) => c[0] === "fill" && c[1] === 0 && c[4] === 70), -1);
  assert.equal(dead.calls.filter((c) => c[0] === "beginShape").length, 1);
});
