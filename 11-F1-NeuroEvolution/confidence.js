// Confiance d'une lignée SUR UN CIRCUIT : facteur appliqué à la vitesse max de
// ses voitures (vitesse max effective = vitesse max du modèle x confiance).
// Chaque circuit a sa propre confiance, mémorisée par le garage.
//
// Règle (numéros de génération comptés sur CE circuit, à partir de 0) :
//   - génération 0 : 100 % ;
//   - générations 1 et 2 : 50 % ;
//   - ensuite, après chaque génération, on compare le meilleur pourcentage de
//     circuit parcouru par les 2 générations précédentes :
//       progrès = % (dernière) - % (avant-dernière), en points
//       progrès < 1 point  → la confiance baisse de 50 points
//       progrès < 2 points → baisse de 25 points
//       progrès < 4 points → baisse de 12,5 points
//       progrès ≥ 4 points → la confiance remonte à 100 %
//     (un recul compte comme un progrès inférieur à 1 point) ;
//   - jamais en dessous de 50 % ;
//   - circuit complété (tour bouclé) : 100 %.
const CONFIDENCE_START = 1;            // génération 0 sur un circuit
const CONFIDENCE_EARLY = 0.5;          // générations 1 et 2
const CONFIDENCE_EARLY_GENERATIONS = 2;
const CONFIDENCE_MIN = 0.5;            // plancher : jamais plus lent que 50 % du modèle
const CONFIDENCE_MAX = 1;
// Paliers : si le progrès (en points de %) est inférieur à `below`, la
// confiance baisse de `drop` (en points de confiance, 0,5 = 50 points).
const CONFIDENCE_STEPS = [
  { below: 1, drop: 0.5 },
  { below: 2, drop: 0.25 },
  { below: 4, drop: 0.125 }
];

// Ramène une progression en tours dans [0, 1] ; une valeur non finie compte pour 0.
function unitClamp(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

// État de confiance d'une lignée sur un circuit jamais parcouru.
//   confidence   : confiance de la prochaine génération
//   runs         : nombre de générations déjà terminées sur ce circuit
//   lastProgress : meilleur % (en tours, 0..1) de la dernière génération terminée
function initialConfidenceState() {
  return { confidence: CONFIDENCE_START, runs: 0, lastProgress: null };
}

// Accepte un état complet, une confiance seule (nombre) ou rien.
function toConfidenceState(value) {
  if (value === null || value === undefined) return initialConfidenceState();
  if (typeof value === "number") return { ...initialConfidenceState(), confidence: value };
  return { ...initialConfidenceState(), ...value };
}

// Variation de confiance selon le progrès entre deux générations (en points de %).
// Retourne la nouvelle confiance, bornée à [CONFIDENCE_MIN, CONFIDENCE_MAX].
function confidenceFromProgress(currentConfidence, progressPoints) {
  const current = Number.isFinite(currentConfidence) ? currentConfidence : CONFIDENCE_START;
  const step = CONFIDENCE_STEPS.find((s) => progressPoints < s.below);
  if (!step) return CONFIDENCE_MAX;
  return Math.min(CONFIDENCE_MAX, Math.max(CONFIDENCE_MIN, current - step.drop));
}

// Nouvel état après une génération terminée sur le circuit : `progress` est
// le meilleur % de cette génération (en tours), `finished` vrai si le tour a
// été bouclé. Fonction pure : l'état passé n'est pas modifié.
function advanceConfidence(state, progress, finished) {
  const previous = state ?? initialConfidenceState();
  const runs = (Number.isInteger(previous.runs) ? previous.runs : 0) + 1; // = numéro de la prochaine génération
  const reached = unitClamp(progress);
  let confidence;
  if (finished) {
    confidence = CONFIDENCE_MAX;
  } else if (runs <= CONFIDENCE_EARLY_GENERATIONS) {
    confidence = CONFIDENCE_EARLY;
  } else {
    const before = unitClamp(previous.lastProgress);
    // Arrondi au millionième de point : 0,42 - 0,40 vaut 2 points, pas 1,99999…
    const points = Math.round((reached - before) * 100 * 1e6) / 1e6;
    confidence = confidenceFromProgress(previous.confidence, points);
  }
  return { confidence, runs, lastProgress: reached };
}
