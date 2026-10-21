// Véhicule routier : base commune des voitures de luxe et de la navette
// (comme 5-3-PathFollowingComplex/roadVehicle.js). Sous-classe de SteeringAgent.
// Elle regroupe les règles de circulation partagées :
//   - suivi de la route (path following) ;
//   - file d'attente derrière le véhicule prioritaire (A3, suivi de leader),
//     avec freinage anticipé ;
//   - arrêt à la barrière (A2) et passage de la porte dans l'ordre d'arrivée ;
//   - séparation avec les véhicules qui roulent, évitement des obstacles.
// Les sous-classes définissent leurs états, leurs objectifs et leur dessin.
const ROAD_CONFIG = {
  cruiseSpeed: kmh(40),          // routes publiques
  insideSpeed: kmh(20),          // routes du parc
  parkingSpeed: kmh(8),          // manœuvres lentes
  maxForce: 0.15,
  gateSlowRadius: mPx(25),       // A2 : freinage avant la barrière
  gateApproach: mPx(60),         // rejoint la file de la porte à 60 m de la ligne d'arrêt
  queueSlowRadius: mPx(10),      // A3 : freinage minimal derrière le véhicule de devant
  queueGapM: 2,                  // distance entre pare-chocs dans la file
  queueLookAhead: mPx(18),
  separationRadius: mPx(4),
  predictSteps: 8,               // position imminente des véhicules prioritaires (en pas)
  deadlockSteps: stepsFor(1.5),  // interblocage mutuel détecté après 1,5 s
  ignoreSteps: stepsFor(4),      // le plus ancien ignore l'autre pendant 4 s
  weights: { avoid: 2.5, separate: 0.8, follow: 1, arrive: 1, leader: 1 }
};

class RoadVehicle extends SteeringAgent {
  constructor(x, y, options = {}) {
    super(x, y);
    this.config = { ...ROAD_CONFIG, ...(options.config ?? {}) };
    this.length = mPx(options.lengthM ?? 4.8);
    this.widthPx = mPx(options.widthM ?? 1.9);
    this.r = this.length / 2;
    this.maxSpeed = this.config.cruiseSpeed;
    this.maxForce = this.config.maxForce;
    this.separationRadius = this.config.separationRadius;
    this.stopRadius = 1;
    this.stopSpeed = 0.05;
    this.aheadFrames = 12;
    this.avoidWidth = this.widthPx;
    this.pathPredict = mPx(5);
    this.pathTargetAhead = mPx(6);
    this.pathWindow = 4;

    this.gateKey = options.gateKey ?? "nord";
    this.path = options.path ?? null;
    if (this.path && this.path.points.length > 1) {
      this.heading = p5.Vector.sub(this.path.points[1], this.path.points[0]).normalize();
      this.vel = this.heading.copy().mult(this.maxSpeed * 0.8);
    }
    this.level = 0;
    this.state = "approach";
    this.waitSteps = 0;
    this.leaderAhead = null;
    this.braking = false;
    this.age = 0;
    this.blockedSteps = 0;
    this.ignoredCar = null;
    this.ignoreUntil = 0;
    this.setBehavior("path");
  }

  // États où le véhicule suit son chemin ; les autres visent une cible (arrive).
  static FOLLOW_STATES = ["approach", "inside"];
  // États « à l'extérieur du parc ».
  static OUTSIDE_STATES = ["approach", "gateStop"];

  followStates() {
    return RoadVehicle.FOLLOW_STATES;
  }

  // Cible d'arrive de l'état courant : [cible, rayon de freinage] ou null.
  goal(ctx) {
    if (this.state === "gateStop") return [ctx.gate.stopLine, this.config.gateSlowRadius];
    return null;
  }

  // ---------- Perception ----------

  // Zone de freinage : l'arrive de la base réduit la vitesse désirée
  // linéairement (v = vmax · d / R) ; pour que le freinage borné par maxForce
  // puisse suivre ce profil jusqu'à l'arrêt, il faut R ≥ vmax² / maxForce.
  brakingZone() {
    const vmax = Math.max(this.maxSpeed, this.vel.mag());
    return Math.max(this.config.queueSlowRadius, (vmax * vmax) / this.maxForce * 1.2);
  }

  // Vrai si `c` est devant `moi` (ou presque à côté), dans la portée.
  static isAhead(moi, c, portee) {
    const dx = c.pos.x - moi.pos.x;
    const dy = c.pos.y - moi.pos.y;
    if (dx * dx + dy * dy > portee * portee) return false;
    return dx * moi.heading.x + dy * moi.heading.y > -moi.length / 2;
  }

  isOutside() {
    return RoadVehicle.OUTSIDE_STATES.includes(this.state);
  }

  // À qui cède-t-on ? Dehors, à tout le monde ; dans le parc, jamais aux
  // véhicules qui attendent dehors (sinon interblocage à la barrière) ; au
  // garage, seulement aux véhicules du garage (le niveau suffit).
  yieldsTo(c) {
    if (this.level === -1 || this.isOutside()) return true;
    return !(c.isOutside && c.isOutside());
  }

