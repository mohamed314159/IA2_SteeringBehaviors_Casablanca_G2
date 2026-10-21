// Étapes 7-8 : tram à deux caisses et convoi G4S (leader following).
import assert from "node:assert/strict";
import test from "node:test";
import { chargerExemple, Vector } from "./adaptateur-p5.mjs";
import { FICHIERS_SIMULATION } from "./fichiers.mjs";

const NOMS = ["CASANEARSHORE", "createCampus", "createParkingWorld", "TrafficManager", "TransitManager", "Tram", "TramCar",
  "G4SVehicle", "G4S_CONFIG", "RoadVehicle", "SteeringAgent", "Vehicle", "createRng", "chainPolylines", "pointBehindOnLoop",
  "Path", "kmh", "mPx"];

function monde() {
  const env = chargerExemple(FICHIERS_SIMULATION, { noms: NOMS });
  const campus = env.createCampus(env.CASANEARSHORE);
  const world = env.createParkingWorld(campus);
  const trafic = new env.TrafficManager(campus, world, env.createRng(3));
  const transports = new env.TransitManager(campus, world, trafic, env.createRng(4));
  return { ...env, campus, world, trafic, transports };
}

test("voie du tram : tronçons OSM assemblés en un tracé continu, quai près de la station", () => {
  const { transports, campus } = monde();
  for (const sens of ["est", "ouest"]) {
    const ligne = transports.lines[sens];
    assert.ok(ligne.points.length > 20);
    // continuité : aucun saut de plus de 300 m
    for (let i = 1; i < ligne.points.length; i++) {
      assert.ok(Math.hypot(ligne.points[i].x - ligne.points[i - 1].x, ligne.points[i].y - ligne.points[i - 1].y) < 600);
    }
    // le tracé traverse la carte d'un bord à l'autre
    const xs = ligne.points.map(p => p.x);
    assert.ok(Math.min(...xs) < 50 && Math.max(...xs) > campus.data.width - 50);
    assert.ok(ligne.station.dist(transports.stationCenter) < 120, "quai à moins de 60 m de l'arrêt OSM");
  }
});

test("chainPolylines : relie les tronçons dans l'ordre", () => {
  const { chainPolylines } = monde();
  const r = chainPolylines([{ points: [[10, 0], [20, 0]] }, { points: [[0, 0], [10, 0]] }, { points: [[20, 0], [30, 5]] }]);
  assert.deepEqual([...r].map(p => [p.x, p.y]), [[0, 0], [10, 0], [20, 0], [30, 5]]);
});

test("tram : deux caisses de 32 m (65 m), la seconde suit la tête (snake), arrêt au quai sans dépassement", () => {
  const { transports, Tram, TramCar, SteeringAgent, mPx } = monde();
  let portes = 0;
  transports.onTramDoorsOpen = () => portes++;
  const tram = transports.spawnTram("ouest");
  assert.ok(tram instanceof Tram && tram instanceof SteeringAgent);
  assert.ok(tram.trailer instanceof TramCar && tram.trailer instanceof SteeringAgent);
  assert.equal(tram.cars().length, 2);
  assert.equal(tram.length, mPx(32));
  assert.equal(tram.trailer.length, mPx(32));
  // Régression : l'arrive de la base exige un rayon de freinage plus grand
  // que la distance d'arrêt (sinon la seconde caisse fonce sur la tête).
  assert.ok(tram.trailer.spacing() > mPx(20), "espacement plus grand que l'ancien rayon fixe");
  const station = transports.lines.ouest.station;
  const etats = [];
  let ecartMin = Infinity;
  let ecartMax = 0;
  let depassement = 0;
  let portesAvantArret = false;
  for (let pas = 0; pas < 3000 && tram.state !== "gone"; pas++) {
    transports.step();
    if (etats.at(-1) !== tram.state) etats.push(tram.state);
    const e = tram.pos.dist(tram.trailer.pos);
    ecartMin = Math.min(ecartMin, e);
    ecartMax = Math.max(ecartMax, e);
    if (tram.state === "arriving") depassement = Math.max(depassement, tram.pos.copy().sub(station).dot(tram.heading));
    if (tram.doorOpening > 0 && tram.state !== "dwell") portesAvantArret = true;
  }
  assert.ok(tram.trailer.rayonZoneDeFreinage > tram.trailer.spacing());
  assert.deepEqual(etats, ["approach", "arriving", "dwell", "departing", "gone"]);
  assert.ok(depassement <= tram.stopRadius, `dépassement du quai : ${depassement}`);
  assert.equal(portes, 1, "portes ouvertes une seule fois, à l'arrêt");
  assert.equal(portesAvantArret, false);
  const attendu = tram.trailer.spacing();
  assert.ok(ecartMin > attendu - 2 && ecartMax < attendu + 2, `écart ${ecartMin}–${ecartMax}, attendu ${attendu}`);
  assert.equal(transports.trams.length, 0, "tram retiré après avoir quitté la carte");
});

