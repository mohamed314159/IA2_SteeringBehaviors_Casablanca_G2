// Niveaux d'entraînement : chaque circuit fait travailler une compétence.
// Même format que circuits-data.js (repère 100 x 60, sens de course), plus :
//   level            : ordre du niveau (1 = plus facile)
//   skill            : compétence travaillée
//   raceLaps         : tours à boucler pour valider le niveau (1)
//   trackWidthMeters : largeur de piste si différente des 14 m d'une piste F1
//   areaRatio        : part de la surface du canvas occupée par le tracé
// Pour ajouter un niveau : ajouter une entrée ici (puis vérifier les tests).

// Les niveaux sont 4 fois plus petits en surface qu'un circuit F1 (tracé 2 fois
// plus court dans chaque direction), avec la même largeur de piste et la même
// voiture : les virages sont donc plus serrés. Le slalom et les épingles ont
// été redessinés pour que les bords ne se croisent pas à cette taille.

// Points d'une ellipse parcourue dans le sens horaire (écran).
function ellipsePoints(cx, cy, rx, ry, count) {
  const points = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    points.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return points;
}

// Ligne ondulée de x0 à x1 (slalom) autour de la hauteur y.
function wavePoints(x0, x1, y, amplitude, periods, count) {
  const points = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    points.push([x0 + (x1 - x0) * t, y + amplitude * Math.sin(t * periods * Math.PI * 2)]);
  }
  return points;
}

// Arc d'ellipse de fromDeg à toDeg (sens de course = sens des angles), count + 1 points.
// Sur l'écran (y vers le bas), des angles croissants tournent à droite.
function arcPoints(cx, cy, rx, ry, fromDeg, toDeg, count) {
  const points = [];
  for (let i = 0; i <= count; i++) {
    const a = ((fromDeg + ((toDeg - fromDeg) * i) / count) * Math.PI) / 180;
    points.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return points;
}

// Spirale : comme arcPoints, mais le rayon passe de r0 à r1 (virage qui se referme si r1 < r0).
// stretchX étire la spirale horizontalement.
function spiralPoints(cx, cy, r0, r1, fromDeg, toDeg, count, stretchX = 1) {
  const points = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const a = ((fromDeg + (toDeg - fromDeg) * t) * Math.PI) / 180;
    const r = r0 + (r1 - r0) * t;
    points.push([cx + stretchX * r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return points;
}

// Symétrique gauche-droite dans le repère 100 x 60 : mêmes points, virages inversés.
function mirrorX(points) {
  return points.map(([x, y]) => [100 - x, y]);
}

// Polygone aux coins arrondis (étape 25) : chaque coin est remplacé par une courbe
// de Bézier quadratique qui commence et finit à `cut` du coin (au plus 45 % des côtés).
function roundCorners(points, cut, steps = 4) {
  const n = points.length;
  const rounded = [];
  for (let i = 0; i < n; i++) {
    const [px, py] = points[i];
    const [ax, ay] = points[(i - 1 + n) % n];
    const [bx, by] = points[(i + 1) % n];
    const lenA = Math.hypot(ax - px, ay - py);
    const lenB = Math.hypot(bx - px, by - py);
    const tA = Math.min(cut, 0.45 * lenA) / lenA;
    const tB = Math.min(cut, 0.45 * lenB) / lenB;
    const start = [px + (ax - px) * tA, py + (ay - py) * tA];
    const end = [px + (bx - px) * tB, py + (by - py) * tB];
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const u = 1 - t;
      rounded.push([
        u * u * start[0] + 2 * u * t * px + t * t * end[0],
        u * u * start[1] + 2 * u * t * py + t * t * end[1]
      ]);
    }
  }
  return rounded;
}

// Points de contrôle régulièrement espacés (au plus maxStep entre deux) : la spline de
// Catmull-Rom déborde et fait des boucles quand des points serrés suivent un long côté.
function densify(points, maxStep = 2.5) {
  const dense = [];
  for (let i = 0; i < points.length; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % points.length];
    const parts = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / maxStep));
    for (let k = 0; k < parts; k++) dense.push([ax + ((bx - ax) * k) / parts, ay + ((by - ay) * k) / parts]);
  }
  return dense;
}

