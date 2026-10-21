// Transports en commun (règles de scène) : ligne du tram sur la voie réservée
// en haut de Casanearshore (tracé OSM du Casabusway BW1, station
// « Casa Nearshore »), et navette G4S qui entre par la porte nord, s'arrête
// au centre du parc puis repart par la sortie nord.
// Aucune formule de steering ici : Tram et Shuttle calculent leurs forces.

// Assemble les tronçons d'une direction de la voie en un seul tracé continu.
function chainPolylines(troncons) {
  const reste = troncons.map(t => t.points.map(([x, y]) => ({ x, y })));
  if (reste.length === 0) return [];
  // Départ : tronçon dont le premier point ne prolonge aucun autre tronçon.
  const fin = p => reste.some(q => Math.hypot(q.at(-1).x - p.x, q.at(-1).y - p.y) < 1);
  let courant = reste.find(t => !fin(t[0])) ?? reste[0];
  const resultat = [...courant];
  reste.splice(reste.indexOf(courant), 1);
  while (reste.length) {
    const dernier = resultat.at(-1);
    const suivant = reste.find(t => Math.hypot(t[0].x - dernier.x, t[0].y - dernier.y) < 1);
    if (!suivant) break;
    resultat.push(...suivant.slice(1));
    reste.splice(reste.indexOf(suivant), 1);
  }
  return resultat;
}

function closestPointOnPolyline(p, points) {
  let meilleur = null;
  let record = Infinity;
  for (let i = 0; i + 1 < points.length; i++) {
    const q = closestPointOnSegment(p, createVector(points[i].x, points[i].y), createVector(points[i + 1].x, points[i + 1].y));
    const d = p5.Vector.dist(p, q);
    if (d < record) {
      record = d;
      meilleur = q;
    }
  }
  return meilleur;
}

const TRANSIT_CONFIG = {
  stationName: "Casa Nearshore",
  // Tronçons OSM de la voie, par direction (vers l'est et vers l'ouest).
  lines: {
    est: [1192067193, 1192067192, 1110644724],
    ouest: [1110644725, 1192067195, 1192067194]
  },
  shuttleExitGate: 5688433270
};

class TransitManager {
  constructor(campus, world, trafic, rng = Math.random, config = TRANSIT_CONFIG) {
    this.campus = campus;
    this.world = world;
    this.trafic = trafic;
    this.rng = rng;
    this.config = config;
    this.trams = [];
    this.onTramDoorsOpen = null;
    this.onShuttleDoorsOpen = null;
    this.buildTramLines();
    this.buildShuttleRoute();
  }

  buildTramLines() {
    const d = this.campus.data;
    const arrets = d.stops.filter(s => s.name === this.config.stationName);
    const centre = arrets.reduce((a, s) => a.add(s.point[0] / arrets.length, s.point[1] / arrets.length), createVector(0, 0));
    this.lines = {};
    for (const [sens, ids] of Object.entries(this.config.lines)) {
      const points = chainPolylines(d.busway.filter(b => ids.includes(b.id)));
      const quai = closestPointOnPolyline(centre, points);
      this.lines[sens] = { points, station: quai, platformSide: p5.Vector.sub(centre, quai).normalize() };
    }
    this.stationCenter = centre;
  }

