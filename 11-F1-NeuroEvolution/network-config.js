// =====================================================================
//  TOPOLOGIE DU RÉSEAU DE NEURONES — fichier à modifier librement
// =====================================================================
// Visualisation : ouvrir network.html (bouton « Voir le réseau » du menu).
// Après modification : recharger les pages. Les nouvelles lignées (génération 0)
// utilisent cette topologie ; une lignée sauvegardée garde la topologie avec
// laquelle elle a été entraînée (supprimez-la du garage pour repartir de zéro).
//
//   Entrées  = un neurone par rayon + 1 (vitesse normalisée)
//   Cachées  = hiddenLayers (une valeur par couche)
//   Sorties  = 2 (fixe) : direction, accélérateur
const NETWORK_CONFIG = {
  rayAngles: [-60, -30, 0, 30, 60], // angle de chaque rayon (°) : 0 = devant, + = droite (1 à 15 rayons)
  hiddenLayers: [20],            // ex. [16, 8] = deux couches cachées ; [] = aucune
  hiddenActivation: "sigmoid"    // "sigmoid" | "tanh" | "relu"
};
