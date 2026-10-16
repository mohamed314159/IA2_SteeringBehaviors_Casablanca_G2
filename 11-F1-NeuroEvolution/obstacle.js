// Obstacle posé sur le circuit : entité immobile qui étend Vehicle sans
// jamais appeler sa locomotion (update). Sa forme est un polygone dessiné dans
// le menu ; ses côtés sont des murs pour les rayons capteurs, et une voiture
// qui le touche est éliminée (règle de scène).
const OBSTACLE_MIN_POINTS = 3;
const OBSTACLE_MAX_POINTS = 24;
const OBSTACLE_MIN_AREA = 4;              // px² : en dessous, la forme est un trait
const OBSTACLES_STORAGE_KEY = "f1-neuroevolution-obstacles-v1";

// Formes toutes faites, en coordonnées normalisées dans [-1, 1].
const OBSTACLE_PRESETS = {
  "pile de pneus": Array.from({ length: 10 }, (_, i) => [Math.cos((i / 10) * Math.PI * 2), Math.sin((i / 10) * Math.PI * 2)]),
  "bloc": [[-1, -1], [1, -1], [1, 1], [-1, 1]],
  "triangle": [[0, -1], [1, 0.8], [-1, 0.8]],
  "barrière": [[-1, -0.25], [1, -0.25], [1, 0.25], [-1, 0.25]]
};

// ---------- Géométrie pure ----------

function polygonArea(points) {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

function polygonCentroid(points) {
  const n = points.length;
  return [points.reduce((s, p) => s + p[0], 0) / n, points.reduce((s, p) => s + p[1], 0) / n];
}

// Retourne un message d'erreur si le polygone ne peut pas être un obstacle, sinon null.
function validateShape(points) {
  if (!Array.isArray(points) || points.length < OBSTACLE_MIN_POINTS) return `au moins ${OBSTACLE_MIN_POINTS} points`;
  if (points.length > OBSTACLE_MAX_POINTS) return `${OBSTACLE_MAX_POINTS} points au maximum`;
  if (!points.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) return "coordonnées invalides";
  const n = points.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue; // côtés voisins
      const a = { x: points[i][0], y: points[i][1] };
      const b = { x: points[(i + 1) % n][0], y: points[(i + 1) % n][1] };
      const c = { x: points[j][0], y: points[j][1] };
      const d = { x: points[(j + 1) % n][0], y: points[(j + 1) % n][1] };
      if (segmentsIntersect(a, b, c, d)) return "les côtés se croisent";
    }
  }
  if (polygonArea(points) < OBSTACLE_MIN_AREA) return "forme trop plate";
  return null;
}

// Forme dessinée → forme de l'obstacle : centrée sur son centre, mise à
// l'échelle pour que sa plus grande dimension mesure sizeMeters.
function normalizeShape(points, sizeMeters, pixelsPerMeter) {
  const [cx, cy] = polygonCentroid(points);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) || 1;
  const scale = (sizeMeters * pixelsPerMeter) / extent;
  return points.map(([x, y]) => [(x - cx) * scale, (y - cy) * scale]);
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ---------- Entité ----------

class Obstacle extends Vehicle {
  // x, y : position du centre (px) ; shape : points relatifs au centre (px) ;
  // rotation : angle (rad). Immobile : vitesse nulle, update() n'est jamais appelé.
  constructor(x, y, shape, rotation = 0) {
    super(x, y);
    this.maxSpeed = 0;
    this.maxForce = 0;
    this.shape = shape.map((p) => [p[0], p[1]]);
    this.rotation = rotation;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    this.points = this.shape.map(([px, py]) => [x + px * cos - py * sin, y + px * sin + py * cos]);
    this.walls = this.points.map((p, i) => {
      const q = this.points[(i + 1) % this.points.length];
      return { a: { x: p[0], y: p[1] }, b: { x: q[0], y: q[1] } };
    });
  }

  containsPoint(pos) {
    return pointInPolygon(pos.x, pos.y, this.points);
  }

  distanceTo(pos) {
    return Math.min(...this.walls.map((w) => projectOnSegment(pos, w.a, w.b).distance));
  }

  // Une voiture de « rayon » radius touche l'obstacle.
  collides(pos, radius) {
    return this.containsPoint(pos) || this.distanceTo(pos) < radius;
  }

  show(highlight = false) {
    push();
    stroke(highlight ? color(255, 216, 0) : color(20));
    strokeWeight(2);
    fill(highlight ? color(255, 120, 0, 170) : color(225, 40, 30));
    beginShape();
    for (const [px, py] of this.points) vertex(px, py);
    endShape(CLOSE);
    // Bandes blanches façon barrière de sécurité.
    stroke(255, 230);
    strokeWeight(1.5);
    const [cx, cy] = polygonCentroid(this.points);
    for (const [px, py] of this.points) line(cx + (px - cx) * 0.55, cy + (py - cy) * 0.55, cx + (px - cx) * 0.85, cy + (py - cy) * 0.85);
    pop();
  }

  toJSON() {
    return { x: this.pos.x, y: this.pos.y, rotation: this.rotation, shape: this.shape.map((p) => [p[0], p[1]]) };
  }

  static fromJSON(data) {
    return new Obstacle(data.x, data.y, data.shape, data.rotation ?? 0);
  }
}

// ---------- Mémorisation par circuit ----------

function loadObstacles(storage, circuitKey) {
  if (!storage) return [];
  try {
    const all = JSON.parse(storage.getItem(OBSTACLES_STORAGE_KEY) || "{}");
    const list = Array.isArray(all[circuitKey]) ? all[circuitKey] : [];
    return list
      .filter((o) => Number.isFinite(o.x) && Number.isFinite(o.y) && validateShape(o.shape) === null)
      .map((o) => Obstacle.fromJSON(o));
  } catch (error) {
    return [];
  }
}

function saveObstacles(storage, circuitKey, obstacles) {
  if (!storage) return;
  try {
    const all = JSON.parse(storage.getItem(OBSTACLES_STORAGE_KEY) || "{}");
    if (obstacles.length > 0) all[circuitKey] = obstacles.map((o) => o.toJSON());
    else delete all[circuitKey];
    storage.setItem(OBSTACLES_STORAGE_KEY, JSON.stringify(all));
  } catch (error) {
    // stockage bloqué ou illisible : les obstacles restent pour cette page
  }
}

// Tous les murs des obstacles (pour les rayons capteurs).
function obstacleWalls(obstacles) {
  return obstacles.flatMap((o) => o.walls);
}
