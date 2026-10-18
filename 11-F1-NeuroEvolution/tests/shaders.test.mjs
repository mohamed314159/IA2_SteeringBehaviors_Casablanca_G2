import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createMemoryStorage, loadExample, SCRIPTS } from "./p5-adapter.mjs";

// Faux p5 pour ShaderDecor : enregistre les appels (le vrai rendu WebGL est
// vérifié dans le navigateur, voir README).
function fakeP5() {
  const log = { draws: [], copies: 0, heatUploads: 0, framebuffers: [], masks: 0, maskProps: 0 };
  const shape = () => ({});
  const g2d = () => ({
    elt: {}, pixelDensity() {}, push() {}, pop() {}, background() { log.masks++; }, noFill() {}, strokeJoin() {},
    stroke() {}, strokeWeight() {}, beginShape: shape, vertex() {}, endShape() {},
    noStroke() {}, fill() {}, translate() {}, rotate() {}, rectMode() {},
    rect() { log.maskProps++; }, ellipse() { log.maskProps++; }
  });
  const globals = {
    WEBGL: "webgl", ROUND: "round", CLOSE: "close", CENTER: "center",
    createGraphics: () => g2d(),
    createImage: (w, h) => ({
      width: w, height: h, pixels: new Uint8ClampedArray(w * h * 4), modified: false,
      loadPixels() {}, updatePixels() { log.heatUploads++; },
      drawingContext: { drawImage: () => { log.copies++; } },
      setModified(value) { this.modified = value; }
    })
  };
  const createFx = () => {
    const fx = {
      current: null, pixelDensity() {}, clear() {}, noStroke() {}, remove() {},
      createShader: (vert, frag) => ({ vert, frag, uniforms: {}, init() { return this; }, setUniform(n, v) { this.uniforms[n] = v; } }),
      createFramebuffer: () => {
        const fb = { id: log.framebuffers.length, begin() { log.draws.push(`begin ${fb.id}`); }, end() { log.draws.push(`end ${fb.id}`); } };
        log.framebuffers.push(fb);
        return fb;
      },
      shader(program) { fx.current = program; },
      rect() { log.draws.push(fx.current.frag.includes("u_prev") ? "trail" : "background"); }
    };
    return fx;
  };
  return { log, globals, createFx };
}

const fake = fakeP5();
const ex = loadExample(SCRIPTS, fake.globals);
const exampleDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => fs.readFileSync(path.join(exampleDir, file), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));
const PPM = 44 / 14;
const fakeCar = (x, y, heading, racing = true) => ({ pos: { x, y }, heading, racing, dead: !racing });

test("réglages : valeurs par défaut, valeurs invalides, bascules sans modifier l'entrée", () => {
  assert.deepEqual(plain(ex.normalizeShaderSettings(null)), { ambiance: "auto", heatmap: false, trail: true, wind: true });
  assert.deepEqual(plain(ex.normalizeShaderSettings({ ambiance: "lave", heatmap: "oui", trail: 1, wind: null })), plain(ex.DEFAULT_SHADER_SETTINGS));
  const start = ex.normalizeShaderSettings(null);
  const copy = plain(start);
  // L'ambiance fait le tour des 9 choix et revient à « auto ».
  let s = start;
  const seen = [];
  for (let i = 0; i < ex.AMBIANCE_CHOICES.length; i++) { s = ex.toggledShaderSetting(s, "ambiance"); seen.push(s.ambiance); }
  assert.deepEqual(seen, [...ex.AMBIANCES, "auto"]);
  assert.equal(ex.toggledShaderSetting(start, "heatmap").heatmap, true);
  assert.equal(ex.toggledShaderSetting(start, "trail").trail, false);
  assert.equal(ex.toggledShaderSetting(start, "wind").wind, false);
  assert.deepEqual(plain(ex.toggledShaderSetting(start, "inconnu")), copy);
  assert.deepEqual(plain(start), copy, "entrée non modifiée");
});

