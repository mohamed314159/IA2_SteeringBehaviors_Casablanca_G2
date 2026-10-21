// Étape 9 : employés (flânerie, discussions, café, groupes, formation, badge,
// retardataire, évasion, évitement, entrée dans les bâtiments).
import assert from "node:assert/strict";
import test from "node:test";
import { chargerExemple, Vector } from "./adaptateur-p5.mjs";

const FICHIERS = ["vehicle.js", "random.js", "simUnits.js", "geometry.js", "path.js", "collisions.js", "mapProjection.js",
  "data/casanearshore.js", "roadNetwork.js", "steeringAgent.js", "building.js", "campus.js", "parkingSpot.js",
  "parkingLot.js", "gate.js", "pillar.js", "garage.js", "parkingAllocator.js", "parkingWorld.js", "carModels.js",
  "roadVehicle.js", "luxuryCar.js", "shuttle.js", "tramCar.js", "tram.js", "traffic.js", "transit.js",
  "coffeeKiosk.js", "bench.js", "planter.js", "esplanade.js", "outfits.js", "employee.js", "crowd.js"];
const NOMS = ["CASANEARSHORE", "createCampus", "createParkingWorld", "createEsplanades", "TrafficManager", "Crowd",
  "Employee", "SteeringAgent", "Vehicle", "CoffeeKiosk", "Bench", "Planter", "SpatialGrid", "WalkingGroup",
  "OUTFITS", "createRng", "EMPLOYEE_CONFIG", "kmh", "mPx", "Path"];

let base = null;
function monde(graine = 9) {
  const env = chargerExemple(FICHIERS, { noms: NOMS, graine });
  const campus = env.createCampus(env.CASANEARSHORE);
  const world = env.createParkingWorld(campus);
  const rng = env.createRng(graine);
  const decor = env.createEsplanades(campus, world, rng);
  const trafic = new env.TrafficManager(campus, world, rng);
  const foule = new env.Crowd(campus, world, decor.esplanades, decor.obstacles, rng);
  foule.cars = () => trafic.cars;
  trafic.pedestriansNear = (p, r) => foule.near(p, r);
  trafic.onParked = c => foule.spawnDriver(c);
  return { ...env, campus, world, decor, trafic, foule, rng };
}

function pas(m, n, chaque = () => {}) {
  for (let i = 0; i < n; i++) {
    m.trafic.step();
    m.foule.step();
    if (chaque(i) === true) return i;
  }
  return -1;
}

test("décor : kiosques, bancs et jardinières sont des Vehicle immobiles, hors des bâtiments", () => {
  const m = monde();
  assert.equal(m.decor.esplanades.length, 4);
  for (const o of m.decor.obstacles) {
    assert.ok(o instanceof m.Vehicle);
    assert.equal(o.maxSpeed, 0);
    assert.ok(!m.campus.buildings.some(b => b.contains(o.pos)));
    assert.ok(m.campus.insideSite({ x: o.pos.x, y: o.pos.y }));
  }
  const k = m.decor.esplanades[0].kiosk;
  assert.ok(k instanceof m.CoffeeKiosk);
  assert.ok(Math.abs(k.counter.dist(k.pos) - (k.r + m.mPx(1))) < 1e-9, "comptoir devant le kiosque");
});

test("grille spatiale : mêmes voisins qu'une recherche exhaustive", () => {
  const m = monde();
  const g = new m.SpatialGrid(10);
  const pts = Array.from({ length: 200 }, (_, i) => ({ pos: new Vector((i * 37) % 97, (i * 53) % 89) }));
  g.rebuild(pts);
  const centre = new Vector(40, 40);
  const attendu = pts.filter(p => p.pos.dist(centre) <= 15).length;
  assert.equal(g.query(centre, 15).length, attendu);
});

test("employé : SteeringAgent, tenue professionnelle, porte de son bâtiment comme cible", () => {
  const m = monde();
  m.foule.spawnPresent(20);
  const tenues = new Set(m.foule.employees.map(e => e.look.outfit.key));
  assert.ok(tenues.size >= 3, "plusieurs tenues");
  for (const e of m.foule.employees) {
    assert.ok(e instanceof m.Employee && e instanceof m.SteeringAgent);
    assert.ok(e.target.dist(e.building.door) < 1e-9);
    assert.ok(m.OUTFITS.includes(e.look.outfit));
  }
});

