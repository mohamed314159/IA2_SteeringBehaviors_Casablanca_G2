// Fond de carte : sol, pelouses, maisons alentour, parkings, routes,
// trottoirs et voie du Busway. Ce n'est que du décor : il est dessiné une
// seule fois dans un calque p5.Graphics (comme 11-F1/decor.js et
// 5-3/scenery.js), puis recopié à chaque image.

const MAP_COLORS = {
  ground: "#e8e5dc",
  site: "#dde8d0",
  green: "#bcd8a2",
  house: "#cdc6b9",
  houseStroke: "#a9a296",
  parking: "#c6ccd5",
  parkingStroke: "#8d96a3",
  roadCasing: "#b9b4a8",
  road: "#fbfaf7",
  busway: "#e39a46",
  footway: "#b5a487",
  siteBorder: "#6f9152"
};

// Largeur de chaussée (m) par type de route OSM.
const ROAD_WIDTH_M = {
  trunk: 16, trunk_link: 8, primary: 13, primary_link: 8, secondary: 11, tertiary: 9,
  unclassified: 7, residential: 7, living_street: 6, service: 5
};

function renderMapLayer(campus, world = null, echelle = 1) {
  const d = campus.data;
  const px = m => metres(m, d.projection);
  const g = createGraphics(Math.ceil(d.width * echelle), Math.ceil(d.height * echelle));
  g.pixelDensity(1);
  g.scale(echelle);
  g.background(MAP_COLORS.ground);

  g.noStroke();
  g.fill(MAP_COLORS.site);
  drawPolygon(g, d.site);

  g.fill(MAP_COLORS.green);
  for (const v of d.greens) drawPolygon(g, v.points);

  g.fill(MAP_COLORS.house);
  g.stroke(MAP_COLORS.houseStroke);
  g.strokeWeight(1);
  for (const b of campus.background) drawPolygon(g, b.points);

  g.fill(MAP_COLORS.parking);
  g.stroke(MAP_COLORS.parkingStroke);
  for (const p of d.parkings) drawPolygon(g, p.points);

  // Routes : bordure grise puis chaussée claire, des plus petites aux plus grandes.
  // Les allées OSM situées dans un parking découpé sont remplacées par nos allées.
  const dansUnParking = r => world && world.lots.some(l => {
    const [x, y] = r.points[Math.floor(r.points.length / 2)];
    return pointInPolygon(createVector(x, y), l.points);
  });
  const routes = d.roads.filter(r => !(world && r.service === "parking_aisle") && !dansUnParking(r))
    .sort((a, b) => (ROAD_WIDTH_M[a.type] || 5) - (ROAD_WIDTH_M[b.type] || 5));
  g.noFill();
  g.strokeCap(ROUND);
  g.strokeJoin(ROUND);
  for (const passe of ["casing", "road"]) {
    for (const r of routes) {
      const largeur = px(ROAD_WIDTH_M[r.type] || 5);
      g.stroke(passe === "casing" ? MAP_COLORS.roadCasing : MAP_COLORS.road);
      g.strokeWeight(passe === "casing" ? largeur + px(1.2) : largeur);
      drawPolyline(g, r.points);
    }
  }

  // Voie réservée du Busway.
  g.stroke(MAP_COLORS.busway);
  g.strokeWeight(px(4));
  for (const b of d.busway) drawPolyline(g, b.points);

  // Chemins piétons en pointillés.
  g.stroke(MAP_COLORS.footway);
  g.strokeWeight(px(1.2));
  g.drawingContext.setLineDash([px(2), px(1.5)]);
  for (const f of d.footways) drawPolyline(g, f.points);

  g.drawingContext.setLineDash([]);

  // Allées des parkings découpés (asphalte plus foncé).
  if (world) {
    g.stroke(150, 156, 166);
    g.strokeCap(SQUARE);
    g.strokeWeight(px(PARKING_LAYOUT.aisleWidthM));
    for (const lot of world.lots) {
      for (const a of lot.aisles.values()) g.line(a.a.x, a.a.y, a.b.x, a.b.y);
    }
    g.strokeCap(ROUND);
    // Marquage des places (statique) : dessiné une seule fois.
    for (const lot of world.lots) for (const s of lot.spots) s.drawMarking(g);
  }

  // Limite du parc.
  g.stroke(MAP_COLORS.siteBorder);
  g.strokeWeight(px(1.5));
  g.drawingContext.setLineDash([px(5), px(3)]);
  g.noFill();
  drawPolygon(g, d.site);
  g.drawingContext.setLineDash([]);
  return g;
}

function drawPolygon(g, points) {
  g.beginShape();
  for (const [x, y] of points) g.vertex(x, y);
  g.endShape(CLOSE);
}

function drawPolyline(g, points) {
  g.beginShape();
  for (const [x, y] of points) g.vertex(x, y);
  g.endShape();
}
