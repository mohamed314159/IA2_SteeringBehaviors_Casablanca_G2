// Confiance d'une lignée SUR UN CIRCUIT : facteur appliqué à la vitesse max de
// ses voitures. Chaque circuit a sa propre confiance (mémorisée par le garage).
// Une génération qui a peu parcouru le circuit ou peu survécu transmet une
// confiance plus faible : la génération suivante roule moins vite. Une
// génération qui progresse fait monter la confiance, donc la vitesse.
//
//   score   = 0,7 x min(1, tours parcourus / 1 tour)
//           + 0,3 x min(1, temps survécu / 30 s)
//   cible   = MIN + (MAX - MIN) x score
//   suivante = précédente + 0,5 x (cible - précédente)   (inertie : la confiance
//              se gagne et se perd progressivement, sur plusieurs générations)
//   vitesse max effective = vitesse max du modèle x confiance
//   circuit terminé (1 tour bouclé) : confiance = 100 %, circuit validé.
const CONFIDENCE_START = 0.6;          // génération 0
const CONFIDENCE_MIN = 0.4;            // jamais plus lent que 40 % de la vitesse du modèle
const CONFIDENCE_MAX = 1;
const CONFIDENCE_FULL_LAPS = 1;        // un tour complet = progression maximale
const CONFIDENCE_FULL_SECONDS = 30;    // 30 s de survie = survie maximale
const CONFIDENCE_PROGRESS_WEIGHT = 0.7;
const CONFIDENCE_SURVIVAL_WEIGHT = 0.3;
const CONFIDENCE_INERTIA = 0.5;        // part de l'écart comblée à chaque génération
const FRAMES_PER_SECOND = 60;

// Ramène une valeur dans [0, 1] ; une valeur non finie compte pour 0.
function unitClamp(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

// Score de performance d'une génération dans [0, 1].
function performanceScore(progressLaps, framesAlive) {
  const progressScore = unitClamp(progressLaps / CONFIDENCE_FULL_LAPS);
  const survivalScore = unitClamp(framesAlive / FRAMES_PER_SECOND / CONFIDENCE_FULL_SECONDS);
  return CONFIDENCE_PROGRESS_WEIGHT * progressScore + CONFIDENCE_SURVIVAL_WEIGHT * survivalScore;
}

// Confiance après une génération sur un circuit : 100 % si le meilleur a bouclé
// le tour (circuit validé), sinon calcul progressif de nextConfidence.
function confidenceAfterRun(confidence, progressLaps, framesAlive, raceLaps = 1) {
  if (Number.isFinite(progressLaps) && progressLaps >= raceLaps) return CONFIDENCE_MAX;
  return nextConfidence(confidence, progressLaps, framesAlive);
}

// Confiance de la génération suivante à partir de la confiance du parent et de
// ses résultats (progression en tours, images survécues).
function nextConfidence(parentConfidence, progressLaps, framesAlive) {
  const previous = Number.isFinite(parentConfidence)
    ? Math.min(CONFIDENCE_MAX, Math.max(CONFIDENCE_MIN, parentConfidence))
    : CONFIDENCE_START;
  const target = CONFIDENCE_MIN + (CONFIDENCE_MAX - CONFIDENCE_MIN) * performanceScore(progressLaps, framesAlive);
  const next = previous + CONFIDENCE_INERTIA * (target - previous);
  return Math.min(CONFIDENCE_MAX, Math.max(CONFIDENCE_MIN, next));
}
