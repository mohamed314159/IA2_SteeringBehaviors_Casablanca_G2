// Petit oiseau « à tête chercheuse » (comme les missiles de 10-missiles genetic
// algo), piloté par un réseau de neurones à 8 neurones cachés.
// Sous-classe de SteeringAgent : le réseau ne déplace pas l'oiseau, il
// choisit une vitesse désirée ; le steering reste celui de Reynolds
// (force = vitesse désirée − vitesse courante, bornée par maxForce) et la
// locomotion est celle de la base.
//
// Entrées du réseau (6) : direction du pain (vecteur unitaire x, y), distance
// du pain (rapportée à la portée des yeux), vitesse de l'oiseau (x, y) et
// vitesse du pain dans la direction de l'oiseau. Sorties (2) : vitesse
// désirée (x, y), en fraction de maxSpeed.
// Il « s'arrête » s'il reste presque immobile ou si son énergie est épuisée
// sans avoir attrapé le pain : la scène le fait disparaître puis réapparaître
// avec un cerveau cloné et muté du meilleur (wildlife.js).
// Score (fitness) entre 0 et 2 : part de la distance de départ parcourue vers
// le pain (0 à 1) ; une capture vaut 1 plus un bonus de rapidité (0 à 1).
const BIRD_CONFIG = {
  maxSpeed: kmh(25),
  maxForce: 0.25,        // agile : rayon de virage ≈ v² / maxForce ≈ 15 m
  sensorRangeM: 60,      // distance de normalisation des entrées
  lifeSeconds: 15,       // énergie : durée de vol maximale (≈ 100 m)
  stillSeconds: 2,       // immobile plus de 2 s : il s'est arrêté
  catchM: 1.2            // distance de capture du pain
};

class Bird extends SteeringAgent {
  constructor(x, y, brain, rng = Math.random, config = BIRD_CONFIG) {
    super(x, y);
    this.config = config;
    this.brain = brain ?? new NeuralNetwork(6, NN_HIDDEN, 2, rng);
    this.maxSpeed = config.maxSpeed;
    this.maxForce = config.maxForce;
    this.r = mPx(0.18) * 2.5;
    this.age = 0;
    this.stillSteps = 0;
    this.state = "flying";
    this.startDist = null;
    this.minDist = Infinity;
    this.captures = 0;
    this.wingPhase = rng() * 6;
    this.setBehavior("neuro");
  }

  // Entrées normalisées du réseau.
  inputs(bread) {
    const portee = mPx(this.config.sensorRangeM);
    const d = p5.Vector.sub(bread.pos, this.pos);
    const distance = d.mag();
    const u = distance > 1e-9 ? d.copy().div(distance) : createVector(0, 0);
    const v = this.maxSpeed || 1;
    return [
      u.x, u.y,
      Math.min(1, distance / portee),
      this.vel.x / v, this.vel.y / v,
      (bread.vel.x * u.x + bread.vel.y * u.y) / v
    ];
  }

  // Force de steering décidée par le réseau.
  brainForce(bread) {
    const [ox, oy] = this.brain.predict(this.inputs(bread));
    const desiree = createVector(ox, oy).mult(this.maxSpeed);
    return p5.Vector.sub(desiree, this.vel).limit(this.maxForce);
  }

  // Un pas : réseau → force → intégration héritée ; retourne true si le pain est attrapé.
  step(bread) {
    if (this.state !== "flying") return false;
    const d0 = p5.Vector.dist(this.pos, bread.pos);
    if (this.startDist === null) this.startDist = d0;
    this.steer([{ name: "neuro", force: this.brainForce(bread) }]);
    this.update();
    this.age++;
    this.wingPhase += 0.6;
    const d = p5.Vector.dist(this.pos, bread.pos);
    this.minDist = Math.min(this.minDist, d);
    this.stillSteps = this.vel.mag() < this.maxSpeed * 0.05 ? this.stillSteps + 1 : 0;
    if (d <= mPx(this.config.catchM)) {
      this.captures++;
      return true;
    }
    if (this.stillSteps >= stepsFor(this.config.stillSeconds) || this.age >= stepsFor(this.config.lifeSeconds)) {
      this.state = "stopped";
    }
    return false;
  }

  // Score entre 0 et 2 (voir l'en-tête) : comparable d'un départ à l'autre.
  fitness() {
    if (this.captures > 0) return 1 + Math.max(0, 1 - this.age / stepsFor(this.config.lifeSeconds));
    const depart = this.startDist ?? 0;
    if (!(depart > 0) || !Number.isFinite(this.minDist)) return 0;
    return Math.max(0, Math.min(1, (depart - this.minDist) / depart));
  }

  show() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.heading.heading());
    scale(this.sizeFactor());
    const r = this.r;
    const aile = Math.sin(this.wingPhase) * r * 0.9;
    noStroke();
    fill(0, 0, 0, 40);
    ellipse(r * 1.5, r * 1.5, r * 2, r);
    fill(120, 85, 55);
    triangle(-r * 0.2, 0, r * 0.2, -r - aile, r * 0.6, 0);
    triangle(-r * 0.2, 0, r * 0.2, r + aile, r * 0.6, 0);
    fill(150, 110, 70);
    ellipse(0, 0, r * 2, r * 0.9);
    fill(90, 60, 40);
    circle(r * 0.9, 0, r * 0.7);
    fill(240, 180, 60);
    triangle(r * 1.2, -0.12 * r, r * 1.2, 0.12 * r, r * 1.5, 0);
    pop();
  }
}
