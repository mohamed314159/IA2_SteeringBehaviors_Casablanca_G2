// Étapes 7-8 : navette G4S et tram à deux caisses.
import assert from "node:assert/strict";
import test from "node:test";
import { chargerExemple, Vector } from "./adaptateur-p5.mjs";

const FICHIERS = ["vehicle.js", "random.js", "simUnits.js", "geometry.js", "path.js", "collisions.js", "mapProjection.js",
  "data/casanearshore.js", "roadNetwork.js", "steeringAgent.js", "building.js", "campus.js", "parkingSpot.js",
  "parkingLot.js", "gate.js", "pillar.js", "garage.js", "parkingAllocator.js", "parkingWorld.js", "carModels.js",
  "roadVehicle.js", "luxuryCar.js", "shuttle.js", "tramCar.js", "tram.js", "traffic.js", "transit.js"];
const NOMS = ["CASANEARSHORE", "createCampus", "createParkingWorld", "TrafficManager", "TransitManager", "Tram", "TramCar",
  "Shuttle", "RoadVehicle", "SteeringAgent", "Vehicle", "createRng", "chainPolylines", "Path", "kmh", "mPx"];

function monde() {
  const env = chargerExemple(FICHIERS, { noms: NOMS });
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

test("tram : deux caisses de 16 m, la seconde suit la tête (snake), arrêt au quai sans dépassement", () => {
  const { transports, Tram, TramCar, SteeringAgent } = monde();
  let portes = 0;
  transports.onTramDoorsOpen = () => portes++;
  const tram = transports.spawnTram("ouest");
  assert.ok(tram instanceof Tram && tram instanceof SteeringAgent);
  assert.ok(tram.trailer instanceof TramCar && tram.trailer instanceof SteeringAgent);
  assert.equal(tram.cars().length, 2);
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
  assert.deepEqual(etats, ["approach", "arriving", "dwell", "departing", "gone"]);
  assert.ok(depassement <= tram.stopRadius, `dépassement du quai : ${depassement}`);
  assert.equal(portes, 1, "portes ouvertes une seule fois, à l'arrêt");
  assert.equal(portesAvantArret, false);
  const attendu = tram.trailer.spacing();
  assert.ok(ecartMin > attendu - 2 && ecartMax < attendu + 2, `écart ${ecartMin}–${ecartMax}, attendu ${attendu}`);
  assert.equal(transports.trams.length, 0, "tram retiré après avoir quitté la carte");
});

test("tram : les portes donnent côté quai, 4 portes au total", () => {
  const { transports } = monde();
  const tram = transports.spawnTram("est");
  const portes = tram.doorPoints();
  assert.equal(portes.length, 4);
  for (const p of portes) {
    const cote = p.copy().sub(tram.pos).dot(tram.platformSide);
    assert.ok(cote > 0 || p.copy().sub(tram.trailer.pos).dot(tram.platformSide) > 0);
  }
});

test("navette G4S : porte nord, arrêt au centre, portes à l'arrêt complet, sortie, sans collision", () => {
  const { transports, trafic, campus, Shuttle, RoadVehicle } = monde();
  let portes = 0;
  let vitesseALOuverture = null;
  transports.onShuttleDoorsOpen = s => {
    portes++;
    vitesseALOuverture = s.vel.mag();
  };
  const navette = transports.spawnShuttle(20);
  assert.ok(navette instanceof Shuttle && navette instanceof RoadVehicle);
  assert.equal(navette.length, 24, "12 m");
  // quelques voitures en même temps, sur d'autres entrées (règle d'apparition :
  // jamais sur une entrée encombrée)
  const autres = campus.entries.filter(e => trafic.entryIsClear(e));
  assert.equal(trafic.entryIsClear(transports.shuttleEntry), false, "l'entrée de la navette est occupée");
  for (let k = 0; k < 4; k++) trafic.spawnCar({ entry: autres[(k * 7 + 3) % autres.length] });
  const etats = [];
  for (let pas = 0; pas < 6000 && navette.state !== "gone"; pas++) {
    trafic.step();
    transports.step();
    if (etats.at(-1) !== navette.state) etats.push(navette.state);
  }
  assert.deepEqual(etats, ["approach", "gateStop", "inside", "busStop", "dwell", "leaving", "gone"]);
  assert.equal(portes, 1);
  assert.ok(vitesseALOuverture < 0.05);
  assert.equal(trafic.collisions.total, 0);
  assert.ok(!trafic.cars.includes(navette), "navette retirée à la sortie de la carte");
  assert.ok(campus.insideSite(transports.shuttleStopNode), "arrêt dans le parc");
});
