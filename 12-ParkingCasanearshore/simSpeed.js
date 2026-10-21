// Accélération du temps (inspirée de 11-F1-NeuroEvolution/sim-speed.js) :
// à ×N, chaque image exécute N pas de simulation puis dessine une seule fois.
// Un pas accéléré est exactement un pas à ×1 : seule la vitesse d'affichage
// change, le steering n'est pas faussé (pas de deltaTime).
//
// Accélération automatique : quand rien ne se passe (aucun véhicule dans le
// parc ou près d'une porte, aucun tram à la station, aucun piéton en marche)
// et que le prochain événement est à plus de `lookahead` secondes, le temps
// passe à ×autoFactor. Il revient à la vitesse normale juste avant l'événement.
const SIM_SPEED_CONFIG = {
  manualFactors: [1, 2, 4],
  autoFactor: 8,
  lookaheadSeconds: 20,
  frameBudgetMs: 14
};

// Exécute jusqu'à `factor` pas en respectant le budget de temps de l'image
// (même principe que runSimulationSteps de 11-F1). Au moins un pas.
function runSimulationSteps(step, factor, now = () => performance.now(), budgetMs = SIM_SPEED_CONFIG.frameBudgetMs) {
  const wanted = Math.max(1, Math.floor(factor));
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

class TimeController {
  constructor(config = SIM_SPEED_CONFIG) {
    this.config = { ...config };
    this.manualFactor = 1;
    this.auto = true;
    this.paused = false;
    this.accelerating = false;
  }

  // Facteur voulu pour cette image.
  factor(quiet, secondsToNextEvent) {
    if (this.paused) return 0;
    this.accelerating = this.auto && quiet && secondsToNextEvent > this.config.lookaheadSeconds;
    return this.accelerating ? this.config.autoFactor * this.manualFactor : this.manualFactor;
  }

  label(factor) {
    if (this.paused) return "⏸ pause";
    return this.accelerating ? `⏩ ×${factor} (rien ne se passe)` : `▶ ×${factor}`;
  }
}
