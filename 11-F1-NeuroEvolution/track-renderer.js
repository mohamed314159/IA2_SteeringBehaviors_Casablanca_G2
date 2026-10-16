// Rendu statique du circuit (herbe, asphalte, vibreurs, ligne de départ),
// dessiné une seule fois dans un p5.Graphics puis affiché à chaque image.

// Indices de la ligne médiane situés dans un virage (changement de cap > seuil).
function curvedIndices(circuit, threshold = 0.06, span = 3) {
  const n = circuit.tangents.length;
  const result = new Set();
  for (let i = 0; i < n; i++) {
    const a = circuit.tangents[(i - span + n) % n];
    const b = circuit.tangents[(i + span) % n];
    const turn = Math.abs(Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y));
    if (turn > threshold) result.add(i);
  }
  return result;
}

function drawTrackLayer(g, circuit, rng) {
  drawGrass(g, g.width, g.height, rng);
  const n = circuit.center.length;

  g.push();
  g.noFill();
  g.strokeJoin(ROUND);

  // Bande de dégagement sombre puis asphalte.
  g.stroke(70, 90, 50, 120);
  g.strokeWeight(circuit.trackWidth + 10);
  drawClosedPolyline(g, circuit.center);
  g.stroke(62, 64, 68);
  g.strokeWeight(circuit.trackWidth);
  drawClosedPolyline(g, circuit.center);

  // Lignes blanches de bord.
  g.stroke(235);
  g.strokeWeight(1.5);
  drawClosedPolyline(g, circuit.leftEdge);
  drawClosedPolyline(g, circuit.rightEdge);

  // Vibreurs rouge/blanc dans les virages.
  const curved = curvedIndices(circuit);
  g.strokeWeight(4);
  g.strokeCap(SQUARE);
  for (const edge of [circuit.leftEdge, circuit.rightEdge]) {
    for (let i = 0; i < n; i++) {
      if (!curved.has(i)) continue;
      const a = edge[i];
      const b = edge[(i + 1) % n];
      g.stroke(Math.floor(i / 2) % 2 === 0 ? color(220, 30, 30) : color(245));
      g.line(a.x, a.y, b.x, b.y);
    }
  }

  // Ligne de départ en damier.
  const start = circuit.startPose(0);
  const l = circuit.leftEdge[start.index];
  const r = circuit.rightEdge[start.index];
  const squares = 8;
  g.noStroke();
  for (let k = 0; k < squares; k++) {
    for (let row = 0; row < 2; row++) {
      g.fill((k + row) % 2 === 0 ? 255 : 20);
      const t0 = k / squares;
      const t1 = (k + 1) / squares;
      const ox = Math.cos(start.heading) * 3 * row;
      const oy = Math.sin(start.heading) * 3 * row;
      g.quad(
        l.x + (r.x - l.x) * t0 + ox, l.y + (r.y - l.y) * t0 + oy,
        l.x + (r.x - l.x) * t1 + ox, l.y + (r.y - l.y) * t1 + oy,
        l.x + (r.x - l.x) * t1 + ox + Math.cos(start.heading) * 3, l.y + (r.y - l.y) * t1 + oy + Math.sin(start.heading) * 3,
        l.x + (r.x - l.x) * t0 + ox + Math.cos(start.heading) * 3, l.y + (r.y - l.y) * t0 + oy + Math.sin(start.heading) * 3
      );
    }
  }
  g.pop();
}

function drawClosedPolyline(g, points) {
  g.beginShape();
  for (const p of points) g.vertex(p.x, p.y);
  g.endShape(CLOSE);
}

// Miniature d'un circuit pour la vitrine des circuits : herbe unie, asphalte,
// bords blancs, ligne de départ et obstacles, à l'échelle `scale` du canvas du jeu.
function drawTrackThumbnail(g, circuit, scale, obstacles = [], canvasWidth = 1200, canvasHeight = 760) {
  const polyline = (points) => {
    g.beginShape();
    for (const p of points) g.vertex(p.x, p.y);
    g.endShape(g.CLOSE);
  };
  g.push();
  g.background(103, 156, 58);
  g.translate((g.width - canvasWidth * scale) / 2, (g.height - canvasHeight * scale) / 2);
  g.scale(scale);
  g.noFill();
  g.stroke(62, 64, 68);
  g.strokeWeight(circuit.trackWidth);
  polyline(circuit.center);
  g.stroke(235);
  g.strokeWeight(1.5 / scale);
  polyline(circuit.leftEdge);
  polyline(circuit.rightEdge);
  // Ligne de départ.
  const start = circuit.startPose(0);
  const l = circuit.leftEdge[start.index];
  const r = circuit.rightEdge[start.index];
  g.stroke(255, 216, 0);
  g.strokeWeight(3 / scale);
  g.line(l.x, l.y, r.x, r.y);
  // Obstacles posés.
  g.noStroke();
  g.fill(225, 40, 30);
  for (const obstacle of obstacles) {
    g.beginShape();
    for (const [x, y] of obstacle.points) g.vertex(x, y);
    g.endShape(g.CLOSE);
  }
  g.pop();
}
