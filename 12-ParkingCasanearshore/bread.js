// Morceau de pain que les oiseaux apprennent à attraper. Il se déplace au
// hasard dans le parc : wander (hérité de 1-Seek) + confinement (seek vers
// le centre de sa zone s'il s'en éloigne). Sous-classe de SteeringAgent.
class Bread extends SteeringAgent {
  constructor(x, y, zone) {
    super(x, y);
    this.zone = zone; // { center, radius }
    this.maxSpeed = kmh(3);
    this.maxForce = 0.03;
    this.r = mPx(0.25) * 3;     // dessin agrandi pour rester visible (la capture utilise catchM)
    this.distanceCercle = mPx(3);
    this.wanderRadius = mPx(1.5);
    this.displaceRange = 0.4;
    this.vel = p5.Vector.fromAngle(0).mult(this.maxSpeed);
    this.setBehavior("wander");
  }

  step() {
    const entrees = [];
    if (p5.Vector.dist(this.pos, this.zone.center) > this.zone.radius) {
      entrees.push({ name: "containment", force: this.seekTo(this.zone.center), weight: 2 });
    }
    entrees.push({ name: "wander", force: this.wanderAround(), weight: 1 });
    this.setBehavior("wander");
    this.steer(entrees);
    this.update();
  }

  show() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.heading.heading());
    noStroke();
    fill(0, 0, 0, 60);
    ellipse(0.15, 0.2, this.r * 2.6, this.r * 1.8);
    fill(214, 168, 96);
    ellipse(0, 0, this.r * 2.6, this.r * 1.8);
    fill(240, 214, 160);
    ellipse(0, 0, this.r * 1.6, this.r * 1.0);
    pop();
  }
}
