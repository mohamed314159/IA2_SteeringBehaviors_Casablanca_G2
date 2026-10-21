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

  // Bâtiments : contours OSM nommés d'après le plan réel (data/reel.js),
  // plus les bâtiments absents d'OSM relevés sur l'imagerie.
  const reel = typeof CASANEARSHORE_REEL !== "undefined" ? CASANEARSHORE_REEL : null;
  const versXY = ([lon, lat]) => {
    const p = projectLatLon(lat, lon, proj);
    return [p.x, p.y];
  };
  const buildings = [];
  for (const b of data.buildings.filter(x => x.inSite)) {
    const nom = (reel && reel.noms[b.id]) || b.name || "Bâtiment";
    const bat = new Building(b.id, b.points, nom);
    bat.usage = (reel && reel.usages[nom]) || "bureaux";
    bat.roof = reel && reel.toitsSolaires.includes(b.id) ? "solaire" : nom === "Shore 12" ? "patios" : "plat";
    buildings.push(bat);
  }
  for (const a of reel ? reel.ajouts : []) {
    const bat = new Building(`ajout-${a.nom}`, a.points.map(versXY), a.nom);
    bat.roof = a.toit;
    bat.usage = a.toit === "chantier" ? "chantier" : "bureaux";
    buildings.push(bat);
  }
  // Restaurant d'entreprise (point OSM) : petit pavillon de 16 × 10 m.
  if (reel && reel.restaurant) {
    const [x, y] = versXY(reel.restaurant.point);
    const dx = mPx(8);
    const dy = mPx(5);
    const resto = new Building("restaurant", [[x - dx, y - dy], [x + dx, y - dy], [x + dx, y + dy], [x - dx, y + dy]], reel.restaurant.nom);
    resto.usage = "restaurant";
    resto.roof = "plat";
    buildings.push(resto);
  }
  // Un nom porté par plusieurs contours (Shore 8, Shore 9…) n'est écrit qu'une fois.
  const parNom = new Map();
  for (const b of buildings) {
    const autre = parNom.get(b.name);
    if (!autre || b.area > autre.area) parNom.set(b.name, b);
  }
  for (const b of buildings) b.labelHidden = parNom.get(b.name) !== b;
  placeDoors(buildings, network, insideSite, metres(config.doorSetbackM, proj));
  // Lieux de travail : tous les bâtiments sauf le chantier et le restaurant.
  const workplaces = buildings.filter(b => b.usage !== "chantier" && b.usage !== "restaurant");

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

  // Réseau piéton : routes (dans les deux sens) et chemins piétons OSM, sans
  // les voies rapides (on ne longe pas une 2 × 2 voies à pied).
  const pedestrianNetwork = new RoadNetwork([
    ...data.roads.filter(r => !NO_PEDESTRIAN_TYPES.has(r.type)).map(r => ({ ...r, oneway: false })),
    ...data.footways.map(f => ({ ...f, oneway: false, service: "" }))
  ]);
  // Sommets d'où l'on peut aller partout à pied (plus grande composante).
  const walkableNodes = pedestrianNetwork.largestComponent();

  return {
    data, proj, config, site, network, pedestrianNetwork, walkableNodes, insideSite, buildings, workplaces, gates, entries,
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

// Largeur de chaussée (m) par type de route OSM (partagée avec le rendu).
const ROAD_WIDTH_M = {
  trunk: 16, trunk_link: 8, primary: 13, primary_link: 8, secondary: 11, tertiary: 9,
  unclassified: 7, residential: 7, living_street: 6, service: 6.5
};
// Le piéton marche sur le trottoir, à SIDEWALK_GAP_M m du bord de la chaussée.
const SIDEWALK_GAP_M = 1.6;
const SIDEWALK_WIDTH_M = 3;
const FOOT_TYPES = new Set(["footway", "pedestrian", "path", "steps"]);
const NO_PEDESTRIAN_TYPES = new Set(["motorway", "motorway_link", "trunk", "trunk_link"]);

// Décalage du trottoir (px) pour le tronçon a → b : nul sur un chemin piéton.
function sidewalkOffset(net, a, b) {
  const e = net.nodes.get(a).edges.find(x => x.to === b);
  if (!e || FOOT_TYPES.has(e.type)) return 0;
  return mPx((ROAD_WIDTH_M[e.type] ?? 5) / 2 + SIDEWALK_GAP_M);
}

// Décale chaque segment vers la droite de sa propre distance ; aux sommets,
// on prend la moyenne des deux segments voisins.
function offsetPolylineVariable(points, decalages) {
  const n = points.length;
  if (n < 2) return points.map(p => ({ x: p.x, y: p.y }));
  const normales = [];
  for (let i = 0; i + 1 < n; i++) {
    const l = Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y) || 1;
    normales.push({ x: -(points[i + 1].y - points[i].y) / l, y: (points[i + 1].x - points[i].x) / l });
  }
  return points.map((p, i) => {
    const avant = i > 0 ? { n: normales[i - 1], d: decalages[i - 1] } : null;
    const apres = i < n - 1 ? { n: normales[i], d: decalages[i] } : null;
    const morceaux = [avant, apres].filter(Boolean);
    const dx = morceaux.reduce((s, m) => s + m.n.x * m.d, 0) / morceaux.length;
    const dy = morceaux.reduce((s, m) => s + m.n.y * m.d, 0) / morceaux.length;
    return { x: p.x + dx, y: p.y + dy };
  });
}

