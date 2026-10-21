// Chat qui chasse le papillon : pursue (2-PursueEvade) — il vise la
// position future du papillon, horizon borné T = distance / vitesse.
// Après une capture, il se repose quelques secondes (arrive sur place,
// freinage), puis reprend la chasse. Sous-classe de SteeringAgent.
const CAT_CONFIG = {
  maxSpeed: kmh(11),
  maxForce: 0.09,
  catchM: 0.5,
  restSeconds: 8,
  horizon: 25
};

class Cat extends SteeringAgent {
  constructor(x, y, zone, rng = Math.random, config = CAT_CONFIG) {
    super(x, y);
    this.zone = zone;
    this.config = config;
    this.maxSpeed = config.maxSpeed;
    this.maxForce = config.maxForce;
    this.predictionHorizon = config.horizon;
    this.r = mPx(0.25) * 2;
    this.state = "hunt";
    this.restSteps = 0;
    this.catches = 0;
    this.color = randomPick(rng, ["#e0a060", "#4a4a4a", "#f2f2f2", "#9e6b3a"]);
    this.tailPhase = rng() * 6;
  }

  // Un pas ; retourne true si le papillon est attrapé.
  step(papillon) {
    const entrees = [];
    if (this.state === "rest" || !papillon) {
      entrees.push({ name: "brake", force: this.brake() });
      this.setBehavior("idle");
      if (--this.restSteps <= 0) this.state = "hunt";
    } else {
      this.maxSpeed = this.speedFor(this.config.maxSpeed);
      if (p5.Vector.dist(this.pos, this.zone.center) > this.zone.radius * 1.2) {
        entrees.push({ name: "containment", force: this.seekTo(this.zone.center), weight: 1.5 });
      }
      entrees.push({ name: "pursue", force: this.pursue(papillon), weight: 1 });
      this.setBehavior("pursue");
    }
    this.steer(entrees);
    this.update();
    this.tailPhase += 0.2;
    if (this.state === "hunt" && papillon && p5.Vector.dist(this.pos, papillon.pos) <= mPx(this.config.catchM)) {
      this.catches++;
      this.state = "rest";
      this.restSteps = stepsFor(this.config.restSeconds);
      return true;
    }
    return false;
  }

  show() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.heading.heading());
    scale(this.sizeFactor());
    const r = this.r;
    noStroke();
    fill(0, 0, 0, 50);
    ellipse(r * 0.2, r * 0.3, r * 2.4, r * 1.3);
    // queue
    stroke(this.color);
    strokeWeight(r * 0.25);
    noFill();
    const q = Math.sin(this.tailPhase) * r * 0.6;
    bezier(-r, 0, -r * 1.6, q, -r * 1.9, -q, -r * 2.3, q);
    noStroke();
    fill(this.color);
    ellipse(0, 0, r * 2.2, r * 1.2);
    circle(r * 1.1, 0, r * 0.9);
    triangle(r * 1.2, -r * 0.45, r * 1.5, -r * 0.2, r * 1.1, -r * 0.1);
    triangle(r * 1.2, r * 0.45, r * 1.5, r * 0.2, r * 1.1, r * 0.1);
    pop();
  }
}
