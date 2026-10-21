// Étape 4 : places, parkings, attribution, portes à barrière, garage.
import assert from "node:assert/strict";
import test from "node:test";
import { chargerExemple, Vector } from "./adaptateur-p5.mjs";

const FICHIERS = ["vehicle.js", "geometry.js", "path.js", "collisions.js", "mapProjection.js", "data/casanearshore.js",
  "roadNetwork.js", "steeringAgent.js", "building.js", "campus.js", "parkingSpot.js", "parkingLot.js", "gate.js",
  "pillar.js", "garage.js", "parkingAllocator.js", "parkingWorld.js"];
const NOMS = ["CASANEARSHORE", "Vehicle", "ParkingSpot", "ParkingLot", "Gate", "Garage", "Pillar", "Building",
  "layoutParkingSpots", "assignSpot", "chooseSpot", "countSpots", "createCampus", "createParkingWorld", "planSpotRoute",
  "rectanglesSeTouchent", "pointInPolygon"];

function env() {
  return chargerExemple(FICHIERS, { noms: NOMS });
}

let cacheMonde = null;
function monde() {
  if (!cacheMonde) {
    const e = env();
    const campus = e.createCampus(e.CASANEARSHORE);
    cacheMonde = { ...e, campus, world: e.createParkingWorld(campus) };
  }
  return cacheMonde;
}

const rect = (x, y, w, h) => [new Vector(x, y), new Vector(x + w, y), new Vector(x + w, y + h), new Vector(x, y + h)];

test("découpage : rectangle de 30 × 17 m (16 m + marges) → 2 rangées de 11 places et une allée", () => {
  const { layoutParkingSpots } = env();
  // 2 px/m : 60 × 32 px ; marge 0,5 m de chaque côté
  const plan = layoutParkingSpots(rect(0, 0, 60, 34), 2);
  // 16 m sans les marges ne suffit pas : une seule rangée
  assert.equal(layoutParkingSpots(rect(0, 0, 60, 32), 2).spots.length, 11);
  assert.equal(plan.spots.length, 22);
  assert.equal(plan.aisles.length, 1);
});

test("découpage : places dans le polygone, sans chevauchement, point d'allée dans le polygone", () => {
  const { layoutParkingSpots, rectanglesSeTouchent, pointInPolygon } = env();
  // Parking en L (deux orientations)
  const L = [new Vector(0, 0), new Vector(200, 0), new Vector(200, 60), new Vector(60, 60), new Vector(60, 200), new Vector(0, 200)];
  const plan = layoutParkingSpots(L, 2);
  assert.ok(plan.spots.length > 40);
  const rects = plan.spots.map(s => ({ x: s.center.x, y: s.center.y, angle: s.angle, demiLongueur: 4.95, demiLargeur: 2.45 }));
  for (let i = 0; i < rects.length; i++) {
    assert.ok(pointInPolygon(plan.spots[i].center, L));
    assert.ok(pointInPolygon(plan.spots[i].aislePoint, L));
    for (let j = i + 1; j < rects.length; j++) assert.equal(rectanglesSeTouchent(rects[i], rects[j]), false, `places ${i} et ${j}`);
  }
});

test("place : réservation, occupation, libération ; pas de double réservation", () => {
  const { ParkingSpot, Vehicle } = env();
  const s = new ParkingSpot(10, 10, 0);
  assert.ok(s instanceof Vehicle);
  const a = { id: "a" };
  const b = { id: "b" };
  assert.equal(s.reserve(a), true);
  assert.equal(s.reserve(b), false);
  assert.equal(s.occupy(b), false, "seule la voiture qui a réservé peut occuper");
  assert.equal(s.occupy(a), true);
  assert.equal(s.state, "occupied");
  s.release();
  assert.equal(s.isFree(), true);
});

test("attribution : place la plus proche du bâtiment, unique, compatible", () => {
  const { ParkingLot, assignSpot, countSpots } = env();
  const lot = new ParkingLot(1, rect(0, 0, 60, 34), { pxPerMeter: 2 });
  lot.assignKind("pmr", 2, new Vector(0, 0));
  lot.assignKind("ev", 2, new Vector(60, 0));
  const porte = new Vector(60, 42);
  const voitures = Array.from({ length: 30 }, (_, i) => ({ id: i, kind: "standard", destinationDoor: porte }));
  const places = voitures.map(v => assignSpot([lot], null, v));
  const attribuees = places.filter(Boolean);
  assert.equal(attribuees.length, 18, "22 places dont 4 réservées ♿/⚡");
  assert.equal(new Set(attribuees).size, attribuees.length, "aucune place attribuée deux fois");
  assert.ok(attribuees.every(p => p.kind === "standard"));
  assert.equal(places[18], null, "parking complet pour les voitures standard");
  // la première place est la plus proche de la porte
  const libresAvant = lot.spots.filter(s => s.kind === "standard");
  const plusProche = libresAvant.reduce((m, s) => (s.pos.dist(porte) < m.pos.dist(porte) ? s : m));
  assert.equal(places[0], plusProche);
  // voiture électrique et PMR : leurs places dédiées restent disponibles
  const ve = assignSpot([lot], null, { kind: "ev", destinationDoor: porte });
  assert.equal(ve.kind, "ev");
  const pmr = assignSpot([lot], null, { kind: "pmr", destinationDoor: porte });
  assert.equal(pmr.kind, "pmr");
  const t = countSpots([lot]);
  assert.equal(t.reserved, 20);
  assert.equal(t.free, 2);
});