  // Véhicules prioritaires sur nous.
  //  - Devant la barrière : ceux qui nous précèdent dans la file de la porte
  //    (ordre d'arrivée), et ceux qui viennent de la franchir.
  //  - Ailleurs : ceux qui roulent devant nous ou à côté (insertions), sauf
  //    ceux qui arrivent en sens inverse (autre voie). Si deux véhicules se
  //    voient mutuellement, le plus ancien passe.
  priorityCars(cars, gate, pietons = []) {
    const portee = Math.max(this.config.queueLookAhead, this.brakingZone()) + this.length * 2;
    // Les piétons devant nous sont toujours prioritaires (même de face).
    const pietonsDevant = pietons.filter(p => p.level === this.level && p.state !== "gone" && RoadVehicle.isAhead(this, p, portee));
    if (gate && this.state === "gateStop") return [...gate.prioritiesOver(this, cars, mPx(15)), ...pietonsDevant];
    const resultat = pietonsDevant;
    for (const c of cars) {
      if (c === this || c.state === "parked" || c.level !== this.level) continue;
      if (c === this.ignoredCar && this.age < this.ignoreUntil) continue;
      if (!this.yieldsTo(c)) continue;
      if (!RoadVehicle.isAhead(this, c, portee)) continue;
      if (c.vel.magSq() > 0.01 && c.heading.x * this.heading.x + c.heading.y * this.heading.y < -0.3) continue;
      // Départage par ancienneté, sauf si l'autre est arrêté devant nous.
      if (c.id > this.id && c.vel.mag() > 0.05 && RoadVehicle.isAhead(c, this, portee)) continue;
      resultat.push(c);
    }
    return resultat;
  }

  // ---------- Steering ----------

  // File d'attente (A3) : contrainte imposée par les véhicules prioritaires.
  // On parcourt NOTRE chemin (et la ligne droite devant nous, car on peut
  // couper un virage) jusqu'au premier point trop proche d'un véhicule
  // prioritaire (position actuelle ou imminente). Ce véhicule sert de leader.
  // Retourne { libre, cible, zone } ou null si la voie est libre.
  queueConstraint(cars, gate, pietons = []) {
    this.leaderAhead = null;
    if (!this.path) return null;
    const prioritaires = this.priorityCars(cars, gate, pietons);
    if (prioritaires.length === 0) return null;
    const zone = this.brakingZone();
    const ecart = mPx(this.config.queueGapM);
    const portee = zone + this.length * 2 + ecart;
    const imminentes = prioritaires.map(c => c.vel.copy().mult(this.config.predictSteps).add(c.pos));
    this.syncPathIndex(this.path);
    const [a, b] = this.path.segment(this.pathIndex);
    const ici = closestPointOnSegment(this.pos, a, b);
    let libre = Infinity;
    // La ligne droite n'a de sens que si l'on roule vraiment (à l'arrêt, la
    // direction n'est pas fiable) : sinon seuls les points du chemin comptent.
    const roule = this.vel.mag() > 0.3;
    for (let s = 0; s <= portee && libre === Infinity; s += 2) {
      const p = this.path.pointAhead(this.pathIndex, ici, s);
      const droit = roule ? { x: this.pos.x + this.heading.x * s, y: this.pos.y + this.heading.y * s } : p;
      for (let k = 0; k < prioritaires.length; k++) {
        const c = prioritaires[k];
        // Un piéton n'est gênant que s'il est sur notre voie (marge latérale).
        const securite = c.isPedestrian ? c.r + this.widthPx / 2 + mPx(0.8) : c.length / 2 + this.length / 2 + ecart;
        const s2 = securite * securite;
        const q = imminentes[k];
        const touche = pt => (pt.x - c.pos.x) ** 2 + (pt.y - c.pos.y) ** 2 < s2 || (pt.x - q.x) ** 2 + (pt.y - q.y) ** 2 < s2;
        if (touche(p) || touche(droit)) {
          libre = s;
          this.leaderAhead = c;
          break;
        }
      }
    }
    if (!this.leaderAhead) return null;
    const cible = this.path.pointAhead(this.pathIndex, ici, Math.max(0, libre - 2));
    this.debugInfo.queueTarget = cible.copy();
    return { libre, cible, zone };
  }

  // Force de file : arrive derrière le véhicule prioritaire, ou freinage.
  queueForce(contrainte) {
    if (contrainte.libre <= 2) return this.brake();
    this.rayonZoneDeFreinage = contrainte.zone;
    return this.arriveAt(contrainte.cible);
  }

  arriveWith(target, slowRadius) {
    this.rayonZoneDeFreinage = slowRadius;
    return this.arriveAt(target);
  }

  // Séparation avec les véhicules qui roulent à proximité (même niveau).
  separationForce(voisins) {
    const r2 = this.separationRadius * this.separationRadius;
    const proches = voisins.filter(c => {
      if (c.level !== this.level || c.state === "parked") return false;
      const dx = c.pos.x - this.pos.x;
      const dy = c.pos.y - this.pos.y;
      return dx * dx + dy * dy < r2;
    });
    return this.separate(proches);
  }