test("avant 8h55 : discussions en cercle, flâneurs confinés à leur esplanade", () => {
  const m = monde();
  m.foule.spawnPresent(60);
  assert.ok(m.foule.chats.length >= 4);
  for (const c of m.foule.chats) {
    assert.ok(c.members.length >= 3 && c.members.length <= 5);
    for (const e of c.members) assert.ok(Math.abs(e.slot.dist(c.center) - m.mPx(1.1)) < 1e-9);
  }
  let horsZone = 0;
  pas(m, 900, () => {
    for (const e of m.foule.employees) {
      if (e.state === "wander" && e.pos.dist(e.zone.center) > e.zone.radius + m.mPx(8)) horsZone++;
    }
  });
  assert.equal(horsZone, 0, "le confinement ramène les flâneurs");
  // les membres d'une discussion sont arrivés à leur place
  for (const c of m.foule.chats) for (const e of c.members) assert.ok(e.pos.dist(e.slot) < m.mPx(1.5));
});

test("café : arrive au comptoir, attend, repart avec un café", () => {
  const m = monde();
  m.foule.spawnPresent(4);
  const e = m.foule.employees[0];
  e.state = "coffee";
  e.nextStateAfterCoffee = "wander";
  const fini = pas(m, 2000, () => e.holdsCoffee === true);
  assert.ok(fini > 0);
  assert.equal(e.state, "wander");
  assert.ok(e.pos.dist(e.zone.kiosk.counter) < m.mPx(1));
});

test("8h55 : départs étalés sur 12 s, chacun entre dans son bâtiment (arrive puis disparition)", () => {
  const m = monde();
  m.foule.spawnPresent(12);
  m.foule.goToWork();
  let maxAttente = 0;
  pas(m, 75, i => {
    if (m.foule.employees.some(e => ["wander", "chat", "coffee"].includes(e.state))) maxAttente = i;
  });
  assert.ok(maxAttente < 61, "tous partis en moins de 12 s (60 pas)");
  const fin = pas(m, 6000, () => m.foule.employees.length === 0);
  assert.ok(fin > 0, "tout le monde est entré");
  assert.equal(m.foule.enteredCount, 12);
});

test("descente du tram : arrive sur le quai, puis groupes par bâtiment (boids ou formation)", () => {
  const m = monde();
  const portes = [new Vector(1700, 390), new Vector(1730, 385)];
  const sortis = m.foule.spawnPassengers(portes, new Vector(0.3, 0.95).normalize(), 16, "tram");
  assert.equal(sortis.length, 16);
  assert.ok(sortis.every(e => e.state === "alight"));
  pas(m, 400, () => m.foule.groups.length > 0 || sortis.every(e => e.state !== "alight" && e.state !== "waitGroup"));
  assert.ok(sortis.every(e => !["alight", "waitGroup"].includes(e.state)), "tous ont quitté le quai");
  for (const g of m.foule.groups) {
    assert.ok(g.members.every(x => x.building === g.building), "groupe d'un même bâtiment");
    if (g.mode === "formation") {
      assert.equal(g.leader.state, "lead");
      assert.ok(g.members.slice(1).every(x => x.state === "follow"));
    } else {
      assert.ok(g.members.every(x => x.state === "flock"));
    }
  }
});

test("formation : les suiveurs restent derrière le guide", () => {
  const m = monde();
  const b = m.campus.buildings[0];
  const gens = Array.from({ length: 5 }, (_, i) => m.foule.add({ x: 1650 + i * 2, y: 470, building: b, state: "waitGroup", origin: "tram" }));
  m.foule.rng = () => 0; // force le mode formation
  m.foule.formWalkingGroups(gens);
  const g = m.foule.groups[0];
  assert.equal(g.mode, "formation");
  let devant = 0;
  pas(m, 1500, () => {
    if (g.leader.state !== "lead" || g.leader.vel.mag() < 0.2) return;
    for (const s of g.members.slice(1)) {
      if (s.state !== "follow") continue;
      const d = s.pos.copy().sub(g.leader.pos);
      if (d.dot(g.leader.heading) > m.mPx(1)) devant++;
    }
  });
  assert.equal(devant, 0, "aucun suiveur ne passe devant le guide");
});