// Courbe polaire r = base + bump × cos(lobes × angle), parcourue dans le sens horaire :
// des lobes (virages à droite) séparés par des creux (virages à gauche).
function lobePoints(cx, cy, base, bump, lobes, count, stretchX = 1) {
  const points = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    const r = base + bump * Math.cos(lobes * (a + Math.PI / 2));
    points.push([cx + stretchX * r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return points;
}

// Étoile : sommets alternés entre le rayon extérieur (pointes) et intérieur (creux), sens horaire.
function starPoints(cx, cy, outer, inner, branches, stretchX = 1) {
  const points = [];
  for (let i = 0; i < branches * 2; i++) {
    const a = (i / (branches * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    points.push([cx + stretchX * r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return points;
}

// Drift à gauche : ligne droite qui descend, puis une grande courbe à gauche (forme de D).
const DRIFT_LEFT_POINTS = [[14, 12], [14, 30], [14, 48], ...arcPoints(30, 30, 62, 24, 100, -100, 14)];

const TRAINING_AREA_RATIO = 1 / 4;   // surface divisée par 4 (étape 19)

const TRAINING_CIRCUITS = {
  "niveau-1-circulaire": {
    name: "Niveau 1 – Circulaire",
    level: 1,
    skill: "tenir un virage constant sans toucher les bords",
    raceLaps: 1,
    areaRatio: TRAINING_AREA_RATIO,
    points: ellipsePoints(50, 30, 40, 24, 24)
  },
  "niveau-2-carre": {
    name: "Niveau 2 – Carré",
    level: 2,
    skill: "freiner et tourner à 90° puis réaccélérer",
    raceLaps: 1,
    areaRatio: TRAINING_AREA_RATIO,
    points: [
      [10, 5], [50, 5], [90, 5],
      [90, 30], [90, 55],
      [50, 55], [10, 55],
      [10, 30]
    ]
  },
  "niveau-3-drift": {
    name: "Niveau 3 – Drift (slalom)",
    level: 3,
    skill: "enchaîner les changements de direction à vitesse élevée",
    raceLaps: 1,
    areaRatio: TRAINING_AREA_RATIO,
    points: [
      ...wavePoints(18, 82, 14, 4, 2, 16),            // amplitude 4 (5 avant la réduction)
      [94, 18], [96, 30], [94, 42],
      ...wavePoints(82, 18, 46, 4, 2, 16),
      [6, 42], [4, 30], [6, 18]
    ]
  },
  "niveau-4-epingles": {
    name: "Niveau 4 – Épingles aller-retour",
    level: 4,
    skill: "virages en épingle : demi-tours serrés dans un sens puis dans l'autre",
    raceLaps: 1,
    areaRatio: TRAINING_AREA_RATIO,
    // 3 épingles plus larges (5 avant la réduction) : sinon les bords se croisent.
    points: [
      [8, 46], [8, 14], [16.8, 5], [25.6, 14],        // montée, épingle haute
      [25.6, 34], [34.4, 43], [43.2, 34],             // descente, épingle basse
      [43.2, 14], [52, 5], [60.8, 14],                // montée, épingle haute
      [60.8, 46], [54.2, 56],                         // retour par le bas
      [34.4, 57], [14.6, 56]
    ]
  },
  "niveau-5-coince": {
    name: "Niveau 5 – Passage coincé",
    level: 5,
    skill: "piste étroite (10 m) et chicanes serrées : précision",
    raceLaps: 1,
    trackWidthMeters: 10,
    areaRatio: TRAINING_AREA_RATIO,
    points: [
      [10, 8], [33, 8], [45, 16], [57, 8], [90, 8],
      [92, 20], [83, 31], [92, 42], [90, 54],
      [67, 54], [55, 46], [43, 54], [10, 54],
      [8, 42], [17, 31], [8, 20]
    ]
  },

  // ---------- Bases de la course (étape 20) ----------
  "niveau-6-drift-gauche": {
    name: "Niveau 6 – Drift à gauche",
    level: 6,
    skill: "tenir une longue courbe à gauche à vitesse élevée (tous les virages à gauche)",
    raceLaps: 1,
    areaRatio: TRAINING_AREA_RATIO,
    points: DRIFT_LEFT_POINTS
  },
  "niveau-7-drift-droite": {
    name: "Niveau 7 – Drift à droite",
    level: 7,
    skill: "tenir une longue courbe à droite à vitesse élevée (tous les virages à droite)",
    raceLaps: 1,
    areaRatio: TRAINING_AREA_RATIO,
    points: mirrorX(DRIFT_LEFT_POINTS)
  },
  "niveau-8-freinage": {
    name: "Niveau 8 – Freinage avant l'épingle",
    level: 8,
    skill: "freiner fort au bout d'une longue ligne droite, faire demi-tour, réaccélérer",
    raceLaps: 1,
    areaRatio: TRAINING_AREA_RATIO,
    points: [
      [18, 16], [50, 16], [82, 16],                   // ligne droite
      ...arcPoints(82, 30, 12, 14, -90, 90, 10).slice(1, -1),
      [82, 44], [50, 44], [18, 44],                   // ligne droite
      ...arcPoints(18, 30, 12, 14, 90, 270, 10).slice(1, -1)
    ]
  },
  "niveau-9-virage-qui-se-referme": {
    name: "Niveau 9 – Virage qui se referme",
    level: 9,
    skill: "virage dont le rayon diminue (24 → 12) : entrer vite puis ralentir dans le virage",
    raceLaps: 1,
    areaRatio: TRAINING_AREA_RATIO,
    points: [
      [16, 10], [43.2, 10],                           // ligne droite
      ...spiralPoints(62, 34, 24, 12, -90, 90, 10, 1.3).slice(0, -1),
      [62, 46], [43.2, 46], [16, 46],                 // ligne droite
      ...arcPoints(16, 28, 14, 18, 90, 270, 8).slice(1, -1)   // virage de rayon constant
    ]
  },
  "niveau-10-haricot": {
    name: "Niveau 10 – Haricot (droite puis gauche)",
    level: 10,
    skill: "changer de côté : virages à droite et courbe à gauche dans chaque creux",
    raceLaps: 1,
    areaRatio: TRAINING_AREA_RATIO,
    points: [
      [28, 8], [50, 20], [72, 8], [90, 16], [94, 32], [86, 48],
      [66, 54], [50, 52], [34, 54], [14, 48], [6, 32], [10, 16]
    ]
  },

  // ---------- Niveaux complexes à thèmes (étape 25) ----------
  "niveau-11-serpent": {
    name: "Niveau 11 – Le Serpent",
    level: 11,
    skill: "cinq épingles alternées (droite, gauche…) sans ligne droite pour se reposer",
    raceLaps: 1,
    areaRatio: TRAINING_AREA_RATIO,
    points: densify([
      [6, 54], [6, 30], [6, 10],
      ...arcPoints(13.5, 10, 7.5, 8, 180, 360, 6).slice(1, -1),
      [21, 10], [21, 24], [21, 36],
      ...arcPoints(28.5, 36, 7.5, 8, 180, 0, 6).slice(1, -1),
      [36, 36], [36, 24], [36, 10],
      ...arcPoints(43.5, 10, 7.5, 8, 180, 360, 6).slice(1, -1),
      [51, 10], [51, 24], [51, 36],
      ...arcPoints(58.5, 36, 7.5, 8, 180, 0, 6).slice(1, -1),
      [66, 36], [66, 24], [66, 10],
      ...arcPoints(73.5, 10, 7.5, 8, 180, 360, 6).slice(1, -1),
      [81, 10], [81, 30],
      ...arcPoints(75, 54, 6, 6, 0, 90, 4),
      [56, 60], [31, 60],
      ...arcPoints(12, 54, 6, 6, 90, 180, 4)
    ])
  },
  "niveau-12-coeur": {
    name: "Niveau 12 – Le Cœur",
    level: 12,
    skill: "deux grandes courbes à droite, une pointe en V en bas et un creux serré à gauche en haut",
    raceLaps: 1,
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners([
      [50, 18], [56, 9], [66, 3], [78, 2], [90, 7], [96, 18], [94, 30], [84, 42], [68, 52], [50, 60],
      [32, 52], [16, 42], [6, 30], [4, 18], [10, 7], [22, 2], [34, 3], [44, 9]
    ], 6))
  },
  "niveau-13-poisson": {
    name: "Niveau 13 – Le Poisson",
    level: 13,
    skill: "grand tour du corps à droite, puis la queue : deux nageoires aux virages aigus et un creux à gauche",
    raceLaps: 1,
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners([
      ...arcPoints(64, 30, 32, 26, -150, 150, 40),
      [8, 58], [8, 44], [22, 30], [8, 16], [8, 2]
    ], 5))
  },
  "niveau-14-chateau": {
    name: "Niveau 14 – Le Château fort",
    level: 14,
    skill: "créneaux : demi-tours à angles droits qui alternent droite et gauche tous les 14 m",
    raceLaps: 1,
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners([
      [4, 56], [4, 4], [16, 4], [16, 18], [30, 18], [30, 4], [44, 4], [44, 18],
      [58, 18], [58, 4], [72, 4], [72, 18], [86, 18], [86, 4], [98, 4], [98, 56]
    ], 5))
  },
  "niveau-15-os": {
    name: "Niveau 15 – L'Os",
    level: 15,
    skill: "deux grands demi-tours à droite reliés par un passage étroit qui fait tourner à gauche",
    raceLaps: 1,
    areaRatio: TRAINING_AREA_RATIO,
    points: densify([
      [40, 22], [60, 22],
      ...arcPoints(82, 30, 16, 28, -150, 150, 30),
      [60, 38], [40, 38],
      ...arcPoints(18, 30, 16, 28, 30, 330, 30)
    ])
  },
  "niveau-16-trefle": {
    name: "Niveau 16 – Le Trèfle à quatre feuilles",
    level: 16,
    skill: "quatre lobes : courbes à droite et creux à gauche qui reviennent sans cesse",
    raceLaps: 1,
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(lobePoints(50, 30, 22, 6, 4, 48, 1.6))
  },
  "niveau-17-etoile": {
    name: "Niveau 17 – L'Étoile",
    level: 17,
    skill: "cinq pointes : grands virages à droite au bout de chaque branche, creux à gauche entre elles",
    raceLaps: 1,
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners(starPoints(50, 30, 30, 18, 5, 1.5), 8))
  },
  "niveau-18-montagnes": {
    name: "Niveau 18 – Les Montagnes",
    level: 18,
    skill: "trois sommets et deux vallées : virages en pointe à droite et à gauche, puis longue ligne droite",
    raceLaps: 1,
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners([
      [4, 58], [4, 36], [19, 8], [34, 36], [49, 4], [64, 32], [80, 10], [96, 38], [96, 58]
    ], 9))
  },
  "niveau-19-croissant": {
    name: "Niveau 19 – Le Croissant de lune",
    level: 19,
    skill: "longue courbe à droite, épingle à la pointe, longue courbe à gauche, épingle",
    raceLaps: 1,
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners([
      ...arcPoints(56, 30, 44, 29, 120, 240, 12),
      ...arcPoints(72, 30, 30, 22, 230, 130, 10)
    ], 10))
  },
  "niveau-20-labyrinthe": {
    name: "Niveau 20 – Le Labyrinthe",
    level: 20,
    skill: "examen final : couloirs à angles droits, impasses apparentes et virages dans les deux sens",
    raceLaps: 1,
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners([
      [5, 50], [5, 5], [35, 5], [35, 20], [20, 20], [20, 35], [50, 35], [50, 5],
      [95, 5], [95, 20], [65, 20], [65, 35], [95, 35], [95, 50]
    ], 5))
  }
};

// Clés des niveaux triées par ordre de difficulté.
function trainingLevelKeys() {
  return Object.keys(TRAINING_CIRCUITS).sort((a, b) => TRAINING_CIRCUITS[a].level - TRAINING_CIRCUITS[b].level);
}
