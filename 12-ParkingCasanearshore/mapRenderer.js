// Rendu de la carte (décor, aucun effet sur la simulation) :
//  - deux masques de matériaux pour le shader du sol (groundShader.js) ;
//  - un calque de décor dessiné une seule fois : bordures et marquages des
//    routes, voie du tram et station, places de parking, ombres et toits des
//    bâtiments, portes, piscine, arbres avec leur ombre, maisons alentour.
// Comme 11-F1/decor.js et 5-3/scenery.js : dessiné une fois, recopié à chaque image.
const MAP_COLORS = {
  ground: "#dcd8cd",
  garage: "#2b2f35"
};

function drawPolygon(g, points) {
  g.beginShape();
  for (const p of points) {
    if (Array.isArray(p)) g.vertex(p[0], p[1]);
    else g.vertex(p.x, p.y);
  }
  g.endShape(CLOSE);
}

function drawPolyline(g, points) {
  g.beginShape();
  for (const p of points) {
    if (Array.isArray(p)) g.vertex(p[0], p[1]);
    else g.vertex(p.x, p.y);
  }
  g.endShape();
}

// Routes dessinées : sans les allées OSM des parkings découpés (remplacées
// par les allées du découpage).
function visibleRoads(sim) {
  const lots = sim.world.lots;
  return sim.campus.data.roads.filter(r => r.service !== "parking_aisle" && !lots.some(l => {
    const [x, y] = r.points[Math.floor(r.points.length / 2)];
    return pointInPolygon(createVector(x, y), l.points);
  }));
}

// Masques : A = (pelouse, pavés, asphalte), B = (terre, eau, parc).
// Chaque matériau recouvre les précédents ; l'anticrénelage mélange les bords.
function renderMasks(sim) {
  const d = sim.campus.data;
  const px = m => metres(m, d.projection);
  const routes = visibleRoads(sim);
  const creer = () => {
    const g = createGraphics(Math.ceil(d.width), Math.ceil(d.height));
    g.pixelDensity(1);
    g.background(0);
    g.noStroke();
    return g;
  };
  const A = creer();
  const B = creer();
  // Pelouse : tout l'intérieur du parc, et les espaces verts OSM.
  A.fill(255, 0, 0);
  drawPolygon(A, d.site);
  for (const v of d.greens) if (v.type !== "park") drawPolygon(A, v.points);
  // Parc arboré public.
  for (const v of d.greens.filter(x => x.type === "park")) {
    B.fill(0, 0, 255);
    drawPolygon(B, v.points);
    A.fill(0);
    drawPolygon(A, v.points);
  }
  // Terre nue : chantier.
  for (const b of sim.campus.buildings.filter(x => x.usage === "chantier")) {
    const marge = b.points.map(p => p5.Vector.sub(p, b.center).mult(1.12).add(b.center));
    B.fill(255, 0, 0);
    drawPolygon(B, marge);
    A.fill(0);
    drawPolygon(A, marge);
  }
  // Pavés : trottoirs le long des routes, chemins piétons, parvis, quais.
  A.noFill();
  A.strokeCap(ROUND);
  A.strokeJoin(ROUND);
  A.stroke(0, 255, 0);
  for (const r of routes) {
    A.strokeWeight(px((ROAD_WIDTH_M[r.type] || 5) + 2 * (SIDEWALK_GAP_M + SIDEWALK_WIDTH_M / 2)));
    drawPolyline(A, r.points);
  }
  A.strokeWeight(px(2.2));
  for (const f of d.footways) drawPolyline(A, f.points);
  A.noStroke();
  A.fill(0, 255, 0);
  for (const pv of sim.esplanade.parvis) {
    A.push();
    A.translate(pv.center.x, pv.center.y);
    A.rotate(pv.normal.heading());
    A.rectMode(CENTER);
    A.rect(0, 0, pv.depthPx, pv.widthPx, px(2));
    A.pop();
  }
  for (const ligne of Object.values(sim.transit.lines)) {
    const q = quaiRect(ligne, px);
    A.push();
    A.translate(q.centre.x, q.centre.y);
    A.rotate(q.angle);
    A.rectMode(CENTER);
    A.rect(0, 0, q.longueur, q.largeur);
    A.pop();
  }
  // Asphalte : routes, voie du tram, parkings.
  A.noFill();
  A.stroke(0, 0, 255);
  for (const r of routes) {
    A.strokeWeight(px(ROAD_WIDTH_M[r.type] || 5));
    drawPolyline(A, r.points);
  }
  A.strokeWeight(px(7));
  for (const b of d.busway) drawPolyline(A, b.points);
  A.noStroke();
  A.fill(0, 0, 255);
  for (const p of d.parkings) drawPolygon(A, p.points);
  // Eau : piscine au milieu de la boucle centrale.
  const piscine = poolRect(sim);
  if (piscine) {
    B.fill(0, 255, 0);
    B.rectMode(CENTER);
    B.rect(piscine.x, piscine.y, piscine.l, piscine.w, px(0.6));
    A.fill(0);
    A.rectMode(CENTER);
    A.rect(piscine.x, piscine.y, piscine.l, piscine.w, px(0.6));
  }
  return [A, B];
}

