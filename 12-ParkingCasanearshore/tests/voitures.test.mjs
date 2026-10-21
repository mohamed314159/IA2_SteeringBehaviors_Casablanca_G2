// Étape 5 : voitures de luxe (cycle complet, file d'attente, garage).
import assert from "node:assert/strict";
import test from "node:test";
import { chargerExemple, Vector } from "./adaptateur-p5.mjs";
import { FICHIERS_SIMULATION } from "./fichiers.mjs";

const FICHIERS = FICHIERS_SIMULATION;
const NOMS = ["CASANEARSHORE", "createCampus", "createParkingWorld", "TrafficManager", "LuxuryCar", "SteeringAgent",
  "createRng", "CAR_CONFIG", "kmh", "Path", "mPx", "closestPointOnSegment"];

// Monde neuf pour chaque test (les places sont un état partagé).
function monde(graine = 3) {
  const env = chargerExemple(FICHIERS, { noms: NOMS });
  const campus = env.createCampus(env.CASANEARSHORE);
  const world = env.createParkingWorld(campus);
  const trafic = new env.TrafficManager(campus, world, env.createRng(graine));
  return { ...env, campus, world, trafic };
}

// Fait tourner la simulation jusqu'à ce que `fin()` soit vrai.
function simuler(trafic, fin, max = 6000, chaquePas = () => {}) {
  for (let pas = 0; pas < max; pas++) {
    chaquePas(pas);
    trafic.step();
    if (fin()) return pas;
  }
  return -1;
}

test("voiture : hérite de SteeringAgent, voiture de luxe aux dimensions réelles", () => {
  const { trafic, campus, LuxuryCar, SteeringAgent } = monde();
  const v = trafic.spawnCar({ entry: campus.entries[0], kind: "standard" });
  assert.ok(v instanceof LuxuryCar && v instanceof SteeringAgent);
  assert.ok(v.length >= 9.6 && v.length <= 10.6, "4,8 à 5,3 m");
  assert.equal(v.state, "approach");
  assert.equal(v.spot, null, "pas de place avant la porte");
  assert.ok(["Mercedas", "Bémvé", "Audii", "Range Rouvre", "Porsha", "Bentlé", "Mazeratti"].includes(v.spec.brand));
});

test("cycle en surface : bord de carte → porte → place attribuée à la porte → place, sans wander", () => {
  const { trafic, campus, world } = monde();
  // Toutes les places du garage sont prises : la voiture va en surface.
  for (const g of world.garages) for (const s of g.lot.spots) s.reserve({});
  const v = trafic.spawnCar({ entry: campus.entries[0], kind: "standard" });
  const etats = [v.state];
  const comportements = new Set();
  let placeAvantPorte = null;
  let vitesseMax = 0;
  const pas = simuler(trafic, () => v.state === "parked", 6000, () => {
    if (etats.at(-1) !== v.state) etats.push(v.state);
    comportements.add(v.behavior);
    if (v.state === "approach") placeAvantPorte = v.spot;
    vitesseMax = Math.max(vitesseMax, v.vel.mag() - v.maxSpeed);
  });
  assert.ok(pas > 0, "la voiture se gare");
  assert.deepEqual([...etats, "parked"].filter((e, i, t) => t.indexOf(e) === i), ["approach", "gateStop", "inside", "parking", "parked"]);
  assert.equal(placeAvantPorte, null);
  assert.ok(!comportements.has("wander"), "aucune recherche de place en tournant");
  assert.ok(vitesseMax <= 1e-9, "vitesse toujours ≤ maxSpeed");
  assert.equal(v.spot.state, "occupied");
  assert.equal(v.spot.level, 0);
  assert.ok(v.pos.dist(v.spot.pos) < 1e-9 && v.vel.mag() === 0);
  assert.equal(world.gates[v.gateKey].passedCount, 1);
});

test("cycle garage : arrive à la bouche, disparaît de la surface, rampe, badge, place au sous-sol", () => {
  const { trafic, campus, world } = monde();
  for (const lot of world.lots) for (const s of lot.spots) s.reserve({});
  const v = trafic.spawnCar({ entry: campus.entries[0], kind: "standard" });
  const etats = [];
  let vitesseRampe = 0;
  const pas = simuler(trafic, () => v.state === "parked", 8000, () => {
    if (etats.at(-1) !== v.state) etats.push(v.state);
    if (v.state === "ramp") vitesseRampe = Math.max(vitesseRampe, v.vel.mag());
  });
  assert.ok(pas > 0);
  assert.deepEqual(etats, ["approach", "gateStop", "inside", "garageEntry", "ramp", "badge", "garageDrive", "parking"]);
  assert.equal(v.level, -1, "la voiture n'est plus en surface");
  assert.equal(v.spot.level, -1);
  assert.ok(vitesseRampe <= v.config.insideSpeed * v.spot.lot.garage.rampSpeedFactor() + 1e-9, "vitesse réduite sur la rampe");
});

