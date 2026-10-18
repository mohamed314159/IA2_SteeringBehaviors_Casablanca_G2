import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createMemoryStorage, loadExample } from "./p5-adapter.mjs";

const ex = loadExample();
const plain = (value) => JSON.parse(JSON.stringify(value));
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../style.css", import.meta.url), "utf8");
const sketch = fs.readFileSync(new URL("../sketch.js", import.meta.url), "utf8");

test("réglages par défaut : tout est affiché ; valeurs invalides → défaut", () => {
  assert.deepEqual(plain(ex.normalizePerf(null)), { cars: "all", flames: true, panel: "normal", hidden: false, shaders: true });
  assert.deepEqual(plain(ex.normalizePerf({ cars: "rien", flames: "non", panel: "vite", hidden: "oui", shaders: "non" })), plain(ex.DEFAULT_PERF));
  assert.deepEqual(plain(ex.normalizePerf({ cars: "champions", flames: false, panel: "slow", hidden: true, shaders: false })),
    { cars: "champions", flames: false, panel: "slow", hidden: true, shaders: false });
  assert.deepEqual(plain(ex.normalizePerf(42)), plain(ex.DEFAULT_PERF));
});

test("préréglages : complet, intermédiaire, invisible, sinon personnalisé ; libellé du bouton", () => {
  for (const [name, preset] of Object.entries(ex.PERF_PRESETS)) {
    assert.equal(ex.perfPresetName(preset.perf, preset.decor), name);
  }
  assert.equal(ex.perfButtonLabel(ex.DEFAULT_PERF, ex.DECOR_GRASS), "Performances : complet");
  assert.equal(ex.perfButtonLabel(ex.PERF_PRESETS.intermediaire.perf, ex.DECOR_LIGHT), "Performances : intermédiaire");
  assert.equal(ex.perfButtonLabel(ex.PERF_PRESETS.invisible.perf, ex.DECOR_LIGHT), "Performances : invisible");
  // Le décor compte : réglages complets avec décor léger = personnalisé.
  assert.equal(ex.perfPresetName(ex.DEFAULT_PERF, ex.DECOR_LIGHT), "personnalise");
  assert.equal(ex.perfButtonLabel({ ...ex.DEFAULT_PERF, flames: false }, ex.DECOR_GRASS), "Performances : personnalisé");
  // Plus léger à chaque préréglage : invisible cache tout.
  assert.equal(ex.PERF_PRESETS.invisible.perf.hidden, true);
  assert.equal(ex.PERF_PRESETS.intermediaire.perf.cars, "champions");
});

test("options : chaque clic passe à l'état suivant, sans modifier l'objet d'origine", () => {
  const start = plain(ex.DEFAULT_PERF);
  const original = ex.normalizePerf(start);
  let p = original;
  const seen = [];
  for (let i = 0; i < 3; i++) { p = ex.toggledPerf(p, "cars"); seen.push(p.cars); }
  assert.deepEqual(seen, ["champions", "none", "all"]);
  assert.deepEqual(plain(original), start);
  assert.equal(ex.toggledPerf(original, "flames").flames, false);
  assert.equal(ex.toggledPerf(original, "panel").panel, "slow");
  assert.equal(ex.toggledPerf(ex.toggledPerf(original, "hidden"), "hidden").hidden, false);
  assert.deepEqual(plain(ex.toggledPerf(original, "inconnu")), start);
  // L'état est écrit en toutes lettres.
  assert.equal(ex.perfOptionLabel(original, "cars"), "Voitures dessinées : toutes");
  assert.equal(ex.perfOptionLabel({ cars: "champions" }, "cars"), "Voitures dessinées : meilleure de chaque lignée");
  assert.equal(ex.perfOptionLabel({ cars: "none" }, "cars"), "Voitures dessinées : aucune");
  assert.equal(ex.perfOptionLabel({ flames: false }, "flames"), "Flammes d'arrivée : masquées");
  assert.equal(ex.perfOptionLabel({ panel: "slow" }, "panel"), "Panneau des lignées : 1 fois par seconde");
  assert.equal(ex.perfOptionLabel({ hidden: true }, "hidden"), "Circuit + voitures : invisibles");
});

test("voitures dessinées : toutes, la meilleure de chaque lignée, ou aucune ; la meilleure en dernier", () => {
  const circuit = new ex.Circuit(ex.TRAINING_CIRCUITS["niveau-1-circulaire"], { pixelsPerMeter: 44 / 14 });
  const models = [{ brand: "Ferraaa", model: ex.CAR_BRANDS[1].models[0].name }, { brand: "Tiyoti", model: "Supraa GT" }];
  const cars = ex.createTrainingPopulation(circuit, models, ex.createRng(3));
  for (let f = 0; f < 120; f++) for (const car of cars) car.drive();
  const order = cars.slice();

  const all = ex.carsToDraw(cars, { cars: "all" });
  assert.equal(all.length, cars.length);
  assert.ok(all.every((car) => cars.includes(car)), "mêmes objets");
  assert.equal(all[all.length - 1], ex.bestCar(cars), "la meilleure dessinée en dernier");
  assert.deepEqual(cars, order, "tableau d'origine intact");

  const champions = ex.carsToDraw(cars, { cars: "champions" });
  assert.equal(champions.length, 2, "une par lignée");
  for (const group of ex.groupByLineage(cars).values()) assert.ok(champions.includes(ex.bestCar(group)));
  assert.equal(champions[champions.length - 1], ex.bestCar(cars));

  assert.equal(ex.carsToDraw(cars, { cars: "none" }).length, 0);
  assert.equal(ex.carsToDraw(cars, { cars: "all", hidden: true }).length, 0, "mode invisible : aucune");
  assert.equal(ex.carsToDraw([], { cars: "champions" }).length, 0);
});

