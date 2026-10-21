// Transports et rondes (règles de scène) : ligne du tram sur la voie réservée
// en haut de Casanearshore (tracé OSM du Casabusway BW1, station
// « Casa Nearshore »), et convoi G4S de 4 véhicules (un leader et trois
// suiveurs) qui fait la ronde du parc en boucle.
// Aucune formule de steering ici : Tram et G4SVehicle calculent leurs forces.

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

// Point situé à `distance` px en arrière du premier point d'une boucle fermée
// (on remonte les segments), avec l'indice et la direction de son segment.
function pointBehindOnLoop(points, distance) {
  let reste = distance;
  for (let k = points.length - 1; k >= 0; k--) {
    const a = points[k];
    const b = points[(k + 1) % points.length];
    const l = p5.Vector.dist(a, b);
    if (reste <= l && l > 0) return { pos: p5.Vector.lerp(b, a, reste / l), index: k, dir: p5.Vector.sub(b, a).normalize() };
    reste -= l;
  }
  return { pos: points[0].copy(), index: 0, dir: p5.Vector.sub(points[1], points[0]).normalize() };
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
  // Ronde du convoi G4S : circuit entre les carrefours les plus proches de
  // ces deux bâtiments (aller par une route, retour par une autre).
  patrolEnds: ["Shore 1", "Shore 22"],
  convoySize: 4
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
    this.buildTramLines();
    this.buildPatrolLoop();
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

  // Boucle de ronde du convoi : un vrai circuit, sans demi-tour. Plus court
  // chemin d'un carrefour à l'autre, puis retour par d'autres rues (les
  // sommets intérieurs de l'aller sont interdits). Le convoi ne croise donc
  // jamais sa propre queue en sens inverse.
  buildPatrolLoop() {
    const c = this.campus;
    const net = c.network;
    const routeDuParc = n => c.insideSite(n) && !this.world.lots.some(l => pointInPolygon(createVector(n.x, n.y), l.points));
    const carrefour = n => routeDuParc(n) && n.edges.length >= 3;
    const [a, b] = this.config.patrolEnds.map(nom => c.buildings.find(x => x.name === nom))
      .map(bat => (bat ? net.nearestNode(bat.door, carrefour) : null));
    const aller = a && b ? net.shortestPath(a.id, b.id, routeDuParc) : null;
    const interieur = new Set(aller ? aller.slice(1, -1) : []);
    const retour = aller ? net.shortestPath(b.id, a.id, n => routeDuParc(n) && !interieur.has(n.id)) : null;
    const ids = aller && retour ? [...aller, ...retour.slice(1, -1)] : aller ?? [];
    const decalage = metres(c.config.laneOffsetM, c.proj);
    this.patrolIsLoop = Boolean(aller && retour);
    this.patrolPoints = simplifyPolyline(offsetPolylineRight([...net.points(ids), net.points(ids)[0]], decalage), mPx(1)).slice(0, -1);
  }

  // Convoi G4S de 4 véhicules : la tête suit la boucle, les autres la suivent.
  // Ils partent en colonne, espacés comme en roulant, le long de la boucle.
  createConvoy() {
    const pts = this.patrolPoints.map(p => createVector(p.x, p.y));
    const chemin = new Path(pts, mPx(G4S_CONFIG.laneToleranceM), true);
    const espacement = mPx(4.9 + G4S_CONFIG.convoyGapM);
    let devant = null;
    const convoi = [];
    for (let i = 0; i < this.config.convoySize; i++) {
      const place = pointBehindOnLoop(pts, i * espacement);
      const v = new G4SVehicle(place.pos.x, place.pos.y, { path: chemin, predecessor: devant, number: i + 1 });
      v.heading = place.dir.copy();
      v.vel = v.heading.copy().mult(0.5);
      v.pathIndex = place.index;
      this.trafic.cars.push(v);
      convoi.push(v);
      devant = v;
    }
    this.convoy = convoi;
    return convoi;
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

  // Un pas : chaque tram avance ; les véhicules sortis de la carte sont retirés.
  step() {
    for (const t of this.trams) t.step();
    this.trams = this.trams.filter(t => t.state !== "gone");
    this.trafic.cars = this.trafic.cars.filter(c => c.state !== "gone");
  }
}
