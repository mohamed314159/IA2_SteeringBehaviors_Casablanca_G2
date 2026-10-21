// Placement des arbres (décor, sans steering), d'après ce que montre
// l'imagerie : alignements le long des voies du parc, bosquets sur les
// pelouses, parc arboré à l'ouest (OSM leisure=park). Positions tirées avec
// un générateur à graine : le décor est identique à chaque chargement.
const TREES_CONFIG = {
  rowSpacingM: 9,       // alignements : un arbre tous les 9 m
  rowSetbackM: 2.2,     // au-delà du trottoir
  lawnSpacingM: 11,     // bosquets : distance minimale entre arbres
  parkSpacingM: 7,      // parc arboré
  clearBuildingM: 4,
  clearRoadM: 3
};

function generateTrees(campus, world, esplanade, rng, config = TREES_CONFIG) {
  const arbres = [];
  const segments = segmentsWithBounds(campus.data.roads.map(r => r.points));
  const pietons = segmentsWithBounds(campus.data.footways.map(f => f.points));
  const parvis = esplanade ? esplanade.parvis : [];
  const libre = (p, routeMin) => {
    if (world.lots.some(l => pointInPolygon(p, l.points))) return false;
    if (campus.buildings.some(b => p5.Vector.dist(b.center, p) - b.r < mPx(config.clearBuildingM) &&
      (b.contains(p) || p5.Vector.dist(b.closestPoint(p), p) < mPx(config.clearBuildingM)))) return false;
    if (nearSegments(p, segments, routeMin)) return false;
    if (nearSegments(p, pietons, mPx(1.5))) return false;
    if (parvis.some(pv => p5.Vector.dist(pv.center, p) < pv.widthPx * 0.6)) return false;
    return arbres.every(a => Math.hypot(a.x - p.x, a.y - p.y) > mPx(4));
  };
  const ajouter = (p, rayonM) => arbres.push({ x: p.x, y: p.y, r: mPx(rayonM), teinte: rng() });

  // 1. Alignements le long des routes du parc (des deux côtés).
  for (const r of campus.data.roads) {
    const largeur = (ROAD_WIDTH_M[r.type] ?? 5) / 2 + SIDEWALK_WIDTH_M + config.rowSetbackM;
    for (let i = 0; i + 1 < r.points.length; i++) {
      const a = createVector(...r.points[i]);
      const b = createVector(...r.points[i + 1]);
      const l = p5.Vector.dist(a, b);
      const dir = p5.Vector.sub(b, a).normalize();
      const n = createVector(-dir.y, dir.x);
      for (let s = mPx(config.rowSpacingM) / 2; s < l; s += mPx(config.rowSpacingM)) {
        const centre = dir.copy().mult(s).add(a);
        if (!pointInPolygon(centre, campus.site)) continue;
        for (const cote of [1, -1]) {
          const p = n.copy().mult(mPx(largeur) * cote).add(centre);
          if (pointInPolygon(p, campus.site) && libre(p, mPx(largeur - 0.5))) ajouter(p, 2.4 + rng() * 1.2);
        }
      }
    }
  }
  // 2. Bosquets sur les pelouses du parc (échantillonnage avec distance minimale).
  semer(campus.site, mPx(config.lawnSpacingM), 0.55, rayon => 2.5 + rng() * 2.5);
  // 3. Parc arboré public à l'ouest (polygones OSM), plus dense.
  for (const g of campus.data.greens.filter(v => v.type === "park")) {
    semer(g.points.map(([x, y]) => createVector(x, y)), mPx(config.parkSpacingM), 0.8, () => 2.8 + rng() * 2.8);
  }
  return arbres;

  // Tire des points dans un polygone ; chacun est gardé avec la probabilité `densite`.
  function semer(polygone, pas, densite, rayonM) {
    const xs = polygone.map(p => p.x);
    const ys = polygone.map(p => p.y);
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += pas) {
      for (let y = Math.min(...ys); y <= Math.max(...ys); y += pas) {
        if (rng() > densite) continue;
        const p = createVector(x + (rng() - 0.5) * pas * 0.8, y + (rng() - 0.5) * pas * 0.8);
        if (!pointInPolygon(p, polygone)) continue;
        if (libre(p, mPx(config.clearRoadM + 2.5))) ajouter(p, rayonM());
      }
    }
  }
}
