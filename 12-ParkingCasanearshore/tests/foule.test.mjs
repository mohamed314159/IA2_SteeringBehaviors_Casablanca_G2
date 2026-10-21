// Étape 9 : employés (flânerie, discussions, café, bancs, groupes, formation,
// retardataire, évasion, évitement, trottoirs, entrée dans les bâtiments) et gardiens.
import assert from "node:assert/strict";
import test from "node:test";
import { chargerExemple, Vector } from "./adaptateur-p5.mjs";
import { FICHIERS_SIMULATION } from "./fichiers.mjs";

const FICHIERS = FICHIERS_SIMULATION;
const NOMS = ["CASANEARSHORE", "createCampus", "createParkingWorld", "createEsplanades", "TrafficManager", "Crowd",
  "Employee", "SteeringAgent", "Vehicle", "CoffeeKiosk", "Bench", "AssemblyPoint", "SpatialGrid", "WalkingGroup",
  "OUTFITS", "createRng", "EMPLOYEE_CONFIG", "kmh", "mPx", "Path", "planWalk", "sidewalkOffset", "offsetPolylineVariable",
  "ROAD_WIDTH_M", "SIDEWALK_GAP_M", "Simulation", "SCHEDULE_CONFIG", "SecurityGuard", "GUARD_POSTS", "stepsFor",
  "closestPointOnSegment", "pointInPolygon"];

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