test("ambiances : auto suit le circuit, chaque ambiance n'active que son effet, jour n'ajoute rien", () => {
  assert.equal(ex.circuitAmbiance(ex.F1_CIRCUITS.monza), "jour");
  assert.equal(ex.circuitAmbiance(ex.F1_CIRCUITS.spa), "pluie");
  assert.equal(ex.circuitAmbiance({ ambiance: "lave" }), "jour");
  assert.equal(ex.circuitAmbiance(null), "jour");
  assert.equal(ex.effectiveAmbiance({ ambiance: "auto" }, ex.TRAINING_CIRCUITS["niveau-19-croissant"]), "nuit");
  assert.equal(ex.effectiveAmbiance({ ambiance: "neige" }, ex.F1_CIRCUITS.spa), "neige");
  // Tous les circuits ont une ambiance connue ; les 8 ambiances sont utilisées.
  const used = new Set(ex.allCircuitEntries().map((e) => ex.circuitAmbiance(e.layout)));
  for (const e of ex.allCircuitEntries()) assert.ok(e.layout.ambiance === undefined || ex.AMBIANCES.includes(e.layout.ambiance), e.key);
  assert.deepEqual([...used].sort(), [...ex.AMBIANCES].sort());

  assert.deepEqual(Object.values(plain(ex.ambianceParams("jour"))), [0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(plain(ex.ambianceParams("inconnue")), plain(ex.ambianceParams("jour")));
  for (const ambiance of ex.AMBIANCES.filter((a) => a !== "jour")) {
    const params = ex.ambianceParams(ambiance);
    assert.deepEqual(Object.keys(params), plain(ex.AMBIANCE_EFFECTS));
    const on = Object.entries(params).filter(([, v]) => v > 0);
    assert.equal(on.length, 1, ambiance);
    assert.ok(on[0][1] <= 1);
  }
});

test("libellés : état écrit en toutes lettres, ambiance du circuit en mode auto", () => {
  const spa = ex.F1_CIRCUITS.spa;
  assert.equal(ex.shaderOptionLabel({ ambiance: "auto" }, "ambiance", spa), "Ambiance : auto (pluie)");
  assert.equal(ex.shaderOptionLabel({ ambiance: "auto" }, "ambiance", null), "Ambiance : auto (jour)");
  assert.equal(ex.shaderOptionLabel({ ambiance: "neon" }, "ambiance", spa), "Ambiance : néon");
  assert.equal(ex.shaderOptionLabel({ heatmap: true }, "heatmap"), "Carte de chaleur : affichée");
  assert.equal(ex.shaderOptionLabel({ trail: false }, "trail"), "Traînée du leader : masquée");
  assert.equal(ex.shaderOptionLabel({ wind: false }, "wind"), "Herbe au vent : immobile");
  assert.equal(ex.perfOptionLabel({ shaders: false }, "shaders"), "Effets shader : désactivés");
  assert.equal(ex.perfOptionLabel({}, "shaders"), "Effets shader : activés");
});

test("désactivation : interrupteur général, préréglages, WebGL absent, scène cachée", () => {
  assert.equal(ex.shadersActive(ex.DEFAULT_PERF, true, false), true);
  assert.equal(ex.shadersActive({ ...ex.DEFAULT_PERF, shaders: false }, true, false), false);
  assert.equal(ex.shadersActive(ex.DEFAULT_PERF, false, false), false, "sans WebGL");
  assert.equal(ex.shadersActive(ex.DEFAULT_PERF, null, false), false, "WebGL pas encore essayé");
  assert.equal(ex.shadersActive(ex.DEFAULT_PERF, true, true), false, "mode invisible");
  assert.equal(ex.PERF_PRESETS.complet.perf.shaders, true);
  assert.equal(ex.PERF_PRESETS.intermediaire.perf.shaders, false);
  assert.equal(ex.PERF_PRESETS.invisible.perf.shaders, false);
  assert.equal(ex.toggledPerf(ex.DEFAULT_PERF, "shaders").shaders, false);
  assert.equal(ex.perfPresetName({ ...ex.DEFAULT_PERF, shaders: false }, ex.DECOR_GRASS), "personnalise");
});

test("mémorisation : relue, valeur illisible ou stockage bloqué → défaut", () => {
  const storage = createMemoryStorage();
  ex.saveShaderSettings(storage, { ambiance: "neige", heatmap: true, trail: false, wind: false });
  assert.deepEqual(plain(ex.loadShaderSettings(storage)), { ambiance: "neige", heatmap: true, trail: false, wind: false });
  assert.deepEqual(plain(ex.loadShaderSettings(createMemoryStorage({ [ex.SHADER_STORAGE_KEY]: "{pas du json" }))), plain(ex.DEFAULT_SHADER_SETTINGS));
  const blocked = { getItem() { throw new Error("bloqué"); }, setItem() { throw new Error("bloqué"); } };
  assert.deepEqual(plain(ex.loadShaderSettings(blocked)), plain(ex.DEFAULT_SHADER_SETTINGS));
  assert.doesNotThrow(() => ex.saveShaderSettings(blocked, {}));
  assert.deepEqual(plain(ex.loadShaderSettings(null)), plain(ex.DEFAULT_SHADER_SETTINGS));
});

test("temps du shader : secondes à 60 images/s, ramené sous 600 s, entrées invalides → 0", () => {
  assert.equal(ex.shaderTime(0), 0);
  assert.equal(ex.shaderTime(90), 1.5);
  assert.equal(ex.shaderTime(60 * ex.SHADER_TIME_PERIOD + 30), 0.5);
  assert.equal(ex.shaderTime(-5), 0);
  assert.equal(ex.shaderTime(NaN), 0);
});

test("phares : tableau de taille fixe, meilleures voitures prioritaires, voitures arrêtées ou invalides ignorées", () => {
  const cars = [fakeCar(10, 20, 0.5), fakeCar(30, 40, 1, false), fakeCar(NaN, 0, 0), fakeCar(50, 60, -1)];
  const before = plain(cars);
  const { data, count } = ex.headlightData(cars);
  assert.equal(count, 2);
  assert.equal(data.length, ex.MAX_HEADLIGHTS * 3);
  assert.deepEqual(plain(data.slice(0, 6)), [10, 20, 0.5, 50, 60, -1]);
  assert.ok(data.slice(6).every((v) => v === 0));
  assert.deepEqual(plain(cars), before, "voitures non modifiées");
  // Plus de voitures que de phares : les dernières (les meilleures) sont gardées.
  const many = Array.from({ length: 30 }, (_, i) => fakeCar(i, i, 0));
  const lit = ex.headlightData(many, 4);
  assert.equal(lit.count, 4);
  assert.deepEqual(plain(lit.data), [26, 26, 0, 27, 27, 0, 28, 28, 0, 29, 29, 0]);
  assert.equal(ex.headlightData([]).count, 0);
});

test("traînée : trait entre deux images du même leader, pas de trait au départ, au saut ou au changement de leader", () => {
  const tracker = new ex.TrailTracker();
  const car = fakeCar(100, 100, 0);
  assert.equal(tracker.update(car).active, false, "première image");
  car.pos.x = 104;
  assert.deepEqual(plain(tracker.update(car)), { x0: 100, y0: 100, x1: 104, y1: 100, active: true });
  assert.equal(car.pos.x, 104, "position non modifiée");
  car.pos.x = 104 + ex.TRAIL_MAX_JUMP + 1;
  assert.equal(tracker.update(car).active, false, "saut (nouvelle génération au départ)");
  const other = fakeCar(car.pos.x + 1, 100, 0);
  assert.equal(tracker.update(other).active, false, "autre leader");
  assert.equal(tracker.update(null).active, false);
  assert.equal(tracker.update(fakeCar(NaN, 0, 0)).active, false);
  assert.equal(tracker.update(other).active, false, "après une interruption, on repart sans trait");
  other.pos.x += 0.2;
  assert.equal(tracker.update(other).active, false, "voiture arrêtée : pas de tache sous la voiture");
  other.pos.x += 2;
  assert.equal(tracker.update(other).active, true);
  other.racing = false;
  other.pos.x += 2;
  assert.equal(tracker.update(other).active, false, "leader éliminé");
});

test("carte de chaleur : passages, sortie de piste comptée une fois, bords, estompage, texture normalisée", () => {
  const heat = new ex.HeatMap(1200, 760);
  assert.equal(heat.cols, 150);
  assert.equal(heat.rows, 95);
  assert.equal(heat.indexAt(-1, 5), -1);
  assert.equal(heat.indexAt(1200, 5), -1);
  assert.equal(heat.indexAt(NaN, 5), -1);
  assert.equal(heat.indexAt(1199, 759), heat.cols * heat.rows - 1);

  const runner = fakeCar(12, 12, 0);
  const crashed = fakeCar(100, 100, 0, false);
  const finished = { pos: { x: 300, y: 300 }, heading: 0, racing: false, dead: false };
  for (let i = 0; i < 5; i++) heat.record([runner, crashed, finished, fakeCar(-50, 3000, 0)]);
  assert.equal(heat.visits[heat.indexAt(12, 12)], 5 * ex.HEAT_VISIT);
  const crashCell = heat.indexAt(100, 100);
  assert.equal(heat.crashes[crashCell], ex.HEAT_CRASH, "une seule fois malgré 5 pas");
  assert.equal(heat.crashes[crashCell + 1], ex.HEAT_CRASH / 2, "voisine");
  assert.equal(heat.crashes[heat.indexAt(300, 300)], 0, "voiture arrivée : pas une sortie");
  heat.addCrash(0, 0);   // coin : voisines hors grille ignorées
  assert.equal(heat.crashes[0], ex.HEAT_CRASH);

  const pixels = heat.writePixels(new Uint8ClampedArray(heat.cols * heat.rows * 4));
  assert.equal(pixels[heat.indexAt(12, 12) * 4], 255, "case la plus visitée");
  assert.equal(pixels[crashCell * 4 + 1], 255, "sortie la plus forte");
  assert.ok(pixels[(crashCell + 1) * 4 + 1] > 0 && pixels[(crashCell + 1) * 4 + 1] < 255);
  assert.equal(pixels[heat.indexAt(600, 600) * 4], 0);
  assert.ok([...pixels].every((v, i) => i % 4 !== 3 || v === 255), "alpha opaque");

  heat.decay(0.5);
  assert.equal(heat.visits[heat.indexAt(12, 12)], 2.5);
  for (let i = 0; i < 40; i++) heat.decay(0.5);
  assert.ok(heat.visits.every((v) => v === 0) && heat.crashes.every((v) => v === 0), "tout s'efface (plancher)");
  heat.clear();
  heat.record([crashed]);
  assert.equal(heat.crashes[crashCell], ex.HEAT_CRASH, "après clear, la voiture peut être recomptée");
  // Grille vide : texture noire, pas de division par zéro.
  const empty = new ex.HeatMap(16, 16).writePixels(new Uint8ClampedArray(2 * 2 * 4));
  assert.deepEqual([...empty], [0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]);
});

test("carte de chaleur avec de vraies voitures : passages sur la piste, sortie à l'endroit de l'élimination", () => {
  const circuit = new ex.Circuit(ex.TRAINING_CIRCUITS["niveau-2-carre"], { pixelsPerMeter: PPM });
  const spec = { brand: "Ferraaa", model: "F40o", maxSpeed: 4.5, maxForce: 0.22 };
  const straight = { inputNodes: 6, predict: () => [0.5, 0.9] };   // tout droit : sort au premier virage
  const car = new ex.Car(circuit, spec, 0, straight);
  const heat = new ex.HeatMap(1200, 760);
  let steps = 0;
  while (car.racing && steps < 2000) { car.drive(); heat.record([car]); steps++; }
  assert.equal(car.dead, true);
  const total = heat.visits.reduce((a, b) => a + b, 0);
  assert.equal(total, steps - 1, "un passage par pas en course");
  assert.ok(heat.crashes[heat.indexAt(car.pos.x, car.pos.y)] > 0, "tache rouge à la sortie");
});

test("contrat GLSL : chaque uniform déclaré reçoit une valeur, et rien d'autre", () => {
  const textures = { track: "T", mask: "M", heat: "H", trail: "F" };
  const lights = ex.headlightData([fakeCar(1, 2, 3)]);
  const night = ex.backgroundUniforms({ textures, width: 1200, height: 760, frame: 120, ambiance: "nuit", settings: { heatmap: true }, lights });
  assert.deepEqual(Object.keys(night).sort(), plain(ex.declaredUniforms(ex.BACKGROUND_FRAG)).sort());
  assert.match(ex.BACKGROUND_FRAG, new RegExp(`uniform vec3 u_lights\\[${ex.MAX_HEADLIGHTS}\\]`));
  assert.equal(night.u_lights.length, ex.MAX_HEADLIGHTS * 3);
  assert.equal(night.u_lightCount, 1);
  assert.equal(night.u_night, 1);
  assert.equal(night.u_time, 2);
  assert.equal(night.u_heatmap, 1);
  assert.equal(night.u_trailOn, 1);
  assert.equal(night.u_wind, 1);
  assert.equal(night.u_track, "T");
  assert.deepEqual(plain(night.u_resolution), [1200, 760]);
  // Hors de la nuit, aucun phare n'est calculé dans le shader.
  const day = ex.backgroundUniforms({ textures, width: 1200, height: 760, frame: 0, ambiance: "jour", settings: { trail: false, wind: false }, lights });
  assert.equal(day.u_lightCount, 0);
  assert.equal(day.u_trailOn, 0);
  assert.equal(day.u_wind, 0);
  assert.equal(day.u_heatmap, 0);
  for (const [name, value] of Object.entries(day)) {
    if (typeof value === "number") assert.ok(Number.isFinite(value), name);
  }
  const trail = ex.trailUniforms("P", { x0: 1, y0: 2, x1: 3, y1: 4, active: true }, 1200, 760);
  assert.deepEqual(Object.keys(trail).sort(), plain(ex.declaredUniforms(ex.TRAIL_FRAG)).sort());
  assert.deepEqual(plain(trail.u_segment), [1, 2, 3, 4]);
  assert.ok(Math.abs(trail.u_active - Math.hypot(2, 2) * ex.TRAIL_GLOW_PER_PX) < 1e-12, "intensité ∝ longueur");
  // Bornes : voiture très lente ou très rapide ; segment inactif → 0.
  assert.equal(ex.trailIntensity({ x0: 0, y0: 0, x1: 0.1, y1: 0, active: true }), ex.TRAIL_GLOW_MIN);
  assert.equal(ex.trailIntensity({ x0: 0, y0: 0, x1: 50, y1: 0, active: true }), ex.TRAIL_GLOW_MAX);
  assert.equal(ex.trailIntensity({ x0: 0, y0: 0, x1: 5, y1: 0, active: false }), 0);
  assert.ok(trail.u_fade > 0 && trail.u_fade < 1);
  // GLSL ES 1.0 : boucles à bornes constantes, précision déclarée, sortie gl_FragColor.
  for (const source of [ex.BACKGROUND_FRAG, ex.TRAIL_FRAG]) {
    assert.match(source, /precision (highp|mediump) float;/);
    assert.match(source, /gl_FragColor = /);
    for (const loop of source.matchAll(/for \(int \w+ = 0; \w+ < ([^;]+);/g)) assert.match(loop[1], /^\d+$/, `borne constante : ${loop[1]}`);
  }
  assert.match(ex.SHADER_VERT, /attribute vec3 aPosition;/);
});

test("ShaderDecor sans WebGL : désactivé proprement, une seule tentative, décor classique", () => {
  let attempts = 0;
  const decor = new ex.ShaderDecor(1200, 760, () => { attempts++; throw new Error("WebGL indisponible"); });
  assert.equal(decor.available, null);
  assert.equal(decor.render({ frame: 1, ambiance: "nuit", settings: {}, cars: [], leader: null }), null);
  assert.equal(decor.render({ frame: 2, ambiance: "nuit", settings: {}, cars: [], leader: null }), null);
  assert.equal(attempts, 1);
  assert.equal(decor.available, false);
  assert.match(decor.error.message, /WebGL/);
  // Erreur de compilation GLSL : même repli.
  const broken = new ex.ShaderDecor(1200, 760, () => ({ ...fake.createFx(), createShader: () => ({ init: () => null }), remove() {} }));
  assert.equal(broken.ensureReady(), false);
  assert.match(broken.error.message, /shader non compilé/);
});

test("ShaderDecor : décor copié une fois par circuit, traînée en double tampon, uniforms envoyés", () => {
  fake.log.draws.length = 0;
  fake.log.copies = 0;
  fake.log.heatUploads = 0;
  const decor = new ex.ShaderDecor(1200, 760, fake.createFx);
  const circuit = new ex.Circuit(ex.F1_CIRCUITS.monza, { pixelsPerMeter: PPM });
  const props = [{ type: "arbre", x: 50, y: 50, r: 10 }, { type: "tribune", x: 300, y: 50, angle: 0, length: 100, depth: 26 }];
  decor.setTrack({ elt: {} }, circuit, props);
  const cars = [fakeCar(200, 300, 0), fakeCar(210, 300, 0)];
  const settings = { ambiance: "auto", heatmap: true, trail: true, wind: true };
  const base = fake.log.framebuffers.length;   // les deux framebuffers de ce décor : base et base + 1
  const out1 = decor.render({ frame: 10, ambiance: "nuit", settings, cars, leader: cars[1] });
  assert.equal(out1, decor.fx);
  assert.equal(decor.available, true);
  assert.equal(fake.log.copies, 2, "décor + masque copiés");
  assert.equal(fake.log.maskProps, 2, "objets posés sur l'herbe marqués dans le masque (canal bleu)");
  cars[1].pos.x += 3;
  decor.render({ frame: 11, ambiance: "nuit", settings, cars, leader: cars[1] });
  assert.equal(fake.log.copies, 2, "pas de nouvelle copie sans changement de circuit");
  // Chaque image : traînée dans un framebuffer, puis le décor ; les deux tampons alternent.
  assert.deepEqual(fake.log.draws, [`begin ${base + 1}`, "trail", `end ${base + 1}`, "background", `begin ${base}`, "trail", `end ${base}`, "background"]);
  const bg = decor.backgroundShader.uniforms;
  assert.deepEqual(Object.keys(bg).sort(), plain(ex.declaredUniforms(ex.BACKGROUND_FRAG)).sort());
  assert.equal(bg.u_trail, fake.log.framebuffers[base], "le décor lit la traînée qui vient d'être dessinée");
  assert.equal(decor.trailShader.uniforms.u_prev, fake.log.framebuffers[base + 1], "la traînée lit l'image précédente");
  assert.ok(Math.abs(decor.trailShader.uniforms.u_active - 3 * ex.TRAIL_GLOW_PER_PX) < 1e-12, "3 px parcourus");
  assert.equal(bg.u_lightCount, 2);
  assert.equal(bg.u_track, decor.trackImage);
  assert.equal(fake.log.heatUploads, 2, "carte envoyée à la création puis toutes les 10 images (image 10)");
  // Nouveau circuit : nouvelle copie ; l'historique est effacé.
  decor.heat.addVisit(5, 5, 3);
  decor.setTrack({ elt: {} }, circuit);
  decor.clearHistory();
  assert.ok(decor.heat.visits.every((v) => v === 0));
  decor.render({ frame: 12, ambiance: "jour", settings: { trail: false }, cars, leader: cars[1] });
  assert.equal(fake.log.copies, 4);
  assert.equal(decor.trailShader.uniforms.u_active, 0, "traînée masquée : plus de nouveau trait");
  assert.equal(decor.backgroundShader.uniforms.u_lightCount, 0, "jour : pas de phares");
});

test("interface : options du menu Performances, scripts chargés dans l'ordre, repli sur le décor pré-rendu", () => {
  const html = read("index.html");
  for (const option of ["ambiance", "heatmap", "trail", "wind"]) assert.ok(html.includes(`data-shader-option="${option}"`), option);
  assert.ok(html.includes('data-perf-option="shaders"'));
  const order = ["performance-settings.js", "shader-settings.js", "heat-map.js", "shader-decor.js", "sketch.js"].map((f) => html.indexOf(`<script src="${f}">`));
  assert.ok(order.every((i, k) => i > 0 && (k === 0 || i > order[k - 1])), `ordre ${order}`);
  const sketch = read("sketch.js");
  assert.ok(sketch.includes("image(output || trackLayer, 0, 0, width, height);"), "sans shader : décor pré-rendu");
  assert.ok(sketch.includes("const wanted = perf.shaders && shaderDecor.available !== false;"));
  assert.equal((sketch.match(/if \(heatMapRecording\(\)\) shaderDecor\.heat\.record\(cars\);/g) || []).length, 2, "entraînement et démonstration");
});
