// Niveaux d'entraînement : chaque circuit fait travailler une compétence.
// Même format que circuits-data.js (repère 100 x 60, sens de course), plus :
//   level            : ordre du niveau (1 = plus facile)
//   skill            : compétence travaillée
//   raceLaps         : tours à boucler pour valider le niveau (1)
//   trackWidthMeters : largeur de piste si différente des 14 m d'une piste F1
//   areaRatio        : part de la surface du canvas occupée par le tracé
//   ambiance         : décor en shader en mode « auto » (shader-settings.js), « jour » par défaut
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

// Polygone régulier (étape 29) : `sides` sommets sur une ellipse, le premier en haut, sens horaire.
function polygonPoints(cx, cy, radius, sides, stretchX = 1) {
  const points = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
    points.push([cx + stretchX * radius * Math.cos(a), cy + radius * Math.sin(a)]);
  }
  return points;
}

// Symétrique haut-bas dans le repère 100 x 60 (étape 29) : la lettre M devient W.
function mirrorY(points) {
  return points.map(([x, y]) => [x, 60 - y]);
}

// Drift à gauche : ligne droite qui descend, puis une grande courbe à gauche (forme de D).
const DRIFT_LEFT_POINTS = [[14, 12], [14, 30], [14, 48], ...arcPoints(30, 30, 62, 24, 100, -100, 14)];

const TRAINING_AREA_RATIO = 1 / 4;   // surface divisée par 4 (étape 19)

