// Décor posé sur l'herbe (étape 31) : arbres, sapins, buissons, rochers, fleurs,
// tentes, étangs, tribunes le long des lignes droites et piles de pneus à
// l'extérieur des virages. Plus d'herbe vide : chaque case de la grille assez
// loin de la piste reçoit un objet. Règle de scène purement décorative : les
// objets ne sont pas des murs, les rayons et les voitures les ignorent.
// Placement calculé une fois par circuit (graine fixe), dessiné dans le décor
// pré-rendu (track-renderer.js) : aucun coût par image.
const SCENERY_CELL = 30;             // px : une case de la grille = un objet au plus
const SCENERY_JITTER = 9;            // px : décalage aléatoire dans la case
const SCENERY_TRACK_GAP = 14;        // px entre le bord de la piste et un objet
const SCENERY_SPACING = 2;           // px entre deux objets
const SCENERY_CANVAS_MARGIN = 2;     // px : un objet reste entier dans le canvas
const TYRE_RADIUS = 4;               // px : pile de pneus
const TYRE_TRACK_GAP = 6;            // px : les pneus protègent le bord de piste
const GRANDSTAND_DEPTH = 26;         // px : profondeur d'une tribune
const GRANDSTAND_MAX_LENGTH = 150;   // px
const GRANDSTAND_MIN_STRAIGHT = 100; // px : ligne droite assez longue pour une tribune
const GRANDSTAND_MAX_COUNT = 3;
const POND_ATTEMPTS = 40;            // essais bornés pour placer les étangs
const POND_MAX_COUNT = 2;

// Objets ronds : poids du tirage, rayon minimal et maximal (px).
const SCENERY_KINDS = {
  arbre: { weight: 30, rMin: 9, rMax: 14 },
  sapin: { weight: 16, rMin: 8, rMax: 12 },
  buisson: { weight: 20, rMin: 5, rMax: 8 },
  rocher: { weight: 10, rMin: 4, rMax: 7 },
  fleurs: { weight: 16, rMin: 5, rMax: 8 },
  tente: { weight: 8, rMin: 7, rMax: 9 }
};
const SCENERY_FALLBACK = ["buisson", "fleurs"];   // plus petits : essayés si le premier tirage ne tient pas

// ---------- Placement (fonctions pures, testées) ----------

// Distance (px) d'un point au bord d'un objet ; négative à l'intérieur.
// Tribunes : rectangle orienté ; autres objets : disque (étang : ellipse approchée par son grand rayon).
function sceneryDistance(item, x, y) {
  if (item.type === "tribune") {
    const c = Math.cos(item.angle);
    const s = Math.sin(item.angle);
    const u = Math.abs((x - item.x) * c + (y - item.y) * s) - item.length / 2;
    const v = Math.abs(-(x - item.x) * s + (y - item.y) * c) - item.depth / 2;
    return u <= 0 && v <= 0 ? Math.max(u, v) : Math.hypot(Math.max(u, 0), Math.max(v, 0));
  }
  return Math.hypot(x - item.x, y - item.y) - item.r;
}

// Points du contour d'une tribune (pour vérifier qu'elle ne touche pas la piste).
function grandstandPerimeter(item, step = 8) {
  const c = Math.cos(item.angle);
  const s = Math.sin(item.angle);
  const points = [];
  const add = (u, v) => points.push({ x: item.x + u * c - v * s, y: item.y + u * s + v * c });
  const hl = item.length / 2;
  const hd = item.depth / 2;
  for (let u = -hl; u <= hl + 1e-9; u += Math.max(1, (2 * hl) / Math.ceil((2 * hl) / step))) { add(u, -hd); add(u, hd); }
  for (let v = -hd; v <= hd + 1e-9; v += Math.max(1, (2 * hd) / Math.ceil((2 * hd) / step))) { add(-hl, v); add(hl, v); }
  return points;
}

// Distance d'un point au bord de la piste (négative sur la piste).
function distanceToTrack(circuit, x, y) {
  return circuit.project({ x, y }).distance - circuit.trackWidth / 2;
}

function fitsCanvas(x, y, r, width, height) {
  return x - r >= SCENERY_CANVAS_MARGIN && y - r >= SCENERY_CANVAS_MARGIN &&
    x + r <= width - SCENERY_CANVAS_MARGIN && y + r <= height - SCENERY_CANVAS_MARGIN;
}

function freeOf(items, x, y, r) {
  return items.every((item) => sceneryDistance(item, x, y) >= r + SCENERY_SPACING);
}

// Changement de cap (rad, + = à droite) entre les points i - span et i + span.
function headingChange(circuit, i, span) {
  const n = circuit.tangents.length;
  const a = circuit.tangents[(i - span + n) % n];
  const b = circuit.tangents[(i + span) % n];
  return Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y);
}

