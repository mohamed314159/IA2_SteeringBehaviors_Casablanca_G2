// Assemblage des parkings de la scène : parkings de surface (polygones OSM),
// garage souterrain, portes à barrière, et itinéraire jusqu'à une place.
// Fonctions de scène (sélection d'action) : aucune formule de steering ici.

const PARKING_WORLD_CONFIG = {
  pmrPerLot: 4,
  evPerLot: 6,
  // Le garage est sous le plus grand bâtiment du parc.
  garageOrigin: { dx: 300, y: 300 }
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

  // Garage sous le plus grand bâtiment : bouche de rampe sur le sommet routier
  // du parc le plus proche de sa façade.
  const batimentGarage = [...campus.buildings].sort((a, b) => b.area - a.area)[0];
  let entree = null;
  let record = Infinity;
  for (const n of sommetsParc) {
    const p = createVector(n.x, n.y);
    if (batimentGarage.contains(p)) continue;
    const d = p5.Vector.dist(batimentGarage.closestPoint(p), p);
    if (d < record) {
      record = d;
      entree = n;
    }
  }
  const origine = createVector(campus.data.width + config.garageOrigin.dx, config.garageOrigin.y);
  const garage = new Garage(batimentGarage, createVector(entree.x, entree.y), origine, pxm);
  garage.entranceNodeId = entree.id;

  // Portes : direction d'arrivée = depuis le sommet extérieur qui y mène.
  const gates = {};
  for (const g of Object.values(campus.gates)) {
    const sommet = campus.network.nodes.get(g.osmId);
    const avant = [...campus.network.nodes.values()].find(n => !campus.insideSite(n) && n.edges.some(e => e.to === g.osmId));
    const direction = avant ? createVector(sommet.x - avant.x, sommet.y - avant.y) : createVector(0, 1);
    gates[g.key] = new Gate(g.key, g.label, sommet.x, sommet.y, direction, { pxPerMeter: pxm, laneOffset: metres(campus.config.laneOffsetM, campus.proj) });
  }

  return { lots, garage, gates, allLots: [...lots, garage.lot] };
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
    const ids = net.shortestPath(porte, world.garage.entranceNodeId, campus.insideSite);
    if (!ids) return null;
    return { inside: versPoints(ids), tail: [world.garage.surfaceEntrance.copy()], level: -1 };
  }
  const acces = spot.lot.access.get(spot.aisle.key);
  const ids = net.shortestPath(porte, acces.nodeId, campus.insideSite);
  if (!ids) return null;
  return { inside: versPoints(ids), tail: [acces.end.copy(), spot.aislePoint.copy()], level: 0 };
}