function poolRect(sim) {
  const reel = typeof CASANEARSHORE_REEL !== "undefined" ? CASANEARSHORE_REEL : null;
  if (!reel || !reel.piscine) return null;
  const d = sim.campus.data;
  const c = projectLatLon(reel.piscine.point[1], reel.piscine.point[0], d.projection);
  return { x: c.x, y: c.y, l: metres(reel.piscine.longueurM, d.projection), w: metres(reel.piscine.largeurM, d.projection) };
}

// Quai d'une direction : rectangle de 70 m le long de la voie, côté quai.
function quaiRect(ligne, px) {
  const pts = ligne.points;
  let k = 0;
  let record = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const q = closestPointOnSegment(ligne.station, createVector(pts[i].x, pts[i].y), createVector(pts[i + 1].x, pts[i + 1].y));
    const dd = p5.Vector.dist(q, ligne.station);
    if (dd < record) {
      record = dd;
      k = i;
    }
  }
  const angle = Math.atan2(pts[k + 1].y - pts[k].y, pts[k + 1].x - pts[k].x);
  const longueur = px(70);
  const largeur = px(4);
  // Le quai longe le tram arrêté (la tête est à la station).
  const recul = createVector(Math.cos(angle), Math.sin(angle)).mult(-longueur / 2 + px(2));
  const centre = ligne.platformSide.copy().mult(px(4.5)).add(ligne.station).add(recul);
  return { centre, angle, longueur, largeur };
}

