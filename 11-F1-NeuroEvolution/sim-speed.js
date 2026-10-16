// Accélération de la simulation : à ×N, chaque image affichée exécute N pas
// de simulation (perception, réseau, déplacement, règles), puis dessine une
// seule fois. Un pas accéléré est exactement un pas à ×1 : les résultats sont
// identiques, seule la vitesse d'affichage change.
//
// Le calcul (rayons, réseau, déplacements) est fait par le processeur en
// JavaScript ; la carte graphique ne dessine qu'une image. Pour ne pas geler la
// page, les pas d'une image s'arrêtent quand le budget de temps est épuisé :
// le facteur effectivement atteint est alors plus petit et il est affiché.
const SPEED_FACTORS = [1, 2, 5, 10, 20, 50, 100, "max"];
const SIM_FRAME_BUDGET_MS = 12;    // temps de calcul par image (60 images/s ≈ 16,7 ms)
const SIM_MAX_STEPS = 1000;        // plafond de pas par image en mode « max »
const SIM_SPEED_STORAGE_KEY = "f1-neuroevolution-sim-speed-v1";

// Facteur valide (1, 2, 5… ou "max") ; toute autre valeur → 1.
function normalizeSpeedFactor(value) {
  if (value === "max") return "max";
  const number = Number(value);
  return SPEED_FACTORS.includes(number) ? number : 1;
}

// Exécute jusqu'à `factor` pas (SIM_MAX_STEPS pour "max") en respectant le
// budget de temps. step() fait un pas et retourne false s'il n'y a plus rien
// à simuler. now() donne l'heure en ms (injectable pour les tests).
// Retourne le nombre de pas réellement exécutés. Au moins un pas est toujours
// fait, pour que la simulation avance même sur une machine lente.
function runSimulationSteps(step, factor, now = () => performance.now(), budgetMs = SIM_FRAME_BUDGET_MS) {
  const wanted = factor === "max" ? SIM_MAX_STEPS : Math.max(1, Math.floor(factor));
  const start = now();
  let steps = 0;
  while (steps < wanted) {
    const keepGoing = step();
    steps++;
    if (keepGoing === false) break;
    if (now() - start >= budgetMs) break;
  }
  return steps;
}

// Moyenne glissante du nombre de pas par image (facteur effectif affiché).
class SpeedMeter {
  constructor(window = 30) {
    this.window = window;
    this.samples = [];
  }

  add(steps) {
    this.samples.push(steps);
    if (this.samples.length > this.window) this.samples.shift();
  }

  get average() {
    if (this.samples.length === 0) return 0;
    return this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
  }

  reset() {
    this.samples = [];
  }
}

function loadSpeedFactor(storage) {
  if (!storage) return 1;
  try {
    return normalizeSpeedFactor(storage.getItem(SIM_SPEED_STORAGE_KEY));
  } catch (error) {
    return 1;
  }
}

function saveSpeedFactor(storage, factor) {
  if (!storage) return;
  try {
    storage.setItem(SIM_SPEED_STORAGE_KEY, String(factor));
  } catch (error) {
    // stockage bloqué : le réglage vaut pour cette page seulement
  }
}