  // Vrai si la file d'attente est examinée dans l'état courant.
  usesQueue() {
    return true;
  }

  // Vrai si la séparation est appliquée dans l'état courant.
  usesSeparation() {
    return true;
  }

  // Obstacles à éviter dans l'état courant.
  obstacles(ctx) {
    return [];
  }

  // Forces de l'état courant, par ordre de priorité (composition explicite).
  chooseForces(ctx) {
    const w = this.config.weights;
    const voisins = ctx.cars;
    const entrees = [];
    const obstacles = this.obstacles(ctx);
    if (obstacles.length) entrees.push({ name: "avoid", force: this.avoid(obstacles), weight: w.avoid * SteeringAgent.param("avoid", "poids", 1) });

    const suitLeChemin = this.followStates().includes(this.state);
    const but = suitLeChemin ? null : this.goal(ctx);
    const distanceObjectif = suitLeChemin ? Infinity : (but ? p5.Vector.dist(this.pos, but[0]) : 0);

    // Si un véhicule prioritaire laisse moins de place que l'objectif, c'est
    // lui qui impose l'arrêt (suivi du véhicule de devant).
    const contrainte = this.usesQueue() ? this.queueConstraint(voisins, ctx.gate, ctx.pedestrians ?? []) : null;
    let principal;
    let nom;
    if (contrainte && contrainte.libre < distanceObjectif) {
      principal = this.queueForce(contrainte);
      nom = "leader";
    } else if (suitLeChemin) {
      principal = this.follow(this.path);
      nom = "path";
    } else if (but) {
      principal = this.arriveWith(but[0], but[1]);
      nom = "arrive";
    } else {
      principal = this.brake();
      nom = "idle";
    }
    this.detectDeadlock(nom);
    // Le freinage derrière un véhicule prioritaire passe avant la séparation.
    const principalEntree = { name: nom, force: principal, weight: nom === "path" ? w.follow : nom === "leader" ? w.leader : w.arrive };
    if (nom === "leader") entrees.push(principalEntree);
    if (this.usesSeparation()) entrees.push({ name: "separate", force: this.separationForce(voisins), weight: w.separate });
    if (nom !== "leader") entrees.push(principalEntree);
    this.setBehavior(nom);
    return entrees;
  }

  // Interblocage (règle de sélection d'action) : deux véhicules arrêtés qui
  // s'attendent mutuellement depuis plus de deadlockSteps. Le plus ancien
  // (plus petit id) ignore l'autre pendant ignoreSteps pour se dégager.
  // Limité au cas mutuel : jamais dans une file ordinaire.
  detectDeadlock(nom) {
    this.blockedSteps = nom === "leader" && this.vel.mag() < 0.05 ? (this.blockedSteps ?? 0) + 1 : 0;
    const autre = this.leaderAhead;
    if (!autre || this.blockedSteps < this.config.deadlockSteps) return;
    if (autre.leaderAhead === this && (autre.blockedSteps ?? 0) >= this.config.deadlockSteps && this.id < autre.id) {
      this.ignoredCar = autre;
      this.ignoreUntil = this.age + this.config.ignoreSteps;
      this.blockedSteps = 0;
    }
  }

  // Un pas : sélection d'action → forces → intégration héritée (une fois).
  step(ctx) {
    if (this.isIdle()) return;
    this.age = (this.age ?? 0) + 1;
    this.applySpeedLimit(ctx);
    const avant = this.vel.mag();
    this.steer(this.chooseForces(ctx));
    this.update();
    this.braking = this.vel.mag() < avant - 0.005 || (this.behavior === "arrive" && this.vel.mag() < 0.3);
    this.transitions(ctx);
  }

  isIdle() {
    return false;
  }

  applySpeedLimit() {
    this.maxSpeed = this.speedFor(this.state === "approach" ? this.config.cruiseSpeed : this.config.insideSpeed);
  }

  // Transitions communes : file de la porte, puis passage de la barrière.
  transitions(ctx) {
    if (this.state === "approach" && this.remainingOnPath(this.path) <= this.config.gateApproach) {
      this.state = "gateStop";
      ctx.gate.joinQueue(this);
    } else if (this.state === "gateStop" && p5.Vector.dist(this.pos, ctx.gate.stopLine) <= mPx(1.5) && this.vel.mag() < 0.2) {
      ctx.gate.requestOpen();
      // Seul le premier véhicule de la file passe.
      if (ctx.gate.isOpen() && ctx.gate.queue[0] === this && this.onGatePassed(ctx)) {
        ctx.gate.leaveQueue(this);
        ctx.gate.passedCount++;
        this.pathIndex = 0;
        this.state = "inside";
      }
    }
  }

  // Appelé à la barrière ouverte ; la sous-classe prépare son chemin dans le
  // parc. Retourne false pour rester devant la barrière.
  onGatePassed(ctx) {
    return false;
  }

  // Rectangle orienté (collisions.js).
  carrosserie() {
    return { x: this.pos.x, y: this.pos.y, angle: this.heading.heading(), demiLongueur: this.length / 2, demiLargeur: this.widthPx / 2 };
  }
}
