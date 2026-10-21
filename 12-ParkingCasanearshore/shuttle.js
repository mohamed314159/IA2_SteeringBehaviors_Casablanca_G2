// Navette du personnel (société de sécurité G4S : texte et couleurs rouge et
// blanc, sans logo). Sous-classe de RoadVehicle : mêmes règles de circulation
// que les voitures (route, file d'attente, barrière).
//
// Sélection d'action (états) :
//   approach   suit la route publique jusqu'à la porte nord (path following)
//   gateStop   arrive sur la ligne d'arrêt de la barrière (A2)
//   inside     suit les routes du parc jusqu'à son arrêt (path following)
//   busStop    arrive sur l'arrêt de la navette (A6, freinage long : véhicule lourd)
//   dwell      portes ouvertes : les employés descendent
//   leaving    repart par la sortie nord jusqu'au bord de la carte
//   gone       sortie de la carte (la scène la retire)
const SHUTTLE_CONFIG = {
  ...ROAD_CONFIG,
  cruiseSpeed: kmh(35),
  insideSpeed: kmh(18),
  maxForce: 0.08,              // véhicule lourd : freinage plus progressif
  stopSlowRadius: mPx(30),     // A6 : arrêt de la navette
  dwellSteps: stepsFor(25),    // 25 s portes ouvertes
  doorOpenSteps: stepsFor(2)
};

class Shuttle extends RoadVehicle {
  constructor(x, y, options = {}) {
    super(x, y, { ...options, lengthM: 12, widthM: 2.55, config: { ...SHUTTLE_CONFIG, ...(options.config ?? {}) } });
    this.stopPoint = options.stopPoint ? options.stopPoint.copy() : null;
    this.insideRoute = options.insideRoute ?? [];   // porte → arrêt
    this.exitRoute = options.exitRoute ?? [];       // arrêt → sortie → bord de carte
    this.passengers = options.passengers ?? 0;
    this.doorOpening = 0;
    this.dwellSteps = 0;
    this.onDoorsOpen = options.onDoorsOpen ?? null;
  }

  static FOLLOW_STATES = ["approach", "inside", "leaving"];

  followStates() {
    return Shuttle.FOLLOW_STATES;
  }

  goal(ctx) {
    if (this.state === "busStop") return [this.stopPoint, this.config.stopSlowRadius];
    return super.goal(ctx);
  }

  usesQueue() {
    return this.state !== "dwell";
  }

  // Une fois ressortie du parc, la navette suit les règles « dehors » :
  // elle cède le passage aux voitures de la route publique.
  isOutside() {
    return super.isOutside() || (this.state === "leaving" && this.leftSite === true);
  }

  isIdle() {
    return this.state === "gone";
  }

  applySpeedLimit() {
    this.maxSpeed = this.speedFor(this.state === "approach" || this.state === "leaving" ? this.config.cruiseSpeed : this.config.insideSpeed);
  }

  onGatePassed() {
    this.path = new Path([this.pos.copy(), ...this.insideRoute.map(p => createVector(p.x, p.y))], mPx(1.5));
    return true;
  }

  // Côté droit de la navette (portes, côté trottoir).
  doorPoint() {
    const droite = createVector(-this.heading.y, this.heading.x);
    return droite.mult(this.widthPx / 2 + mPx(1)).add(this.pos);
  }

  transitions(ctx) {
    super.transitions(ctx);
    switch (this.state) {
      case "inside":
        if (this.remainingOnPath(this.path) <= this.config.stopSlowRadius) this.state = "busStop";
        break;
      case "busStop":
        if (p5.Vector.dist(this.pos, this.stopPoint) <= mPx(1) && this.vel.mag() < 0.05) {
          this.state = "dwell";
          this.dwellSteps = 0;
        }
        break;
      case "dwell":
        this.dwellSteps++;
        this.doorOpening = Math.min(1, this.dwellSteps / this.config.doorOpenSteps);
        // Les portes s'ouvrent seulement après l'arrêt complet.
        if (this.dwellSteps === this.config.doorOpenSteps && this.onDoorsOpen) this.onDoorsOpen(this);
        if (this.dwellSteps >= this.config.dwellSteps) {
          this.doorOpening = 0;
          this.passengers = 0;
          this.path = new Path([this.pos.copy(), ...this.exitRoute.map(p => createVector(p.x, p.y))], mPx(1.5));
          this.pathIndex = 0;
          this.state = "leaving";
        }
        break;
      case "leaving":
        if (ctx.insideSite) this.leftSite = !ctx.insideSite(this.pos);
        if (this.remainingOnPath(this.path) <= mPx(2)) this.state = "gone";
        break;
    }
  }

  show() {
    const L = this.length;
    const W = this.widthPx;
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.heading.heading());
    scale(this.sizeFactor());
    noStroke();
    fill(0, 0, 0, 70);
    rect(-L / 2 + 0.4, -W / 2 + 0.6, L, W, 1.2);
    fill(15);
    for (const x of [-L * 0.32, L * 0.3]) {
      rect(x, -W / 2 - 0.3, 2.2, 0.6, 0.2);
      rect(x, W / 2 - 0.3, 2.2, 0.6, 0.2);
    }
    // Caisse blanche, bandes rouges G4S
    fill(250);
    stroke(0, 0, 0, 150);
    strokeWeight(0.12);
    rect(-L / 2, -W / 2, L, W, 1.2);
    noStroke();
    fill(200, 16, 46);
    rect(-L / 2 + 0.6, -W / 2 + 0.5, L - 3.2, 0.7);
    rect(-L / 2 + 0.6, W / 2 - 1.2, L - 3.2, 0.7);
    // Vitres de toit et pare-brise
    fill(205, 215, 222);
    for (let i = 0; i < 4; i++) rect(-L / 2 + 2 + i * 4.6, -W / 2 + 1.6, 3.4, W - 3.2, 0.3);
    fill(140, 180, 215);
    rect(L / 2 - 1.6, -W / 2 + 0.5, 1.1, W - 1, 0.4);
    // Texte G4S sur le toit
    fill(200, 16, 46);
    textAlign(CENTER, CENTER);
    textSize(2.4);
    textStyle(BOLD);
    text("G4S", -1, 0.2);
    textStyle(NORMAL);
    // Portes côté droit (ouvertes pendant l'arrêt)
    fill(60);
    const decalage = this.doorOpening * 1.6;
    rect(L * 0.12 + decalage, W / 2 - 0.25, 2.2, 0.35);
    rect(-L * 0.28 + decalage, W / 2 - 0.25, 2.2, 0.35);
    // Feux
    fill(255, 248, 210);
    rect(L / 2 - 0.45, -W / 2 + 0.3, 0.45, 0.6);
    rect(L / 2 - 0.45, W / 2 - 0.9, 0.45, 0.6);
    fill(this.braking ? color(255, 40, 40) : color(110, 20, 20));
    rect(-L / 2, -W / 2 + 0.3, 0.45, 0.6);
    rect(-L / 2, W / 2 - 0.9, 0.45, 0.6);
    pop();
  }
}