test("tram : à quai, 4 portes par caisse, toutes côté quai", () => {
  const { transports, mPx } = monde();
  let portes = null;
  transports.onTramDoorsOpen = t => {
    portes = t.doorPoints();
  };
  const tram = transports.spawnTram("est");
  for (let pas = 0; pas < 3000 && !portes; pas++) transports.step();
  assert.ok(portes, "les portes s'ouvrent à quai");
  assert.equal(portes.length, 8);
  for (const p of portes) {
    // chaque porte est du côté du quai par rapport à la caisse la plus proche
    const caisse = tram.cars().reduce((m, c) => (c.pos.dist(p) < m.pos.dist(p) ? c : m));
    assert.ok(p.copy().sub(caisse.pos).dot(tram.platformSide) > mPx(1));
  }
});

test("pointBehindOnLoop : remonte une boucle fermée, segment et direction corrects", () => {
  const { pointBehindOnLoop } = monde();
  const carre = [new Vector(0, 0), new Vector(100, 0), new Vector(100, 100), new Vector(0, 100)];
  const a = pointBehindOnLoop(carre, 0);
  assert.ok(a.pos.dist(new Vector(0, 0)) < 1e-9);
  // 30 px en arrière du premier point : sur le dernier côté (0,100) → (0,0)
  const b = pointBehindOnLoop(carre, 30);
  assert.ok(b.pos.dist(new Vector(0, 30)) < 1e-9);
  assert.equal(b.index, 3);
  assert.ok(b.dir.dist(new Vector(0, -1)) < 1e-9);
  const c = pointBehindOnLoop(carre, 130);
  assert.ok(c.pos.dist(new Vector(30, 100)) < 1e-9);
  assert.equal(c.index, 2);
});

test("convoi G4S : boucle fermée sans demi-tour, un leader et trois suiveurs en colonne", () => {
  const { transports, trafic, G4SVehicle, G4S_CONFIG, RoadVehicle, mPx } = monde();
  assert.equal(transports.patrolIsLoop, true, "aller et retour par des rues différentes");
  const pts = transports.patrolPoints;
  assert.ok(pts.length > 10);
  // Aucun demi-tour : deux segments successifs ne repartent jamais en arrière.
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const c = pts[(i + 2) % pts.length];
    const u = new Vector(b.x - a.x, b.y - a.y).normalize();
    const v = new Vector(c.x - b.x, c.y - b.y).normalize();
    assert.ok(u.dot(v) > -0.7, `demi-tour au point ${i + 1}`);
  }
  const convoi = transports.createConvoy();
  assert.equal(convoi.length, 4);
  assert.ok(convoi.every(v => v instanceof G4SVehicle && v instanceof RoadVehicle && trafic.cars.includes(v)));
  assert.equal(convoi[0].predecessor, null);
  assert.equal(convoi[0].state, "patrol");
  assert.equal(convoi[0].behavior, "path");
  for (let k = 1; k < 4; k++) {
    assert.equal(convoi[k].predecessor, convoi[k - 1]);
    assert.equal(convoi[k].behavior, "leader");
    // départ en colonne, à l'espacement de roulage
    const ecart = convoi[k].pos.dist(convoi[k - 1].pos);
    assert.ok(ecart <= mPx(4.9 + G4S_CONFIG.convoyGapM) + 1e-6, `écart de départ ${ecart}`);
  }
});