test("décor : stands de café juste à côté des bâtiments, bancs, points de rassemblement ; Vehicle immobiles", () => {
  const m = monde();
  assert.ok(m.decor.esplanades.length >= 8 && m.decor.esplanades.length <= 12, `${m.decor.esplanades.length} stands`);
  for (const z of m.decor.esplanades) {
    // le stand est à moins de 12 m de la façade de son bâtiment
    assert.ok(z.building.closestPoint(z.kiosk.pos).dist(z.kiosk.pos) < m.mPx(12), z.kiosk.name);
    assert.notEqual(z.building.usage, "chantier");
  }
  assert.ok(m.decor.obstacles.some(o => o instanceof m.Bench));
  assert.ok(m.decor.assemblyPoints.length >= 4);
  for (const a of m.decor.assemblyPoints) {
    assert.ok(a instanceof m.AssemblyPoint && a instanceof m.Vehicle);
    assert.ok(m.campus.insideSite({ x: a.pos.x, y: a.pos.y }));
    assert.ok(!m.campus.buildings.some(b => b.contains(a.pos)), "hors des bâtiments");
    assert.ok(!m.world.lots.some(l => m.pointInPolygon(a.pos, l.points)), "hors des parkings");
  }
  // un parvis pavé devant chaque bâtiment (sauf le chantier)
  assert.equal(m.decor.parvis.length, m.campus.buildings.filter(b => b.usage !== "chantier").length);
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

test("avant 8h55 : discussions et flâneurs sur les espaces piétons, jamais au milieu d'une chaussée", () => {
  const m = monde();
  m.foule.spawnPresent(80);
  const axes = m.campus.data.roads.filter(r => !["footway", "pedestrian", "path", "steps"].includes(r.type))
    .flatMap(r => r.points.slice(1).map((p, i) => [new Vector(...r.points[i]), new Vector(...p)]));
  const surRoute = p => axes.some(([a, b]) => m.closestPointOnSegment(p, a, b).dist(p) < m.mPx(4));
  for (const c of m.foule.chats) assert.equal(surRoute(c.center), false, "cercle de discussion sur une route");
  const auCentre = e => e.zone && e.pos.dist(e.zone.center) < 1e-9;
  const mal = m.foule.employees.filter(e => e.state === "wander" && !auCentre(e) && surRoute(e.pos));
  assert.equal(mal.length, 0, `${mal.length} flâneurs placés sur une chaussée`);
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

test("banc : un flâneur s'assoit (arrive sur la place), reste assis, repart flâner ; place libérée", () => {
  const m = monde();
  m.foule.spawnPresent(6);
  const e = m.foule.employees.find(x => x.state === "wander") ?? m.foule.employees[0];
  const banc = m.decor.obstacles.find(o => o instanceof m.Bench);
  const place = banc.freeSeat();
  e.sitOn(banc, place, 50);
  assert.equal(place.occupant, e, "place réservée");
  assert.notEqual(banc.freeSeat(), place);
  let assis = -1;
  let comportement = null;
  const fini = pas(m, 3000, i => {
    if (!e.seated && e.state === "sit") comportement = e.behavior;
    if (e.seated && assis < 0) assis = i;
    return assis >= 0 && e.state === "wander";
  });
  assert.equal(comportement, "arrive", "il arrive sur sa place");
  assert.ok(assis >= 0, "il s'assoit");
  assert.ok(fini - assis >= 49, "il reste assis le temps prévu");
  assert.equal(place.occupant, null, "place libérée");
});

test("8h55 : un employé assis se lève, libère sa place et va travailler", () => {
  const m = monde();
  m.foule.spawnPresent(4);
  const e = m.foule.employees[0];
  const banc = m.decor.obstacles.find(o => o instanceof m.Bench);
  const place = banc.freeSeat();
  e.sitOn(banc, place, 10000);
  pas(m, 300, () => e.seated);
  assert.ok(e.seated);
  m.foule.goToWork();
  pas(m, 80);
  assert.notEqual(e.state, "sit");
  assert.equal(place.occupant, null);
});

test("retardataire : seek (pleine vitesse, sans freiner) jusqu'à 2 m de la porte", () => {
  const m = monde();
  const b = m.campus.buildings[3];
  const depart = b.door.copy().add(m.mPx(25), 0);
  const e = m.foule.spawnLate(depart, b);
  assert.equal(e.state, "run");
  assert.ok(e.path && e.path.points.length >= 2, "itinéraire piéton calculé");
  let vMin = Infinity;
  pas(m, 400, () => {
    if (e.state === "run" && e.pos.dist(e.target) > m.mPx(6) && e.age > 40) vMin = Math.min(vMin, e.vel.mag());
    e.age = (e.age ?? 0) + 1;
    return e.state !== "run";
  });
  assert.ok(vMin > e.config.runSpeed * 0.7, `vitesse maintenue ${vMin}`);
});

test("retardataire loin de sa porte : seek point par point sur son itinéraire, jamais bloqué contre un bâtiment", () => {
  const m = monde();
  // De la porte nord jusqu'au lieu de travail le plus éloigné (plusieurs centaines de mètres).
  const nord = m.world.gates.nord;
  const depart = new Vector(-nord.approach.y, nord.approach.x).mult(m.mPx(5)).add(nord.pos);
  const b = m.campus.workplaces.reduce((x, y) => (y.door.dist(depart) > x.door.dist(depart) ? y : x));
  assert.ok(b.door.dist(depart) > m.mPx(300));
  const e = m.foule.spawnLate(depart, b);
  let lent = 0;
  let lentMax = 0;
  const cibles = new Set();
  const fini = pas(m, 4000, () => {
    if (e.state === "run") {
      cibles.add(e.waypoint);
      lent = e.vel.mag() < 0.2 ? lent + 1 : 0;
      lentMax = Math.max(lentMax, lent);
    }
    return e.state === "gone";
  });
  assert.ok(fini > 0, "il entre dans son bâtiment");
  assert.ok(cibles.size > 2, "il vise successivement plusieurs points de son itinéraire");
  assert.ok(lentMax < m.stepsFor(3), `jamais arrêté plus de 3 s (${lentMax} pas)`);
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
  const voiture = m.trafic.spawnCar({ entry: m.campus.entries[0] });
  const place = m.world.garages[0].lot.spots[10];
  voiture.spot = place;
  voiture.level = -1;
  voiture.pos = place.pos.copy();
  voiture.heading = place.facing.copy();
  voiture.state = "parked";
  const e = m.foule.spawnDriver(voiture);
  assert.equal(e.level, -1);
  assert.ok(e.target.dist(m.world.garages[0].elevatorDoor) < 1e-9);
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

test("trottoirs : décalage par tronçon (chaussée + 1,6 m), nul sur un chemin piéton", () => {
  const m = monde();
  const net = m.campus.pedestrianNetwork;
  let route = null;
  let chemin = null;
  for (const n of net.nodes.values()) {
    for (const e of n.edges) {
      if (!route && e.type === "service") route = [n.id, e.to, e.type];
      if (!chemin && e.type === "footway") chemin = [n.id, e.to];
    }
  }
  assert.ok(route && chemin);
  assert.equal(m.sidewalkOffset(net, route[0], route[1]), m.mPx(m.ROAD_WIDTH_M.service / 2 + m.SIDEWALK_GAP_M));
  assert.equal(m.sidewalkOffset(net, chemin[0], chemin[1]), 0);
  // décalage variable : à droite du sens de marche, moyenne aux sommets
  const pts = m.offsetPolylineVariable([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }], [10, 0]);
  assert.deepEqual(pts.map(p => [p.x, p.y]), [[0, 10], [100, 5], [200, 0]]);
});

// Une chaussée peut être traversée (en marchant à peu près en travers) ; le
// long d'une route, on reste sur le trottoir. Les quelques mètres « le long »
// restants sont aux carrefours denses et aux allées parallèles des rampes de garage.
test("trottoirs : à pied, on traverse les chaussées mais on ne les longe presque jamais ; jamais la voie rapide", () => {
  const m = monde();
  const axes = [];
  for (const r of m.campus.data.roads) {
    for (let i = 0; i + 1 < r.points.length; i++) axes.push({ a: new Vector(...r.points[i]), b: new Vector(...r.points[i + 1]), demi: m.mPx((m.ROAD_WIDTH_M[r.type] ?? 5) / 2), type: r.type });
  }
  const chaussee = p => axes.find(s => m.closestPointOnSegment(p, s.a, s.b).dist(p) < s.demi - m.mPx(0.3));
  let dessus = 0;
  let leLong = 0;
  let total = 0;
  const types = new Set();
  const lieux = m.campus.workplaces;
  for (let k = 0; k < 12; k++) {
    const de = lieux[k % lieux.length].door;
    const a = lieux[(k * 5 + 3) % lieux.length].door;
    const chemin = [de, ...m.planWalk(m.campus, de, a)];
    // longueur du trajet sur une chaussée, échantillonnée tous les mètres
    for (let i = 0; i + 1 < chemin.length; i++) {
      const l = chemin[i].dist(chemin[i + 1]);
      const dir = chemin[i + 1].copy().sub(chemin[i]).normalize();
      for (let s = 0; s < l; s += m.mPx(1)) {
        const p = chemin[i].copy().add(chemin[i + 1].copy().sub(chemin[i]).mult(s / l));
        total++;
        const c = chaussee(p);
        if (c) {
          dessus++;
          types.add(c.type);
          // à moins de 45° de l'axe de la route : on la longe
          if (Math.abs(c.b.copy().sub(c.a).normalize().dot(dir)) > 0.7) leLong++;
        }
      }
    }
  }
  assert.ok(total > 1000, `${total} m de trajets`);
  assert.ok(dessus / total < 0.15, `${dessus} m sur ${total} m sur une chaussée (traversées comprises)`);
  assert.ok(leLong / total < 0.08, `${leLong} m sur ${total} m le long d'une chaussée`);
  assert.ok(!types.has("trunk") && !types.has("trunk_link"), "jamais le long de la voie rapide");
});

test("itinéraires à pied : depuis la station et les stands, un vrai itinéraire vers chaque bâtiment, sans traverser de bâtiment", () => {
  const m = monde();
  const d = m.campus.data;
  const station = d.stops.filter(x => x.name === "Casa Nearshore").map(x => new Vector(x.point[0], x.point[1]));
  const departs = [...station, ...m.decor.esplanades.map(z => z.kiosk.counter)];
  let traversees = 0;
  for (const de of departs) {
    for (const b of m.campus.workplaces) {
      const chemin = [de, ...m.planWalk(m.campus, de, b.door)];
      assert.ok(chemin.length > 2, "jamais une simple ligne droite");
      for (let i = 0; i + 1 < chemin.length; i++) {
        const l = chemin[i].dist(chemin[i + 1]);
        for (let t = 0; t <= l; t += m.mPx(1)) {
          const p = chemin[i].copy().add(chemin[i + 1].copy().sub(chemin[i]).mult(t / l));
          if (m.campus.buildings.some(x => x !== b && x.contains(p))) traversees++;
        }
      }
    }
  }
  assert.equal(traversees, 0, `${traversees} m d'itinéraire dans un bâtiment`);
});

test("gardiens : uniforme blanc, postés aux portes réelles, ronde (path following) puis retour au poste (arrive)", () => {
  const env = chargerExemple(FICHIERS, { noms: NOMS, graine: 4 });
  const sim = new env.Simulation(env.CASANEARSHORE, 4, { schedule: { ...env.SCHEDULE_CONFIG, cars: 0 }, present: 0 });
  assert.equal(sim.guards.length, env.GUARD_POSTS.reduce((t, p) => t + p.count, 0));
  const net = sim.campus.network;
  for (const g of sim.guards) {
    assert.ok(g instanceof env.SecurityGuard && g instanceof env.SteeringAgent);
    assert.equal(g.look.outfit.jacket, "#f5f5f2", "veste blanche");
    assert.equal(g.look.outfit.shirt, "#ffffff", "chemise blanche");
    const porte = env.GUARD_POSTS.map(p => net.nodes.get(p.osmId)).reduce((m, n) => Math.min(m, Math.hypot(n.x - g.post.x, n.y - g.post.y)), Infinity);
    assert.ok(porte < env.mPx(10), "posté à une porte réelle");
  }
  const g = sim.guards[0];
  g.timer = 1; // part en ronde au prochain pas
  const etats = [];
  const comportements = new Set();
  for (let i = 0; i < 3000; i++) {
    g.step([]);
    if (etats.at(-1) !== g.state) etats.push(g.state);
    comportements.add(g.behavior);
    if (etats.length === 2) break;
  }
  assert.deepEqual(etats, ["patrol", "post"]);
  assert.ok(comportements.has("path") && comportements.has("arrive"));
  assert.ok(g.pos.dist(g.post) < env.mPx(3), "revenu à son poste");
});

test("après 8h55, ceux qui marchent encore pressent le pas (marche, groupe, formation)", () => {
  const m = monde();
  const b = m.campus.workplaces[0];
  const e = m.foule.add({ x: b.door.x + m.mPx(60), y: b.door.y, building: b, state: "walk", origin: "tram" });
  e.planWalkTo(m.foule.context());
  e.chooseForces(m.foule.context());
  const avant = e.maxSpeed;
  assert.ok(Math.abs(avant - e.config.walkSpeed) < 1e-9);
  m.foule.goToWork();
  e.chooseForces(m.foule.context());
  assert.ok(Math.abs(e.maxSpeed - avant * e.config.hurryFactor) < 1e-9);
  assert.ok(e.maxSpeed < e.config.runSpeed, "on presse le pas sans courir");
});
