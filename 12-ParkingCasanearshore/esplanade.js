// Esplanades du parc (règle de scène) : emplacements des kiosques à café,
// avec bancs et jardinières autour. On cherche des espaces dégagés : loin
// des bâtiments, des routes et des parkings, mais près des portes des
// bâtiments (là où les employés se retrouvent avant 8h55).
const ESPLANADE_CONFIG = {
  kiosks: 4,
  gridM: 8,              // pas de la grille de recherche
  minBuildingM: 12,      // distance minimale aux bâtiments
  minRoadM: 7,           // distance minimale aux routes
  maxDoorM: 70,          // distance maximale à une porte de bâtiment
  minSiteEdgeM: 10,      // distance minimale à la limite du parc
  zoneRadiusM: 18        // rayon de la zone de flânerie autour du kiosque
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

function createEsplanades(campus, world, rng, config = ESPLANADE_CONFIG) {
  const pas = mPx(config.gridM);
  const xs = campus.site.map(p => p.x);
  const ys = campus.site.map(p => p.y);
  const routes = segmentsWithBounds([...campus.data.roads.map(r => r.points), ...campus.data.footways.map(f => f.points)]);
  const candidats = [];
  for (let x = Math.min(...xs); x <= Math.max(...xs); x += pas) {
    for (let y = Math.min(...ys); y <= Math.max(...ys); y += pas) {
      const p = createVector(x, y);
      if (!pointInPolygon(p, campus.site)) continue;
      // Critères du moins coûteux au plus coûteux.
      const dPorte = Math.min(...campus.buildings.map(b => p5.Vector.dist(p, b.door)));
      if (dPorte > mPx(config.maxDoorM)) continue;
      if (world.lots.some(l => pointInPolygon(p, l.points))) continue;
      const presDUnBatiment = campus.buildings.some(b => p5.Vector.dist(p, b.center) - b.r < mPx(config.minBuildingM) &&
        (b.contains(p) || p5.Vector.dist(p, b.closestPoint(p)) < mPx(config.minBuildingM)));
      if (presDUnBatiment) continue;
      if (nearSegments(p, routes, mPx(config.minRoadM))) continue;
      // Le décor (jusqu'à 8 m du kiosque) doit rester dans le parc.
      if (p5.Vector.dist(p, closestPointOnPolygon(p, campus.site)) < mPx(config.minSiteEdgeM)) continue;
      candidats.push({ p, dPorte });
    }
  }
  // Points les plus éloignés les uns des autres (en commençant par le plus
  // proche d'une porte) pour répartir les kiosques dans le parc.
  candidats.sort((a, b) => a.dPorte - b.dPorte);
  const choisis = candidats.length ? [candidats[0].p] : [];
  while (choisis.length < config.kiosks && choisis.length < candidats.length) {
    let meilleur = null;
    let record = -1;
    for (const c of candidats) {
      const d = Math.min(...choisis.map(q => p5.Vector.dist(q, c.p)));
      if (d > record) {
        record = d;
        meilleur = c.p;
      }
    }
    choisis.push(meilleur);
  }
  const esplanades = [];
  const obstacles = [];
  choisis.forEach((centre, i) => {
    const angle = randomBetween(rng, 0, Math.PI * 2);
    const kiosque = new CoffeeKiosk(centre.x, centre.y, { angle, name: `Café ${i + 1}` });
    const bancs = [1, -1].map(s => {
      const p = rotatedVector(mPx(7) * s, mPx(3), angle).add(centre);
      return new Bench(p.x, p.y, angle);
    });
    const bacs = [Math.PI / 2, -Math.PI / 2, Math.PI].map(a => {
      const p = rotatedVector(mPx(6), 0, angle + a).add(centre);
      return new Planter(p.x, p.y);
    });
    obstacles.push(kiosque, ...bancs, ...bacs);
    esplanades.push({ center: centre.copy(), radius: mPx(config.zoneRadiusM), kiosk: kiosque, benches: bancs, planters: bacs });
  });
  return { esplanades, obstacles };
}