test("file à la porte : deux voitures sur la même entrée, aucune collision, ordre respecté", () => {
  const { trafic, campus } = monde();
  const entree = campus.entries.find(e => e.gate === "sud");
  const a = trafic.spawnCar({ entry: entree });
  let b = null;
  const ordre = [];
  simuler(trafic, () => a.state === "parked" && b && b.state === "parked", 8000, pas => {
    if (pas === 15) b = trafic.spawnCar({ entry: entree });
    for (const v of [a, b]) if (v && v.state === "inside" && !ordre.includes(v)) ordre.push(v);
  });
  assert.equal(trafic.collisions.total, 0);
  assert.deepEqual(ordre.map(v => v.id), [a.id, b.id], "la première arrivée passe la première");
});

test("trafic dense : 12 voitures depuis plusieurs entrées, toutes garées, aucune collision", () => {
  const { trafic, campus } = monde();
  const prevues = Array.from({ length: 12 }, (_, k) => ({ entree: campus.entries[(k * 7) % campus.entries.length], pas: k * 40 }));
  const pas = simuler(trafic, () => trafic.cars.length === 12 && trafic.cars.every(c => c.state === "parked"), 8000, p => {
    for (const x of prevues) if (x.pas === p) trafic.spawnCar({ entry: x.entree });
  });
  assert.ok(pas > 0, "toutes garées");
  assert.equal(trafic.collisions.total, 0);
  const places = trafic.cars.map(c => c.spot);
  assert.equal(new Set(places).size, 12, "une place différente par voiture");
});

test("zone de freinage : R ≥ vmax² / maxForce (profil linéaire de l'arrive)", () => {
  const { trafic, campus } = monde();
  const v = trafic.spawnCar({ entry: campus.entries[0] });
  v.maxSpeed = 4;
  v.maxForce = 0.2;
  v.vel = new Vector(1, 0);
  assert.ok(v.brakingZone() >= (4 * 4) / 0.2);
  v.maxSpeed = 0.5;
  assert.equal(v.brakingZone(), v.config.queueSlowRadius);
});

test("priorités : dans le parc on ne cède jamais à une voiture qui attend dehors", () => {
  const { trafic, campus } = monde();
  const dedans = trafic.spawnCar({ entry: campus.entries[0] });
  const dehors = trafic.spawnCar({ entry: campus.entries[1] });
  dedans.state = "inside";
  dehors.state = "gateStop";
  assert.equal(dedans.yieldsTo(dehors), false);
  assert.equal(dehors.yieldsTo(dedans), true);
  dehors.state = "approach";
  assert.equal(dehors.yieldsTo(dedans), true);
});

test("interblocage en cercle (3 voitures) : seul le plus ancien passe ; une file ordinaire n'est pas touchée", () => {
  const { trafic, campus } = monde();
  const [a, b, c] = [0, 1, 2].map(k => trafic.spawnCar({ entry: campus.entries[k % campus.entries.length] }));
  const bloquer = (v, devant) => {
    v.leaderAhead = devant;
    v.vel = new Vector(0, 0);
    v.blockedSteps = v.config.deadlockSteps + 5;
    v.ignoredCar = null;
  };
  // A attend B, B attend C, C attend A.
  bloquer(a, b);
  bloquer(b, c);
  bloquer(c, a);
  for (const v of [c, b, a]) v.detectDeadlock("file");
  assert.equal(a.ignoredCar, b, "le plus ancien du cercle ignore celui qu'il attend");
  assert.ok(a.ignoreUntil > a.age);
  assert.equal(b.ignoredCar, null);
  assert.equal(c.ignoredCar, null);
  // File ordinaire : A attend B, B attend C, C roule (pas de cercle).
  bloquer(a, b);
  bloquer(b, c);
  c.leaderAhead = null;
  c.blockedSteps = 0;
  a.detectDeadlock("file");
  assert.equal(a.ignoredCar, null, "pas de passage en force dans une file");
  // Pas encore assez longtemps bloqué : rien.
  bloquer(a, b);
  bloquer(b, a);
  a.blockedSteps = 0;
  a.detectDeadlock("file");
  assert.equal(a.ignoredCar, null);
});

