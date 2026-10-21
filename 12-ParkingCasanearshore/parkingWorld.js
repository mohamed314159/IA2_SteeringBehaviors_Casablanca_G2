// Assemblage des parkings de la scène : parkings de surface (polygones OSM),
// garage souterrain, portes à barrière, et itinéraire jusqu'à une place.
// Fonctions de scène (sélection d'action) : aucune formule de steering ici.

const PARKING_WORLD_CONFIG = {
  pmrPerLot: 4,
  evPerLot: 6,
  // Plans des garages, empilés à droite de la carte.
  garageOrigin: { dx: 300, y: 300 },
  regroupementM: 60 // entrées souterraines à moins de 60 m : même garage
};

function createParkingWorld(campus, config = PARKING_WORLD_CONFIG) {
  const pxm = campus.proj.pxPerMeter;
  const lots = campus.parkings.map((p, i) => new ParkingLot(p.id, p.points, { pxPerMeter: pxm, name: `Parking ${String.fromCharCode(65 + i)}` }));
  // Sommets d'accès : routes du parc hors des parkings découpés (les allées
  // OSM à l'intérieur sont remplacées par les allées du découpage).
  const sommetsParc = [...campus.network.nodes.values()].filter(n => campus.insideSite(n) &&
    !n.services.has("parking_aisle") && !lots.some(l => pointInPolygon(createVector(n.x, n.y), l.points)));

  for (const lot of lots) {
    // Accès de chaque allée : sommet routier du parc le plus proche d'une de ses extrémités.
    for (const allee of lot.aisles.values()) {
      let record = Infinity;
      let acces = null;
      for (const bout of [allee.a, allee.b]) {
        for (const n of sommetsParc) {
          const d = Math.hypot(n.x - bout.x, n.y - bout.y);
          if (d < record) {
            record = d;
            acces = { nodeId: n.id, end: bout.copy() };
          }
        }
      }
      lot.access.set(allee.key, acces);
    }
    // Places ♿ au plus près du bâtiment voisin, ⚡ près de l'accès principal.
    const centre = polygonCentroid(lot.points);
    const voisin = nearestBuilding(campus.buildings, centre);
    if (voisin) lot.assignKind("pmr", config.pmrPerLot, voisin.door);
    const premierAcces = [...lot.access.values()][0];
    if (premierAcces) lot.assignKind("ev", config.evPerLot, premierAcces.end);
  }

  const garages = createGarages(campus, sommetsParc, config);

  // Portes : direction d'arrivée = depuis le sommet extérieur qui y mène.
  const gates = {};
  for (const g of Object.values(campus.gates)) {
    const sommet = campus.network.nodes.get(g.osmId);
    const avant = [...campus.network.nodes.values()].find(n => !campus.insideSite(n) && n.edges.some(e => e.to === g.osmId));
    const direction = avant ? createVector(sommet.x - avant.x, sommet.y - avant.y) : createVector(0, 1);
    gates[g.key] = new Gate(g.key, g.label, sommet.x, sommet.y, direction, { pxPerMeter: pxm, laneOffset: metres(campus.config.laneOffsetM, campus.proj) });
  }

  return { lots, garages, gates, allLots: [...lots, ...garages.map(g => g.lot)] };
}