test("panneau ralenti et budget de calcul plus grand en mode invisible", () => {
  assert.equal(ex.perfPanelEvery(ex.DEFAULT_PERF), 10);
  assert.equal(ex.perfPanelEvery({ panel: "slow" }), 60);
  assert.equal(ex.perfFrameBudget(ex.DEFAULT_PERF), ex.SIM_FRAME_BUDGET_MS);
  assert.equal(ex.perfFrameBudget({ hidden: true }), 15);
  assert.ok(ex.HIDDEN_FRAME_BUDGET_MS > ex.SIM_FRAME_BUDGET_MS && ex.HIDDEN_FRAME_BUDGET_MS < 1000 / 60);
  // Le budget est bien respecté par runSimulationSteps (horloge contrôlée : 1 ms par pas).
  let clock = 0;
  const steps = (budget) => { clock = 0; return ex.runSimulationSteps(() => { clock += 1; return true; }, "max", () => clock, budget); };
  assert.equal(steps(ex.perfFrameBudget(ex.DEFAULT_PERF)), 12);
  assert.equal(steps(ex.perfFrameBudget({ hidden: true })), 15);
});

test("réglages mémorisés ; stockage absent, illisible ou bloqué → défaut", () => {
  const storage = createMemoryStorage();
  ex.savePerf(storage, { cars: "none", flames: false, panel: "slow", hidden: true, shaders: false });
  assert.deepEqual(plain(ex.loadPerf(storage)), { cars: "none", flames: false, panel: "slow", hidden: true, shaders: false });
  assert.deepEqual(plain(ex.loadPerf(null)), plain(ex.DEFAULT_PERF));
  assert.deepEqual(plain(ex.loadPerf(createMemoryStorage({ [ex.PERF_STORAGE_KEY]: "{pas du json" }))), plain(ex.DEFAULT_PERF));
  const blocked = { getItem() { throw new Error("bloqué"); }, setItem() { throw new Error("bloqué"); } };
  assert.deepEqual(plain(ex.loadPerf(blocked)), plain(ex.DEFAULT_PERF));
  assert.doesNotThrow(() => ex.savePerf(blocked, ex.DEFAULT_PERF));
});

test("page : le bouton Performances remplace le bouton du décor et ouvre un menu accessible", () => {
  const corner = html.slice(html.indexOf('<div class="perf-corner">'), html.indexOf('<main id="layout">'));
  assert.match(corner, /<button id="perfButton"[^>]*aria-expanded="false"[^>]*aria-controls="perfMenu"/);
  assert.match(corner, /<div id="perfMenu"[^>]*hidden>/);
  for (const preset of ["complet", "intermediaire", "invisible"]) assert.ok(corner.includes(`data-preset="${preset}"`), preset);
  for (const option of ["cars", "flames", "panel", "hidden", "shaders"]) assert.ok(corner.includes(`data-perf-option="${option}"`), option);
  assert.ok(corner.includes('id="decorButton"'));
  // Étape 27 : + interrupteur des shaders et 4 options des shaders.
  assert.equal((corner.match(/<button /g) || []).length, 14, "bouton + 3 préréglages + décor + 5 options + 4 options shader");
  // Toutes à deux états, sauf l'ambiance (bouton qui fait défiler les ambiances).
  for (const button of corner.match(/<button [^>]*>/g).slice(1).filter((b) => !b.includes('data-shader-option="ambiance"'))) {
    assert.match(button, /aria-pressed="(true|false)"/);
  }
  const menu = html.slice(html.indexOf('<aside id="menu"'), html.indexOf("</aside>"));
  assert.equal(menu.includes("perfButton"), false, "hors du menu principal");
  // Ordre de chargement : après evolution.js (bestCar, groupByLineage), avant sketch.js.
  assert.ok(html.indexOf('src="evolution.js"') < html.indexOf('src="performance-settings.js"'));
  assert.ok(html.indexOf('src="performance-settings.js"') < html.indexOf('src="sketch.js"'));
  assert.match(css, /\.perf-menu\[hidden\]\s*{\s*display: none;/);
});

test("contrôleur : mode invisible, voitures et flammes selon les réglages, budget et panneau", () => {
  assert.ok(sketch.includes("const hideScene = perf.hidden && (training || demo);"));
  assert.ok(sketch.includes("runSimulationSteps(simulationStep, speedFactor, () => performance.now(), perfFrameBudget(perf))"));
  assert.ok(sketch.includes("frameCount % perfPanelEvery(perf) === 0"));
  assert.ok(sketch.includes("const list = carsToDraw(cars, perf);"));
  assert.equal((sketch.match(/if \(perf\.flames && !perf\.hidden\) finishFlames\.detect/g) || []).length, 2, "détection des flammes coupée aussi");
  assert.equal(sketch.includes("bindDecorButton"), false);
  assert.equal(sketch.includes("PANEL_EVERY"), false);
});
