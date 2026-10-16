import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryStorage, loadExample } from "./p5-adapter.mjs";

const ex = loadExample();
const monza = new ex.Circuit(ex.F1_CIRCUITS.monza, { key: "monza" });
const PPM = 44 / 14;
const plain = (value) => JSON.parse(JSON.stringify(value));
const square = [[-10, -10], [10, -10], [10, 10], [-10, 10]];
const spec = { brand: "Ferraaa", model: "F40o", color: "#e10600", accent: "#ffd800", maxSpeed: 4.5, maxForce: 0.22 };

// ---------- Géométrie ----------

test("aire, centre et point dans le polygone", () => {
  assert.equal(ex.polygonArea(square), 400);
  assert.deepEqual(plain(ex.polygonCentroid(square)), [0, 0]);
  assert.equal(ex.pointInPolygon(0, 0, square), true);
  assert.equal(ex.pointInPolygon(15, 0, square), false);
});

test("validateShape : formes valides, trop peu de points, plates, croisées", () => {
  assert.equal(ex.validateShape(square), null);
  for (const preset of Object.values(ex.OBSTACLE_PRESETS)) assert.equal(ex.validateShape(preset.map(([x, y]) => [x * 50, y * 50])), null);
  assert.match(ex.validateShape([[0, 0], [10, 0]]), /au moins 3/);
  assert.match(ex.validateShape([[0, 0], [10, 0], [20, 0]]), /plate/);
  assert.match(ex.validateShape([[0, 0], [10, 10], [10, 0], [0, 10]]), /croisent/); // nœud papillon
  assert.match(ex.validateShape(Array.from({ length: ex.OBSTACLE_MAX_POINTS + 1 }, (_, i) => [Math.cos(i), Math.sin(i)])), /maximum/);
  assert.match(ex.validateShape([[0, 0], [10, NaN], [0, 10]]), /invalides/);
  assert.ok(ex.validateShape(null));
});

test("normalizeShape : centrée, plus grande dimension = taille demandée en mètres", () => {
  const drawn = [[20, 20], [220, 20], [220, 120], [20, 120]]; // 200 x 100 px dans l'éditeur
  const shape = ex.normalizeShape(drawn, 8, PPM);
  const xs = shape.map((p) => p[0]);
  const ys = shape.map((p) => p[1]);
  assert.ok(Math.abs((Math.max(...xs) - Math.min(...xs)) - 8 * PPM) < 1e-9);
  assert.ok(Math.abs((Math.max(...ys) - Math.min(...ys)) - 4 * PPM) < 1e-9);
  const [cx, cy] = ex.polygonCentroid(shape);
  assert.ok(Math.abs(cx) < 1e-9 && Math.abs(cy) < 1e-9);
});

// ---------- Entité ----------

test("Obstacle étend Vehicle mais reste immobile", () => {
  const obstacle = new ex.Obstacle(100, 50, square, Math.PI / 4);
  assert.ok(obstacle instanceof ex.Vehicle);
  assert.equal(obstacle.maxSpeed, 0);
  assert.equal(obstacle.vel.mag(), 0);
  assert.equal(obstacle.walls.length, 4);
  // Rotation de 45° : le coin (10, -10) passe sur l'axe x à √200 du centre.
  const corner = obstacle.points[1];
  assert.ok(Math.abs(corner[0] - (100 + Math.SQRT2 * 10)) < 1e-9);
  assert.ok(Math.abs(corner[1] - 50) < 1e-9);
});

test("collision : à l'intérieur ou à moins du rayon donné", () => {
  const obstacle = new ex.Obstacle(0, 0, square);
  assert.equal(obstacle.collides({ x: 0, y: 0 }, 1), true);
  assert.equal(obstacle.collides({ x: 12, y: 0 }, 3), true);   // 2 px du bord
  assert.equal(obstacle.collides({ x: 14, y: 0 }, 3), false);  // 4 px du bord
  assert.ok(Math.abs(obstacle.distanceTo({ x: 14, y: 0 }) - 4) < 1e-9);
});

