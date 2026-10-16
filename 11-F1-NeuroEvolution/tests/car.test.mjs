import assert from "node:assert/strict";
import test from "node:test";
import { loadExample } from "./p5-adapter.mjs";

const ex = loadExample();
const monza = new ex.Circuit(ex.F1_CIRCUITS.monza);
const spec = {
  brand: "Ferraaa", model: "F40o", color: "#e10600", accent: "#ffd800",
  maxSpeed: 4.5, maxForce: 0.22
};

test("Car étend Vehicle et prend les dimensions F1 du circuit", () => {
  const car = new ex.Car(monza, spec);
  assert.ok(car instanceof ex.Vehicle);
  assert.equal(car.length, monza.carLength);
  assert.equal(car.width, monza.carWidth);
  assert.equal(car.maxSpeed, 4.5);
  assert.equal(car.dead, false);
});

test("départ sur la ligne, dans le sens de course, avec décalage latéral", () => {
  const start = monza.startPose(0);
  const car = new ex.Car(monza, spec, 10);
  assert.ok(Math.abs(Math.hypot(car.pos.x - start.x, car.pos.y - start.y) - 10) < 1e-9);
  assert.ok(Math.abs(car.heading - start.heading) < 1e-12);
  assert.ok(car.vel.mag() > 0);
});

test("sense : 5 rayons + vitesse, entrées dans [0, 1], murs détectés", () => {
  const car = new ex.Car(monza, spec);
  const inputs = car.sense();
  assert.equal(car.rayCount, ex.NETWORK_CONFIG.rays);
  assert.equal(inputs.length, car.rayCount + 1);
  for (const v of inputs) assert.ok(v >= 0 && v <= 1);
  // Les rayons latéraux (±60°) voient les bords de la piste de 44 px.
  assert.ok(car.rayDistances[0] < monza.trackWidth);
  assert.ok(car.rayDistances[car.rayCount - 1] < monza.trackWidth);
});

test("Ray.cast : intersection exacte, rien derrière, rien en parallèle", () => {
  const ray = new ex.Ray(0);
  ray.setPos(0, 0);
  const wall = { a: { x: 10, y: -5 }, b: { x: 10, y: 5 } };
  assert.deepEqual({ ...ray.cast(wall) }, { x: 10, y: 0 });
  ray.setDir(Math.PI);
  assert.equal(ray.cast(wall), null);
  ray.setDir(Math.PI / 2);
  assert.equal(ray.castAll([wall], 100), 100);
});

test("think : force bornée par maxForce, vitesse non mutée", () => {
  const car = new ex.Car(monza, spec, 0, null, 0, ex.createRng(5));
  const inputs = car.sense();
  const before = { x: car.vel.x, y: car.vel.y };
  const force = car.think(inputs);
  assert.ok(force.mag() <= spec.maxForce + 1e-9);
  assert.deepEqual({ x: car.vel.x, y: car.vel.y }, before);
});

// Cerveau factice : sorties imposées pour vérifier l'interprétation des sorties.
const fixedBrain = (turn, thrust) => ({ inputNodes: 6, predict: () => [turn, thrust] });

test("think : sortie 0 = direction (1 → droite, 0 → gauche)", () => {
  for (const [turn, sign] of [[1, 1], [0, -1]]) {
    const car = new ex.Car(monza, spec, 0, fixedBrain(turn, 1));
    car.heading = 0;
    car.vel.set(2, 0);
    car.framesAlive = ex.LAUNCH_FRAMES;
    const force = car.think([0, 0, 0, 0, 0, 0]);
    assert.equal(Math.sign(force.y), sign);
  }
});

test("think : sortie 1 = accélérateur (0 → freine après le lancement)", () => {
  const car = new ex.Car(monza, spec, 0, fixedBrain(0.5, 0));
  car.heading = 0;
  car.vel.set(2, 0);
  car.framesAlive = ex.LAUNCH_FRAMES;
  assert.ok(car.think([0, 0, 0, 0, 0, 0]).x < 0);
  car.framesAlive = 0; // aide au démarrage : au moins 50 % de maxSpeed
  assert.ok(car.think([0, 0, 0, 0, 0, 0]).x > 0);
});

