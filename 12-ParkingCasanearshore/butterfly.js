// Papillon : vol erratique (wander rapide, hérité de 1-Seek), esquive des
// chats qui approchent (evade : rayon de détection et distance de sortie
// distincts) et confinement à la pelouse (seek vers le centre). Sous-classe
// de SteeringAgent. Quand un chat l'attrape, la scène en fait apparaître un autre.
class Butterfly extends SteeringAgent {
  constructor(x, y, zone, rng = Math.random) {
    super(x, y);
    this.zone = zone;
    this.maxSpeed = kmh(13);   // plus rapide que le chat (11 km/h) : il ne se fait prendre que coincé
    this.maxForce = 0.12;
    this.r = mPx(0.12) * 3;
    this.distanceCercle = mPx(1.5);
    this.wanderRadius = mPx(1.2);
    this.displaceRange = 0.9;
    this.evadeDetectionRadius = mPx(5);
    this.evadeExitRadius = mPx(8);
    this.vel = p5.Vector.fromAngle(rng() * Math.PI * 2).mult(this.maxSpeed * 0.5);
    this.wingPhase = rng() * 6;
    this.color = randomPick(rng, ["#ffb300", "#4fc3f7", "#f06292", "#ffffff"]);
    this.caught = false;
  }

  step(chats) {
    const entrees = [];
    entrees.push({ name: "evade", force: this.evadeThreats(chats), weight: 2 });
    if (p5.Vector.dist(this.pos, this.zone.center) > this.zone.radius) {
      entrees.push({ name: "containment", force: this.seekTo(this.zone.center), weight: 1.5 });
    }
    entrees.push({ name: "wander", force: this.wanderAround(), weight: 1 });
    this.setBehavior(this.evadeState.active ? "evade" : "wander");
    this.steer(entrees);
    this.update();
    this.wingPhase += 0.9;
  }

  show() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.heading.heading());
    scale(this.sizeFactor());
    const r = this.r;
    const ouverture = 0.4 + 0.6 * Math.abs(Math.sin(this.wingPhase));
    noStroke();
    fill(this.color);
    ellipse(-r * 0.2, -r * 0.7 * ouverture, r * 1.2, r * 1.4 * ouverture);
    ellipse(-r * 0.2, r * 0.7 * ouverture, r * 1.2, r * 1.4 * ouverture);
    fill(40);
    ellipse(0, 0, r * 1.2, r * 0.25);
    pop();
  }
}