// Garages souterrains sur les vraies entrées OpenStreetMap
// (amenity=parking_entrance) : les entrées à moins de `regroupementM` m
// forment un même garage, sous le bâtiment le plus proche. Le plan intérieur
// (non décrit par OSM) est construit avec les dimensions usuelles, à une
// taille proportionnée au bâtiment. Sans données réelles : un garage sous le
// plus grand bâtiment.
function createGarages(campus, sommetsParc, config) {
  const pxm = campus.proj.pxPerMeter;
  const reel = typeof CASANEARSHORE_REEL !== "undefined" ? CASANEARSHORE_REEL : null;
  let points = reel ? reel.entreesSouterraines.map(([lon, lat]) => {
    const p = projectLatLon(lat, lon, campus.proj);
    return createVector(p.x, p.y);
  }) : [];
  if (points.length === 0) {
    const plusGrand = [...campus.buildings].sort((a, b) => b.area - a.area)[0];
    points = [plusGrand.door.copy()];
  }
  const groupes = [];
  for (const p of points) {
    const g = groupes.find(gr => p5.Vector.dist(gr.centre, p) < metres(config.regroupementM, campus.proj));
    if (g) {
      g.points.push(p);
      g.centre = g.points.reduce((s, q) => s.add(q), createVector(0, 0)).div(g.points.length);
    } else {
      groupes.push({ points: [p], centre: p.copy() });
    }
  }
  const bureaux = campus.buildings.filter(b => b.usage !== "chantier");
  let y = config.garageOrigin.y;
  return groupes.map((g, i) => {
    const batiment = bureaux.reduce((m, b) => (p5.Vector.dist(b.closestPoint(g.centre), g.centre) < p5.Vector.dist(m.closestPoint(g.centre), g.centre) ? b : m));
    // Sommet routier du parc le plus proche de la bouche de rampe, parmi ceux
    // que l'on peut atteindre depuis chaque porte (pas une voie de sortie).
    const parDistance = [...sommetsParc].sort((a, b) => Math.hypot(a.x - g.centre.x, a.y - g.centre.y) - Math.hypot(b.x - g.centre.x, b.y - g.centre.y));
    const entree = parDistance.find(n => Object.values(campus.gates).every(gate =>
      campus.network.shortestPath(gate.osmId, n.id, campus.insideSite) !== null)) ?? parDistance[0];
    const cote = Math.sqrt(batiment.area / (pxm * pxm));
    const largeurM = Math.min(80, Math.max(48, cote * 1.3));
    const plan = { ...GARAGE_PLAN, widthM: Math.round(largeurM), heightM: Math.round(Math.min(56, Math.max(38, largeurM * 0.72))) };
    const origine = createVector(campus.data.width + config.garageOrigin.dx, y + metres(plan.rampLengthM, campus.proj));
    y += metres(plan.heightM + plan.rampLengthM + 30, campus.proj);
    const garage = new Garage(batiment, g.centre, origine, pxm, plan);
    garage.entranceNodeId = entree.id;
    garage.index = i;
    garage.lot.garage = garage;
    return garage;
  });
}

function nearestBuilding(buildings, p) {
  let meilleur = null;
  let record = Infinity;
  for (const b of buildings) {
    const d = p5.Vector.dist(b.door, p);
    if (d < record) {
      record = d;
      meilleur = b;
    }
  }
  return meilleur;
}

// Itinéraire de la porte jusqu'à une place :
//  - surface : routes du parc jusqu'à l'accès de l'allée, puis l'allée
//    jusqu'au point devant la place ;
//  - garage : routes du parc jusqu'à la bouche de rampe (la suite est dans le garage).
// Retourne { inside: [points], tail: [points], level }.
function planSpotRoute(campus, world, gateKey, spot) {
  const net = campus.network;
  const porte = campus.gates[gateKey].osmId;
  const decalage = metres(campus.config.laneOffsetM, campus.proj);
  const pas = metres(1, campus.proj);
  const versPoints = ids => simplifyPolyline(offsetPolylineRight(net.points(ids), decalage), pas);
  if (spot.level === -1) {
    const garage = spot.lot.garage;
    const ids = net.shortestPath(porte, garage.entranceNodeId, campus.insideSite);
    if (!ids) return null;
    return { inside: versPoints(ids), tail: [garage.surfaceEntrance.copy()], level: -1 };
  }
  const acces = spot.lot.access.get(spot.aisle.key);
  const ids = net.shortestPath(porte, acces.nodeId, campus.insideSite);
  if (!ids) return null;
  return { inside: versPoints(ids), tail: [acces.end.copy(), spot.aislePoint.copy()], level: 0 };
}