test("convoi G4S : dix minutes de ronde sans contact, les suiveurs restent derrière leur leader", () => {
  const { transports, trafic, mPx } = monde();
  const convoi = transports.createConvoy();
  const ecarts = [];
  let dansLaZone = 0;
  for (let pas = 0; pas < 3000; pas++) {
    trafic.step();
    for (let k = 1; k < 4; k++) {
      const v = convoi[k];
      ecarts.push(v.pos.dist(v.predecessor.pos));
      // zone interdite devant le leader (lue dans debugInfo, sans recalcul)
      if (v.behavior === "leader" && v.debugInfo.leader.dansLaZone) dansLaZone++;
    }
  }
  ecarts.sort((a, b) => a - b);
  assert.equal(trafic.collisions.total, 0);
  assert.ok(ecarts[Math.floor(ecarts.length / 2)] < mPx(20), `écart médian ${ecarts[Math.floor(ecarts.length / 2)] / 2} m : convoi serré`);
  assert.ok(ecarts.at(-1) < mPx(50), `écart maximal ${ecarts.at(-1) / 2} m (épingle au sud de la boucle)`);
  assert.equal(dansLaZone, 0, "jamais dans la zone devant son leader");
  assert.ok(convoi.every(v => v.state !== "gone"));
});

test("convoi G4S : un suiveur cède (file) à une voiture qui s'intercale devant lui", () => {
  const { transports, trafic, campus } = monde();
  const convoi = transports.createConvoy();
  for (let pas = 0; pas < 200; pas++) trafic.step();
  const suiveur = convoi[2];
  const guide = suiveur.predecessor;
  // Une voiture arrêtée entre le suiveur et son leader, sur sa route.
  const intrus = trafic.spawnCar({ entry: campus.entries[0] });
  intrus.pos = suiveur.pos.copy().add(suiveur.heading.copy().mult(suiveur.length * 1.6));
  intrus.heading = suiveur.heading.copy();
  intrus.vel = new Vector(0, 0);
  intrus.state = "inside";
  assert.ok(intrus.pos.dist(suiveur.pos) < guide.pos.dist(suiveur.pos), "l'intrus est plus près que le leader");
  suiveur.chooseForces(trafic.context(suiveur));
  assert.equal(suiveur.behavior, "file");
  assert.equal(suiveur.leaderAhead, intrus);
  // Sans intrus, il suit son leader.
  trafic.cars = trafic.cars.filter(c => c !== intrus);
  suiveur.chooseForces(trafic.context(suiveur));
  assert.equal(suiveur.behavior, "leader");
});

test("Path : abscisse curviligne et distance le long d'un chemin ouvert ou fermé", () => {
  const { Path } = monde();
  const carre = [new Vector(0, 0), new Vector(100, 0), new Vector(100, 100), new Vector(0, 100)];
  const boucle = new Path(carre, 5, true);
  assert.equal(boucle.length(), 400);
  assert.equal(boucle.positionAlong(0, new Vector(30, 2)), 30);
  assert.equal(boucle.positionAlong(2, new Vector(40, 100)), 260);
  assert.equal(boucle.positionAlong(3, new Vector(0, 10)), 390);
  assert.equal(boucle.distanceAlong(390, 30), 40, "on fait le tour de la boucle");
  assert.equal(boucle.distanceAlong(30, 260), 230);
  const ouvert = new Path(carre, 5, false);
  assert.equal(ouvert.distanceAlong(260, 30), 0, "chemin ouvert : jamais en arrière");
});
