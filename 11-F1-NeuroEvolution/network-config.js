// =====================================================================
//  TOPOLOGIE DU RÉSEAU DE NEURONES — fichier à modifier librement
// =====================================================================
// Visualisation : ouvrir network.html (bouton « Voir le réseau » du menu).
// Après modification : recharger les pages. Les nouvelles lignées (génération 0)
// utilisent cette topologie ; une lignée sauvegardée garde la topologie avec
// laquelle elle a été entraînée (supprimez-la du garage pour repartir de zéro).
//
//   Entrées  = rays + 1  (proximité de chaque rayon, puis vitesse normalisée)
//   Cachées  = hiddenLayers (une valeur par couche)
//   Sorties  = 2 (fixe) : direction, accélérateur
const NETWORK_CONFIG = {
  rays: 5,                       // nombre de rayons capteurs (1 à 15)
  rayFovDegrees: 120,            // ouverture totale des rayons (10° à 360°)
  hiddenLayers: [20],            // ex. [16, 8] = deux couches cachées ; [] = aucune
  hiddenActivation: "sigmoid"    // "sigmoid" | "tanh" | "relu"
};
