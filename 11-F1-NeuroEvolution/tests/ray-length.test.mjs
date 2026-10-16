import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { createMemoryStorage, loadExample } from "./p5-adapter.mjs";

const ex = loadExample();
const monza = new ex.Circuit(ex.F1_CIRCUITS.monza);
const spec = { brand: "Ferraaa", model: "F40o", color: "#e10600", accent: "#ffd800", maxSpeed: 4.5, maxForce: 0.22 };

beforeEach(() => ex.setRayLength(ex.DEFAULT_RAY_LENGTH));

// Voiture au milieu d'une longue ligne droite, cap dans l'axe de la piste.
function carOnStraight() {
  const car = new ex.Car(monza, spec, 0, null, 0, ex.createRng(1));
  return car;
}

test("valeur par défaut, bornes et arrondi", () => {
  assert.equal(ex.currentRayLength(), ex.DEFAULT_RAY_LENGTH);
  assert.equal(ex.setRayLength(10), ex.MIN_RAY_LENGTH);
  assert.equal(ex.setRayLength(5000), ex.MAX_RAY_LENGTH);
  assert.equal(ex.setRayLength(123.6), 124);
  assert.equal(ex.setRayLength("200"), 200); // valeur d'un curseur HTML
});

test("valeur invalide ignorée : la longueur ne change pas", () => {
  ex.setRayLength(90);
  for (const bad of [NaN, Infinity, "abc", undefined]) assert.equal(ex.setRayLength(bad), 90);
  assert.equal(ex.currentRayLength(), 90);
});

test("toutes les voitures utilisent la longueur réglée, même déjà en piste", () => {
  const car = carOnStraight();
  assert.equal(car.sightDistance, ex.DEFAULT_RAY_LENGTH);
  ex.setRayLength(80);
  assert.equal(car.sightDistance, 80);
  car.sense();
  for (const d of car.rayDistances) assert.ok(d <= 80 + 1e-9);
});

test("rayons plus longs → voient plus loin ; entrées toujours dans [0, 1]", () => {
  const car = carOnStraight();
  ex.setRayLength(ex.MIN_RAY_LENGTH);
  const shortInputs = car.sense();
  const [shortSide, , shortFront] = car.rayDistances;
  ex.setRayLength(ex.MAX_RAY_LENGTH);
  const longInputs = car.sense();
  const [longSide, , longFront] = car.rayDistances;
  assert.equal(shortFront, ex.MIN_RAY_LENGTH); // rien en vue devant à 40 px
  assert.ok(longFront > shortFront);
  for (const v of [...shortInputs, ...longInputs]) assert.ok(v >= 0 && v <= 1);
  // Le rayon latéral touche le bord de piste à la même distance réelle.
  assert.ok(Math.abs(longSide - shortSide) < 1e-9);
});

test("rayon trop court pour atteindre le mur : distance = longueur, entrée = 0", () => {
  const car = carOnStraight();
  ex.setRayLength(ex.MIN_RAY_LENGTH);
  const inputs = car.sense();
  assert.equal(inputs[2], 0);
});

test("mémorisation : relue au chargement, défaut si absente ou illisible", () => {
  const storage = createMemoryStorage();
  ex.setRayLength(220);
  ex.saveRayLength(storage);
  assert.equal(storage.getItem(ex.RAY_LENGTH_STORAGE_KEY), "220");
  ex.setRayLength(60);
  assert.equal(ex.loadRayLength(storage), 220);
  assert.equal(ex.loadRayLength(createMemoryStorage()), ex.DEFAULT_RAY_LENGTH);
  assert.equal(ex.loadRayLength(createMemoryStorage({ [ex.RAY_LENGTH_STORAGE_KEY]: "n'importe quoi" })), ex.DEFAULT_RAY_LENGTH);
  assert.equal(ex.loadRayLength(createMemoryStorage({ [ex.RAY_LENGTH_STORAGE_KEY]: "9999" })), ex.MAX_RAY_LENGTH);
  assert.equal(ex.loadRayLength(null), ex.DEFAULT_RAY_LENGTH);
});

test("stockage bloqué : pas d'erreur", () => {
  const blocked = { getItem() { throw new Error("bloqué"); }, setItem() { throw new Error("bloqué"); } };
  assert.equal(ex.loadRayLength(blocked), ex.DEFAULT_RAY_LENGTH);
  assert.doesNotThrow(() => ex.saveRayLength(blocked));
});

test("le garage note la longueur des rayons du champion", () => {
  ex.setRayLength(120);
  const garage = new ex.Garage(createMemoryStorage());
  const car = ex.createTrainingPopulation(monza, [{ brand: "Tiyoti", model: "Supraa GT" }], ex.createRng(2))[0];
  garage.recordChampion(car, "Monza");
  assert.equal(garage.snapshot("Tiyoti | Supraa GT").rayLength, 120);
});
