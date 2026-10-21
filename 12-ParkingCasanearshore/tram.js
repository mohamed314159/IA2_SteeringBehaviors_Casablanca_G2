// Tram à deux longues caisses (32 m chacune, 65 m au total). La tête est un SteeringAgent
// qui suit la voie (path following) puis fait un arrive très long au quai
// (A5 : véhicule lourd) ; la seconde caisse (TramCar) la suit comme un anneau
// de serpent. Les portes ne s'ouvrent qu'à l'arrêt complet des deux caisses.
//
// Sélection d'action (états) :
//   approach   suit la voie (path following)
//   arriving   arrive sur le quai de la station (A5)
//   dwell      portes ouvertes : les employés descendent
//   departing  repart en suivant la voie jusqu'au bord de la carte
//   gone       sorti de la carte (la scène le retire)
const TRAM_CONFIG = {
  lineSpeed: kmh(40),
  maxForce: 0.07,              // freinage doux d'un véhicule lourd
  stationSlowRadius: mPx(150), // A5 : 150 m de freinage avant le quai (≥ v² / maxForce)
  dwellSteps: stepsFor(30),    // 30 s à quai
  doorOpenSteps: stepsFor(2),
  carLengthM: 32,           // 2 × 32 m = 65 m, comme les rames doubles de Casablanca
  widthM: 2.65
};

class Tram extends SteeringAgent {
  constructor(path, station, options = {}) {
    const depart = path.points[0];
    super(depart.x, depart.y);
    this.config = { ...TRAM_CONFIG, ...(options.config ?? {}) };
    this.path = path;
    this.station = station.copy();
    this.platformSide = options.platformSide ? options.platformSide.copy() : createVector(0, 1);
    this.length = mPx(this.config.carLengthM);
    this.widthPx = mPx(this.config.widthM);
    this.r = this.length / 2;
    this.maxSpeed = this.config.lineSpeed;
    this.maxForce = this.config.maxForce;
    this.stopRadius = 1;
    this.stopSpeed = 0.03;
    this.pathPredict = mPx(10);
    this.pathTargetAhead = mPx(12);
    this.pathWindow = 6;
    this.heading = p5.Vector.sub(path.points[1], path.points[0]).normalize();
    this.vel = this.heading.copy().mult(this.maxSpeed);
    // Seconde caisse placée derrière la tête.
    const arriere = p5.Vector.sub(this.pos, this.heading.copy().mult(this.length + mPx(0.8)));
    this.trailer = new TramCar(arriere.x, arriere.y, this, { length: this.length, width: this.widthPx });
    this.trailer.vel = this.vel.copy();
    this.state = "approach";
    this.dwellSteps = 0;
    this.doorOpening = 0;
    this.passengers = options.passengers ?? 0;
    this.onDoorsOpen = options.onDoorsOpen ?? null;
    this.level = 0;
  }

  cars() {
    return [this, this.trailer];
  }

  // Un pas : tête (sélection d'action → force → intégration), puis caisse 2.
  step() {
    if (this.state === "gone") return;
    this.maxSpeed = this.speedFor(this.config.lineSpeed);
    this.trailer.sizeScale = this.sizeFactor();
    let force;
    if (this.state === "approach" || this.state === "departing") {
      force = this.follow(this.path);
      this.setBehavior("path");
    } else if (this.state === "arriving") {
      this.rayonZoneDeFreinage = this.config.stationSlowRadius;
      force = this.arriveAt(this.station);
      this.setBehavior("arrive");
    } else {
      force = this.brake();
      this.setBehavior("idle");
    }
    this.steer([{ name: this.behavior, force }]);
    this.update();
    this.trailer.stepFollow();
    this.transitions();
  }

  transitions() {
    switch (this.state) {
      case "approach":
        // Passe en arrive quand le quai est dans la zone de freinage, devant.
        if (p5.Vector.dist(this.pos, this.station) <= this.config.stationSlowRadius &&
          p5.Vector.sub(this.station, this.pos).dot(this.heading) > 0) this.state = "arriving";
        break;
      case "arriving":
        if (this.hasArrived(this.station) && this.trailer.vel.mag() < 0.03) {
          this.vel.set(0, 0);
          this.state = "dwell";
          this.dwellSteps = 0;
        }
        break;
      case "dwell":
        this.dwellSteps++;
        this.doorOpening = Math.min(1, this.dwellSteps / this.config.doorOpenSteps);
        this.trailer.doorOpening = this.doorOpening;
        if (this.dwellSteps === this.config.doorOpenSteps && this.onDoorsOpen) this.onDoorsOpen(this);
        if (this.dwellSteps >= this.config.dwellSteps) {
          this.doorOpening = 0;
          this.trailer.doorOpening = 0;
          this.passengers = 0;
          this.state = "departing";
        }
        break;
      case "departing":
        if (this.remainingOnPath(this.path) <= mPx(5)) this.state = "gone";
        break;
    }
  }

  // Portes côté quai : quatre par caisse.
  doorPoints() {
    const points = [];
    for (const caisse of this.cars()) {
      const cote = this.platformSide.copy().setMag(caisse.widthPx / 2 + mPx(1.2));
      for (const t of [-0.38, -0.14, 0.1, 0.34]) {
        points.push(caisse.heading.copy().mult(caisse.length * t + mPx(1.4)).add(caisse.pos).add(cote));
      }
    }
    return points;
  }

  show() {
    this.trailer.show();
    drawTramBody(this, true);
    // Attelage
    push();
    stroke(60);
    strokeWeight(mPx(1.2));
    const a = this.heading.copy().mult(-this.length / 2).add(this.pos);
    const b = this.trailer.heading.copy().mult(this.trailer.length / 2).add(this.trailer.pos);
    line(a.x, a.y, b.x, b.y);
    pop();
  }
}
