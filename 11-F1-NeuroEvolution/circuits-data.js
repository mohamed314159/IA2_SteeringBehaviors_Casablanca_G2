// Tracés stylisés inspirés de circuits de Formule 1 (ligne médiane, sens de course).
// Coordonnées dans un repère 100 x 60 (x vers la droite, y vers le bas) ;
// le tracé est lissé (Catmull-Rom) puis mis à l'échelle du canvas.
// Ce ne sont pas des relevés GPS : les proportions générales et les virages
// emblématiques sont conservés, la longueur est compressée pour tenir à l'écran.
// Le sens de course est celui de l'ordre des points (stylisé, pas toujours le sens réel).
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
  }
};