// Lignes droites : suites d'indices où le cap change de moins de 6° sur ±60 px.
// Retourne [{ start, count }] triées de la plus longue à la plus courte.
function straightRuns(circuit) {
  const n = circuit.center.length;
  const span = Math.max(1, Math.round(60 / circuit.spacing));
  const straight = Array.from({ length: n }, (_, i) => Math.abs(headingChange(circuit, i, span)) < 0.1);
  if (straight.every(Boolean)) return [{ start: 0, count: n }];
  const first = straight.indexOf(false);
  const runs = [];
  let current = null;
  for (let k = 1; k <= n; k++) {
    const i = (first + k) % n;
    if (straight[i]) {
      if (current) current.count++;
      else current = { start: i, count: 1 };
    } else if (current) {
      runs.push(current);
      current = null;
    }
  }
  if (current) runs.push(current);
  return runs.sort((a, b) => b.count - a.count);
}

// Tribunes au milieu des plus longues lignes droites, du côté où elles tiennent.
function planGrandstands(circuit, rng, width, height, items) {
  const n = circuit.center.length;
  for (const run of straightRuns(circuit)) {
    if (items.filter((i) => i.type === "tribune").length >= GRANDSTAND_MAX_COUNT) break;
    const runLength = run.count * circuit.spacing;
    if (runLength < GRANDSTAND_MIN_STRAIGHT) break;
    const i = (run.start + Math.floor(run.count / 2)) % n;
    const c = circuit.center[i];
    const t = circuit.tangents[i];
    const length = Math.min(GRANDSTAND_MAX_LENGTH, runLength * 0.6);
    const offset = circuit.trackWidth / 2 + SCENERY_TRACK_GAP + GRANDSTAND_DEPTH / 2;
    const sides = rng() < 0.5 ? [1, -1] : [-1, 1];
    for (const side of sides) {
      const item = {
        type: "tribune", x: c.x + t.y * offset * side, y: c.y - t.x * offset * side,
        angle: Math.atan2(t.y, t.x), length, depth: GRANDSTAND_DEPTH, side, variant: Math.floor(rng() * 1e6)
      };
      const perimeter = grandstandPerimeter(item);
      const ok = perimeter.every((p) => fitsCanvas(p.x, p.y, 0, width, height) &&
        distanceToTrack(circuit, p.x, p.y) >= SCENERY_TRACK_GAP - 0.5) &&
        items.every((other) => perimeter.every((p) => sceneryDistance(other, p.x, p.y) >= SCENERY_SPACING));
      if (ok) {
        items.push(item);
        break;
      }
    }
  }
}

// Piles de pneus (3 par virage) à l'extérieur des virages serrés.
function planTyres(circuit, items, width, height) {
  const n = circuit.center.length;
  const span = Math.max(1, Math.round(18 / circuit.spacing));
  const turns = Array.from({ length: n }, (_, i) => headingChange(circuit, i, span));
  let lastArc = -Infinity;
  for (let i = 0; i < n; i++) {
    const turn = turns[i];
    const isApex = Math.abs(turn) > 0.35 && Math.abs(turn) >= Math.abs(turns[(i - 1 + n) % n]) && Math.abs(turn) >= Math.abs(turns[(i + 1) % n]);
    if (!isApex || circuit.arc[i] - lastArc < 80) continue;
    lastArc = circuit.arc[i];
    const c = circuit.center[i];
    const t = circuit.tangents[i];
    const side = turn > 0 ? 1 : -1;   // virage à droite : l'extérieur est à gauche
    const offset = circuit.trackWidth / 2 + TYRE_TRACK_GAP + TYRE_RADIUS;
    for (const k of [-1, 0, 1]) {
      const x = c.x + t.y * offset * side + t.x * k * (2 * TYRE_RADIUS + 1);
      const y = c.y - t.x * offset * side + t.y * k * (2 * TYRE_RADIUS + 1);
      if (fitsCanvas(x, y, TYRE_RADIUS, width, height) && distanceToTrack(circuit, x, y) >= TYRE_TRACK_GAP + TYRE_RADIUS - 0.5 &&
        freeOf(items, x, y, TYRE_RADIUS)) {
        items.push({ type: "pneus", x, y, r: TYRE_RADIUS, angle: 0, variant: (i + k) & 1 });
      }
    }
  }
}

