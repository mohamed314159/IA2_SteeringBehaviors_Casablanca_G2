// Tracés stylisés inspirés de circuits de Formule 1 (ligne médiane, sens de course).
// Coordonnées dans un repère 100 x 60 (x vers la droite, y vers le bas) ;
// le tracé est lissé (Catmull-Rom) puis mis à l'échelle du canvas.
// Ce ne sont pas des relevés GPS : les proportions générales et les virages
// emblématiques sont conservés, la longueur est compressée pour tenir à l'écran.
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
  }
};
