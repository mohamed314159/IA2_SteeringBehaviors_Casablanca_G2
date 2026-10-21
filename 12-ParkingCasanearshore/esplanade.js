// Espaces piétons du parc (règles de scène, placement) :
//  - parvis pavé devant la porte de chaque bâtiment ;
//  - stands de vente de café juste à côté des bâtiments principaux, avec
//    des bancs : c'est là que les employés discutent avant 8h55 ;
//  - points de rassemblement (sécurité incendie) sur les pelouses dégagées.
// Aucune source publique ne localise les stands ni les points de
// rassemblement : on retient l'emplacement le plus probable (à côté des
// entrées, et sur les grands espaces verts).
const ESPLANADE_CONFIG = {
  stands: 12,            // bâtiments principaux équipés d'un stand de café
  forecourtDepthM: 9,    // profondeur du parvis devant la porte
  forecourtWidthM: 16,
  zoneRadiusM: 12,       // rayon de la zone de flânerie autour du stand
  assemblyPoints: 6,
  gridM: 8,
  assemblyMinBuildingM: 18,
  minRoadM: 7
};

// Segments des polylignes avec leur rectangle englobant (calculés une fois).
function segmentsWithBounds(polylignes) {
  const segments = [];
  for (const pts of polylignes) {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      segments.push({ a: createVector(ax, ay), b: createVector(bx, by), x0: Math.min(ax, bx), x1: Math.max(ax, bx), y0: Math.min(ay, by), y1: Math.max(ay, by) });
    }
  }
  return segments;
}

// Vrai si p est à moins de `seuil` d'un des segments.
function nearSegments(p, segments, seuil) {
  for (const s of segments) {
    if (p.x < s.x0 - seuil || p.x > s.x1 + seuil || p.y < s.y0 - seuil || p.y > s.y1 + seuil) continue;
    if (p5.Vector.dist(p, closestPointOnSegment(p, s.a, s.b)) < seuil) return true;
  }
  return false;
}

function pointLibre(campus, world, p, distBatiment) {
  if (!pointInPolygon(p, campus.site)) return false;
  if (world.lots.some(l => pointInPolygon(p, l.points))) return false;
  return campus.buildings.every(b => !b.contains(p) && p5.Vector.dist(p, b.closestPoint(p)) >= distBatiment);
}

function createEsplanades(campus, world, rng, config = ESPLANADE_CONFIG) {
  const routes = segmentsWithBounds(campus.data.roads.map(r => r.points));
  const esplanades = [];
  const obstacles = [];
  // Parvis devant chaque porte (rendu au sol).
  const parvis = campus.buildings.filter(b => b.usage !== "chantier").map(b => ({
    building: b,
    center: b.doorNormal.copy().mult(mPx(config.forecourtDepthM / 2 - 1)).add(b.closestPoint(b.door)),
    normal: b.doorNormal.copy(),
    widthPx: mPx(config.forecourtWidthM),
    depthPx: mPx(config.forecourtDepthM)
  }));
  // Stands : à côté de l'entrée des plus grands bâtiments (un par nom).
  const vus = new Set();
  const principaux = [...campus.workplaces].sort((a, b) => b.area - a.area).filter(b => {
    if (vus.has(b.name)) return false;
    vus.add(b.name);
    return true;
  }).slice(0, config.stands);
  for (const b of principaux) {
    const facade = b.closestPoint(b.door);
    const tangente = createVector(-b.doorNormal.y, b.doorNormal.x);
    // Le stand se met d'un côté de l'entrée ; s'il gêne (route, bâtiment), de l'autre.
    let pos = null;
    for (const cote of [1, -1]) {
      const essai = tangente.copy().mult(mPx(7) * cote).add(b.doorNormal.copy().mult(mPx(4))).add(facade);
      if (pointLibre(campus, world, essai, mPx(2.5)) && !nearSegments(essai, routes, mPx(4))) {
        pos = essai;
        break;
      }
    }
    if (!pos) continue;
    const kiosque = new CoffeeKiosk(pos.x, pos.y, { angle: b.doorNormal.heading(), name: `Café ${b.name}`, r: mPx(1.4) });
    const bancs = [];
    for (const cote of [-1, 1]) {
      const p = tangente.copy().mult(mPx(4) * cote).add(b.doorNormal.copy().mult(mPx(8))).add(facade);
      if (pointLibre(campus, world, p, mPx(2)) && !nearSegments(p, routes, mPx(3.5))) bancs.push(new Bench(p.x, p.y, tangente.heading()));
    }
    const centre = b.doorNormal.copy().mult(mPx(7)).add(facade);
    obstacles.push(kiosque, ...bancs);
    esplanades.push({ building: b, center: centre, radius: mPx(config.zoneRadiusM), kiosk: kiosque, benches: bancs });
  }
  return { esplanades, obstacles, parvis, assemblyPoints: placeAssemblyPoints(campus, world, routes, config) };
}

// Points de rassemblement : sur les pelouses les plus dégagées, répartis dans
// le parc (on maximise la distance entre eux).
function placeAssemblyPoints(campus, world, routes, config) {
  const pas = mPx(config.gridM);
  const xs = campus.site.map(p => p.x);
  const ys = campus.site.map(p => p.y);
  const candidats = [];
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += pas) {
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += pas) {
      const p = createVector(x, y);
      if (!pointLibre(campus, world, p, mPx(config.assemblyMinBuildingM))) continue;
      if (nearSegments(p, routes, mPx(config.minRoadM))) continue;
      if (p5.Vector.dist(p, closestPointOnPolygon(p, campus.site)) < mPx(8)) continue;
      candidats.push(p);
    }
  }
  if (candidats.length === 0) return [];
  const choisis = [candidats[Math.floor(candidats.length / 2)]];
  while (choisis.length < config.assemblyPoints && choisis.length < candidats.length) {
    let meilleur = null;
    let record = -1;
    for (const c of candidats) {
      const d = Math.min(...choisis.map(q => p5.Vector.dist(q, c)));
      if (d > record) {
        record = d;
        meilleur = c;
      }
    }
    choisis.push(meilleur);
  }
  return choisis.map((p, i) => new AssemblyPoint(p.x, p.y, i + 1));
}