  // Arrêt de la navette : sommet routier du parc (hors parkings) le plus
  // proche du centre des bâtiments.
  buildShuttleRoute() {
    const c = this.campus;
    const net = c.network;
    const centre = createVector(0, 0);
    for (const b of c.buildings) centre.add(b.center);
    centre.div(c.buildings.length);
    // Route traversante du parc (au moins deux tronçons), hors allées de parking.
    const candidats = [...net.nodes.values()].filter(n => c.insideSite(n) && !n.services.has("parking_aisle") &&
      !n.services.has("driveway") && n.edges.length >= 2 &&
      !this.world.lots.some(l => pointInPolygon(createVector(n.x, n.y), l.points)));
    const arret = candidats.reduce((m, n) => (Math.hypot(n.x - centre.x, n.y - centre.y) < Math.hypot(m.x - centre.x, m.y - centre.y) ? n : m));
    this.shuttleStopNode = arret;
    const decalage = metres(c.config.laneOffsetM, c.proj);
    const pas = mPx(1);
    const points = ids => simplifyPolyline(offsetPolylineRight(net.points(ids), decalage), pas);
    const dedans = net.shortestPath(c.gates.nord.osmId, arret.id, c.insideSite);
    this.shuttleInside = points(dedans);
    this.shuttleStopPoint = createVector(this.shuttleInside.at(-1).x, this.shuttleInside.at(-1).y);
    // Retour : arrêt → sortie nord (dans le parc) → bord de carte (dehors).
    const sortie = this.config.shuttleExitGate;
    const versSortie = net.shortestPath(arret.id, sortie, c.insideSite);
    const entreesNord = c.entries.filter(e => e.gate === "nord");
    // En sortant, la navette tourne à droite (vers l'est) : elle ne coupe pas
    // la file des voitures qui attendent devant l'entrée nord, à l'ouest.
    const sortieNode = net.nodes.get(sortie);
    const versLEst = entreesNord.filter(e => e.pos.x > sortieNode.x);
    let meilleure = null;
    let longueur = Infinity;
    for (const e of versLEst.length ? versLEst : entreesNord) {
      const r = net.shortestPath(sortie, e.nodeId, n => !c.insideSite(n));
      if (r && net.routeLength(r) < longueur) {
        longueur = net.routeLength(r);
        meilleure = r;
      }
    }
    this.shuttleExit = points([...versSortie, ...meilleure.slice(1)]);
    // La navette arrive par l'ouest (entrée de la carte la plus proche par la route).
    this.shuttleEntry = entreesNord.reduce((m, e) => (e.routeLength < m.routeLength ? e : m));
  }

  spawnTram(sens = "ouest", passengers = 40) {
    const ligne = this.lines[sens];
    const tram = new Tram(new Path(ligne.points.map(p => createVector(p.x, p.y)), mPx(1)), ligne.station, {
      platformSide: ligne.platformSide,
      passengers,
      onDoorsOpen: t => this.onTramDoorsOpen && this.onTramDoorsOpen(t)
    });
    this.trams.push(tram);
    return tram;
  }

  // La navette circule avec les voitures (mêmes règles, même liste).
  spawnShuttle(passengers = 20) {
    const c = this.campus;
    const ids = c.network.shortestPath(this.shuttleEntry.nodeId, c.gates.nord.osmId, n => !c.insideSite(n));
    const decalage = metres(c.config.laneOffsetM, c.proj);
    const pointsRoute = simplifyPolyline(offsetPolylineRight(c.network.points(ids), decalage), mPx(1));
    pointsRoute.push(this.world.gates.nord.stopLine.copy());
    const navette = new Shuttle(pointsRoute[0].x, pointsRoute[0].y, {
      gateKey: "nord",
      path: new Path(pointsRoute, mPx(1.5)),
      stopPoint: this.shuttleStopPoint,
      insideRoute: this.shuttleInside,
      exitRoute: this.shuttleExit,
      passengers,
      onDoorsOpen: s => this.onShuttleDoorsOpen && this.onShuttleDoorsOpen(s)
    });
    this.trafic.cars.push(navette);
    return navette;
  }

  shuttles() {
    return this.trafic.cars.filter(c => c instanceof Shuttle);
  }

  // Un pas : chaque tram avance ; les véhicules sortis de la carte sont retirés.
  step() {
    for (const t of this.trams) t.step();
    this.trams = this.trams.filter(t => t.state !== "gone");
    this.trafic.cars = this.trafic.cars.filter(c => c.state !== "gone");
  }
}
