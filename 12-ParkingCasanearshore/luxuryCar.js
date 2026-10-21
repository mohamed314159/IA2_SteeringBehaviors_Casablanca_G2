// Voiture de luxe d'un employé. Sous-classe de RoadVehicle (règles de
// circulation communes : route, file d'attente, barrière).
//
// Sélection d'action (états) :
//   approach      suit la route publique depuis le bord de la carte (path following)
//   gateStop      arrive sur la ligne d'arrêt de la porte (A2) ; la barrière s'ouvre ;
//                 la place est attribuée ici, au passage de la porte
//   inside        suit les routes du parc jusqu'à sa place (path following), sans wander
//   parking       arrive sur sa place de surface (A1) ou du garage (A16 / A17 PMR)
//   garageEntry   arrive sur la bouche de rampe du garage (A13), puis disparaît de la surface
//   ramp          descend la rampe (vitesse réduite, pente 15 %)
//   badge         arrive sur la borne badge en bas de la rampe (A14) et attend
//   garageDrive   suit l'allée de liaison puis l'allée jusqu'à sa place
//   parked        garée : le conducteur descend
const CAR_CONFIG = {
  ...ROAD_CONFIG,
  parkSlowRadius: mPx(8),         // A1 : freinage dans la place
  garageEntrySlowRadius: mPx(15), // A13 : bouche de rampe
  badgeSlowRadius: mPx(12),       // A14 : borne badge
  badgeWaitSteps: stepsFor(2)     // 2 s pour badger
};

class LuxuryCar extends RoadVehicle {
  constructor(x, y, options = {}) {
    const spec = options.spec ?? { ...LUXURY_MODELS[0], color: LUXURY_COLORS[0] };
    super(x, y, { ...options, lengthM: spec.lengthM, widthM: spec.widthM, config: { ...CAR_CONFIG, ...(options.config ?? {}) } });
    this.spec = spec;
    this.kind = options.kind ?? "standard"; // standard | ev | pmr
    this.building = options.building ?? null;
    this.destinationDoor = options.destinationDoor ?? (this.building ? this.building.door : createVector(x, y));
    this.spot = null;
    this.parkedSteps = 0;
  }

  static FOLLOW_STATES = ["approach", "inside", "ramp", "garageDrive"];

  followStates() {
    return LuxuryCar.FOLLOW_STATES;
  }

  goal(ctx) {
    const c = this.config;
    switch (this.state) {
      case "garageEntry": return [ctx.garage.surfaceEntrance, c.garageEntrySlowRadius];
      case "badge": return [ctx.garage.badgeLine, c.badgeSlowRadius];
      case "parking": return [this.spot.pos, c.parkSlowRadius];
      default: return super.goal(ctx);
    }
  }

  // La manœuvre finale dans la place n'utilise ni la file ni la séparation
  // (les voitures garées voisines sont à 2,5 m).
  usesQueue() {
    return this.state !== "parking";
  }

  usesSeparation() {
    return this.state !== "parking";
  }

  obstacles(ctx) {
    return this.level === -1 && ctx.pillars ? ctx.pillars : [];
  }

  isIdle() {
    if (this.state === "parked") this.parkedSteps++;
    return this.state === "parked";
  }

  applySpeedLimit(ctx) {
    const c = this.config;
    let base = c.insideSpeed;
    if (this.state === "approach") base = c.cruiseSpeed;
    else if (this.state === "parking") base = c.parkingSpeed;
    else if (this.state === "ramp") base = c.insideSpeed * ctx.garage.rampSpeedFactor();
    else if (this.state === "garageDrive") base = c.parkingSpeed * 1.5;
    this.maxSpeed = this.speedFor(base);
  }

  // ---------- Transitions d'état (règles explicites) ----------

  transitions(ctx) {
    super.transitions(ctx);
    const c = this.config;
    switch (this.state) {
      case "inside":
        if (this.remainingOnPath(this.path) <= mPx(1.5)) {
          this.state = this.spot.level === -1 ? "garageEntry" : "parking";
        } else if (this.spot.level === -1 && this.remainingOnPath(this.path) <= c.garageEntrySlowRadius) {
          this.state = "garageEntry";
        }
        break;
      case "garageEntry":
        if (this.hasArrived(ctx.garage.surfaceEntrance) || (p5.Vector.dist(this.pos, ctx.garage.surfaceEntrance) < mPx(1) && this.vel.mag() < 0.15)) {
          ctx.onEnterGarage(this);
        }
        break;
      case "ramp":
        if (p5.Vector.dist(this.pos, ctx.garage.badgeLine) <= c.badgeSlowRadius) this.state = "badge";
        break;
      case "badge":
        if (p5.Vector.dist(this.pos, ctx.garage.badgeLine) <= mPx(1) && this.vel.mag() < 0.15) {
          this.waitSteps++;
          if (this.waitSteps >= c.badgeWaitSteps) {
            this.state = "garageDrive";
            this.pathIndex = 1;
          }
        }
        break;
      case "garageDrive":
        if (this.remainingOnPath(this.path) <= mPx(1.5)) this.state = "parking";
        break;
      case "parking":
        if (this.hasArrived(this.spot.pos) || (p5.Vector.dist(this.pos, this.spot.pos) < mPx(0.6) && this.vel.mag() < 0.08)) {
          this.park(ctx);
        }
        break;
    }
  }

  // Passage de la porte : la place est attribuée maintenant.
  onGatePassed(ctx) {
    this.spot = ctx.assign(this);
    if (!this.spot) return false; // complet : la voiture attend devant la barrière
    const route = ctx.plan(this, this.spot);
    this.path = new Path([this.pos.copy(), ...route.inside.map(p => createVector(p.x, p.y)), ...route.tail], mPx(1.5));
    return true;
  }

  // Règle de scène : la voiture passe de la surface au garage (haut de la rampe).
  moveToGarage(garage) {
    this.level = -1;
    this.pos = garage.rampTop.copy();
    this.heading = p5.Vector.sub(garage.rampBottom, garage.rampTop).normalize();
    this.vel = this.heading.copy().mult(0.5);
    this.path = new Path(garage.routeToSpot(this.spot), mPx(1));
    this.pathIndex = 0;
    this.state = "ramp";
    this.waitSteps = 0;
  }

  park(ctx) {
    this.state = "parked";
    this.vel.set(0, 0);
    this.heading = this.spot.facing.copy();
    this.pos = this.spot.pos.copy();
    this.spot.occupy(this);
    this.setBehavior("idle");
    if (ctx.onParked) ctx.onParked(this);
  }

  show() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.heading.heading());
    scale(this.sizeFactor());
    drawLuxuryCar(this.spec, this.length, this.widthPx, {
      brake: this.braking && this.state !== "parked",
      blink: this.state === "parking" || this.state === "garageEntry"
    });
    pop();
  }
}
