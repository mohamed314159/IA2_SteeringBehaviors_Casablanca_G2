// Construction du monde à partir des données OSM (data/casanearshore.js) :
// bâtiments du parc, portes d'entrée, réseau routier, entrées de la carte.
// Fonctions de scène : aucune formule de steering ici.

const CAMPUS_CONFIG = {
  // Barrières OSM : l'entrée nord est à sens unique (extérieur → parc),
  // sa voisine 5688433270 sert à la sortie ; la porte sud est à double sens.
  gates: {
    nord: { osmId: 5688433271, label: "Porte nord" },
    sud: { osmId: 5673669986, label: "Porte sud" }
  },
  exitGateOsmId: 5688433270,
  // Routes par lesquelles une voiture peut entrer depuis le bord de la carte.
  entryRoadTypes: ["trunk", "trunk_link", "primary", "primary_link", "secondary", "tertiary", "residential", "unclassified"],
  borderMargin: 25,      // px : distance au bord pour être une entrée
  laneOffsetM: 1.6,      // m : décalage à droite du milieu de la chaussée
  doorSetbackM: 3,       // m : recul de la porte devant la façade
  pathRadiusM: 2         // m : demi-largeur de voie pour follow(path)
};

function createCampus(data, config = CAMPUS_CONFIG) {
  const proj = data.projection;
  const site = data.site.map(([x, y]) => createVector(x, y));
  const network = new RoadNetwork(data.roads);
  const insideSite = n => pointInPolygon(createVector(n.x, n.y), site);

  const buildings = [];
  let numero = 1;
  const parcBatiments = data.buildings.filter(b => b.inSite)
    .sort((a, b) => polygonCentroidXY(a.points).y - polygonCentroidXY(b.points).y);
  for (const b of parcBatiments) {
    const nom = b.name || `Shore ${numero++}`;
    buildings.push(new Building(b.id, b.points, nom));
  }
  placeDoors(buildings, network, insideSite, metres(config.doorSetbackM, proj));

  const gates = {};
  for (const [cle, g] of Object.entries(config.gates)) {
    const n = network.nodes.get(g.osmId);
    gates[cle] = { key: cle, osmId: g.osmId, label: g.label, pos: createVector(n.x, n.y) };
  }

  // Entrées de la carte et porte la plus proche par la route publique
  // (sans traverser le parc : on n'y entre que par une porte).
  const horsParc = n => !insideSite(n);
  const entries = [];
  const vues = new Set();
  for (const gate of Object.values(gates)) {
    for (const n of network.borderEntries(data.width, data.height, config.borderMargin, config.entryRoadTypes, gate.osmId)) {
      if (vues.has(n.id)) continue;
      vues.add(n.id);
      let meilleure = null;
      let record = Infinity;
      for (const g of Object.values(gates)) {
        const route = network.shortestPath(n.id, g.osmId, horsParc);
        if (!route) continue;
        const l = network.routeLength(route);
        if (l < record) {
          record = l;
          meilleure = g.key;
        }
      }
      if (meilleure) entries.push({ nodeId: n.id, pos: createVector(n.x, n.y), gate: meilleure, routeLength: record });
    }
  }

  // Réseau piéton : routes (dans les deux sens) et chemins piétons OSM.
  const pedestrianNetwork = new RoadNetwork([
    ...data.roads.map(r => ({ ...r, oneway: false })),
    ...data.footways.map(f => ({ ...f, oneway: false, service: "" }))
  ]);

  return {
    data, proj, config, site, network, pedestrianNetwork, insideSite, buildings, gates, entries,
    background: data.buildings.filter(b => !b.inSite),
    parkings: data.parkings.filter(p => p.inSite)
  };
}

function polygonCentroidXY(points) {
  let x = 0;
  let y = 0;
  for (const [px, py] of points) {
    x += px;
    y += py;
  }
  return { x: x / points.length, y: y / points.length };
}

// Chaque porte fait face au sommet de route le plus proche, dans le parc.
function placeDoors(buildings, network, insideSite, recul) {
  const sommets = [...network.nodes.values()].filter(insideSite);
  for (const b of buildings) {
    let meilleur = null;
    let record = Infinity;
    for (const n of sommets) {
      const p = createVector(n.x, n.y);
      if (b.contains(p)) continue;
      const d = p5.Vector.dist(b.closestPoint(p), p);
      if (d < record) {
        record = d;
        meilleur = p;
      }
    }
    if (meilleur) b.placeDoor(meilleur, recul);
  }
}

// Itinéraire d'un piéton entre deux points (sélection d'action) : du sommet
// piéton le plus proche du départ à celui le plus proche de l'arrivée, puis
// l'arrivée elle-même. Retourne une liste de points (départ exclu).
function planWalk(campus, depart, arrivee, dansLeParc = false) {
  const net = campus.pedestrianNetwork;
  const filtre = dansLeParc ? n => campus.insideSite(n) : () => true;
  const a = net.nearestNode(depart, filtre);
  const b = net.nearestNode(arrivee, filtre);
  const ids = a && b ? net.shortestPath(a.id, b.id, dansLeParc ? campus.insideSite : () => true) : null;
  // On marche sur le trottoir : 3,5 m à droite de l'axe de la route.
  const points = ids ? simplifyPolyline(offsetPolylineRight(net.points(ids), mPx(3.5)), mPx(2)) : [];
  // On saute le premier sommet s'il est derrière nous (plus loin de l'arrivée que le départ).
  if (points.length > 1 && Math.hypot(points[1].x - depart.x, points[1].y - depart.y) < Math.hypot(points[0].x - depart.x, points[0].y - depart.y)) points.shift();
  // Idem pour le dernier sommet s'il dépasse l'arrivée.
  if (points.length > 1) {
    const n = points.length;
    if (Math.hypot(points[n - 2].x - arrivee.x, points[n - 2].y - arrivee.y) < Math.hypot(points[n - 1].x - arrivee.x, points[n - 1].y - arrivee.y)) points.pop();
  }
  return [...points.map(p => createVector(p.x, p.y)), arrivee.copy()];
}

// Itinéraire d'une voiture : entrée de la carte → porte (routes publiques),
// puis porte → sommet de destination en restant dans le parc.
// Retourne { outside, inside } en points décalés à droite, ou null.
function planCarRoute(campus, entryNodeId, gateKey, destinationNodeId) {
  const net = campus.network;
  const porte = campus.gates[gateKey].osmId;
  const dehors = net.shortestPath(entryNodeId, porte, n => !campus.insideSite(n));
  const dedans = net.shortestPath(porte, destinationNodeId, campus.insideSite);
  if (!dehors || !dedans) return null;
  const decalage = metres(campus.config.laneOffsetM, campus.proj);
  const pas = metres(1, campus.proj);
  return {
    outside: simplifyPolyline(offsetPolylineRight(net.points(dehors), decalage), pas),
    inside: simplifyPolyline(offsetPolylineRight(net.points(dedans), decalage), pas),
    nodes: { outside: dehors, inside: dedans }
  };
}
