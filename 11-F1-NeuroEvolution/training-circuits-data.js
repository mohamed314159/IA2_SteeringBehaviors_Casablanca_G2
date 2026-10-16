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
  }
};

// Clés des niveaux triées par ordre de difficulté.
function trainingLevelKeys() {
  return Object.keys(TRAINING_CIRCUITS).sort((a, b) => TRAINING_CIRCUITS[a].level - TRAINING_CIRCUITS[b].level);
}
