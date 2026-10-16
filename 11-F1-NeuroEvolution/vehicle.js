// Base Vehicle de l'exemple 11 (modèle de Reynolds : steering + locomotion).
// Les voitures spécialisent cette classe dans car.js : ne pas modifier ce fichier
// sans accord explicite (voir AGENTS.md).
//
// Unités : positions en pixels, vitesses en pixels par image, forces en
// pixels par image². Le mouvement est intégré une fois par image (update()).
class Vehicle {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.maxSpeed = 4;
    this.maxForce = 0.2;
  }

  // Seek : vitesse désirée vers la cible moins vitesse courante, bornée par maxForce.
  // Cible confondue avec la position : force nulle.
  seek(targetPosition) {
    const desired = p5.Vector.sub(targetPosition, this.pos);
    if (desired.magSq() === 0) return createVector(0, 0);
    desired.setMag(this.maxSpeed);
    const steering = p5.Vector.sub(desired, this.vel);
    steering.limit(this.maxForce);
    return steering;
  }

  applyForce(force) {
    this.acc.add(force);
  }

  // Locomotion : intégration d'Euler par image.
  update() {
    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc.set(0, 0);
  }
}
