// Réglages de performance (étape 26) : ce que la page dessine pendant
// l'entraînement. Moins de dessin = plus de temps pour la simulation, donc
// plus de pas par seconde en mode accéléré. Les résultats de l'entraînement
// ne changent pas : un pas de simulation reste identique, seul l'affichage
// est allégé. Le décor (herbe / léger) garde son propre réglage (decor.js).
//
//   cars   : voitures dessinées — "all" (toutes), "champions" (la meilleure de
//            chaque lignée), "none" (aucune)
//   flames : flammes de la ligne d'arrivée (détection et dessin)
//   panel  : rafraîchissement du panneau des lignées — "normal" (toutes les
//            10 images) ou "slow" (toutes les 60 images ≈ 1 s)
//   hidden : circuit + voitures invisibles — écran sombre avec un résumé ;
//            le budget de calcul par image passe de 12 à 15 ms
//   shaders: décors en shader (étape 27, shader-settings.js) — coupés dans les
//            préréglages intermédiaire et invisible
const PERF_STORAGE_KEY = "f1-neuroevolution-perf-v1";
const CAR_DISPLAY_MODES = ["all", "champions", "none"];
const PANEL_EVERY_NORMAL = 10;
const PANEL_EVERY_SLOW = 60;
const HIDDEN_FRAME_BUDGET_MS = 15;   // presque toute l'image (16,7 ms) : il n'y a rien à dessiner

const DEFAULT_PERF = { cars: "all", flames: true, panel: "normal", hidden: false, shaders: true };

// Préréglages du menu : décor compris.
const PERF_PRESETS = {
  complet: { decor: "grass", perf: { cars: "all", flames: true, panel: "normal", hidden: false, shaders: true } },
  intermediaire: { decor: "light", perf: { cars: "champions", flames: false, panel: "slow", hidden: false, shaders: false } },
  invisible: { decor: "light", perf: { cars: "none", flames: false, panel: "slow", hidden: true, shaders: false } }
};
const PERF_PRESET_LABELS = { complet: "complet", intermediaire: "intermédiaire", invisible: "invisible" };

// ---------- Fonctions pures (testées) ----------

// Réglages valides à partir de n'importe quelle valeur (champ invalide → défaut).
function normalizePerf(value) {
  const raw = value && typeof value === "object" ? value : {};
  return {
    cars: CAR_DISPLAY_MODES.includes(raw.cars) ? raw.cars : DEFAULT_PERF.cars,
    flames: typeof raw.flames === "boolean" ? raw.flames : DEFAULT_PERF.flames,
    panel: raw.panel === "slow" ? "slow" : "normal",
    hidden: raw.hidden === true,
    shaders: typeof raw.shaders === "boolean" ? raw.shaders : DEFAULT_PERF.shaders
  };
}

// Préréglage correspondant exactement aux réglages, sinon "personnalise".
function perfPresetName(perf, decor) {
  const current = normalizePerf(perf);
  for (const [name, preset] of Object.entries(PERF_PRESETS)) {
    const same = Object.keys(DEFAULT_PERF).every((k) => current[k] === preset.perf[k]);
    if (same && normalizeDecor(decor) === preset.decor) return name;
  }
  return "personnalise";
}

function perfButtonLabel(perf, decor) {
  const name = perfPresetName(perf, decor);
  return `Performances : ${PERF_PRESET_LABELS[name] ?? "personnalisé"}`;
}

// Réglage suivant d'une option du menu (copie : l'entrée n'est pas modifiée).
function toggledPerf(perf, option) {
  const next = normalizePerf(perf);
  if (option === "cars") next.cars = CAR_DISPLAY_MODES[(CAR_DISPLAY_MODES.indexOf(next.cars) + 1) % CAR_DISPLAY_MODES.length];
  else if (option === "flames") next.flames = !next.flames;
  else if (option === "panel") next.panel = next.panel === "slow" ? "normal" : "slow";
  else if (option === "hidden") next.hidden = !next.hidden;
  else if (option === "shaders") next.shaders = !next.shaders;
  return next;
}

// Libellés des options (l'état est écrit en toutes lettres, pas seulement en couleur).
function perfOptionLabel(perf, option) {
  const p = normalizePerf(perf);
  if (option === "cars") return `Voitures dessinées : ${{ all: "toutes", champions: "meilleure de chaque lignée", none: "aucune" }[p.cars]}`;
  if (option === "flames") return `Flammes d'arrivée : ${p.flames ? "affichées" : "masquées"}`;
  if (option === "panel") return `Panneau des lignées : ${p.panel === "slow" ? "1 fois par seconde" : "6 fois par seconde"}`;
  if (option === "hidden") return `Circuit + voitures : ${p.hidden ? "invisibles" : "visibles"}`;
  if (option === "shaders") return `Effets shader : ${p.shaders ? "activés" : "désactivés"}`;
  return "";
}

// Voitures à dessiner, dans l'ordre de dessin (la meilleure en dernier, au-dessus).
// Le tableau `cars` n'est pas modifié ; les voitures sont les mêmes objets.
function carsToDraw(cars, perf) {
  const p = normalizePerf(perf);
  if (p.hidden || p.cars === "none") return [];
  const chosen = p.cars === "champions" ? [...groupByLineage(cars).values()].map(bestCar) : cars.slice();
  return chosen.sort(compareCars).reverse();
}

function perfPanelEvery(perf) {
  return normalizePerf(perf).panel === "slow" ? PANEL_EVERY_SLOW : PANEL_EVERY_NORMAL;
}

// Temps de calcul par image (ms) donné à runSimulationSteps.
function perfFrameBudget(perf) {
  return normalizePerf(perf).hidden ? HIDDEN_FRAME_BUDGET_MS : SIM_FRAME_BUDGET_MS;
}

function loadPerf(storage) {
  if (!storage) return normalizePerf(null);
  try {
    const raw = storage.getItem(PERF_STORAGE_KEY);
    return normalizePerf(raw ? JSON.parse(raw) : null);
  } catch (error) {
    return normalizePerf(null);   // illisible ou stockage bloqué : réglages par défaut
  }
}

function savePerf(storage, perf) {
  if (!storage) return;
  try {
    storage.setItem(PERF_STORAGE_KEY, JSON.stringify(normalizePerf(perf)));
  } catch (error) {
    // stockage bloqué : le réglage vaut pour cette page seulement
  }
}
