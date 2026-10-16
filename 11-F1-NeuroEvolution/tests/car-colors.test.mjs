import assert from "node:assert/strict";
import test from "node:test";
import { loadExample } from "./p5-adapter.mjs";

const ex = loadExample();
const plain = (value) => JSON.parse(JSON.stringify(value));
const models = ex.CAR_BRANDS.flatMap((brand) => brand.models.map((model) => ({ brand, model, look: ex.modelAppearance(brand, model) })));

// Écart de couleur perçu (CIE76, ΔE dans l'espace Lab) entre deux couleurs « #rrggbb ».
function toLab(hex) {
  const [r, g, b] = ex.hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const xyz = [
    (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047,
    0.2126 * r + 0.7152 * g + 0.0722 * b,
    (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
  ].map((v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116));
  return [116 * xyz[1] - 16, 500 * (xyz[0] - xyz[1]), 200 * (xyz[1] - xyz[2])];
}
const deltaE = (a, b) => Math.hypot(...toLab(a).map((v, i) => v - toLab(b)[i]));

test("chaque modèle a sa propre couleur, nettement différente de toutes les autres (ΔE ≥ 30)", () => {
  assert.equal(models.length, 11);
  for (let i = 0; i < models.length; i++) {
    for (let j = i + 1; j < models.length; j++) {
      const d = deltaE(models[i].look.color, models[j].look.color);
      assert.ok(d >= 30, `${models[i].model.name} / ${models[j].model.name} : ΔE = ${d.toFixed(1)}`);
    }
  }
  // Le cas signalé : Tiyoti et Ferraaa n'ont plus deux rouges presque identiques.
  const tiyoti = models.filter((m) => m.brand.name === "Tiyoti").map((m) => m.look.color);
  const f40 = models.find((m) => m.model.name === "F40o").look.color;
  for (const c of tiyoti) assert.ok(deltaE(c, f40) >= 40, c);
  assert.ok(deltaE("#d81e2a", "#e10600") < 30, "les deux anciens rouges (ΔE ≈ 18,6) ne respectaient pas cette règle");
});

test("chaque modèle se reconnaît aussi sans la couleur : numéros distincts, livrées connues", () => {
  assert.equal(new Set(models.map((m) => m.look.number)).size, models.length);
  for (const { look } of models) {
    assert.ok(ex.LIVERIES.includes(look.livery), look.livery);
    assert.ok(deltaE(look.color, look.accent) >= 30, `${look.color} / ${look.accent} : motif visible sur la carrosserie`);
  }
});

test("une voiture tirée au hasard porte la couleur de son modèle", () => {
  const spec = ex.createRandomSpecForModel("Tiyoti", "Corolo Sprint", ex.createRng(1));
  assert.equal(spec.color, "#1b1b1b");
  assert.equal(spec.accent, "#d81e2a");
  assert.deepEqual(plain(ex.carAppearance(spec)), { color: "#1b1b1b", accent: "#d81e2a", livery: "double-bande", number: 12 });
});

test("voiture sauvegardée avant l'étape 22 : nouvelle couleur ; modèle inconnu : couleur de sa fiche", () => {
  const old = { brand: "Ferraaa", model: "Testarosso", color: "#e10600", accent: "#ffd800", livery: "bande", number: 55 };
  assert.equal(ex.carAppearance(old).color, "#6b0f2a");
  assert.equal(old.color, "#e10600", "la fiche n'est pas modifiée");
  const unknown = { brand: "Inconnue", model: "X", color: "#123456", accent: "#abcdef", livery: "unie", number: 1 };
  assert.deepEqual(plain(ex.carAppearance(unknown)), { color: "#123456", accent: "#abcdef", livery: "unie", number: 1 });
});

test("contour contrasté : sombre sur une carrosserie claire, clair sur une carrosserie sombre", () => {
  assert.deepEqual(plain(ex.outlineColor("#f4f4f4")), [20, 20, 20]);
  assert.deepEqual(plain(ex.outlineColor("#f5d000")), [20, 20, 20]);
  assert.deepEqual(plain(ex.outlineColor("#1b1b1b")), [240, 240, 240]);
  assert.deepEqual(plain(ex.outlineColor("#6b0f2a")), [240, 240, 240]);
  assert.deepEqual(plain(ex.hexToRgb("pas une couleur")), [128, 128, 128]);
  assert.ok(ex.relativeLuminance("#ffffff") > 0.99 && ex.relativeLuminance("#000000") < 0.01);
});

// Faux p5 : enregistre les appels de dessin (ne prouve pas le rendu réel).
function recordingGraphics() {
  const calls = [];
  const g = new Proxy({ calls, CENTER: "center", HALF_PI: Math.PI / 2, BOLD: "bold" }, {
    get: (target, key) => {
      if (key in target) return target[key];
      if (key === "color") return (value) => ({ value, setAlpha() {} });
      return (...args) => calls.push([key, ...args]);
    }
  });
  return g;
}

test("sur le circuit (version simple) : contour et motif de la livrée dessinés, couleur du modèle", () => {
  const g = recordingGraphics();
  const spec = { brand: "Limbargana", model: "Aventadoro", color: "#f5b800", accent: "#1b1b1b" }; // ancienne couleur
  ex.drawCarDesign(g, spec, 17.6, 6.3);
  const strokes = g.calls.filter((c) => c[0] === "stroke").map((c) => c.slice(1, 4));
  assert.deepEqual(plain(strokes), [[20, 20, 20]], "contour sombre sur le vert clair");
  const fills = g.calls.filter((c) => c[0] === "fill").map((c) => c[1]?.value).filter(Boolean);
  assert.ok(fills.includes("#7ed321"), "couleur actuelle du modèle");
  assert.equal(fills.includes("#f5b800"), false);
  // Damier : plusieurs petits carrés dans la couleur d'accent, après la coque.
  const rects = g.calls.filter((c) => c[0] === "rect");
  assert.ok(rects.length >= 4 + 2 + 2 + 3, `${rects.length} rectangles (pneus, ailerons, coque, damier)`);
});