// Étangs : grands disques, en essais bornés.
function planPonds(circuit, rng, width, height, items) {
  let placed = 0;
  for (let attempt = 0; attempt < POND_ATTEMPTS && placed < POND_MAX_COUNT; attempt++) {
    const r = 26 + rng() * 16;
    const x = r + rng() * (width - 2 * r);
    const y = r + rng() * (height - 2 * r);
    if (fitsCanvas(x, y, r, width, height) && distanceToTrack(circuit, x, y) >= SCENERY_TRACK_GAP + r && freeOf(items, x, y, r)) {
      items.push({ type: "etang", x, y, r, angle: rng() * Math.PI, variant: Math.floor(rng() * 1e6) });
      placed++;
    }
  }
}

function pickKind(rng) {
  const total = Object.values(SCENERY_KINDS).reduce((s, k) => s + k.weight, 0);
  let r = rng() * total;
  for (const [type, kind] of Object.entries(SCENERY_KINDS)) {
    if (r < kind.weight) return type;
    r -= kind.weight;
  }
  return "arbre";
}

// Plan complet du décor d'un circuit. rng : générateur à graine (random.js).
// Retourne une liste d'objets { type, x, y, r | length + depth, angle, variant }.
function planScenery(circuit, rng, width = 1200, height = 760) {
  const items = [];
  planGrandstands(circuit, rng, width, height, items);
  planTyres(circuit, items, width, height);
  planPonds(circuit, rng, width, height, items);
  for (let cy = SCENERY_CELL / 2; cy < height; cy += SCENERY_CELL) {
    for (let cx = SCENERY_CELL / 2; cx < width; cx += SCENERY_CELL) {
      const jx = cx + (rng() * 2 - 1) * SCENERY_JITTER;
      const jy = cy + (rng() * 2 - 1) * SCENERY_JITTER;
      const first = pickKind(rng);
      const sizeRoll = rng();
      const angle = rng() * Math.PI * 2;
      const variant = Math.floor(rng() * 1e6);
      // Le tirage, puis des objets plus petits ; à la position décalée puis au centre de la case.
      for (const [x, y] of [[jx, jy], [cx, cy]]) {
        const clearance = distanceToTrack(circuit, x, y) - SCENERY_TRACK_GAP;
        const type = [first, ...SCENERY_FALLBACK].find((t) => {
          const kind = SCENERY_KINDS[t];
          const r = kind.rMin + sizeRoll * (kind.rMax - kind.rMin);
          return clearance >= r && fitsCanvas(x, y, r, width, height) && freeOf(items, x, y, r);
        });
        if (type) {
          const kind = SCENERY_KINDS[type];
          items.push({ type, x, y, r: kind.rMin + sizeRoll * (kind.rMax - kind.rMin), angle, variant });
          break;
        }
      }
    }
  }
  return items;
}

// ---------- Dessin (dans le p5.Graphics du décor pré-rendu) ----------

const FLOWER_COLORS = ["#ffd84d", "#ff6b8b", "#ffffff", "#b78cff", "#ff9f40"];
const TENT_COLORS = ["#e63946", "#1d4ed8", "#f59e0b", "#10b981"];
const SPECTATOR_COLORS = ["#e63946", "#ffd84d", "#1d4ed8", "#ffffff", "#10b981", "#ff9f40", "#111111"];

function drawScenery(g, items) {
  g.push();
  g.noStroke();
  // Ombres d'abord (lumière venant du haut à gauche), puis les objets.
  g.fill(0, 0, 0, 55);
  for (const item of items) {
    if (item.type === "arbre" || item.type === "sapin") g.ellipse(item.x + item.r * 0.35, item.y + item.r * 0.35, item.r * 2, item.r * 2);
    else if (item.type === "tente" || item.type === "rocher") g.ellipse(item.x + 2, item.y + 2, item.r * 2, item.r * 1.8);
  }
  for (const item of items) drawSceneryItem(g, item);
  g.pop();
}

