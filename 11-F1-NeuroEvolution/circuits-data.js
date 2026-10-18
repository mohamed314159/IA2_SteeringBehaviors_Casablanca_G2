// Tracés stylisés inspirés de circuits de Formule 1 (ligne médiane, sens de course).
// Coordonnées dans un repère 100 x 60 (x vers la droite, y vers le bas) ;
// le tracé est lissé (Catmull-Rom) puis mis à l'échelle du canvas.
// Ce ne sont pas des relevés GPS : les proportions générales et les virages
// emblématiques sont conservés, la longueur est compressée pour tenir à l'écran.
// Le sens de course est celui de l'ordre des points (stylisé, pas toujours le sens réel).
// `ambiance` : décor en shader en mode « auto » (shader-settings.js), « jour » par défaut.
// Créneaux (étape 30) : ligne de x0 à x1 à la hauteur y, qui descend de `depth`
// un segment sur deux (segments de `width`). Chaque changement de niveau est un angle droit.
function crenelPoints(x0, x1, y, depth, width) {
  const dir = Math.sign(x1 - x0);
  const count = Math.round(Math.abs(x1 - x0) / width);
  const points = [];
  for (let i = 0; i < count; i++) {
    const level = i % 2 === 0 ? y : y + depth;
    points.push([x0 + dir * i * width, level], [x0 + dir * (i + 1) * width, level]);
  }
  return points;
}

// Dents de scie (étape 30) : de x0 à x1, alternance entre la base (yBase) et la
// pointe (yTip) tous les `step` ; chaque pointe et chaque creux est une épingle.
function sawPoints(x0, x1, yBase, yTip, step) {
  const dir = Math.sign(x1 - x0);
  const count = Math.round(Math.abs(x1 - x0) / step);
  const points = [];
  for (let i = 0; i <= count; i++) points.push([x0 + dir * i * step, i % 2 === 0 ? yBase : yTip]);
  return points;
}

