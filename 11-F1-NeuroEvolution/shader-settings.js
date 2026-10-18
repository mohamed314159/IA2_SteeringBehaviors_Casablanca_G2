// Décors en shader (étape 27) : réglages et calculs purs (testés sans navigateur).
// Le rendu GLSL est dans shader-decor.js ; la carte de chaleur dans heat-map.js.
// Ce sont des règles d'affichage : elles ne changent ni la perception, ni le
// steering, ni la locomotion des voitures.
//
// Interrupteur général : l'option « Effets shader » du menu Performances
// (perf.shaders, performance-settings.js). Les préréglages intermédiaire et
// invisible la coupent ; sans WebGL, le décor classique reste affiché.
//
// Réglages propres aux shaders (mémorisés) :
//   ambiance : "auto" (celle du circuit) ou une ambiance imposée
//   heatmap  : carte de chaleur des passages (bleu) et des sorties de piste (rouge)
//   trail    : traînée lumineuse derrière la meilleure voiture
//   wind     : herbe ondulant au vent
const SHADER_STORAGE_KEY = "f1-neuroevolution-shaders-v1";
const AMBIANCES = ["jour", "nuit", "pluie", "canicule", "neige", "brouillard", "neon", "crepuscule"];
const AMBIANCE_CHOICES = ["auto", ...AMBIANCES];
const AMBIANCE_LABELS = {
  auto: "auto", jour: "jour", nuit: "nuit (phares)", pluie: "pluie", canicule: "canicule (mirage)",
  neige: "neige", brouillard: "brouillard", neon: "néon", crepuscule: "crépuscule"
};
const DEFAULT_SHADER_SETTINGS = { ambiance: "auto", heatmap: false, trail: true, wind: true };
const SHADER_TOGGLES = ["heatmap", "trail", "wind"];

// Intensité (0 à 1) de chaque effet d'ambiance, envoyée au shader en uniforms.
// « jour » n'ajoute rien : c'est le décor classique (avec l'herbe au vent si activée).
const AMBIANCE_EFFECTS = ["night", "rain", "haze", "snow", "fog", "neon", "dusk"];
const AMBIANCE_PARAMS = {
  jour: {},
  nuit: { night: 1 },
  pluie: { rain: 1 },
  canicule: { haze: 1 },
  neige: { snow: 1 },
  brouillard: { fog: 1 },
  neon: { neon: 1 },
  crepuscule: { dusk: 1 }
};

const MAX_HEADLIGHTS = 24;           // voitures éclairées la nuit (taille du tableau d'uniforms)
const TRAIL_MAX_JUMP = 60;           // px : au-delà, la voiture a été remplacée (pas de trait)
const TRAIL_MIN_STEP = 0.5;          // px : en dessous, la voiture est arrêtée (pas de tache blanche)
const SHADER_TIME_PERIOD = 600;      // s : temps ramené dans [0, 600[ (précision des flottants GLSL)

// ---------- Réglages ----------

function normalizeShaderSettings(value) {
  const raw = value && typeof value === "object" ? value : {};
  return {
    ambiance: AMBIANCE_CHOICES.includes(raw.ambiance) ? raw.ambiance : DEFAULT_SHADER_SETTINGS.ambiance,
    heatmap: typeof raw.heatmap === "boolean" ? raw.heatmap : DEFAULT_SHADER_SETTINGS.heatmap,
    trail: typeof raw.trail === "boolean" ? raw.trail : DEFAULT_SHADER_SETTINGS.trail,
    wind: typeof raw.wind === "boolean" ? raw.wind : DEFAULT_SHADER_SETTINGS.wind
  };
}

// Réglage suivant (copie) : l'ambiance tourne dans la liste, les autres basculent.
function toggledShaderSetting(settings, option) {
  const next = normalizeShaderSettings(settings);
  if (option === "ambiance") {
    next.ambiance = AMBIANCE_CHOICES[(AMBIANCE_CHOICES.indexOf(next.ambiance) + 1) % AMBIANCE_CHOICES.length];
  } else if (SHADER_TOGGLES.includes(option)) {
    next[option] = !next[option];
  }
  return next;
}

// Ambiance d'un circuit (champ `ambiance` du tracé), « jour » par défaut.
function circuitAmbiance(layout) {
  return layout && AMBIANCES.includes(layout.ambiance) ? layout.ambiance : "jour";
}

// Ambiance réellement dessinée : celle imposée, ou celle du circuit en mode auto.
function effectiveAmbiance(settings, layout) {
  const s = normalizeShaderSettings(settings);
  return s.ambiance === "auto" ? circuitAmbiance(layout) : s.ambiance;
}