function drawSceneryItem(g, item) {
  const { x, y, r, variant } = item;
  if (item.type === "arbre") {
    g.fill("#2f6b2a");
    g.ellipse(x, y, r * 2, r * 2);
    g.fill("#3f8a36");
    g.ellipse(x - r * 0.2, y - r * 0.2, r * 1.4, r * 1.4);
    g.fill("#5aa847");
    g.ellipse(x - r * 0.35, y - r * 0.4, r * 0.6, r * 0.6);
  } else if (item.type === "sapin") {
    g.fill("#1f5a2c");
    drawStar(g, x, y, r, r * 0.6, 8, item.angle);
    g.fill("#2e7a3c");
    drawStar(g, x, y, r * 0.6, r * 0.35, 8, item.angle + 0.2);
    g.fill("#6b4423");
    g.ellipse(x, y, r * 0.25, r * 0.25);
  } else if (item.type === "buisson") {
    g.fill("#3d7d30");
    for (let k = 0; k < 3; k++) {
      const a = item.angle + (k * Math.PI * 2) / 3;
      g.ellipse(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45, r * 1.2, r * 1.2);
    }
    g.fill("#5da84a");
    g.ellipse(x - r * 0.15, y - r * 0.2, r * 0.7, r * 0.7);
  } else if (item.type === "rocher") {
    g.fill("#7d8086");
    g.beginShape();
    for (let k = 0; k < 6; k++) {
      const a = item.angle + (k * Math.PI) / 3;
      const rr = r * (0.75 + 0.25 * (((variant >> k) & 1) ? 1 : 0.6));
      g.vertex(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.endShape(g.CLOSE);
    g.fill("#a9acb2");
    g.ellipse(x - r * 0.25, y - r * 0.25, r * 0.7, r * 0.5);
  } else if (item.type === "fleurs") {
    g.fill("#4f8f35");
    g.ellipse(x, y, r * 1.6, r * 1.6);
    for (let k = 0; k < 6; k++) {
      const a = item.angle + k * 1.1;
      const d = r * (0.3 + 0.12 * (k % 3));
      g.fill(FLOWER_COLORS[(variant + k) % FLOWER_COLORS.length]);
      g.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, 3, 3);
    }
  } else if (item.type === "tente") {
    const color = TENT_COLORS[variant % TENT_COLORS.length];
    g.push();
    g.translate(x, y);
    g.rotate(item.angle);
    g.rectMode(g.CENTER);
    g.fill(color);
    g.rect(0, 0, r * 1.6, r * 1.6);
    g.fill(255);
    g.rect(-r * 0.4, 0, r * 0.4, r * 1.6);
    g.rect(r * 0.4, 0, r * 0.4, r * 1.6);
    g.fill(0, 0, 0, 50);
    g.rect(0, 0, r * 1.6, r * 0.12);   // faîte du toit
    g.pop();
  } else if (item.type === "etang") {
    g.fill("#d8c38a");
    g.ellipse(x, y, r * 2.15, r * 1.65);
    g.fill("#3a7fc4");
    g.ellipse(x, y, r * 2, r * 1.5);
    g.fill("#6fb0e8");
    g.ellipse(x - r * 0.3, y - r * 0.2, r * 0.9, r * 0.45);
    g.fill("#2f6b2a");
    g.ellipse(x + r * 0.55, y + r * 0.3, 6, 6);   // nénuphar
  } else if (item.type === "pneus") {
    g.fill("#151515");
    g.ellipse(x, y, r * 2, r * 2);
    g.fill(variant ? "#e63946" : "#f2f2f2");
    g.ellipse(x, y, r * 1.2, r * 1.2);
    g.fill("#151515");
    g.ellipse(x, y, r * 0.7, r * 0.7);
  } else if (item.type === "tribune") {
    drawGrandstand(g, item);
  }
}

// Tribune : gradins gris, spectateurs colorés sur 3 rangées, toit côté opposé à la piste.
function drawGrandstand(g, item) {
  g.push();
  g.translate(item.x, item.y);
  g.rotate(item.angle);
  g.rectMode(g.CENTER);
  const hl = item.length / 2;
  const hd = item.depth / 2;
  g.fill(0, 0, 0, 60);
  g.rect(3, 3, item.length, item.depth);
  g.fill("#6d7178");
  g.rect(0, 0, item.length, item.depth);
  // Le côté piste est vers -side (la tribune est décalée de +side × normale).
  const toTrack = -item.side;
  for (let row = 0; row < 3; row++) {
    const v = toTrack * (hd - 4 - row * 6);
    g.fill(row % 2 === 0 ? "#8a8f97" : "#7b8088");
    g.rect(0, v, item.length - 4, 5);
    for (let u = -hl + 4, k = 0; u <= hl - 4; u += 4, k++) {
      g.fill(SPECTATOR_COLORS[(item.variant + k * 7 + row * 3) % SPECTATOR_COLORS.length]);
      g.ellipse(u, v, 2.6, 2.6);
    }
  }
  g.fill("#c62828");
  g.rect(0, -toTrack * (hd - 3), item.length, 6);   // toit
  g.fill(255);
  for (let u = -hl + 6; u < hl - 6; u += 16) g.rect(u, -toTrack * (hd - 3), 6, 2);
  g.pop();
}

function drawStar(g, x, y, outer, inner, branches, angle) {
  g.beginShape();
  for (let k = 0; k < branches * 2; k++) {
    const a = angle + (k * Math.PI) / branches;
    const r = k % 2 === 0 ? outer : inner;
    g.vertex(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  g.endShape(g.CLOSE);
}
