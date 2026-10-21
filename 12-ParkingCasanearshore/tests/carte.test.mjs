// Étape 3 : projection, données OSM, réseau routier, bâtiments, caméra.
import assert from "node:assert/strict";
import test from "node:test";
import { chargerExemple, Vector } from "./adaptateur-p5.mjs";

const FICHIERS = ["vehicle.js", "geometry.js", "path.js", "mapProjection.js", "data/casanearshore.js",
  "roadNetwork.js", "steeringAgent.js", "building.js", "campus.js", "camera.js"];
const NOMS = ["CASANEARSHORE", "RoadNetwork", "Building", "Vehicle", "Camera", "createCampus", "planCarRoute",
  "createProjection", "projectLatLon", "unprojectXY", "offsetPolylineRight", "CAMPUS_CONFIG", "MinHeap"];

let cache = null;
function monde() {
  if (!cache) {
    const env = chargerExemple(FICHIERS, { noms: NOMS });
    cache = { ...env, campus: env.createCampus(env.CASANEARSHORE) };
  }
  return cache;
}

test("projection : aller-retour exact et échelle respectée à 1 % près", () => {
  const { createProjection, projectLatLon, unprojectXY } = monde();
  const proj = createProjection(33.5195, -7.6480, 33.5320, -7.6320, 2);
  const p = projectLatLon(33.526, -7.640, proj);
  const retour = unprojectXY(p.x, p.y, proj);
  assert.ok(Math.abs(retour.lat - 33.526) < 1e-12 && Math.abs(retour.lon + 7.640) < 1e-12);
  // 0,001° de latitude ≈ 111,32 m ; à 2 px/m ≈ 222,6 px
  const a = projectLatLon(33.526, -7.640, proj);
  const b = projectLatLon(33.527, -7.640, proj);
  assert.ok(Math.abs(Math.hypot(b.x - a.x, b.y - a.y) - 222.64) / 222.64 < 0.01);
  // le nord est en haut (y plus petit)
  assert.ok(b.y < a.y);
});

test("données : parc, 29 bâtiments, parkings, Busway et portes réelles", () => {
  const { CASANEARSHORE: D, campus } = monde();
  assert.ok(D.source.includes("OpenStreetMap"));
  assert.equal(campus.buildings.length, 29);
  assert.ok(campus.parkings.length >= 3);
  assert.ok(D.busway.length > 0);
  assert.ok(D.stops.some(s => s.name === "Casa Nearshore"));
  for (const r of D.roads) {
    for (const [x, y] of r.points) assert.ok(x >= 0 && y >= 0 && x <= D.width && y <= D.height, "route dans le cadre");
    assert.equal(r.points.length, r.nodes.length);
  }
});

test("bâtiments : Vehicle immobiles, obstacles polygonaux, porte à l'extérieur", () => {
  const { campus, Building, Vehicle } = monde();
  for (const b of campus.buildings) {
    assert.ok(b instanceof Building && b instanceof Vehicle);
    assert.equal(b.maxSpeed, 0);
    assert.ok(b.contains(b.center) || b.area > 0);
    assert.equal(b.contains(b.door), false, `porte de ${b.name} à l'extérieur`);
    const surface = b.closestPoint(b.door);
    assert.ok(Math.abs(b.door.dist(surface) - 6) < 0.5, `recul de 3 m pour ${b.name}`);
  }
  const noms = new Set(campus.buildings.map(b => b.name));
  assert.equal(noms.size + campus.buildings.filter(b => b.name === "Capgemini").length - (noms.has("Capgemini") ? 1 : 0), 29);
});

test("réseau : la porte nord est une entrée à sens unique vers le parc", () => {
  const { campus } = monde();
  const net = campus.network;
  const nord = net.nodes.get(campus.gates.nord.osmId);
  assert.equal(nord.edges.length, 1);
  const suivant = net.nodes.get(nord.edges[0].to);
  assert.ok(campus.insideSite(suivant), "après la porte nord on est dans le parc");
});