// Intensités des 7 effets pour une ambiance (0 pour les effets absents).
function ambianceParams(ambiance) {
  const params = AMBIANCE_PARAMS[AMBIANCES.includes(ambiance) ? ambiance : "jour"];
  const result = {};
  for (const effect of AMBIANCE_EFFECTS) result[effect] = params[effect] ?? 0;
  return result;
}

// Libellés des boutons du menu (état écrit en toutes lettres).
function shaderOptionLabel(settings, option, layout) {
  const s = normalizeShaderSettings(settings);
  if (option === "ambiance") {
    return s.ambiance === "auto"
      ? `Ambiance : auto (${AMBIANCE_LABELS[circuitAmbiance(layout)]})`
      : `Ambiance : ${AMBIANCE_LABELS[s.ambiance]}`;
  }
  if (option === "heatmap") return `Carte de chaleur : ${s.heatmap ? "affichée" : "masquée"}`;
  if (option === "trail") return `Traînée du leader : ${s.trail ? "affichée" : "masquée"}`;
  if (option === "wind") return `Herbe au vent : ${s.wind ? "animée" : "immobile"}`;
  return "";
}

// Les shaders sont-ils dessinés ? Option activée, WebGL disponible, scène visible.
function shadersActive(perf, webglAvailable, sceneHidden) {
  return normalizePerf(perf).shaders && webglAvailable === true && !sceneHidden;
}

function loadShaderSettings(storage) {
  if (!storage) return normalizeShaderSettings(null);
  try {
    const raw = storage.getItem(SHADER_STORAGE_KEY);
    return normalizeShaderSettings(raw ? JSON.parse(raw) : null);
  } catch (error) {
    return normalizeShaderSettings(null);   // illisible ou stockage bloqué
  }
}

function saveShaderSettings(storage, settings) {
  if (!storage) return;
  try {
    storage.setItem(SHADER_STORAGE_KEY, JSON.stringify(normalizeShaderSettings(settings)));
  } catch (error) {
    // stockage bloqué : le réglage vaut pour cette page seulement
  }
}

// Temps du shader en secondes, à partir du numéro d'image (60 images/s),
// ramené dans [0, SHADER_TIME_PERIOD[.
function shaderTime(frame) {
  const seconds = (Number.isFinite(frame) && frame > 0 ? frame : 0) / 60;
  return seconds % SHADER_TIME_PERIOD;
}

// ---------- Phares (ambiance nuit) ----------

// Tableau plat [x, y, cap, x, y, cap…] de taille 3 × max (complété par des 0)
// et nombre de phares. Seules les voitures en course, à position et cap finis,
// sont éclairées ; les dernières de la liste (les meilleures, dessinées en
// dernier) sont prioritaires. Les voitures ne sont pas modifiées.
function headlightData(cars, max = MAX_HEADLIGHTS) {
  const lit = cars.filter((car) => car.racing && Number.isFinite(car.pos.x) && Number.isFinite(car.pos.y) && Number.isFinite(car.heading));
  const chosen = lit.slice(Math.max(0, lit.length - max));
  const data = new Array(max * 3).fill(0);
  chosen.forEach((car, i) => {
    data[i * 3] = car.pos.x;
    data[i * 3 + 1] = car.pos.y;
    data[i * 3 + 2] = car.heading;
  });
  return { data, count: chosen.length };
}

// ---------- Traînée du leader ----------

// Segment parcouru par le leader depuis l'image précédente. Pas de trait si le
// leader a changé, s'il a sauté (nouvelle génération au départ), s'il est arrêté
// ou éliminé, ou s'il n'y en a pas.
class TrailTracker {
  constructor(maxJump = TRAIL_MAX_JUMP) {
    this.maxJump = maxJump;
    this.clear();
  }

  clear() {
    this.car = null;
    this.last = null;
  }

  // Retourne { x0, y0, x1, y1, active } ; le vecteur pos de la voiture n'est pas modifié.
  update(car) {
    if (!car || !car.racing || !Number.isFinite(car.pos.x) || !Number.isFinite(car.pos.y)) {
      this.clear();
      return { x0: 0, y0: 0, x1: 0, y1: 0, active: false };
    }
    const current = { x: car.pos.x, y: car.pos.y };
    const previous = this.car === car ? this.last : null;
    this.car = car;
    this.last = current;
    const step = previous ? Math.hypot(current.x - previous.x, current.y - previous.y) : 0;
    if (!previous || step > this.maxJump || step < TRAIL_MIN_STEP) {
      return { x0: current.x, y0: current.y, x1: current.x, y1: current.y, active: false };
    }
    return { x0: previous.x, y0: previous.y, x1: current.x, y1: current.y, active: true };
  }
}
