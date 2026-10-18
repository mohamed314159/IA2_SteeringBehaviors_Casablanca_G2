// Géométrie du circuit : ligne médiane, bords (murs), progression sans checkpoints.
// Fonctions pures sur des points { x, y } : testables sans navigateur.

// Proportions d'une F1 : voiture 5,6 m x 2,0 m, piste d'environ 14 m de large.
const F1_CAR_LENGTH_M = 5.6;
const F1_CAR_WIDTH_M = 2.0;
const F1_TRACK_WIDTH_M = 14;

// Spline de Catmull-Rom fermée passant par chaque point de contrôle.
function catmullRomClosed(points, resolution = 12) {
  const n = points.length;
  const result = [];
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    for (let k = 0; k < resolution; k++) {
      const t = k / resolution;
      const t2 = t * t;
      const t3 = t2 * t;
      const coord = (c) => 0.5 * (
        2 * p1[c] +
        (-p0[c] + p2[c]) * t +
        (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 +
        (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3
      );
      result.push({ x: coord(0), y: coord(1) });
    }
  }
  return result;
}

// Ré-échantillonne une boucle fermée avec un espacement constant.
function resampleClosed(points, spacing) {
  const n = points.length;
  const lengths = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    lengths.push(d);
    total += d;
  }
  const count = Math.max(3, Math.round(total / spacing));
  const step = total / count;
  const result = [];
  let segment = 0;
  let accumulated = 0;
  for (let i = 0; i < count; i++) {
    const target = i * step;
    while (segment < n - 1 && accumulated + lengths[segment] < target) {
      accumulated += lengths[segment];
      segment++;
    }
    const a = points[segment];
    const b = points[(segment + 1) % n];
    const t = lengths[segment] === 0 ? 0 : (target - accumulated) / lengths[segment];
    result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return result;
}

// Distance d'un point à un segment, avec le paramètre t du point projeté.
function projectOnSegment(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  let t = lenSq === 0 ? 0 : ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq;
  t = Math.min(1, Math.max(0, t));
  const px = a.x + abx * t;
  const py = a.y + aby * t;
  return { t, distance: Math.hypot(p.x - px, p.y - py) };
}

function segmentsIntersect(p1, p2, p3, p4) {
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

// Point de croisement des droites (p1 p2) et (p3 p4) ; null si elles sont parallèles.
function segmentIntersection(p1, p2, p3, p4) {
  const den = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
  if (den === 0) return null;
  const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / den;
  return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
}

// Virage plus serré que la demi-largeur de piste : le bord intérieur, décalé de
// la ligne médiane, se replie en petite boucle à la corde. On la coupe au point
// de croisement : les points de la boucle sont ramenés sur ce point (même nombre
// de points, murs de longueur nulle ignorés par les rayons). La recherche est
// limitée à maxSpan segments (un virage), pour ne jamais masquer un vrai
// chevauchement entre deux portions éloignées du tracé.
function removeEdgeLoops(edge, maxSpan) {
  const n = edge.length;
  const out = edge.map((p) => ({ x: p.x, y: p.y }));
  for (let i = 0; i < n; i++) {
    const a = out[i];
    const b = out[(i + 1) % n];
    for (let span = Math.min(maxSpan, n - 2); span >= 2; span--) {   // la plus grande boucle d'abord
      const c = out[(i + span) % n];
      const d = out[(i + span + 1) % n];
      if (!segmentsIntersect(a, b, c, d)) continue;
      const p = segmentIntersection(a, b, c, d);
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      for (let k = 1; k <= span; k++) out[(i + k) % n] = { x: p.x, y: p.y };
      break;
    }
  }
  return out;
}

// Ramène une différence d'abscisse curviligne dans [-L/2, L/2] (passage de la ligne).
function wrapArcDelta(delta, totalLength) {
  if (delta > totalLength / 2) return delta - totalLength;
  if (delta < -totalLength / 2) return delta + totalLength;
  return delta;
}

class Circuit {
  // layout : { name, points: [[x, y], ...] } ; options en pixels.
  constructor(layout, options = {}) {
    const {
      canvasWidth = 1200,
      canvasHeight = 760,
      margin = 50,
      trackWidth = 44,
      spacing = 6
    } = options;
    this.name = layout.name;
    this.key = options.key ?? layout.name;   // identifiant stable (garage, confiance par circuit)
    // Échelle : une piste F1 standard (trackWidth px) = 14 m. Un tracé peut
    // imposer une autre largeur en mètres (piste étroite) : la voiture garde sa taille.
    this.pixelsPerMeter = options.pixelsPerMeter ?? trackWidth / F1_TRACK_WIDTH_M;
    this.trackWidth = layout.trackWidthMeters ? layout.trackWidthMeters * this.pixelsPerMeter : trackWidth;
    this.carLength = F1_CAR_LENGTH_M * this.pixelsPerMeter;
    this.carWidth = F1_CAR_WIDTH_M * this.pixelsPerMeter;
    // Tours à boucler pour terminer (null : règle par défaut de la voiture).
    this.raceLaps = layout.raceLaps ?? null;
    this.skill = layout.skill ?? null;

    // Taille du tracé : il remplit le canvas, ou seulement une part de sa
    // surface (areaRatio, ex. 1/4 pour les niveaux d'entraînement), centré.
    this.areaRatio = Circuit.validAreaRatio(layout.areaRatio);
    const fitted = Circuit.fitToCanvas(layout.points, canvasWidth, canvasHeight, margin + this.trackWidth / 2, Math.sqrt(this.areaRatio));
    this.spacing = spacing;
    this.center = resampleClosed(catmullRomClosed(fitted, 12), spacing);
    this.buildEdges();
    this.buildArcLengths();
    this.buildWallGrid(80);
  }

  // areaRatio dans ]0, 1] ; absent ou invalide → 1 (tout le canvas).
  static validAreaRatio(areaRatio) {
    return Number.isFinite(areaRatio) && areaRatio > 0 && areaRatio <= 1 ? areaRatio : 1;
  }

  // sizeFactor : facteur linéaire (0,5 → surface divisée par 4), tracé centré.
  static fitToCanvas(points, w, h, margin, sizeFactor = 1) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of points) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const scale = Math.min((w - 2 * margin) / (maxX - minX), (h - 2 * margin) / (maxY - minY)) * sizeFactor;
    const offX = (w - (maxX - minX) * scale) / 2;
    const offY = (h - (maxY - minY) * scale) / 2;
    return points.map(([x, y]) => [(x - minX) * scale + offX, (y - minY) * scale + offY]);
  }

  // Bords gauche/droit décalés de trackWidth/2 selon la normale locale.
  buildEdges() {
    const n = this.center.length;
    const half = this.trackWidth / 2;
    this.tangents = [];
    this.leftEdge = [];
    this.rightEdge = [];
    for (let i = 0; i < n; i++) {
      const prev = this.center[(i - 2 + n) % n];
      const next = this.center[(i + 2) % n];
      const len = Math.hypot(next.x - prev.x, next.y - prev.y) || 1;
      const tx = (next.x - prev.x) / len;
      const ty = (next.y - prev.y) / len;
      this.tangents.push({ x: tx, y: ty });
      const c = this.center[i];
      this.leftEdge.push({ x: c.x + ty * half, y: c.y - tx * half });
      this.rightEdge.push({ x: c.x - ty * half, y: c.y + tx * half });
    }
    // Virages très serrés autorisés (étape 21) : boucle du bord intérieur coupée.
    // Une boucle vient d'un virage d'au plus un demi-tour : arc ≤ π × largeur.
    const maxSpan = Math.ceil((Math.PI * this.trackWidth) / this.spacing);
    this.leftEdge = removeEdgeLoops(this.leftEdge, maxSpan);
    this.rightEdge = removeEdgeLoops(this.rightEdge, maxSpan);
    this.walls = [];
    for (const edge of [this.leftEdge, this.rightEdge]) {
      for (let i = 0; i < n; i++) {
        this.walls.push({ a: edge[i], b: edge[(i + 1) % n] });
      }
    }
  }

  buildArcLengths() {
    const n = this.center.length;
    this.arc = [0];
    for (let i = 1; i <= n; i++) {
      const a = this.center[i - 1];
      const b = this.center[i % n];
      this.arc.push(this.arc[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
    }
    this.totalLength = this.arc[n];
  }

  // Grille spatiale : chaque cellule liste les murs qui la touchent (boîte englobante).
  buildWallGrid(cellSize) {
    this.cellSize = cellSize;
    this.wallGrid = new Map();
    this.nearCache = new Map();   // fenêtre de cases → murs (wallsNear, étape 26)
    // Cases occupées (bornes) : un très long rayon ne parcourt pas des cases vides.
    this.gridBounds = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    for (const wall of this.walls) {
      const x0 = Math.floor(Math.min(wall.a.x, wall.b.x) / cellSize);
      const x1 = Math.floor(Math.max(wall.a.x, wall.b.x) / cellSize);
      const y0 = Math.floor(Math.min(wall.a.y, wall.b.y) / cellSize);
      const y1 = Math.floor(Math.max(wall.a.y, wall.b.y) / cellSize);
      for (let cx = x0; cx <= x1; cx++) {
        for (let cy = y0; cy <= y1; cy++) {
          const key = cx + "," + cy;
          if (!this.wallGrid.has(key)) this.wallGrid.set(key, []);
          this.gridBounds.x0 = Math.min(this.gridBounds.x0, cx);
          this.gridBounds.x1 = Math.max(this.gridBounds.x1, cx);
          this.gridBounds.y0 = Math.min(this.gridBounds.y0, cy);
          this.gridBounds.y1 = Math.max(this.gridBounds.y1, cy);
          this.wallGrid.get(key).push(wall);
        }
      }
    }
  }

  // Murs dont la cellule est à moins de `radius` de la position (sans doublon).
  // Le résultat d'une même fenêtre de cases est mémorisé (étape 26) : les
  // voitures voisines partagent la même liste, à ne pas modifier.
  wallsNear(pos, radius) {
    const b = this.gridBounds;
    const x0 = Math.max(b.x0, Math.floor((pos.x - radius) / this.cellSize));
    const x1 = Math.min(b.x1, Math.floor((pos.x + radius) / this.cellSize));
    const y0 = Math.max(b.y0, Math.floor((pos.y - radius) / this.cellSize));
    const y1 = Math.min(b.y1, Math.floor((pos.y + radius) / this.cellSize));
    // Rayon couvrant toute la grille : tous les murs, sans parcourir les cases.
    if (x0 === b.x0 && x1 === b.x1 && y0 === b.y0 && y1 === b.y1) return this.walls;
    const key = x0 + "," + x1 + "," + y0 + "," + y1;
    const cached = this.nearCache.get(key);
    if (cached) return cached;
    const found = new Set();
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const list = this.wallGrid.get(cx + "," + cy);
        if (list) for (const wall of list) found.add(wall);
      }
    }
    const walls = [...found];
    this.nearCache.set(key, walls);
    return walls;
  }

  // Projection sur la ligne médiane. Avec hintIndex, recherche locale (±window
  // segments) pour ne pas sauter vers une portion voisine du tracé.
  // Calcul en ligne (étape 26) : même résultat que projectOnSegment sur chaque
  // segment, sans créer d'objet par segment visité (appelé à chaque pas par voiture).
  project(pos, hintIndex = null, window = 25) {
    const n = this.center.length;
    const first = hintIndex === null ? 0 : hintIndex - window;
    const count = hintIndex === null ? n : 2 * window + 1;
    let bestIndex = 0;
    let bestT = 0;
    let bestSq = Infinity;       // distance au carré : tri rapide des segments
    let bestDistance = Infinity; // distance exacte (Math.hypot) du meilleur segment
    for (let k = 0; k < count; k++) {
      const i = (((first + k) % n) + n) % n;
      const a = this.center[i];
      const b = this.center[(i + 1) % n];
      const abx = b.x - a.x;
      const aby = b.y - a.y;
      const lenSq = abx * abx + aby * aby;
      let t = lenSq === 0 ? 0 : ((pos.x - a.x) * abx + (pos.y - a.y) * aby) / lenSq;
      t = t < 0 ? 0 : t > 1 ? 1 : t;   // = Math.min(1, Math.max(0, t))
      const dx = pos.x - (a.x + abx * t);
      const dy = pos.y - (a.y + aby * t);
      const sq = dx * dx + dy * dy;
      // Segment nettement plus loin : écarté sans racine. Sinon (meilleur ou
      // quasi-égalité), départage exact par Math.hypot, comme projectOnSegment.
      if (sq > bestSq * (1 + 1e-9)) continue;
      const distance = Math.hypot(dx, dy);
      if (distance < bestDistance) {
        bestIndex = i;
        bestT = t;
        bestDistance = distance;
        bestSq = sq;
      }
    }
    const segLen = this.arc[bestIndex + 1] - this.arc[bestIndex];
    return { index: bestIndex, t: bestT, distance: bestDistance, s: this.arc[bestIndex] + bestT * segLen };
  }

  // Pose de départ : position sur la ligne médiane et cap dans le sens de course.
  startPose(offsetIndex = 0) {
    const n = this.center.length;
    const i = ((offsetIndex % n) + n) % n;
    const t = this.tangents[i];
    return { x: this.center[i].x, y: this.center[i].y, heading: Math.atan2(t.y, t.x), index: i };
  }

  // Vrai si un bord se croise lui-même ou croise l'autre bord (tracé invalide).
  hasSelfIntersection() {
    const edges = [this.leftEdge, this.rightEdge];
    const segs = [];
    for (let e = 0; e < 2; e++) {
      const pts = edges[e];
      for (let i = 0; i < pts.length; i++) segs.push({ e, i, a: pts[i], b: pts[(i + 1) % pts.length] });
    }
    const n = this.center.length;
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        const s = segs[i];
        const r = segs[j];
        if (s.e === r.e) {
          const gap = Math.abs(s.i - r.i);
          if (gap <= 1 || gap >= n - 1) continue; // segments adjacents
        }
        // Deux segments qui se touchent au point de coupe d'une boucle ne se croisent pas.
        const touch = (p, q) => p.x === q.x && p.y === q.y;
        if (touch(s.a, r.a) || touch(s.a, r.b) || touch(s.b, r.a) || touch(s.b, r.b)) continue;
        if (segmentsIntersect(s.a, s.b, r.a, r.b)) return true;
      }
    }
    return false;
  }
}

// Suivi de progression d'une voiture : tours et pourcentage de tour, calculés
// par abscisse curviligne sur la ligne médiane (pas de checkpoints).
class LapTracker {
  constructor(circuit, pos) {
    this.circuit = circuit;
    const p = circuit.project(pos);
    this.index = p.index;
    this.lastS = p.s;
    this.distance = 0; // distance parcourue dans le sens de course (px, peut être < 0)
    this.offset = p.distance; // écart latéral à la ligne médiane
  }

  update(pos) {
    const p = this.circuit.project(pos, this.index);
    this.distance += wrapArcDelta(p.s - this.lastS, this.circuit.totalLength);
    this.lastS = p.s;
    this.index = p.index;
    this.offset = p.distance;
    return this.progress;
  }

  // Progression en tours (ex. 1.25 = un tour et 25 %).
  get progress() {
    return this.distance / this.circuit.totalLength;
  }

  get laps() {
    return Math.max(0, Math.floor(this.progress));
  }

  get lapPercent() {
    const p = this.progress;
    return p <= 0 ? 0 : (p - Math.floor(p)) * 100;
  }
}
