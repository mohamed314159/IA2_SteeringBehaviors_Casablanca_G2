// Étape 3 : projection, données OSM, réseau routier, bâtiments, caméra.
import assert from "node:assert/strict";
import test from "node:test";
import { chargerExemple, Vector } from "./adaptateur-p5.mjs";
import { FICHIERS_SIMULATION } from "./fichiers.mjs";

const FICHIERS = [...FICHIERS_SIMULATION, "camera.js"];
const NOMS = ["CASANEARSHORE", "CASANEARSHORE_REEL", "RoadNetwork", "Building", "Vehicle", "Camera", "createCampus", "planCarRoute",
  "createProjection", "projectLatLon", "unprojectXY", "offsetPolylineRight", "CAMPUS_CONFIG", "MinHeap", "polygonCentroid"];

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

test("données : parc, 29 bâtiments OSM + relevés, parkings, Busway et portes réelles", () => {
  const { CASANEARSHORE: D, CASANEARSHORE_REEL: R, campus } = monde();
  assert.ok(D.source.includes("OpenStreetMap"));
  assert.equal(D.buildings.filter(b => b.inSite).length, 29);
  // + bâtiments absents d'OSM relevés sur l'imagerie, + le restaurant
  assert.equal(campus.buildings.length, 29 + R.ajouts.length + 1);
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
});

test("plan réel : Shores 1 à 28 nommés, UIR presque au milieu, restaurant ; chaque nom écrit une fois", () => {
  const { campus, polygonCentroid } = monde();
  const noms = new Set(campus.buildings.map(b => b.name));
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 26, 27, 28]) {
    assert.ok(noms.has(`Shore ${n}`), `Shore ${n}`);
  }
  assert.ok(noms.has("UIR (Shore 13)") && noms.has("Ibis") && noms.has("Shore 25 (chantier)"));
  // L'UIR est près du centre du parc (moins de 20 % de la diagonale).
  const xs = campus.site.map(p => p.x);
  const ys = campus.site.map(p => p.y);
  const diagonale = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const uir = campus.buildings.find(b => b.name === "UIR (Shore 13)");
  assert.ok(uir.center.dist(polygonCentroid(campus.site)) < 0.2 * diagonale);
  assert.equal(uir.usage, "universite");
  assert.equal(campus.buildings.filter(b => b.usage === "restaurant").length, 1);
  // Lieux de travail : ni le chantier ni le restaurant.
  assert.ok(campus.workplaces.every(b => b.usage !== "chantier" && b.usage !== "restaurant"));
  assert.equal(campus.workplaces.length, campus.buildings.length - 2);
  // Un nom porté par plusieurs contours (Shore 8, Shore 9…) n'est écrit qu'une fois.
  for (const nom of noms) assert.equal(campus.buildings.filter(b => b.name === nom && !b.labelHidden).length, 1, nom);
  // Toitures : solaires d'après l'imagerie, patios pour Shore 12, courbe pour Shore 2.
  assert.equal(campus.buildings.find(b => b.name === "Shore 12").roof, "patios");
  assert.equal(campus.buildings.find(b => b.name === "Shore 2").roof, "courbe");
  assert.ok(campus.buildings.filter(b => b.roof === "solaire").length >= 8);
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

test("réseau : plus grande composante connexe ; le réseau piéton relie portes, station et bâtiments", () => {
  const { RoadNetwork, campus } = monde();
  const net = new RoadNetwork([
    { type: "residential", oneway: false, nodes: [1, 2, 3], points: [[0, 0], [10, 0], [20, 0]] },
    { type: "service", oneway: true, nodes: [3, 4], points: [[20, 0], [30, 0]] },
    { type: "footway", oneway: false, nodes: [7, 8], points: [[100, 0], [110, 0]] }
  ]);
  assert.deepEqual([...net.largestComponent()].sort(), [1, 2, 3, 4], "le sens unique compte dans les deux sens pour la connexité");
  // Le réseau piéton n'emprunte pas la voie rapide.
  for (const n of campus.pedestrianNetwork.nodes.values()) {
    assert.ok(!n.types.has("trunk") || [...n.types].some(t => t !== "trunk" && t !== "trunk_link"), "pas de sommet seulement sur la voie rapide");
  }
  assert.ok(campus.walkableNodes.size > 0.9 * campus.pedestrianNetwork.nodes.size);
});

test("bâtiments relevés sur l'imagerie : aucune route ni chemin OSM ne les traverse (seules les rampes y aboutissent)", () => {
  const { campus, CASANEARSHORE_REEL: R } = monde();
  const releves = campus.buildings.filter(b => String(b.id).startsWith("ajout-"));
  assert.equal(releves.length, R.ajouts.length);
  const voies = [...campus.data.roads, ...campus.data.footways.map(f => ({ ...f, type: "footway" }))];
  for (const b of releves) {
    let dedans = 0;
    let chemins = 0;
    for (const r of voies) {
      for (let i = 0; i + 1 < r.points.length; i++) {
        const [ax, ay] = r.points[i];
        const [bx, by] = r.points[i + 1];
        const l = Math.hypot(bx - ax, by - ay);
        for (let t = 0; t <= l; t += 2) {
          if (!b.contains(new Vector(ax + ((bx - ax) * t) / l, ay + ((by - ay) * t) / l))) continue;
          dedans++;
          if (r.type === "footway") chemins++;
        }
      }
    }
    assert.equal(chemins, 0, `aucun chemin piéton dans ${b.name}`);
    assert.ok(dedans <= 5, `${b.name} : ${dedans} m de route à l'intérieur (au plus le bout d'une rampe)`);
  }
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