test("chaque voiture a son propre cerveau, topologie de network-config.js", () => {
  const a = new ex.Car(monza, spec, 0, null, 0, ex.createRng(1));
  const b = new ex.Car(monza, spec, 0, null, 0, ex.createRng(2));
  assert.deepEqual([...a.brain.layers], [...ex.layerSizesFromConfig(ex.NETWORK_CONFIG)]);
  assert.equal(a.brain.outputNodes, 2);
  assert.notDeepEqual(a.brain.toJSON(), b.brain.toJSON());
});

test("les capteurs suivent le cerveau : 3 rayons sur 90°, ou 1 rayon droit devant", () => {
  const brain3 = new ex.NeuralNetwork([4, 8, 2], ex.createRng(1));
  const car = new ex.Car(monza, { ...spec, rayFovDegrees: 90 }, 0, brain3);
  assert.equal(car.rayCount, 3);
  assert.equal(car.sense().length, 4);
  assert.ok(Math.abs(car.rayAngle(0) - (car.heading - Math.PI / 4)) < 1e-12);
  assert.ok(Math.abs(car.rayAngle(2) - (car.heading + Math.PI / 4)) < 1e-12);
  const single = new ex.Car(monza, spec, 0, new ex.NeuralNetwork([2, 2], ex.createRng(1)));
  assert.equal(single.rayAngle(0), single.heading);
  assert.ok(Number.isFinite(single.sense()[0]));
});

test("speedKmh : 1 m par image = 60 m/s = 216 km/h", () => {
  const car = new ex.Car(monza, spec);
  car.vel.set(0, 0);
  assert.equal(car.speedKmh, 0);
  car.vel.set(monza.pixelsPerMeter * 1, 0); // 1 m par image = 60 m/s
  assert.ok(Math.abs(car.speedKmh - 216) < 1e-9);
});

test("sortie de piste → voiture éliminée", () => {
  const car = new ex.Car(monza, spec);
  const start = monza.startPose(0);
  car.pos.set(start.x - Math.sin(start.heading) * 40, start.y + Math.cos(start.heading) * 40);
  car.vel.set(0, 0);
  car.update();
  assert.equal(car.dead, true);
});

test("voiture immobile → éliminée après STALL_FRAMES images", () => {
  const car = new ex.Car(monza, { ...spec, maxSpeed: 0 });
  for (let i = 0; i < ex.STALL_FRAMES; i++) car.update();
  assert.equal(car.dead, false);
  car.update();
  assert.equal(car.dead, true);
});

test("intégration : génération 0 aléatoire, pas borné par maxSpeed, finit par s'arrêter", () => {
  const rng = ex.createRng(11);
  for (const key of Object.keys(ex.F1_CIRCUITS)) {
    const circuit = new ex.Circuit(ex.F1_CIRCUITS[key]);
    const car = new ex.Car(circuit, spec, 0, null, 0, rng);
    let maxStep = 0;
    for (let i = 0; i < 20000 && car.racing; i++) {
      const before = car.pos.copy();
      car.drive();
      maxStep = Math.max(maxStep, Math.hypot(car.pos.x - before.x, car.pos.y - before.y));
    }
    assert.ok(maxStep > 0 && maxStep <= spec.maxSpeed + 1e-9, `${key} : pas ${maxStep}`);
    assert.equal(car.racing, false, `${key} : la voiture devrait être arrêtée`);
  }
});

test("après MAX_LAPS tours la voiture a terminé et ne bouge plus", () => {
  const car = new ex.Car(monza, spec);
  car.vel.set(0, 0);
  car.lap.distance = ex.MAX_LAPS * monza.totalLength + 1;
  car.update();
  assert.equal(car.finished, true);
  assert.equal(car.dead, false);
  assert.equal(car.racing, false);
  const before = car.pos.copy();
  car.drive();
  assert.deepEqual({ ...car.pos }, { ...before });
});

test("une voiture éliminée ne bouge plus", () => {
  const car = new ex.Car(monza, spec);
  car.dead = true;
  const before = car.pos.copy();
  car.drive();
  assert.deepEqual({ ...car.pos }, { ...before });
});