const F1_CIRCUITS = {
  monza: {
    name: "Monza (Italie)",
    points: [
      [12, 52], [34, 53], [53, 53],
      [60, 51.5], [67, 54.5], [75, 53],       // Variante del Rettifilo
      [82, 49], [90, 41],                     // Curva Grande
      [92, 35], [88, 29], [91, 22],           // Variante della Roggia
      [90, 15], [84, 9], [76, 9],             // Lesmo 1 et 2
      [62, 12], [50, 15],                     // Serraglio
      [44, 19], [38, 15], [32, 19],           // Variante Ascari
      [22, 22], [11, 26],                     // rettilineo
      [5, 34], [5, 44]                        // Parabolica
    ]
  },
  spa: {
    name: "Spa-Francorchamps (Belgique)",
    ambiance: "pluie",
    points: [
      [84, 20], [88, 10], [83, 5], [77, 9],   // ligne droite puis La Source
      [71, 17], [65, 19], [61, 25],           // Eau Rouge / Raidillon
      [48, 33], [36, 39],                     // Kemmel
      [30, 38], [25, 42], [18, 43],           // Les Combes
      [13, 46], [10, 53],                     // Bruxelles
      [17, 57], [26, 55],                     // Pouhon
      [34, 50], [42, 53], [50, 56],           // Fagnes / Stavelot
      [62, 52], [72, 44],                     // Blanchimont
      [80, 38], [79, 31], [84, 26]            // Bus Stop
    ]
  },
  interlagos: {
    name: "Interlagos (Brésil)",
    ambiance: "pluie",
    points: [
      [72, 8], [55, 7], [40, 8],              // ligne droite des stands
      [32, 11], [30, 17], [24, 21],           // S do Senna
      [17, 28], [13, 38],                     // Curva do Sol / Reta Oposta
      [14, 48], [22, 53],                     // Descida do Lago
      [32, 50], [40, 43],                     // Ferradura
      [49, 38], [56, 42], [55, 49],           // Laranjinha / Pinheirinho
      [62, 54], [72, 52],                     // Bico de Pato
      [78, 45], [86, 46],                     // Mergulho / Junção
      [92, 38], [91, 24], [86, 13]            // Subida dos Boxes
    ]
  },
  // Étape 21 : épingles volontairement très serrées (rayon sous la demi-largeur de
  // piste à Monaco, Montréal, au Red Bull Ring et à Silverstone) ; le bord
  // intérieur replié est coupé par Circuit (removeEdgeLoops).
  silverstone: {
    name: "Silverstone (Royaume-Uni)",
    ambiance: "brouillard",
    points: [
      [58, 53], [44, 54],                       // Hamilton Straight
      [34, 52], [28, 55], [22, 52],             // Abbey, Farm, Village
      [15, 57], [12, 55], [15, 51],             // The Loop (épingle)
      [22, 40], [34, 36],                       // Wellington Straight
      [40, 30], [37, 24], [27, 25],             // Brooklands, Luffield
      [20, 22], [18, 14],                       // Woodcote, Copse
      [25, 8], [32, 12], [38, 7], [45, 9],      // Maggotts, Becketts, Chapel
      [62, 8], [76, 6],                         // Hangar Straight
      [85, 9], [84, 18],                        // Stowe
      [77, 26], [81, 35],                       // Vale, Club
      [87, 44], [78, 52]
    ]
  },
  monaco: {
    name: "Monaco",
    ambiance: "crepuscule",
    points: [
      [30, 40], [40, 38],                       // Boulevard Albert Ier
      [46, 36], [50, 30],                       // Sainte-Dévote, Beau Rivage
      [56, 20], [62, 14],                       // Massenet
      [68, 12], [72, 16],                       // Casino
      [74, 22], [70, 26],                       // Mirabeau
      [71, 31], [76, 30],                       // épingle du Grand Hôtel
      [82, 38], [86, 44],                       // Portier
      [80, 50], [64, 54],                       // tunnel
      [56, 52], [50, 56],                       // chicane du port
      [40, 54], [34, 50],                       // Tabac
      [28, 52], [22, 48],                       // Piscine
      [15, 50], [10, 45], [13, 40],             // Rascasse
      [20, 40]                                  // Anthony Noghès
    ]
  },
  montreal: {
    name: "Montréal (Canada)",
    points: [
      [30, 22], [18, 22],                       // ligne des stands
      [10, 24], [8, 32], [14, 34],              // virage Senna
      [22, 38], [30, 41], [36, 38], [42, 41],   // virages 3-4, 6-7
      [54, 41], [60, 45], [66, 41],             // virages 8-9
      [78, 39], [88, 37],
      [92, 33], [90, 27], [85, 28],             // épingle
      [70, 24], [54, 21],                       // ligne droite du casino
      [46, 18], [42, 22], [37, 20]              // chicane du mur des champions
    ]
  },
  redBullRing: {
    name: "Red Bull Ring (Autriche)",
    ambiance: "neige",
    points: [
      [16, 52], [40, 53], [62, 52],             // ligne des stands
      [72, 48], [76, 40],                       // virage 1 (Niki Lauda)
      [84, 24], [88, 10],                       // montée
      [90, 3], [86, 3],                         // Remus (épingle)
      [64, 8], [44, 12],                        // descente
      [34, 12], [28, 18],                       // Schlossgold
      [34, 26], [30, 34],                       // virages 6-7
      [20, 34], [12, 40],                       // Rindt
      [9, 47]
    ]
  },
  hungaroring: {
    name: "Hungaroring (Hongrie)",
    ambiance: "canicule",
    points: [
      [20, 8], [50, 8],                         // ligne des stands
      [56, 8], [58, 12], [54, 16],              // virage 1 (épingle)
      [44, 24], [40, 30],                       // virage 2
      [46, 36], [60, 36],                       // virage 3
      [70, 38], [78, 34],                       // virages 4-5
      [86, 40], [88, 50], [80, 56],             // virages 6-7
      [66, 54], [60, 58], [52, 54],             // chicane
      [40, 52], [30, 56], [18, 54],             // virages 11-12
      [10, 46], [8, 34],                        // virages 13-14
      [12, 16]
    ]
  },
  // Étape 30 : deux circuits extrêmes, d'une difficulté inhumaine. Piste très
  // étroite (8 m puis 7 m, la voiture en fait 2) : moins de 10 px de marge de
  // chaque côté, le moindre coup de volant de trop fait sortir la voiture.
  inferno: {
    name: "Inferno (circuit extrême)",
    skill: "inhumain : piste de 8 m, cinq rangées de créneaux, plus de 120 angles droits",
    trackWidthMeters: 8,
    ambiance: "nuit",
    points: [
      ...crenelPoints(14, 92, 5, 3, 6), [97, 10],
      ...crenelPoints(92, 14, 15, 3, 6), [9, 20],
      ...crenelPoints(14, 92, 25, 3, 6), [97, 30],
      ...crenelPoints(92, 14, 35, 3, 6), [9, 40],
      ...crenelPoints(14, 92, 45, 3, 6), [97, 50],
      [92, 56], [60, 57], [30, 57], [10, 57],
      [3, 50], [3, 30], [3, 10], [8, 4]
    ]
  },
  hachoir: {
    name: "Le Hachoir (circuit extrême)",
    skill: "inhumain : piste de 7 m, deux lames de dents de scie, une vingtaine d'épingles aiguës",
    trackWidthMeters: 7,
    ambiance: "neon",
    points: [
      ...sawPoints(4, 84, 3, 26, 8), [96, 12],
      [96, 48], ...sawPoints(84, 4, 57, 34, 8),
      [-4, 48], [-4, 12]
    ]
  }
};