test("badge oublié : le conducteur poursuit (pursue) son collègue puis lui remet le badge", () => {
  const m = monde();
  m.foule.config = { ...m.foule.config, badgeShare: 1 };
  const voiture = m.trafic.spawnCar({ entry: m.campus.entries[0] });
  voiture.state = "parked";
  voiture.level = 0;
  voiture.vel.set(0, 0);
  const conducteur = m.foule.spawnDriver(voiture);
  const passager = m.foule.employees.find(e => e !== conducteur);
  assert.equal(conducteur.state, "pursue");
  assert.equal(conducteur.badgeFor, passager);
  let pointPredit = false;
  const fini = pas(m, 3000, () => {
    if (conducteur.behavior === "pursue" && conducteur.debugInfo.pursuePoint) pointPredit = true;
    return conducteur.state !== "pursue";
  });
  assert.ok(fini >= 0);
  assert.ok(pointPredit, "la poursuite vise un point prédit");
  assert.equal(passager.waitingForBadge, false);
  assert.ok(conducteur.pos.dist(passager.pos) <= m.mPx(1.5) + passager.maxSpeed + conducteur.maxSpeed);
});

test("retardataire : seek (pleine vitesse, sans freiner) jusqu'à 2 m de la porte", () => {
  const m = monde();
  const b = m.campus.buildings[3];
  const depart = b.door.copy().add(m.mPx(25), 0);
  const e = m.foule.spawnLate(depart, b);
  assert.equal(e.state, "run");
  let vMin = Infinity;
  pas(m, 400, () => {
    if (e.state === "run" && e.pos.dist(e.target) > m.mPx(6) && e.age > 40) vMin = Math.min(vMin, e.vel.mag());
    e.age = (e.age ?? 0) + 1;
    return e.state !== "run";
  });
  assert.ok(vMin > e.config.runSpeed * 0.7, `vitesse maintenue ${vMin}`);
});

test("évasion : un piéton s'écarte d'une voiture qui arrive, jusqu'à la distance de sortie", () => {
  const m = monde();
  const e = m.foule.add({ x: 1300, y: 1300, state: "walk", origin: "site" });
  e.path = new m.Path([e.pos.copy(), e.pos.copy().add(m.mPx(40), 0)], m.mPx(1.5));
  const voiture = m.trafic.spawnCar({ entry: m.campus.entries[0] });
  voiture.state = "inside";
  voiture.pos = e.pos.copy().add(0, m.mPx(5));
  voiture.vel = new Vector(0, -1);
  voiture.heading = new Vector(0, -1);
  const ctx = m.foule.context();
  m.foule.movingCars = [voiture];
  const f = e.evadeThreats(ctx.threats(e));
  assert.ok(e.evadeState.active);
  assert.ok(f.mag() > 0);
  assert.ok(e.evadeExitRadius > e.evadeDetectionRadius);
});

test("évitement : un piéton qui marche ne traverse jamais un bâtiment", () => {
  const m = monde();
  m.foule.spawnPresent(30);
  m.foule.goToWork();
  let dedans = 0;
  pas(m, 2500, () => {
    for (const e of m.foule.employees) {
      if (e.level !== 0 || ["arrive", "gone"].includes(e.state)) continue;
      if (m.campus.buildings.some(b => b !== e.building && b.contains(e.pos))) dedans++;
    }
  });
  assert.equal(dedans, 0);
});

test("conducteur au garage : arrive à l'ascenseur puis disparaît", () => {
  const m = monde();
  m.foule.config = { ...m.foule.config, badgeShare: 0 };
  const voiture = m.trafic.spawnCar({ entry: m.campus.entries[0] });
  const place = m.world.garage.lot.spots[10];
  voiture.spot = place;
  voiture.level = -1;
  voiture.pos = place.pos.copy();
  voiture.heading = place.facing.copy();
  voiture.state = "parked";
  const e = m.foule.spawnDriver(voiture);
  assert.equal(e.level, -1);
  assert.ok(e.target.dist(m.world.garage.elevatorDoor) < 1e-9);
  const fini = pas(m, 3000, () => e.state === "gone");
  assert.ok(fini > 0);
  assert.equal(m.foule.enteredBy.garage, 1);
});

test("les voitures cèdent le passage à un piéton sur leur voie", () => {
  const m = monde();
  const voiture = m.trafic.spawnCar({ entry: m.campus.entries[0] });
  // un piéton immobile sur le chemin de la voiture, 20 m devant
  const devant = voiture.path.pointAhead(2, voiture.path.points[2], m.mPx(20));
  const p = m.foule.add({ x: devant.x, y: devant.y, state: "waitGroup", origin: "site" });
  let distMin = Infinity;
  pas(m, 300, () => {
    distMin = Math.min(distMin, voiture.pos.dist(p.pos));
  });
  assert.ok(distMin > voiture.length / 2, `la voiture s'arrête avant le piéton (${distMin})`);
});