function renderDecor(sim, arbres) {
  const d = sim.campus.data;
  const px = m => metres(m, d.projection);
  const routes = visibleRoads(sim);
  const g = createGraphics(Math.ceil(d.width), Math.ceil(d.height));
  g.pixelDensity(1);
  g.clear();
  g.strokeCap(ROUND);
  g.strokeJoin(ROUND);

  // Bordures de trottoir : contour clair de chaque chaussée.
  g.noFill();
  g.stroke(238, 236, 229);
  for (const r of routes) {
    g.strokeWeight(px((ROAD_WIDTH_M[r.type] || 5) + 0.6));
    drawPolyline(g, r.points);
  }
  g.erase();
  for (const r of routes) {
    g.strokeWeight(px(ROAD_WIDTH_M[r.type] || 5));
    drawPolyline(g, r.points);
  }
  g.noErase();
  // Ligne médiane discontinue sur les routes à double sens assez larges.
  g.stroke(250, 250, 245, 200);
  g.strokeWeight(px(0.18));
  g.drawingContext.setLineDash([px(3), px(4)]);
  for (const r of routes) if (!r.oneway && (ROAD_WIDTH_M[r.type] || 5) >= 7) drawPolyline(g, r.points);
  g.drawingContext.setLineDash([]);
  // Voie réservée du tram : bande rouge brique et rails.
  g.stroke(176, 74, 58, 150);
  g.strokeWeight(px(6.5));
  for (const b of d.busway) drawPolyline(g, b.points);
  g.stroke(90, 90, 95, 200);
  g.strokeWeight(px(0.25));
  for (const b of d.busway) {
    const pts = b.points.map(([x, y]) => ({ x, y }));
    drawPolyline(g, offsetPolylineRight(pts, px(0.7)));
    drawPolyline(g, offsetPolylineRight(pts, px(-0.7)));
  }
  // Chemins piétons : bordures fines.
  g.stroke(200, 192, 176);
  g.strokeWeight(px(0.25));
  for (const f of d.footways) {
    const pts = f.points.map(([x, y]) => ({ x, y }));
    drawPolyline(g, offsetPolylineRight(pts, px(1.1)));
    drawPolyline(g, offsetPolylineRight(pts, px(-1.1)));
  }
  // Parkings : marquage des places.
  g.noStroke();
  for (const lot of sim.world.lots) for (const s of lot.spots) s.drawMarking(g);
  // Station du tram : quais, abris vitrés.
  for (const ligne of Object.values(sim.transit.lines)) drawStation(g, quaiRect(ligne, px), px);
  // Maisons et immeubles alentour (ombre et toit simple).
  g.noStroke();
  g.fill(0, 0, 0, 40);
  for (const b of sim.campus.background) drawPolygon(g, b.points.map(([x, y]) => [x - px(4), y - px(1.5)]));
  g.fill(214, 200, 182);
  g.stroke(170, 155, 140);
  g.strokeWeight(0.5);
  for (const b of sim.campus.background) drawPolygon(g, b.points);
  // Bâtiments du parc : ombres portées, puis toits et portes.
  for (const b of sim.campus.buildings) b.drawShadow(g);
  for (const b of sim.campus.buildings) b.drawRoof(g);
  for (const b of sim.campus.buildings) b.drawDoor(g);
  // Bord de la piscine (carrelage blanc).
  const piscine = poolRect(sim);
  if (piscine) {
    g.noFill();
    g.stroke(245);
    g.strokeWeight(px(0.6));
    g.rectMode(CENTER);
    g.rect(piscine.x, piscine.y, piscine.l + px(0.6), piscine.w + px(0.6), px(0.8));
    g.rectMode(CORNER);
  }
  // Arbres : ombre, puis houppier avec dégradé (lumière du sud-est).
  g.noStroke();
  g.fill(0, 0, 0, 60);
  for (const a of arbres) g.ellipse(a.x - a.r * 0.7, a.y - a.r * 0.25, a.r * 2.1, a.r * 1.8);
  const ctx = g.drawingContext;
  for (const a of arbres) {
    const base = [52 + a.teinte * 25, 92 + a.teinte * 35, 40 + a.teinte * 15];
    const grad = ctx.createRadialGradient(a.x + a.r * 0.3, a.y + a.r * 0.2, a.r * 0.1, a.x, a.y, a.r);
    grad.addColorStop(0, `rgb(${base[0] + 45},${base[1] + 50},${base[2] + 25})`);
    grad.addColorStop(1, `rgb(${base[0] - 15},${base[1] - 20},${base[2] - 10})`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
    ctx.fill();
  }
  return g;
}

function drawStation(g, q, px) {
  g.push();
  g.translate(q.centre.x, q.centre.y);
  g.rotate(q.angle);
  g.rectMode(CENTER);
  g.noStroke();
  // Bande podotactile jaune côté voie.
  g.fill(240, 200, 40);
  g.rect(0, -q.largeur / 2 + px(0.3), q.longueur, px(0.5));
  // Abris vitrés : ombre, toit sombre, vitre claire.
  for (const x of [-q.longueur * 0.3, 0, q.longueur * 0.3]) {
    g.fill(0, 0, 0, 60);
    g.rect(x - px(0.6), px(0.4), px(9), px(2.6));
    g.fill(60, 66, 74);
    g.rect(x, 0, px(9), px(2.4));
    g.fill(150, 190, 215, 160);
    g.rect(x, px(0.6), px(8.4), px(0.5));
  }
  // Panneau de station.
  g.fill(220, 60, 40);
  g.rect(q.longueur * 0.45, 0, px(1.2), px(1.2), px(0.2));
  g.pop();
}
