// Flammes sur la ligne d'arrivée : effet visuel (règle de scène, pas un
// comportement de steering). Quand une voiture boucle un tour, la ligne de
// départ/arrivée s'embrase un court instant.
//  - Détection à chaque pas de simulation (detect) : un tour de plus d'après
//    LapTracker, avant qu'une lignée terminée soit remplacée.
//  - Animation une fois par image (update/show) : durées en images, donc
//    identiques quel que soit le facteur de vitesse de la simulation.
const FLAME_EMIT_FRAMES = 40;          // durée d'émission après un passage (images)
const FLAME_PER_FRAME = 8;             // particules émises par image
const FLAME_MAX_PARTICLES = 400;       // plafond (passages rapprochés en accéléré)
const FLAME_LIFE_MIN = 25;             // durée de vie d'une particule (images)
const FLAME_LIFE_MAX = 55;
const FLAME_RISE_MIN = 0.5;            // montée vers le haut de l'écran (px/image)
const FLAME_RISE_MAX = 2.4;
const FLAME_SIZE_MIN = 7;              // diamètre initial (px)
const FLAME_SIZE_MAX = 15;

// ---------- Fonctions pures (testées) ----------

// Ligne de départ/arrivée : du bord gauche au bord droit au point de départ.
function finishLine(circuit) {
  const start = circuit.startPose(0);
  const a = circuit.leftEdge[start.index];
  const b = circuit.rightEdge[start.index];
  return { a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y } };
}

// Couleur d'une particule selon son âge relatif (0 = naissance, 1 = fin) :
// jaune, orange, rouge, puis transparente. Retourne [r, g, b, alpha].
function flameColor(ageRatio) {
  const t = Math.min(1, Math.max(0, ageRatio));
  const stops = [
    [0, [255, 220, 90]],
    [0.3, [255, 140, 20]],
    [0.65, [220, 50, 10]],
    [1, [110, 15, 5]]
  ];
  let k = 0;
  while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
  const [t0, c0] = stops[k];
  const [t1, c1] = stops[k + 1];
  const u = (t - t0) / (t1 - t0);
  const rgb = c0.map((v, i) => Math.round(v + (c1[i] - v) * u));
  return [...rgb, Math.round(170 * (1 - t))];
}

// ---------- Effet ----------

class FinishFlames {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.particles = [];
    this.emitFramesLeft = 0;
    this.line = null;
    this.crossings = 0;               // passages détectés depuis le début
    this.lapsSeen = new WeakMap();    // voiture → tours déjà comptés
  }

  // Voitures qui ont bouclé un tour depuis le dernier appel ; allume les
  // flammes s'il y en a. Retourne leur nombre.
  detect(cars, circuit) {
    let crossed = 0;
    for (const car of cars) {
      const laps = car.lap.laps;
      if (laps > (this.lapsSeen.get(car) ?? 0)) {
        this.lapsSeen.set(car, laps);
        crossed++;
      }
    }
    if (crossed > 0) this.ignite(circuit, crossed);
    return crossed;
  }

  ignite(circuit, count = 1) {
    this.line = finishLine(circuit);
    this.emitFramesLeft = FLAME_EMIT_FRAMES;
    this.crossings += count;
  }

  // Changement de circuit : plus de flammes ni d'émission en cours.
  clear() {
    this.particles = [];
    this.emitFramesLeft = 0;
    this.line = null;
  }

  get active() {
    return this.emitFramesLeft > 0 || this.particles.length > 0;
  }

  // Une image : émission éventuelle, puis mouvement et vieillissement.
  update() {
    if (this.emitFramesLeft > 0 && this.line) {
      this.emit(FLAME_PER_FRAME);
      this.emitFramesLeft--;
    }
    for (const p of this.particles) {
      p.age++;
      p.vx = p.vx * 0.94 + (this.rng() - 0.5) * 0.2;   // vacillement
      p.x += p.vx;
      p.y += p.vy;
    }
    this.particles = this.particles.filter((p) => p.age < p.life);
  }

  // Particules réparties au hasard sur la ligne, montant vers le haut de l'écran.
  emit(count) {
    const { a, b } = this.line;
    for (let k = 0; k < count && this.particles.length < FLAME_MAX_PARTICLES; k++) {
      const t = this.rng();
      this.particles.push({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        vx: (this.rng() - 0.5) * 0.6,
        vy: -randomBetween(this.rng, FLAME_RISE_MIN, FLAME_RISE_MAX),
        age: 0,
        life: Math.round(randomBetween(this.rng, FLAME_LIFE_MIN, FLAME_LIFE_MAX)),
        size: randomBetween(this.rng, FLAME_SIZE_MIN, FLAME_SIZE_MAX)
      });
    }
  }

  // Dessin additif (les flammes s'éclairent entre elles), isolé par push/pop.
  show() {
    if (this.particles.length === 0) return;
    push();
    noStroke();
    blendMode(ADD);
    for (const p of this.particles) {
      const ratio = p.age / p.life;
      fill(...flameColor(ratio));
      circle(p.x, p.y, p.size * (1 - 0.6 * ratio));
    }
    blendMode(BLEND);
    pop();
  }
}
