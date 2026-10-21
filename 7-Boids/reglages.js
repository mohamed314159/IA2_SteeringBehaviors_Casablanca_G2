// Réglages de la scène : valeurs initiales, description des curseurs
// et application aux entités. Aucune formule de steering ici : on ne fait
// que modifier les propriétés existantes des Boid (poids, rayons, vitesses).

const REGLAGES_INITIAUX = {
  // Perroquets lents pour pouvoir cliquer dessus.
  nbPerroquets: 80,
  taillePerroquets: 30,     // largeur du dessin = rayon r, en px
  vitessePerroquets: 1.4,   // maxSpeed, en px par image

  // Chasseurs : plus lents que les perroquets, ils les poursuivent lentement.
  nbChasseurs: 1,
  tailleChasseurs: 40,      // rayon r, en px (le skin mesure 1,6 r de haut)
  vitesseChasseurs: 1.1,    // maxSpeed, en px par image

  // Poids et perception de la nuée (curseurs de l'exemple d'origine).
  alignWeight: 1.5,
  cohesionWeight: 1,
  separationWeight: 3,
  boundariesWeight: 10,
  perceptionRadius: 25,

  // Poids et détection des chasseurs (valeurs du requin d'origine).
  poidsWander: 1,
  poidsSeek: 7,
  rayonDetection: 70,

  volume: 0.6
};

const DEFINITIONS_REGLAGES = [
  { groupe: 'Perroquets', cle: 'nbPerroquets', libelle: 'Nombre', min: 0, max: 250, pas: 1 },
  { groupe: 'Perroquets', cle: 'taillePerroquets', libelle: 'Taille (px)', min: 12, max: 64, pas: 1 },
  { groupe: 'Perroquets', cle: 'vitessePerroquets', libelle: 'Vitesse max (px/image)', min: 0.3, max: 5, pas: 0.1 },

  { groupe: 'Chasseurs', cle: 'nbChasseurs', libelle: 'Nombre', min: 0, max: 6, pas: 1 },
  { groupe: 'Chasseurs', cle: 'tailleChasseurs', libelle: 'Taille (rayon px)', min: 20, max: 90, pas: 1 },
  { groupe: 'Chasseurs', cle: 'vitesseChasseurs', libelle: 'Vitesse max (px/image)', min: 0.3, max: 5, pas: 0.1 },

  { groupe: 'Poids de la nuée', cle: 'alignWeight', libelle: 'Alignement', min: 0, max: 2, pas: 0.1 },
  { groupe: 'Poids de la nuée', cle: 'cohesionWeight', libelle: 'Cohésion', min: 0, max: 2, pas: 0.1 },
  { groupe: 'Poids de la nuée', cle: 'separationWeight', libelle: 'Séparation', min: 0, max: 15, pas: 0.1 },
  { groupe: 'Poids de la nuée', cle: 'boundariesWeight', libelle: 'Bords (boundaries)', min: 0, max: 15, pas: 1 },
  { groupe: 'Poids de la nuée', cle: 'perceptionRadius', libelle: 'Rayon de perception (px)', min: 15, max: 60, pas: 1 },

  { groupe: 'Poids des chasseurs', cle: 'poidsWander', libelle: 'Wander', min: 0, max: 5, pas: 0.1 },
  { groupe: 'Poids des chasseurs', cle: 'poidsSeek', libelle: 'Seek', min: 0, max: 15, pas: 0.5 },
  { groupe: 'Poids des chasseurs', cle: 'rayonDetection', libelle: 'Rayon de détection (px)', min: 20, max: 300, pas: 5 },

  { groupe: 'Son', cle: 'volume', libelle: 'Volume', min: 0, max: 1, pas: 0.05 }
];

const CLES_PERROQUET = ['taillePerroquets', 'vitessePerroquets', 'alignWeight', 'cohesionWeight',
  'separationWeight', 'boundariesWeight', 'perceptionRadius'];
const CLES_CHASSEUR = ['tailleChasseurs', 'vitesseChasseurs', 'poidsWander', 'poidsSeek', 'rayonDetection'];

// maxForce n'est jamais modifié : les forces restent celles de boids.js.
function appliquerAuPerroquet(perroquet, reglages) {
  perroquet.r = reglages.taillePerroquets * perroquet.facteurTaille;
  perroquet.maxSpeed = reglages.vitessePerroquets;
  perroquet.alignWeight = reglages.alignWeight;
  perroquet.cohesionWeight = reglages.cohesionWeight;
  perroquet.separationWeight = reglages.separationWeight;
  perroquet.boundariesWeight = reglages.boundariesWeight;
  perroquet.perceptionRadius = reglages.perceptionRadius;
}

function appliquerAuChasseur(chasseur, reglages) {
  chasseur.r = reglages.tailleChasseurs;
  chasseur.maxSpeed = reglages.vitesseChasseurs;
  chasseur.poidsWander = reglages.poidsWander;
  chasseur.poidsSeek = reglages.poidsSeek;
  chasseur.rayonDetection = reglages.rayonDetection;
}

// Ajoute (avec creer) ou retire (en fin de liste) des entités pour atteindre
// l'effectif voulu. Les entités conservées gardent leur identité et leur état.
function ajusterEffectif(liste, effectif, creer) {
  const cible = Math.max(0, Math.floor(Number(effectif) || 0));
  while (liste.length < cible) liste.push(creer());
  if (liste.length > cible) liste.splice(cible);
  return liste;
}

// Texte affiché à côté d'un curseur, avec autant de décimales que le pas.
function formaterValeur(valeur, pas) {
  const texte = String(pas);
  const decimales = texte.includes('.') ? texte.split('.')[1].length : 0;
  return Number(valeur).toFixed(decimales);
}