// Vrai si le segment [a, b] ne traverse aucun bâtiment (échantillonné tous les mètres).
function segmentIsClear(buildings, a, b) {
  const pa = createVector(a.x, a.y);
  const pb = createVector(b.x, b.y);
  const proches = buildings.filter(x => p5.Vector.dist(closestPointOnSegment(x.center, pa, pb), x.center) <= x.r);
  if (proches.length === 0) return true;
  const l = p5.Vector.dist(pa, pb);
  for (let t = 0; t <= l; t += mPx(1)) {
    const p = p5.Vector.lerp(pa, pb, l > 0 ? t / l : 0);
    if (proches.some(x => x.contains(p))) return false;
  }
  return true;
}

// Sommet piéton le plus proche de `point` que l'on rejoint en ligne droite
// sans traverser de bâtiment (parmi les 12 plus proches ; à défaut, le plus proche).
function nearestVisibleNode(campus, point, filtre) {
  const candidats = [...campus.pedestrianNetwork.nodes.values()].filter(filtre)
    .map(n => ({ n, d: Math.hypot(n.x - point.x, n.y - point.y) }))
    .sort((u, v) => u.d - v.d)
    .slice(0, 12);
  const visible = candidats.find(c => segmentIsClear(campus.buildings, c.n, point));
  return (visible ?? candidats[0] ?? { n: null }).n;
}

// Un trottoir qui tomberait dans un bâtiment (route collée à une façade) est
// ramené vers l'axe de la chaussée.
function keepOutOfBuildings(buildings, axe, decale) {
  for (const k of [1, 0.6, 0.3, 0]) {
    const p = createVector(axe.x + (decale.x - axe.x) * k, axe.y + (decale.y - axe.y) * k);
    if (!buildings.some(b => b.contains(p))) return { x: p.x, y: p.y };
  }
  return decale;
}

// Itinéraire d'un piéton entre deux points (sélection d'action) : du sommet
// piéton visible le plus proche du départ à celui de l'arrivée, puis
// l'arrivée elle-même. Retourne une liste de points (départ exclu).
function planWalk(campus, depart, arrivee, dansLeParc = false) {
  const net = campus.pedestrianNetwork;
  const batiments = campus.buildings;
  const filtre = n => campus.walkableNodes.has(n.id) && (!dansLeParc || campus.insideSite(n));
  const a = nearestVisibleNode(campus, depart, filtre);
  const b = nearestVisibleNode(campus, arrivee, filtre);
  const ids = a && b ? net.shortestPath(a.id, b.id, dansLeParc ? campus.insideSite : () => true) : null;
  // On marche sur les trottoirs (à droite de la chaussée) et les chemins piétons.
  const axes = ids ? net.points(ids) : [];
  const decalages = ids ? ids.slice(1).map((id, i) => sidewalkOffset(net, ids[i], id)) : [];
  const trottoir = offsetPolylineVariable(axes, decalages).map((p, i) => keepOutOfBuildings(batiments, axes[i], p));
  // Un tronçon de trottoir qui écorne un bâtiment est rapproché de la chaussée.
  for (let i = 0; i + 1 < trottoir.length; i++) {
    for (const k of [0.6, 0.3, 0]) {
      if (segmentIsClear(batiments, trottoir[i], trottoir[i + 1])) break;
      for (const j of [i, i + 1]) trottoir[j] = { x: axes[j].x + (trottoir[j].x - axes[j].x) * k, y: axes[j].y + (trottoir[j].y - axes[j].y) * k };
    }
  }
  const points = simplifyPolyline(trottoir, mPx(1));
  // Premier et dernier tronçons à pied : en ligne droite depuis le départ et
  // jusqu'à l'arrivée ; s'ils traversent un bâtiment, on passe par le sommet
  // lui-même (visible par construction).
  if (points.length && !segmentIsClear(batiments, depart, points[0])) points.unshift({ x: axes[0].x, y: axes[0].y });
  if (points.length && !segmentIsClear(batiments, points.at(-1), arrivee)) points.push({ x: axes.at(-1).x, y: axes.at(-1).y });
  // On saute le premier sommet s'il est derrière nous (plus loin de l'arrivée
  // que le départ), si la ligne droite vers le suivant reste dehors.
  if (points.length > 1 && Math.hypot(points[1].x - depart.x, points[1].y - depart.y) < Math.hypot(points[0].x - depart.x, points[0].y - depart.y) &&
    segmentIsClear(batiments, depart, points[1])) points.shift();
  // Idem pour le dernier sommet s'il dépasse l'arrivée.
  if (points.length > 1) {
    const n = points.length;
    if (Math.hypot(points[n - 2].x - arrivee.x, points[n - 2].y - arrivee.y) < Math.hypot(points[n - 1].x - arrivee.x, points[n - 1].y - arrivee.y) &&
      segmentIsClear(batiments, points[n - 2], arrivee)) points.pop();
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
