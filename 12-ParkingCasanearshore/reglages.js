// Réglages par comportement (comme 7-Boids/reglages.js) : valeurs initiales,
// description des curseurs et application. Aucune formule de steering ici :
// les entités lisent ces valeurs via SteeringAgent.param().
//
// Pour chaque comportement :
//   vitesse (×) : multiplie la vitesse max des entités qui l'exécutent ;
//   taille (×)  : agrandit leur dessin (pour mieux les voir) ;
// plus les paramètres propres au comportement. maxForce n'est jamais modifié.
const REGLAGES_INITIAUX = {
  seek: { vitesse: 1, taille: 1 },
  pursue: { vitesse: 1, taille: 1, horizon: 20 },
  evade: { vitesse: 1, taille: 1, detection: 1, sortie: 1, poids: 1 },
  arrive: { vitesse: 1, taille: 1, rayon: 1 },
  wander: { vitesse: 1, taille: 1, rayon: 1, distance: 1, variation: 0.25 },
  path: { vitesse: 1, taille: 1, anticipation: 1 },
  avoid: { vitesse: 1, taille: 1, portee: 1, largeur: 1, poids: 1 },
  boids: { vitesse: 1, taille: 1, alignement: 1, cohesion: 1, separation: 1, perception: 1 },
  leader: { vitesse: 1, taille: 1, distance: 1, zone: 1 },
  scene: { acceleration: 8, voitures: 110, presents: 60 }
};