test("apparition : refusée tant que l'entrée est encombrée ; route publique sans traverser le parc", () => {
  const { trafic, campus } = monde();
  const entree = campus.entries[0];
  const v = trafic.spawnCar({ entry: entree });
  assert.equal(trafic.entryIsClear(entree), false);
  for (const p of v.path.points.slice(0, -1)) {
    const n = campus.network.nearestNode(p);
    assert.equal(campus.insideSite(n) && n.id !== campus.gates[v.gateKey].osmId && Math.hypot(n.x - p.x, n.y - p.y) < 1, false);
  }
});

test("virage serré : la voiture ralentit avant, freine dans le budget de force et reste sur sa voie", () => {
  const { trafic, LuxuryCar, Path, CAR_CONFIG, mPx, closestPointOnSegment } = monde();
  // Route droite puis virage à gauche à 90° (le côté extérieur est celui du
  // trottoir) : 200 m vers l'est, puis vers le nord (y vers le haut de l'écran).
  const coin = new Vector(400, 0);
  const chemin = new Path([new Vector(0, 0), coin, new Vector(400, -400)], mPx(CAR_CONFIG.laneToleranceM));
  const v = new LuxuryCar(0, 0, { path: chemin });
  assert.equal(v.state, "approach");
  assert.ok(v.vel.mag() <= v.config.cruiseSpeed * 0.8 + 1e-9);
  trafic.cars = [v];
  let vitesseAuCoin = Infinity;
  let freinageMax = 0;
  let ecartMax = 0;
  let depassementExterieur = 0;
  let avant = v.vel.mag();
  for (let pas = 0; pas < 400 && v.state === "approach" && v.pos.y > -250; pas++) {
    trafic.step();
    freinageMax = Math.max(freinageMax, avant - v.vel.mag());
    avant = v.vel.mag();
    if (v.pos.dist(coin) < mPx(3)) vitesseAuCoin = Math.min(vitesseAuCoin, v.vel.mag());
    const ecart = Math.min(...[0, 1].map(i => v.pos.dist(closestPointOnSegment(v.pos, ...chemin.segment(i)))));
    ecartMax = Math.max(ecartMax, ecart);
    // Côté extérieur du virage (vers le trottoir) : au sud de la 1re voie ou à l'est de la 2e.
    depassementExterieur = Math.max(depassementExterieur, v.pos.y, v.pos.x - coin.x);
  }
  assert.ok(v.pos.y < -100, "la voiture a pris le virage");
  assert.ok(vitesseAuCoin <= v.config.cornerSpeed * 1.25, `vitesse au virage ${vitesseAuCoin} > ${v.config.cornerSpeed}`);
  assert.ok(freinageMax <= v.maxForce + 1e-9, `freinage ${freinageMax} > maxForce`);
  assert.ok(depassementExterieur < mPx(1.3), `déport vers l'extérieur ${depassementExterieur / 2} m`);
  assert.ok(ecartMax < mPx(3.5), `écart à la voie ${ecartMax / 2} m (le virage se prend en coupant un peu à l'intérieur)`);
});

test("vitesse de virage : inchangée en ligne droite ; avant un virage à 90°, v² = v_virage² + 2 · maxForce · (d − anticipation)", () => {
  const { LuxuryCar, Path } = monde();
  const droit = new LuxuryCar(0, 0, { path: new Path([new Vector(0, 0), new Vector(2000, 0)], 2) });
  assert.equal(droit.cornerSpeedLimit(droit.config.cruiseSpeed), droit.config.cruiseSpeed);
  const v = new LuxuryCar(0, 0, { path: new Path([new Vector(0, 0), new Vector(60, 0), new Vector(60, 300)], 2) });
  v.vel = new Vector(0.5, 0);
  // Le virage commence quand la position prédite (pathPredict) atteint le sommet.
  const attendu = Math.sqrt(v.config.cornerSpeed ** 2 + 2 * v.maxForce * (60 - v.pathPredict));
  assert.ok(Math.abs(v.cornerSpeedLimit(v.config.cruiseSpeed) - attendu) < 1e-9);
  // Garée ou hors d'un état de suivi de chemin : pas de limite de virage.
  v.state = "parking";
  assert.equal(v.cornerSpeedLimit(3), 3);
});
