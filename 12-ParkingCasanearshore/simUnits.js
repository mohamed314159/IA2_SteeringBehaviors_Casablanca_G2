// Unités de la simulation. Le mouvement reste « par pas » comme dans les
// bases du cours (pas de deltaTime) : un pas de simulation représente
// SIM_STEP_SECONDS secondes de l'horloge. À ×1, une image = un pas.
const SIM_STEP_SECONDS = 0.2;
const PX_PER_METER = 2;

// km/h → px par pas
function kmh(v) {
  return (v / 3.6) * SIM_STEP_SECONDS * PX_PER_METER;
}

// m → px
function mPx(v) {
  return v * PX_PER_METER;
}

// secondes de simulation → nombre de pas
function stepsFor(seconds) {
  return Math.round(seconds / SIM_STEP_SECONDS);
}