const DEFINITIONS_REGLAGES = [
  { groupe: "1. Seek (retardataire, café)", cle: "seek.vitesse", libelle: "Vitesse (×)", min: 0.25, max: 3, pas: 0.05 },
  { groupe: "1. Seek (retardataire, café)", cle: "seek.taille", libelle: "Taille (×)", min: 0.5, max: 4, pas: 0.1 },

  { groupe: "2. Pursue (badge oublié)", cle: "pursue.vitesse", libelle: "Vitesse (×)", min: 0.25, max: 3, pas: 0.05 },
  { groupe: "2. Pursue (badge oublié)", cle: "pursue.taille", libelle: "Taille (×)", min: 0.5, max: 4, pas: 0.1 },
  { groupe: "2. Pursue (badge oublié)", cle: "pursue.horizon", libelle: "Horizon de prédiction (pas)", min: 0, max: 60, pas: 1 },

  { groupe: "2. Evade (piétons / voitures)", cle: "evade.vitesse", libelle: "Vitesse (×)", min: 0.25, max: 3, pas: 0.05 },
  { groupe: "2. Evade (piétons / voitures)", cle: "evade.taille", libelle: "Taille (×)", min: 0.5, max: 4, pas: 0.1 },
  { groupe: "2. Evade (piétons / voitures)", cle: "evade.detection", libelle: "Rayon de détection (×)", min: 0, max: 3, pas: 0.05 },
  { groupe: "2. Evade (piétons / voitures)", cle: "evade.sortie", libelle: "Distance de sortie (×)", min: 0.5, max: 3, pas: 0.05 },
  { groupe: "2. Evade (piétons / voitures)", cle: "evade.poids", libelle: "Poids", min: 0, max: 3, pas: 0.05 },

  { groupe: "3. Arrive (places, quai, portes)", cle: "arrive.vitesse", libelle: "Vitesse (×)", min: 0.25, max: 3, pas: 0.05 },
  { groupe: "3. Arrive (places, quai, portes)", cle: "arrive.taille", libelle: "Taille (×)", min: 0.5, max: 4, pas: 0.1 },
  { groupe: "3. Arrive (places, quai, portes)", cle: "arrive.rayon", libelle: "Rayon de freinage (×)", min: 0.5, max: 3, pas: 0.05 },

  { groupe: "4. Wander (avant 8h55)", cle: "wander.vitesse", libelle: "Vitesse (×)", min: 0.25, max: 3, pas: 0.05 },
  { groupe: "4. Wander (avant 8h55)", cle: "wander.taille", libelle: "Taille (×)", min: 0.5, max: 4, pas: 0.1 },
  { groupe: "4. Wander (avant 8h55)", cle: "wander.rayon", libelle: "Rayon du cercle (×)", min: 0.2, max: 3, pas: 0.05 },
  { groupe: "4. Wander (avant 8h55)", cle: "wander.distance", libelle: "Distance du cercle (×)", min: 0.2, max: 3, pas: 0.05 },
  { groupe: "4. Wander (avant 8h55)", cle: "wander.variation", libelle: "Variation (rad / pas)", min: 0, max: 1, pas: 0.01 },

  { groupe: "5. Path following (routes, rails)", cle: "path.vitesse", libelle: "Vitesse (×)", min: 0.25, max: 3, pas: 0.05 },
  { groupe: "5. Path following (routes, rails)", cle: "path.taille", libelle: "Taille (×)", min: 0.5, max: 4, pas: 0.1 },
  { groupe: "5. Path following (routes, rails)", cle: "path.anticipation", libelle: "Anticipation (×)", min: 0.3, max: 3, pas: 0.05 },

  { groupe: "6. Obstacle avoidance", cle: "avoid.vitesse", libelle: "Vitesse (×)", min: 0.25, max: 3, pas: 0.05 },
  { groupe: "6. Obstacle avoidance", cle: "avoid.taille", libelle: "Taille (×)", min: 0.5, max: 4, pas: 0.1 },
  { groupe: "6. Obstacle avoidance", cle: "avoid.portee", libelle: "Portée du vecteur ahead (×)", min: 0.2, max: 3, pas: 0.05 },
  { groupe: "6. Obstacle avoidance", cle: "avoid.largeur", libelle: "Largeur de la zone (×)", min: 0.2, max: 3, pas: 0.05 },
  { groupe: "6. Obstacle avoidance", cle: "avoid.poids", libelle: "Poids", min: 0, max: 3, pas: 0.05 },

  { groupe: "7. Boids (groupes de collègues)", cle: "boids.vitesse", libelle: "Vitesse (×)", min: 0.25, max: 3, pas: 0.05 },
  { groupe: "7. Boids (groupes de collègues)", cle: "boids.taille", libelle: "Taille (×)", min: 0.5, max: 4, pas: 0.1 },
  { groupe: "7. Boids (groupes de collègues)", cle: "boids.alignement", libelle: "Poids alignement", min: 0, max: 3, pas: 0.05 },
  { groupe: "7. Boids (groupes de collègues)", cle: "boids.cohesion", libelle: "Poids cohésion", min: 0, max: 3, pas: 0.05 },
  { groupe: "7. Boids (groupes de collègues)", cle: "boids.separation", libelle: "Poids séparation", min: 0, max: 3, pas: 0.05 },
  { groupe: "7. Boids (groupes de collègues)", cle: "boids.perception", libelle: "Rayon de perception (×)", min: 0.3, max: 3, pas: 0.05 },

  { groupe: "8. Leader following (formation, file)", cle: "leader.vitesse", libelle: "Vitesse (×)", min: 0.25, max: 3, pas: 0.05 },
  { groupe: "8. Leader following (formation, file)", cle: "leader.taille", libelle: "Taille (×)", min: 0.5, max: 4, pas: 0.1 },
  { groupe: "8. Leader following (formation, file)", cle: "leader.distance", libelle: "Distance derrière le guide (×)", min: 0.5, max: 3, pas: 0.05 },
  { groupe: "8. Leader following (formation, file)", cle: "leader.zone", libelle: "Zone interdite devant (×)", min: 0, max: 3, pas: 0.05 },

  { groupe: "Scène", cle: "scene.acceleration", libelle: "Accélération auto (×)", min: 2, max: 20, pas: 1 },
  { groupe: "Scène", cle: "scene.voitures", libelle: "Voitures (au prochain ↺)", min: 10, max: 250, pas: 5 },
  { groupe: "Scène", cle: "scene.presents", libelle: "Employés présents (au prochain ↺)", min: 0, max: 150, pas: 5 }
];

// Copie profonde des valeurs initiales.
function creerReglages() {
  return JSON.parse(JSON.stringify(REGLAGES_INITIAUX));
}

function lireReglage(reglages, cle) {
  const [groupe, nom] = cle.split(".");
  return reglages[groupe][nom];
}

// Écrit un réglage borné par sa définition ; retourne la valeur retenue.
function ecrireReglage(reglages, cle, valeur) {
  const def = DEFINITIONS_REGLAGES.find(d => d.cle === cle);
  const [groupe, nom] = cle.split(".");
  let v = Number(valeur);
  if (!Number.isFinite(v)) v = REGLAGES_INITIAUX[groupe][nom];
  if (def) v = Math.min(def.max, Math.max(def.min, v));
  reglages[groupe][nom] = v;
  return v;
}

// Texte affiché à côté d'un curseur, avec autant de décimales que le pas.
function formaterValeur(valeur, pas) {
  const texte = String(pas);
  const decimales = texte.includes(".") ? texte.split(".")[1].length : 0;
  return Number(valeur).toFixed(decimales);
}
