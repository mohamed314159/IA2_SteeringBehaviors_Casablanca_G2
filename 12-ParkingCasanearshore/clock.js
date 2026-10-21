// Horloge de la simulation (règle de scène) : de 8h30 à 9h05. Chaque pas
// avance l'horloge de SIM_STEP_SECONDS secondes. L'horloge ne dépend pas du
// temps réel : elle est entièrement contrôlée par le nombre de pas.
const CLOCK_CONFIG = {
  start: { h: 8, m: 30 },
  work: { h: 8, m: 55 },
  end: { h: 9, m: 5 }
};

function clockSeconds(hm) {
  return hm.h * 3600 + hm.m * 60;
}

class SimClock {
  constructor(config = CLOCK_CONFIG) {
    this.config = config;
    this.steps = 0;
  }

  // Secondes écoulées depuis le début de la simulation.
  elapsed() {
    return this.steps * SIM_STEP_SECONDS;
  }

  // Heure courante en secondes depuis minuit.
  now() {
    return clockSeconds(this.config.start) + this.elapsed();
  }

  tick() {
    this.steps++;
  }

  // Secondes depuis le début pour une heure donnée.
  at(h, m, s = 0) {
    return h * 3600 + m * 60 + s - clockSeconds(this.config.start);
  }

  isWorkTime() {
    return this.now() >= clockSeconds(this.config.work);
  }

  isOver() {
    return this.now() >= clockSeconds(this.config.end);
  }

  label() {
    const t = Math.floor(this.now());
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
}
