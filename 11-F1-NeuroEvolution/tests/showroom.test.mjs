import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createMemoryStorage, loadExample } from "./p5-adapter.mjs";

const ex = loadExample();
const monza = new ex.Circuit(ex.F1_CIRCUITS.monza, { key: "monza" });
const A = { brand: "Tiyoti", model: "Supraa GT" };
const B = { brand: "Ferraaa", model: "F40o" };
const KEY_A = "Tiyoti | Supraa GT";
const KEY_B = "Ferraaa | F40o";
const plain = (value) => JSON.parse(JSON.stringify(value));

// ---------- Marques ----------

test("noms de marques déformés, sans la vraie marque entre parenthèses", () => {
  const brandsSource = fs.readFileSync(new URL("../brands.js", import.meta.url), "utf8");
  for (const real of ["Toyota", "Ferrari", "Lamborghini", "Mercedes", "McLaren", "Porsche", "Bugatti", "Renault"]) {
    assert.equal(brandsSource.includes(real), false, `${real} ne doit pas apparaître`);
  }
  for (const brand of ex.CAR_BRANDS) assert.equal("inspiredBy" in brand, false);
  const sketch = fs.readFileSync(new URL("../sketch.js", import.meta.url), "utf8");
  assert.equal(sketch.includes("inspiredBy"), false);
});

test("chaque modèle a une livrée connue et un numéro unique, transmis à la voiture", () => {
  const numbers = new Set();
  for (const { modelData } of ex.allModelEntries()) {
    assert.ok(ex.LIVERIES.includes(modelData.livery), modelData.name);
    assert.ok(Number.isInteger(modelData.number));
    numbers.add(modelData.number);
  }
  assert.equal(numbers.size, ex.allModelEntries().length);
  const spec = ex.createRandomSpecForModel("Limbargana", "Aventadoro", ex.createRng(1));
  assert.equal(spec.livery, "damier");
  assert.equal(spec.number, 88);
});

// ---------- Vitrine : fonctions pures ----------

test("bouton « Voitures » : nombre de voitures sélectionnées, accord au pluriel", () => {
  assert.equal(ex.carsButtonLabel(0), "Voitures : aucune sélectionnée");
  assert.equal(ex.carsButtonLabel(1), "Voitures : 1 sélectionnée");
  assert.equal(ex.carsButtonLabel(3), "Voitures : 3 sélectionnées");
});

test("la vitrine propose tous les modèles, avec des clés de lignée uniques", () => {
  const entries = ex.allModelEntries();
  const total = ex.CAR_BRANDS.reduce((n, b) => n + b.models.length, 0);
  assert.equal(entries.length, total);
  assert.equal(new Set(entries.map((e) => e.key)).size, total);
  assert.ok(entries.some((e) => e.key === KEY_A));
});

test("confiance par circuit : départ si jamais roulé, fiche sinon, validation", () => {
  const garage = new ex.Garage(createMemoryStorage());
  const car = ex.createTrainingPopulation(monza, [A], ex.createRng(1))[0];
  car.lap.distance = monza.totalLength; // tour bouclé sur Monza
  car.framesAlive = 900;
  car.generation = 4;
  garage.recordChampion(car, "Monza (Italie)");
  const circuits = [
    { key: "monza", name: "Monza (Italie)", group: "Formule 1" },
    { key: "spa", name: "Spa", group: "Formule 1" }
  ];
  const [monzaRow, spaRow] = plain(ex.circuitConfidenceRows(garage, KEY_A, circuits));
  assert.equal(monzaRow.confidence, 1);
  assert.equal(monzaRow.trained, true);
  assert.equal(monzaRow.trainedGeneration, 4);
  assert.equal(monzaRow.bestProgress, 1);
  assert.equal(spaRow.confidence, ex.CONFIDENCE_START);
  assert.equal(spaRow.neverDriven, true);
  assert.equal(spaRow.trained, false);
  // Une voiture jamais entraînée : départ partout.
  for (const row of ex.circuitConfidenceRows(garage, KEY_B, circuits)) assert.equal(row.neverDriven, true);
});

test("cartes de la vitrine sans fiche technique (numéro, livrée, vitesse, adhérence)", () => {
  const source = fs.readFileSync(new URL("../showroom.js", import.meta.url), "utf8");
  for (const removed of ["livrée ${", "vitesse max", "adhérence", "facts"]) {
    assert.equal(source.includes(removed), false, removed);
  }
});

// ---------- Dessin ----------

