// Niveaux d'entraînement : chaque circuit fait travailler une compétence.
// Même format que circuits-data.js (repère 100 x 60, sens de course), plus :
//   level            : ordre du niveau (1 = plus facile)
//   skill            : compétence travaillée
//   raceLaps         : tours à boucler pour valider le niveau (1)
//   trackWidthMeters : largeur de piste si différente des 14 m d'une piste F1
// Pour ajouter un niveau : ajouter une entrée ici (puis vérifier les tests).

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

const TRAINING_CIRCUITS = {
  "niveau-1-circulaire": {
    name: "Niveau 1 – Circulaire",
    level: 1,
    skill: "tenir un virage constant sans toucher les bords",
    raceLaps: 1,
    points: ellipsePoints(50, 30, 40, 24, 24)
  },
  "niveau-2-carre": {
    name: "Niveau 2 – Carré",
    level: 2,
    skill: "freiner et tourner à 90° puis réaccélérer",
    raceLaps: 1,
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
    points: [
      ...wavePoints(18, 82, 14, 5, 2, 16),
      [94, 18], [96, 30], [94, 42],
      ...wavePoints(82, 18, 46, 5, 2, 16),
      [6, 42], [4, 30], [6, 18]
    ]
  },
  "niveau-4-epingles": {
    name: "Niveau 4 – Épingles aller-retour",
    level: 4,
    skill: "virages en épingle : demi-tours serrés dans un sens puis dans l'autre",
    raceLaps: 1,
    points: [
      [10, 46], [10, 14], [15, 7], [20, 14],          // montée, épingle haute
      [20, 36], [25, 43], [30, 36],                   // descente, épingle basse
      [30, 14], [35, 7], [40, 14],
      [40, 36], [45, 43], [50, 36],
      [50, 14], [55, 7], [60, 14],
      [60, 46], [56, 55],                             // retour par le bas
      [35, 56], [15, 55]
    ]
  },
  "niveau-5-coince": {
    name: "Niveau 5 – Passage coincé",
    level: 5,
    skill: "piste étroite (10 m) et chicanes serrées : précision",
    raceLaps: 1,
    trackWidthMeters: 10,
    points: [
      [10, 8], [33, 8], [45, 16], [57, 8], [90, 8],
      [92, 20], [83, 31], [92, 42], [90, 54],
      [67, 54], [55, 46], [43, 54], [10, 54],
      [8, 42], [17, 31], [8, 20]
    ]
  }
};

// Clés des niveaux triées par ordre de difficulté.
function trainingLevelKeys() {
  return Object.keys(TRAINING_CIRCUITS).sort((a, b) => TRAINING_CIRCUITS[a].level - TRAINING_CIRCUITS[b].level);
}