// Contour de la lettre M (étape 29), repris à l'envers pour la lettre W.
const M_POINTS = [[4, 58], [4, 2], [22, 2], [50, 26], [78, 2], [96, 2], [96, 58], [80, 58], [80, 28], [50, 50], [20, 28], [20, 58]];

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
    ambiance: "canicule",
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
    ambiance: "crepuscule",
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
    ambiance: "pluie",
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
    ambiance: "brouillard",
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
    ambiance: "nuit",
    level: 17,
    skill: "cinq pointes : grands virages à droite au bout de chaque branche, creux à gauche entre elles",
    raceLaps: 1,
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners(starPoints(50, 30, 30, 18, 5, 1.5), 8))
  },
  "niveau-18-montagnes": {
    name: "Niveau 18 – Les Montagnes",
    ambiance: "neige",
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
    ambiance: "nuit",
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
    ambiance: "neon",
    level: 20,
    skill: "examen final : couloirs à angles droits, impasses apparentes et virages dans les deux sens",
    raceLaps: 1,
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners([
      [5, 50], [5, 5], [35, 5], [35, 20], [20, 20], [20, 35], [50, 35], [50, 5],
      [95, 5], [95, 20], [65, 20], [65, 35], [95, 35], [95, 50]
    ], 5))
  },
  // ---------- 30 niveaux de plus (étape 29) ----------
  // Formes géométriques, nature, objets, lettres, puis épreuves finales sur une
  // piste plus étroite (12 m à partir du niveau 46).
  "niveau-21-triangle": {
    name: "Niveau 21 – Le Triangle",
    level: 21,
    skill: "trois grands virages à droite de 120° séparés par de longues lignes droites",
    raceLaps: 1,
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners([[50, 4], [94, 56], [6, 56]], 14))
  },
  "niveau-22-pentagone": {
    name: "Niveau 22 – Le Pentagone",
    level: 22,
    skill: "cinq virages identiques de 72° : garder le même rythme de freinage",
    raceLaps: 1,
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners(polygonPoints(50, 30, 30, 5, 1.5), 10))
  },
  "niveau-23-goutte": {
    name: "Niveau 23 – La Goutte d'eau",
    level: 23,
    skill: "une pointe serrée en haut puis un long arrondi : freiner tard, accélérer tôt",
    raceLaps: 1,
    ambiance: "pluie",
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners([[50, 2], [66, 22], [74, 38], [70, 52], [58, 58], [42, 58], [30, 52], [26, 38], [34, 22]], 6))
  },
  "niveau-24-vague": {
    name: "Niveau 24 – La Vague",
    level: 24,
    skill: "ondulations régulières en haut, ligne droite en bas : petits coups de volant à pleine vitesse",
    raceLaps: 1,
    ambiance: "pluie",
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners([...wavePoints(10, 90, 14, 5, 2, 30), [96, 30], [90, 50], [50, 52], [10, 50], [4, 30]], 5))
  },
  "niveau-25-dent-de-scie": {
    name: "Niveau 25 – La Dent de scie",
    level: 25,
    skill: "quatre dents pointues : virages aigus à droite et à gauche enchaînés sans pause",
    raceLaps: 1,
    ambiance: "canicule",
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners([
      [6, 50], [6, 14], [18, 2], [26, 20], [38, 2], [46, 20], [58, 2], [66, 20], [78, 2], [94, 14], [94, 50]
    ], 4))
  },
  "niveau-26-eclair": {
    name: "Niveau 26 – L'Éclair",
    level: 26,
    skill: "zigzag de l'éclair : deux virages en épingle dans des sens opposés au milieu de lignes obliques",
    raceLaps: 1,
    ambiance: "nuit",
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners([[30, 2], [74, 2], [62, 20], [92, 20], [54, 64], [42, 40], [6, 40]], 6))
  },
  "niveau-27-fer-a-cheval": {
    name: "Niveau 27 – Le Fer à cheval",
    level: 27,
    skill: "grand arc à droite, demi-tour au bout, arc intérieur plus serré à gauche, demi-tour",
    raceLaps: 1,
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners([
      ...arcPoints(50, 32, 44, 28, 140, 400, 26),
      [80, 56],
      ...arcPoints(50, 32, 24, 13, 40, -220, 20),
      [20, 56]
    ], 4))
  },
  "niveau-28-papillon": {
    name: "Niveau 28 – Le Papillon",
    level: 28,
    skill: "deux grandes ailes à droite reliées par une taille fine qui fait tourner à gauche",
    raceLaps: 1,
    ambiance: "crepuscule",
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(lobePoints(50, 30, 20, 8, 2, 48, 1.8))
  },
  "niveau-29-fleur": {
    name: "Niveau 29 – La Fleur",
    level: 29,
    skill: "six pétales : petits virages à droite et à gauche qui reviennent très vite",
    raceLaps: 1,
    ambiance: "crepuscule",
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(lobePoints(50, 30, 22, 5, 6, 72, 1.5))
  },
  "niveau-30-flocon": {
    name: "Niveau 30 – Le Flocon",
    level: 30,
    skill: "six branches : six épingles à droite et six creux à gauche",
    raceLaps: 1,
    ambiance: "neige",
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners(starPoints(50, 30, 30, 19, 6, 1.4), 7))
  },
  "niveau-31-sapin": {
    name: "Niveau 31 – Le Sapin",
    level: 31,
    skill: "deux étages du sapin : crochets aigus à gauche puis à droite, et le tronc étroit en bas",
    raceLaps: 1,
    ambiance: "neige",
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners([
      [50, 0], [68, 22], [68, 26], [57, 26], [76, 52], [76, 56], [58, 56], [58, 68], [42, 68], [42, 56], [24, 56], [24, 52], [43, 26], [32, 26], [32, 22]
    ],6))
  },
  "niveau-32-couronne": {
    name: "Niveau 32 – La Couronne",
    level: 32,
    skill: "trois pointes et deux creux : grands changements de cap en haut, ligne droite en bas",
    raceLaps: 1,
    ambiance: "crepuscule",
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners([[6, 58], [6, 24], [22, 36], [34, 4], [50, 30], [66, 4], [78, 36], [94, 24], [94, 58]], 7))
  },
  "niveau-33-fusee": {
    name: "Niveau 33 – La Fusée",
    level: 33,
    skill: "nez pointu, ailerons qui obligent à tourner court à gauche puis à droite",
    raceLaps: 1,
    ambiance: "nuit",
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners([
      [50, 0], [64, 16], [66, 36], [88, 56], [88, 72], [64, 58], [56, 66], [44, 66], [36, 58], [12, 72], [12, 56], [34, 36], [36, 16]
    ], 4))
  },
  "niveau-34-chat": {
    name: "Niveau 34 – Le Chat",
    level: 34,
    skill: "deux oreilles pointues et le creux entre elles : virages serrés dans les deux sens",
    raceLaps: 1,
    ambiance: "nuit",
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners([[20, 58], [8, 36], [12, 2], [34, 18], [66, 18], [88, 2], [92, 36], [80, 58]], 7))
  },
  "niveau-35-lettre-m": {
    name: "Niveau 35 – La Lettre M",
    level: 35,
    skill: "les jambages et le V du M : angles droits puis virages en pointe",
    raceLaps: 1,
    ambiance: "brouillard",
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners(M_POINTS, 4))
  },
  "niveau-36-lettre-w": {
    name: "Niveau 36 – La Lettre W",
    level: 36,
    skill: "le M à l'envers : mêmes virages, dans l'ordre inverse de gauche et droite",
    raceLaps: 1,
    ambiance: "brouillard",
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners(mirrorY(M_POINTS), 4))
  },
  "niveau-37-lettre-z": {
    name: "Niveau 37 – La Lettre Z",
    level: 37,
    skill: "deux virages en pointe de 135° aux deux bouts de la diagonale, entre deux longues barres",
    raceLaps: 1,
    ambiance: "neon",
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners([[0, 0], [60, 0], [60, 18], [40, 42], [60, 42], [60, 60], [0, 60], [0, 42], [14, 42], [34, 18], [0, 18]], 6))
  },
  "niveau-38-lettre-f": {
    name: "Niveau 38 – La Lettre F",
    level: 38,
    skill: "les deux branches du F : demi-tours à angles droits, puis la longue hampe",
    raceLaps: 1,
    ambiance: "neon",
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners([
      [4, 0], [96, 0], [96, 14], [30, 14], [30, 28], [80, 28], [80, 42], [30, 42], [30, 66], [4, 66]
    ], 4))
  },
  "niveau-39-escalier": {
    name: "Niveau 39 – L'Escalier",
    level: 39,
    skill: "quatre marches : virages à droite et à gauche de 90° en alternance, puis une longue descente",
    raceLaps: 1,
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners([[4, 58], [4, 44], [22, 44], [22, 30], [40, 30], [40, 16], [58, 16], [58, 2], [96, 2], [96, 58]], 4))
  },
  "niveau-40-dents-du-requin": {
    name: "Niveau 40 – Les Dents du requin",
    level: 40,
    skill: "deux mâchoires en zigzag face à face : virages aigus sur les deux côtés de la piste",
    raceLaps: 1,
    ambiance: "canicule",
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners([
      [4, 6], [13, 20], [22, 6], [31, 20], [40, 6], [49, 20], [58, 6], [67, 20], [76, 6], [85, 20], [94, 6], [100, 12],
      [100, 48], [94, 54], [85, 40], [76, 54], [67, 40], [58, 54], [49, 40], [40, 54], [31, 40], [22, 54], [13, 40], [4, 54],
      [-2, 48], [-2, 12]
    ], 4))
  },
  "niveau-41-ruban": {
    name: "Niveau 41 – Le Ruban",
    level: 41,
    skill: "deux vagues parallèles : la courbe change de sens toutes les 16 unités, dans les deux lignes",
    raceLaps: 1,
    ambiance: "crepuscule",
    areaRatio: TRAINING_AREA_RATIO,
    points: densify([
      ...wavePoints(8, 92, 12, 4, 2, 30), ...arcPoints(92, 28, 8, 16, -90, 90, 8).slice(1, -1),
      ...wavePoints(8, 92, 44, 4, 2, 30).reverse(), ...arcPoints(8, 28, 8, 16, 90, 270, 8).slice(1, -1)
    ])
  },
  "niveau-42-cle": {
    name: "Niveau 42 – La Clé",
    level: 42,
    skill: "anneau de la clé à droite, puis le panneton : créneaux à angles droits",
    raceLaps: 1,
    ambiance: "neon",
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners([
      ...arcPoints(22, 30, 18, 24, 30, 330, 24),
      [94, 18], [94, 52], [80, 52], [80, 34], [66, 34], [66, 48], [52, 48], [52, 34]
    ], 4))
  },
  "niveau-43-cactus": {
    name: "Niveau 43 – Le Cactus",
    level: 43,
    skill: "deux bras dressés : demi-tours étroits autour de chaque bras",
    raceLaps: 1,
    ambiance: "canicule",
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners([
      [41, 60], [41, 38], [19, 38], [13, 32], [13, 8], [26, 8], [26, 24], [41, 24], [41, 2], [55, 2],
      [55, 26], [70, 26], [70, 6], [83, 6], [83, 34], [77, 40], [55, 40], [55, 60]
    ], 4))
  },
  "niveau-44-volcan": {
    name: "Niveau 44 – Le Volcan",
    level: 44,
    skill: "montée raide, cratère en V au sommet, longue descente : deux pointes et un creux",
    raceLaps: 1,
    ambiance: "canicule",
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners([[4, 58], [30, 8], [42, 8], [50, 24], [58, 8], [70, 8], [96, 58]], 6))
  },
  "niveau-45-pieuvre": {
    name: "Niveau 45 – La Pieuvre",
    level: 45,
    skill: "huit tentacules : huit virages à droite et huit à gauche sur un seul tour",
    raceLaps: 1,
    ambiance: "pluie",
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(lobePoints(50, 30, 23, 3.5, 8, 96, 1.6))
  },
  "niveau-46-boomerang": {
    name: "Niveau 46 – Le Boomerang",
    level: 46,
    skill: "piste de 12 m : deux pointes aiguës aux extrémités et un V intérieur",
    raceLaps: 1,
    trackWidthMeters: 12,
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners([[4, 4], [24, 4], [50, 36], [76, 4], [96, 4], [60, 58], [40, 58]], 6))
  },
  "niveau-47-dragon": {
    name: "Niveau 47 – Le Dragon",
    level: 47,
    skill: "piste de 12 m : le corps gonfle et se resserre, les deux bords ondulent en sens contraire",
    raceLaps: 1,
    trackWidthMeters: 12,
    ambiance: "nuit",
    areaRatio: TRAINING_AREA_RATIO,
    points: densify([
      ...wavePoints(8, 92, 14, 5, 2.5, 36), ...arcPoints(92, 29, 8, 15, -90, 90, 8).slice(1, -1),
      ...wavePoints(8, 92, 44, -5, 2.5, 36).reverse(), ...arcPoints(8, 29, 8, 15, 90, 270, 8).slice(1, -1)
    ])
  },
  "niveau-48-montagnes-russes": {
    name: "Niveau 48 – Les Montagnes russes",
    level: 48,
    skill: "piste de 12 m : cinq épingles de hauteurs différentes, en haut et en bas, puis le retour",
    raceLaps: 1,
    trackWidthMeters: 12,
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners([
      [6, 72], [6, 30], [6, 12],
      ...arcPoints(13, 12, 7, 8, 180, 360, 6).slice(1, -1),
      [20, 12], [20, 36], [20, 44],
      ...arcPoints(27, 44, 7, 8, 180, 0, 6).slice(1, -1),
      [34, 44], [34, 26], [34, 22],
      ...arcPoints(41, 22, 7, 8, 180, 360, 6).slice(1, -1),
      [48, 22], [48, 40], [48, 50],
      ...arcPoints(55, 50, 7, 8, 180, 0, 6).slice(1, -1),
      [62, 50], [62, 24], [62, 8],
      ...arcPoints(69, 8, 7, 8, 180, 360, 6).slice(1, -1),
      [76, 8], [76, 40], [76, 72], [40, 72]
    ], 6))
  },
  "niveau-49-trombone": {
    name: "Niveau 49 – Le Trombone",
    level: 49,
    skill: "piste de 12 m : quatre longues coulisses reliées par des demi-tours alternés",
    raceLaps: 1,
    trackWidthMeters: 12,
    ambiance: "brouillard",
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners([
      [4, 58], [4, 6], [88, 6], [95, 13], [88, 20], [30, 20], [23, 27], [30, 34], [88, 34], [95, 41], [88, 48], [30, 48], [18, 58]
    ], 5))
  },
  "niveau-50-dedale": {
    name: "Niveau 50 – Le Dédale",
    level: 50,
    skill: "examen final, piste de 12 m : seize angles droits, couloirs étroits, impasses apparentes",
    raceLaps: 1,
    trackWidthMeters: 12,
    ambiance: "neon",
    areaRatio: TRAINING_AREA_RATIO,
    points: densify(roundCorners([
      [4, 58], [4, 4], [30, 4], [30, 30], [44, 30], [44, 4], [96, 4], [96, 18], [60, 18], [60, 30],
      [96, 30], [96, 58], [72, 58], [72, 44], [56, 44], [56, 58]
    ], 4))
  }
};

// Clés des niveaux triées par ordre de difficulté.
function trainingLevelKeys() {
  return Object.keys(TRAINING_CIRCUITS).sort((a, b) => TRAINING_CIRCUITS[a].level - TRAINING_CIRCUITS[b].level);
}
