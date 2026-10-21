// Gardien de sécurité en uniforme blanc, posté à une porte. Sous-classe de
// SteeringAgent.
// Sélection d'action :
//   post    arrive sur son poste (à côté de la barrière) et y reste ;
//   patrol  ronde le long de la clôture (path following aller-retour) ;
// toujours : évitement des voitures qui roulent (evade).
const GUARD_LOOK = {
  outfit: { key: "gardien", label: "Uniforme blanc", jacket: "#f5f5f2", shirt: "#ffffff", tie: "#1d2b4f", cap: true },
  skin: "#c68b59",
  hair: "#1b1b1b"
};

const GUARD_CONFIG = {
  walkSpeed: kmh(4),
  maxForce: 0.05,
  postSlowRadius: mPx(2),
  patrolEverySeconds: [60, 140],
  patrolLengthM: 30
};

class SecurityGuard extends SteeringAgent {
  constructor(post, patrol, rng = Math.random, config = GUARD_CONFIG) {
    super(post.x, post.y);
    this.config = config;
    this.post = post.copy();
    // Ronde : aller-retour le long de la clôture.
    this.patrolPath = new Path([post.copy(), ...patrol.map(p => p.copy()), post.copy()], mPx(1));
    this.maxSpeed = config.walkSpeed;
    this.maxForce = config.maxForce;
    this.r = mPx(0.3) * 2.2;
    this.length = this.r * 2;
    this.isPedestrian = true;
    this.level = 0;
    this.evadeDetectionRadius = mPx(5);
    this.evadeExitRadius = mPx(8);
    this.pathPredict = mPx(1.5);
    this.pathTargetAhead = mPx(2.5);
    this.look = GUARD_LOOK;
    this.rng = rng;
    this.state = "post";
    this.timer = stepsFor(randomBetween(rng, ...config.patrolEverySeconds));
    this.walkPhase = 0;
    this.heading = createVector(0, 1);
  }

  step(voitures) {
    const entrees = [{ name: "evade", force: this.evadeThreats(voitures), weight: 2.5 }];
    this.maxSpeed = this.speedFor(this.config.walkSpeed);
    if (this.state === "patrol") {
      entrees.push({ name: "path", force: this.follow(this.patrolPath), weight: 1 });
      this.setBehavior("path");
    } else {
      this.rayonZoneDeFreinage = this.config.postSlowRadius;
      entrees.push({ name: "arrive", force: this.arriveAt(this.post), weight: 1 });
      this.setBehavior("arrive");
    }
    this.steer(entrees);
    this.update();
    this.walkPhase += this.vel.mag() * 0.9;
    // Transitions : départ en ronde, puis retour au poste.
    if (this.state === "post" && --this.timer <= 0) {
      this.state = "patrol";
      this.pathIndex = 0;
    } else if (this.state === "patrol" && this.pathIndex >= this.patrolPath.segmentCount() - 1 &&
      p5.Vector.dist(this.pos, this.post) < mPx(3)) {
      this.state = "post";
      this.timer = stepsFor(randomBetween(this.rng, ...this.config.patrolEverySeconds));
    }
  }

  show() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.heading.heading());
    scale(this.sizeFactor());
    drawEmployee(this.look, this.r, { phase: this.walkPhase, moving: this.vel.mag() > 0.05 });
    pop();
  }
}