// Cible de dessin factice qui compte les appels (comme un p5.Graphics).
function fakeGraphics() {
  const calls = {};
  const count = (name) => (...args) => { calls[name] = (calls[name] || 0) + 1; return args; };
  const g = { calls, CENTER: "center", HALF_PI: Math.PI / 2, BOLD: "bold", CLOSE: "close" };
  for (const name of ["push", "pop", "rectMode", "noStroke", "stroke", "strokeWeight", "fill", "noFill",
    "rect", "line", "triangle", "ellipse", "arc", "textAlign", "textStyle", "textSize", "text", "translate", "rotate",
    "beginShape", "vertex", "endShape"]) {
    g[name] = count(name);
  }
  g.color = () => ({ setAlpha() {} });
  return g;
}

test("dessin : la version détaillée (vitrine) ajoute halo, numéro et détails", () => {
  const spec = { color: "#d81e2a", accent: "#ffffff", livery: "damier", number: 7 };
  const simple = fakeGraphics();
  ex.drawCarDesign(simple, spec, 18, 6.4);
  const detailed = fakeGraphics();
  ex.drawCarDesign(detailed, spec, 220, 78.6, { detailed: true });
  assert.equal(simple.calls.text, undefined);
  assert.equal(detailed.calls.text, 1);
  assert.equal(detailed.calls.arc, 1);
  assert.ok(detailed.calls.rect > simple.calls.rect);
  assert.equal(simple.calls.push, simple.calls.pop); // styles isolés
  assert.equal(detailed.calls.push, detailed.calls.pop);
});

test("dessin : toutes les livrées et une voiture sans livrée (ancienne sauvegarde)", () => {
  for (const livery of [...ex.LIVERIES, undefined]) {
    assert.doesNotThrow(() => ex.drawCarDesign(fakeGraphics(), { color: "#000", accent: "#fff", livery }, 220, 78, { detailed: true }));
  }
});

// ---------- Générations indépendantes par type ----------

test("une lignée dont toutes les voitures sont arrêtées passe seule à la génération suivante", () => {
  const rng = ex.createRng(3);
  const cars = ex.createTrainingPopulation(monza, [A, B], rng);
  const groups = ex.groupByLineage(cars);
  for (const car of groups.get(KEY_A)) car.dead = true;      // toutes les Tiyoti sont mortes
  groups.get(KEY_A)[2].lap.distance = 0.3 * monza.totalLength;
  const ended = [];
  const next = ex.advanceStoppedLineages(cars, monza, rng, (key, best) => ended.push([key, best]));
  assert.deepEqual(ended.map(([key]) => key), [KEY_A]);
  assert.equal(ended[0][1], groups.get(KEY_A)[2]);
  const nextGroups = ex.groupByLineage(next);
  for (const car of nextGroups.get(KEY_A)) assert.equal(car.generation, 1);   // nouvelle génération
  assert.deepEqual(nextGroups.get(KEY_B), groups.get(KEY_B));                 // Ferraaa continue sa course
  for (const car of nextGroups.get(KEY_B)) assert.equal(car.generation, 0);
});

test("rien n'avance tant qu'une voiture de la lignée roule encore", () => {
  const rng = ex.createRng(4);
  const cars = ex.createTrainingPopulation(monza, [A], rng);
  for (const car of cars.slice(1)) car.dead = true;
  let calls = 0;
  const next = ex.advanceStoppedLineages(cars, monza, rng, () => calls++);
  assert.equal(calls, 0);
  assert.deepEqual(next, cars);
});

test("une lignée qui a bouclé le circuit disparaît, les autres continuent", () => {
  const rng = ex.createRng(5);
  const cars = ex.createTrainingPopulation(monza, [A, B], rng);
  const groups = ex.groupByLineage(cars);
  for (const car of groups.get(KEY_A)) car.dead = true;
  groups.get(KEY_A)[0].lap.distance = monza.totalLength;
  const next = ex.advanceStoppedLineages(cars, monza, rng);
  assert.deepEqual(plain([...ex.groupByLineage(next).keys()]), [KEY_B]);
});

test("intégration : en course réelle, les lignées avancent à des rythmes différents", () => {
  const rng = ex.createRng(9);
  let cars = ex.createTrainingPopulation(monza, [A, B], rng);
  const generations = { [KEY_A]: 0, [KEY_B]: 0 };
  for (let frame = 0; frame < 900 && cars.length > 0; frame++) {
    for (const car of cars) car.drive();
    cars = ex.advanceStoppedLineages(cars, monza, rng, (key) => generations[key]++);
  }
  assert.ok(generations[KEY_A] + generations[KEY_B] > 0);
  // Chaque voiture d'une lignée appartient à la même génération.
  for (const group of ex.groupByLineage(cars).values()) {
    assert.equal(new Set(group.map((c) => c.generation)).size, 1);
  }
});