test("réseau : chaque entrée de la carte atteint sa porte, chaque parking est accessible", () => {
  const { campus, planCarRoute } = monde();
  assert.ok(campus.entries.length >= 4);
  assert.ok(campus.entries.some(e => e.gate === "nord") && campus.entries.some(e => e.gate === "sud"));
  for (const p of campus.parkings) {
    const cx = p.points.reduce((s, q) => s + q[0], 0) / p.points.length;
    const cy = p.points.reduce((s, q) => s + q[1], 0) / p.points.length;
    const n = campus.network.nearestNode({ x: cx, y: cy }, campus.insideSite);
    for (const gate of ["nord", "sud"]) {
      const entree = campus.entries.find(e => e.gate === gate);
      const route = planCarRoute(campus, entree.nodeId, gate, n.id);
      assert.ok(route, `parking ${p.id} depuis la porte ${gate}`);
      // continuité : deux sommets successifs sont reliés par un tronçon de route
      for (const ids of [route.nodes.outside, route.nodes.inside]) {
        for (let i = 1; i < ids.length; i++) {
          assert.ok(campus.network.nodes.get(ids[i - 1]).edges.some(e => e.to === ids[i]), "tronçon existant");
        }
      }
      // les deux morceaux se rejoignent à la porte
      const jonction = Math.hypot(route.outside.at(-1).x - route.inside[0].x, route.outside.at(-1).y - route.inside[0].y);
      assert.ok(jonction < 10, `jonction à la porte : ${jonction}`);
      // le trajet intérieur reste dans le parc (sommets OSM)
      for (const id of route.nodes.inside.slice(1)) assert.ok(campus.insideSite(campus.network.nodes.get(id)));
    }
  }
});

test("réseau : Dijkstra trouve le plus court chemin et respecte le sens unique", () => {
  const { RoadNetwork } = monde();
  const net = new RoadNetwork([
    { type: "residential", oneway: false, nodes: [1, 2, 3], points: [[0, 0], [10, 0], [20, 0]] },
    { type: "residential", oneway: false, nodes: [1, 4, 3], points: [[0, 0], [10, 30], [20, 0]] },
    { type: "service", oneway: true, nodes: [3, 5], points: [[20, 0], [30, 0]] }
  ]);
  // les tableaux viennent du contexte vm : on les recopie avant de comparer
  assert.deepEqual([...net.shortestPath(1, 3)], [1, 2, 3]);
  assert.deepEqual([...net.shortestPath(3, 5)], [3, 5]);
  assert.equal(net.shortestPath(5, 3), null, "sens interdit");
  assert.deepEqual([...net.shortestPath(1, 3, n => n.id !== 2)], [1, 4, 3], "sommet interdit contourné");
});

test("offsetPolylineRight : décalage à droite du sens de marche", () => {
  const { offsetPolylineRight } = monde();
  // vers l'est (x croissant), la droite est vers le sud (y croissant)
  const d = offsetPolylineRight([{ x: 0, y: 0 }, { x: 100, y: 0 }], 5);
  assert.ok(Math.abs(d[0].y - 5) < 1e-9 && Math.abs(d[1].y - 5) < 1e-9);
});

test("caméra : conversions inverses, zoom autour du pointeur", () => {
  const { Camera } = monde();
  const c = new Camera(800, 600);
  c.focus(1000, 500, 2);
  const s = c.worldToScreen(1100, 450);
  const w = c.screenToWorld(s.x, s.y);
  assert.ok(Math.abs(w.x - 1100) < 1e-9 && Math.abs(w.y - 450) < 1e-9);
  const avant = c.screenToWorld(200, 100);
  c.zoomAt(200, 100, 1.5);
  const apres = c.screenToWorld(200, 100);
  assert.ok(Math.abs(avant.x - apres.x) < 1e-9 && Math.abs(avant.y - apres.y) < 1e-9);
  c.setZoom(1000);
  assert.equal(c.zoom, c.maxZoom);
  c.fit(0, 0, 1600, 600, 0);
  assert.equal(c.zoom, 0.5);
});