test("toJSON / fromJSON : même obstacle", () => {
  const obstacle = new ex.Obstacle(10, 20, square, 0.3);
  const copy = ex.Obstacle.fromJSON(JSON.parse(JSON.stringify(obstacle.toJSON())));
  assert.deepEqual(plain(copy.points), plain(obstacle.points));
});

// ---------- Voitures ----------

// Obstacle posé sur la ligne médiane, `ahead` points de centre devant le départ.
function obstacleAhead(ahead, size = 8) {
  const p = monza.center[(monza.startPose(0).index + ahead) % monza.center.length];
  const half = (size * PPM) / 2;
  return new ex.Obstacle(p.x, p.y, [[-half, -half], [half, -half], [half, half], [-half, half]]);
}

test("les rayons voient l'obstacle comme un mur", () => {
  const car = new ex.Car(monza, spec, 0, null, 0, ex.createRng(1));
  car.sense();
  const freeFront = car.rayDistances[2];
  const obstacle = obstacleAhead(10); // ≈ 60 px devant
  car.sense(ex.obstacleWalls([obstacle]));
  assert.ok(car.rayDistances[2] < freeFront, `${car.rayDistances[2]} < ${freeFront}`);
  assert.ok(car.rayDistances[2] < 70);
});

test("une voiture qui touche un obstacle est éliminée ; sans contact, elle continue", () => {
  const car = new ex.Car(monza, spec, 0, null, 0, ex.createRng(1));
  const onCar = new ex.Obstacle(car.pos.x, car.pos.y, square);
  car.crashIntoObstacles([obstacleAhead(60)]);
  assert.equal(car.dead, false);
  car.crashIntoObstacles([onCar]);
  assert.equal(car.dead, true);
});

test("course réelle : une voiture qui fonce tout droit s'arrête sur l'obstacle", () => {
  const brain = { inputNodes: 6, predict: () => [0.5, 1] }; // tout droit, plein gaz
  const car = new ex.Car(monza, spec, 0, brain);
  const obstacle = obstacleAhead(20, 10);
  const walls = ex.obstacleWalls([obstacle]);
  for (let i = 0; i < 200 && car.racing; i++) car.drive(walls, [obstacle]);
  assert.equal(car.dead, true);
  assert.ok(obstacle.distanceTo(car.pos) < car.width, "éliminée au contact de l'obstacle");
});

// ---------- Mémorisation ----------

test("obstacles mémorisés par circuit, relus au chargement", () => {
  const storage = createMemoryStorage();
  ex.saveObstacles(storage, "monza", [new ex.Obstacle(10, 20, square), new ex.Obstacle(30, 40, square, 1)]);
  ex.saveObstacles(storage, "spa", [new ex.Obstacle(1, 2, square)]);
  assert.equal(ex.loadObstacles(storage, "monza").length, 2);
  assert.equal(ex.loadObstacles(storage, "spa").length, 1);
  assert.equal(ex.loadObstacles(storage, "interlagos").length, 0);
  ex.saveObstacles(storage, "monza", []); // tout effacer
  assert.equal(ex.loadObstacles(storage, "monza").length, 0);
  assert.equal(ex.loadObstacles(storage, "spa").length, 1);
});

test("données illisibles ou forme invalide ignorées ; stockage absent ou bloqué sans erreur", () => {
  assert.deepEqual(plain(ex.loadObstacles(createMemoryStorage({ [ex.OBSTACLES_STORAGE_KEY]: "{cassé" }), "monza")), []);
  const storage = createMemoryStorage({ [ex.OBSTACLES_STORAGE_KEY]: JSON.stringify({ monza: [{ x: 1, y: 2, shape: [[0, 0], [1, 0]] }, { x: 5, y: 5, shape: square }] }) });
  assert.equal(ex.loadObstacles(storage, "monza").length, 1);
  assert.deepEqual(plain(ex.loadObstacles(null, "monza")), []);
  const blocked = { getItem() { throw new Error("bloqué"); }, setItem() { throw new Error("bloqué"); } };
  assert.doesNotThrow(() => ex.saveObstacles(blocked, "monza", []));
  assert.deepEqual(plain(ex.loadObstacles(blocked, "monza")), []);
});