test("porte : ligne d'arrêt avant la barrière ; la barrière s'ouvre puis se referme", () => {
  const { Gate, Vehicle } = env();
  const g = new Gate("nord", "Porte nord", 100, 100, new Vector(0, 1), { pxPerMeter: 2, laneOffset: 3 });
  assert.ok(g instanceof Vehicle);
  // arrivée vers le sud : la ligne d'arrêt est 8 px au nord, décalée à droite (ouest)
  assert.ok(Math.abs(g.stopLine.y - 92) < 1e-9);
  assert.ok(Math.abs(g.stopLine.x - 97) < 1e-9);
  let pas = 0;
  while (!g.isOpen() && pas < 100) {
    g.requestOpen();
    g.tick([]);
    pas++;
  }
  assert.equal(g.isOpen(), true);
  assert.equal(pas, Math.ceil(1 / g.openSpeed));
  // une voiture sous la barrière la garde ouverte
  g.tick([{ pos: new Vector(100, 101) }]);
  assert.equal(g.isOpen(), true);
  for (let i = 0; i < 100; i++) g.tick([]);
  assert.equal(g.opening, 0);
});

test("garage : places, poteaux hors des places, itinéraire depuis la rampe", () => {
  const { world, Pillar, rectanglesSeTouchent } = monde();
  const garage = world.garage;
  assert.ok(garage.lot.capacity() > 100);
  assert.ok(garage.pillars.length > 10 && garage.pillars.every(p => p instanceof Pillar));
  // Un poteau peut toucher le bord arrière d'une place (comme dans un vrai
  // sous-sol) mais pas l'emprise d'une voiture garée (4,7 × 1,9 m, centrée).
  for (const p of garage.pillars) {
    const r = { x: p.pos.x, y: p.pos.y, angle: 0, demiLongueur: p.r, demiLargeur: p.r };
    for (const s of garage.lot.spots) {
      const voiture = { x: s.pos.x, y: s.pos.y, angle: s.angle, demiLongueur: 4.7, demiLargeur: 1.9 };
      assert.equal(rectanglesSeTouchent(r, voiture), false, "poteau sur une voiture garée");
    }
  }
  assert.ok(garage.lot.spots.every(s => s.level === -1));
  const s = garage.lot.spots[40];
  const route = garage.routeToSpot(s);
  assert.ok(route[0].equals(garage.rampTop));
  assert.ok(route.at(-1).equals(s.aislePoint));
  assert.ok(garage.rampSpeedFactor() < 1 && garage.rampSpeedFactor() > 0);
  assert.equal(garage.isOnRamp(garage.rampTop.copy().add(0, 5)), true);
  assert.equal(garage.isOnRamp(s.pos), false);
});

test("monde : chaque place de surface et du garage est accessible depuis les deux portes", () => {
  const { campus, world, planSpotRoute } = monde();
  assert.ok(world.lots.length >= 3);
  for (const lot of world.allLots) {
    for (const s of lot.spots) {
      for (const porte of ["nord", "sud"]) {
        const r = planSpotRoute(campus, world, porte, s);
        assert.ok(r, `place ${s.number} de ${lot.name} depuis ${porte}`);
        assert.equal(r.level, s.level);
      }
    }
  }
});

test("monde : places ♿ près d'un bâtiment, ⚡ présentes, portes sur les barrières OSM", () => {
  const { campus, world } = monde();
  for (const lot of world.lots) {
    assert.ok(lot.spots.some(s => s.kind === "pmr"));
    assert.ok(lot.spots.some(s => s.kind === "ev"));
  }
  assert.equal(world.gates.nord.pos.x, campus.network.nodes.get(5688433271).x);
  assert.equal(world.gates.sud.pos.y, campus.network.nodes.get(5673669986).y);
  // l'entrée nord arrive du nord (vers le sud)
  assert.ok(world.gates.nord.approach.y > 0.9);
  assert.ok(world.gates.sud.approach.y < -0.9);
});
